import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Edit2, Percent, Plus, Search, Tag, Trash2, X } from "lucide-react";
import { showAlert } from "../lib/alerts.js";
import {
  createListaPrecio,
  deleteDetalleLista,
  getArticulosActivos,
  getDetallesLista,
  getListasPrecios,
  saveDetalleLista,
  setListaPrecioActiva,
  updateListaPrecio,
} from "../services/listasPrecios.js";

const hoy = () => new Date().toISOString().slice(0, 10);
const money = (value) =>
  Number(value || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" });

const inputStyle = {
  width: "100%",
  padding: "0.65rem 0.75rem",
  border: "1px solid #d1d5db",
  borderRadius: "0.5rem",
  background: "#fff",
  boxSizing: "border-box",
};

const emptyListaForm = () => ({
  nombre: "",
  descripcion: "",
  fecha_inicio: hoy(),
  fecha_fin: "",
});

const emptyDetalleForm = () => ({
  id_detalle_lista: null,
  id_articulo: "",
  precio: "",
  tipo_ajuste: "Sin ajuste",
  porcentaje_ajuste: "0",
});

function Modal({ title, children, onClose, width = "680px" }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,.48)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
      <div style={{ width, maxWidth: "100%", maxHeight: "92vh", overflowY: "auto", background: "#fff", borderRadius: "0.8rem", boxShadow: "0 24px 60px rgba(0,0,0,.22)" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#111827" }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ border: 0, background: "transparent", cursor: "pointer", color: "#6b7280" }}><X size={21} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ListasPrecios() {
  const [listas, setListas] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtro, setFiltro] = useState("Todas");
  const [listaModal, setListaModal] = useState(false);
  const [listaEditando, setListaEditando] = useState(null);
  const [listaForm, setListaForm] = useState(emptyListaForm());
  const [listaSeleccionada, setListaSeleccionada] = useState(null);
  const [detalles, setDetalles] = useState([]);
  const [detalleForm, setDetalleForm] = useState(emptyDetalleForm());
  const [saving, setSaving] = useState(false);

  const cargarListas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getListasPrecios();
    if (error) showAlert.errorSave(`No se pudieron cargar las listas: ${error.message}`);
    else setListas(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    let activo = true;

    Promise.all([getListasPrecios(), getArticulosActivos()]).then(([listasResult, articulosResult]) => {
      if (!activo) return;

      if (listasResult.error) showAlert.errorSave(`No se pudieron cargar las listas: ${listasResult.error.message}`);
      else setListas(listasResult.data);

      if (articulosResult.error) showAlert.errorSave(`No se pudieron cargar los productos: ${articulosResult.error.message}`);
      else setArticulos(articulosResult.data);

      setLoading(false);
    });

    return () => {
      activo = false;
    };
  }, []);

  const cargarDetalles = async (lista) => {
    const { data, error } = await getDetallesLista(lista.id_lista);
    if (error) return showAlert.errorSave(`No se pudieron cargar los precios: ${error.message}`);
    setListaSeleccionada(lista);
    setDetalles(data);
    setDetalleForm(emptyDetalleForm());
  };

  const abrirNuevaLista = () => {
    setListaEditando(null);
    setListaForm(emptyListaForm());
    setListaModal(true);
  };

  const abrirEdicionLista = (lista) => {
    setListaEditando(lista);
    setListaForm({
      nombre: lista.nombre || "",
      descripcion: lista.descripcion || "",
      fecha_inicio: lista.fecha_inicio || hoy(),
      fecha_fin: lista.fecha_fin || "",
    });
    setListaModal(true);
  };

  const guardarLista = async (event) => {
    event.preventDefault();
    if (!listaForm.nombre.trim()) return showAlert.errorSave("El nombre es obligatorio.");
    if (!listaForm.fecha_inicio) return showAlert.errorSave("La fecha de inicio es obligatoria.");
    if (listaForm.fecha_fin && listaForm.fecha_fin < listaForm.fecha_inicio) {
      return showAlert.errorSave("La fecha final no puede ser anterior a la fecha inicial.");
    }

    setSaving(true);
    const result = listaEditando
      ? await updateListaPrecio(listaEditando.id_lista, listaForm)
      : await createListaPrecio(listaForm);
    setSaving(false);

    if (result.error) return showAlert.errorSave(result.error.message);
    const mensajeCreacion = result.data
      ? `Lista creada con ${result.data.productos_agregados} producto(s)${result.data.productos_omitidos ? `; ${result.data.productos_omitidos} omitido(s) por no tener precio válido` : ""}`
      : "Lista creada";
    showAlert.successSave(listaEditando ? "Lista actualizada" : mensajeCreacion);
    setListaModal(false);
    await cargarListas();
  };

  const cambiarEstado = async (lista) => {
    const activar = !lista.estado;
    const { error } = await setListaPrecioActiva(lista.id_lista, activar);
    if (error) return showAlert.errorSave(error.message);
    showAlert.successSave(activar ? "Lista activada" : "Lista desactivada");
    await cargarListas();
  };

  const precioFinalPreview = useMemo(() => {
    const precio = Number(detalleForm.precio) || 0;
    const porcentaje = Number(detalleForm.porcentaje_ajuste) || 0;
    if (detalleForm.tipo_ajuste === "Descuento") return precio * (1 - porcentaje / 100);
    if (detalleForm.tipo_ajuste === "Recargo") return precio * (1 + porcentaje / 100);
    return precio;
  }, [detalleForm]);

  const guardarDetalle = async (event) => {
    event.preventDefault();
    const precio = Number(detalleForm.precio);
    const porcentaje = Number(detalleForm.porcentaje_ajuste);
    if (!detalleForm.id_articulo) return showAlert.errorSave("Seleccione un producto.");
    if (!Number.isFinite(precio) || precio <= 0) return showAlert.errorSave("El precio debe ser mayor que cero.");
    if (!Number.isFinite(porcentaje) || porcentaje < 0) return showAlert.errorSave("El ajuste no puede ser negativo.");
    if (detalleForm.tipo_ajuste === "Descuento" && porcentaje >= 100) {
      return showAlert.errorSave("El descuento debe ser menor que 100 %.");
    }

    setSaving(true);
    const { error } = await saveDetalleLista({
      ...detalleForm,
      id_lista: listaSeleccionada.id_lista,
    });
    setSaving(false);
    if (error) return showAlert.errorSave(error.code === "23505" ? "El producto ya pertenece a esta lista." : error.message);

    showAlert.successSave(detalleForm.id_detalle_lista ? "Precio actualizado" : "Producto agregado");
    await cargarDetalles(listaSeleccionada);
    await cargarListas();
  };

  const editarDetalle = (detalle) => {
    setDetalleForm({
      id_detalle_lista: detalle.id_detalle_lista,
      id_articulo: String(detalle.id_articulo),
      precio: String(detalle.precio),
      tipo_ajuste: detalle.tipo_ajuste || "Sin ajuste",
      porcentaje_ajuste: String(
        detalle.tipo_ajuste === "Descuento"
          ? detalle.porcentaje_descuento || 0
          : detalle.tipo_ajuste === "Recargo"
          ? detalle.porcentaje_recargo || 0
          : 0
      ),
    });
  };

  const eliminarDetalle = async (detalle) => {
    if (!window.confirm(`¿Quitar ${detalle.articulo?.nombre || "el producto"} de la lista?`)) return;
    const { error } = await deleteDetalleLista(detalle.id_detalle_lista);
    if (error) return showAlert.errorSave(error.message);
    showAlert.successSave("Producto quitado de la lista");
    await cargarDetalles(listaSeleccionada);
    await cargarListas();
  };

  const listasFiltradas = useMemo(() => listas.filter((lista) => {
    const term = search.toLowerCase();
    const coincide = lista.nombre?.toLowerCase().includes(term) || lista.descripcion?.toLowerCase().includes(term);
    if (filtro === "Activas") return coincide && lista.estado;
    if (filtro === "Inactivas") return coincide && !lista.estado;
    return coincide;
  }), [listas, search, filtro]);

  return (
    <div style={{ padding: "1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: 700, color: "#111827", margin: 0 }}>Listas de precios</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>Vigencias, precios, descuentos y recargos</p>
        </div>
        <button onClick={abrirNuevaLista} style={{ background: "#65482b", color: "#fff", border: 0, padding: "0.7rem 1.1rem", borderRadius: "0.5rem", fontWeight: 600, display: "flex", gap: "0.5rem", alignItems: "center", cursor: "pointer" }}>
          <Plus size={18} /> Nueva lista
        </button>
      </header>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "240px" }}>
          <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar lista..." style={{ ...inputStyle, paddingLeft: "2.4rem" }} />
        </div>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ ...inputStyle, width: "180px" }}>
          <option>Todas</option><option>Activas</option><option>Inactivas</option>
        </select>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "0.75rem", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead style={{ background: "#f9fafb", color: "#4b5563", fontSize: "0.75rem", textTransform: "uppercase" }}>
            <tr>{["Lista", "Vigencia", "Productos", "Estado", "Acciones"].map((h) => <th key={h} style={{ padding: "0.8rem 1rem", textAlign: h === "Acciones" ? "center" : "left" }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="5" style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>Cargando listas...</td></tr> : listasFiltradas.length === 0 ? (
              <tr><td colSpan="5" style={{ padding: "2.5rem", textAlign: "center", color: "#6b7280" }}><Tag size={30} style={{ marginBottom: ".5rem" }} /><br />No hay listas de precios cargadas.</td></tr>
            ) : listasFiltradas.map((lista) => (
              <tr key={lista.id_lista} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={{ padding: "0.85rem 1rem" }}><b>{lista.nombre}</b><div style={{ color: "#6b7280", fontSize: ".8rem" }}>{lista.descripcion || "Sin descripción"}</div></td>
                <td style={{ padding: "0.85rem 1rem" }}><CalendarDays size={15} style={{ verticalAlign: "middle", marginRight: 6 }} />{lista.fecha_inicio} — {lista.fecha_fin || "Sin fecha final"}</td>
                <td style={{ padding: "0.85rem 1rem" }}>{lista.cantidad_productos}</td>
                <td style={{ padding: "0.85rem 1rem" }}><span style={{ padding: ".2rem .55rem", borderRadius: "999px", fontSize: ".75rem", fontWeight: 700, color: lista.estado ? "#166534" : "#6b7280", background: lista.estado ? "#dcfce7" : "#f3f4f6" }}>{lista.estado ? "ACTIVA" : "INACTIVA"}</span></td>
                <td style={{ padding: "0.85rem 1rem", textAlign: "center", whiteSpace: "nowrap" }}>
                  <button onClick={() => cargarDetalles(lista)} style={{ marginRight: 6, border: 0, borderRadius: 6, padding: ".45rem .65rem", cursor: "pointer", background: "#f3ede7", color: "#65482b", fontWeight: 600 }}>Gestionar precios</button>
                  <button onClick={() => abrirEdicionLista(lista)} title="Editar" style={{ marginRight: 6, border: "1px solid #d1d5db", borderRadius: 6, padding: ".4rem", cursor: "pointer", background: "#fff" }}><Edit2 size={16} /></button>
                  <button onClick={() => cambiarEstado(lista)} style={{ border: 0, borderRadius: 6, padding: ".45rem .65rem", cursor: "pointer", color: "#fff", background: lista.estado ? "#b91c1c" : "#166534" }}>{lista.estado ? "Desactivar" : "Activar"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {listaModal && (
        <Modal title={listaEditando ? "Editar lista de precios" : "Nueva lista de precios"} onClose={() => setListaModal(false)}>
          <form onSubmit={guardarLista} style={{ padding: "1.25rem", display: "grid", gap: "1rem" }}>
            <label>Nombre *<input value={listaForm.nombre} onChange={(e) => setListaForm({ ...listaForm, nombre: e.target.value })} style={inputStyle} maxLength={120} /></label>
            <label>Descripción<textarea value={listaForm.descripcion} onChange={(e) => setListaForm({ ...listaForm, descripcion: e.target.value })} style={{ ...inputStyle, minHeight: 75, resize: "vertical" }} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <label>Fecha de inicio *<input type="date" value={listaForm.fecha_inicio} onChange={(e) => setListaForm({ ...listaForm, fecha_inicio: e.target.value })} style={inputStyle} /></label>
              <label>Fecha final (opcional)<input type="date" value={listaForm.fecha_fin} min={listaForm.fecha_inicio} onChange={(e) => setListaForm({ ...listaForm, fecha_fin: e.target.value })} style={inputStyle} /></label>
            </div>
            {!listaEditando && <p style={{ margin: 0, padding: ".75rem", borderRadius: 8, background: "#f3f4f6", color: "#4b5563", fontSize: ".85rem" }}>Al crearla se agregarán automáticamente todos los productos activos que tengan un precio de venta mayor que cero. La lista quedará inactiva para que puedas revisarla antes de activarla.</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: ".75rem" }}><button type="button" onClick={() => setListaModal(false)} style={{ padding: ".65rem 1rem", border: "1px solid #d1d5db", background: "#fff", borderRadius: 8, cursor: "pointer" }}>Cancelar</button><button disabled={saving} style={{ padding: ".65rem 1rem", border: 0, background: "#65482b", color: "#fff", borderRadius: 8, cursor: "pointer" }}>{saving ? "Guardando..." : "Guardar"}</button></div>
          </form>
        </Modal>
      )}

      {listaSeleccionada && (
        <Modal title={`Precios — ${listaSeleccionada.nombre}`} onClose={() => setListaSeleccionada(null)} width="1050px">
          <div style={{ padding: "1.25rem" }}>
            <form onSubmit={guardarDetalle} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: ".65rem", alignItems: "end", padding: "1rem", background: "#f9fafb", borderRadius: 10, marginBottom: "1rem" }}>
              <label>Producto *<select value={detalleForm.id_articulo} disabled={!!detalleForm.id_detalle_lista} onChange={(e) => { const articulo = articulos.find((a) => String(a.id_articulo) === e.target.value); setDetalleForm({ ...detalleForm, id_articulo: e.target.value, precio: articulo?.precio_venta ? String(articulo.precio_venta) : detalleForm.precio }); }} style={inputStyle}><option value="">Seleccionar...</option>{articulos.map((a) => <option key={a.id_articulo} value={a.id_articulo}>{a.codigo} — {a.nombre}</option>)}</select></label>
              <label>Precio base *<input type="number" min="0.01" step="0.01" value={detalleForm.precio} onChange={(e) => setDetalleForm({ ...detalleForm, precio: e.target.value })} style={inputStyle} /></label>
              <label>Ajuste<select value={detalleForm.tipo_ajuste} onChange={(e) => setDetalleForm({ ...detalleForm, tipo_ajuste: e.target.value, porcentaje_ajuste: "0" })} style={inputStyle}><option>Sin ajuste</option><option>Descuento</option><option>Recargo</option></select></label>
              <label>Porcentaje<input type="number" min="0" step="0.01" disabled={detalleForm.tipo_ajuste === "Sin ajuste"} value={detalleForm.porcentaje_ajuste} onChange={(e) => setDetalleForm({ ...detalleForm, porcentaje_ajuste: e.target.value })} style={inputStyle} /></label>
              <div><span style={{ display: "block", fontSize: ".85rem" }}>Precio final</span><b style={{ display: "block", padding: ".65rem 0", color: "#166534" }}>{money(precioFinalPreview)}</b></div>
              <button disabled={saving} style={{ border: 0, background: "#65482b", color: "#fff", borderRadius: 8, padding: ".7rem", cursor: "pointer" }}>{detalleForm.id_detalle_lista ? "Actualizar" : "Agregar"}</button>
            </form>
            {detalleForm.id_detalle_lista && <button onClick={() => setDetalleForm(emptyDetalleForm())} style={{ marginBottom: ".75rem", border: 0, background: "transparent", color: "#65482b", cursor: "pointer" }}>Cancelar edición</button>}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".88rem" }}><thead style={{ background: "#f9fafb" }}><tr>{["Producto", "Precio base", "Ajuste", "Precio final", "Acciones"].map((h) => <th key={h} style={{ padding: ".7rem", textAlign: h === "Acciones" ? "center" : "left" }}>{h}</th>)}</tr></thead><tbody>{detalles.length === 0 ? <tr><td colSpan="5" style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}>Agregá al menos un producto para poder activar la lista.</td></tr> : detalles.map((d) => <tr key={d.id_detalle_lista} style={{ borderTop: "1px solid #e5e7eb" }}><td style={{ padding: ".7rem" }}><b>{d.articulo?.nombre}</b><div style={{ color: "#6b7280" }}>{d.articulo?.codigo}</div></td><td style={{ padding: ".7rem" }}>{money(d.precio)}</td><td style={{ padding: ".7rem" }}><Percent size={14} style={{ verticalAlign: "middle", marginRight: 4 }} />{d.tipo_ajuste}{d.tipo_ajuste !== "Sin ajuste" ? ` ${d.tipo_ajuste === "Descuento" ? d.porcentaje_descuento : d.porcentaje_recargo}%` : ""}</td><td style={{ padding: ".7rem", fontWeight: 700, color: "#166534" }}>{money(d.precio_final)}</td><td style={{ padding: ".7rem", textAlign: "center" }}><button onClick={() => editarDetalle(d)} title="Editar" style={{ marginRight: 6, border: "1px solid #d1d5db", background: "#fff", borderRadius: 6, padding: ".4rem", cursor: "pointer" }}><Edit2 size={15} /></button><button onClick={() => eliminarDetalle(d)} title="Quitar" style={{ border: "1px solid #fecaca", color: "#b91c1c", background: "#fff", borderRadius: 6, padding: ".4rem", cursor: "pointer" }}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
