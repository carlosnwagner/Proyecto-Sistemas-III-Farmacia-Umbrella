import { useState, useEffect } from 'react';
import { 
  getFacturasParaNota, 
  createNotaCreditoDebito, 
  TIPOS_NOTA 
} from '../services/notasCreditoDebito';

const TIPOS_NOTA_SEGURO = TIPOS_NOTA && TIPOS_NOTA.length > 0 ? TIPOS_NOTA : ['Crédito', 'Débito'];

export default function RegistrarNotaCreditoDebito() {
  const [cargando, setCargando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [facturas, setFacturas] = useState([]);
  
  const [idFacturaSeleccionada, setIdFacturaSeleccionada] = useState('');
  const [tipoNota, setTipoNota] = useState(TIPOS_NOTA_SEGURO[0]);
  const [numeroComprobante, setNumeroComprobante] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [importe, setImporte] = useState('');
  const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

  const [facturaElegida, setFacturaElegida] = useState(null);

  //  VALIDACIÓN FORMATO COMPROBANTE: XXXX-XXXXXXXX (4 dígitos - guion - hasta 8 dígitos)
  const validarFormatoComprobante = (valor) => {
    if (!valor) return false;
    // Acepta: 0001-12345678, 0001-00000001, etc.
    const regex = /^\d{4}-\d{1,8}$/;
    return regex.test(valor.trim());
  };

  useEffect(() => {
    const cargarFacturas = async () => {
      setCargando(true);
      setErrorGeneral(null);
      try {
        const { data, error } = await getFacturasParaNota();
        if (error) throw new Error(error.message);
        setFacturas(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(' Error cargando facturas:', err);
        setErrorGeneral('No se pudieron cargar las facturas: ' + err.message);
        setFacturas([]);
      } finally {
        setCargando(false);
      }
    };
    cargarFacturas();
  }, []);

  useEffect(() => {
    if (!idFacturaSeleccionada) {
      setFacturaElegida(null);
      return;
    }
    const factura = facturas.find(f => f.id_factura_proveedor === Number(idFacturaSeleccionada));
    setFacturaElegida(factura || null);
  }, [idFacturaSeleccionada, facturas]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje({ tipo: '', texto: '' });

    //  VALIDACIÓN 1: Formato de comprobante
    if (!numeroComprobante.trim()) {
      return setMensaje({ tipo: 'error', texto: 'El número de comprobante es obligatorio.' });
    }
    if (!validarFormatoComprobante(numeroComprobante)) {
      return setMensaje({ 
        tipo: 'error', 
        texto: 'Formato inválido. Usá: 0001-12345678 (4 dígitos, guion, hasta 8 dígitos). Ej: 0000-00000001' 
      });
    }

    //  VALIDACIÓN 2: Importe mayor a 0
    if (!importe || Number(importe) < 0) {
      return setMensaje({ tipo: 'error', texto: 'El importe debe ser mayor a 0.' });
    }

    //  VALIDACIÓN 3: Importe NO puede superar el total de la factura
    if (facturaElegida) {
      const importeFactura = Number(facturaElegida.importe_total) || 0;
      if (Number(importe) > importeFactura) {
        return setMensaje({ 
          tipo: 'error', 
          texto: `El importe ($${Number(importe).toFixed(2)}) no puede superar el total de la factura ($${importeFactura.toFixed(2)}).` 
        });
      }
    }

    setCargando(true);
    try {
      const resultado = await createNotaCreditoDebito({
        id_factura_proveedor: Number(idFacturaSeleccionada),
        tipo_nota: tipoNota,
        numero_comprobante: numeroComprobante.trim(),
        fecha,
        importe: Number(importe)
      });

      if (resultado.error) throw new Error(resultado.error.message || 'Error al guardar');

      setMensaje({ tipo: 'exito', texto: ` Nota de ${tipoNota} registrada correctamente.` });
      
      setIdFacturaSeleccionada('');
      setNumeroComprobante('');
      setImporte('');
      setFecha(new Date().toISOString().split('T')[0]);
    } catch (err) {
      console.error(' Error guardando nota:', err);
      setMensaje({ tipo: 'error', texto: err.message || 'Ocurrió un error al guardar' });
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.9rem", fontWeight: "700", color: "#111827", margin: 0 }}>
             Registro de Notas de Crédito / Débito
          </h1>
          <p style={{ color: "#6b7280", margin: "0.25rem 0 0" }}>
            Asociadas a factura de proveedor — Actualización de saldos
          </p>
        </div>
      </header>

      {errorGeneral && <div style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', backgroundColor: '#fef2f2', color: '#dc2626', marginBottom: '1rem' }}>{errorGeneral}</div>}
      {mensaje.texto && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem', backgroundColor: mensaje.tipo === 'exito' ? '#f0fdf4' : '#fef2f2', color: mensaje.tipo === 'exito' ? '#166534' : '#dc2626' }}>
          {mensaje.texto}
        </div>
      )}
      {cargando && <p style={{ marginBottom: '1rem', color: '#6b7280' }}>Cargando...</p>}

      <div style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', padding: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
        <form onSubmit={handleSubmit}>
          
          {facturaElegida && (
            <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', margin: '0 0 0.75rem 0' }}>📋 Factura Seleccionada</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Nº Comprobante Factura</span>
                  <p style={{ fontWeight: 600, margin: '0.25rem 0 0 0' }}>{facturaElegida.numero_comprobante || '-'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Proveedor</span>
                  <p style={{ fontWeight: 600, margin: '0.25rem 0 0 0' }}>{facturaElegida.proveedor?.razon_social || '-'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Importe Total Factura</span>
                  <p style={{ fontWeight: 700, color: '#65482b', margin: '0.25rem 0 0 0' }}>${Number(facturaElegida.importe_total || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem', color: '#374151' }}>Factura a corregir *</label>
            <select
              value={idFacturaSeleccionada}
              onChange={(e) => setIdFacturaSeleccionada(e.target.value)}
              style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', outline: 'none', boxSizing: 'border-box' }}
              required
            >
              <option value="">-- Seleccioná una factura --</option>
              {facturas.map(f => (
                <option key={f.id_factura_proveedor} value={f.id_factura_proveedor}>
                  {f.numero_comprobante} — {f.proveedor?.razon_social || 'Sin proveedor'} — ${Number(f.importe_total || 0).toFixed(2)}
                </option>
              ))}
            </select>
            <small style={{ color: '#6b7280', marginTop: '0.25rem', display: 'block' }}>No requiere orden de compra asociada</small>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem', color: '#374151' }}>Tipo de Nota *</label>
            <select
              value={tipoNota}
              onChange={(e) => setTipoNota(e.target.value)}
              style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', outline: 'none', boxSizing: 'border-box' }}
            >
              {TIPOS_NOTA_SEGURO.map(tipo => (
                <option key={tipo} value={tipo}>
                  {tipo === 'Crédito' ? ' Nota de Crédito (reduce saldo)' : ' Nota de Débito (aumenta saldo)'}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem', color: '#374151' }}>
              Nº Comprobante de la Nota * 
              <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.8rem', marginLeft: '0.5rem' }}>(Formato: 0001-12345678)</span>
            </label>
            <input
              type="text"
              value={numeroComprobante}
              onChange={(e) => setNumeroComprobante(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.625rem', 
                borderRadius: '0.5rem', 
                border: numeroComprobante && !validarFormatoComprobante(numeroComprobante) ? '2px solid #dc2626' : '1px solid #d1d5db', 
                outline: 'none', 
                boxSizing: 'border-box' 
              }}
              placeholder="Ej: 0000-00000001"
              required
            />
            {numeroComprobante && !validarFormatoComprobante(numeroComprobante) && (
              <small style={{ color: '#dc2626', marginTop: '0.25rem', display: 'block' }}>
                 El formato debe ser: 4 dígitos + guion + numeración (ej: 0001-00000001)
              </small>
            )}
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem', color: '#374151' }}>Fecha *</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontWeight: 500, marginBottom: '0.5rem', color: '#374151' }}>
              Importe de la Nota $ *
              {facturaElegida && (
                <span style={{ fontWeight: 400, color: '#6b7280', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                  (Máx: ${Number(facturaElegida.importe_total || 0).toFixed(2)})
                </span>
              )}
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={facturaElegida ? Number(facturaElegida.importe_total) : undefined}
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '0.625rem', 
                borderRadius: '0.5rem', 
                border: facturaElegida && importe && Number(importe) > Number(facturaElegida.importe_total) 
                  ? '2px solid #dc2626' 
                  : '1px solid #d1d5db', 
                outline: 'none', 
                boxSizing: 'border-box' 
              }}
              placeholder="0.00"
              required
            />
            {facturaElegida && importe && Number(importe) > Number(facturaElegida.importe_total) && (
              <small style={{ color: '#dc2626', marginTop: '0.25rem', display: 'block' }}>
                 El importe no puede superar el total de la factura (${Number(facturaElegida.importe_total).toFixed(2)})
              </small>
            )}
          </div>

          {idFacturaSeleccionada && importe && Number(importe) > 0 && facturaElegida && (
            <div style={{ padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', backgroundColor: tipoNota === 'Crédito' ? '#eff6ff' : '#fef2f2', border: `1px solid ${tipoNota === 'Crédito' ? '#bfdbfe' : '#fecaca'}` }}>
              <strong> Efecto en Cuenta Corriente:</strong>
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
              style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', fontWeight: 500, cursor: 'pointer' }}
              onClick={() => {
                setIdFacturaSeleccionada('');
                setNumeroComprobante('');
                setImporte('');
                setMensaje({ tipo: '', texto: '' });
              }}
            >
              Limpiar
            </button>
            <button 
              type="submit" 
              style={{ padding: '0.625rem 1.5rem', borderRadius: '0.5rem', border: 'none', backgroundColor: '#65482b', color: '#ffffff', fontWeight: 600, cursor: 'pointer' }}
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
