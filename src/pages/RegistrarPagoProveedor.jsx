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
    <div className="pagos-pagina">
      <div className="contenedor-principal">
        {/* Título principal igual al inventario */}
        <h1 className="titulo-pagina">Registrar Pago a Proveedor</h1>
        <p className="subtitulo">Complete los datos para registrar y aplicar el pago</p>

        {exito && <div className="alerta exito">{exito}</div>}
        {errores.general && <div className="alerta error">{errores.general}</div>}

        <div className="tarjeta-formulario">
          <form onSubmit={manejarSubmit} className="form-contenido">
            {/* Proveedor */}
            <div className="grupo-campo">
              <label>Proveedor *</label>
              <select 
                value={idProveedor} 
                onChange={(e) => setIdProveedor(e.target.value)} 
                required
                className={`campo-entrada ${errores.id_proveedor ? 'campo-error' : ''}`}
              >
                <option value="">-- Seleccionar proveedor --</option>
                {proveedores.map(p => (
                  <option key={p.id_proveedor} value={p.id_proveedor}>
                    {p.nombre} · CUIT {p.cuit}
                  </option>
                ))}
              </select>
              {errores.id_proveedor && <span className="texto-error">{errores.id_proveedor}</span>}
            </div>

            {/* Fila Fecha + Medio de Pago */}
            <div className="fila-doble">
              <div className="grupo-campo">
                <label>Fecha de Pago *</label>
                <input 
                  type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} required
                  className={`campo-entrada ${errores.fecha_pago ? 'campo-error' : ''}`}
                />
                {errores.fecha_pago && <span className="texto-error">{errores.fecha_pago}</span>}
              </div>

              <div className="grupo-campo">
                <label>Medio de Pago *</label>
                <select 
                  value={medioPago} onChange={(e) => setMedioPago(e.target.value)} required
                  className={`campo-entrada ${errores.medio_pago ? 'campo-error' : ''}`}
                >
                  <option value="">-- Seleccionar medio --</option>
                  {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {errores.medio_pago && <span className="texto-error">{errores.medio_pago}</span>}
              </div>
            </div>

            {/* Tabla de facturas pendientes igual al estilo del inventario */}
            <div className="grupo-campo bloque-facturas">
              <h3 className="subtitulo-seccion">Facturas Pendientes / Saldo</h3>
              {cargando ? (
                <p className="aviso">Cargando facturas...</p>
              ) : facturas.length === 0 ? (
                <p className="aviso">El proveedor no tiene facturas pendientes o parciales.</p>
              ) : (
                <div className="tabla-contenedor">
                  <table className="tabla-facturas">
                    <thead>
                      <tr>
                        <th>N° Comprobante</th>
                        <th>Fecha</th>
                        <th>Importe Total</th>
                        <th>Saldo Pendiente</th>
                        <th>Importe a Aplicar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facturas.map(f => (
                        <tr key={f.id_factura_proveedor}>
                          <td>{f.numero_comprobante}</td>
                          <td>{new Date(f.fecha).toLocaleDateString('es-AR')}</td>
                          <td>${f.importe_total.toFixed(2)}</td>
                          <td className="saldo-pendiente">${f.saldo_pendiente.toFixed(2)}</td>
                          <td>
                            <input
                              type="number" step="0.01" min="0" max={f.saldo_pendiente}
                              placeholder="$ 0.00"
                              value={aplicaciones.find(a => a.id_factura_proveedor === f.id_factura_proveedor)?.importe_aplicado || ''}
                              onChange={(e) => actualizarImporte(f.id_factura_proveedor, e.target.value)}
                              className="input-aplicacion"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {errores.aplicaciones && <span className="texto-error">{errores.aplicaciones}</span>}
            </div>

            {/* Tarjeta importe total */}
            <div className="tarjeta-total">
              <span className="etiqueta-total">Importe Total del Pago</span>
              <span className="valor-total">${importeTotal}</span>
              <small>Calculado automáticamente desde los importes aplicados</small>
            </div>

            {/* Botón estilo igual al botón "+ Nuevo producto" */}
            <button type="submit" className="boton-principal" disabled={cargando}>
              {cargando ? 'Guardando...' : '✓ Confirmar y Registrar Pago'}
            </button>
          </form>
        </div>
      </div>
    </div>
    </>
  );
}