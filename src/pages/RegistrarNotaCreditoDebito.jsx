import { useState, useEffect } from 'react';
import { 
  getFacturasParaNota, 
  createNotaCreditoDebito, 
  TIPOS_NOTA 
} from '../services/notasCreditoDebito';
import { showAlert } from '../lib/alerts.js';
import { FileText } from 'lucide-react';
import '../App.css';

const TIPOS_NOTA_SEGURO = TIPOS_NOTA && TIPOS_NOTA.length > 0 
  ? TIPOS_NOTA 
  : ['Crédito', 'Débito'];

export default function RegistrarNotaCreditoDebito() {
  const [cargando, setCargando] = useState(false);
  const [facturas, setFacturas] = useState([]);
  
  const [idFacturaSeleccionada, setIdFacturaSeleccionada] = useState('');
  const [tipoNota, setTipoNota] = useState(TIPOS_NOTA_SEGURO[0]);
  const [numeroComprobanteNota, setNumeroComprobanteNota] = useState('');
  const [fecha, setFecha] = useState(() => {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
  });
  const [importe, setImporte] = useState('');
  const [facturaElegida, setFacturaElegida] = useState(null);

  const validarFormatoComprobante = (valor) => {
    if (!valor) return false;
    const regex = /^[A-Z]?\s?\d{4}-\d{8}$/;
    return regex.test(valor.trim());
  };

  const cargarFacturas = async () => {
    setCargando(true);
    try {
      const { data, error } = await getFacturasParaNota();
      if (error) throw new Error(error.message);
      setFacturas(data || []);
    } catch (err) {
      console.error('Error cargando facturas:', err);
      showAlert.errorSave('No se pudieron cargar las facturas: ' + err.message);
      setFacturas([]);
    } finally {
      setCargando(false);
    }
  };

  const saldoPendienteFactura = facturaElegida 
    ? Number(facturaElegida.saldo_pendiente || 0)
    : 0;

  useEffect(() => {
    cargarFacturas();
  }, []);

  useEffect(() => {
    if (!idFacturaSeleccionada) {
      setFacturaElegida(null);
      return;
    }
    const factura = facturas.find(f => f.id_factura_proveedor === Number(idFacturaSeleccionada));
    setFacturaElegida(factura || null);
    setImporte('');
  }, [idFacturaSeleccionada, facturas]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!numeroComprobanteNota.trim()) {
      return showAlert.errorSave('El número de comprobante es obligatorio.');
    }
    if (!validarFormatoComprobante(numeroComprobanteNota)) {
      return showAlert.errorSave('Formato inválido. Usá: A 0001-00000001 (Letra + Punto de Venta + Nº)');
    }

    const importeNum = Number(importe);
    if (!importe || importeNum <= 0) {
      return showAlert.errorSave('El importe debe ser mayor a $0.');
    }

    if (tipoNota === 'Crédito' && importeNum > saldoPendienteFactura) {
      return showAlert.errorSave(
        `Nota de Crédito no puede superar el saldo pendiente ($${saldoPendienteFactura.toFixed(2)}).`
      );
    }

    setCargando(true);
    try {
      const idFacturaNum = Number(idFacturaSeleccionada);
      
      const resultado = await createNotaCreditoDebito({
        id_factura_proveedor: idFacturaNum,
        tipo_nota: tipoNota,
        numero_comprobante: numeroComprobanteNota.trim(),
        fecha,
        importe: importeNum
      });

      if (resultado.error) throw new Error(resultado.error.message || 'Error al guardar');

      showAlert.successSave(`Nota de ${tipoNota} registrada correctamente.`);
      
      setIdFacturaSeleccionada('');
      setNumeroComprobanteNota('');
      setImporte('');
      setFecha(() => {
        const hoy = new Date();
        return `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
      });
      
      await cargarFacturas();
      
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

  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="titulo-pagina" style={{ margin: 0, fontSize: '1.9rem' }}>
            Registro de Notas de Crédito / Débito
          </h1>
          <p className="subtitulo" style={{ margin: '0.25rem 0 0' }}>
            Corrección de comprobantes — Actualización automática de saldos
          </p>
        </div>
      </header>

      {facturaElegida && (
        <div style={{ backgroundColor: '#f9fafb', padding: '1.25rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid #e5e7eb' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} /> Factura Seleccionada
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Comprobante</span>
              <p style={{ fontWeight: 600, margin: '0.25rem 0 0 0' }}>
                {formatearComprobante(facturaElegida)}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Proveedor</span>
              <p style={{ fontWeight: 600, margin: '0.25rem 0 0 0' }}>
                {facturaElegida.proveedor?.razon_social || '-'}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Total Factura</span>
              <p style={{ fontWeight: 700, color: '#111827', margin: '0.25rem 0 0 0' }}>
                ${Number(facturaElegida.importe_total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Saldo Pendiente</span>
              <p style={{ fontWeight: 700, color: saldoPendienteFactura > 0 ? '#dc2626' : '#166534', margin: '0.25rem 0 0 0' }}>
                ${saldoPendienteFactura.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="tarjeta-formulario" style={{ width: '100%', boxSizing: 'border-box' }}>
        <form onSubmit={handleSubmit}>
          
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
              Factura a corregir *
            </label>
            <select
              value={idFacturaSeleccionada}
              onChange={(e) => setIdFacturaSeleccionada(e.target.value)}
              className="select-proveedor"
              required
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
            >
              <option value="">-- Seleccioná una factura --</option>
              {facturas.map(f => (
                <option key={f.id_factura_proveedor} value={f.id_factura_proveedor}>
                  {formatearComprobante(f)}
                  — {f.proveedor?.razon_social || 'Sin proveedor'}
                  — ${Number(f.importe_total).toFixed(2)}
                  {f.saldo_pendiente === 0 ? ' — Pagada' : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
              Tipo de Nota *
            </label>
            <select
              value={tipoNota}
              onChange={(e) => setTipoNota(e.target.value)}
              className="select-proveedor"
              style={{ width: '100%', padding: '0.5rem', boxSizing: 'border-box' }}
            >
              {TIPOS_NOTA_SEGURO.map(tipo => (
                <option key={tipo} value={tipo}>
                  {tipo === 'Crédito' 
                    ? 'Nota de Crédito — Reduce el saldo del proveedor' 
                    : 'Nota de Débito — Aumenta el saldo del proveedor'}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
              Nº Comprobante de la Nota *
              <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                (Formato: A 0001-00000001 — Número nuevo y distinto a la factura)
              </span>
            </label>
            <input
              type="text"
              value={numeroComprobanteNota}
              onChange={(e) => setNumeroComprobanteNota(e.target.value)}
              className="campo-entrada"
              style={{ 
                width: '100%',
                boxSizing: 'border-box',
                border: numeroComprobanteNota && !validarFormatoComprobante(numeroComprobanteNota) 
                  ? '2px solid #dc2626' 
                  : undefined 
              }}
              placeholder="Ej: A 0001-00000002"
              required
            />
            {numeroComprobanteNota && !validarFormatoComprobante(numeroComprobanteNota) && (
              <small style={{ color: '#dc2626', marginTop: '0.25rem', display: 'block' }}>
                Formato: Letra + Punto de Venta(4 dígitos) + Nº(8 dígitos) → Ej: A 0001-00000001
              </small>
            )}
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
              Fecha de Emisión *
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="campo-entrada"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
              Importe de la Nota $ *
              {facturaElegida && tipoNota === 'Crédito' && (
                <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                  (Máx: ${saldoPendienteFactura.toFixed(2)})
                </span>
              )}
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={tipoNota === 'Crédito' && facturaElegida ? saldoPendienteFactura : undefined}
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              className="campo-entrada"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                border: facturaElegida && importe && tipoNota === 'Crédito' && Number(importe) > saldoPendienteFactura
                  ? '2px solid #dc2626'
                  : undefined
              }}
              placeholder="0.00"
              required
            />
          </div>

          {idFacturaSeleccionada && importe && Number(importe) > 0 && (
            <div style={{ 
              padding: '1rem', 
              borderRadius: '0.5rem', 
              marginBottom: '1.5rem', 
              backgroundColor: tipoNota === 'Crédito' ? '#eff6ff' : '#fef2f2', 
              border: `1px solid ${tipoNota === 'Crédito' ? '#bfdbfe' : '#fecaca'}` 
            }}>
              <strong>Efecto en Cuenta Corriente:</strong>
              <p style={{ margin: '0.5rem 0 0 0' }}>
                {tipoNota === 'Crédito' 
                  ? `HABER — Se reduce el saldo del proveedor en $${Number(importe).toFixed(2)}`
                  : `DEBE — Se aumenta el saldo del proveedor en $${Number(importe).toFixed(2)}`
                }
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
            <button 
              type="button" 
              style={{ 
                padding: '0.625rem 1.25rem', 
                borderRadius: '0.5rem', 
                border: '1px solid #d1d5db', 
                backgroundColor: '#ffffff', 
                color: '#374151', 
                fontWeight: 600, 
                cursor: 'pointer' 
              }}
              onClick={() => {
                setIdFacturaSeleccionada('');
                setNumeroComprobanteNota('');
                setImporte('');
                setFecha(() => {
                  const hoy = new Date();
                  return `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`;
                });
              }}
            >
              Limpiar
            </button>
            <button 
              type="submit" 
              className="boton-principal"
              disabled={cargando}
            >
              {cargando ? 'Guardando...' : 'Registrar Nota'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}