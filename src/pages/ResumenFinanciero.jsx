import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { contextoFinanzas, consultarFinanzas, consultarMediosPagoFinanzas, clasificarMovimientoFinanciero, asignarSucursalPago } from '../services/finanzas.js';
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
  const location = useLocation();
  const navigate = useNavigate();
  const parametros = new URLSearchParams(location.search);
  const esTendencias = location.pathname.endsWith('/tendencias');
  const [contexto, setContexto] = useState(null);
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', sucursal: '' });
  const [anio, setAnio] = useState(parametros.get('anio') || String(new Date().getFullYear()));
  const [periodoTendencia, setPeriodoTendencia] = useState(parametros.get('periodo') || 'mes');
  const [mesTendencia, setMesTendencia] = useState(parametros.get('mes') || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(5, 7));
  const [sucursalTendencia, setSucursalTendencia] = useState(parametros.get('sucursal') || '');
  const [pagina, setPagina] = useState(1);
  const [consulta, setConsulta] = useState({ cargando: true, error: '', data: null });
  const [consultaAnual, setConsultaAnual] = useState({ cargando: false, error: '', data: null });
  const [errorFiltros, setErrorFiltros] = useState('');
  const [recarga, setRecarga] = useState(0);
  const version = useRef({ id: 0 });
  const aplicados = useRef(null);
  const anualActual = useRef({ id: 0 });

  const cargar = useCallback(async valores => {
    const actual = ++version.current.id;
    aplicados.current = valores;
    setPagina(1);
    setConsulta({ cargando: true, error: '', data: null });
    try {
      const data = await consultarFinanzas(valores);
      if (version.current.id === actual) setConsulta({ cargando: false, error: '', data });
    } catch (err) {
      if (version.current.id === actual) setConsulta({ cargando: false, error: err.message || 'No se pudo consultar el resumen.', data: null });
    }
  }, []);

  const cargarAnual = useCallback(async valores => {
    const actual = ++anualActual.current.id;
    setConsultaAnual({ cargando: true, error: '', data: null });
    try {
      const inicioPago = valores.periodoPago === 'mes' ? `${valores.mesPago}-01` : valores.desde;
      const finPago = valores.periodoPago === 'mes'
        ? new Date(Date.UTC(Number(valores.mesPago.slice(0, 4)), Number(valores.mesPago.slice(5, 7)), 0)).toISOString().slice(0, 10)
        : valores.hasta;
      const [data, pagos] = await Promise.all([
        consultarFinanzas(valores),
        consultarMediosPagoFinanzas({ desde: inicioPago, hasta: finPago, sucursal: valores.sucursal }),
      ]);
      if (anualActual.current.id === actual) setConsultaAnual({ cargando: false, error: '', data: { ...data, pagos } });
    } catch (err) {
      if (anualActual.current.id === actual) setConsultaAnual({ cargando: false, error: err.message || 'No se pudieron cargar los gráficos.', data: null });
    }
  }, []);

  useEffect(() => {
    let vigente = true;
    const control = version.current;
    contextoFinanzas().then(ctx => {
      if (!vigente) return;
      setContexto(ctx);
      const query = new URLSearchParams(location.search);
      const desde = query.get('desde') || ctx.desde;
      const hasta = query.get('hasta') || ctx.hasta;
      const errorPeriodo = validarPeriodo(desde, hasta);
      const valores = { desde: errorPeriodo ? ctx.desde : desde, hasta: errorPeriodo ? ctx.hasta : hasta, sucursal: query.get('sucursal') || '' };
      setFiltros(valores);
      return cargar(valores);
    }).catch(err => {
      if (vigente) setConsulta({ cargando: false, error: err.message || 'No se pudo cargar el reporte.', data: null });
    });
    return () => { vigente = false; control.id++; };
  }, [cargar, cargarAnual, location.search, recarga]);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const anioSeleccionado = query.get('anio') || String(new Date().getFullYear());
    const sucursalSeleccionada = query.get('sucursal') || '';
    if (contexto && esTendencias) {
      const periodoSeleccionado = query.get('periodo') || 'mes';
      const mesSeleccionado = query.get('mes') || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(5, 7);
      queueMicrotask(() => cargarAnual({ desde: `${anioSeleccionado}-01-01`, hasta: `${anioSeleccionado}-12-31`, sucursal: sucursalSeleccionada, anioGrafico: Number(anioSeleccionado), periodoPago: periodoSeleccionado, mesPago: `${anioSeleccionado}-${String(mesSeleccionado).padStart(2, '0')}` }));
    }
  }, [contexto, esTendencias, location.search, cargarAnual]);

  function consultar(e) {
    e.preventDefault();
    const error = validarPeriodo(filtros.desde, filtros.hasta);
    setErrorFiltros(error);
    if (!error) cargar({ ...filtros });
  }
  const data = consulta.data;
  const nombreSucursal = id => contexto?.sucursales.find(s => String(s.id) === String(id))?.nombre || `Sucursal #${id}`;
  const datosAnuales = consultaAnual.data;
  const meses = datosAnuales?.mensual || [];
  const etiquetaMes = mes => new Date(`${mes}-01T12:00:00Z`).toLocaleDateString('es-AR', { month: 'short', timeZone: 'UTC' });
  const movimientos = data?.movimientos || [];
  const filasPorPagina = 10;
  const totalPaginas = Math.max(1, Math.ceil(movimientos.length / filasPorPagina));
  const movimientosPagina = movimientos.slice((pagina - 1) * filasPorPagina, pagina * filasPorPagina);
  // HU62: estado de cada mes respecto de hoy (zona horaria del negocio).
  const mesActual = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).slice(0, 7);
  const estadoMes = mes => (mes > mesActual ? 'futuro' : mes === mesActual ? 'actual' : 'pasado');
  const nombreMes = mes => {
    const nombre = new Date(`${mes}-01T12:00:00Z`).toLocaleDateString('es-AR', { month: 'long', timeZone: 'UTC' });
    return nombre.charAt(0).toUpperCase() + nombre.slice(1);
  };
  const codigoMesSeleccionado = `${anio}-${String(mesTendencia).padStart(2, '0')}`;
  const mesesVista = periodoTendencia === 'mes' ? meses.filter(m => m.mes === codigoMesSeleccionado) : meses;
  const maxMensual = Math.max(1, ...mesesVista.flatMap(m => [Number(m.ingresos), Number(m.egresos)]));
  const totalIngresosPeriodo = mesesVista.reduce((total, mes) => total + Number(mes.ingresos), 0);
  const totalEgresosPeriodo = mesesVista.reduce((total, mes) => total + Number(mes.egresos), 0);
  const totalFlujoPeriodo = totalIngresosPeriodo + totalEgresosPeriodo;
  const porcentajeIngresos = totalFlujoPeriodo ? totalIngresosPeriodo / totalFlujoPeriodo * 100 : 0;
  const pagosPorMedio = (datosAnuales?.pagos || []).reduce((acumulado, venta) => {
    const medio = String(venta.medio_pago || '').trim();
    const normalizado = medio.toLocaleLowerCase('es');
    const categoria = /mercado\s*pago/.test(normalizado) ? 'Mercado Pago'
      : /cr[eé]dito/.test(normalizado) ? 'Tarjeta de crédito'
        : /d[eé]bito/.test(normalizado) ? 'Tarjeta de débito'
          : /efectivo/.test(normalizado) ? 'Efectivo'
            : /cheque/.test(normalizado) ? 'Cheque'
              : /tarjeta/.test(normalizado) ? 'Tarjeta (sin especificar)'
                : medio || 'Sin especificar';
    const actual = acumulado.get(categoria) || { nombre: categoria, importe: 0, cantidad: 0 };
    actual.importe += Number(venta.importe_total) || 0;
    actual.cantidad += 1;
    acumulado.set(categoria, actual);
    return acumulado;
  }, new Map());
  const coloresPagos = ['#087f8c', '#e47c28', '#6a4c93', '#2f855a', '#c2413b', '#557a95', '#a16207'];
  const resumenPagos = [...pagosPorMedio.values()].sort((a, b) => b.importe - a.importe);
  const totalPagos = resumenPagos.reduce((total, pago) => total + pago.importe, 0);
  let avancePago = 0;
  const segmentosPago = resumenPagos.map((pago, indice) => {
    const inicio = avancePago;
    avancePago += totalPagos ? pago.importe / totalPagos * 100 : 0;
    return `${coloresPagos[indice % coloresPagos.length]} ${inicio}% ${avancePago}%`;
  }).join(', ');
  const hayMesActual = mesesVista.some(m => estadoMes(m.mes) === 'actual');
  const hayMesFuturo = mesesVista.some(m => estadoMes(m.mes) === 'futuro');
  const mesesConDatos = mesesVista.map((m, i) => ({ ...m, i })).filter(m => estadoMes(m.mes) !== 'futuro');
  const maxIngresosReal = Math.max(0, ...mesesConDatos.map(m => Number(m.ingresos)));
  const maxIngresos = Math.max(1, maxIngresosReal);
  const puntoX = i => (i + 0.5) / (mesesVista.length || 12) * 100;
  const alturaIngreso = valor => Number(valor) / maxIngresos * 100;
  const sinMovimientosPeriodo = Boolean(datosAnuales) && totalFlujoPeriodo === 0;
  function consultarAnio(e) {
    e.preventDefault();
    const consulta = new URLSearchParams({ periodo: periodoTendencia, anio, sucursal: sucursalTendencia });
    if (periodoTendencia === 'mes') consulta.set('mes', mesTendencia);
    navigate(`/reportes/tendencias?${consulta.toString()}`);
  }

  return <section className="finanzas">
    <header className="finanzas-encabezado">
      <div><p className="finanzas-seccion">Reportes</p><h1>{esTendencias ? 'Tendencias mensuales' : 'Resumen de ingresos y egresos'}</h1>
        {esTendencias && <p>Explorá ingresos y egresos por año y sucursal.</p>}</div>
    </header>
    {esTendencias ? <>
      <Link className="finanzas-volver" to="/reportes">← Volver al resumen</Link>
      <section className="finanzas-panel finanzas-dashboard" aria-labelledby="finanzas-graficos-titulo">
        <div className="finanzas-dashboard-cabecera"><div className="finanzas-dashboard-titulo"><p className="finanzas-seccion">Tendencias</p><h2 id="finanzas-graficos-titulo">{periodoTendencia === 'mes' ? `Movimientos de ${nombreMes(codigoMesSeleccionado)} ${anio}` : `Ingresos y egresos de ${anio}`}</h2>
              <p>{periodoTendencia === 'mes' ? 'Consultá los importes del mes seleccionado.' : 'Compará los movimientos de los doce meses del año.'}</p></div></div>
        <form className={`finanzas-dashboard-filtros ${periodoTendencia === 'mes' ? 'finanzas-filtros-mes' : 'finanzas-filtros-anio'}`} onSubmit={consultarAnio}>
          <label>Período<select value={periodoTendencia} onChange={e => setPeriodoTendencia(e.target.value)} aria-label="Período de las tendencias">
            <option value="mes">Mes</option><option value="anio">Año completo</option>
          </select></label>
          <label>Año<select value={anio} onChange={e => setAnio(e.target.value)} aria-label="Año de los gráficos">
            {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => <option key={y} value={y}>{y}</option>)}
          </select></label>
          {periodoTendencia === 'mes' && <label>Mes<select value={mesTendencia} onChange={e => setMesTendencia(e.target.value)} aria-label="Mes de las tendencias">
            {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => <option key={m} value={m}>{nombreMes(`${anio}-${m}`)}</option>)}
          </select></label>}
          <label>Sucursal<select value={sucursalTendencia} onChange={e => setSucursalTendencia(e.target.value)} disabled={!contexto}>
            <option value="">Todas las autorizadas</option>{contexto?.sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select></label>
          <button className="finanzas-boton finanzas-boton-principal" disabled={!contexto || consultaAnual.cargando}>{consultaAnual.cargando ? 'Actualizando…' : 'Aplicar filtros'}</button>
        </form>
        {consultaAnual.cargando && <p role="status">Cargando gráficos mensuales…</p>}
        {consultaAnual.error && <p role="alert" className="finanzas-error">{consultaAnual.error}</p>}
        {!consultaAnual.cargando && !consultaAnual.error && datosAnuales && !datosAnuales.mensual_completo && <div role="status" className="finanzas-aviso-conciliacion">
          <strong>Hay movimientos que todavía no aparecen en los gráficos.</strong><span>Algunos movimientos manuales de caja no tienen clasificación, o hay pagos a proveedores sin aplicar por completo. Se excluyen hasta que se revisen para evitar duplicar o asignar importes incorrectamente.</span>
          <Link to={`/reportes?desde=${periodoTendencia === 'mes' ? `${codigoMesSeleccionado}-01` : `${anio}-01-01`}&hasta=${periodoTendencia === 'mes' ? new Date(Date.UTC(Number(anio), Number(mesTendencia), 0)).toISOString().slice(0, 10) : `${anio}-12-31`}&sucursal=${encodeURIComponent(sucursalTendencia)}`}>Ver y conciliar movimientos</Link>
        </div>}
        {!consultaAnual.cargando && !consultaAnual.error && sinMovimientosPeriodo && <p role="status" className="finanzas-sin-datos">No hay movimientos conciliados para {periodoTendencia === 'mes' ? `${nombreMes(codigoMesSeleccionado)} de ${anio}` : `el año ${anio}`}{sucursalTendencia ? ' en la sucursal seleccionada' : ''}.</p>}
        {!consultaAnual.cargando && !consultaAnual.error && <>
        <div className="finanzas-graficos">
          <div className="finanzas-grafico" aria-label={`Ingresos y egresos de ${periodoTendencia === 'mes' ? nombreMes(codigoMesSeleccionado) : anio}`}>
            <h3>{periodoTendencia === 'mes' ? `Ingresos y egresos · ${nombreMes(codigoMesSeleccionado)}` : 'Ingresos y egresos por mes'}</h3>
            <div className="finanzas-leyenda"><span><i className="barra-ingreso" />Ingresos</span><span><i className="barra-egreso" />Egresos</span>{hayMesActual && <span><i className="marca-mes-actual" />Mes en curso</span>}{hayMesFuturo && <span className="finanzas-leyenda-futuro">— Mes futuro (sin datos)</span>}</div>
            <div className={`finanzas-barras ${periodoTendencia === 'mes' ? 'finanzas-barras-unico-mes' : ''}`}>{mesesVista.map(m => {
              const estado = estadoMes(m.mes);
              return <div className={`finanzas-mes finanzas-mes-${estado}`} key={m.mes} aria-current={estado === 'actual' ? 'date' : undefined} title={`${nombreMes(m.mes)}${estado === 'actual' ? ' · mes en curso' : estado === 'futuro' ? ' · mes futuro, sin datos' : ''}`}>
                <div className="finanzas-par-barras">{estado !== 'futuro' && <>
                  <span className="finanzas-barra barra-ingreso" style={{ height: `${Number(m.ingresos) > 0 ? Math.max(2, Number(m.ingresos) / maxMensual * 100) : 0}%` }} title={`Ingresos: ${monedaFinanzas(m.ingresos)}`} />
                  <span className="finanzas-barra barra-egreso" style={{ height: `${Number(m.egresos) > 0 ? Math.max(2, Number(m.egresos) / maxMensual * 100) : 0}%` }} title={`Egresos: ${monedaFinanzas(m.egresos)}`} />
                </>}</div>
                <small className="finanzas-mes-etiqueta">{etiquetaMes(m.mes)}</small>
              </div>;
            })}</div>
          </div>
          <div className="finanzas-grafico" aria-label={`Evolución mensual de ingresos en ${anio}`}>
            <h3>{periodoTendencia === 'mes' ? 'Ingresos del mes' : 'Tendencia anual de ingresos'}</h3>
            <p className="finanzas-linea-escala">Escala máxima: {monedaFinanzas(maxIngresosReal)}</p>
            <div className="finanzas-linea">
              <div className="finanzas-linea-area" role="img" aria-label={`Línea de ingresos mensuales de ${anio}. Los importes de cada mes están en la tabla de detalle mensual.`}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {mesesConDatos.length > 1 && <polyline points={mesesConDatos.map(m => `${puntoX(m.i)},${100 - alturaIngreso(m.ingresos)}`).join(' ')} />}
                </svg>
                {mesesConDatos.map(m => <span key={m.mes} className={`finanzas-punto finanzas-punto-${estadoMes(m.mes)}`} style={{ left: `${puntoX(m.i)}%`, bottom: `${alturaIngreso(m.ingresos)}%` }} title={`${nombreMes(m.mes)}: ${monedaFinanzas(m.ingresos)}`} />)}
              </div>
              <div className={`finanzas-linea-meses ${periodoTendencia === 'mes' ? 'finanzas-linea-meses-unico-mes' : ''}`}>{mesesVista.map(m => <small key={m.mes} className={`finanzas-mes-etiqueta finanzas-mes-${estadoMes(m.mes)}`}>{etiquetaMes(m.mes)}</small>)}</div>
            </div>
          </div>
          <div className="finanzas-grafico finanzas-grafico-torta">
            <h3>{periodoTendencia === 'mes' ? 'Distribución del mes' : 'Distribución anual: ingresos y egresos'}</h3>
            {totalFlujoPeriodo > 0 ? <div className="finanzas-torta-contenido">
              <div className="finanzas-torta" role="img" aria-label={`Ingresos ${porcentajeIngresos.toFixed(1)} por ciento; egresos ${(100 - porcentajeIngresos).toFixed(1)} por ciento`} style={{ '--porcentaje-ingresos': `${porcentajeIngresos}%` }}><span>{periodoTendencia === 'mes' ? nombreMes(codigoMesSeleccionado) : 'ANUAL'}<br />{anio}</span></div>
              <div className="finanzas-torta-leyenda"><p><i className="barra-ingreso" /><span>INGRESOS</span><strong>{monedaFinanzas(totalIngresosPeriodo)}</strong></p><p><i className="barra-egreso" /><span>EGRESOS</span><strong>{monedaFinanzas(totalEgresosPeriodo)}</strong></p></div>
            </div> : <p>No hay movimientos conciliados para este período y sucursal.</p>}
          </div>
          <div className="finanzas-grafico finanzas-grafico-torta finanzas-grafico-medios">
            <h3>Pagos por medio</h3>
            {totalPagos > 0 ? <div className="finanzas-torta-contenido">
              <div className="finanzas-torta finanzas-torta-medios" role="img" aria-label={`Distribución de ${resumenPagos.length} medios de pago, total ${monedaFinanzas(totalPagos)}`} style={{ '--segmentos-pago': segmentosPago }}><span>Pagos<br />{monedaFinanzas(totalPagos)}</span></div>
              <div className="finanzas-torta-leyenda">{resumenPagos.map((pago, indice) => <p key={pago.nombre}><i style={{ backgroundColor: coloresPagos[indice % coloresPagos.length] }} /><span>{pago.nombre} · {pago.cantidad} {pago.cantidad === 1 ? 'pago' : 'pagos'}</span><strong>{monedaFinanzas(pago.importe)}</strong></p>)}</div>
            </div> : <p>No hay ventas cobradas para este período y sucursal.</p>}
          </div>
        </div>
        <div className="finanzas-grafico finanzas-tabla-bloque">
          <h3>{periodoTendencia === 'mes' ? `Detalle de ${nombreMes(codigoMesSeleccionado)} ${anio}` : `Detalle mensual ${anio}`}</h3>
          <div className="finanzas-tabla"><table className="finanzas-tabla-mensual">
            <caption className="finanzas-sr">Ingresos, egresos y diferencia por mes de {anio}</caption>
            <thead><tr><th scope="col">Mes</th><th scope="col" className="num">Ingresos</th><th scope="col" className="num">Egresos</th><th scope="col" className="num">Diferencia</th></tr></thead>
            <tbody>{mesesVista.map(m => {
              const estado = estadoMes(m.mes);
              const diferencia = Number(m.ingresos) - Number(m.egresos);
              return <tr key={m.mes} className={`finanzas-fila-${estado}`} aria-current={estado === 'actual' ? 'date' : undefined}>
                <th scope="row">{nombreMes(m.mes)}{estado === 'actual' && <span className="finanzas-etiqueta">En curso</span>}{estado === 'futuro' && <span className="finanzas-etiqueta finanzas-etiqueta-suave">Sin datos aún</span>}</th>
                {estado === 'futuro' ? <><td className="num">—</td><td className="num">—</td><td className="num">—</td></> : <>
                  <td className="num">{monedaFinanzas(m.ingresos)}</td>
                  <td className="num">{monedaFinanzas(m.egresos)}</td>
                  <td className={`num ${diferencia < 0 ? 'negativo' : 'positivo'}`}>{monedaFinanzas(diferencia)}</td>
                </>}
              </tr>;
            })}</tbody>
            <tfoot><tr><th scope="row">{periodoTendencia === 'mes' ? 'Total del mes' : `Total ${anio}`}</th><td className="num">{monedaFinanzas(totalIngresosPeriodo)}</td><td className="num">{monedaFinanzas(totalEgresosPeriodo)}</td><td className={`num ${totalIngresosPeriodo - totalEgresosPeriodo < 0 ? 'negativo' : 'positivo'}`}>{monedaFinanzas(totalIngresosPeriodo - totalEgresosPeriodo)}</td></tr></tfoot>
          </table></div>
        </div>
        </>}
      </section>
    </> : <>
    <div className="finanzas-acciones"><Link className="finanzas-boton finanzas-boton-secundario" to={`/reportes/tendencias?anio=${new Date().getFullYear()}&sucursal=${encodeURIComponent(filtros.sucursal)}`}>Ver tendencias mensuales →</Link></div>
    <form onSubmit={consultar} className="finanzas-panel finanzas-filtros">
      <label>Fecha desde<input type="date" required value={filtros.desde} onChange={e => setFiltros({ ...filtros, desde: e.target.value })} disabled={!contexto} /></label>
      <label>Fecha hasta<input type="date" required value={filtros.hasta} onChange={e => setFiltros({ ...filtros, hasta: e.target.value })} disabled={!contexto} /></label>
      <label className="finanzas-filtro-sucursal">Sucursal<select value={filtros.sucursal} onChange={e => setFiltros({ ...filtros, sucursal: e.target.value })} disabled={!contexto}>
        <option value="">Todas las autorizadas</option>
        {contexto?.sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
      </select></label>
      <button className="finanzas-boton finanzas-boton-principal" disabled={!contexto || consulta.cargando}>{consulta.cargando && contexto ? 'Consultando…' : 'Consultar'}</button>
    </form>
    {errorFiltros && <p role="alert" className="finanzas-error finanzas-validacion">{errorFiltros}</p>}
    {consulta.cargando && <p role="status">Cargando resumen financiero…</p>}
    {consulta.error && <div role="alert" className="finanzas-panel finanzas-error"><p>{consulta.error}</p>
      <button className="finanzas-boton finanzas-boton-secundario" onClick={() => contexto && aplicados.current ? cargar(aplicados.current) : setRecarga(n => n + 1)}>Reintentar</button>
    </div>}
    <div aria-live="polite" aria-busy={consulta.cargando}>
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
              <div className="finanzas-tabla"><table><colgroup><col className="col-fecha" /><col className="col-concepto" /><col className="col-origen" /><col className="col-sucursal" /><col className="col-tipo" /><col className="col-importe" /></colgroup><thead><tr>
                {['Fecha efectiva', 'Concepto', 'Origen', 'Sucursal', 'Tipo', 'Importe'].map(t => <th key={t} scope="col">{t}</th>)}
              </tr></thead><tbody>{movimientosPagina.map(m => <tr key={m.id}>
                <td>{fechaFinanzas(m.fecha_efectiva)}</td><td>{m.concepto}<small>{m.id}</small></td><td>{m.origen}</td>
                <td>{nombreSucursal(m.sucursal_id)}</td><td>{m.tipo}</td><td>{monedaFinanzas(m.importe)}</td>
              </tr>)}</tbody></table></div>}
            {movimientos.length > filasPorPagina && <nav className="finanzas-paginacion" aria-label="Paginación de movimientos">
              <span>Mostrando {(pagina - 1) * filasPorPagina + 1}–{Math.min(pagina * filasPorPagina, movimientos.length)} de {movimientos.length}</span>
              <div><button type="button" className="finanzas-boton finanzas-boton-secundario" onClick={() => setPagina(actual => Math.max(1, actual - 1))} disabled={pagina === 1}>Anterior</button>
                <span>Página {pagina} de {totalPaginas}</span>
                <button type="button" className="finanzas-boton finanzas-boton-secundario" onClick={() => setPagina(actual => Math.min(totalPaginas, actual + 1))} disabled={pagina === totalPaginas}>Siguiente</button></div>
            </nav>}
          </div>
        </>}
      </>}
    </div>
    </>}
  </section>;
}
