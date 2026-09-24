-- Actualización atómica de varios productos de una lista de precios.

begin;

create or replace function public.actualizar_precios_lista_lote(
  p_id_lista integer,
  p_detalles jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_id_detalle bigint;
  v_precio numeric;
  v_tipo_ajuste text;
  v_porcentaje numeric;
  v_actualizados integer := 0;
begin
  if not exists (
    select 1 from public.lista_precio where id_lista = p_id_lista
  ) then
    raise exception 'La lista de precios no existe';
  end if;

  if p_detalles is null
     or jsonb_typeof(p_detalles) <> 'array'
     or jsonb_array_length(p_detalles) = 0 then
    raise exception 'Debe enviar al menos un producto para actualizar';
  end if;

  if jsonb_array_length(p_detalles) <> (
    select count(distinct item->>'id_detalle_lista')
    from jsonb_array_elements(p_detalles) item
  ) then
    raise exception 'Un producto no puede repetirse en la actualización';
  end if;

  for v_item in select value from jsonb_array_elements(p_detalles)
  loop
    v_id_detalle := (v_item->>'id_detalle_lista')::bigint;
    v_precio := (v_item->>'precio')::numeric;
    v_tipo_ajuste := coalesce(v_item->>'tipo_ajuste', 'Sin ajuste');
    v_porcentaje := coalesce((v_item->>'porcentaje_ajuste')::numeric, 0);

    if v_precio is null or v_precio <= 0 then
      raise exception 'El precio debe ser mayor que cero';
    end if;

    if v_tipo_ajuste not in ('Sin ajuste', 'Descuento', 'Recargo') then
      raise exception 'El tipo de ajuste no es válido';
    end if;

    if v_porcentaje < 0 then
      raise exception 'El porcentaje de ajuste no puede ser negativo';
    end if;

    if v_tipo_ajuste = 'Descuento' and v_porcentaje >= 100 then
      raise exception 'El descuento debe ser menor que 100 %%';
    end if;

    update public.detalle_lista_precio
    set precio = round(v_precio, 2),
        porcentaje_descuento = case when v_tipo_ajuste = 'Descuento' then v_porcentaje else 0 end,
        porcentaje_recargo = case when v_tipo_ajuste = 'Recargo' then v_porcentaje else 0 end
    where id_detalle_lista = v_id_detalle
      and id_lista = p_id_lista;

    if not found then
      raise exception 'El detalle % no pertenece a la lista seleccionada', v_id_detalle;
    end if;

    v_actualizados := v_actualizados + 1;
  end loop;

  return v_actualizados;
end;
$$;

revoke all on function public.actualizar_precios_lista_lote(integer, jsonb) from public;
grant execute on function public.actualizar_precios_lista_lote(integer, jsonb) to anon, authenticated;

commit;
