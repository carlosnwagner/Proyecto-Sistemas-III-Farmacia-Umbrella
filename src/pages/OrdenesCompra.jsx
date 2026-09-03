import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { ClipboardList, Plus, Search, Calendar, Trash2, Eye, Lock } from "lucide-react";

const estados = ["Todos", "Borrador", "Emitida", "Recibida", "Cancelada", "Cerrada"];

export default function OrdenesCompra() {
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");

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

  useEffect(() => {
    fetchOrdenes();
  }, []);

  async function fetchOrdenes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("orden_compra")
      .select(`
        id_orden_compra,
        numero_orden,
        fecha_emision,
        estado,
        condiciones,
        proveedor:id_proveedor ( razon_social )
      `)
      .order("id_orden_compra", { ascending: false });

    if (error) {
      console.error("Error al cargar órdenes:", error.message);
    } else {
      setOrdenes(data || []);
    }
    setLoading(false);
  }

  async function handleOpenNuevaOrden() {
    const [resProv, resArt] = await Promise.all([
      supabase.from("proveedor").select("id_proveedor, razon_social").eq("estado", true),
      supabase.from("articulo").select("id_articulo, nombre, precio_costo").eq("anulado", false)
    ]);

    setProveedores(resProv.data || []);
    setArticulosDisponibles(resArt.data || []);
    setNumeroOrden(`OC-${Math.floor(1000 + Math.random() * 9000)}`);
    setItems([{ id_articulo: "", cantidad: 1, precio_unitario: 0 }]);
    setIsModalOpen(true);
  }

  async function handleOpenDetalle(orden) {
    setOrdenSeleccionada(orden);
    setNuevoEstadoSeguimiento(orden.estado || "Emitida");
    
    const { data, error } = await supabase
      .from("detalle_orden_compra")
      .select(`
        cantidad,
        precio_unitario,
        articulo:id_articulo (
          nombre
        )
      `)
      .eq("id_orden_compra", orden.id_orden_compra);

    if (error) {
      console.error("Error al cargar detalle:", error.message);
      setDetallesOrden([]);
    } else {
      setDetallesOrden(data || []);
    }

    setIsDetalleOpen(true);
  }

  const handleActualizarSeguimiento = async (e) => {
    e.preventDefault();
    if (!ordenSeleccionada) return;

    if (ordenSeleccionada.estado === "Cerrada" || ordenSeleccionada.estado === "Cancelada") {
      alert("Esta orden está cerrada o cancelada y ya no permite modificaciones.");
      return;
    }

    const { error } = await supabase
      .from("orden_compra")
      .update({ estado: nuevoEstadoSeguimiento })
      .eq("id_orden_compra", ordenSeleccionada.id_orden_compra);

    if (error) {
      alert("Error al actualizar el seguimiento: " + error.message);
    } else {
      alert("¡Seguimiento actualizado con éxito!");
      setIsDetalleOpen(false);
      fetchOrdenes();
    }
  };

  const handleAddItem = () => setItems([...items, { id_articulo: "", cantidad: 1, precio_unitario: 0 }]);
  const handleRemoveItem = (index) => setItems(items.filter((_, i) => i !== index));
  
  const handleItemChange = (index, field, value) => {
    const nuevosItems = [...items];
    nuevosItems[index][field] = value;
    
    if (field === "id_articulo") {
      const art = articulosDisponibles.find(a => a.id_articulo == value);
      if (art) {
        nuevosItems[index].precio_unitario = art.precio_costo || 0;
      }
    }
    setItems(nuevosItems);
  };

  const calcularTotalOrden = (listaItems) => {
    return listaItems.reduce((acc, item) => acc + (Number(item.cantidad || 0) * Number(item.precio_unitario || 0)), 0);
  };

  const handleCrearOrden = async (e) => {
    e.preventDefault();
    if (!idProveedorSeleccionado || !numeroOrden.trim() || items.length === 0) {
      alert("Completa el proveedor, el número de orden y al menos un artículo.");
      return;
    }

    // 1. Validar preventivamente duplicación en el estado local de órdenes cargadas
    const ordenDuplicada = ordenes.some(
      (o) => o.numero_orden?.trim().toLowerCase() === numeroOrden.trim().toLowerCase()
    );

    if (ordenDuplicada) {
      alert(`El número de orden "${numeroOrden}" ya existe. Por favor, utiliza un número diferente.`);
      return;
    }

    // 2. Insertar la cabecera de la orden
    const { data: ordenCreada, error: errorOrden } = await supabase
      .from("orden_compra")
      .insert([
        {
          id_proveedor: parseInt(idProveedorSeleccionado),
          numero_orden: numeroOrden.trim(),
          fecha_emision: new Date().toISOString().split('T')[0],
          estado: "Emitida",
          condiciones: condiciones
        }
      ])
      .select()
      .single();

    if (errorOrden) {
      // Capturar si la base de datos rechaza por unicidad (código de error 23505 en PostgreSQL)
      if (errorOrden.code === "23505") {
        alert("Ya existe una orden de compra registrada con este mismo número.");
      } else {
        alert("Error al registrar la orden: " + errorOrden.message);
      }
      return;
    }

    // 3. Insertar los ítems en la tabla de detalle
    const detallesInserts = items.map(item => ({
      id_orden_compra: ordenCreada.id_orden_compra,
      id_articulo: parseInt(item.id_articulo),
      cantidad: parseInt(item.cantidad),
      precio_unitario: parseFloat(item.precio_unitario)
    }));

    const { error: errorDetalle } = await supabase
      .from("detalle_orden_compra")
      .insert(detallesInserts);

    if (errorDetalle) {
      alert("La orden se creó, pero falló el detalle: " + errorDetalle.message);
      return;
    }

    alert("¡Orden de compra y su detalle emitidos con éxito!");
    setIsModalOpen(false);
    fetchOrdenes();
  };

  const ordenesFiltradas = ordenes.filter((o) => {
    const textoMatch = 
      o.numero_orden?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.proveedor?.razon_social?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const estadoMatch = estadoFiltro === "Todos" || o.estado === estadoFiltro;
    return textoMatch && estadoMatch;
  });

  return (
    <section style={{ maxWidth: "1200px", margin: "0 auto", padding: "1rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "2rem" }}>
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

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: "#6b7280" }}>Cargando órdenes de compra...</div>
      ) : ordenesFiltradas.length === 0 ? (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
            <ClipboardList size={40} color="#8a7a6c" style={{ marginBottom: "0.75rem" }} />
            <h2 style={{ fontSize: "1.1rem", color: "#374151", margin: 0 }}>Todavía no hay órdenes de compra</h2>
            <p style={{ color: "#6b7280", margin: "0.5rem 0 0" }}>Crea una nueva orden para comenzar.</p>
          </div>
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
                <span style={{ backgroundColor: "#e0f2fe", color: "#075985", padding: "0.25rem 0.75rem", borderRadius: "1rem", fontSize: "0.75rem", fontWeight: "600" }}>
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

              <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => handleOpenDetalle(orden)}
                  style={{ backgroundColor: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", padding: "0.375rem 0.75rem", borderRadius: "0.375rem", fontSize: "0.8rem", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.375rem" }}
                >
                  <Eye size={15} /> Ver Detalle y Seguimiento
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Ver Detalle, Ítems, Total y Seguimiento con Bloqueo si está Cerrada o Cancelada */}
      {isDetalleOpen && ordenSeleccionada && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", width: "100%", maxWidth: "580px", padding: "1.5rem", boxShadow: "0 10px 25px rgba(0,0,0,0.1)", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#111827", marginTop: 0, marginBottom: "0.25rem" }}>
              Detalle de Orden: {ordenSeleccionada.numero_orden}
            </h2>
            <p style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "1rem" }}>
              <strong>Proveedor:</strong> {ordenSeleccionada.proveedor?.razon_social}
            </p>

            <div style={{ marginBottom: "1.25rem" }}>
              <h4 style={{ fontSize: "0.9rem", fontWeight: "600", color: "#374151", marginBottom: "0.5rem" }}>Artículos y Costos:</h4>
              <div style={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "0.5rem", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {detallesOrden.length === 0 ? (
                  <p style={{ fontSize: "0.85rem", color: "#6b7280", margin: 0 }}>No hay ítems registrados.</p>
                ) : (
                  <>
                    {detallesOrden.map((d, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", borderBottom: i < detallesOrden.length - 1 ? "1px solid #e5e7eb" : "none", paddingBottom: "0.35rem" }}>
                        <span>{d.articulo?.nombre || "Artículo"} (Cant: {d.cantidad})</span>
                        <span style={{ fontWeight: "600", color: "#374151" }}>
                          ${(d.cantidad * d.precio_unitario).toFixed(2)} <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>(${d.precio_unitario} c/u)</span>
                        </span>
                      </div>
                    ))}
                    <div style={{ borderTop: "1px dashed #d1d5db", marginTop: "0.5rem", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between", fontWeight: "700", color: "#111827" }}>
                      <span>Total Orden:</span>
                      <span>${calcularTotalOrden(detallesOrden).toFixed(2)}</span>
                    </div>
                  </>
                )}
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

      {/* Modal Nueva Orden (Con validación anti-duplicados) */}
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
                  {proveedores.map(p => (
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
                  <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>Artículos y Precios (Cotización) *</label>
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
                      {articulosDisponibles.map(a => (
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

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.75rem", fontSize: "0.9rem", fontWeight: "700", color: "#111827" }}>
                  <span>Total Estimado: ${calcularTotalOrden(items).toFixed(2)}</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: "600", color: "#374151" }}>Condiciones *</label>
                <textarea 
                  rows="2"
                  value={condiciones}
                  onChange={(e) => setCondiciones(e.target.value)}
                  style={{ padding: "0.625rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", fontSize: "0.875rem", resize: "vertical" }}
                  required
                />
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