create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create table public.usuario(id_usuario integer primary key, auth_id uuid, estado boolean, rol text);
create table public.sucursal(id_sucursal integer primary key, estado boolean);
create table public.pago_proveedor(id_pago bigint generated always as identity primary key, fecha_pago date, importe_total numeric);
insert into public.usuario values
  (1,'00000000-0000-0000-0000-000000000001',true,'administrador'),
  (2,'00000000-0000-0000-0000-000000000002',true,'cajero'),
  (3,'00000000-0000-0000-0000-000000000003',false,'administrador');
insert into public.sucursal values(1,true),(2,false);
insert into public.pago_proveedor(fecha_pago,importe_total) values('2026-09-01',300);
grant usage on schema public, auth to authenticated, anon;
grant select, insert, update on public.pago_proveedor to authenticated, anon;
grant usage, select on all sequences in schema public to authenticated, anon;

\ir ../../supabase/migrations/202610150001_hu61_sucursal_pago_proveedor.sql

do $$ begin
  if (select id_sucursal from public.pago_proveedor where id_pago=1) is not null then
    raise exception 'El histórico fue asignado automáticamente';
  end if;
end; $$;

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';
set role authenticated;
insert into public.pago_proveedor(fecha_pago,importe_total,id_sucursal) values('2026-10-15',100,1);
update public.pago_proveedor set id_sucursal=1 where id_pago=1;
do $$ begin
  if (select id_sucursal from public.pago_proveedor where id_pago=1) <> 1 then
    raise exception 'No se pudo conciliar el histórico';
  end if;
  begin
    insert into public.pago_proveedor(fecha_pago,importe_total) values(current_date,100);
    raise exception 'TEST: aceptó pago sin sucursal';
  exception when raise_exception then
    if sqlerrm not like '%Seleccioná la sucursal%' then raise; end if;
  end;
  begin
    insert into public.pago_proveedor(fecha_pago,importe_total,id_sucursal) values(current_date,100,2);
    raise exception 'TEST: aceptó sucursal inactiva';
  exception when raise_exception then
    if sqlerrm not like '%no está disponible%' then raise; end if;
  end;
  begin
    insert into public.pago_proveedor(fecha_pago,importe_total,id_sucursal) values(current_date,100,999);
    raise exception 'TEST: aceptó sucursal inexistente';
  exception when raise_exception then
    if sqlerrm not like '%no está disponible%' then raise; end if;
  end;
  begin
    update public.pago_proveedor set id_sucursal=null where id_pago=1;
    raise exception 'TEST: permitió quitar sucursal conciliada';
  exception when raise_exception then
    if sqlerrm not like '%Seleccioná la sucursal%' then raise; end if;
  end;
end; $$;

set request.jwt.claim.sub='00000000-0000-0000-0000-000000000002';
do $$ begin
  begin
    insert into public.pago_proveedor(fecha_pago,importe_total,id_sucursal) values(current_date,100,1);
    raise exception 'TEST: aceptó cajero';
  exception when raise_exception then
    if sqlerrm not like '%administrador activa%' then raise; end if;
  end;
end; $$;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000003';
do $$ begin
  begin
    update public.pago_proveedor set id_sucursal=1 where id_pago=1;
    raise exception 'TEST: aceptó administrador inactivo';
  exception when raise_exception then
    if sqlerrm not like '%administrador activa%' then raise; end if;
  end;
end; $$;
set request.jwt.claim.sub='';
set role anon;
do $$ begin
  begin
    insert into public.pago_proveedor(fecha_pago,importe_total,id_sucursal) values(current_date,100,1);
    raise exception 'TEST: aceptó anónimo';
  exception when raise_exception then
    if sqlerrm not like '%administrador activa%' then raise; end if;
  end;
end; $$;
reset role;
do $$ begin
  if (select count(*) from public.pago_proveedor) <> 2 then
    raise exception 'Se guardaron pagos rechazados';
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.pago_proveedor'::regclass and contype='f') then
    raise exception 'Falta la clave foránea';
  end if;
end; $$;
