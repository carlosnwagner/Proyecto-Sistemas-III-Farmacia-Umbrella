import { useState, useEffect, useMemo } from 'react';
import { 
  getFacturasParaNota, 
  createNotaCreditoDebito, 
  getNotasPorFactura,
  downloadNotaPdf,
  TIPOS_NOTA 
} from '../services/notasCreditoDebito';
import { supabase } from '../lib/supabase.js';
import { showAlert } from '../lib/alerts.js';
import { FileText, History, Download, ArrowLeft } from 'lucide-react';
import '../App.css';

const TIPOS_NOTA_SEGURO = TIPOS_NOTA && TIPOS_NOTA.length > 0 
  ? TIPOS_NOTA 
  : ['Crédito', 'Débito'];

function Badge({ children, variant = "default" }) {
  const styles = {
    default: { backgroundColor: "#f3f4f6", color: "#374151" },
    success: { backgroundColor: "#166534", color: "#ffffff" },
    warning: { backgroundColor: "#dcfce7", color: "#166534" },
    danger: { backgroundColor: "#fee2e2", color: "#991b1b" },
    primary: { backgroundColor: "#e0f2fe", color: "#075985" },
  };
  return (
    <span
      style={{
        padding: "0.25rem 0.625rem",
        borderRadius: "9999px",
        fontSize: "0.75rem",
        fontWeight: "600",
        display: "inline-flex",
        alignItems: "center",
        ...styles[variant],
      }}
    >
      {children}
    </span>
  );
}

