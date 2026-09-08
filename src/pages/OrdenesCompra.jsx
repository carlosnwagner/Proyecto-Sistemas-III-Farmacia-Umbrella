import { useState } from "react";
import { 
  ClipboardList, Plus, Search, Calendar, Trash2, Eye, 
  Lock, FileDown, CheckCircle2, AlertCircle, X 
} from "lucide-react";
import { generateStandardPDF } from "../components/pdfGenerador.jsx";

const estados = ["Todos", "Borrador", "Emitida", "Recibida", "Cancelada", "Cerrada"];

const DATOS_HARCODEADOS = [
  {
    id_orden_compra: 101,
    numero_orden: "OC-8622",
    fecha_emision: "2026-09-05",
    estado: "Emitida",
    condiciones: "Pago a 30 días.",
    proveedor: { razon_social: "Droguería Sudamericana S.A." },
    detalles: [
      { id: 1, articulo: { nombre: "Paracetamol 500mg x 20 comp." }, cantidad: 50, precio_unitario: 1200 },
      { id: 2, articulo: { nombre: "Ibuprofeno 600mg x 10 comp." }, cantidad: 30, precio_unitario: 1800 }
    ]
  },
  {
    id_orden_compra: 102,
    numero_orden: "OC-4190",
    fecha_emision: "2026-09-01",
    estado: "Emitida",
    condiciones: "Pago contado contra entrega.",
    proveedor: { razon_social: "Laboratorios Bagó" },
    detalles: [
      { id: 3, articulo: { nombre: "Amoxicilina 500mg x 16 comp." }, cantidad: 20, precio_unitario: 3500 },
      { id: 4, articulo: { nombre: "Loratadina 10mg x 10 comp." }, cantidad: 15, precio_unitario: 1100 }
    ]
  }
];

