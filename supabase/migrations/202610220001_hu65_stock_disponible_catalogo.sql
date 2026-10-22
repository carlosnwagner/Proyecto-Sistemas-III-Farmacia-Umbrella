-- El pedido se abastece desde un unico deposito: usar el mayor stock disponible.
begin;

drop function public.catalogo_productos_sucursal_publicos(integer);

create function public.catalogo_productos_sucursal_publicos(
  p_id_sucursal integer
)
returns table (
  id_articulo integer,
  nombre text,
  descripcion text,
  categoria text,
  imagen_url text,
  precio_final numeric,
  disponible boolean,
  stock_actual integer
)
language sql
stable
security definer
set search_path = public
as $$
  with lista_actual as (
    select lp.id_lista
    from public.lista_precio lp
    where lp.estado is true
      and lp.fecha_inicio <= current_date
      and (lp.fecha_fin is null or lp.fecha_fin >= current_date)
    order by lp.fecha_inicio desc, lp.id_lista desc
    limit 1
  ), stock_sucursal as (
    select ad.id_articulo, max(greatest(coalesce(ad.stock_actual, 0), 0))::integer as stock_actual
    from public.articulo_deposito ad
    join public.deposito d on d.id_deposito = ad.id_deposito
    where d.id_sucursal = p_id_sucursal
      and d.estado is true
      and ad.estado is true
    group by ad.id_articulo
  )
  select
    a.id_articulo,
    a.nombre::text,
    coalesce(a.descripcion, '')::text,
    coalesce(r.nombre, 'Sin categoría')::text,
    a.imagen_url,
    dlp.precio_final,
    coalesce(ss.stock_actual, 0) > 0 and coalesce(dlp.precio_final, 0) > 0,
    coalesce(ss.stock_actual, 0)
  from public.articulo a
  left join public.rubro r on r.id_rubro = a.id_rubro
  left join lista_actual la on true
  left join public.detalle_lista_precio dlp
    on dlp.id_lista = la.id_lista and dlp.id_articulo = a.id_articulo
  left join stock_sucursal ss on ss.id_articulo = a.id_articulo
  where a.estado is true
    and a.publicado_online is true
    and public.catalogo_sucursal_valida(p_id_sucursal)
  order by a.nombre;
$$;

revoke all on function public.catalogo_productos_sucursal_publicos(integer) from public;
grant execute on function public.catalogo_productos_sucursal_publicos(integer) to anon, authenticated;

commit;
