import { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { supabase } from '../lib/supabase.js';
import { getMediosPago } from '../services/catalogos.js';
import { getContextoCaja, getMovimientosCaja, registrarMovimientoCaja } from '../services/caja.js';
import { Wallet, ArrowDownLeft, ArrowUpRight, RefreshCw, RotateCcw, CreditCard, Landmark, ReceiptText } from 'lucide-react';

const pesos = (value) => Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
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
        if (activo) { 
          setError(e.message); 
          setTurnos([]); 
          setTurnoId(''); 
        }
      } finally { 
        if (activo) setCargando(false); 
      }
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
    if (turnoId) {
      getMovimientosCaja(turnoId).then(data => {
        if (activo) setDetalle({ turnoId, movimientos: data });
      }).catch(e => { 
        if (activo) setError(e.message); 
      });
    }
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
      const decision = await Swal.fire({ 
        title: 'Confirmar movimiento', 
        text: mensaje, 
        icon: 'question', 
        showCancelButton: true, 
        confirmButtonText: 'Confirmar', 
        cancelButtonText: 'Cancelar' 
      });
      if (!decision.isConfirmed) {
        ocupado.current = false;
        setGuardando(false);
        return;
      }

      const operacion = pendiente || { ...payload, clave: crypto.randomUUID() };
      setPendiente(operacion);
      
      await registrarMovimientoCaja(operacion);
      
      setPendiente(null);
      setForm(inicial);
      setRecarga(n => n + 1);
      await Swal.fire('Registrado', 'El movimiento quedó registrado correctamente.', 'success');
    } catch (e) {
      const rechazo = /^[0-9A-Z]{5}$/.test(e.code || '');
      if (rechazo) setPendiente(null);
      await Swal.fire('No se pudo confirmar', `${e.message}${rechazo ? '' : '. Podés reintentar la misma confirmación.'}`, 'error');
    } finally { 
      ocupado.current = false; 
      setGuardando(false); 
    }
  }

  function enviar(e) {
    e.preventDefault();
    if (!turno || guardando) return;
    
    const importe = Number(form.importe);
    if (!Number.isFinite(importe) || importe <= 0 || !/^\d+(\.\d{1,2})?$/.test(form.importe) || !form.concepto.trim()) {
      setError('Ingresá un concepto y un importe positivo con hasta dos decimales.'); 
      return;
    }

    const medioSeleccionado = medios.find(m => String(m.id_medio_pago) === form.medioPagoId);
    if (form.tipo === 'Egreso' && medioSeleccionado && /efectivo/i.test(medioSeleccionado.nombre)) {
      const efectivoDisponible = Number(turno.efectivo_esperado || 0);
      if (importe > efectivoDisponible) {
        setError(`No se puede realizar el egreso: el importe excede el efectivo disponible en caja (${pesos(efectivoDisponible)}).`);
        return;
      }
    }

    setError('');
    confirmar({ 
      turnoId: turno.id, 
      tipo: form.tipo,
      concepto: form.concepto.trim(), 
      importe, 
      medioPagoId: form.medioPagoId 
    }, `${form.tipo} de ${pesos(importe)} · ${medioSeleccionado?.nombre} · ${turno.caja} · Sucursal ${turno.sucursal_id} · ${form.concepto.trim()}`);
  }

  async function revertir(movimiento) {
    if (ocupado.current || pendiente) return;
    const { value: motivo, isConfirmed } = await Swal.fire({ 
      title: `Revertir movimiento #${movimiento.id}`, 
      input: 'text', 
      inputLabel: 'Motivo obligatorio', 
      showCancelButton: true, 
      confirmButtonText: 'Continuar', 
      cancelButtonText: 'Cancelar', 
      inputValidator: value => !value?.trim() ? 'Ingresá el motivo.' : undefined 
    });
    
    if (isConfirmed) {
      confirmar({ 
        turnoId: movimiento.turno_id, 
        originalId: movimiento.id, 
        concepto: motivo.trim(),
        tipo: movimiento.tipo === 'Ingreso' ? 'Egreso' : 'Ingreso',
        importe: movimiento.importe,
        medioPagoId: movimiento.medio_pago_id
      }, `Reversión completa del ${movimiento.tipo.toLowerCase()} de ${pesos(movimiento.importe)}. Motivo: ${motivo.trim()}`);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 text-slate-800">
      <div className="flex justify-between items-center mb-6">
        <div>
          <span className="text-xs font-bold tracking-wider text-emerald-700 uppercase">Gestión de Caja</span>
          <h1 className="text-2xl font-bold text-slate-900">Movimientos de caja</h1>
          <p className="text-sm text-slate-500">Registrá las entradas y salidas de dinero de tu turno actual.</p>
        </div>
        <button 
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition flex items-center gap-2 cursor-pointer disabled:opacity-50" 
          disabled={guardando || cargando} 
          onClick={() => setRecarga(n => n + 1)}
        >
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-6 text-sm" role="alert">{error}</div>}

      {cargando ? (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center text-slate-500" role="status">Cargando cajas y turnos autorizados…</div>
      ) : !turnos.length ? (
        <div className="bg-white p-12 rounded-xl shadow-sm border border-slate-200 text-center">
          <Wallet className="mx-auto text-slate-400 mb-3" size={36} />
          <h2 className="text-lg font-semibold text-slate-800 mb-1">No hay un turno abierto</h2>
          <p className="text-sm text-slate-500">Necesitás iniciar sesión con permisos de caja y tener un turno abierto para registrar movimientos manuales.</p>
        </div>
      ) : (
        <>
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Turno abierto
              </span>
              <p className="text-xs text-slate-500">Los movimientos manuales se registrarán en esta sesión activa.</p>
            </div>
            <label className="text-sm font-medium text-slate-700 flex flex-col gap-1 w-full md:w-auto">
              Seleccioná tu turno
              <select 
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={turnoId} 
                disabled={guardando || !!pendiente} 
                onChange={e => setTurnoId(e.target.value)}
              >
                {turnos.map(t => (
                  <option key={t.id} value={t.id}>{t.caja} · Sucursal {t.sucursal_id} · Turno #{t.id}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-emerald-900 text-white p-5 rounded-xl shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <span className="text-xs font-medium text-emerald-200 uppercase tracking-wider">Efectivo disponible</span>
                <Wallet size={20} className="text-emerald-300" />
              </div>
              <div>
                <strong className="text-2xl font-bold tracking-tight">{pesos(turno?.efectivo_esperado || 0)}</strong>
                <p className="text-xs text-emerald-300 mt-1">Base inicial: {pesos(turno?.saldo_inicial || 0)}</p>
              </div>
            </div>
            {totales.filter(t => t.medio !== 'Efectivo').map(t => (
              <div key={t.medio} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t.medio}</span>
                  {t.medio === 'Tarjeta' ? <CreditCard size={20} className="text-slate-400" /> : <Landmark size={20} className="text-slate-400" />}
                </div>
                <div>
                  <strong className="text-2xl font-bold text-slate-900 tracking-tight">{pesos(t.neto)}</strong>
                  <p className="text-xs text-slate-400 mt-1">Neto de movimientos del turno</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={enviar} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Nuevo movimiento</h2>
                <p className="text-xs text-slate-500">Completá los datos requeridos para la trazabilidad.</p>
              </div>
              <ReceiptText size={22} className="text-slate-400" />
            </div>

            <fieldset disabled={guardando || !!pendiente} className="space-y-6">
              <div className="grid grid-cols-2 gap-3 max-w-md">
                {['Ingreso', 'Egreso'].map(tipo => (
                  <button 
                    type="button" 
                    key={tipo} 
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-semibold transition cursor-pointer ${
                      form.tipo === tipo 
                        ? tipo === 'Ingreso' ? 'bg-emerald-50 border-emerald-600 text-emerald-800' : 'bg-red-50 border-red-600 text-red-800' 
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                    onClick={() => setForm({ ...form, tipo })}
                  >
                    {tipo === 'Ingreso' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                    {tipo}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Concepto obligatorio</label>
                  <input 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Ej.: Pago de servicios" 
                    value={form.concepto} 
                    onChange={e => setForm({ ...form, concepto: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Importe en pesos ($)</label>
                  <input 
                    required 
                    type="number" 
                    min="0.01" 
                    max="999999999999.99" 
                    step="0.01" 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0,00" 
                    value={form.importe} 
                    onChange={e => setForm({ ...form, importe: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Medio de pago</label>
                  <select 
                    required 
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={form.medioPagoId} 
                    onChange={e => setForm({ ...form, medioPagoId: e.target.value })}
                  >
                    <option value="">Seleccioná un medio</option>
                    {medios.map(m => <option key={m.id_medio_pago} value={m.id_medio_pago}>{m.nombre}</option>)}
                  </select>
                </div>
              </div>
            </fieldset>

            <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
              <span className="text-xs text-slate-400">La fecha, caja, sucursal y usuario quedan vinculados automáticamente.</span>
              {!pendiente && (
                <button 
                  className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-xl text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
                  disabled={guardando || !turno}
                >
                  {guardando ? 'Registrando…' : 'Registrar ' + form.tipo.toLowerCase()}
                </button>
              )}
            </div>
          </form>
        </>
      )}

      {pendiente && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl mb-6 flex justify-between items-center" role="status">
          <p className="text-sm text-amber-800">Hay una confirmación pendiente. Reintentá para verificar el estado en la base de datos sin duplicar.</p>
          <button 
            className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-sm font-medium transition cursor-pointer" 
            disabled={guardando} 
            onClick={() => confirmar(pendiente, 'Reintentar la misma operación')}
          >
            Reintentar confirmación
          </button>
        </div>
      )}

      {turno && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Historial del turno</h2>
              <p className="text-xs text-slate-500">Movimientos confirmados e inmutables (corrección mediante reversión).</p>
            </div>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold">{movimientos.length}</span>
          </div>

          {!movimientos.length ? (
            <div className="p-12 text-center text-slate-400">
              <ReceiptText className="mx-auto mb-2 text-slate-300" size={32} />
              <p className="text-sm font-medium text-slate-600">Sin movimientos manuales</p>
              <p className="text-xs text-slate-400">Los ingresos y egresos registrados aparecerán reflejados en este listado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-200">
                    <th className="p-4 font-semibold">Movimiento</th>
                    <th className="p-4 font-semibold">Concepto</th>
                    <th className="p-4 font-semibold">Importe</th>
                    <th className="p-4 font-semibold">Medio</th>
                    <th className="p-4 font-semibold">Usuario</th>
                    <th className="p-4 font-semibold">Estado</th>
                    <th className="p-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movimientos.map(m => {
                    const revertido = movimientos.some(r => r.movimiento_original_id === m.id);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="p-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${m.tipo === 'Ingreso' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                            {m.tipo}
                          </span>
                          <span className="block text-xs text-slate-400 mt-0.5">#{m.id} · {new Date(m.fecha_hora).toLocaleString('es-AR')}</span>
                        </td>
                        <td className="p-4 text-slate-700 font-medium">
                          {m.concepto}
                          {m.movimiento_original_id && <span className="block text-xs text-slate-400">Reversión del movimiento #{m.movimiento_original_id}</span>}
                        </td>
                        <td className={`p-4 font-bold ${m.tipo === 'Ingreso' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {m.tipo === 'Ingreso' ? '+' : '−'} {pesos(m.importe)}
                        </td>
                        <td className="p-4 text-slate-600">{m.medio}</td>
                        <td className="p-4 text-slate-600">Usuario #{m.usuario_id}</td>
                        <td className="p-4">
                          <span className="text-xs font-medium text-slate-600">
                            {revertido ? 'Revertido' : m.origen === 'Reversion' ? 'Reversión' : 'Confirmado'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          {m.origen === 'Manual' && !revertido && (
                            <button 
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-xs font-medium transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50" 
                              disabled={guardando || !!pendiente} 
                              onClick={() => revertir(m)}
                            >
                              <RotateCcw size={12} /> Revertir
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}