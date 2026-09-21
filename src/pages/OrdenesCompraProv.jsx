import { useState, useEffect } from "react";
import DataTable from "../components/DataTable.jsx";
import { Plus, Search, Trash2, ArrowLeft, CheckCircle, FileDown, Ban, X } from "lucide-react";
import { supabase } from '../lib/supabase.js';
import { showAlert } from "../lib/alerts.js";
import { generateStandardPDF } from "../components/pdfGenerador.jsx";

import { getCondicionesPago, getMediosPago } from '../services/catalogos.js';
import { 
  createOrdenCompra, 
  getOrdenesCompra, 
  getOrdenCompraPorId, 
  registrarRecepcion 
} from '../services/ordenes_compra.js';

export default function OrdenesCompraProv() {
  const [ordenes, setOrdenes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [vistaActual, setVistaActual] = useState("listado"); 
   
  const [proveedores, setProveedores] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [condiciones, setCondiciones] = useState([]);
  const [mediosPago, setMediosPago] = useState([]);

  const [nuevaOrden, setNuevaOrden] = useState({ id_proveedor: "", id_condicion_pago: "", plazo_dias: "", estadoInicial: "Borrador" });
  const [detalles, setDetalles] = useState([]);

  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [detallesSeguimiento, setDetallesSeguimiento] = useState([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [depositoRecepcion, setDepositoRecepcion] = useState("");
  const [procesandoRecepcion, setProcesandoRecepcion] = useState(false);

  useEffect(() => {
    cargarDatosBase();
  }, []);

  const cargarDatosBase = async () => {
    const { data: dataOrdenes } = await getOrdenesCompra();
    setOrdenes(dataOrdenes || []);

    const { data: dataCond } = await getCondicionesPago();
    setCondiciones(dataCond || []);

    const { data: dataMedios } = await getMediosPago();
    setMediosPago(dataMedios || []);

    const { data: provs } = await supabase.from('proveedor').select('id_proveedor, razon_social').eq('estado', true);
    setProveedores(provs || []);

    const { data: arts } = await supabase.from('articulo').select('id_articulo, nombre, precio_costo').eq('estado', true);
    setArticulos(arts || []);

    const { data: deps } = await supabase.from('deposito').select('id_deposito, codigo, descripcion, rubros_permitidos').eq('estado', true);
    setDepositos(deps || []);
  };

  const handleVerOrden = async (orden) => {
    const { data, error } = await getOrdenCompraPorId(orden.id_orden_compra); 
    if (error) {
      showAlert.errorSave("Error al cargar detalle: " + error.message);
      return;
    }
     
    setOrdenSeleccionada(data);
    const detallesFormateados = (data.detalle || []).map(d => ({
      ...d,
      input_recepcion: d.cantidad_solicitada - d.cantidad_recibida
    }));
    setDetallesSeguimiento(detallesFormateados);
    setDepositoRecepcion("");
    setModalAbierto(true);
  };

  const handleRegistrarRecepcion = async () => {
    if (!depositoRecepcion) {
      return showAlert.errorSave("Debe seleccionar el depósito que recibirá la mercadería.");
    }

    const payloadRecepcion = detallesSeguimiento.map(d => ({
      id_detalle_orden: d.id_detalle_orden,
      cantidad: Number(d.input_recepcion || 0)
    })).filter(d => d.cantidad > 0);

    if (payloadRecepcion.length === 0) {
      return showAlert.errorSave("Debe ingresar al menos una cantidad recibida.");
    }

    setProcesandoRecepcion(true);
    const { data: estado, error } = await registrarRecepcion(
      ordenSeleccionada.id_orden_compra,
      depositoRecepcion,
      payloadRecepcion
    );

    if (error) {
      setProcesandoRecepcion(false);
      return showAlert.errorSave("No se pudo registrar la recepción: " + error.message);
    }

    showAlert.successSave(`Mercadería ingresada correctamente. Estado de la orden: ${estado}.`);
    await cargarDatosBase();
    setProcesandoRecepcion(false);
    setModalAbierto(false);
  };

  const handleCambiarEstado = async (nuevoEstado) => {
    if (nuevoEstado === "Cancelada") {
      const { data: facturaAsociada, error: errorFactura } = await supabase
        .from('factura_proveedor')
        .select('*')
        .eq('id_orden_compra', ordenSeleccionada.id_orden_compra);

      if (errorFactura) {
        console.error("Error al verificar facturas:", errorFactura);
      }

      if (facturaAsociada && facturaAsociada.length > 0) {
        showAlert.errorSave(
          `Acción bloqueada: La Orden N° ${ordenSeleccionada.numero_orden} tiene una factura asociada. Debe registrar una Nota de Crédito antes de poder cancelar esta orden.`
        );
        return; 
      }
    }

    const { error } = await supabase
      .from('orden_compra')
      .update({ estado: nuevoEstado })
      .eq('id_orden_compra', ordenSeleccionada.id_orden_compra);

    if (error) {
      showAlert.errorSave("Error al actualizar estado: " + error.message);
    } else {
      showAlert.successSave(`Orden actualizada a estado: ${nuevoEstado}`);
      cargarDatosBase();
      setModalAbierto(false);
    }
  };

  const agregarFila = () => setDetalles([...detalles, { id_articulo: "", cantidad_solicitada: 1, precio_unitario: 0 }]); 
  
  const actualizarFila = (index, campo, valor) => {
    const nuevos = [...detalles];
    nuevos[index][campo] = valor;
    if (campo === "id_articulo") {
      const art = articulos.find(a => a.id_articulo === Number(valor));
      if (art) nuevos[index].precio_unitario = art.precio_costo;
    }
    setDetalles(nuevos);
  };
  
  const eliminarFila = (index) => setDetalles(detalles.filter((_, i) => i !== index));
  const calcularTotal = (lista) => lista.reduce((acc, det) => acc + (Number(det.cantidad_solicitada) * Number(det.precio_unitario)), 0);
  
  const handleGuardarOrden = async () => {
    const payload = {
      id_proveedor: Number(nuevaOrden.id_proveedor),
      id_condicion_pago: nuevaOrden.id_condicion_pago ? Number(nuevaOrden.id_condicion_pago) : undefined,
      plazo_dias: nuevaOrden.plazo_dias ? Number(nuevaOrden.plazo_dias) : undefined,
      detalle: detalles.map(d => ({
        id_articulo: Number(d.id_articulo),
        cantidad_solicitada: Number(d.cantidad_solicitada),
        precio_unitario: Number(d.precio_unitario)
      }))
    };

    const { data, error } = await createOrdenCompra(payload); 

    if (error) {
      showAlert.errorSave(`Error: ${error.message}`); 
    } else {
      if (nuevaOrden.estadoInicial !== 'Emitida' && data?.id_orden_compra) {
        await supabase
          .from('orden_compra')
          .update({ estado: nuevaOrden.estadoInicial })
          .eq('id_orden_compra', data.id_orden_compra);
      }

      showAlert.successAction("¡Orden registrada con éxito!");
      cargarDatosBase();
      setVistaActual("listado");
    }
  };

  const generarPDFOrden = (orden, detalleOrden = []) => {
    if (orden.estado === "Borrador") {
      showAlert.errorSave("No se puede generar PDF de una orden en estado Borrador.");
      return;
    }

    const filasTabla = detalleOrden.map((d) => {
      const cantidad = Number(d.cantidad_solicitada || 0);
      const precio = Number(d.precio_unitario || 0);
      return [cantidad.toString(), d.articulo?.nombre || "Concepto / Servicio", `$ ${precio.toFixed(2)}`, `$ ${(cantidad * precio).toFixed(2)}`];
    });

    const total = detalleOrden.reduce((acc, d) => acc + Number(d.cantidad_solicitada || 0) * Number(d.precio_unitario || 0), 0);
    filasTabla.push(["TOTAL", "", "", `$ ${total.toFixed(2)}`]);

    generateStandardPDF({
      title: "ORDEN DE COMPRA",
      subtitle: `N° ${orden.numero_orden || "N/A"}`,
      infoData: [
        { label: "Proveedor", value: orden.proveedor?.razon_social || "N/A" },
        { label: "Fecha Emisión", value: orden.fecha_emision ? new Date(orden.fecha_emision).toLocaleDateString() : "N/A" },
        { label: "Estado", value: orden.estado || "N/A" }
      ],
      columns: ["Cant.", "Descripción", "Precio Unit.", "Subtotal"],
      rows: filasTabla,
      fileName: `Orden_Compra_${orden.numero_orden || "sin_numero"}.pdf`
    });
  };

  const BadgeEstado = ({ estado }) => {
    const colores = {
      Borrador: { bg: "#f3f4f6", text: "#4b5563" },
      Emitida: { bg: "#e0f2fe", text: "#075985" },
      Pendiente: { bg: "#e0f2fe", text: "#075985" },
      Recibida: { bg: "#dcfce7", text: "#166534" },
      Cerrada: { bg: "#f3f4f6", text: "#374151" },
      Cancelada: { bg: "#fee2e2", text: "#b91c1c" },
    };
    const c = colores[estado] || colores.Borrador;
    return <span style={{ backgroundColor: c.bg, color: c.text, padding: "0.25rem 0.625rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: "600" }}>{estado}</span>;
  };

  const columns = [
    { header: "N° ORDEN", render: (o) => <span style={{ fontWeight: "600", color: "#111827" }}>{o.numero_orden}</span> },
    { header: "PROVEEDOR", render: (o) => <span>{o.proveedor?.razon_social}</span> },
    { header: "FECHA", render: (o) => <span>{new Date(o.fecha_emision).toLocaleDateString()}</span> },
    { header: "ESTADO", render: (o) => <BadgeEstado estado={o.estado} /> },
  ];

  const commonInputStyle = { padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", fontSize: "0.875rem", outline: "none", width: "100%", boxSizing: "border-box" };

  const depositosCompatibles = depositos.filter((deposito) => {
    const permitidos = (deposito.rubros_permitidos || '')
      .split(',')
      .map((rubro) => rubro.trim().toUpperCase())
      .filter(Boolean);
    if (permitidos.length === 0) return true;

    return detallesSeguimiento
      .filter((detalle) => Number(detalle.input_recepcion || 0) > 0)
      .every((detalle) => {
        const prefijo = (detalle.articulo?.codigo || '').split('-')[0].trim().toUpperCase();
        return permitidos.includes(prefijo);
      });
  });

  const ordenesFiltradas = ordenes.filter(o => {
    const coincideTexto = o.numero_orden?.toLowerCase().includes(searchTerm.toLowerCase()) || o.proveedor?.razon_social?.toLowerCase().includes(searchTerm.toLowerCase());
    const coincideEstado = filtroEstado === "TODOS" || o.estado === filtroEstado;
    return coincideTexto && coincideEstado;
  });

  return (
    <div style={{ padding: "1.5rem" }}>
      {vistaActual === "listado" && (
        <div>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <div>
              <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>Órdenes de Compra</h1>
            </div>
            <button onClick={() => { setNuevaOrden({ id_proveedor: "", id_condicion_pago: "", plazo_dias: "", estadoInicial: "Borrador" }); setDetalles([]); setVistaActual("creacion"); }} style={{ backgroundColor: "#65482b", color: "#ffffff", border: "none", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <Plus size={18} /> Nueva Orden
            </button>
          </header>
          
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input type="text" placeholder="Buscar por orden o proveedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", boxSizing: "border-box" }} />
            </div>
            <div>
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ padding: "0.625rem 1rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", backgroundColor: "#ffffff", fontWeight: "600", outline: "none", cursor: "pointer" }}>
                <option value="TODOS">Todos los estados</option>
                <option value="Borrador">Borrador</option>
                <option value="Emitida">Emitida</option>
                <option value="Pendiente">Parcialmente recibida</option>
                <option value="Recibida">Recibida</option>
                <option value="Cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          <DataTable columns={columns} data={ordenesFiltradas} onEdit={handleVerOrden} />
        </div>
      )}

      {vistaActual === "creacion" && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", padding: "2rem", border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", margin: 0 }}>Emitir Orden de Compra / Gasto</h2>
            <button onClick={() => setVistaActual("listado")} style={{ background: "transparent", border: "none", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}><ArrowLeft size={18} /> Volver</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem", marginBottom: "2rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.375rem" }}>Proveedor</label>
              <select style={commonInputStyle} value={nuevaOrden.id_proveedor} onChange={(e) => setNuevaOrden({...nuevaOrden, id_proveedor: e.target.value})}>
                <option value="">Seleccione...</option>
                {proveedores.map(p => <option key={p.id_proveedor} value={p.id_proveedor}>{p.razon_social}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.375rem" }}>Condición de Pago</label>
              <select style={commonInputStyle} value={nuevaOrden.id_condicion_pago} onChange={(e) => setNuevaOrden({...nuevaOrden, id_condicion_pago: e.target.value})}>
                <option value="">Seleccione...</option>
                {condiciones.map(c => <option key={c.id_condicion_pago} value={c.id_condicion_pago}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.875rem", fontWeight: "600", marginBottom: "0.375rem" }}>Estado Inicial</label>
              <select style={commonInputStyle} value={nuevaOrden.estadoInicial} onChange={(e) => setNuevaOrden({...nuevaOrden, estadoInicial: e.target.value})}>
                <option value="Borrador">Borrador</option>
                <option value="Emitida">Emitida (Pendiente)</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "1rem" }}>Artículos / Conceptos</h3>
            {detalles.map((det, index) => (
              <div key={index} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr auto", gap: "1rem", alignItems: "center", marginBottom: "0.75rem" }}>
                <select style={commonInputStyle} value={det.id_articulo} onChange={(e) => actualizarFila(index, "id_articulo", e.target.value)}>
                  <option value="">Seleccionar artículo...</option>
                  {articulos.map(a => <option key={a.id_articulo} value={a.id_articulo}>{a.nombre}</option>)}
                </select>
                <input type="number" min="1" placeholder="Cant" style={commonInputStyle} value={det.cantidad_solicitada} onChange={(e) => actualizarFila(index, "cantidad_solicitada", e.target.value)} />
                <input type="number" step="any" placeholder="Precio Unit." style={commonInputStyle} value={det.precio_unitario} onChange={(e) => actualizarFila(index, "precio_unitario", e.target.value)} />
                <div style={{ fontWeight: "600", textAlign: "right" }}>${(det.cantidad_solicitada * det.precio_unitario).toLocaleString()}</div>
                <button onClick={() => eliminarFila(index)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer" }}><Trash2 size={18} /></button>
              </div>
            ))}
            <button onClick={agregarFila} style={{ background: "transparent", border: "1px dashed #d1d5db", fontWeight: "600", padding: "0.75rem", borderRadius: "0.5rem", width: "100%", marginTop: "1rem", cursor: "pointer" }}>+ Agregar renglón</button>
          </div>
          
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "2px solid #e5e7eb", paddingTop: "1.5rem" }}>
            <div style={{ fontSize: "1.25rem" }}>Total: <span style={{ fontWeight: "800" }}>${calcularTotal(detalles).toLocaleString()}</span></div>
            <button onClick={handleGuardarOrden} style={{ backgroundColor: "#166534", color: "#ffffff", border: "none", padding: "0.75rem 1.5rem", borderRadius: "0.5rem", fontWeight: "600", cursor: "pointer" }}>Guardar Orden</button>
          </div>
        </div>
      )}

      {/* Modal / Recuadro flotante limpio para ver detalle de la OC */}
      {modalAbierto && ordenSeleccionada && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh", backgroundColor: "rgba(0, 0, 0, 0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", padding: "2rem", width: "90%", maxWidth: "800px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "1rem", margin: 0 }}>
                  Orden {ordenSeleccionada.numero_orden}
                  <BadgeEstado estado={ordenSeleccionada.estado} />
                </h2>
                <p style={{ color: "#4b5563", marginTop: "0.25rem", margin: 0 }}>Proveedor: <strong>{ordenSeleccionada.proveedor?.razon_social}</strong></p>
              </div>
              <button onClick={() => setModalAbierto(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ marginBottom: "2rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
                <thead style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <tr>
                    <th style={{ padding: "0.75rem" }}>Concepto / Artículo</th>
                    <th style={{ padding: "0.75rem", textAlign: "center" }}>Solicitado</th>
                    <th style={{ padding: "0.75rem", textAlign: "center" }}>Ya Recibido</th>
                    <th style={{ padding: "0.75rem", textAlign: "center" }}>Recibir ahora</th>
                  </tr>
                </thead>
                <tbody>
                  {detallesSeguimiento.map((det, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "0.75rem" }}>{det.articulo?.nombre || "Artículo / Servicio"}</td>
                      <td style={{ padding: "0.75rem", textAlign: "center" }}>{det.cantidad_solicitada}</td>
                      <td style={{ padding: "0.75rem", textAlign: "center", fontWeight: "bold" }}>{det.cantidad_recibida || 0}</td>
                      <td style={{ padding: "0.75rem", textAlign: "center" }}>
                        <input
                          type="number"
                          min="0"
                          max={Number(det.cantidad_solicitada) - Number(det.cantidad_recibida || 0)}
                          value={det.input_recepcion}
                          disabled={Number(det.cantidad_recibida || 0) >= Number(det.cantidad_solicitada)}
                          onChange={(e) => setDetallesSeguimiento(actual => actual.map((item) => item.id_detalle_orden === det.id_detalle_orden ? { ...item, input_recepcion: e.target.value } : item))}
                          style={{ width: "85px", padding: "0.4rem", border: "1px solid #d1d5db", borderRadius: "0.35rem", textAlign: "center" }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {['Emitida', 'Pendiente'].includes(ordenSeleccionada.estado) && (
              <div style={{ marginBottom: "1.25rem", padding: "1rem", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "0.5rem" }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#166534", marginBottom: "0.4rem" }}>Depósito receptor *</label>
                <select value={depositoRecepcion} onChange={(e) => setDepositoRecepcion(e.target.value)} style={commonInputStyle}>
                  <option value="">Seleccione el depósito donde ingresa la mercadería...</option>
                  {depositosCompatibles.map((deposito) => <option key={deposito.id_deposito} value={deposito.id_deposito}>{deposito.codigo} - {deposito.descripcion} ({deposito.rubros_permitidos || 'Todos los rubros'})</option>)}
                </select>
                {depositosCompatibles.length === 0 && (
                  <small style={{ display: 'block', color: '#b91c1c', marginTop: '0.4rem' }}>No existe un depósito compatible con todos los productos seleccionados. Recibilos por grupos de rubro.</small>
                )}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e5e7eb", paddingTop: "1rem" }}>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {ordenSeleccionada.estado !== "Borrador" && (
                  <button type="button" onClick={() => generarPDFOrden(ordenSeleccionada, detallesSeguimiento)} style={{ backgroundColor: "#65482b", color: "#ffffff", border: "none", padding: "0.625rem 0.875rem", borderRadius: "0.5rem", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <FileDown size={16} /> Descargar PDF
                  </button>
                )}
                {ordenSeleccionada.estado === "Borrador" && (
                  <button type="button" onClick={() => handleCambiarEstado("Emitida")} style={{ backgroundColor: "#0284c7", color: "#ffffff", border: "none", padding: "0.625rem 0.875rem", borderRadius: "0.5rem", fontWeight: "600", cursor: "pointer" }}>
                    Pasar a Emitida (Pendiente)
                  </button>
                )}
                {['Emitida', 'Pendiente'].includes(ordenSeleccionada.estado) && (
                  <>
                    <button type="button" onClick={handleRegistrarRecepcion} disabled={procesandoRecepcion} style={{ backgroundColor: "#16a34a", color: "#ffffff", border: "none", padding: "0.625rem 0.875rem", borderRadius: "0.5rem", fontWeight: "600", cursor: procesandoRecepcion ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <CheckCircle size={16} /> {procesandoRecepcion ? "Registrando..." : "Registrar recepción"}
                    </button>
                    <button type="button" onClick={() => handleCambiarEstado("Cancelada")} style={{ backgroundColor: "#dc2626", color: "#ffffff", border: "none", padding: "0.625rem 0.875rem", borderRadius: "0.5rem", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Ban size={16} /> Cancelar Orden
                    </button>
                  </>
                )}
              </div>
              <button onClick={() => setModalAbierto(false)} style={{ backgroundColor: "#334155", color: "#ffffff", border: "none", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", fontWeight: "600", cursor: "pointer" }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
