-- HU66 ampliada: cobrar mediante Mercado Pago Checkout Pro antes de crear el pedido.
-- Esta migración solo prepara el esquema y las funciones; no se ejecuta al editarla.
begin;

alter table public.pedido_online
  add column if not exists medio_pago_online text,
  add column if not exists mp_payment_id text unique,
  add column if not exists estado_pago text not null default 'No aplica';

alter table public.pedido_online
  drop constraint if exists pedido_online_estado_pago_check;
alter table public.pedido_online
  add constraint pedido_online_estado_pago_check
  check (estado_pago in ('No aplica','Aprobado','Reembolsado'));

create or replace function public.hu66_proteger_cancelacion_pago()
returns trigger language plpgsql set search_path=public as $$
begin
  if old.estado_pago='Aprobado' and new.estado='Cancelado' and new.estado_pago<>'Reembolsado' then
    raise exception 'Un pedido pagado debe reembolsarse en Mercado Pago antes de cancelarlo';
  end if;
  return new;
end $$;
drop trigger if exists pedido_online_proteger_cancelacion_pago on public.pedido_online;
create trigger pedido_online_proteger_cancelacion_pago before update of estado,estado_pago on public.pedido_online
for each row execute function public.hu66_proteger_cancelacion_pago();

create table if not exists public.pedido_online_pago_intento (
  id_intento uuid primary key default gen_random_uuid(),
  clave_idempotencia uuid not null unique,
  id_sucursal integer not null references public.sucursal(id_sucursal),
  nombre_cliente text not null,
  apellido_cliente text not null,
  contacto text not null,
  importe numeric(14,2) not null check (importe > 0),
  payload jsonb not null,
  estado text not null default 'PendientePago'
    check (estado in ('PendientePago','Aprobado','Reembolsado','ReembolsoPendiente','PagoSinPedido')),
  preference_id text unique,
  init_point text,
  mp_payment_id text unique,
  mp_payment_status text,
  id_pedido bigint references public.pedido_online(id_pedido),
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

create table if not exists public.detalle_pedido_online_pago_intento (
  id_intento uuid not null references public.pedido_online_pago_intento(id_intento) on delete cascade,
  id_articulo integer not null references public.articulo(id_articulo),
  id_articulo_deposito integer not null references public.articulo_deposito(id_articulo_deposito),
  cantidad integer not null check (cantidad between 1 and 100),
  precio_unitario numeric(14,2) not null check (precio_unitario > 0),
  primary key (id_intento,id_articulo)
);

revoke all on public.pedido_online_pago_intento, public.detalle_pedido_online_pago_intento from public, anon, authenticated;
-- Impide omitir el pago mediante la RPC anterior, incluso para clientes autenticados.
revoke all on function public.registrar_pedido_online(uuid,integer,text,text,text,jsonb) from public, anon, authenticated;

create or replace function public.hu66_mp_crear_intento(
  p_clave uuid, p_id_sucursal integer, p_nombre text, p_apellido text, p_contacto text, p_items jsonb
)
returns table(id_intento uuid, importe numeric, items jsonb, existente boolean)
language plpgsql security definer set search_path=public
as $$
declare
  v_item jsonb; v_id integer; v_cantidad integer; v_precio numeric(14,2); v_precio_enviado numeric(14,2);
  v_deposito integer; v_total numeric(14,2):=0; v_items jsonb:='[]'::jsonb; v_payload jsonb;
  v_intento public.pedido_online_pago_intento%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Acceso no autorizado'; end if;
  if p_clave is null then raise exception 'Clave de pago inválida'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_clave::text,0));
  v_payload:=jsonb_build_object('sucursal',p_id_sucursal,'nombre',btrim(coalesce(p_nombre,'')),'apellido',btrim(coalesce(p_apellido,'')),'contacto',btrim(coalesce(p_contacto,'')),
    'items',coalesce((select jsonb_agg(jsonb_build_object('id_articulo',(x->>'id_articulo')::integer,'cantidad',(x->>'cantidad')::integer,'precio_venta',(x->>'precio_venta')::numeric) order by (x->>'id_articulo')::integer) from jsonb_array_elements(coalesce(p_items,'[]'::jsonb)) x),'[]'::jsonb));
  select * into v_intento from public.pedido_online_pago_intento i where i.clave_idempotencia=p_clave;
  if found then
    if v_intento.payload is distinct from v_payload then raise exception 'La clave de pago ya fue usada con otros datos'; end if;
    return query select v_intento.id_intento,v_intento.importe,
      coalesce((select jsonb_agg(jsonb_build_object('id_articulo',d.id_articulo,'cantidad',d.cantidad,'precio_unitario',d.precio_unitario,'titulo',a.nombre) order by a.nombre) from public.detalle_pedido_online_pago_intento d join public.articulo a using(id_articulo) where d.id_intento=v_intento.id_intento),'[]'::jsonb),true; return;
  end if;
  if not public.catalogo_sucursal_valida(p_id_sucursal) then raise exception 'La sucursal seleccionada no está disponible'; end if;
  if nullif(btrim(p_nombre),'') is null or nullif(btrim(p_apellido),'') is null or nullif(btrim(p_contacto),'') is null then raise exception 'Completá tus datos de contacto'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>30 then raise exception 'El carrito no es válido'; end if;
  if jsonb_array_length(p_items)<>(select count(distinct (x->>'id_articulo')::integer) from jsonb_array_elements(p_items) x) then raise exception 'Hay productos repetidos'; end if;
  insert into public.pedido_online_pago_intento(clave_idempotencia,id_sucursal,nombre_cliente,apellido_cliente,contacto,importe,payload)
    values(p_clave,p_id_sucursal,btrim(p_nombre),btrim(p_apellido),btrim(p_contacto),1,v_payload) returning * into v_intento;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_id:=(v_item->>'id_articulo')::integer; v_cantidad:=(v_item->>'cantidad')::integer; v_precio_enviado:=(v_item->>'precio_venta')::numeric;
    if v_cantidad not between 1 and 100 then raise exception 'Cantidad inválida para el producto %',v_id; end if;
    select dlp.precio_final into v_precio from public.detalle_lista_precio dlp join public.lista_precio lp using(id_lista)
      where dlp.id_articulo=v_id and lp.estado is true and lp.fecha_inicio<=current_date and (lp.fecha_fin is null or lp.fecha_fin>=current_date)
      order by lp.fecha_inicio desc,lp.id_lista desc limit 1;
    if v_precio is null or round(v_precio,2) is distinct from round(v_precio_enviado,2) then raise exception 'El precio del producto % cambió; revisá el carrito',v_id; end if;
    select ad.id_articulo_deposito into v_deposito from public.articulo a join public.articulo_deposito ad on ad.id_articulo=a.id_articulo and ad.estado and ad.stock_actual>=v_cantidad
      join public.deposito d on d.id_deposito=ad.id_deposito and d.id_sucursal=p_id_sucursal and d.estado
      where a.id_articulo=v_id and a.estado and a.publicado_online order by ad.stock_actual desc,ad.id_articulo_deposito limit 1;
    if v_deposito is null then raise exception 'El producto % ya no está disponible',v_id; end if;
    v_precio:=round(v_precio,2); v_total:=v_total+v_precio*v_cantidad;
    insert into public.detalle_pedido_online_pago_intento values(v_intento.id_intento,v_id,v_deposito,v_cantidad,v_precio);
  end loop;
  update public.pedido_online_pago_intento set importe=v_total where pedido_online_pago_intento.id_intento=v_intento.id_intento;
  select coalesce(jsonb_agg(jsonb_build_object('id_articulo',d.id_articulo,'cantidad',d.cantidad,'precio_unitario',d.precio_unitario,'titulo',a.nombre) order by a.nombre),'[]'::jsonb)
    into v_items from public.detalle_pedido_online_pago_intento d join public.articulo a using(id_articulo) where d.id_intento=v_intento.id_intento;
  return query select v_intento.id_intento,v_total,v_items,false;
