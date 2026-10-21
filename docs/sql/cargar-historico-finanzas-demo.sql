-- Ejecutar DESPUÉS de 202610210001_finanzas_historico_demo.sql, en SQL Editor
-- de Supabase con rol postgres. Por defecto muestra la propuesta y NO guarda.
-- Para guardar, cambiar solamente el ROLLBACK final por COMMIT.
begin;
select pg_advisory_xact_lock(hashtextextended('historico-demo-2026-v1',0));

-- El contexto de administrador es LOCAL a esta transacción.
do $$
declare administrador uuid;
begin
  select u.auth_id into administrador from public.usuario u
  join auth.users a on a.id=u.auth_id
  where u.rol='administrador' and u.estado is true order by u.id_usuario limit 1;
  if administrador is null then raise exception 'Falta un administrador activo con auth_id'; end if;
  perform set_config('request.jwt.claim.sub',administrador::text,true);
end $$;

create temporary table propuesta_historico on commit drop as
with referencias as (
  -- Octubre hasta el 21: se proyecta su ritmo diario a un mes de 31 días.
  -- Ambas fuentes son operativas, excluyen los datos ficticios de este script.
  select s.id_sucursal,s.codigo,
    public.finanzas_resumen_operativo('2026-10-01','2026-10-21',s.id_sucursal,2026) r,
    public.hu66_mp_movimientos_reporte('2026-10-01','2026-10-21',s.id_sucursal,2026) online
  from public.sucursal s
), bases as (
  select id_sucursal,codigo,
    case when (r->>'completo')::boolean then
      ((r#>>'{totales,ingresos}')::numeric+coalesce((select sum((m->>'importe')::numeric)
        from jsonb_array_elements(online->'movimientos') m where m->>'tipo'='Ingreso'),0))*31/21 end ingreso,
    case when (r->>'completo')::boolean then
      ((r#>>'{totales,egresos}')::numeric+coalesce((select sum((m->>'importe')::numeric)
        from jsonb_array_elements(online->'movimientos') m where m->>'tipo'='Egreso'),0))*31/21 end egreso
  from referencias
), calibradas as (
  select *,coalesce(nullif(ingreso,0),
    (select avg(ingreso) from bases where ingreso>0),2700000) ingreso_base
  from bases
)
select b.id_sucursal,b.codigo,make_date(2026,n,1) mes,
  round(b.ingreso_base*(0.72+n*0.025)*
    (0.94+mod(b.id_sucursal*7+n*13,15)::numeric/100),2) ingresos,
  round(coalesce(nullif(b.egreso,0),b.ingreso_base*0.68)*(0.72+n*0.025)*
    (0.92+mod(b.id_sucursal*11+n*7,17)::numeric/100),2) egresos,
  case when b.ingreso>0 then 'Octubre de la sucursal, proyectado a mes completo'
    else 'Promedio de sucursales; si no hay datos, referencia de $2.700.000' end referencia
from calibradas b cross join generate_series(1,9) n;

-- La clave por sucursal/mes impide duplicar o recalibrar filas ya cargadas.
insert into public.finanzas_historico_demo(sucursal_id,mes,ingresos,egresos)
select id_sucursal,mes,ingresos,egresos from propuesta_historico
on conflict (sucursal_id,mes) do nothing;

-- Resultado efectivo de la carga, incluyendo filas conservadas de ejecuciones previas.
select s.codigo,d.mes,d.ingresos,d.egresos,d.ingresos-d.egresos flujo_neto,
  p.referencia,d.lote
from public.finanzas_historico_demo d
join public.sucursal s on s.id_sucursal=d.sucursal_id
join propuesta_historico p on p.id_sucursal=d.sucursal_id and p.mes=d.mes
order by s.codigo,d.mes;

rollback;
