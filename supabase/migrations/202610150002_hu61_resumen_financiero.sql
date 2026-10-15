-- HU61. Ejecutar después de 202610150001 y las migraciones de caja HU50/HU69.
begin;

-- Metadatos separados: no se modifican movimientos de caja inmutables.
create table public.clasificacion_flujo_caja (
  movimiento_id bigint primary key references public.movimiento_caja(id),
  clase text not null check (clase in ('Operativo','TransferenciaInterna','PagoProveedor')),
  pago_id bigint unique references public.pago_proveedor(id_pago),
  clasificado_por uuid not null references auth.users(id),
  fecha_clasificacion timestamptz not null default now(),
  check ((clase = 'PagoProveedor') = (pago_id is not null))
);
alter table public.clasificacion_flujo_caja enable row level security;
revoke all on public.clasificacion_flujo_caja from public, anon, authenticated;
create index movimiento_caja_fecha_finanzas_idx on public.movimiento_caja(fecha_hora,id);

create function public.hu61_admin()
returns integer language plpgsql stable security definer set search_path = public as $$
declare v_usuario integer;
begin
  select id_usuario into v_usuario from public.usuario
  where auth_id=auth.uid() and estado is true and rol='administrador';
  if not found then raise exception 'Necesitás una sesión de administrador activa para consultar finanzas'; end if;
  return v_usuario;
end; $$;

-- Interna: solo las RPC que ya verificaron permisos pueden invocarla.
create function public.hu61_guardar_clasificacion(p_movimiento bigint,p_clase text,p_pago bigint)
returns void language plpgsql security definer set search_path = public as $$
declare m public.movimiento_caja%rowtype; p public.pago_proveedor%rowtype;
  c public.clasificacion_flujo_caja%rowtype; v_sucursal bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('hu61:'||p_movimiento::text,0));
  select * into m from public.movimiento_caja where id=p_movimiento;
  if not found or m.origen <> 'Manual' then raise exception 'Clasificá solamente el movimiento manual original'; end if;
  if p_clase is null or p_clase not in ('Operativo','TransferenciaInterna','PagoProveedor')
    or ((p_clase='PagoProveedor') <> (p_pago is not null)) then raise exception 'Clasificación financiera inválida'; end if;
  select * into c from public.clasificacion_flujo_caja where movimiento_id=p_movimiento;
  if found then
    if c.clase is distinct from p_clase or c.pago_id is distinct from p_pago then
      raise exception 'El movimiento ya tiene otra clasificación; verificá la operación'; end if;
    return;
  end if;
  if p_pago is not null then
    select * into p from public.pago_proveedor where id_pago=p_pago for update;
    if not found then raise exception 'El pago a proveedor no existe'; end if;
    select sucursal_id into v_sucursal from public.turno_caja where id=m.turno_id;
    if m.tipo<>'Egreso' or m.importe is distinct from p.importe_total
      or p.id_sucursal is distinct from v_sucursal
      or p.fecha_pago::date is distinct from (m.fecha_hora at time zone 'America/Argentina/Buenos_Aires')::date then
      raise exception 'El pago debe coincidir en sucursal, fecha efectiva e importe con el egreso'; end if;
    if exists(select 1 from public.clasificacion_flujo_caja where pago_id=p_pago) then
      raise exception 'El pago ya está vinculado a otro movimiento de caja'; end if;
  end if;
  insert into public.clasificacion_flujo_caja(movimiento_id,clase,pago_id,clasificado_por)
    values(p_movimiento,p_clase,p_pago,auth.uid());
end; $$;