export default function OrdenesCompra() {
  const [ordenes, setOrdenes] = useState(DATOS_HARCODEADOS);
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");

  // Estado para la Alerta Animada (Toast)
  const [alerta, setAlerta] = useState({ mostrar: false, mensaje: "", tipo: "success" });

  const mostrarNotificacion = (mensaje, tipo = "success") => {
    setAlerta({ mostrar: true, mensaje, tipo });
    setTimeout(() => {
      setAlerta({ mostrar: false, mensaje: "", tipo: "success" });
    }, 3500);
  };

  // Modal Nueva Orden
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [articulosDisponibles, setArticulosDisponibles] = useState([]);
  const [idProveedorSeleccionado, setIdProveedorSeleccionado] = useState("");
  const [numeroOrden, setNumeroOrden] = useState("");
  const [condiciones, setCondiciones] = useState("Pago a 30 días.");
  const [items, setItems] = useState([{ id_articulo: "", cantidad: 1, precio_unitario: 0 }]);

  // Modal Ver Detalle / Seguimiento
  const [isDetalleOpen, setIsDetalleOpen] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [detallesOrden, setDetallesOrden] = useState([]);
  const [nuevoEstadoSeguimiento, setNuevoEstadoSeguimiento] = useState("");

  function handleOpenNuevaOrden() {
    setProveedores([
      { id_proveedor: 1, razon_social: "Droguería Sudamericana S.A." },
      { id_proveedor: 2, razon_social: "Laboratorios Bagó" }
    ]);
    setArticulosDisponibles([
      { id_articulo: 1, nombre: "Paracetamol 500mg x 20 comp.", precio_costo: 1200 },
      { id_articulo: 2, nombre: "Ibuprofeno 600mg x 10 comp.", precio_costo: 1800 }
    ]);
    setNumeroOrden(`OC-${Math.floor(1000 + Math.random() * 9000)}`);
    setItems([{ id_articulo: "", cantidad: 1, precio_unitario: 0 }]);
    setIsModalOpen(true);
  }

  function handleOpenDetalle(orden) {
    setOrdenSeleccionada(orden);
    setNuevoEstadoSeguimiento(orden.estado || "Emitida");
    setDetallesOrden(orden.detalles || []);
    setIsDetalleOpen(true);
  }

  const handleDescargarPDF = (orden, detalles) => {
    const filasTabla = detalles.map((d) => [
      d.cantidad.toString(),
      d.articulo?.nombre || "Artículo sin nombre",
      `$ ${Number(d.precio_unitario).toFixed(2)}`,
      `$ ${(d.cantidad * d.precio_unitario).toFixed(2)}`
    ]);

    const totalCalculado = calcularTotalOrden(detalles);
    filasTabla.push(["TOTAL", "", "", `$ ${totalCalculado.toFixed(2)}`]);

    generateStandardPDF({
      title: "ORDEN DE COMPRA",
      subtitle: `N° ${orden.numero_orden}`,
      infoData: [
        { label: "Proveedor", value: orden.proveedor?.razon_social || "N/A" },
        { label: "Fecha Emisión", value: orden.fecha_emision || "N/A" },
        { label: "Estado", value: orden.estado || "Emitida" },
        { label: "Condiciones", value: orden.condiciones || "Sin especificar" }
      ],
      columns: ["Cant.", "Descripción", "Precio Unit.", "Subtotal"],
      rows: filasTabla,
      fileName: `Orden_Compra_${orden.numero_orden}.pdf`
    });
  };

  const handleActualizarSeguimiento = (e) => {
    e.preventDefault();
    if (!ordenSeleccionada) return;

    if (ordenSeleccionada.estado === "Cerrada" || ordenSeleccionada.estado === "Cancelada") {
      mostrarNotificacion("Esta orden está cerrada o cancelada y ya no permite modificaciones.", "error");
      return;
    }

    setOrdenes((prev) =>
      prev.map((o) =>
        o.id_orden_compra === ordenSeleccionada.id_orden_compra
          ? { ...o, estado: nuevoEstadoSeguimiento }
          : o
      )
    );

    mostrarNotificacion("¡Estado de la orden actualizado exitosamente!", "success");
    setIsDetalleOpen(false);
  };

  const handleAddItem = () => setItems([...items, { id_articulo: "", cantidad: 1, precio_unitario: 0 }]);
  const handleRemoveItem = (index) => setItems(items.filter((_, i) => i !== index));

  const handleItemChange = (index, field, value) => {
    const nuevosItems = [...items];
    nuevosItems[index][field] = value;

    if (field === "id_articulo") {
      const art = articulosDisponibles.find((a) => a.id_articulo == value);
      if (art) {
        nuevosItems[index].precio_unitario = art.precio_costo || 0;
      }
    }
    setItems(nuevosItems);
  };

  const calcularTotalOrden = (listaItems) => {
    return listaItems.reduce(
      (acc, item) => acc + Number(item.cantidad || 0) * Number(item.precio_unitario || 0),
      0
    );
  };

  const handleCrearOrden = (e) => {
    e.preventDefault();
    if (!idProveedorSeleccionado || !numeroOrden.trim() || items.length === 0) {
      mostrarNotificacion("Completa el proveedor, el número de orden y al menos un artículo.", "error");
      return;
    }

    const provObj = proveedores.find((p) => p.id_proveedor == idProveedorSeleccionado);

    const nuevaOrdenLocal = {
      id_orden_compra: Date.now(),
      numero_orden: numeroOrden.trim(),
      fecha_emision: new Date().toISOString().split("T")[0],
      estado: "Emitida",
      condiciones: condiciones,
      proveedor: { razon_social: provObj ? provObj.razon_social : "Proveedor de Prueba" },
      detalles: items.map((item, idx) => {
        const art = articulosDisponibles.find((a) => a.id_articulo == item.id_articulo);
        return {
          id: idx + 1,
          articulo: { nombre: art ? art.nombre : "Artículo genérico" },
          cantidad: parseInt(item.cantidad),
          precio_unitario: parseFloat(item.precio_unitario)
        };
      })
    };

    setOrdenes([nuevaOrdenLocal, ...ordenes]);
    mostrarNotificacion("¡Orden de compra generada con éxito!", "success");
    setIsModalOpen(false);
  };

  const ordenesFiltradas = ordenes.filter((o) => {
    const textoMatch =
      o.numero_orden?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.proveedor?.razon_social?.toLowerCase().includes(searchTerm.toLowerCase());

    const estadoMatch = estadoFiltro === "Todos" || o.estado === estadoFiltro;
    return textoMatch && estadoMatch;
  });

  return (
    <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "1rem", position: "relative" }}>
      
      {/* --- ALERTA DE NOTIFICACIÓN ANIMADA --- */}
      {alerta.mostrar && (
        <div style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 9999,
          backgroundColor: alerta.tipo === "success" ? "#10b981" : "#ef4444",
          color: "#ffffff",
          padding: "0.85rem 1.25rem",
          borderRadius: "0.5rem",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          animation: "slideIn 0.3s ease-out forwards"
        }}>
          {alerta.tipo === "success" ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span style={{ fontWeight: "600", fontSize: "0.9rem" }}>{alerta.mensaje}</span>
          <button 
            type="button" 
            onClick={() => setAlerta({ ...alerta, mostrar: false })}
            style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer", marginLeft: "0.5rem" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Estilos CSS Inline para la animación slideIn */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>

      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>Orden de compra</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>Emitir y gestionar el seguimiento de pedidos a proveedores</p>
        </div>
        <button
          type="button"
          onClick={handleOpenNuevaOrden}
          style={{ backgroundColor: "#65482b", color: "#ffffff", border: "none", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
        >
          <Plus size={18} /> Nueva orden
        </button>
      </header>

      {/* Filtros de búsqueda */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 300px" }}>
          <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="search"
            placeholder="Buscar por número o proveedor..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <select
          aria-label="Filtrar por estado"
          value={estadoFiltro}
          onChange={(event) => setEstadoFiltro(event.target.value)}
          style={{ minWidth: "180px", padding: "0.625rem 2rem 0.625rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#374151" }}
        >
          {estados.map((opcion) => <option key={opcion} value={opcion}>{opcion}</option>)}
        </select>
      </div>

      {ordenesFiltradas.length === 0 ? (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", border: "1px solid #e5e7eb", padding: "3rem 1.5rem", textAlign: "center" }}>
          <ClipboardList size={40} color="#8a7a6c" style={{ marginBottom: "0.75rem" }} />
          <h2 style={{ fontSize: "1.1rem", color: "#374151", margin: 0 }}>No hay órdenes de compra disponibles</h2>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "1.5rem" }}>
          {ordenesFiltradas.map((orden) => (
            <div key={orden.id_orden_compra} style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", padding: "1.5rem", border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: "600", textTransform: "uppercase" }}>{orden.numero_orden}</span>
                  <h3 style={{ margin: "0.25rem 0 0", fontSize: "1.125rem", color: "#111827", fontWeight: "700" }}>
                    {orden.proveedor?.razon_social || "Proveedor general"}
                  </h3>
                </div>
                <span style={{ backgroundColor: orden.estado === "Emitida" ? "#fef3c7" : "#e0f2fe", color: orden.estado === "Emitida" ? "#92400e" : "#075985", padding: "0.25rem 0.75rem", borderRadius: "1rem", fontSize: "0.75rem", fontWeight: "600" }}>
                  {orden.estado || "Emitida"}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem", color: "#4b5563", fontSize: "0.875rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Calendar size={16} color="#9ca3af" />
                  <span><strong>Emisión:</strong> {orden.fecha_emision || "N/A"}</span>
                </div>
                {orden.condiciones && (
                  <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.25rem" }}>
                    <strong>Condiciones:</strong> {orden.condiciones}
                  </div>
                )}
              </div>

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => handleDescargarPDF(orden, orden.detalles || [])}
                  style={{ backgroundColor: "#ffffff", color: "#65482b", border: "1px solid #65482b", padding: "0.375rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem" }}
                >
                  <FileDown size={15} /> Descargar PDF
                </button>

                <button
                  onClick={() => handleOpenDetalle(orden)}
                  style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", padding: "0.375rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem" }}
                >
                  <Eye size={15} /> Ver Detalle
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Ver Detalle y PDF */}
      {isDetalleOpen && ordenSeleccionada && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", width: "100%", maxWidth: "580px", padding: "1.5rem", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#111827", margin: 0 }}>
                Detalle: {ordenSeleccionada.numero_orden}
              </h2>
              <button
                type="button"
                onClick={() => handleDescargarPDF(ordenSeleccionada, detallesOrden)}
                style={{ backgroundColor: "#65482b", color: "#ffffff", border: "none", padding: "0.35rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem" }}
              >
                <FileDown size={14} /> Imprimir / PDF
              </button>
            </div>

            <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1rem" }}>
              <strong>Proveedor:</strong> {ordenSeleccionada.proveedor?.razon_social}
            </p>

            <div style={{ marginBottom: "1.25rem" }}>
              <h4 style={{ fontSize: "0.9rem", fontWeight: "600", color: "#374151", marginBottom: "0.5rem" }}>Artículos y Costos:</h4>
              <div style={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "0.5rem", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {detallesOrden.map((d, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", borderBottom: i < detallesOrden.length - 1 ? "1px solid #e5e7eb" : "none", paddingBottom: "0.35rem" }}>
                    <span>{d.articulo?.nombre || "Artículo"} (Cant: {d.cantidad})</span>
                    <span style={{ fontWeight: "600", color: "#374151" }}>
                      ${(d.cantidad * d.precio_unitario).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div style={{ borderTop: "1px dashed #d1d5db", marginTop: "0.5rem", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between", fontWeight: "700", color: "#111827" }}>
                  <span>Total Orden:</span>
                  <span>${calcularTotalOrden(detallesOrden).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleActualizarSeguimiento} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>Actualizar Estado / Seguimiento *</label>
                {ordenSeleccionada.estado === "Cerrada" || ordenSeleccionada.estado === "Cancelada" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem", backgroundColor: "#f3f4f6", borderRadius: "0.375rem", color: "#374151", fontSize: "0.875rem", fontWeight: "600" }}>
                    <Lock size={16} color="#4b5563" />
                    <span>Orden {ordenSeleccionada.estado} (Bloqueada para modificaciones)</span>
                  </div>
                ) : (
                  <select
                    value={nuevoEstadoSeguimiento}
                    onChange={(e) => setNuevoEstadoSeguimiento(e.target.value)}
                    style={{ padding: "0.625rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", fontSize: "0.875rem" }}
                    required
                  >
                    <option value="Borrador">Borrador</option>
                    <option value="Emitida">Emitida</option>
                    <option value="Recibida">Recibida</option>
                    <option value="Cancelada">Cancelada</option>
                    <option value="Cerrada">Cerrada</option>
                  </select>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem", borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
                <button 
                  type="button" 
                  onClick={() => setIsDetalleOpen(false)}
                  style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#374151", fontWeight: "600", cursor: "pointer" }}
                >
                  Cerrar
                </button>
                {ordenSeleccionada.estado !== "Cerrada" && ordenSeleccionada.estado !== "Cancelada" && (
                  <button 
                    type="submit"
                    style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", backgroundColor: "#65482b", color: "#ffffff", fontWeight: "600", cursor: "pointer" }}
                  >
                    Guardar Cambios
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nueva Orden */}
      {isModalOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem", overflowY: "auto" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", width: "100%", maxWidth: "640px", padding: "1.5rem", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#111827", marginTop: 0, marginBottom: "1rem" }}>
              Emitir Orden de Compra
            </h2>

            <form onSubmit={handleCrearOrden} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>Proveedor *</label>
                <select
                  value={idProveedorSeleccionado}
                  onChange={(e) => setIdProveedorSeleccionado(e.target.value)}
                  style={{ padding: "0.625rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", fontSize: "0.875rem" }}
                  required
                >
                  <option value="" disabled>-- Seleccionar Proveedor --</option>
                  {proveedores.map((p) => (
                    <option key={p.id_proveedor} value={p.id_proveedor}>{p.razon_social}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>Número de Orden *</label>
                <input 
                  type="text"
                  value={numeroOrden}
                  onChange={(e) => setNumeroOrden(e.target.value)}
                  style={{ padding: "0.625rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", fontSize: "0.875rem" }}
                  required
                />
              </div>

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>Artículos y Precios *</label>
                  <button 
                    type="button" 
                    onClick={handleAddItem}
                    style={{ backgroundColor: "#f3f4f6", border: "1px solid #d1d5db", padding: "0.25rem 0.5rem", borderRadius: "0.25rem", fontSize: "0.75rem", fontWeight: "600", cursor: "pointer" }}
                  >
                    + Agregar ítem
                  </button>
                </div>

                {items.map((item, index) => (
                  <div key={index} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                    <select
                      value={item.id_articulo}
                      onChange={(e) => handleItemChange(index, "id_articulo", e.target.value)}
                      style={{ flex: 2.5, padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", fontSize: "0.85rem" }}
                      required
                    >
                      <option value="" disabled>-- Seleccionar Artículo --</option>
                      {articulosDisponibles.map((a) => (
                        <option key={a.id_articulo} value={a.id_articulo}>{a.nombre}</option>
                      ))}
                    </select>

                    <input 
                      type="number" 
                      min="1"
                      placeholder="Cant"
                      value={item.cantidad}
                      onChange={(e) => handleItemChange(index, "cantidad", e.target.value)}
                      style={{ flex: 1, padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", fontSize: "0.85rem" }}
                      required
                    />

                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      placeholder="Precio Unit."
                      value={item.precio_unitario}
                      onChange={(e) => handleItemChange(index, "precio_unitario", e.target.value)}
                      style={{ flex: 1.2, padding: "0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", fontSize: "0.85rem" }}
                      required
                    />

                    {items.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => handleRemoveItem(index)}
                        style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "0.25rem" }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem", borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", backgroundColor: "#ffffff", color: "#374151", fontWeight: "600", cursor: "pointer" }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", backgroundColor: "#65482b", color: "#ffffff", fontWeight: "600", cursor: "pointer" }}
                >
                  Guardar Orden
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}