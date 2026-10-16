-- HU66: integra pedidos online pagados con ventas e inventario.
-- Mercado Pago se registra como ingreso externo; no crea movimientos de caja.
begin;

alter table public.pedido_online
  add column if not exists stock_descontado boolean not null default false;

alter table public.venta
  add column if not exists id_pedido_online bigint references public.pedido_online(id_pedido);

create unique index if not exists venta_pedido_online_unique
  on public.venta(id_pedido_online) where id_pedido_online is not null;

create table if not exists public.pedido_online_venta_reconciliacion (
  id_pedido bigint primary key references public.pedido_online(id_pedido),
  mp_payment_id text not null,
  motivo text not null,
  fecha_actualizacion timestamptz not null default now()
);
-- Solo funciones privilegiadas y tareas de mantenimiento acceden a conciliación.
alter table public.pedido_online_venta_reconciliacion enable row level security;
revoke all on public.pedido_online_venta_reconciliacion from public,anon,authenticated;

-- Alta idempotente del medio usado para identificar el cobro en ventas.
select pg_advisory_xact_lock(hashtextextended('hu66-medio-mercado-pago',0));
insert into public.medio_pago(codigo,nombre,descripcion,estado)
select 'MERCADO_PAGO','Mercado Pago','Pago online procesado por Mercado Pago',true
where not exists(select 1 from public.medio_pago where codigo='MERCADO_PAGO');
update public.medio_pago set nombre='Mercado Pago',descripcion='Pago online procesado por Mercado Pago',estado=true
where codigo='MERCADO_PAGO';

create or replace function public.hu66_mp_registrar_venta(p_id_pedido bigint,p_payment_id text)
returns public.venta
language plpgsql security definer set search_path=public as $$
declare
  v_p public.pedido_online%rowtype;
  v_v public.venta%rowtype;
  v_item record;
  v_id_medio integer;
  v_id_lista integer;
  v_deposito integer;
  v_punto_venta integer;
  v_numero integer;
  v_neto_21 numeric(14,2):=0; v_iva_21 numeric(14,2):=0;
  v_neto_105 numeric(14,2):=0; v_iva_105 numeric(14,2):=0;
  v_exento numeric(14,2):=0; v_subtotal numeric(14,2); v_total numeric(14,2):=0;
  v_key uuid;
