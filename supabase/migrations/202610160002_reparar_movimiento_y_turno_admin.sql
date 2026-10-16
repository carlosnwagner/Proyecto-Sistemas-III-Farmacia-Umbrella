-- Repara la función base HU50 usada por HU61 y evita múltiples turnos abiertos
-- para un mismo usuario. No modifica ni cierra turnos ya existentes.
begin;

create or replace function public.caja_usuario(p_sucursal bigint, p_accion text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_id integer;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para operar la caja'; end if;
  select u.id_usuario into v_id from public.usuario u
  where u.auth_id=auth.uid() and u.estado is true and lower(u.rol)='administrador'
    and exists(select 1 from public.sucursal s where s.id_sucursal=p_sucursal and s.estado is true);
  if found then
    if p_accion not in ('apertura','arqueo','cierre','consulta') then raise exception 'Acción de caja no permitida'; end if;
    return v_id;
  end if;
  select a.usuario_id into v_id from public.usuario_auth_caja a
  join public.usuario u on u.id_usuario=a.usuario_id and u.estado is true
  join public.usuario_sucursal_caja s on s.usuario_id=a.usuario_id
  where a.auth_id=auth.uid() and a.activo and s.sucursal_id=p_sucursal
    and case p_accion
      when 'apertura' then a.puede_apertura
      when 'arqueo' then a.puede_arqueo
      when 'cierre' then a.puede_cierre
      when 'consulta' then a.puede_consultar or a.puede_movimientos or a.puede_arqueo or a.puede_cierre or a.puede_apertura
      else false end;
  if not found then raise exception 'No tenés permiso de % en esta sucursal',p_accion; end if;
  return v_id;
end; $$;

create or replace function public.hu50_usuario_autorizado(p_sucursal_id bigint)
returns integer language plpgsql security definer set search_path = public as $$
declare v_usuario integer;
begin
  if auth.uid() is null then raise exception 'Debés iniciar sesión para operar la caja'; end if;
  select u.id_usuario into v_usuario from public.usuario u
  where u.auth_id=auth.uid() and u.estado is true and lower(u.rol)='administrador'
    and exists(select 1 from public.sucursal s where s.id_sucursal=p_sucursal_id and s.estado is true);
  if found then return v_usuario; end if;
  select a.usuario_id into v_usuario from public.usuario_auth_caja a
  join public.usuario u on u.id_usuario=a.usuario_id and u.estado is true
  join public.usuario_sucursal_caja s on s.usuario_id=a.usuario_id
  where a.auth_id=auth.uid() and a.activo and a.puede_movimientos and s.sucursal_id=p_sucursal_id;
  if found then return v_usuario; end if;
  select u.id_usuario into v_usuario from public.usuario u
  where u.auth_id=auth.uid() and u.estado is true and lower(u.rol)='administrador'
    and exists(select 1 from public.sucursal s where s.id_sucursal=p_sucursal_id and s.estado is true);
  if not found then raise exception 'No tenés permiso para operar movimientos en esta sucursal'; end if;
  return v_usuario;
end; $$;

create or replace function public.hu50_contexto_caja()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_usuario integer; v_admin boolean := false; v_resultado jsonb;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para consultar movimientos'; end if;
  select u.id_usuario into v_usuario from public.usuario u
  where u.auth_id=auth.uid() and u.estado is true and lower(u.rol)='administrador';
  v_admin := found;
  if not v_admin then
    select a.usuario_id into v_usuario from public.usuario_auth_caja a
    join public.usuario u on u.id_usuario=a.usuario_id and u.estado is true
    where a.auth_id=auth.uid() and a.activo and a.puede_movimientos;
  end if;
  if v_usuario is null then raise exception 'Iniciá sesión con un usuario activo autorizado para movimientos de caja'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',t.id,'caja_id',t.caja_id,'caja',c.nombre,'sucursal_id',t.sucursal_id,
    'cajero_id',t.cajero_id,'saldo_inicial',t.saldo_inicial,'fecha_hora_apertura',t.fecha_hora_apertura,
    'efectivo_esperado',t.saldo_inicial+coalesce((select sum(case when m.tipo='Ingreso' then m.importe else -m.importe end)
      from public.movimiento_caja m where m.turno_id=t.id and m.medio='Efectivo'),0)
  ) order by t.fecha_hora_apertura desc),'[]'::jsonb) into v_resultado
  from public.turno_caja t join public.caja c on c.id=t.caja_id
  where t.estado='Abierto' and c.activa and c.sucursal_id=t.sucursal_id and t.cajero_id=v_usuario
    and (v_admin or exists(select 1 from public.usuario_sucursal_caja s
      where s.sucursal_id=t.sucursal_id and s.usuario_id=v_usuario));
  return jsonb_build_object('usuario_id',v_usuario,'turnos',v_resultado);
