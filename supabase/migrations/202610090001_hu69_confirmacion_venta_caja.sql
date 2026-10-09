-- Ejecutar después de la migración HU51-HU52-HU53. No ejecuta ventas.
begin;

create or replace function public.confirmar_venta_caja(
  p_id_borrador bigint, p_idempotency_key uuid, p_id_sucursal integer,
  p_id_deposito integer, p_id_cliente integer, p_tipo_comprobante text,
  p_id_lista integer, p_items jsonb, p_id_medio_pago integer,
  p_importe_pagado numeric, p_referencia_pago text default null,
  p_percepcion_iva numeric default 0, p_percepcion_iibb numeric default 0
) returns setof public.venta
language plpgsql security definer set search_path = public as $$
declare
  v_usuario integer;
  t public.turno_caja%rowtype;
  v_venta public.venta%rowtype;
  v_medio text;
  v_nombre text;
  v_codigo text;
  v_item jsonb;
  v_cantidad numeric;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para confirmar la venta'; end if;
  select a.usuario_id into v_usuario
  from public.usuario_auth_caja a
  join public.usuario u on u.id_usuario=a.usuario_id and u.estado is true
  join public.usuario_sucursal_caja s on s.usuario_id=a.usuario_id
  where a.auth_id=auth.uid() and a.activo and a.puede_movimientos
    and s.sucursal_id=p_id_sucursal;
  if not found then raise exception 'Usuario sin permiso de cobro en esta sucursal'; end if;
  if p_idempotency_key is null then raise exception 'Falta la clave de confirmación'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));

  select * into v_venta from public.venta where idempotency_key=p_idempotency_key;
  if found then
    if v_venta.id_sucursal is distinct from p_id_sucursal
      or v_venta.id_deposito is distinct from p_id_deposito
      or v_venta.id_cliente is distinct from p_id_cliente
      or not exists(select 1 from public.movimiento_caja m
        where m.idempotency_key=p_idempotency_key and m.auth_id=auth.uid()
          and m.origen='Venta' and m.referencia_venta=v_venta.id_venta::text) then
      raise exception 'La clave corresponde a otra operación';
    end if;
    return next v_venta; return;
  end if;

  -- Solo el turno del cajero autenticado y la sucursal de esta venta.
  select * into t from public.turno_caja
  where cajero_id=v_usuario and sucursal_id=p_id_sucursal and estado='Abierto'
  order by fecha_hora_apertura desc,id desc limit 1 for update;
  if not found then raise exception 'Necesitás un turno abierto en esta sucursal'; end if;
  if not exists(select 1 from public.caja c where c.id=t.caja_id and c.activa
    and c.sucursal_id=p_id_sucursal) then raise exception 'La caja no está habilitada'; end if;

  perform 1 from public.venta_borrador where id_borrador=p_id_borrador
    and estado='Borrador' and id_sucursal=p_id_sucursal and id_deposito=p_id_deposito
    and idempotency_key=p_idempotency_key for update;
  if not found then raise exception 'El borrador no existe, cambió o ya fue confirmado'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
    raise exception 'La venta debe tener productos'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_cantidad := (v_item->>'cantidad')::numeric;
    if v_cantidad is null or v_cantidad::text in ('NaN','Infinity','-Infinity')
      or v_cantidad<=0 or v_cantidad<>trunc(v_cantidad) then
      raise exception 'La cantidad debe ser un entero positivo'; end if;
  end loop;
  if p_importe_pagado is null or p_importe_pagado::text in ('NaN','Infinity','-Infinity')
    or p_importe_pagado<0 or p_importe_pagado<>round(p_importe_pagado,2) then
    raise exception 'Monto recibido inválido'; end if;

  select nombre,codigo into v_nombre,v_codigo from public.medio_pago
    where id_medio_pago=p_id_medio_pago and estado is true;
  if not found then raise exception 'Medio de pago no disponible'; end if;
  v_medio := case
    when v_codigo ilike '%EFECTIVO%' or v_nombre ilike '%efectivo%' then 'Efectivo'
    when v_codigo ilike '%TARJETA%' or v_nombre ilike '%tarjeta%' then 'Tarjeta'
    when v_codigo ilike '%TRANSFERENCIA%' or v_nombre ilike '%transferencia%' then 'Transferencia'
    else null end;
  if v_medio is null then raise exception 'Medio de pago no admitido en caja'; end if;

  -- Reutiliza cálculo fiscal, precios, detalle, pago y control de stock existentes.
  select * into v_venta from public.confirmar_venta_transaccional(
    p_idempotency_key,p_id_sucursal,p_id_deposito,p_id_cliente,p_tipo_comprobante,
    p_id_lista,p_items,p_id_medio_pago,p_importe_pagado,p_referencia_pago,
    p_percepcion_iva,p_percepcion_iibb);
  if v_venta.id_venta is null then raise exception 'No se pudo confirmar la venta'; end if;
  if v_medio<>'Efectivo' and p_importe_pagado<>v_venta.importe_total then
    raise exception 'El pago no efectivo debe coincidir con el total'; end if;
  insert into public.movimiento_caja(turno_id,caja_id,usuario_id,auth_id,tipo,
    concepto,importe,medio_pago_id,medio,origen,idempotency_key,referencia_venta)
  values(t.id,t.caja_id,v_usuario,auth.uid(),'Ingreso',
    'Cobro de venta #'||v_venta.id_venta,v_venta.importe_total,
    p_id_medio_pago,v_medio,'Venta',p_idempotency_key,v_venta.id_venta::text);
  delete from public.venta_borrador where id_borrador=p_id_borrador;
  return next v_venta;
end; $$;

-- Evita acceso por las versiones anteriores (incluida la agregada en SQL Editor).
do $$ declare f record; begin
  for f in select p.oid::regprocedure as firma from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in
      ('confirmar_venta_desde_borrador','confirmar_venta_transaccional')
  loop execute format('revoke execute on function %s from public,anon,authenticated',f.firma); end loop;
end; $$;
revoke all on function public.confirmar_venta_caja(bigint,uuid,integer,integer,integer,text,integer,jsonb,integer,numeric,text,numeric,numeric) from public,anon;
grant execute on function public.confirmar_venta_caja(bigint,uuid,integer,integer,integer,text,integer,jsonb,integer,numeric,text,numeric,numeric) to authenticated;
commit;
