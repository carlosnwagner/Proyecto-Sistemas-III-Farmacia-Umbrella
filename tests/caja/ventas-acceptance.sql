set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
set role authenticated;
select * from confirmar_venta_caja(1,'40000000-0000-0000-0000-000000000001',1,1,null,'B',1,'[{"id_articulo":1,"id_articulo_deposito":1,"cantidad":1}]',1,4000);
-- Reintento no vuelve a tocar stock ni cobrar.
select * from confirmar_venta_caja(1,'40000000-0000-0000-0000-000000000001',1,1,null,'B',1,'[{"id_articulo":1,"id_articulo_deposito":1,"cantidad":1}]',1,4000);
select test_reject($q$select * from confirmar_venta_caja(2,'40000000-0000-0000-0000-000000000002',1,1,null,'B',1,'[{"id_articulo":1,"id_articulo_deposito":1,"cantidad":100}]',1,400000)$q$,'Stock insuficiente');
reset role;
select test_assert((select count(*)=1 from venta),'una venta');
select test_assert((select importe_total=3800 from venta),'total distinto de recibido');
select test_assert((select stock_actual=9 from articulo_deposito),'stock una sola vez');
select test_assert((select count(*)=1 from detalle_venta),'detalle conservado');
select test_assert((select count(*)=1 from movimiento_caja where origen='Venta' and turno_id=6 and usuario_id=1 and importe=3800 and referencia_venta='1'),'cobro neto y turno correcto');
select test_assert((select count(*)=1 from venta_borrador where id_borrador=2),'fallo conserva borrador');
-- Una falla al insertar el cobro debe revertir venta y stock.
create function test_cobro_falla() returns trigger language plpgsql as $$begin if new.origen='Venta' then raise exception 'FALLO_COBRO'; end if; return new; end;$$;
create trigger test_cobro_falla before insert on movimiento_caja for each row execute function test_cobro_falla();
set role authenticated;
select test_reject($q$select * from confirmar_venta_caja(3,'40000000-0000-0000-0000-000000000003',1,1,null,'B',1,'[{"id_articulo":1,"id_articulo_deposito":1,"cantidad":1}]',1,3800)$q$,'FALLO_COBRO');
reset role;
select test_assert((select count(*)=1 from venta),'fallo caja revierte venta');
select test_assert((select stock_actual=9 from articulo_deposito),'fallo caja revierte stock');
drop trigger test_cobro_falla on movimiento_caja;
update turno_caja set estado='Cerrado' where cajero_id=1;
set role authenticated;
select test_reject($q$select * from confirmar_venta_caja(3,'40000000-0000-0000-0000-000000000003',1,1,null,'B',1,'[{"id_articulo":1,"id_articulo_deposito":1,"cantidad":1}]',1,3800)$q$,'turno abierto');
select test_reject($q$select * from confirmar_venta_caja(3,'40000000-0000-0000-0000-000000000003',2,1,null,'B',1,'[]',1,3800)$q$,'permiso');
reset role;