end $$;

create or replace function public.hu66_mp_guardar_preferencia(p_id_intento uuid,p_preference_id text,p_init_point text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Acceso no autorizado'; end if;
  update public.pedido_online_pago_intento set preference_id=p_preference_id,init_point=p_init_point,fecha_actualizacion=now()
  where id_intento=p_id_intento and estado='PendientePago' and (preference_id is null or preference_id=p_preference_id);
  if not found then raise exception 'No se pudo guardar la preferencia de pago'; end if;
end $$;

create or replace function public.hu66_mp_confirmar_pago(p_id_intento uuid,p_payment_id text,p_status text,p_transaction_amount numeric,p_currency text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_i public.pedido_online_pago_intento%rowtype; v_p public.pedido_online%rowtype; v_d record; v_stock_ok boolean:=true;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Acceso no autorizado'; end if;
  select * into v_i from public.pedido_online_pago_intento where id_intento=p_id_intento for update;
  if not found then raise exception 'Intento de pago inexistente'; end if;
  if v_i.id_pedido is not null then return jsonb_build_object('status','Aprobado','id_pedido',v_i.id_pedido); end if;
  if v_i.estado in ('Reembolsado','ReembolsoPendiente','PagoSinPedido') then return jsonb_build_object('status',v_i.estado); end if;
  if p_payment_id is null or p_status is distinct from 'approved' or p_currency is distinct from 'ARS'
    or p_transaction_amount is null or round(p_transaction_amount,2)<>round(v_i.importe,2) then
    raise exception 'El pago no coincide con el intento';
  end if;
  if v_i.mp_payment_id is not null and v_i.mp_payment_id<>p_payment_id then raise exception 'El intento ya tiene otro pago'; end if;
  for v_d in select * from public.detalle_pedido_online_pago_intento where id_intento=p_id_intento loop
    perform 1 from public.articulo_deposito where id_articulo_deposito=v_d.id_articulo_deposito for update;
    if not exists(select 1 from public.articulo_deposito ad join public.deposito d using(id_deposito) join public.articulo a using(id_articulo)
      where ad.id_articulo_deposito=v_d.id_articulo_deposito and ad.estado and ad.stock_actual>=v_d.cantidad and d.estado and d.id_sucursal=v_i.id_sucursal and a.estado and a.publicado_online) then v_stock_ok:=false; end if;
  end loop;
  if not v_stock_ok then
    update public.pedido_online_pago_intento set estado='ReembolsoPendiente',mp_payment_id=p_payment_id,mp_payment_status='approved',fecha_actualizacion=now() where id_intento=p_id_intento;
    return jsonb_build_object('status','ReembolsoPendiente');
  end if;
  insert into public.pedido_online(id_sucursal,nombre_cliente,apellido_cliente,contacto,importe_estimado,estado_pago,medio_pago_online,mp_payment_id)
    values(v_i.id_sucursal,v_i.nombre_cliente,v_i.apellido_cliente,v_i.contacto,v_i.importe,'Aprobado','Mercado Pago',p_payment_id) returning * into v_p;
  insert into public.detalle_pedido_online(id_pedido,id_articulo,id_articulo_deposito,cantidad,precio_unitario)
    select v_p.id_pedido,id_articulo,id_articulo_deposito,cantidad,precio_unitario from public.detalle_pedido_online_pago_intento where id_intento=p_id_intento;
  update public.pedido_online_pago_intento set estado='Aprobado',mp_payment_id=p_payment_id,mp_payment_status='approved',id_pedido=v_p.id_pedido,fecha_actualizacion=now() where id_intento=p_id_intento;
  return jsonb_build_object('status','Aprobado','id_pedido',v_p.id_pedido,'referencia',v_p.referencia);
end $$;

create or replace function public.hu66_mp_estado_intento(p_id_intento uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_i public.pedido_online_pago_intento%rowtype; v_p public.pedido_online%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Acceso no autorizado'; end if;
  select * into v_i from public.pedido_online_pago_intento where id_intento=p_id_intento;
  if not found then return jsonb_build_object('status','NoEncontrado'); end if;
  if v_i.id_pedido is not null then select * into v_p from public.pedido_online where id_pedido=v_i.id_pedido;
    return jsonb_build_object('status','Aprobado','id_pedido',v_p.id_pedido,'referencia',v_p.referencia,'nombre_cliente',v_p.nombre_cliente,'importe',v_p.importe_estimado); end if;
  return jsonb_build_object('status',v_i.estado,'importe',v_i.importe);
end $$;

create or replace function public.hu66_mp_marcar_reembolso(p_id_intento uuid,p_payment_id text,p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Acceso no autorizado'; end if;
  update public.pedido_online_pago_intento set estado=case when p_status='approved' then 'Reembolsado' when p_status='pending' then 'ReembolsoPendiente' else 'PagoSinPedido' end,
    mp_payment_id=p_payment_id,mp_payment_status='refund_'||p_status,fecha_actualizacion=now() where id_intento=p_id_intento and id_pedido is null;
end $$;

create or replace function public.hu66_mp_cancelar_reembolsado(p_id_pedido bigint,p_auth_uid uuid,p_motivo text,p_payment_id text)
returns public.pedido_online language plpgsql security definer set search_path=public as $$
declare v_p public.pedido_online%rowtype;
begin
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'Acceso no autorizado'; end if;
  if not exists(select 1 from public.usuario u where u.auth_id=p_auth_uid and u.estado is true and u.rol='administrador') then
    raise exception 'No tenés permiso para cancelar pedidos online';
  end if;
  if nullif(btrim(p_motivo),'') is null then raise exception 'Indicá el motivo de cancelación'; end if;
  update public.pedido_online set estado='Cancelado',estado_pago='Reembolsado',fecha_actualizacion=now(),motivo_cancelacion=btrim(p_motivo)
    where id_pedido=p_id_pedido and mp_payment_id=p_payment_id and estado_pago='Aprobado' and estado in ('Pendiente','Preparado')
    returning * into v_p;
  if not found then raise exception 'El pago no coincide con un pedido cancelable'; end if;
  return v_p;
end $$;

revoke all on function public.hu66_mp_crear_intento(uuid,integer,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.hu66_mp_guardar_preferencia(uuid,text,text) from public,anon,authenticated;
revoke all on function public.hu66_mp_confirmar_pago(uuid,text,text,numeric,text) from public,anon,authenticated;
revoke all on function public.hu66_mp_estado_intento(uuid) from public,anon,authenticated;
revoke all on function public.hu66_mp_marcar_reembolso(uuid,text,text) from public,anon,authenticated;
revoke all on function public.hu66_mp_cancelar_reembolsado(bigint,uuid,text,text) from public,anon,authenticated;
grant execute on function public.hu66_mp_crear_intento(uuid,integer,text,text,text,jsonb) to service_role;
grant execute on function public.hu66_mp_guardar_preferencia(uuid,text,text) to service_role;
grant execute on function public.hu66_mp_confirmar_pago(uuid,text,text,numeric,text) to service_role;
grant execute on function public.hu66_mp_estado_intento(uuid) to service_role;
grant execute on function public.hu66_mp_marcar_reembolso(uuid,text,text) to service_role;
grant execute on function public.hu66_mp_cancelar_reembolsado(bigint,uuid,text,text) to service_role;
comment on table public.pedido_online is 'Pedidos online de retiro pagados mediante Mercado Pago. No generan ventas ni movimientos de stock.';
commit;
