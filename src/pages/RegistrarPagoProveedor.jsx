import { useState, useEffect } from 'react';
import { 
  getFacturasPendientesPorProveedor, 
  createPagoProveedor 
} from '../services/pagos';
import '../App.css';

const MEDIOS_PAGO = ['Efectivo', 'Transferencia', 'Cheque'];

export default function RegistrarPagoProveedor() {
  const [proveedores, setProveedores] = useState([]);
  const [idProveedor, setIdProveedor] = useState('');
  const [fechaPago, setFechaPago] = useState(() => new Date().toISOString().split('T')[0]);
  const [medioPago, setMedioPago] = useState('');
  const [facturas, setFacturas] = useState([]);
  const [aplicaciones, setAplicaciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(null);
  const [errores, setErrores] = useState({});

  useEffect(() => {
    const cargarProveedores = async () => {
      const { supabase } = await import('../lib/supabase');
      const { data, error } = await supabase
        .from('proveedores')
        .select('id_proveedor, nombre, cuit')
        .order('nombre');
      if (!error) setProveedores(data);
    };
    cargarProveedores();
  }, []);

  useEffect(() => {
    if (!idProveedor) {
      setFacturas([]);
      setAplicaciones([]);
      return;
    }
    const cargarFacturas = async () => {
      setCargando(true);
      const res = await getFacturasPendientesPorProveedor(Number(idProveedor));
      setFacturas(res.data);
      setAplicaciones([]);
      setCargando(false);
    };
    cargarFacturas();
  }, [idProveedor]);

  const actualizarImporte = (idFactura, valor) => {
    const importe = Number(valor);
    setAplicaciones(prev => {
      const existe = prev.find(a => a.id_factura_proveedor === idFactura);
      if (importe <= 0) return prev.filter(a => a.id_factura_proveedor !== idFactura);
      if (existe) return prev.map(a => a.id_factura_proveedor === idFactura ? {...a, importe_aplicado: importe} : a);
      return [...prev, {id_factura_proveedor: idFactura, importe_aplicado: importe}];
    });
  };

  const manejarSubmit = async (e) => {
    e.preventDefault();
    setErrores({}); setExito(null); setCargando(true);

    const payload = {
      id_proveedor: Number(idProveedor),
      fecha_pago: fechaPago,
      medio_pago: medioPago,
      aplicaciones: aplicaciones
    };

    const { data, error } = await createPagoProveedor(payload);

    if (error) {
      if (error.fieldErrors) setErrores(error.fieldErrors);
      else if (error.field) setErrores({ [error.field]: error.message });
      else setErrores({ general: error.message });
    } else {
      setExito(`✅ Pago registrado correctamente (N° ${data?.id_pago || ''}). Egreso generado.`);
      setIdProveedor(''); setFechaPago(new Date().toISOString().split('T')[0]);
      setMedioPago(''); setAplicaciones([]); setFacturas([]);
    }
    setCargando(false);
  };

  const importeTotal = aplicaciones.reduce((suma, a) => suma + a.importe_aplicado, 0).toFixed(2);

  return (
    <>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>Registrar Pago a Proveedor</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>Complete los datos para registrar y aplicar el pago</p>
        </div>
      </header>

      {exito && <div style={{ backgroundColor: "#E8A83820", color: "#92400e", padding: "0.75rem 1rem", borderRadius: "0.5rem", marginBottom: "1.5rem", border: "1px solid #E8A83840" }}>{exito}</div>}
      {errores.general && <div style={{ backgroundColor: "#D65C4F20", color: "#b91c1c", padding: "0.75rem 1rem", borderRadius: "0.5rem", marginBottom: "1.5rem", border: "1px solid #D65C4F40" }}>{errores.general}</div>}

      <div style={{ backgroundColor: "#fff", borderRadius: "0.75rem", padding: "1.5rem", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <form onSubmit={manejarSubmit}>
          {/* Proveedor */}
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontWeight: "500", marginBottom: "0.5rem", color: "#374151" }}>Proveedor *</label>
            <select 
              value={idProveedor} 
              onChange={(e) => setIdProveedor(e.target.value)} 
              required
              style={{ width: "100%", padding: "0.625rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none" }}
            >
              <option value="">-- Seleccionar proveedor --</option>
              {proveedores.map(p => (
                <option key={p.id_proveedor} value={p.id_proveedor}>
                  {p.nombre} · CUIT {p.cuit}
                </option>
              ))}
            </select>
            {errores.id_proveedor && <span style={{ color: "#D65C4F", fontSize: "0.875rem", marginTop: "0.25rem", display: "block" }}>{errores.id_proveedor}</span>}
          </div>

          {/* Fila Fecha + Medio de Pago */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: "500", marginBottom: "0.5rem", color: "#374151" }}>Fecha de Pago *</label>
              <input 
                type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} required
                style={{ width: "100%", padding: "0.625rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none" }}
              />
              {errores.fecha_pago && <span style={{ color: "#D65C4F", fontSize: "0.875rem", marginTop: "0.25rem", display: "block" }}>{errores.fecha_pago}</span>}
            </div>

            <div>
              <label style={{ display: "block", fontWeight: "500", marginBottom: "0.5rem", color: "#374151" }}>Medio de Pago *</label>
              <select 
                value={medioPago} onChange={(e) => setMedioPago(e.target.value)} required
                style={{ width: "100%", padding: "0.625rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none" }}
              >
                <option value="">-- Seleccionar medio --</option>
                {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              {errores.medio_pago && <span style={{ color: "#D65C4F", fontSize: "0.875rem", marginTop: "0.25rem", display: "block" }}>{errores.medio_pago}</span>}
            </div>
          </div>

          {/* Tabla de facturas pendientes */}
          <div style={{ marginBottom: "1.25rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: "600", color: "#374151", marginBottom: "0.75rem" }}>Facturas Pendientes / Saldo</h3>
            {cargando ? (
              <p style={{ color: "#6b7280" }}>Cargando facturas...</p>
            ) : facturas.length === 0 ? (
              <p style={{ color: "#6b7280" }}>El proveedor no tiene facturas pendientes o parciales.</p>
            ) : (
              <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: "0.5rem" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f9fafb" }}>
                      <th style={{ padding: "0.75rem", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>N° Comprobante</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Fecha</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Importe Total</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Saldo Pendiente</th>
                      <th style={{ padding: "0.75rem", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>Importe a Aplicar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.map(f => (
                      <tr key={f.id_factura_proveedor}>
                        <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{f.numero_comprobante}</td>
                        <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>{new Date(f.fecha).toLocaleDateString('es-AR')}</td>
                        <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>${f.importe_total.toFixed(2)}</td>
                        <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb", fontWeight: "600" }}>${f.saldo_pendiente.toFixed(2)}</td>
                        <td style={{ padding: "0.75rem", borderBottom: "1px solid #e5e7eb" }}>
                          <input
                            type="number" step="0.01" min="0" max={f.saldo_pendiente}
                            placeholder="$ 0.00"
                            value={aplicaciones.find(a => a.id_factura_proveedor === f.id_factura_proveedor)?.importe_aplicado || ''}
                            onChange={(e) => actualizarImporte(f.id_factura_proveedor, e.target.value)}
                            style={{ width: "100px", padding: "0.375rem 0.5rem", borderRadius: "0.375rem", border: "1px solid #d1d5db" }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {errores.aplicaciones && <span style={{ color: "#D65C4F", fontSize: "0.875rem", marginTop: "0.5rem", display: "block" }}>{errores.aplicaciones}</span>}
          </div>

          {/* Tarjeta importe total */}
          <div style={{ backgroundColor: "#f9fafb", padding: "1rem 1.25rem", borderRadius: "0.5rem", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <span style={{ fontSize: "0.875rem", color: "#6b7280" }}>Importe Total del Pago</span>
              <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#65482b" }}>${importeTotal}</div>
            </div>
            <small style={{ color: "#9ca3af", fontSize: "0.75rem" }}>Calculado automáticamente</small>
          </div>

          {/* Botón */}
          <button 
            type="submit" 
            disabled={cargando}
            style={{
              backgroundColor: "#65482b",
              color: "#ffffff",
              border: "none",
              padding: "0.625rem 1.5rem",
              borderRadius: "0.5rem",
              fontWeight: "600",
              fontSize: "1rem",
              cursor: cargando ? "not-allowed" : "pointer",
              opacity: cargando ? 0.7 : 1,
              width: "100%",
            }}
          >
            {cargando ? 'Guardando...' : '✓ Confirmar y Registrar Pago'}
          </button>
        </form>
      </div>
    </>
  );
}