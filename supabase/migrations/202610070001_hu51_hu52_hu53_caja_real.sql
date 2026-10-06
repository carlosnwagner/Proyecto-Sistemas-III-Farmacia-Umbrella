-- Adaptada al esquema diagnosticado. No recrea las tablas ni concede escritura anónima.
begin;

alter table public.usuario_auth_caja
  add column if not exists puede_apertura boolean not null default false,
  add column if not exists puede_arqueo boolean not null default false,
  add column if not exists puede_cierre boolean not null default false,
  add column if not exists puede_consultar boolean not null default false;
alter table public.turno_caja
  add column if not exists version_movimientos bigint not null default 0,
  add column if not exists fecha_hora_cierre timestamptz,
  add column if not exists usuario_cierre_id integer references public.usuario(id_usuario),
  add column if not exists arqueo_cierre_id bigint references public.arqueo_caja(id_arqueo),
  add column if not exists observacion_cierre text,
  add column if not exists resumen_cierre jsonb,
  add column if not exists clave_cierre uuid;
alter table public.arqueo_caja
  add column if not exists version_movimientos bigint,
  add column if not exists auth_id uuid references auth.users(id),
  add column if not exists clave_confirmacion uuid;
alter table public.movimiento_caja add column if not exists referencia_venta text;
create unique index if not exists hu52_clave_cierre_unica on public.turno_caja(clave_cierre) where clave_cierre is not null;
create unique index if not exists hu51_clave_unica on public.arqueo_caja(clave_confirmacion) where clave_confirmacion is not null;

-- Los arqueos anteriores no tienen una versión comprobable: no se borran.
-- Se evalúa su vigencia mediante version_movimientos IS NOT NULL, sin actualizarlos.
revoke insert, update, delete, truncate on public.caja, public.turno_caja,
  public.arqueo_caja, public.movimiento_caja, public.usuario_auth_caja,
  public.usuario_sucursal_caja from anon, authenticated;
alter table public.arqueo_caja enable row level security;
revoke select on public.arqueo_caja from anon, authenticated;