end; $$;

-- RPC nuevo para no cambiar el tipo de retorno de caja_listar_turnos(), que
-- puede variar entre instalaciones existentes.
create or replace function public.hu61_listar_turnos_caja()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_resultado jsonb; v_admin boolean;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para consultar turnos'; end if;
  select exists(select 1 from public.usuario u where u.auth_id=auth.uid()
    and u.estado is true and lower(u.rol)='administrador') into v_admin;
  select coalesce(jsonb_agg((to_jsonb(t)-'clave_cierre') || jsonb_build_object('caja_nombre',c.nombre)
    order by t.fecha_hora_apertura desc,t.id desc),'[]'::jsonb) into v_resultado
  from public.turno_caja t join public.caja c on c.id=t.caja_id
  where v_admin or exists(select 1 from public.usuario_auth_caja a
    join public.usuario u on u.id_usuario=a.usuario_id and u.estado is true
    join public.usuario_sucursal_caja s on s.usuario_id=a.usuario_id
    where a.auth_id=auth.uid() and a.activo and s.sucursal_id=t.sucursal_id
      and (a.puede_consultar or a.puede_movimientos or a.puede_arqueo or a.puede_cierre or a.puede_apertura));
  return v_resultado;
end; $$;

create or replace function public.hu50_registrar_movimiento(
  p_turno_id bigint, p_tipo text, p_concepto text, p_importe numeric,
  p_medio_pago_id integer, p_idempotency_key uuid,
  p_movimiento_original_id bigint default null
)
returns public.movimiento_caja
language plpgsql security definer set search_path = public as $$
declare
  v_turno public.turno_caja%rowtype;
  v_original public.movimiento_caja%rowtype;
  v_existente public.movimiento_caja%rowtype;
  v_usuario integer; v_nombre text; v_medio text; v_saldo numeric;
