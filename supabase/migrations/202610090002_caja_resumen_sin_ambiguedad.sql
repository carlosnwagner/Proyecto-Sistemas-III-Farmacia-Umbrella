begin;

create or replace function public.caja_resumen_turno(p_turno bigint)
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

revoke all on function public.caja_resumen_turno(bigint) from public, anon;
grant execute on function public.caja_resumen_turno(bigint) to authenticated;
notify pgrst, 'reload schema';
commit;