create function public.hu61_clasificar_movimiento(p_movimiento bigint,p_clase text,p_pago bigint default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.hu61_admin();
  perform public.hu61_guardar_clasificacion(p_movimiento,p_clase,p_pago);
end; $$;

-- Preserva todas las validaciones, bloqueo e idempotencia de HU50.
create function public.hu61_registrar_movimiento_caja(
  p_turno_id bigint,p_tipo text,p_concepto text,p_importe numeric,p_medio_pago_id integer,
  p_idempotency_key uuid,p_movimiento_original_id bigint default null,
  p_clase text default 'Operativo',p_pago bigint default null
) returns public.movimiento_caja language plpgsql security definer set search_path = public as $$
declare m public.movimiento_caja%rowtype;
begin
  m := public.hu50_registrar_movimiento(p_turno_id,p_tipo,p_concepto,p_importe,
    p_medio_pago_id,p_idempotency_key,p_movimiento_original_id);
  if m.origen='Manual' then
    perform public.hu61_guardar_clasificacion(m.id,p_clase,p_pago);
  end if;
  return m;
end; $$;

create function public.finanzas_contexto()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_hoy date := (now() at time zone 'America/Argentina/Buenos_Aires')::date; v_sucursales jsonb;
begin
  perform public.hu61_admin();
  -- El administrador actual tiene alcance sobre todas las sucursales.
  -- Incluye inactivas para poder consultar su historia financiera.
  select coalesce(jsonb_agg(jsonb_build_object('id',id_sucursal,'nombre',
    concat(codigo,' — ',descripcion)) order by codigo,id_sucursal),'[]'::jsonb)
    into v_sucursales from public.sucursal;
  return jsonb_build_object('sucursales',v_sucursales,
    'desde',date_trunc('month',v_hoy)::date,
    'hasta',(date_trunc('month',v_hoy)+interval '1 month - 1 day')::date);
end; $$;

create function public.finanzas_resumen(p_desde date,p_hasta date,p_sucursal bigint default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_resultado jsonb; v_inicio timestamptz; v_fin timestamptz;
begin
  perform public.hu61_admin();
  if p_desde is null or p_hasta is null or not isfinite(p_desde) or not isfinite(p_hasta)
    or p_desde>p_hasta then raise exception 'Indicá un rango de fechas válido: desde debe ser anterior o igual a hasta'; end if;
  if p_sucursal is not null and not exists(select 1 from public.sucursal where id_sucursal=p_sucursal) then
    raise exception 'La sucursal no está autorizada o no existe'; end if;
  if not exists(select 1 from public.sucursal) then raise exception 'No hay sucursales autorizadas'; end if;
  v_inicio := p_desde::timestamp at time zone 'America/Argentina/Buenos_Aires';
  v_fin := (p_hasta+1)::timestamp at time zone 'America/Argentina/Buenos_Aires';
  -- Una sola sentencia: detalle, diagnósticos y totales comparten snapshot.
  with caja as (
    select m.*,t.sucursal_id,c.clase,c.pago_id,o.origen as original_origen,
      coalesce(m.movimiento_original_id,m.id) as original_id
    from public.movimiento_caja m join public.turno_caja t on t.id=m.turno_id
    join public.movimiento_caja o on o.id=coalesce(m.movimiento_original_id,m.id)
    left join public.clasificacion_flujo_caja c on c.movimiento_id=coalesce(m.movimiento_original_id,m.id)
    where m.fecha_hora>=v_inicio and m.fecha_hora<v_fin
      and (p_sucursal is null or t.sucursal_id=p_sucursal)
  ), pagos as (
    select p.*,coalesce((select sum(d.importe_aplicado) from public.detalle_pago d where d.id_pago=p.id_pago),0) as aplicado
    from public.pago_proveedor p
    where p.fecha_pago::date between p_desde and p_hasta
      and (p_sucursal is null or p.id_sucursal=p_sucursal or p.id_sucursal is null)
  ), incidencias as (
    select 'pago:'||id_pago as id,'PagoProveedor'::text as origen,id_pago as referencia,
      case when id_sucursal is null then 'Sucursal pendiente' else 'Aplicaciones incompletas o importe inválido' end as motivo,
      id_sucursal as sucursal_id,fecha_pago::text as fecha,importe_total::text as importe,
      'Pago a proveedor #'||id_proveedor as concepto
    from pagos where id_sucursal is null or importe_total is null or importe_total<=0
      or importe_total::text in ('NaN','Infinity','-Infinity') or aplicado<>importe_total
    union all
    select distinct 'caja:'||c.original_id,'Caja',c.original_id,'Clasificación pendiente',
      c.sucursal_id,(o.fecha_hora at time zone 'America/Argentina/Buenos_Aires')::date::text,o.importe::text,o.concepto
    from caja c join public.movimiento_caja o on o.id=c.original_id
    where o.origen='Manual' and c.clase is null
    union all
    select 'vinculo:'||m.id,'VinculoPago',p.id_pago,'Vínculo de pago modificado',
      t.sucursal_id,p.fecha_pago::text,p.importe_total::text,m.concepto
    from public.clasificacion_flujo_caja c
    join public.movimiento_caja m on m.id=c.movimiento_id
    join public.turno_caja t on t.id=m.turno_id
    join public.pago_proveedor p on p.id_pago=c.pago_id
    where ((m.fecha_hora>=v_inicio and m.fecha_hora<v_fin) or p.fecha_pago::date between p_desde and p_hasta)
      and (p_sucursal is null or t.sucursal_id=p_sucursal or p.id_sucursal=p_sucursal)
      and (p.importe_total is distinct from m.importe or p.id_sucursal is distinct from t.sucursal_id
        or p.fecha_pago::date is distinct from (m.fecha_hora at time zone 'America/Argentina/Buenos_Aires')::date)
  ), movimientos as (
    select 'caja:'||id as id,fecha_hora as fecha_efectiva,sucursal_id,concepto,
      case when origen='Reversion' then 'Reversión' else origen end as origen,tipo,importe
    from caja where original_origen='Venta' or (clase is not null and clase<>'TransferenciaInterna'
      and (clase<>'PagoProveedor' or origen='Reversion'))
    union all
    select 'pago:'||id_pago,fecha_pago::date::timestamp at time zone 'America/Argentina/Buenos_Aires',
      id_sucursal,'Pago a proveedor #'||id_proveedor||' · Pago #'||id_pago,'Proveedor','Egreso',importe_total
    from pagos where id_sucursal is not null and importe_total>0
      and importe_total::text not in ('NaN','Infinity','-Infinity') and aplicado=importe_total
  )
  select jsonb_build_object('periodo',jsonb_build_object('desde',p_desde,'hasta',p_hasta),
    'sucursal_id',p_sucursal,'completo',not exists(select 1 from incidencias),
    'incidencias',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from incidencias i),'[]'::jsonb),
    'totales',case when exists(select 1 from incidencias) then null else
      (select jsonb_build_object('ingresos',coalesce(sum(importe) filter(where tipo='Ingreso'),0)::text,
        'egresos',coalesce(sum(importe) filter(where tipo='Egreso'),0)::text,
        'flujo_neto',coalesce(sum(case when tipo='Ingreso' then importe else -importe end),0)::text) from movimientos) end,
    'movimientos',case when exists(select 1 from incidencias) then '[]'::jsonb else
      coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('importe',m.importe::text)
        order by fecha_efectiva desc,id desc) from movimientos m),'[]'::jsonb) end)
    into v_resultado;
  return v_resultado;
end; $$;

revoke all on function public.hu61_admin(),public.hu61_guardar_clasificacion(bigint,text,bigint),
  public.hu61_clasificar_movimiento(bigint,text,bigint),public.finanzas_contexto(),
  public.finanzas_resumen(date,date,bigint),
  public.hu61_registrar_movimiento_caja(bigint,text,text,numeric,integer,uuid,bigint,text,bigint)
  from public,anon,authenticated;
grant execute on function public.hu61_clasificar_movimiento(bigint,text,bigint),
  public.finanzas_contexto(),public.finanzas_resumen(date,date,bigint),
  public.hu61_registrar_movimiento_caja(bigint,text,text,numeric,integer,uuid,bigint,text,bigint)
  to authenticated;
commit;