begin
  select * into v_turno from public.turno_caja where id = p_turno_id for update;
  if not found then raise exception 'El turno no existe'; end if;
  v_usuario := public.hu50_usuario_autorizado(v_turno.sucursal_id);
  if v_turno.cajero_id <> v_usuario then raise exception 'Solo podés operar tu propio turno de caja'; end if;
  if p_idempotency_key is null then raise exception 'Falta la clave de confirmación'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  select * into v_existente from public.movimiento_caja where idempotency_key = p_idempotency_key;
  if found then
    if v_existente.auth_id <> auth.uid() or v_existente.turno_id <> p_turno_id
      or v_existente.concepto is distinct from trim(p_concepto)
      or v_existente.movimiento_original_id is distinct from p_movimiento_original_id
      or (p_movimiento_original_id is null and (
        v_existente.tipo is distinct from p_tipo or v_existente.importe is distinct from p_importe
        or v_existente.medio_pago_id is distinct from p_medio_pago_id)) then
      raise exception 'La confirmación ya fue utilizada para otra operación';
    end if;
    return v_existente;
  end if;
  if v_turno.estado <> 'Abierto' then raise exception 'El turno está cerrado'; end if;
  if not exists (select 1 from public.caja where id = v_turno.caja_id and activa
    and sucursal_id = v_turno.sucursal_id) then raise exception 'La caja no está activa o no corresponde a la sucursal'; end if;
  if p_concepto is null or length(trim(p_concepto)) = 0 then raise exception 'El concepto o motivo es obligatorio'; end if;
  if p_movimiento_original_id is not null then
    select * into v_original from public.movimiento_caja
    where id = p_movimiento_original_id and turno_id = p_turno_id for update;
    if not found or v_original.origen <> 'Manual' then raise exception 'Solo se pueden revertir movimientos manuales del mismo turno'; end if;
    if exists (select 1 from public.movimiento_caja where movimiento_original_id = v_original.id) then
      raise exception 'El movimiento ya fue revertido';
    end if;
    p_tipo := case when v_original.tipo = 'Ingreso' then 'Egreso' else 'Ingreso' end;
    p_importe := v_original.importe;
    p_medio_pago_id := v_original.medio_pago_id;
    v_medio := v_original.medio;
  else
    if p_tipo is null or p_tipo not in ('Ingreso','Egreso') then raise exception 'Seleccioná ingreso o egreso'; end if;
    if p_importe is null or p_importe::text in ('NaN','Infinity','-Infinity')
      or p_importe <= 0 or p_importe <> round(p_importe,2) or p_importe >= 1000000000000 then
      raise exception 'El importe debe ser positivo y tener como máximo dos decimales';
    end if;
    select lower(trim(nombre)) into v_nombre from public.medio_pago
    where id_medio_pago = p_medio_pago_id and estado is true;
    if not found then raise exception 'El medio de pago no está activo'; end if;
    v_medio := case when v_nombre like '%efectivo%' then 'Efectivo'
      when v_nombre like '%tarjeta%' then 'Tarjeta'
      when v_nombre like '%transferencia%' then 'Transferencia' end;
    if v_medio is null then raise exception 'El medio de pago debe ser efectivo, tarjeta o transferencia'; end if;
  end if;
  select v_turno.saldo_inicial + coalesce(sum(case when tipo = 'Ingreso' then importe else -importe end),0)
    into v_saldo from public.movimiento_caja where turno_id = p_turno_id and medio = 'Efectivo';
  if v_medio = 'Efectivo' and p_tipo = 'Egreso' and p_importe > v_saldo then
    raise exception 'El egreso supera el efectivo disponible (%)', v_saldo;
  end if;
  insert into public.movimiento_caja (
    turno_id,caja_id,usuario_id,auth_id,tipo,concepto,importe,medio_pago_id,medio,
    origen,movimiento_original_id,idempotency_key
  ) values (
    p_turno_id,v_turno.caja_id,v_usuario,auth.uid(),p_tipo,trim(p_concepto),p_importe,p_medio_pago_id,v_medio,
    case when p_movimiento_original_id is null then 'Manual' else 'Reversion' end,
    p_movimiento_original_id,p_idempotency_key
  ) returning * into v_existente;
  return v_existente;
end; $$;

