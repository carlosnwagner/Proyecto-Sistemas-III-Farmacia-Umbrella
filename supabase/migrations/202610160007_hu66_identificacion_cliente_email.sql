-- HU66: permite al cliente ver sus pedidos tras verificar el correo usado al comprar.
begin;

create or replace function public.hu66_mis_pedidos_cliente()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(auth.jwt()->>'email','')));
  v_pedidos jsonb;
begin
  if auth.uid() is null or v_email = '' or not exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and lower(btrim(u.email)) = v_email
  ) then
    raise exception 'Verificá tu correo para consultar tus pedidos';
  end if;

  select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object(
    'sucursal', jsonb_build_object('codigo',s.codigo,'descripcion',s.descripcion),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id_articulo',d.id_articulo,'nombre',a.nombre,'cantidad',d.cantidad,'precio_unitario',d.precio_unitario,'subtotal',d.subtotal) order by a.nombre)
      from public.detalle_pedido_online d join public.articulo a using(id_articulo) where d.id_pedido=p.id_pedido),'[]'::jsonb)
  ) order by p.fecha_creacion desc), '[]'::jsonb)
  into v_pedidos
  from public.pedido_online p
  join public.sucursal s using (id_sucursal)
  where lower(btrim(p.contacto)) = v_email;

  return v_pedidos;
end;
$$;

revoke all on function public.hu66_mis_pedidos_cliente() from public, anon;
grant execute on function public.hu66_mis_pedidos_cliente() to authenticated;
comment on function public.hu66_mis_pedidos_cliente() is 'Lista los pedidos asociados al correo verificado de la sesión del cliente.';

commit;
