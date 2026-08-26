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
    <div className="notas-pagina">
      <div className="contenedor-principal">
        <h1 className="titulo-pagina">Registrar Nota de Crédito / Débito</h1>
        <p className="subtitulo">Corregir o ajustar una factura de proveedor</p>

        {exito && <div className="alerta exito">{exito}</div>}
        {errores.general && <div className="alerta error">{errores.general}</div>}

        <div className="tarjeta-formulario">
          <form onSubmit={manejarSubmit} className="form-contenido">
            
            <div className="grupo-campo">
              <label>Factura a corregir *</label>
              <select 
                value={idFactura}
                onChange={(e) => setIdFactura(e.target.value)}
                required
                className={`campo-entrada ${errores.id_factura_proveedor ? 'campo-error' : ''}`}
                disabled={cargando}
              >
                <option value="">-- Seleccionar factura --</option>
                {facturas.map(f => (
                  <option key={f.id_factura_proveedor} value={f.id_factura_proveedor}>
                    N° {f.numero_comprobante} · {f.proveedor?.razon_social} · Total: ${f.importe_total.toFixed(2)}
                  </option>
                ))}
              </select>
              {errores.id_factura_proveedor && <span className="texto-error">{errores.id_factura_proveedor}</span>}
              
              {facturaSeleccionada && (
                <p style={{marginTop:'0.5rem', color:'var(--marron-principal)', fontWeight:'600'}}>
                  ✅ Proveedor asociado: {facturaSeleccionada.proveedor?.razon_social}
                </p>
              )}
            </div>

            <div className="fila-doble">
              <div className="grupo-campo">
                <label>Tipo de Nota *</label>
                <select 
                  value={tipoNota}
                  onChange={(e) => setTipoNota(e.target.value)}
                  required
                  className={`campo-entrada ${errores.tipo_nota ? 'campo-error' : ''}`}
                  disabled={cargando}
                >
                  <option value="">-- Tipo --</option>
                  {TIPOS_NOTA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {errores.tipo_nota && <span className="texto-error">{errores.tipo_nota}</span>}
              </div>

              <div className="grupo-campo">
                <label>Fecha de Emisión *</label>
                <input 
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                  className={`campo-entrada ${errores.fecha ? 'campo-error' : ''}`}
                  disabled={cargando}
                />
                {errores.fecha && <span className="texto-error">{errores.fecha}</span>}
              </div>
            </div>

            <div className="grupo-campo">
              <label>Número de Comprobante de la Nota *</label>
              <input 
                type="text"
                value={numeroComprobante}
                onChange={(e) => setNumeroComprobante(e.target.value)}
                required
                className={`campo-entrada ${errores.numero_comprobante ? 'campo-error' : ''}`}
                placeholder="Ej: NC-001 / ND-001"
                disabled={cargando}
              />
              {errores.numero_comprobante && <span className="texto-error">{errores.numero_comprobante}</span>}
            </div>

            <div className="grupo-campo">
              <label>Importe de la Nota ($) *</label>
              <input 
                type="number"
                step="0.01"
                min="0.01"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                required
                className={`campo-entrada ${errores.importe ? 'campo-error' : ''}`}
                placeholder="0.00"
                disabled={cargando}
              />
              {errores.importe && <span className="texto-error">{errores.importe}</span>}
            </div>

            <button type="submit" className="boton-principal" disabled={cargando}>
              {cargando ? 'Guardando...' : 'Registrar Nota'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}