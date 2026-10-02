import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { supabase } from '../lib/supabase.js';
import { getMediosPago } from '../services/catalogos.js';
import * as cajaReal from '../services/caja.js';
import { crearCajaDemo } from '../services/cajaDemo.js';
import { Link } from 'react-router-dom';
import { Wallet, ArrowDownLeft, ArrowUpRight, RefreshCw, RotateCcw, CreditCard, Landmark, ReceiptText } from 'lucide-react';
import './MovimientosCaja.css';

const pesos = (value) => Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const inicial = { tipo: 'Ingreso', concepto: '', importe: '', medioPagoId: '' };

export default function MovimientosCaja({ demo = false }) {
  const [simulador] = useState(crearCajaDemo);
  const { getContextoCaja, getMovimientosCaja, registrarMovimientoCaja } = demo ? simulador : cajaReal;
  const cargarMedios = demo ? simulador.getMediosPago : getMediosPago;
  const [turnos, setTurnos] = useState([]);
  const [turnoId, setTurnoId] = useState('');
  const [medios, setMedios] = useState([]);
  const [detalle, setDetalle] = useState({ turnoId: '', movimientos: [] });
  const [form, setForm] = useState(inicial);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [pendiente, setPendiente] = useState(null);
  const ocupado = useRef(false);

  useEffect(() => {
    let activo = true;
    async function cargar() {
      setCargando(true);
      try {
        const [contexto, catalogo] = await Promise.all([getContextoCaja(), cargarMedios()]);
        if (catalogo.error) throw catalogo.error;
        if (!activo) return;
        setTurnos(contexto.turnos || []);
        setMedios((catalogo.data || []).filter(m => /efectivo|tarjeta|transferencia/i.test(m.nombre)));
        setTurnoId(actual => contexto.turnos?.some(t => String(t.id) === actual)
          ? actual : String(contexto.turnos?.[0]?.id || ''));
        setError('');
      } catch (e) {
        if (activo) { setError(e.message); setTurnos([]); setTurnoId(''); }
      } finally { if (activo) setCargando(false); }
    }
    cargar();
    return () => { activo = false; };
  }, [recarga, getContextoCaja, cargarMedios]);

  useEffect(() => {
    if (demo) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setRecarga(n => n + 1);
    });
    return () => subscription.unsubscribe();
  }, [demo]);

  useEffect(() => {
    let activo = true;
    if (turnoId) getMovimientosCaja(turnoId).then(data => {
      if (activo) setDetalle({ turnoId, movimientos: data });
    }).catch(e => { if (activo) setError(e.message); });
    return () => { activo = false; };
  }, [turnoId, recarga, getMovimientosCaja]);

  const turno = turnos.find(t => String(t.id) === turnoId);
  const movimientos = detalle.turnoId === turnoId ? detalle.movimientos : [];
  const totales = ['Efectivo', 'Tarjeta', 'Transferencia'].map(medio => ({
    medio,
    neto: movimientos.filter(m => m.medio === medio).reduce((s, m) => s + (m.tipo === 'Ingreso' ? Number(m.importe) : -Number(m.importe)), 0),
  }));

  async function confirmar(payload, mensaje) {
    if (ocupado.current) return;
    ocupado.current = true;
    setGuardando(true);
    try {
      const decision = await Swal.fire({ title: 'Confirmar movimiento', text: mensaje, icon: 'question', showCancelButton: true, confirmButtonText: 'Confirmar', cancelButtonText: 'Cancelar' });
      if (!decision.isConfirmed) return;
      // Se conserva la clave y el payload ante respuestas perdidas. El reintento
      // confirma exactamente la misma operación, incluso si el turno se cerró.
      const operacion = pendiente || { ...payload, clave: crypto.randomUUID() };
      setPendiente(operacion);
      await registrarMovimientoCaja(operacion);
      setPendiente(null);
      setForm(inicial);
      setRecarga(n => n + 1);
      await Swal.fire('Registrado', 'El movimiento quedó registrado correctamente.', 'success');
    } catch (e) {
      // Una excepción SQL confirma que la transacción fue rechazada. Una falla
      // de red puede ocultar un éxito: en ese caso conservamos el reintento.
      const rechazo = /^[0-9A-Z]{5}$/.test(e.code || '');
      if (rechazo) setPendiente(null);
      await Swal.fire('No se pudo confirmar', `${e.message}${rechazo ? '' : '. Podés reintentar la misma confirmación.'}`, 'error');
    } finally { ocupado.current = false; setGuardando(false); }
  }

  function enviar(e) {
    e.preventDefault();
    if (!turno || guardando) return;
    const importe = Number(form.importe);
    if (!Number.isFinite(importe) || importe <= 0 || !/^\d+(\.\d{1,2})?$/.test(form.importe) || !form.concepto.trim()) {
      setError('Ingresá un concepto y un importe positivo con hasta dos decimales.'); return;
    }
    setError('');
    confirmar({ turnoId: turno.id, ...form, concepto: form.concepto.trim(), importe },
      `${form.tipo} de ${pesos(importe)} · ${medios.find(m => String(m.id_medio_pago) === form.medioPagoId)?.nombre} · ${turno.caja} · Sucursal ${turno.sucursal_id} · ${form.concepto.trim()}`);
  }

  async function revertir(movimiento) {
    if (ocupado.current || pendiente) return;
    const { value: motivo, isConfirmed } = await Swal.fire({ title: `Revertir movimiento #${movimiento.id}`, input: 'text', inputLabel: 'Motivo obligatorio', showCancelButton: true, confirmButtonText: 'Continuar', cancelButtonText: 'Cancelar', inputValidator: value => !value?.trim() ? 'Ingresá el motivo.' : undefined });
    if (isConfirmed) confirmar({ turnoId: movimiento.turno_id, originalId: movimiento.id, concepto: motivo.trim() },
      `Reversión completa del ${movimiento.tipo.toLowerCase()} de ${pesos(movimiento.importe)}. Motivo: ${motivo.trim()}`);
  }

  return <section className="caja-page">
    <header className="caja-header">
      <div><span className="caja-eyebrow">GESTIÓN DE CAJA</span><h1>Movimientos de caja</h1><p>Registrá las entradas y salidas de dinero de tu turno.</p></div>
      <button className="caja-button secondary" disabled={guardando || cargando} onClick={() => setRecarga(n => n + 1)}><RefreshCw size={16} /> Actualizar</button>
    </header>
    {demo ? <details className="caja-demo-tools"><summary>Vista de demostración</summary><div className="caja-actions"><button className="caja-button secondary" disabled={guardando || !!pendiente} onClick={() => { simulador.cerrar(); setRecarga(n => n + 1); }}>Simular cierre</button><button className="caja-button secondary" disabled={guardando || !!pendiente} onClick={() => { simulador.reiniciar(); setDetalle({ turnoId: '', movimientos: [] }); setForm(inicial); setRecarga(n => n + 1); }}><RotateCcw size={15} /> Reiniciar</button></div></details> : import.meta.env.DEV && <Link className="caja-demo-link" to="/demo/hu50">Abrir vista de demostración</Link>}
    {error && <div role="alert" className="caja-error">{error}</div>}
    {cargando ? <div className="caja-empty" role="status">Cargando tus cajas disponibles…</div> : !turnos.length ? <div className="caja-empty"><Wallet size={32} /><h2>No hay un turno abierto</h2><p>{demo ? 'Reiniciá la demo para volver a trabajar con la caja de ejemplo.' : 'Necesitás iniciar sesión con permisos de caja y tener un turno abierto.'}</p></div> : <>
      <div className="caja-turno caja-panel"><div><span className="caja-badge">● Turno abierto</span><p>Los movimientos se registrarán en esta caja.</p></div>
        <label>Seleccioná tu turno<select value={turnoId} disabled={guardando || !!pendiente} onChange={e => setTurnoId(e.target.value)}>{turnos.map(t => <option key={t.id} value={t.id}>{t.caja} · Sucursal {t.sucursal_id} · Turno #{t.id}</option>)}</select></label>
      </div>
      <div className="caja-summary">
        <article className="caja-stat featured"><Wallet size={21} /><span>Efectivo disponible</span><strong>{pesos(turno?.efectivo_esperado || 0)}</strong><small>Base inicial: {pesos(turno?.saldo_inicial || 0)}</small></article>
        {totales.filter(t => t.medio !== 'Efectivo').map(t => <article className="caja-stat" key={t.medio}>{t.medio === 'Tarjeta' ? <CreditCard size={21} /> : <Landmark size={21} />}<span>{t.medio}</span><strong>{pesos(t.neto)}</strong><small>Neto de movimientos del turno</small></article>)}
      </div>
      <form onSubmit={enviar} className="caja-panel caja-form">
        <div className="caja-section-title"><div><h2>Nuevo movimiento</h2><p>Completá los datos y revisalos antes de confirmar.</p></div><ReceiptText size={22} /></div>
        <fieldset disabled={guardando || !!pendiente}>
          <div className="caja-type" role="group" aria-label="Tipo de movimiento">{['Ingreso', 'Egreso'].map(tipo => <button type="button" key={tipo} aria-pressed={form.tipo === tipo} className={form.tipo === tipo ? 'selected ' + tipo.toLowerCase() : ''} onClick={() => setForm({ ...form, tipo })}>{tipo === 'Ingreso' ? <ArrowDownLeft size={19} /> : <ArrowUpRight size={19} />}{tipo}<small>{tipo === 'Ingreso' ? 'Entra dinero' : 'Sale dinero'}</small></button>)}</div>
          <div className="caja-fields">
            <label className="caja-concepto">Concepto<input required placeholder="Ej.: fondo de caja o pago de un gasto" value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} /><small>Indicá el motivo para identificar el movimiento.</small></label>
            <label>Importe en pesos<input required type="number" min="0.01" max="999999999999.99" step="0.01" placeholder="0,00" value={form.importe} onChange={e => setForm({ ...form, importe: e.target.value })} /></label>
            <label>Medio de pago<select required value={form.medioPagoId} onChange={e => setForm({ ...form, medioPagoId: e.target.value })}><option value="">Seleccioná un medio</option>{medios.map(m => <option key={m.id_medio_pago} value={m.id_medio_pago}>{m.nombre}</option>)}</select></label>
          </div>
        </fieldset>
        <footer><span>La fecha, la caja y el usuario se asignan automáticamente.</span>{!pendiente && <button className="caja-button" disabled={guardando || !turno}>{guardando ? 'Confirmando…' : 'Registrar ' + form.tipo.toLowerCase()}</button>}</footer>
      </form>
    </>}
    {pendiente && <div role="status" className="caja-demo"><p>La confirmación está pendiente de verificar. Reintentá para comprobar si quedó registrada.</p><button className="caja-button" disabled={guardando} onClick={() => confirmar(pendiente, 'Reintentar la misma operación sin duplicarla')}>Reintentar confirmación</button></div>}
    {turno && <section className="caja-panel caja-history">
      <div className="caja-section-title"><div><h2>Historial del turno <span className="caja-count">{movimientos.length}</span></h2><p>Los movimientos confirmados se corrigen mediante una reversión.</p></div></div>
      {!movimientos.length ? <div className="caja-empty"><ReceiptText size={30} /><h3>Tu primer movimiento empieza acá</h3><p>Al registrar un ingreso o egreso, aparecerá en este historial.</p></div> : <div className="caja-table-wrap"><table><thead><tr>{['Movimiento', 'Concepto', 'Importe', 'Medio', 'Registrado por', 'Estado', ''].map((h, i) => <th key={i} scope="col">{h || <span className="caja-sr-only">Acciones</span>}</th>)}</tr></thead>
        <tbody>{movimientos.map(m => {
          const revertido = movimientos.some(r => r.movimiento_original_id === m.id);
          return <tr key={m.id}><td><span className={'caja-badge ' + m.tipo.toLowerCase()}>{m.tipo}</span><small>#{m.id} · {new Date(m.fecha_hora).toLocaleString('es-AR')}</small></td><td className="caja-table-concept">{m.concepto}{m.movimiento_original_id && <small>Reversión del movimiento #{m.movimiento_original_id}</small>}</td><td className={'caja-money ' + m.tipo.toLowerCase()}>{m.tipo === 'Ingreso' ? '+' : '−'} {pesos(m.importe)}</td><td>{m.medio}</td><td>Usuario #{m.usuario_id}</td><td>{revertido ? 'Revertido' : m.origen === 'Reversion' ? 'Reversión' : 'Confirmado'}</td><td>{m.origen === 'Manual' && !revertido && <button className="caja-revert" disabled={guardando || !!pendiente} onClick={() => revertir(m)} aria-label={'Revertir movimiento ' + m.id}><RotateCcw size={14} /> Revertir</button>}</td></tr>;
        })}</tbody></table></div>}
    </section>}
  </section>;
}
