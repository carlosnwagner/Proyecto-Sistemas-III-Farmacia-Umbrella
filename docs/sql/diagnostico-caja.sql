-- Ejecutar en el SQL Editor del proyecto Supabase.
-- Solo consultas: no crea tablas, no cambia permisos ni escribe registros.

-- 1. Columnas reales: especialmente cierre de turno y claves del arqueo.
select table_name, ordinal_position, column_name, data_type,
       is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('caja', 'turno_caja', 'movimiento_caja', 'arqueo_caja',
                     'usuario_auth_caja', 'usuario_sucursal_caja')
order by table_name, ordinal_position;

-- 2. Funciones instaladas y roles habilitados para ejecutarlas.
select p.proname as funcion,
       pg_get_function_identity_arguments(p.oid) as argumentos,
       p.prosecdef as ejecuta_con_privilegios_del_propietario,
       has_function_privilege('anon', p.oid, 'EXECUTE') as acceso_anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as acceso_authenticated
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname like 'hu50_%' or p.proname = 'abrir_turno_caja'
       or p.proname like '%arqueo%' or p.proname like '%cierre%')
order by p.proname;

-- 3. RLS y permisos de tablas. Tener GRANT no implica que RLS permita registros.
select c.relname as tabla, c.relrowsecurity as rls,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_lectura,
       has_table_privilege('anon', c.oid, 'INSERT') as anon_insercion,
       has_table_privilege('anon', c.oid, 'UPDATE') as anon_edicion,
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_lectura
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('caja', 'turno_caja', 'movimiento_caja', 'arqueo_caja',
                    'usuario_auth_caja', 'usuario_sucursal_caja')
order by c.relname;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('caja', 'turno_caja', 'movimiento_caja', 'arqueo_caja',
                    'usuario_auth_caja', 'usuario_sucursal_caja')
order by tablename, policyname;

-- 4. Reglas de concurrencia e invalidación de arqueos existentes.
select tablename, indexname, indexdef from pg_indexes
where schemaname = 'public'
  and tablename in ('turno_caja', 'movimiento_caja', 'arqueo_caja')
order by tablename, indexname;

select c.relname as tabla, t.tgname as trigger,
       pg_get_triggerdef(t.oid) as definicion
from pg_trigger t join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and not t.tgisinternal
  and c.relname in ('turno_caja', 'movimiento_caja', 'arqueo_caja')
order by c.relname, t.tgname;

-- 5. Saldos reales por turno. El saldo inicial se suma UNA sola vez.
-- Incluye todos los movimientos registrados; las ventas solo cuentan si
-- su integración efectivamente las registra en movimiento_caja.
with totales as (
  select turno_id,
    coalesce(sum(importe) filter (where medio = 'Efectivo' and tipo = 'Ingreso'), 0) as ingresos_efectivo,
    coalesce(sum(importe) filter (where medio = 'Efectivo' and tipo = 'Egreso'), 0) as egresos_efectivo,
    coalesce(sum(case when tipo = 'Ingreso' then importe else -importe end)
      filter (where medio = 'Tarjeta'), 0) as tarjeta_neto,
    coalesce(sum(case when tipo = 'Ingreso' then importe else -importe end)
      filter (where medio = 'Transferencia'), 0) as transferencia_neto
  from public.movimiento_caja group by turno_id
)
select t.id as turno_id, c.nombre as caja, t.sucursal_id, t.cajero_id,
       t.estado, t.fecha_hora_apertura, t.saldo_inicial,
       coalesce(m.ingresos_efectivo, 0) as ingresos_efectivo,
       coalesce(m.egresos_efectivo, 0) as egresos_efectivo,
       t.saldo_inicial + coalesce(m.ingresos_efectivo, 0)
         - coalesce(m.egresos_efectivo, 0) as efectivo_esperado,
       coalesce(m.tarjeta_neto, 0) as tarjeta_neto,
       coalesce(m.transferencia_neto, 0) as transferencia_neto
from public.turno_caja t join public.caja c on c.id = t.caja_id
left join totales m on m.turno_id = t.id
order by t.fecha_hora_apertura desc, t.id desc
limit 50;

-- 6. Historial real de arqueos. No confundir id_arqueo con id.
select id_arqueo, turno_id, usuario_id, efectivo_contado,
       efectivo_esperado, diferencia, fecha_hora, valido_para_cierre
from public.arqueo_caja
order by fecha_hora desc, id_arqueo desc
limit 50;
