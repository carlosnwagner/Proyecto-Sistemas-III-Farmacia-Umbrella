import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { supabase } from '../lib/supabase.js';
import { getMediosPago } from '../services/catalogos.js';
import { getContextoCaja, getMovimientosCaja, registrarMovimientoCaja } from '../services/caja.js';

const pesos = (value) => Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const control = { padding: '.7rem', border: '1px solid #cbd5e1', borderRadius: 6, width: '100%', boxSizing: 'border-box' };
const button = { padding: '.7rem 1rem', border: 0, borderRadius: 6, background: '#166534', color: 'white', cursor: 'pointer' };
const inicial = { tipo: 'Ingreso', concepto: '', importe: '', medioPagoId: '' };

export default function MovimientosCaja() {
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
        const [contexto, catalogo] = await Promise.all([getContextoCaja(), getMediosPago()]);
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
  }, [recarga]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setRecarga(n => n + 1);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let activo = true;
    if (turnoId) getMovimientosCaja(turnoId).then(data => {
      if (activo) setDetalle({ turnoId, movimientos: data });
    }).catch(e => { if (activo) setError(e.message); });
    return () => { activo = false; };
  }, [turnoId, recarga]);

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

  return <section style={{ color: '#1f2937' }}>
    <h1>Movimientos de caja</h1>
    <p>Registrá ingresos y egresos manuales del turno abierto.</p>
    {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
    <button style={button} disabled={guardando || cargando} onClick={() => setRecarga(n => n + 1)}>Actualizar</button>
    {cargando ? <p>Cargando cajas autorizadas…</p> : !turnos.length ? <p>No hay turnos abiertos disponibles. Primero iniciá sesión y abrí una caja autorizada.</p> : <>
      <label style={{ display: 'block', margin: '1rem 0' }}>Turno abierto
        <select style={control} value={turnoId} disabled={guardando || !!pendiente} onChange={e => setTurnoId(e.target.value)}>
          {turnos.map(t => <option key={t.id} value={t.id}>{t.caja} · Sucursal {t.sucursal_id} · Turno #{t.id}</option>)}
        </select>
      </label>
      <p>Base inicial: {pesos(turno?.saldo_inicial || 0)} · Efectivo esperado: <strong>{pesos(turno?.efectivo_esperado || 0)}</strong></p>
      <form onSubmit={enviar} style={{ background: 'white', padding: '1rem', borderRadius: 10, display: 'grid', gap: '1rem' }}>
        <fieldset disabled={guardando || !!pendiente} style={{ border: 0, padding: 0, display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label>Tipo<select style={control} value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}><option>Ingreso</option><option>Egreso</option></select></label>
          <label>Concepto<input style={control} required value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} /></label>
          <label>Importe $<input style={control} required type="number" min="0.01" max="999999999999.99" step="0.01" value={form.importe} onChange={e => setForm({ ...form, importe: e.target.value })} /></label>
          <label>Medio de pago<select style={control} required value={form.medioPagoId} onChange={e => setForm({ ...form, medioPagoId: e.target.value })}><option value="">Seleccioná un medio</option>{medios.map(m => <option key={m.id_medio_pago} value={m.id_medio_pago}>{m.nombre}</option>)}</select></label>
        </fieldset>
        {!pendiente && <button style={button} disabled={guardando || !turno}>Registrar movimiento</button>}
      </form>
    </>}
    {pendiente && <div role="status" style={{ margin: '1rem 0' }}>
      <p>Hay una confirmación pendiente de verificar. Reintentá para comprobar si quedó registrada.</p>
      <button style={button} disabled={guardando} onClick={() => confirmar(pendiente, 'Reintentar la misma operación sin duplicarla')}>Reintentar confirmación</button>
    </div>}
    {turno && <>
      <p>{totales.map(t => `${t.medio}: ${pesos(t.neto)} netos`).join(' · ')}</p>
      <div style={{ overflowX: 'auto', marginTop: '1rem' }}><table style={{ width: '100%', background: 'white', borderCollapse: 'collapse' }}>
        <thead><tr>{['Fecha', 'Tipo', 'Concepto', 'Importe', 'Medio', 'Usuario', 'Origen', 'Acciones'].map(h => <th key={h} style={{ textAlign: 'left', padding: '.6rem' }}>{h}</th>)}</tr></thead>
        <tbody>{movimientos.map(m => <tr key={m.id}>
          <td>{new Date(m.fecha_hora).toLocaleString('es-AR')}</td><td>{m.tipo}</td><td>{m.concepto}</td><td>{pesos(m.importe)}</td><td>{m.medio}</td><td>#{m.usuario_id}</td>
          <td>{m.origen}{m.movimiento_original_id && ` de #${m.movimiento_original_id}`}{movimientos.some(r => r.movimiento_original_id === m.id) && ' · Revertido'}</td>
          <td>{m.origen === 'Manual' && !movimientos.some(r => r.movimiento_original_id === m.id) && <button disabled={guardando || !!pendiente} onClick={() => revertir(m)}>Revertir</button>}</td>
        </tr>)}</tbody>
      </table>{!movimientos.length && <p>Este turno todavía no tiene movimientos.</p>}</div>
    </>}
  </section>;
}
