-- HU64: el catálogo público solo debe ofrecer sucursales válidas para retirar.
-- Una sucursal es válida si está activa, tiene código y descripción cargados
-- y cuenta con al menos un depósito activo (donde se maneja el stock).

begin;

create or replace function public.catalogo_sucursal_valida(p_id_sucursal integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sucursal s
    where s.id_sucursal = p_id_sucursal
      and s.estado is true
      and nullif(btrim(s.codigo::text), '') is not null
      and nullif(btrim(s.descripcion::text), '') is not null
      and exists (
        select 1 from public.deposito d
        where d.id_sucursal = s.id_sucursal and d.estado is true
      )
  );
$$;

create or replace function public.catalogo_sucursales_publicas()
returns table (
  id_sucursal integer,
  codigo text,
  descripcion text
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id_sucursal, btrim(s.codigo::text), btrim(s.descripcion::text)
  from public.sucursal s
  where public.catalogo_sucursal_valida(s.id_sucursal)
  order by s.codigo, s.descripcion;
$$;

create or replace function public.catalogo_productos_sucursal_publicos(
  p_id_sucursal integer
)
returns table (
  id_articulo integer,
  nombre text,
  descripcion text,
  categoria text,
  imagen_url text,
  precio_final numeric,
  disponible boolean
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
    select ad.id_articulo, bool_or(coalesce(ad.stock_actual, 0) > 0) as tiene_stock
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
    coalesce(ss.tiene_stock, false) and coalesce(dlp.precio_final, 0) > 0
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

revoke all on function public.catalogo_sucursal_valida(integer) from public;
revoke all on function public.catalogo_sucursales_publicas() from public;
revoke all on function public.catalogo_productos_sucursal_publicos(integer) from public;
grant execute on function public.catalogo_sucursales_publicas() to anon, authenticated;
grant execute on function public.catalogo_productos_sucursal_publicos(integer) to anon, authenticated;

commit;

-- Para ver qué sucursales quedan visibles y cuáles se ocultan (ejecutar aparte):
-- select s.codigo, s.descripcion, s.estado,
--        public.catalogo_sucursal_valida(s.id_sucursal) as visible_en_catalogo
-- from public.sucursal s order by s.codigo;