begin
  select * into v_p from public.pedido_online where id_pedido=p_id_pedido for update;
  if not found or v_p.estado_pago<>'Aprobado' or v_p.mp_payment_id is distinct from p_payment_id then
    raise exception 'El pedido no tiene un pago aprobado coincidente';
  end if;
  select * into v_v from public.venta where id_pedido_online=p_id_pedido;
  if found then return v_v; end if;

  select id_medio_pago into v_id_medio from public.medio_pago
    where codigo='MERCADO_PAGO' and estado is true limit 1;
  if v_id_medio is null then raise exception 'No está configurado el medio de pago Mercado Pago'; end if;
  select min(d.id_deposito) into v_deposito
  from public.detalle_pedido_online x
  join public.articulo_deposito ad using(id_articulo_deposito)
  join public.deposito d using(id_deposito)
  where x.id_pedido=p_id_pedido and d.id_sucursal=v_p.id_sucursal;
  if v_deposito is null then raise exception 'No se encontró el depósito del pedido'; end if;

  -- La venta requiere una lista vigente que contenga los mismos precios del pedido.
  select lp.id_lista into v_id_lista
  from public.lista_precio lp
  where lp.estado is true and lp.fecha_inicio<=current_date
    and (lp.fecha_fin is null or lp.fecha_fin>=current_date)
    and not exists (
      select 1 from public.detalle_pedido_online x
      left join public.detalle_lista_precio dlp on dlp.id_lista=lp.id_lista and dlp.id_articulo=x.id_articulo
      where x.id_pedido=p_id_pedido and round(coalesce(dlp.precio_final,0),2)<>round(x.precio_unitario,2)
    )
    and exists(select 1 from public.detalle_pedido_online x where x.id_pedido=p_id_pedido)
  order by lp.fecha_inicio desc,lp.id_lista desc limit 1;
  if v_id_lista is null then raise exception 'No hay una lista vigente con los precios cobrados; no se puede registrar la venta'; end if;

  for v_item in
    select x.*,a.alicuota_iva
    from public.detalle_pedido_online x join public.articulo a using(id_articulo)
    where x.id_pedido=p_id_pedido order by x.id_articulo_deposito for update of x
  loop
    perform 1 from public.articulo_deposito ad
      where ad.id_articulo_deposito=v_item.id_articulo_deposito for update;
    if not exists(select 1 from public.articulo_deposito ad join public.deposito d using(id_deposito)
      where ad.id_articulo_deposito=v_item.id_articulo_deposito and ad.estado and ad.stock_actual>=v_item.cantidad
        and d.estado and d.id_sucursal=v_p.id_sucursal) then
      raise exception 'Stock insuficiente para el artículo %',v_item.id_articulo;
    end if;
    v_subtotal:=round(v_item.precio_unitario*v_item.cantidad,2);
    v_total:=v_total+v_subtotal;
    if v_item.alicuota_iva=0 then v_exento:=v_exento+v_subtotal;
    elsif v_item.alicuota_iva=10.5 then
      v_neto_105:=v_neto_105+round(v_subtotal/1.105,2);
      v_iva_105:=v_iva_105+(v_subtotal-round(v_subtotal/1.105,2));
    elsif v_item.alicuota_iva=21 then
      v_neto_21:=v_neto_21+round(v_subtotal/1.21,2);
      v_iva_21:=v_iva_21+(v_subtotal-round(v_subtotal/1.21,2));
    else raise exception 'Alícuota de IVA inválida para el artículo %',v_item.id_articulo;
    end if;
  end loop;
  if round(v_total,2)<>round(v_p.importe_estimado,2) then raise exception 'El importe del pedido no coincide con sus productos'; end if;

  select punto_venta into v_punto_venta from public.sucursal where id_sucursal=v_p.id_sucursal and estado is true;
  if v_punto_venta is null then raise exception 'La sucursal no tiene punto de venta activo'; end if;
  perform pg_advisory_xact_lock(1000000+v_punto_venta);
  select coalesce(max(numero_comprobante),0)+1 into v_numero from public.venta where punto_venta=v_punto_venta;
  v_key:=coalesce((select id_intento from public.pedido_online_pago_intento where id_pedido=p_id_pedido limit 1),gen_random_uuid());

  insert into public.venta(id_sucursal,id_deposito,id_cliente,tipo_comprobante,punto_venta,numero_comprobante,
    fecha,medio_pago,neto_21,iva_21,neto_105,iva_105,exento,percepcion_iva,percepcion_iibb,percepciones,
    importe_total,estado,id_lista,idempotency_key,id_pedido_online)
  values(v_p.id_sucursal,v_deposito,null,'B',v_punto_venta,v_numero,coalesce(v_p.fecha_creacion,now()),
    'Mercado Pago',round(v_neto_21,2),round(v_iva_21,2),round(v_neto_105,2),round(v_iva_105,2),round(v_exento,2),
    0,0,0,round(v_total,2),'Confirmada',v_id_lista,v_key,p_id_pedido) returning * into v_v;

  for v_item in select x.*,a.alicuota_iva from public.detalle_pedido_online x join public.articulo a using(id_articulo)
    where x.id_pedido=p_id_pedido loop
    insert into public.detalle_venta(id_venta,id_articulo,cantidad,precio_unitario,subtotal,alicuota_iva)
      values(v_v.id_venta,v_item.id_articulo,v_item.cantidad,v_item.precio_unitario,
        round(v_item.precio_unitario*v_item.cantidad,2),v_item.alicuota_iva);
    update public.articulo_deposito set stock_actual=stock_actual-v_item.cantidad
      where id_articulo_deposito=v_item.id_articulo_deposito and stock_actual>=v_item.cantidad;
    if not found then raise exception 'No fue posible descontar el stock del artículo %',v_item.id_articulo; end if;
    insert into public.movimiento_stock(id_articulo_deposito,id_deposito,tipo_movimiento,cantidad)
      select v_item.id_articulo_deposito,id_deposito,'EGRESO',v_item.cantidad
      from public.articulo_deposito where id_articulo_deposito=v_item.id_articulo_deposito;
  end loop;
  insert into public.pago_venta(id_venta,id_medio_pago,importe,referencia)
    values(v_v.id_venta,v_id_medio,round(v_total,2),p_payment_id);
  update public.pedido_online set stock_descontado=true where id_pedido=p_id_pedido;
  return v_v;
end $$;

