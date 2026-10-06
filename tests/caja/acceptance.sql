create function test_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; end;$$;
create function test_reject(statement text,expected text) returns void language plpgsql as $$
declare caught boolean:=false;
begin
  begin execute statement;
  exception when others then
    if position(expected in sqlerrm)=0 then raise exception 'Unexpected error: %, expected %',sqlerrm,expected; end if;
    caught:=true;
  end;
  if not caught then raise exception 'Expected error: %',expected; end if;
end;$$;
grant usage on schema public,auth to anon,authenticated;
grant execute on function auth.uid() to authenticated;
insert into usuario_auth_caja(auth_id,usuario_id,puede_movimientos,activo,puede_apertura,puede_arqueo,puede_cierre,puede_consultar)
values('00000000-0000-0000-0000-000000000001',1,true,true,true,true,true,true),('00000000-0000-0000-0000-000000000002',2,false,true,false,false,false,true);
insert into usuario_sucursal_caja values(1,1),(2,2);
create trigger trg_movimiento_caja_turno_abierto before insert or update on movimiento_caja for each row execute function validar_turno_caja_abierto();
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
set role anon;
select test_reject('select caja_listar_turnos()','permission denied');
select test_reject('insert into arqueo_caja default values','permission denied');
reset role;
set role authenticated;
select test_assert(jsonb_array_length(caja_listar_turnos())=4,'only authorized branch turns');
select test_reject('select caja_resumen(5)','permiso');
select test_reject($q$select caja_cerrar_turno(1,999,0,'',gen_random_uuid())$q$,'arqueo');
select test_reject($q$select caja_registrar_arqueo(1,-1,0,gen_random_uuid())$q$,'contado');
select test_reject($q$select caja_registrar_arqueo(1,'NaN'::numeric,0,gen_random_uuid())$q$,'contado');
select caja_registrar_arqueo(1,1000,0,'10000000-0000-0000-0000-000000000001');
select caja_registrar_arqueo(1,1000,0,'10000000-0000-0000-0000-000000000001');
select test_assert(jsonb_array_length(caja_resumen(1)->'arqueos')=1,'duplicate count retry');
select test_assert((caja_resumen(1)->'arqueos'->0->>'diferencia')::numeric=0,'zero difference');
select hu50_registrar_movimiento(1,'Ingreso','Fondo',200,1,'20000000-0000-0000-0000-000000000001');
select test_assert((caja_resumen(1)->'totales'->>'efectivo_esperado')::numeric=1200,'actual cash');
select test_assert((caja_resumen(1)->'arqueos'->0->>'vigente')::boolean=false,'new movement invalidates count');
select test_reject($q$select caja_cerrar_turno(1,1,0,'',gen_random_uuid())$q$,'movimientos');
select test_reject($q$select caja_registrar_arqueo(1,1200,0,gen_random_uuid())$q$,'movimientos');
select hu50_registrar_movimiento(1,'Ingreso','Tarjeta',300,2,gen_random_uuid());
select hu50_registrar_movimiento(1,'Egreso','Transferencia',50,3,gen_random_uuid());
select test_assert((caja_resumen(1)->'totales'->>'efectivo_esperado')::numeric=1200,'noncash separate');
select test_assert((caja_resumen(1)->'totales'->>'tarjeta_neto')::numeric=300,'card net');
select test_assert((caja_resumen(1)->'totales'->>'transferencia_neto')::numeric=-50,'transfer net');
select caja_registrar_arqueo(1,1190,3,'10000000-0000-0000-0000-000000000002');
select test_reject($q$select caja_cerrar_turno(1,2,3,'',gen_random_uuid())$q$,'motivo');
select caja_cerrar_turno(1,2,3,'Diferencia de cambio','30000000-0000-0000-0000-000000000001');
select caja_cerrar_turno(1,2,3,'Diferencia de cambio','30000000-0000-0000-0000-000000000001');
select test_assert(caja_resumen(1)->'turno'->>'estado'='Cerrado','closed state');
select test_assert((caja_resumen(1)->'turno'->'resumen_cierre'->>'diferencia')::numeric=-10,'stored shortage');
select test_reject($q$select caja_cerrar_turno(1,2,3,'Otro motivo','30000000-0000-0000-0000-000000000001')$q$,'otra operación');
select test_reject($q$select caja_registrar_arqueo(1,1200,3,gen_random_uuid())$q$,'cerrado');
select test_reject($q$select hu50_registrar_movimiento(1,'Ingreso','Después del cierre',1,1,gen_random_uuid())$q$,'cerrado');
select test_assert((abrir_turno_caja(1,1,1,0)->>'estado')='Abierto','box available after close');
select test_reject('update turno_caja set estado=''Cerrado''','permission denied');
reset role;
-- Preparar turnos para pruebas concurrentes, sin datos de la base compartida.
select caja_registrar_arqueo(2,1000,0,'10000000-0000-0000-0000-000000000003');
select caja_registrar_arqueo(3,1000,0,'10000000-0000-0000-0000-000000000004');
select caja_registrar_arqueo(4,1000,0,'10000000-0000-0000-0000-000000000005');
