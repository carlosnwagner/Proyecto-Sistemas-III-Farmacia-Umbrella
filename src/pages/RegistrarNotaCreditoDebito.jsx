import { useState, useEffect } from 'react';
import { 
  getFacturasParaNota,
  createNotaCreditoDebito,
  TIPOS_NOTA
} from '../services/notasCreditoDebito';
import '../App.css';

export default function RegistrarNotaCreditoDebito() {
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(false);

  const [idFactura, setIdFactura] = useState('');
  const [tipoNota, setTipoNota] = useState('');
  const [numeroComprobante, setNumeroComprobante] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [importe, setImporte] = useState('');

  const [exito, setExito] = useState(null);
  const [errores, setErrores] = useState({});

  useEffect(() => {
    const cargarFacturas = async () => {
      setCargando(true);
      const res = await getFacturasParaNota();
      if (!res.error) setFacturas(res.data);
      setCargando(false);
    };
    cargarFacturas();
  }, []);

  const manejarSubmit = async (e) => {
    e.preventDefault();
    setErrores({}); setExito(null); setCargando(true);

    const payload = {
      id_factura_proveedor: Number(idFactura),
      tipo_nota: tipoNota,
      numero_comprobante: numeroComprobante,
      fecha: fecha,
      importe: importe
    };

    const { data, error } = await createNotaCreditoDebito(payload);

    if (error) {
      if (error.fieldErrors) setErrores(error.fieldErrors);
      else if (error.field) setErrores({ [error.field]: error.message });
      else setErrores({ general: error.message });
    } else {
      setExito(`✅ Nota de ${data.tipo_nota} registrada correctamente. N° ${data.numero_comprobante} | Importe: $${data.importe.toFixed(2)}`);
      setIdFactura(''); setTipoNota(''); setNumeroComprobante('');
      setFecha(new Date().toISOString().split('T')[0]); setImporte('');
    }
    setCargando(false);
  };

  const facturaSeleccionada = facturas.find(f => f.id_factura_proveedor === Number(idFactura));

  return (
    <>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>Registrar Nota de Crédito / Débito</h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>Corregir o ajustar una factura de proveedor</p>
        </div>
      </header>

      {exito && <div style={{ backgroundColor: "#E8A83820", color: "#92400e", padding: "0.75rem 1rem", borderRadius: "0.5rem", marginBottom: "1.5rem", border: "1px solid #E8A83840" }}>{exito}</div>}
      {errores.general && <div style={{ backgroundColor: "#D65C4F20", color: "#b91c1c", padding: "0.75rem 1rem", borderRadius: "0.5rem", marginBottom: "1.5rem", border: "1px solid #D65C4F40" }}>{errores.general}</div>}

      <div style={{ backgroundColor: "#fff", borderRadius: "0.75rem", padding: "1.5rem", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <form onSubmit={manejarSubmit}>
          
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontWeight: "500", marginBottom: "0.5rem", color: "#374151" }}>Factura a corregir *</label>
            <select 
              value={idFactura}
              onChange={(e) => setIdFactura(e.target.value)}
              required
              disabled={cargando}
              style={{ width: "100%", padding: "0.625rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none" }}
            >
              <option value="">-- Seleccionar factura --</option>
              {facturas.map(f => (
                <option key={f.id_factura_proveedor} value={f.id_factura_proveedor}>
                  N° {f.numero_comprobante} · {f.proveedor?.razon_social} · Total: ${f.importe_total.toFixed(2)}
                </option>
              ))}
            </select>
            {errores.id_factura_proveedor && <span style={{ color: "#D65C4F", fontSize: "0.875rem", marginTop: "0.25rem", display: "block" }}>{errores.id_factura_proveedor}</span>}
            
            {facturaSeleccionada && (
              <p style={{ marginTop:'0.5rem', color:'#65482b', fontWeight:'600' }}>
                ✅ Proveedor asociado: {facturaSeleccionada.proveedor?.razon_social}
              </p>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <label style={{ display: "block", fontWeight: "500", marginBottom: "0.5rem", color: "#374151" }}>Tipo de Nota *</label>
              <select 
                value={tipoNota}
                onChange={(e) => setTipoNota(e.target.value)}
                required
                disabled={cargando}
                style={{ width: "100%", padding: "0.625rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none" }}
              >
                <option value="">-- Tipo --</option>
                {TIPOS_NOTA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {errores.tipo_nota && <span style={{ color: "#D65C4F", fontSize: "0.875rem", marginTop: "0.25rem", display: "block" }}>{errores.tipo_nota}</span>}
            </div>

            <div>
              <label style={{ display: "block", fontWeight: "500", marginBottom: "0.5rem", color: "#374151" }}>Fecha de Emisión *</label>
              <input 
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
                disabled={cargando}
                style={{ width: "100%", padding: "0.625rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none" }}
              />
              {errores.fecha && <span style={{ color: "#D65C4F", fontSize: "0.875rem", marginTop: "0.25rem", display: "block" }}>{errores.fecha}</span>}
            </div>
          </div>

          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", fontWeight: "500", marginBottom: "0.5rem", color: "#374151" }}>Número de Comprobante de la Nota *</label>
            <input 
              type="text"
              value={numeroComprobante}
              onChange={(e) => setNumeroComprobante(e.target.value)}
              required
              placeholder="Ej: NC-001 / ND-001"
              disabled={cargando}
              style={{ width: "100%", padding: "0.625rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none" }}
            />
            {errores.numero_comprobante && <span style={{ color: "#D65C4F", fontSize: "0.875rem", marginTop: "0.25rem", display: "block" }}>{errores.numero_comprobante}</span>}
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", fontWeight: "500", marginBottom: "0.5rem", color: "#374151" }}>Importe de la Nota ($) *</label>
            <input 
              type="number"
              step="0.01"
              min="0.01"
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              required
              placeholder="0.00"
              disabled={cargando}
              style={{ width: "100%", padding: "0.625rem", borderRadius: "0.5rem", border: "1px solid #d1d5db", outline: "none" }}
            />
            {errores.importe && <span style={{ color: "#D65C4F", fontSize: "0.875rem", marginTop: "0.25rem", display: "block" }}>{errores.importe}</span>}
          </div>

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
            {cargando ? 'Guardando...' : 'Registrar Nota'}
          </button>
        </form>
      </div>
    </>
  );
}