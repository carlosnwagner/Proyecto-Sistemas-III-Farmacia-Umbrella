-- Fuente exclusiva del reporte: no crea operaciones comerciales ni de caja.
begin;

create table public.finanzas_historico_demo (
  sucursal_id integer not null references public.sucursal(id_sucursal),
  mes date not null check (extract(day from mes) = 1),
  ingresos numeric(14,2) not null check (ingresos >= 0),
  egresos numeric(14,2) not null check (egresos >= 0),
  lote text not null default 'historico-demo-2026-v1',
  primary key (sucursal_id, mes)
);
comment on table public.finanzas_historico_demo is
  'Datos FICTICIOS exclusivos del reporte financiero. No representan ventas, compras ni caja.';
alter table public.finanzas_historico_demo enable row level security;
revoke all on public.finanzas_historico_demo from public, anon, authenticated;

alter function public.finanzas_resumen(date,date,bigint,integer)
  rename to finanzas_resumen_operativo;
revoke all on function public.finanzas_resumen_operativo(date,date,bigint,integer)
  from public, anon, authenticated;

create function public.finanzas_resumen(p_desde date,p_hasta date,p_sucursal bigint,p_anio_grafico integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r jsonb; extras jsonb; serie jsonb; ing numeric; egr numeric;
  anio integer := coalesce(p_anio_grafico,extract(year from p_desde)::integer);
begin
  -- La función original conserva permisos, validaciones y conciliación.
  r := public.finanzas_resumen_operativo(p_desde,p_hasta,p_sucursal,p_anio_grafico);
  -- Cada resumen mensual tiene fecha efectiva el último día del mes.
  select coalesce(jsonb_agg(jsonb_build_object(
    'id','demo:'||d.sucursal_id||':'||d.mes||':'||v.tipo,
    'fecha_efectiva',((d.mes+interval '1 month - 1 day')::date+time '12:00')
      at time zone 'America/Argentina/Buenos_Aires',
    'sucursal_id',d.sucursal_id,'concepto','[FICTICIO] Resumen mensual '||to_char(d.mes,'YYYY-MM'),
    'origen','Demo','tipo',v.tipo,'importe',v.importe::text)), '[]'::jsonb),
    coalesce(sum(v.importe) filter(where v.tipo='Ingreso'),0),
    coalesce(sum(v.importe) filter(where v.tipo='Egreso'),0)
  into extras,ing,egr
  from public.finanzas_historico_demo d
  cross join lateral (values ('Ingreso',d.ingresos),('Egreso',d.egresos)) v(tipo,importe)
  where (p_sucursal is null or d.sucursal_id=p_sucursal)
    and (d.mes+interval '1 month - 1 day')::date between p_desde and p_hasta;
  if (r->>'completo')::boolean then
    r := jsonb_set(r,'{totales}',jsonb_build_object(
      'ingresos',((r#>>'{totales,ingresos}')::numeric+ing)::text,
      'egresos',((r#>>'{totales,egresos}')::numeric+egr)::text,
      'flujo_neto',((r#>>'{totales,flujo_neto}')::numeric+ing-egr)::text));
    r := jsonb_set(r,'{movimientos}',coalesce((select jsonb_agg(m order by
      (m->>'fecha_efectiva')::timestamptz desc,m->>'id' desc)
      from jsonb_array_elements((r->'movimientos')||extras) m),'[]'::jsonb));
  end if;
  select jsonb_agg(m || jsonb_build_object(
    'ingresos',((m->>'ingresos')::numeric+coalesce(d.ingresos,0))::text,
    'egresos',((m->>'egresos')::numeric+coalesce(d.egresos,0))::text,
    'flujo_neto',((m->>'flujo_neto')::numeric+coalesce(d.ingresos,0)-coalesce(d.egresos,0))::text)
    order by m->>'mes') into serie
  from jsonb_array_elements(r->'mensual') m
  left join (select to_char(mes,'YYYY-MM') mes,sum(ingresos) ingresos,sum(egresos) egresos
    from public.finanzas_historico_demo
    where extract(year from mes)=anio and (p_sucursal is null or sucursal_id=p_sucursal)
    group by mes) d on d.mes=m->>'mes';
  return jsonb_set(r,'{mensual}',serie);
end; $$;
revoke all on function public.finanzas_resumen(date,date,bigint,integer) from public,anon;
grant execute on function public.finanzas_resumen(date,date,bigint,integer) to authenticated;
-- Recrear también la firma corta para que use el nuevo envoltorio.
create or replace function public.finanzas_resumen(p_desde date,p_hasta date,p_sucursal bigint default null)
returns jsonb language sql security definer set search_path = public as $$
  select public.finanzas_resumen(p_desde,p_hasta,p_sucursal,null::integer);
$$;
notify pgrst, 'reload schema';
commit;