create or replace function public.abrir_turno_caja(
  p_caja_id integer,p_sucursal_id integer,p_cajero_id integer,p_saldo_inicial numeric
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.caja%rowtype; v_usuario integer; t public.turno_caja%rowtype;
begin
  select * into c from public.caja where id=p_caja_id for update;
  if not found or not c.activa or c.sucursal_id is distinct from p_sucursal_id then
    raise exception 'Caja no disponible en esta sucursal';
  end if;
  v_usuario := public.caja_usuario(c.sucursal_id,'apertura');
  if v_usuario is distinct from p_cajero_id then raise exception 'La apertura debe pertenecer al usuario autenticado'; end if;
  perform pg_advisory_xact_lock(hashtextextended('turno-caja-usuario:' || v_usuario::text,0));
  if exists(select 1 from public.turno_caja where cajero_id=v_usuario and estado='Abierto') then
    raise exception 'Ya tenés un turno abierto. Cerralo antes de abrir otra caja';
  end if;
  if p_saldo_inicial is null or p_saldo_inicial::text in ('NaN','Infinity','-Infinity') or p_saldo_inicial < 0
    or p_saldo_inicial <> round(p_saldo_inicial,2) or p_saldo_inicial >= 1000000000000 then
    raise exception 'Importe inicial inválido';
  end if;
  if exists(select 1 from public.turno_caja where caja_id=c.id and estado='Abierto') then
    raise exception 'La caja ya está abierta';
  end if;
  insert into public.turno_caja(caja_id,sucursal_id,cajero_id,saldo_inicial,estado,fecha_hora_apertura)
    values(c.id,c.sucursal_id,v_usuario,p_saldo_inicial,'Abierto',clock_timestamp()) returning * into t;
  return to_jsonb(t) || jsonb_build_object('caja_nombre',c.nombre);
exception when unique_violation then raise exception 'La caja ya está abierta';
end; $$;

create or replace function public.confirmar_venta_caja(
  p_id_borrador bigint,p_idempotency_key uuid,p_id_sucursal integer,
  p_id_deposito integer,p_id_cliente integer,p_tipo_comprobante text,
  p_id_lista integer,p_items jsonb,p_id_medio_pago integer,
  p_importe_pagado numeric,p_referencia_pago text default null,
  p_percepcion_iva numeric default 0,p_percepcion_iibb numeric default 0
) returns setof public.venta
language plpgsql security definer set search_path=public as $$
declare v_usuario integer; t public.turno_caja%rowtype; v_venta public.venta%rowtype;
  v_medio text; v_nombre text; v_codigo text; v_item jsonb; v_cantidad numeric;
begin
  if auth.uid() is null then raise exception 'Iniciá sesión para confirmar la venta'; end if;
  select u.id_usuario into v_usuario from public.usuario u
  where u.auth_id=auth.uid() and u.estado is true and lower(u.rol)='administrador'
    and exists(select 1 from public.sucursal s where s.id_sucursal=p_id_sucursal and s.estado is true);
  if not found then
  select a.usuario_id into v_usuario from public.usuario_auth_caja a
  join public.usuario u on u.id_usuario=a.usuario_id and u.estado is true
  join public.usuario_sucursal_caja s on s.usuario_id=a.usuario_id
  where a.auth_id=auth.uid() and a.activo and a.puede_movimientos and s.sucursal_id=p_id_sucursal;
    if not found then raise exception 'Usuario sin permiso de cobro en esta sucursal'; end if;
  end if;
  if p_idempotency_key is null then raise exception 'Falta la clave de confirmación'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text,0));
  select * into v_venta from public.venta where idempotency_key=p_idempotency_key;
  if found then
    if v_venta.id_sucursal is distinct from p_id_sucursal or v_venta.id_deposito is distinct from p_id_deposito
      or v_venta.id_cliente is distinct from p_id_cliente
      or not exists(select 1 from public.movimiento_caja m where m.idempotency_key=p_idempotency_key
        and m.auth_id=auth.uid() and m.origen='Venta' and m.referencia_venta=v_venta.id_venta::text) then
      raise exception 'La clave corresponde a otra operación';
    end if;
    return next v_venta; return;
  end if;
  select * into t from public.turno_caja where cajero_id=v_usuario and sucursal_id=p_id_sucursal and estado='Abierto'
    order by fecha_hora_apertura desc,id desc limit 1 for update;
  if not found then raise exception 'Necesitás un turno abierto en esta sucursal'; end if;
  if not exists(select 1 from public.caja c where c.id=t.caja_id and c.activa and c.sucursal_id=p_id_sucursal)
    then raise exception 'La caja no está habilitada'; end if;
  perform 1 from public.venta_borrador where id_borrador=p_id_borrador and estado='Borrador'
    and id_sucursal=p_id_sucursal and id_deposito=p_id_deposito and idempotency_key=p_idempotency_key for update;
  if not found then raise exception 'El borrador no existe, cambió o ya fue confirmado'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0
    then raise exception 'La venta debe tener productos'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_cantidad := (v_item->>'cantidad')::numeric;
    if v_cantidad is null or v_cantidad::text in ('NaN','Infinity','-Infinity') or v_cantidad<=0 or v_cantidad<>trunc(v_cantidad)
      then raise exception 'La cantidad debe ser un entero positivo'; end if;
  end loop;
  if p_importe_pagado is null or p_importe_pagado::text in ('NaN','Infinity','-Infinity')
    or p_importe_pagado<0 or p_importe_pagado<>round(p_importe_pagado,2) then raise exception 'Monto recibido inválido'; end if;
  select nombre,codigo into v_nombre,v_codigo from public.medio_pago where id_medio_pago=p_id_medio_pago and estado is true;
  if not found then raise exception 'Medio de pago no disponible'; end if;
  v_medio := case when v_codigo ilike '%EFECTIVO%' or v_nombre ilike '%efectivo%' then 'Efectivo'
    when v_codigo ilike '%TARJETA%' or v_nombre ilike '%tarjeta%' then 'Tarjeta'
    when v_codigo ilike '%TRANSFERENCIA%' or v_nombre ilike '%transferencia%' then 'Transferencia' else null end;
  if v_medio is null then raise exception 'Medio de pago no admitido en caja'; end if;
  select * into v_venta from public.confirmar_venta_transaccional(p_idempotency_key,p_id_sucursal,p_id_deposito,
    p_id_cliente,p_tipo_comprobante,p_id_lista,p_items,p_id_medio_pago,p_importe_pagado,p_referencia_pago,
    p_percepcion_iva,p_percepcion_iibb);
  if v_venta.id_venta is null then raise exception 'No se pudo confirmar la venta'; end if;
  if v_medio<>'Efectivo' and p_importe_pagado<>v_venta.importe_total
    then raise exception 'El pago no efectivo debe coincidir con el total'; end if;
  insert into public.movimiento_caja(turno_id,caja_id,usuario_id,auth_id,tipo,concepto,importe,medio_pago_id,medio,origen,idempotency_key,referencia_venta)
    values(t.id,t.caja_id,v_usuario,auth.uid(),'Ingreso','Cobro de venta #'||v_venta.id_venta,
      v_venta.importe_total,p_id_medio_pago,v_medio,'Venta',p_idempotency_key,v_venta.id_venta::text);
  delete from public.venta_borrador where id_borrador=p_id_borrador;
  return next v_venta;
end; $$;

revoke all on function public.caja_usuario(bigint,text),public.hu50_usuario_autorizado(bigint) from public,anon,authenticated;
revoke all on function public.hu50_contexto_caja() from public,anon;
revoke all on function public.hu61_listar_turnos_caja() from public,anon;
revoke all on function public.confirmar_venta_caja(bigint,uuid,integer,integer,integer,text,integer,jsonb,integer,numeric,text,numeric,numeric) from public,anon;
grant execute on function public.hu50_contexto_caja() to authenticated;
grant execute on function public.hu61_listar_turnos_caja() to authenticated;
grant execute on function public.confirmar_venta_caja(bigint,uuid,integer,integer,integer,text,integer,jsonb,integer,numeric,text,numeric,numeric) to authenticated;
revoke all on function public.hu50_registrar_movimiento(bigint,text,text,numeric,integer,uuid,bigint) from public,anon;
grant execute on function public.hu50_registrar_movimiento(bigint,text,text,numeric,integer,uuid,bigint) to authenticated;
revoke all on function public.abrir_turno_caja(integer,integer,integer,numeric) from public,anon;
grant execute on function public.abrir_turno_caja(integer,integer,integer,numeric) to authenticated;

notify pgrst, 'reload schema';
commit;