export default function RegistrarNotaCreditoDebito() {
  const [cargando, setCargando] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [selectedProveedorId, setSelectedProveedorId] = useState('');
  const [facturas, setFacturas] = useState([]);
  
  const [facturaElegida, setFacturaElegida] = useState(null);
  const [tipoNota, setTipoNota] = useState(TIPOS_NOTA_SEGURO[0]);
  const [numeroComprobanteNota, setNumeroComprobanteNota] = useState('');
  const [fecha, setFecha] = useState(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  });
  const [importe, setImporte] = useState('');
  const [notasAplicadas, setNotasAplicadas] = useState([]);

  const validarFormatoComprobante = (valor) => {
    if (!valor) return false;
    const regex = /^[A-Z]?\s?\d{4}-\d{8}$/;
    return regex.test(valor.trim());
  };

  async function loadCatalogos() {
    setCargando(true);
    const [provRes, factRes] = await Promise.all([
      supabase.from("proveedor").select("id_proveedor, razon_social, identificacion_fiscal, estado").eq("estado", true).order("razon_social"),
      getFacturasParaNota()
    ]);

    if (provRes.data) setProveedores(provRes.data);
    if (factRes.data) setFacturas(factRes.data || []);
    setCargando(false);
  }

  useEffect(() => {
    loadCatalogos();
  }, []);

  const facturasProveedor = useMemo(() => {
    if (!selectedProveedorId) return [];
    return facturas.filter(f => String(f.id_proveedor) === String(selectedProveedorId));
  }, [facturas, selectedProveedorId]);

  const cargarNotasHistorial = async (idFact) => {
    const { data } = await getNotasPorFactura(idFact);
    setNotasAplicadas(data || []);
  };

  const handleSeleccionarFactura = async (f) => {
    setFacturaElegida(f);
    setImporte('');
    
    // Autocompletado inteligente con espacio reglamentario (ej: "A 0005-00000003")
    const tipo = f.tipo_factura || 'A';
    const pv = String(f.punto_venta || 1).padStart(4, '0');
    const numOriginal = parseInt(f.numero_comprobante || f.id_factura_proveedor, 10) || 1;
    const siguienteNum = String(numOriginal + 1).padStart(8, '0');
    
    setNumeroComprobanteNota(`${tipo} ${pv}-${siguienteNum}`);
    await cargarNotasHistorial(f.id_factura_proveedor);
  };

  const saldoPendienteFactura = facturaElegida ? Number(facturaElegida.saldo_pendiente || 0) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!numeroComprobanteNota.trim()) {
      return showAlert.errorSave('El número de comprobante es obligatorio.');
    }
    if (!validarFormatoComprobante(numeroComprobanteNota)) {
      return showAlert.errorSave('Formato inválido. Usá: A 0001-00000001');
    }

    const facturaOriginalStr = `${facturaElegida.tipo_factura || ''} ${String(facturaElegida.punto_venta || 1).padStart(4, '0')}-${String(facturaElegida.numero_comprobante || facturaElegida.id_factura_proveedor).padStart(8, '0')}`.trim();
    if (numeroComprobanteNota.trim().toLowerCase() === facturaOriginalStr.toLowerCase()) {
      return showAlert.errorSave('La nota no puede tener exactamente el mismo número que la factura original.');
    }

    const importeNum = Number(importe);
    if (!importe || importeNum <= 0) {
      return showAlert.errorSave('Importe debe ser mayor a $0.');
    }

    if (tipoNota === 'Crédito' && importeNum > saldoPendienteFactura) {
      return showAlert.errorSave(`La Nota de Crédito no puede superar el saldo pendiente ($${saldoPendienteFactura.toFixed(2)}).`);
    }

    setCargando(true);
    try {
      const resultado = await createNotaCreditoDebito({
        id_factura_proveedor: facturaElegida.id_factura_proveedor,
        tipo_nota: tipoNota,
        numero_comprobante: numeroComprobanteNota.trim(),
        fecha,
        importe: importeNum
      });

      if (resultado.error) throw new Error(resultado.error.message || 'Error al guardar');

      showAlert.successSave(`Nota de ${tipoNota} registrada correctamente.`);
      
      // Actualizamos las facturas en memoria y redirigimos al listado del proveedor
      const factRes = await getFacturasParaNota();
      if (factRes.data) {
        setFacturas(factRes.data);
      }
      
      setFacturaElegida(null);
      setImporte('');
      setNumeroComprobanteNota('');
    } catch (err) {
      console.error('Error guardando nota:', err);
      showAlert.errorSave(err.message || 'Ocurrió un error al guardar');
    } finally {
      setCargando(false);
    }
  };

  const formatearComprobante = (f) => {
    const tipo = f.tipo_factura || '';
    const pv = String(f.punto_venta || 1).padStart(4, '0');
    const num = String(f.numero_comprobante || f.id_factura_proveedor).padStart(8, '0');
    return `${tipo} ${pv}-${num}`.trim();
  };

  const inputStyle = {
    width: "100%",
    padding: "0.625rem 0.75rem",
    borderRadius: "0.5rem",
    border: "1px solid #d1d5db",
    boxSizing: "border-box",
    fontSize: "0.875rem",
    outline: "none",
    backgroundColor: "#fff",
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.9rem', fontWeight: '700', color: '#111827' }}>
            Registro de Notas de Crédito / Débito
          </h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0' }}>
            Selección por proveedor — Corrección y actualización de saldos en tiempo real
          </p>
        </div>
      </header>

      {/* PASO 1: Selección de Proveedor y Facturas */}
      {!facturaElegida && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ maxWidth: '450px', marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.4rem' }}>
              Seleccionar Proveedor *
            </label>
            <select
              value={selectedProveedorId}
              onChange={(e) => setSelectedProveedorId(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">-- Elija un proveedor para ver sus facturas --</option>
              {proveedores.map((p) => (
                <option key={p.id_proveedor} value={p.id_proveedor}>
                  {p.razon_social} ({p.identificacion_fiscal || "Sin CUIT"})
                </option>
              ))}
            </select>
          </div>

          {selectedProveedorId && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#111827', marginBottom: '1rem' }}>
                Facturas del Proveedor
              </h3>
              {facturasProveedor.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Este proveedor no registra facturas emitidas.</p>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                    <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <tr>
                        <th style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Comprobante</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Estado</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Total</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Saldo Pendiente</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facturasProveedor.map((f) => (
                        <tr key={f.id_factura_proveedor} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: '0.75rem', fontWeight: '600', color: '#111827' }}>
                            {formatearComprobante(f)}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <Badge variant={f.estado === 'Pagada' ? 'success' : f.estado === 'Pagada Parcial' ? 'warning' : 'primary'}>
                              {f.estado}
                            </Badge>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>
                            ${Number(f.importe_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '700', color: f.saldo_pendiente > 0 ? '#b45309' : '#166534' }}>
                            ${Number(f.saldo_pendiente).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleSeleccionarFactura(f)}
                              style={{ backgroundColor: '#65482b', color: '#fff', border: 0, padding: '0.4rem 0.8rem', borderRadius: '0.375rem', fontWeight: '600', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              Seleccionar para Nota
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PASO 2: Formulario de Registro y Descarga PDF */}
      {facturaElegida && (
        <div>
          <button
            type="button"
            onClick={() => setFacturaElegida(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: '1px solid #d1d5db', padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer', marginBottom: '1.5rem', color: '#374151' }}
          >
            <ArrowLeft size={16} /> Volver a lista de facturas del proveedor
          </button>

          <div style={{ backgroundColor: '#f9fafb', padding: '1.25rem', borderRadius: '0.75rem', marginBottom: '1.5rem', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} /> Factura Seleccionada: {formatearComprobante(facturaElegida)}
              </h3>
              {saldoPendienteFactura > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTipoNota('Crédito');
                    setImporte(saldoPendienteFactura.toString());
                  }}
                  style={{ backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', padding: '0.35rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  Cancelar Saldo Total (${saldoPendienteFactura.toLocaleString('es-AR', { minimumFractionDigits: 2 })})
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Proveedor</span>
                <p style={{ fontWeight: 600, margin: '0.25rem 0 0 0' }}>{facturaElegida.proveedor?.razon_social || '-'}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Total Factura</span>
                <p style={{ fontWeight: 700, color: '#111827', margin: '0.25rem 0 0 0' }}>${Number(facturaElegida.importe_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Saldo Pendiente Actual</span>
                <p style={{ fontWeight: 700, color: saldoPendienteFactura > 0 ? '#dc2626' : '#166534', margin: '0.25rem 0 0 0' }}>${saldoPendienteFactura.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            {/* Historial y descarga de notas */}
            {notasAplicadas.length > 0 && (
              <div style={{ marginTop: '1.25rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4b5563', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  <History size={14} /> Notas Registradas en este Comprobante:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {notasAplicadas.map((n) => (
                    <div key={n.id_nota} style={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db', borderRadius: '0.375rem', padding: '0.5rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div>
                        <strong style={{ color: n.tipo_nota === 'Crédito' ? '#166534' : '#dc2626' }}>{n.tipo_nota}:</strong> {n.numero_comprobante} ({n.fecha}) — <b>${Number(n.importe).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</b>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadNotaPdf(n, facturaElegida, facturaElegida.proveedor)}
                        title="Descargar comprobante PDF"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#65482b', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: '600' }}
                      >
                        <Download size={14} /> PDF
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151', fontSize: '0.875rem' }}>
                    Tipo de Nota *
                  </label>
                  <select
                    value={tipoNota}
                    onChange={(e) => setTipoNota(e.target.value)}
                    style={inputStyle}
                  >
                    {TIPOS_NOTA_SEGURO.map(tipo => (
                      <option key={tipo} value={tipo}>
                        {tipo === 'Crédito' ? 'Nota de Crédito — Reduce el saldo' : 'Nota de Débito — Aumenta el saldo'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151', fontSize: '0.875rem' }}>
                    Nº Comprobante de la Nota * <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.75rem' }}>(Autocompletado, modificable)</span>
                  </label>
                  <input
                    type="text"
                    value={numeroComprobanteNota}
                    onChange={(e) => setNumeroComprobanteNota(e.target.value)}
                    style={{ ...inputStyle, border: numeroComprobanteNota && !validarFormatoComprobante(numeroComprobanteNota) ? '2px solid #dc2626' : undefined }}
                    placeholder="Ej: A 0001-00000002"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151', fontSize: '0.875rem' }}>
                    Fecha de Emisión *
                  </label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151', fontSize: '0.875rem' }}>
                    Importe de la Nota $ * {tipoNota === 'Crédito' && <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.75rem' }}>(Máx: ${saldoPendienteFactura.toFixed(2)})</span>}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={tipoNota === 'Crédito' ? saldoPendienteFactura : undefined}
                    value={importe}
                    onChange={(e) => setImporte(e.target.value)}
                    style={{ ...inputStyle, border: tipoNota === 'Crédito' && Number(importe) > saldoPendienteFactura ? '2px solid #dc2626' : undefined }}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {importe && Number(importe) > 0 && (
                <div style={{ padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', backgroundColor: tipoNota === 'Crédito' ? '#eff6ff' : '#fef2f2', border: `1px solid ${tipoNota === 'Crédito' ? '#bfdbfe' : '#fecaca'}` }}>
                  <strong>Efecto en Cuenta Corriente:</strong>
                  <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.9rem' }}>
                    {tipoNota === 'Crédito' 
                      ? `HABER — Se reduce el saldo del proveedor en $${Number(importe).toFixed(2)}`
                      : `DEBE — Se aumenta el saldo del proveedor en $${Number(importe).toFixed(2)}`
                    }
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setFacturaElegida(null)}
                  style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  style={{ backgroundColor: '#65482b', color: '#fff', border: 0, borderRadius: '0.5rem', padding: '0.625rem 1.5rem', fontWeight: '700', cursor: cargando ? 'wait' : 'pointer' }}
                >
                  {cargando ? 'Registrando...' : 'Registrar Nota y Habilitar PDF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
