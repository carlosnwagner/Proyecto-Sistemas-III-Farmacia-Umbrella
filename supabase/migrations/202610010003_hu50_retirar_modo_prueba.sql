-- Retira el acceso temporal sin login de HU50 y restaura la autorización de HU56.
begin;

do $$
begin
  if exists (select 1 from public.movimiento_caja where auth_id is null) then
    raise exception 'Existen movimientos de prueba sin auth_id. Eliminarlos o asociarlos a una cuenta antes de retirar el modo de prueba';
  end if;
end;
$$;

alter table public.movimiento_caja alter column auth_id set not null;

create or replace function public.hu50_contexto_caja()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_usuario integer; v_resultado jsonb;
begin
  select a.usuario_id into v_usuario from public.usuario_auth_caja a
  join public.usuario u on u.id_usuario = a.usuario_id and u.estado is true
  where a.auth_id = auth.uid() and a.activo and a.puede_movimientos;
  if not found then raise exception 'Iniciá sesión con un usuario activo autorizado para movimientos de caja'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'caja_id', t.caja_id, 'caja', c.nombre,
    'sucursal_id', t.sucursal_id, 'cajero_id', t.cajero_id,
    'saldo_inicial', t.saldo_inicial, 'fecha_hora_apertura', t.fecha_hora_apertura,
    'efectivo_esperado', t.saldo_inicial + coalesce((
      select sum(case when m.tipo = 'Ingreso' then m.importe else -m.importe end)
      from public.movimiento_caja m where m.turno_id = t.id and m.medio = 'Efectivo'
    ),0)
  ) order by t.fecha_hora_apertura desc), '[]'::jsonb) into v_resultado
  from public.turno_caja t join public.caja c on c.id = t.caja_id
  join public.usuario_sucursal_caja s on s.sucursal_id = t.sucursal_id and s.usuario_id = v_usuario
  where t.estado = 'Abierto' and c.activa and c.sucursal_id = t.sucursal_id
    and t.cajero_id = v_usuario;
  return jsonb_build_object('usuario_id',v_usuario,'turnos',v_resultado);
end; $$;

create or replace function public.hu50_consultar_movimientos(p_turno_id bigint)
returns setof public.movimiento_caja language plpgsql security definer set search_path = public as $$
declare v_sucursal bigint; v_cajero bigint; v_usuario integer;
begin
  select sucursal_id, cajero_id into v_sucursal, v_cajero from public.turno_caja where id = p_turno_id;
  if not found then raise exception 'El turno no existe'; end if;
  v_usuario := public.hu50_usuario_autorizado(v_sucursal);
  if v_cajero <> v_usuario then raise exception 'Solo podés operar tu propio turno de caja'; end if;
  return query select * from public.movimiento_caja where turno_id = p_turno_id order by fecha_hora desc, id desc;
end; $$;

create or replace function public.hu50_registrar_movimiento(
  p_turno_id bigint, p_tipo text, p_concepto text, p_importe numeric,
  p_medio_pago_id integer, p_idempotency_key uuid,
  p_movimiento_original_id bigint default null
)
returns public.movimiento_caja language plpgsql security definer set search_path = public as $$
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

revoke all on function public.hu50_contexto_caja() from anon;
revoke all on function public.hu50_consultar_movimientos(bigint) from anon;
revoke all on function public.hu50_registrar_movimiento(bigint,text,text,numeric,integer,uuid,bigint) from anon;
grant execute on function public.hu50_contexto_caja() to authenticated;
grant execute on function public.hu50_consultar_movimientos(bigint) to authenticated;
grant execute on function public.hu50_registrar_movimiento(bigint,text,text,numeric,integer,uuid,bigint) to authenticated;
commit;
