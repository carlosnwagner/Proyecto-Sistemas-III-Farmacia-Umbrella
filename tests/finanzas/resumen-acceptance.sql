set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
set role authenticated;
set timezone='UTC';
select test_assert(jsonb_array_length(finanzas_contexto()->'sucursales')=2,'administrador consulta incluso sucursales inactivas');
select test_assert((finanzas_contexto()->>'desde')::date=date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')::date,'mes actual de negocio');
select test_reject($q$select finanzas_resumen('2026-10-31','2026-10-01')$q$,'rango');
select test_reject($q$select finanzas_resumen(null,'2026-10-01')$q$,'rango');
select test_reject($q$select finanzas_resumen('2026-02-30','2026-10-01')$q$,'out of range');
select test_reject($q$select finanzas_resumen('2026-10-01','2026-10-31',999)$q$,'sucursal');
select test_assert((finanzas_resumen('2026-10-01','2026-10-31',1)->>'completo')::boolean=false,'bloquea resumen incompleto');
select test_assert(finanzas_resumen('2026-10-01','2026-10-31',1)->'totales'='null'::jsonb,'no muestra totales parciales');
select test_assert(jsonb_array_length(finanzas_resumen('2026-10-01','2026-10-31',1)->'incidencias')=5,'incluye original fuera del período a clasificar');
select hu61_clasificar_movimiento(101,'Operativo');
select hu61_clasificar_movimiento(102,'Operativo');
select hu61_clasificar_movimiento(104,'PagoProveedor',2);
select hu61_clasificar_movimiento(105,'TransferenciaInterna');
select hu61_clasificar_movimiento(107,'Operativo');
select hu61_clasificar_movimiento(107,'Operativo'); -- reintento idempotente
select test_reject($q$select hu61_clasificar_movimiento(107,'TransferenciaInterna')$q$,'otra clasificación');
select test_reject($q$select hu61_clasificar_movimiento(100,'Operativo')$q$,'manual original');
select test_reject($q$select hu61_clasificar_movimiento(108,'Operativo')$q$,'manual original');
select test_assert(finanzas_resumen('2026-10-01','2026-10-31',1)->'totales'=jsonb_build_object('ingresos','1100.00','egresos','650.00','flujo_neto','450.00'),'caja+proveedores sin duplicar e internas excluidas');
select test_assert(jsonb_array_length(finanzas_resumen('2026-10-01','2026-10-31',1)->'movimientos')=5,'detalle coincide con operaciones');
select test_assert(jsonb_array_length(finanzas_resumen('2026-10-01','2026-10-31',1,2026)->'mensual')=12,'serie anual incluye los doce meses');
select test_assert((select (m->>'ingresos')::numeric=1100 and (m->>'egresos')::numeric=650 from jsonb_array_elements(finanzas_resumen('2026-10-01','2026-10-31',1,2026)->'mensual') m where m->>'mes'='2026-10'),'serie mensual usa movimientos deduplicados y filtrados');
select test_assert((select (m->>'ingresos')::numeric=0 and (m->>'egresos')::numeric=0 from jsonb_array_elements(finanzas_resumen('2026-10-01','2026-10-31',1,2026)->'mensual') m where m->>'mes'='2026-01'),'meses sin operaciones son cero');
select test_assert((finanzas_resumen('2026-10-01','2026-10-31')->'totales'->>'ingresos')::numeric=1500,'todas incluye turno cerrado y sucursal inactiva');
select test_assert((finanzas_resumen('2026-10-01','2026-10-01',1)->'totales'->>'ingresos')::numeric=1000,'fecha desde inclusiva');
select test_assert((finanzas_resumen('2026-10-31','2026-10-31',1)->'totales'->>'ingresos')::numeric=100,'fecha hasta inclusiva en zona de negocio');
select test_assert((finanzas_resumen('2026-12-01','2026-12-31',1)->'totales'->>'flujo_neto')::numeric=0,'vacío es cero sin saldo inicial');

-- Las aplicaciones de un pago no multiplican el egreso.
reset role;

-- Volumen mayor al límite habitual de PostgREST, importes iguales y centavos.
insert into movimiento_caja(turno_id,caja_id,usuario_id,auth_id,fecha_hora,tipo,concepto,importe,medio_pago_id,medio,origen,idempotency_key)
select 1,1,1,'00000000-0000-0000-0000-000000000001','2025-01-15 12:00-03','Ingreso',
  'Venta de volumen',1,1,'Efectivo','Venta',gen_random_uuid() from generate_series(1,1100);
insert into movimiento_caja(turno_id,caja_id,usuario_id,auth_id,fecha_hora,tipo,concepto,importe,medio_pago_id,medio,origen,idempotency_key)
select 1,1,1,'00000000-0000-0000-0000-000000000001','2025-01-15 12:00-03','Ingreso',
  'Operaciones reales iguales',valor,1,'Efectivo','Venta',gen_random_uuid() from (values(100),(100),(0.10),(0.20)) v(valor);
insert into movimiento_caja(turno_id,caja_id,usuario_id,auth_id,fecha_hora,tipo,concepto,importe,medio_pago_id,medio,origen,idempotency_key)
values(1,1,1,'00000000-0000-0000-0000-000000000001','2025-01-15 12:00-03','Egreso','Centavos',0.10,1,'Efectivo','Manual','61000000-0000-0000-0000-000000000010');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
set role authenticated;
do $$ declare m bigint; begin
  -- Obtenemos ID sin acceso directo de authenticated a la tabla de caja.
  select referencia into m from jsonb_to_recordset(finanzas_resumen('2025-01-01','2025-01-31')->'incidencias') as x(referencia bigint);
  perform hu61_clasificar_movimiento(m,'Operativo');
end; $$;
select test_assert(jsonb_array_length(finanzas_resumen('2025-01-01','2025-01-31')->'movimientos')=1105,'detalle completo supera 1000 movimientos');
select test_assert((finanzas_resumen('2025-01-01','2025-01-31')->'totales'->>'ingresos')::numeric=1300.30,'no deduplica operaciones iguales ni pierde centavos');
select test_assert((finanzas_resumen('2025-01-01','2025-01-31')->'totales'->>'flujo_neto')::numeric=1300.20,'precisión decimal neta');
reset role;
delete from detalle_pago where id_pago=2;
insert into detalle_pago values(2,1,30),(2,2,30),(2,3,40);
set role authenticated;
select test_assert((finanzas_resumen('2026-10-15','2026-10-15',1)->'totales'->>'egresos')::numeric=100,'pago repartido entre tres facturas se cuenta una vez');

-- Nuevos movimientos y clasificación se confirman juntos; si falla, rollback.
select hu61_registrar_movimiento_caja(1,'Ingreso','Prueba nueva',0.10,1,'61000000-0000-0000-0000-000000000001',null,'Operativo');
select hu61_registrar_movimiento_caja(1,'Ingreso','Prueba nueva',0.10,1,'61000000-0000-0000-0000-000000000001',null,'Operativo');
select test_reject($q$select hu61_registrar_movimiento_caja(1,'Ingreso','Prueba nueva',0.10,1,'61000000-0000-0000-0000-000000000001',null,'TransferenciaInterna')$q$,'otra clasificación');
select test_reject($q$select hu61_registrar_movimiento_caja(1,'Egreso','Pago incorrecto',200,1,'61000000-0000-0000-0000-000000000002',null,'PagoProveedor',2)$q$,'coincidir');
reset role;
select test_assert((select count(*) from movimiento_caja where idempotency_key='61000000-0000-0000-0000-000000000001')=1,'idempotencia');
select test_assert(not exists(select 1 from movimiento_caja where idempotency_key='61000000-0000-0000-0000-000000000002'),'rollback de clasificación inválida');

-- Pagos heredados sin sucursal e incompletos generan incidencias, no omisión silenciosa.
alter table pago_proveedor disable trigger hu61_validar_sucursal_pago;
insert into pago_proveedor(fecha_pago,importe_total,id_sucursal) values('2026-10-20',20,null),('2026-10-20',30,1);
alter table pago_proveedor enable trigger hu61_validar_sucursal_pago;
set role authenticated;
select test_assert((finanzas_resumen('2026-10-01','2026-10-31',1)->>'completo')::boolean=false,'históricos sin sucursal/incompletos requieren conciliación');

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
select test_reject($q$select finanzas_contexto()$q$,'administrador activa');
select test_reject($q$select finanzas_resumen('2026-10-01','2026-10-31')$q$,'administrador activa');
select test_reject($q$select hu61_clasificar_movimiento(101,'Operativo')$q$,'administrador activa');
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
select test_reject($q$select finanzas_contexto()$q$,'administrador activa');
set request.jwt.claim.sub='';
select test_reject($q$select finanzas_contexto()$q$,'administrador activa');
set role anon;
select test_reject($q$select finanzas_contexto()$q$,'permission denied');
select test_reject($q$select finanzas_resumen('2026-10-01','2026-10-31')$q$,'permission denied');
set role authenticated;
select test_reject($q$select hu61_guardar_clasificacion(101,'Operativo',null)$q$,'permission denied');
select test_reject($q$select * from clasificacion_flujo_caja$q$,'permission denied');
reset role;

-- Reversiones de ingresos y egresos dentro del mismo período.
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
insert into movimiento_caja(turno_id,caja_id,usuario_id,auth_id,fecha_hora,tipo,concepto,importe,medio_pago_id,medio,origen,idempotency_key)
values
(1,1,1,'00000000-0000-0000-0000-000000000001','2025-02-01 12:00-03','Ingreso','Ingreso a revertir',500,1,'Efectivo','Manual','61000000-0000-0000-0000-000000000020'),
(1,1,1,'00000000-0000-0000-0000-000000000001','2025-02-01 12:00-03','Egreso','Egreso a revertir',300,1,'Efectivo','Manual','61000000-0000-0000-0000-000000000021');
select hu61_clasificar_movimiento(id,'Operativo') from movimiento_caja
where idempotency_key in ('61000000-0000-0000-0000-000000000020','61000000-0000-0000-0000-000000000021');
insert into movimiento_caja(turno_id,caja_id,usuario_id,auth_id,fecha_hora,tipo,concepto,importe,medio_pago_id,medio,origen,movimiento_original_id,idempotency_key)
select turno_id,caja_id,usuario_id,auth_id,'2025-02-02 12:00-03',case when tipo='Ingreso' then 'Egreso' else 'Ingreso' end,
  'Reversión de prueba',importe,medio_pago_id,medio,'Reversion',id,gen_random_uuid()
from movimiento_caja where idempotency_key in ('61000000-0000-0000-0000-000000000020','61000000-0000-0000-0000-000000000021');
set role authenticated;
select test_assert((finanzas_resumen('2025-02-01','2025-02-28')->'totales'->>'ingresos')::numeric=800,'reversión de egreso aporta ingreso');
select test_assert((finanzas_resumen('2025-02-01','2025-02-28')->'totales'->>'egresos')::numeric=800,'reversión de ingreso aporta egreso');
select test_assert((finanzas_resumen('2025-02-01','2025-02-28')->'totales'->>'flujo_neto')::numeric=0,'no revierte dos veces');
reset role;

-- Cambiar datos de un pago ya vinculado no debe alterar silenciosamente el flujo.
update pago_proveedor set importe_total=101 where id_pago=2;
set role authenticated;
select test_assert(exists(select 1 from jsonb_array_elements(finanzas_resumen('2026-10-01','2026-10-31')->'incidencias') i where i->>'origen'='VinculoPago'),'detecta vínculo modificado');
reset role;