-- Concilia pedidos pagados que ya existían al instalar esta integración.
-- Si la lista o el stock actual no permite registrarlos, deja el motivo para revisión.
do $$ declare v_p record; begin
  for v_p in select p.id_pedido,p.mp_payment_id from public.pedido_online p
    left join public.venta v on v.id_pedido_online=p.id_pedido
    where p.estado_pago='Aprobado' and p.mp_payment_id is not null and v.id_venta is null
  loop
    begin
      perform public.hu66_mp_registrar_venta(v_p.id_pedido,v_p.mp_payment_id);
      delete from public.pedido_online_venta_reconciliacion where id_pedido=v_p.id_pedido;
    exception when others then
      insert into public.pedido_online_venta_reconciliacion(id_pedido,mp_payment_id,motivo,fecha_actualizacion)
      values(v_p.id_pedido,v_p.mp_payment_id,sqlerrm,now())
      on conflict(id_pedido) do update set mp_payment_id=excluded.mp_payment_id,motivo=excluded.motivo,fecha_actualizacion=now();
    end;
  end loop;
end $$;

-- La confirmación del pago crea pedido, venta, cobro y egreso de stock en una
-- sola transacción. Reintentos del webhook reparan la venta faltante sin duplicar.
create or replace function public.hu66_mp_confirmar_pago(p_id_intento uuid,p_payment_id text,p_status text,p_transaction_amount numeric,p_currency text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_i public.pedido_online_pago_intento%rowtype; v_p public.pedido_online%rowtype; v_d record; v_stock_ok boolean:=true;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Acceso no autorizado'; end if;
  select * into v_i from public.pedido_online_pago_intento where id_intento=p_id_intento for update;
  if not found then raise exception 'Intento de pago inexistente'; end if;
  if p_payment_id is null or p_status is distinct from 'approved' or p_currency is distinct from 'ARS'
    or p_transaction_amount is null or round(p_transaction_amount,2)<>round(v_i.importe,2) then
    raise exception 'El pago no coincide con el intento';
  end if;
  if v_i.mp_payment_id is not null and v_i.mp_payment_id<>p_payment_id then raise exception 'El intento ya tiene otro pago'; end if;
  if v_i.estado in ('Reembolsado','ReembolsoPendiente','PagoSinPedido') then return jsonb_build_object('status',v_i.estado); end if;
  if v_i.id_pedido is not null then
    select * into v_p from public.pedido_online where id_pedido=v_i.id_pedido;
    perform public.hu66_mp_registrar_venta(v_p.id_pedido,p_payment_id);
    return jsonb_build_object('status','Aprobado','id_pedido',v_p.id_pedido,'referencia',v_p.referencia);
  end if;
  for v_d in select * from public.detalle_pedido_online_pago_intento where id_intento=p_id_intento loop
    perform 1 from public.articulo_deposito where id_articulo_deposito=v_d.id_articulo_deposito for update;
    if not exists(select 1 from public.articulo_deposito ad join public.deposito d using(id_deposito) join public.articulo a using(id_articulo)
      where ad.id_articulo_deposito=v_d.id_articulo_deposito and ad.estado and ad.stock_actual>=v_d.cantidad
        and d.estado and d.id_sucursal=v_i.id_sucursal and a.estado and a.publicado_online) then v_stock_ok:=false; end if;
  end loop;
  if not v_stock_ok then
    update public.pedido_online_pago_intento set estado='ReembolsoPendiente',mp_payment_id=p_payment_id,mp_payment_status='approved',fecha_actualizacion=now() where id_intento=p_id_intento;
    return jsonb_build_object('status','ReembolsoPendiente');
  end if;
  insert into public.pedido_online(id_sucursal,nombre_cliente,apellido_cliente,contacto,importe_estimado,estado_pago,medio_pago_online,mp_payment_id)
    values(v_i.id_sucursal,v_i.nombre_cliente,v_i.apellido_cliente,v_i.contacto,v_i.importe,'Aprobado','Mercado Pago',p_payment_id) returning * into v_p;
  insert into public.detalle_pedido_online(id_pedido,id_articulo,id_articulo_deposito,cantidad,precio_unitario)
    select v_p.id_pedido,id_articulo,id_articulo_deposito,cantidad,precio_unitario from public.detalle_pedido_online_pago_intento where id_intento=p_id_intento;
  update public.pedido_online_pago_intento set estado='Aprobado',mp_payment_id=p_payment_id,mp_payment_status='approved',id_pedido=v_p.id_pedido,fecha_actualizacion=now() where id_intento=p_id_intento;
  perform public.hu66_mp_registrar_venta(v_p.id_pedido,p_payment_id);
  return jsonb_build_object('status','Aprobado','id_pedido',v_p.id_pedido,'referencia',v_p.referencia);
end $$;

-- Entregar un pedido sin pago online descuenta stock en ese momento. Los pedidos
-- pagados ya lo descuentan al aprobarse y no vuelven a descontar al retirarse.
create or replace function public.hu66_actualizar_estado_pedido(p_id_pedido bigint,p_estado text,p_motivo text default null)
returns public.pedido_online language plpgsql security definer set search_path=public as $$
declare v_p public.pedido_online%rowtype; v_d record;
begin
  if not exists(select 1 from public.usuario u where u.auth_id=auth.uid() and u.estado is true and u.rol='administrador') then
    raise exception 'No tenés permiso para gestionar pedidos online';
  end if;
  if p_estado not in ('Preparado','Cancelado','Entregado') then raise exception 'Estado de pedido inválido'; end if;
  if p_estado='Cancelado' and nullif(btrim(p_motivo),'') is null then raise exception 'Indicá el motivo de cancelación'; end if;
  select * into v_p from public.pedido_online where id_pedido=p_id_pedido for update;
  if not found or v_p.estado not in ('Pendiente','Preparado') then raise exception 'El pedido no existe o ya no admite cambios'; end if;
  if p_estado='Entregado' and not v_p.stock_descontado then
    for v_d in select d.*,ad.id_deposito,ad.stock_actual from public.detalle_pedido_online d
      join public.articulo_deposito ad using(id_articulo_deposito) where d.id_pedido=p_id_pedido
      order by d.id_articulo_deposito for update of ad loop
      if v_d.stock_actual<v_d.cantidad then raise exception 'Stock insuficiente para entregar el artículo %',v_d.id_articulo; end if;
    end loop;
    for v_d in select d.*,ad.id_deposito from public.detalle_pedido_online d
      join public.articulo_deposito ad using(id_articulo_deposito) where d.id_pedido=p_id_pedido loop
      update public.articulo_deposito set stock_actual=stock_actual-v_d.cantidad
        where id_articulo_deposito=v_d.id_articulo_deposito;
      insert into public.movimiento_stock(id_articulo_deposito,id_deposito,tipo_movimiento,cantidad)
        values(v_d.id_articulo_deposito,v_d.id_deposito,'EGRESO',v_d.cantidad);
    end loop;
    update public.pedido_online set stock_descontado=true where id_pedido=p_id_pedido;
  end if;
  update public.pedido_online set estado=p_estado,fecha_actualizacion=now(),
    motivo_cancelacion=case when p_estado='Cancelado' then btrim(p_motivo) else null end
    where id_pedido=p_id_pedido returning * into v_p;
  return v_p;
end $$;

-- Reembolso aprobado: devuelve al depósito los productos que se habían descontado.
create or replace function public.hu66_mp_cancelar_reembolsado(p_id_pedido bigint,p_auth_uid uuid,p_motivo text,p_payment_id text)
returns public.pedido_online language plpgsql security definer set search_path=public as $$
declare v_p public.pedido_online%rowtype; v_d record;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Acceso no autorizado'; end if;
  if not exists(select 1 from public.usuario u where u.auth_id=p_auth_uid and u.estado is true and u.rol='administrador') then
    raise exception 'No tenés permiso para cancelar pedidos online';
  end if;
  if nullif(btrim(p_motivo),'') is null then raise exception 'Indicá el motivo de cancelación'; end if;
  select * into v_p from public.pedido_online where id_pedido=p_id_pedido for update;
  if not found or v_p.mp_payment_id is distinct from p_payment_id or v_p.estado_pago<>'Aprobado'
    or v_p.estado not in ('Pendiente','Preparado') then raise exception 'El pago no coincide con un pedido cancelable'; end if;
  if v_p.stock_descontado then
    for v_d in select d.*,ad.id_deposito from public.detalle_pedido_online d
      join public.articulo_deposito ad using(id_articulo_deposito) where d.id_pedido=p_id_pedido
      order by d.id_articulo_deposito for update of ad loop
      update public.articulo_deposito set stock_actual=stock_actual+v_d.cantidad
        where id_articulo_deposito=v_d.id_articulo_deposito;
      insert into public.movimiento_stock(id_articulo_deposito,id_deposito,tipo_movimiento,cantidad)
        values(v_d.id_articulo_deposito,v_d.id_deposito,'INGRESO',v_d.cantidad);
    end loop;
  end if;
  update public.pedido_online set estado='Cancelado',estado_pago='Reembolsado',stock_descontado=false,
    fecha_actualizacion=now(),motivo_cancelacion=btrim(p_motivo)
    where id_pedido=p_id_pedido returning * into v_p;
  return v_p;
end $$;

-- Reporta pagos externos y reembolsos sin simular efectivo en un turno de caja.
create or replace function public.hu66_mp_movimientos_reporte(p_desde date,p_hasta date,p_sucursal bigint,p_anio integer)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare v_mov jsonb; v_mensual jsonb;
begin
  perform public.hu61_admin();
  if p_desde is null or p_hasta is null or p_desde>p_hasta or p_anio not between 1 and 9998 then
    raise exception 'Rango de fechas inválido';
  end if;
  with eventos as (
    select 'online:'||p.id_pedido||':pago' id,p.fecha_creacion fecha_efectiva,p.id_sucursal sucursal_id,
      'Pedido online #'||p.id_pedido||' · Mercado Pago' concepto,'Mercado Pago' origen,'Ingreso' tipo,p.importe_estimado importe
    from public.pedido_online p
    where p.estado_pago in ('Aprobado','Reembolsado')
    union all
    select 'online:'||p.id_pedido||':reembolso',p.fecha_actualizacion,p.id_sucursal,
      'Reembolso pedido online #'||p.id_pedido||' · Mercado Pago','Mercado Pago','Egreso',p.importe_estimado
    from public.pedido_online p
    where p.estado_pago='Reembolsado'
  )
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'fecha_efectiva',fecha_efectiva,
    'sucursal_id',sucursal_id,'concepto',concepto,'origen',origen,'tipo',tipo,'importe',importe::text)
    order by fecha_efectiva desc,id desc),'[]'::jsonb)
  into v_mov from eventos e
  where (p_sucursal is null or e.sucursal_id=p_sucursal)
    and (e.fecha_efectiva at time zone 'America/Argentina/Buenos_Aires')::date between p_desde and p_hasta;
  with eventos as (
    select p.fecha_creacion fecha_efectiva,p.id_sucursal,'Ingreso' tipo,p.importe_estimado importe
    from public.pedido_online p
    where p.estado_pago in ('Aprobado','Reembolsado')
    union all
    select p.fecha_actualizacion,p.id_sucursal,'Egreso',p.importe_estimado
    from public.pedido_online p
    where p.estado_pago='Reembolsado'
  ), mensual as (
    select date_trunc('month',e.fecha_efectiva at time zone 'America/Argentina/Buenos_Aires')::date mes,
      coalesce(sum(e.importe) filter(where e.tipo='Ingreso'),0) ingresos,
      coalesce(sum(e.importe) filter(where e.tipo='Egreso'),0) egresos
    from eventos e
    where extract(year from e.fecha_efectiva at time zone 'America/Argentina/Buenos_Aires')=p_anio
      and (p_sucursal is null or e.id_sucursal=p_sucursal)
    group by 1
  ) select coalesce(jsonb_agg(jsonb_build_object('mes',to_char(mes,'YYYY-MM'),'ingresos',ingresos::text,
    'egresos',egresos::text,'flujo_neto',(ingresos-egresos)::text) order by mes),'[]'::jsonb)
    into v_mensual from mensual;
  return jsonb_build_object('movimientos',v_mov,'mensual',v_mensual);
end $$;

revoke all on function public.hu66_mp_registrar_venta(bigint,text) from public,anon,authenticated;
grant execute on function public.hu66_mp_registrar_venta(bigint,text) to service_role;
revoke all on function public.hu66_mp_movimientos_reporte(date,date,bigint,integer) from public,anon;
grant execute on function public.hu66_mp_movimientos_reporte(date,date,bigint,integer) to authenticated;
revoke all on function public.hu66_actualizar_estado_pedido(bigint,text,text) from public,anon;
grant execute on function public.hu66_actualizar_estado_pedido(bigint,text,text) to authenticated;
revoke all on function public.hu66_mp_cancelar_reembolsado(bigint,uuid,text,text) from public,anon,authenticated;
grant execute on function public.hu66_mp_cancelar_reembolsado(bigint,uuid,text,text) to service_role;

comment on column public.venta.id_pedido_online is 'Pedido online que originó esta venta; permite conciliar pagos de Mercado Pago sin movimiento de caja.';
comment on column public.pedido_online.stock_descontado is 'Indica si el stock del depósito vinculado ya fue descontado por pago o entrega.';
notify pgrst, 'reload schema';
commit;
