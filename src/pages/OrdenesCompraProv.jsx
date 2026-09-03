import { useState, useEffect } from "react";
import DataTable from "../components/DataTable.jsx";
import { Plus, Search, Trash2, ArrowLeft, Save, CheckCircle, FileText } from "lucide-react";
import { supabase } from '../lib/supabase.js';

import { getCondicionesPago, getMediosPago } from '../services/catalogos.js';
import { 
  createOrdenCompra, 
  getOrdenesCompra, 
  getOrdenCompraPorId, 
  registrarRecepcion 
} from '../services/ordenes_compra.js'; //

export default function OrdenesCompra() {
  const [ordenes, setOrdenes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [vistaActual, setVistaActual] = useState("listado"); 
  
  // SELECTS
  const [proveedores, setProveedores] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [condiciones, setCondiciones] = useState([]);
  const [mediosPago, setMediosPago] = useState([]);

  // Estados CREACIÓN
  const [nuevaOrden, setNuevaOrden] = useState({ id_proveedor: "", id_condicion_pago: "", plazo_dias: "" });
  const [detalles, setDetalles] = useState([]);

  // Estados SEGUIMIENTO
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [detallesSeguimiento, setDetallesSeguimiento] = useState([]);

  // --- CARGA INICIAL DE DATOS ---
  useEffect(() => {
    cargarDatosBase();
  }, []);

  const cargarDatosBase = async () => {
    // Ordenes
    const { data: dataOrdenes } = await getOrdenesCompra();
    setOrdenes(dataOrdenes || []);

    // catálogos activos
    const { data: dataCond } = await getCondicionesPago();
    setCondiciones(dataCond || []);

    const { data: dataMedios } = await getMediosPago();
    setMediosPago(dataMedios || []);

    // Proveedores y artículos
    const { data: provs } = await supabase.from('proveedor').select('id_proveedor, razon_social').eq('estado', true);
    setProveedores(provs || []);

    const { data: arts } = await supabase.from('articulo').select('id_articulo, nombre, precio_costo').eq('estado', true);
    setArticulos(arts || []);
  };

  // --- LÓGICA DE LISTADO Y SEGUIMIENTO ---
  const handleVerOrden = async (orden) => {
    const { data, error } = await getOrdenCompraPorId(orden.id_orden_compra); 
    if (error) {
      alert("Error al cargar detalle: " + error.message);
      return;
    }
    
    setOrdenSeleccionada(data);
    
    const detallesFormateados = (data.detalle || []).map(d => ({
      ...d,
      input_recepcion: d.cantidad_solicitada - d.cantidad_recibida // sugerencia de recepción
    }));
    setDetallesSeguimiento(detallesFormateados);
    setVistaActual("seguimiento");
  };

  const actualizarInputRecepcion = (index, valor) => {
    const nuevos = [...detallesSeguimiento];
    nuevos[index].input_recepcion = Number(valor);
    setDetallesSeguimiento(nuevos);
  };

  // REGISTRAR RECEPCIÓN
  const handleConfirmarRecepcion = async () => {
    const payloadRecepcion = detallesSeguimiento
      .filter(d => d.input_recepcion > 0)
      .map(d => ({
        id_detalle_orden: d.id_detalle_orden,
        cantidad: d.input_recepcion
      }));

    const { error } = await registrarRecepcion(ordenSeleccionada.id_orden_compra, payloadRecepcion);
    
    if (error) {
      alert(`Error en ${error.field || 'recepción'}: ${error.message}`); 
    } else {
      alert("Cantidades recibidas registradas con éxito.");
      cargarDatosBase();
      setVistaActual("listado");
    }
  };

  const handleVincularFacturaMock = () => {
    alert("La vinculación de facturas requiere el servicio de la HU30 (Facturas). Por ahora el backend pide un id_factura_proveedor ya existente."); 
  };

  // --- LÓGICA DE CREACIÓN ---
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
    // Mapeamos el payload exacto para la validación del backend[cite: 11]
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
      alert(`Error en el campo ${error.field || 'general'}: ${error.message}`); 
    } else {
      alert("¡Orden registrada con éxito!");
      cargarDatosBase();
      setVistaActual("listado");
    }
  };

  const BadgeEstado = ({ estado }) => {
    const colores = {
      Emitida: { bg: "#e0f2fe", text: "#075985" },
      Recibida: { bg: "#fef3c7", text: "#92400e" },
      Facturada: { bg: "#dcfce7", text: "#166534" },
      Cerrada: { bg: "#f3f4f6", text: "#374151" },
    };
    const c = colores[estado] || colores.Cerrada;
    return <span style={{ backgroundColor: c.bg, color: c.text, padding: "0.25rem 0.625rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: "600" }}>{estado}</span>;
  };

  const columns = [
    { header: "N° ORDEN", render: (o) => <span style={{ fontWeight: "600" }}>{o.numero_orden}</span> },
    { header: "PROVEEDOR", render: (o) => <span>{o.proveedor?.razon_social}</span> },
    { header: "FECHA", render: (o) => <span>{new Date(o.fecha_emision).toLocaleDateString()}</span> },
    { header: "ESTADO", render: (o) => <BadgeEstado estado={o.estado} /> },
  ];

  const commonInputStyle = { padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid #d1d5db", fontSize: "0.875rem", outline: "none", width: "100%", boxSizing: "border-box" };

  return (
    <>
      {vistaActual === "listado" && (
        <div>
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
            <div>
              <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>Órdenes de Compra</h1>
            </div>
            <button onClick={() => { setNuevaOrden({ id_proveedor: "", id_condicion_pago: "", plazo_dias: "" }); setDetalles([]); setVistaActual("creacion"); }} style={{ backgroundColor: "#65482b", color: "#ffffff", border: "none", padding: "0.625rem 1.25rem", borderRadius: "0.5rem", fontWeight: "600", display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
              <Plus size={18} /> Nueva Orden
            </button>
          </header>
          
          <div style={{ position: "relative", marginBottom: "1.5rem" }}>
            <Search size={18} style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ width: "100%", padding: "0.625rem 0.625rem 0.625rem 2.5rem", borderRadius: "0.5rem", border: "1px solid #d1d5db" }} />
          </div>

          <DataTable columns={columns} data={ordenes.filter(o => o.numero_orden?.toLowerCase().includes(searchTerm.toLowerCase()) || o.proveedor?.razon_social?.toLowerCase().includes(searchTerm.toLowerCase()))} onEdit={handleVerOrden} />
        </div>
      )}

      {vistaActual === "creacion" && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", padding: "2rem", border: "1px solid #e5e7eb" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", margin: 0 }}>Emitir Orden</h2>
            <button onClick={() => setVistaActual("listado")} style={{ background: "transparent", border: "none", fontWeight: "600", cursor: "pointer" }}><ArrowLeft size={18} /> Volver</button>
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
          </div>

          <div style={{ marginBottom: "2rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: "600", marginBottom: "1rem" }}>Artículos</h3>
            {detalles.map((det, index) => (
              <div key={index} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr 1fr auto", gap: "1rem", alignItems: "center", marginBottom: "0.75rem" }}>
                <select style={commonInputStyle} value={det.id_articulo} onChange={(e) => actualizarFila(index, "id_articulo", e.target.value)}>
                  <option value="">Seleccionar artículo...</option>
                  {articulos.map(a => <option key={a.id_articulo} value={a.id_articulo}>{a.nombre}</option>)}
                </select>
                <input type="number" min="1" placeholder="Cant" style={commonInputStyle} value={det.cantidad_solicitada} onChange={(e) => actualizarFila(index, "cantidad_solicitada", e.target.value)} />
                <input type="number" step="any" placeholder="Precio U" style={commonInputStyle} value={det.precio_unitario} onChange={(e) => actualizarFila(index, "precio_unitario", e.target.value)} />
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

      {vistaActual === "seguimiento" && ordenSeleccionada && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "0.75rem", padding: "2rem", border: "1px solid #e5e7eb" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <div>
              <h2 style={{ fontSize: "1.5rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "1rem" }}>
                Orden {ordenSeleccionada.numero_orden}
                <BadgeEstado estado={ordenSeleccionada.estado} />
              </h2>
              <p>Proveedor: {ordenSeleccionada.proveedor?.razon_social}</p>
            </div>
            <button onClick={() => setVistaActual("listado")} style={{ background: "transparent", border: "none", fontWeight: "600", cursor: "pointer" }}><ArrowLeft size={18} /> Volver</button>
          </div>

          <div style={{ marginBottom: "2.5rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
              <thead style={{ backgroundColor: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <tr>
                  <th style={{ padding: "0.75rem" }}>Artículo</th>
                  <th style={{ padding: "0.75rem", textAlign: "center" }}>Solicitado</th>
                  <th style={{ padding: "0.75rem", textAlign: "center" }}>Ya Recibido</th>
                  <th style={{ padding: "0.75rem", textAlign: "center", backgroundColor: "#e0f2fe" }}>Ingresar Recepción</th>
                </tr>
              </thead>
              <tbody>
                {detallesSeguimiento.map((det, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "0.75rem" }}>{det.articulo?.nombre}</td>
                    <td style={{ padding: "0.75rem", textAlign: "center" }}>{det.cantidad_solicitada}</td>
                    <td style={{ padding: "0.75rem", textAlign: "center", fontWeight: "bold" }}>{det.cantidad_recibida}</td>
                    
                    <td style={{ padding: "0.5rem", backgroundColor: "#f0f9ff", textAlign: "center" }}>
                      <input 
                        type="number" 
                        min="0" 
                        max={det.cantidad_solicitada - det.cantidad_recibida}
                        value={det.input_recepcion} 
                        onChange={(e) => actualizarInputRecepcion(idx, e.target.value)}
                        disabled={ordenSeleccionada.estado !== "Emitida"}
                        style={{ ...commonInputStyle, 
                            width: "80px", 
                            textAlign: "center",
                            backgroundColor: ordenSeleccionada.estado !== "Emitida" ? "transparent" : "#ffffff" }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {ordenSeleccionada.estado === "Emitida" && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
                    <button 
                    onClick={handleConfirmarRecepcion} 
                    style={{ backgroundColor: "#0284c7", color: "#ffffff", border: "none", padding: "0.75rem", borderRadius: "0.5rem", fontWeight: "600", cursor: "pointer" }}
                    >
                    <CheckCircle size={18} style={{ marginRight: '8px' }} /> Confirmar Recepción
                    </button>
                </div>
                )}
          </div>

          {(ordenSeleccionada.estado === "Recibida" || ordenSeleccionada.estado === "Facturada") && (
             <div style={{ backgroundColor: "#f8fafc", padding: "1.5rem", borderRadius: "0.5rem", border: "1px solid #cbd5e1" }}>
               <h3 style={{ fontSize: "1.125rem", fontWeight: "600", display: "flex", alignItems: "center" }}>
                 <FileText size={20} style={{ marginRight: '8px' }}/> Vinculación de Factura
               </h3>
               <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
                 La creación de la factura requiere tener lista la HU30. 
               </p>
               <button onClick={handleVincularFacturaMock} style={{ backgroundColor: "#16a34a", color: "#ffffff", border: "none", padding: "0.75rem", borderRadius: "0.5rem", fontWeight: "600", cursor: "pointer", marginTop: "1rem" }}>
                 Simular Vinculación (Mock)
               </button>
             </div>
          )}
        </div>
      )}
    </>
  );
}