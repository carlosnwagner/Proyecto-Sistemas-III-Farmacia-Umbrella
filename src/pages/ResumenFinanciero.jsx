import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { contextoFinanzas, consultarFinanzas, clasificarMovimientoFinanciero, asignarSucursalPago } from '../services/finanzas.js';
import { validarPeriodo, monedaFinanzas, fechaFinanzas } from '../lib/finanzas.js';
import './ResumenFinanciero.css';

function ConciliarMovimiento({ incidencia, sucursales, onActualizar }) {
  const [valor, setValor] = useState('');
  const [pago, setPago] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const esCaja = incidencia.origen === 'Caja';
  const editable = esCaja || incidencia.motivo === 'Sucursal pendiente';
  async function guardar(e) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError('');
    try {
      if (esCaja) await clasificarMovimientoFinanciero(incidencia.referencia, valor, valor === 'PagoProveedor' ? pago : null);
      else await asignarSucursalPago(incidencia.referencia, valor);
      onActualizar();
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }
  return <li>
    <p><strong>{esCaja ? 'Movimiento de caja' : 'Pago a proveedor'} #{incidencia.referencia}</strong>
      {' · '}{incidencia.fecha}{' · '}{monedaFinanzas(incidencia.importe)} — {incidencia.motivo}</p>
    <p>{incidencia.concepto}{incidencia.sucursal_id ? ` · Sucursal #${incidencia.sucursal_id}` : ''}</p>
    {editable ? <form onSubmit={guardar} className="finanzas-conciliar">
      <label>{esCaja ? 'Clasificación' : 'Sucursal real del pago'}
        <select required value={valor} onChange={e => setValor(e.target.value)} disabled={guardando}>
          <option value="">Seleccionar…</option>
          {esCaja ? <>
            <option value="Operativo">Ingreso o egreso operativo</option>
            <option value="TransferenciaInterna">Transferencia interna</option>
            <option value="PagoProveedor">Pago a proveedor registrado</option>
          </> : sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </label>
      {valor === 'PagoProveedor' && <label>Número del pago
        <input required type="number" min="1" step="1" value={pago} onChange={e => setPago(e.target.value)} disabled={guardando} />
      </label>}
      <button disabled={guardando || !valor}>{guardando ? 'Guardando…' : 'Guardar y actualizar'}</button>
    </form> : <Link to="/pagos-proveedores">Revisar las aplicaciones del pago</Link>}
    {error && <p role="alert" className="finanzas-error">{error}</p>}
  </li>;
}

export default function ResumenFinanciero() {
  const [contexto, setContexto] = useState(null);
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', sucursal: '' });
  const [consulta, setConsulta] = useState({ cargando: true, error: '', data: null });
  const [errorFiltros, setErrorFiltros] = useState('');
  const [recarga, setRecarga] = useState(0);
  const version = useRef({ id: 0 });
  const aplicados = useRef(null);

  const cargar = useCallback(async valores => {
    const actual = ++version.current.id;
    aplicados.current = valores;
    setConsulta({ cargando: true, error: '', data: null });
    try {
      const data = await consultarFinanzas(valores);
      if (version.current.id === actual) setConsulta({ cargando: false, error: '', data });
    } catch (err) {
      if (version.current.id === actual) setConsulta({ cargando: false, error: err.message || 'No se pudo consultar el resumen.', data: null });
    }
  }, []);

  useEffect(() => {
    let vigente = true;
    const control = version.current;
    contextoFinanzas().then(ctx => {
      if (!vigente) return;
      setContexto(ctx);
      const valores = { desde: ctx.desde, hasta: ctx.hasta, sucursal: '' };
      setFiltros(valores);
      return cargar(valores);
    }).catch(err => {
      if (vigente) setConsulta({ cargando: false, error: err.message || 'No se pudo cargar el reporte.', data: null });
    });
    return () => { vigente = false; control.id++; };
  }, [cargar, recarga]);

  function consultar(e) {
    e.preventDefault();
    const error = validarPeriodo(filtros.desde, filtros.hasta);
    setErrorFiltros(error);
    if (!error) cargar({ ...filtros });
  }
  const data = consulta.data;
  const nombreSucursal = id => contexto?.sucursales.find(s => String(s.id) === String(id))?.nombre || `Sucursal #${id}`;

  return <section className="finanzas">
    <header><p className="finanzas-seccion">Reportes</p><h1>Resumen de ingresos y egresos</h1>
      <p>Cobros y pagos efectivamente registrados. El flujo neto del período no representa ganancia.</p></header>
    <form onSubmit={consultar} className="finanzas-panel finanzas-filtros">
      <label>Fecha desde<input type="date" required value={filtros.desde} onChange={e => setFiltros({ ...filtros, desde: e.target.value })} disabled={!contexto} /></label>
      <label>Fecha hasta<input type="date" required value={filtros.hasta} onChange={e => setFiltros({ ...filtros, hasta: e.target.value })} disabled={!contexto} /></label>
      <label>Sucursal<select value={filtros.sucursal} onChange={e => setFiltros({ ...filtros, sucursal: e.target.value })} disabled={!contexto}>
        <option value="">Todas las autorizadas</option>
        {contexto?.sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select></label>
      <button disabled={!contexto || consulta.cargando}>Consultar</button>
      {errorFiltros && <p role="alert" className="finanzas-error">{errorFiltros}</p>}
    </form>
    <div aria-live="polite" aria-busy={consulta.cargando}>
      {consulta.cargando && <p role="status">Cargando resumen financiero…</p>}
      {consulta.error && <div role="alert" className="finanzas-panel finanzas-error"><p>{consulta.error}</p>
        <button onClick={() => contexto && aplicados.current ? cargar(aplicados.current) : setRecarga(n => n + 1)}>Reintentar</button>
      </div>}
      {data && <>
        <p>Período consultado: <strong>{data.periodo.desde} al {data.periodo.hasta}</strong> · {data.sucursal_id ? nombreSucursal(data.sucursal_id) : 'Todas las sucursales autorizadas'}</p>
        {!data.completo ? <div className="finanzas-panel finanzas-pendientes">
          <h2>Datos pendientes de conciliación</h2><p>Completá los siguientes datos para obtener un resumen completo. Los movimientos de caja que representan pagos a proveedores deben vincularse al pago ya registrado.</p>
          <p>Verificá cada clasificación antes de guardarla: las reversiones heredan la del movimiento original.</p>
          <ul>{data.incidencias.map(i => <ConciliarMovimiento key={i.id} incidencia={i} sucursales={contexto.sucursales}
            onActualizar={() => cargar(aplicados.current)} />)}</ul>
        </div> : <>
          <div className="finanzas-totales">
            {[
              ['Total de ingresos', data.totales.ingresos, 'ingreso'],
              ['Total de egresos', data.totales.egresos, 'egreso'],
              ['Flujo neto del período', data.totales.flujo_neto, 'neto'],
            ].map(([titulo, valor, clase]) => <article key={clase} className={`finanzas-panel ${clase}`}><h2>{titulo}</h2><strong>{monedaFinanzas(valor)}</strong></article>)}
          </div>
          <div className="finanzas-panel"><h2>Movimientos incluidos ({data.movimientos.length})</h2>
            {data.movimientos.length === 0 ? <p role="status">No hay movimientos registrados para el período y las sucursales seleccionadas.</p> :
              <div className="finanzas-tabla"><table><caption>Detalle de cobros y pagos del período consultado</caption><thead><tr>
                {['Fecha efectiva', 'Concepto', 'Origen', 'Sucursal', 'Tipo', 'Importe'].map(t => <th key={t} scope="col">{t}</th>)}
              </tr></thead><tbody>{data.movimientos.map(m => <tr key={m.id}>
                <td>{fechaFinanzas(m.fecha_efectiva)}</td><td>{m.concepto}<small>{m.id}</small></td><td>{m.origen}</td>
                <td>{nombreSucursal(m.sucursal_id)}</td><td>{m.tipo}</td><td>{monedaFinanzas(m.importe)}</td>
              </tr>)}</tbody></table></div>}
          </div>
        </>}
      </>}
    </div>
  </section>;
}
