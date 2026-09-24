import { supabase } from "../lib/supabase.js";

export async function getListasPrecios() {
  const [{ data: listas, error }, { data: detalles, error: detalleError }] = await Promise.all([
    supabase
      .from("lista_precio")
      .select("id_lista, nombre, descripcion, fecha_inicio, fecha_fin, estado, created_at, updated_at")
      .order("fecha_inicio", { ascending: false }),
    supabase.from("detalle_lista_precio").select("id_lista"),
  ]);

  if (error) return { data: [], error };
  if (detalleError) return { data: [], error: detalleError };

  const cantidades = new Map();
  for (const detalle of detalles || []) {
    cantidades.set(detalle.id_lista, (cantidades.get(detalle.id_lista) || 0) + 1);
  }

  return {
    data: (listas || []).map((lista) => ({
      ...lista,
      cantidad_productos: cantidades.get(lista.id_lista) || 0,
    })),
    error: null,
  };
}

export async function createListaPrecio(payload) {
  return supabase
    .rpc("crear_lista_precio_con_productos", {
      p_nombre: payload.nombre.trim(),
      p_descripcion: payload.descripcion?.trim() || "",
      p_fecha_inicio: payload.fecha_inicio,
      p_fecha_fin: payload.fecha_fin || null,
    })
    .single();
}

export async function updateListaPrecio(idLista, payload) {
  return supabase
    .from("lista_precio")
    .update({
      nombre: payload.nombre.trim(),
      descripcion: payload.descripcion?.trim() || null,
      fecha_inicio: payload.fecha_inicio,
      fecha_fin: payload.fecha_fin || null,
    })
    .eq("id_lista", idLista)
    .select()
    .single();
}

export async function setListaPrecioActiva(idLista, activa) {
  if (activa) {
    const { count, error: countError } = await supabase
      .from("detalle_lista_precio")
      .select("id_detalle_lista", { count: "exact", head: true })
      .eq("id_lista", idLista);

    if (countError) return { data: null, error: countError };
    if (!count) {
      return {
        data: null,
        error: { message: "La lista debe tener al menos un producto antes de activarse." },
      };
    }
  }

  return supabase
    .from("lista_precio")
    .update({ estado: activa })
    .eq("id_lista", idLista)
    .select()
    .single();
}

export async function getArticulosActivos() {
  const { data, error } = await supabase
    .from("articulo")
    .select("id_articulo, codigo, codigo_barras, nombre, precio_venta, alicuota_iva, estado")
    .eq("estado", true)
    .order("nombre", { ascending: true });

  return { data: data || [], error };
}

export async function getDetallesLista(idLista) {
  const { data, error } = await supabase
    .from("detalle_lista_precio")
    .select(`
      id_detalle_lista,
      id_lista,
      id_articulo,
      precio,
      porcentaje_descuento,
      porcentaje_recargo,
      tipo_ajuste,
      precio_final,
      articulo:id_articulo (id_articulo, codigo, nombre, alicuota_iva)
    `)
    .eq("id_lista", idLista)
    .order("id_detalle_lista", { ascending: true });

  return { data: data || [], error };
}

export async function addArticulosActivosToLista(idLista) {
  return supabase
    .rpc("agregar_productos_activos_lista", { p_id_lista: Number(idLista) })
    .single();
}

export async function saveDetalleLista(payload) {
  const esDescuento = payload.tipo_ajuste === "Descuento";
  const esRecargo = payload.tipo_ajuste === "Recargo";

  const datos = {
    id_lista: Number(payload.id_lista),
    id_articulo: Number(payload.id_articulo),
    precio: Number(payload.precio),
    porcentaje_descuento: esDescuento ? Number(payload.porcentaje_ajuste) : 0,
    porcentaje_recargo: esRecargo ? Number(payload.porcentaje_ajuste) : 0,
  };

  if (payload.id_detalle_lista) {
    return supabase
      .from("detalle_lista_precio")
      .update(datos)
      .eq("id_detalle_lista", payload.id_detalle_lista)
      .select()
      .single();
  }

  return supabase
    .from("detalle_lista_precio")
    .insert(datos)
    .select()
    .single();
}

export async function updateDetallesListaLote(idLista, detalles) {
  const payload = detalles.map((detalle) => ({
    id_detalle_lista: Number(detalle.id_detalle_lista),
    precio: Number(detalle.precio),
    tipo_ajuste: detalle.tipo_ajuste,
    porcentaje_ajuste: Number(detalle.porcentaje_ajuste || 0),
  }));

  return supabase.rpc("actualizar_precios_lista_lote", {
    p_id_lista: Number(idLista),
    p_detalles: payload,
  });
}

export async function deleteDetalleLista(idDetalleLista) {
  return supabase
    .from("detalle_lista_precio")
    .delete()
    .eq("id_detalle_lista", idDetalleLista);
}