create or replace function public.caja_usuario(p_sucursal bigint, p_accion text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_id integer;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para operar la caja'; end if;
  select a.usuario_id into v_id from public.usuario_auth_caja a
  join public.usuario u on u.id_usuario = a.usuario_id and u.estado is true
  join public.usuario_sucursal_caja s on s.usuario_id = a.usuario_id
  where a.auth_id = auth.uid() and a.activo and s.sucursal_id = p_sucursal
    and case p_accion
      when 'apertura' then a.puede_apertura
      when 'arqueo' then a.puede_arqueo
      when 'cierre' then a.puede_cierre
      when 'consulta' then a.puede_consultar or a.puede_movimientos or a.puede_arqueo or a.puede_cierre or a.puede_apertura
      else false end;
  if not found then raise exception 'No tenés permiso de % en esta sucursal', p_accion; end if;
  return v_id;
end; $$;

-- Todos los insertadores (también futuras ventas) toman el mismo bloqueo del turno.
create or replace function public.validar_turno_caja_abierto()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_estado text;
begin
  select estado into v_estado from public.turno_caja where id = new.turno_id for update;
  if not found then raise exception 'TURNO_INEXISTENTE'; end if;
  if v_estado is distinct from 'Abierto' then raise exception 'TURNO_CERRADO'; end if;
  return new;
end; $$;
create or replace function public.caja_invalidar_arqueos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.turno_caja set version_movimientos = version_movimientos + 1 where id = new.turno_id;
  update public.arqueo_caja set valido_para_cierre = false
    where turno_id = new.turno_id and valido_para_cierre;
  return new;
end; $$;
drop trigger if exists caja_invalidar_arqueos on public.movimiento_caja;
create trigger caja_invalidar_arqueos after insert on public.movimiento_caja
  for each row execute function public.caja_invalidar_arqueos();
create or replace function public.caja_movimiento_inmutable()
returns trigger language plpgsql as $$
begin raise exception 'Corregí el movimiento mediante una reversión'; end; $$;
drop trigger if exists caja_movimiento_inmutable on public.movimiento_caja;
create trigger caja_movimiento_inmutable before update or delete on public.movimiento_caja
  for each row execute function public.caja_movimiento_inmutable();

create or replace function public.caja_resumen(p_turno bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.turno_caja%rowtype; v_totales jsonb; v_mov jsonb; v_arqueos jsonb;
begin
  select * into t from public.turno_caja where id = p_turno for share;
  if not found then raise exception 'El turno no existe'; end if;
  perform public.caja_usuario(t.sucursal_id, 'consulta');
  select jsonb_build_object(
    'saldo_inicial', t.saldo_inicial,
    'ingresos_efectivo', coalesce(sum(importe) filter(where medio='Efectivo' and tipo='Ingreso'),0),
    'egresos_efectivo', coalesce(sum(importe) filter(where medio='Efectivo' and tipo='Egreso'),0),
    'efectivo_esperado', t.saldo_inicial + coalesce(sum(case when tipo='Ingreso' then importe else -importe end) filter(where medio='Efectivo'),0),
    'tarjeta_neto', coalesce(sum(case when tipo='Ingreso' then importe else -importe end) filter(where medio='Tarjeta'),0),
    'transferencia_neto', coalesce(sum(case when tipo='Ingreso' then importe else -importe end) filter(where medio='Transferencia'),0)
  ) into v_totales from public.movimiento_caja where turno_id=p_turno;
  select coalesce(jsonb_agg(to_jsonb(m) - 'auth_id' - 'idempotency_key' order by fecha_hora desc,id desc),'[]'::jsonb)
    into v_mov from public.movimiento_caja m where turno_id=p_turno;
  select coalesce(jsonb_agg((to_jsonb(a)-'auth_id'-'clave_confirmacion') || jsonb_build_object('vigente',
    t.estado='Abierto' and a.valido_para_cierre and a.version_movimientos=t.version_movimientos)
    order by fecha_hora desc,id_arqueo desc),'[]'::jsonb)
    into v_arqueos from public.arqueo_caja a where turno_id=p_turno;
  return jsonb_build_object('turno',to_jsonb(t)-'clave_cierre', 'totales',v_totales,
    'movimientos',v_mov,'arqueos',v_arqueos);
end; $$;

create or replace function public.caja_listar_turnos()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_resultado jsonb;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para consultar movimientos'; end if;
  select coalesce(jsonb_agg((to_jsonb(t)-'clave_cierre') || jsonb_build_object('caja_nombre',c.nombre)
    order by t.fecha_hora_apertura desc,t.id desc),'[]'::jsonb) into v_resultado
  from public.turno_caja t join public.caja c on c.id=t.caja_id
  where exists(select 1 from public.usuario_auth_caja a
    join public.usuario u on u.id_usuario=a.usuario_id and u.estado is true
    join public.usuario_sucursal_caja s on s.usuario_id=a.usuario_id
    where a.auth_id=auth.uid() and a.activo and s.sucursal_id=t.sucursal_id
      and (a.puede_consultar or a.puede_movimientos or a.puede_arqueo or a.puede_cierre or a.puede_apertura));
  return v_resultado;
end; $$;

create or replace function public.caja_registrar_arqueo(p_turno bigint,p_contado numeric,p_version bigint,p_clave uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.turno_caja%rowtype; a public.arqueo_caja%rowtype; v_usuario integer; v_esperado numeric;
begin
  select * into t from public.turno_caja where id=p_turno for update;
  if not found then raise exception 'El turno no existe'; end if;
  v_usuario := public.caja_usuario(t.sucursal_id,'arqueo');
  if t.cajero_id is distinct from v_usuario then raise exception 'Solo podés arquear tu propio turno'; end if;
  if p_clave is null then raise exception 'Falta la clave de confirmación'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_clave::text,0));
  select * into a from public.arqueo_caja where clave_confirmacion=p_clave;
  if found then
    if a.turno_id is distinct from p_turno or a.auth_id is distinct from auth.uid()
      or a.efectivo_contado is distinct from p_contado or a.version_movimientos is distinct from p_version then
      raise exception 'La clave ya fue utilizada para otra operación'; end if;
    return to_jsonb(a)-'auth_id'-'clave_confirmacion';
  end if;
  if t.estado is distinct from 'Abierto' then raise exception 'El turno está cerrado'; end if;
  if t.version_movimientos is distinct from p_version then raise exception 'Ingresaron movimientos. Actualizá el saldo antes de arquear'; end if;
  if p_contado is null or p_contado::text in ('NaN','Infinity','-Infinity') or p_contado < 0
    or p_contado <> round(p_contado,2) or p_contado >= 1000000000000 then raise exception 'Ingresá un contado válido, no negativo, con hasta dos decimales'; end if;
  select t.saldo_inicial + coalesce(sum(case when tipo='Ingreso' then importe else -importe end),0)
    into v_esperado from public.movimiento_caja where turno_id=p_turno and medio='Efectivo';
  insert into public.arqueo_caja(turno_id,usuario_id,efectivo_esperado,efectivo_contado,diferencia,
    fecha_hora,valido_para_cierre,version_movimientos,auth_id,clave_confirmacion)
    values(p_turno,v_usuario,v_esperado,p_contado,p_contado-v_esperado,clock_timestamp(),true,p_version,auth.uid(),p_clave)
    returning * into a;
  return to_jsonb(a)-'auth_id'-'clave_confirmacion';
end; $$;

create or replace function public.caja_cerrar_turno(p_turno bigint,p_arqueo bigint,p_version bigint,p_observacion text,p_clave uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t public.turno_caja%rowtype; a public.arqueo_caja%rowtype; v_usuario integer; v_resumen jsonb;
begin
  select * into t from public.turno_caja where id=p_turno for update;
  if not found then raise exception 'El turno no existe'; end if;
  v_usuario := public.caja_usuario(t.sucursal_id,'cierre');
  if t.cajero_id is distinct from v_usuario then raise exception 'Solo podés cerrar tu propio turno'; end if;
  if p_clave is null then raise exception 'Falta la clave de confirmación'; end if;
  if t.estado='Cerrado' and t.clave_cierre=p_clave then
    if t.arqueo_cierre_id is distinct from p_arqueo or t.version_movimientos is distinct from p_version
      or t.observacion_cierre is distinct from nullif(trim(p_observacion),'') or t.usuario_cierre_id is distinct from v_usuario then
      raise exception 'La clave ya fue utilizada para otra operación'; end if;
    return t.resumen_cierre;
  end if;
  if t.estado is distinct from 'Abierto' then raise exception 'El turno está cerrado'; end if;
  if t.version_movimientos is distinct from p_version then raise exception 'Ingresaron movimientos durante la confirmación. Repetí el arqueo'; end if;
  select * into a from public.arqueo_caja where id_arqueo=p_arqueo and turno_id=p_turno;
  if not found then raise exception 'Seleccioná un arqueo del turno'; end if;
  if not a.valido_para_cierre or a.version_movimientos is distinct from t.version_movimientos or a.auth_id is null then
    raise exception 'El arqueo no está vigente. Realizá uno nuevo'; end if;
  if exists(select 1 from public.arqueo_caja where turno_id=p_turno and id_arqueo > a.id_arqueo) then
    raise exception 'Hay un arqueo más reciente. Actualizá el resumen'; end if;
  if a.diferencia <> 0 and nullif(trim(p_observacion),'') is null then raise exception 'Indicá un motivo para el faltante o sobrante'; end if;
  v_resumen := public.caja_resumen(p_turno)->'totales';
  if (v_resumen->>'efectivo_esperado')::numeric is distinct from a.efectivo_esperado then raise exception 'El saldo cambió. Realizá un nuevo arqueo'; end if;
  v_resumen := v_resumen || jsonb_build_object('efectivo_contado',a.efectivo_contado,'diferencia',a.diferencia,
    'arqueo_id',a.id_arqueo,'usuario_id',v_usuario,'fecha_hora',clock_timestamp(),'observacion',nullif(trim(p_observacion),''));
  update public.turno_caja set estado='Cerrado',fecha_hora_cierre=(v_resumen->>'fecha_hora')::timestamptz,
    usuario_cierre_id=v_usuario,arqueo_cierre_id=a.id_arqueo,observacion_cierre=nullif(trim(p_observacion),''),
    resumen_cierre=v_resumen,clave_cierre=p_clave where id=p_turno;
  return v_resumen;
end; $$;

-- Reemplaza la apertura anónima y elimina la dependencia de IDs elegidos como identidad.
create or replace function public.abrir_turno_caja(p_caja_id integer,p_sucursal_id integer,p_cajero_id integer,p_saldo_inicial numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.caja%rowtype; v_usuario integer; t public.turno_caja%rowtype;
begin
  select * into c from public.caja where id=p_caja_id for update;
  if not found or not c.activa or c.sucursal_id is distinct from p_sucursal_id then raise exception 'Caja no disponible en esta sucursal'; end if;
  v_usuario := public.caja_usuario(c.sucursal_id,'apertura');
  if v_usuario is distinct from p_cajero_id then raise exception 'La apertura debe pertenecer al usuario autenticado'; end if;
  if p_saldo_inicial is null or p_saldo_inicial::text in ('NaN','Infinity','-Infinity') or p_saldo_inicial < 0
    or p_saldo_inicial <> round(p_saldo_inicial,2) or p_saldo_inicial >= 1000000000000 then raise exception 'Importe inicial inválido'; end if;
  if exists(select 1 from public.turno_caja where caja_id=c.id and estado='Abierto') then raise exception 'La caja ya está abierta'; end if;
  insert into public.turno_caja(caja_id,sucursal_id,cajero_id,saldo_inicial,estado,fecha_hora_apertura)
    values(c.id,c.sucursal_id,v_usuario,p_saldo_inicial,'Abierto',clock_timestamp()) returning * into t;
  return to_jsonb(t) || jsonb_build_object('caja_nombre',c.nombre);
exception when unique_violation then raise exception 'La caja ya está abierta';
end; $$;

revoke all on function public.caja_usuario(bigint,text),public.validar_turno_caja_abierto(),
  public.caja_invalidar_arqueos(),public.caja_movimiento_inmutable() from public,anon,authenticated;
revoke all on function public.caja_resumen(bigint),public.caja_listar_turnos(),
  public.caja_registrar_arqueo(bigint,numeric,bigint,uuid),public.caja_cerrar_turno(bigint,bigint,bigint,text,uuid),
  public.abrir_turno_caja(integer,integer,integer,numeric) from public,anon,authenticated;
grant execute on function public.caja_resumen(bigint),public.caja_listar_turnos(),
  public.caja_registrar_arqueo(bigint,numeric,bigint,uuid),public.caja_cerrar_turno(bigint,bigint,bigint,text,uuid),
  public.abrir_turno_caja(integer,integer,integer,numeric) to authenticated;
commit;
