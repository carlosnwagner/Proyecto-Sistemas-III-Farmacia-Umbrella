import { useEffect, useRef, useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import { supabase } from '../lib/supabase.js';
import { getMediosPago } from '../services/catalogos.js';
import { getContextoCaja, getMovimientosCaja, registrarMovimientoCaja } from '../services/caja.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Wallet, ArrowDownLeft, ArrowUpRight, RefreshCw, RotateCcw, CreditCard, Landmark, ReceiptText, PlusCircle, X } from 'lucide-react';
import '../App.css';

const pesos = (value) => Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
const inicial = { tipo: 'Ingreso', concepto: '', importe: '', medioPagoId: '' };

const capitalizarTexto = (str) => {
  if (!str) return '';
  const limpio = str.trimStart();
  if (limpio.length === 0) return '';
  return limpio.charAt(0).toUpperCase() + limpio.slice(1).toLowerCase();
};

export default function MovimientosCaja() {
  const { profile } = useAuth();
  const [turnos, setTurnos] = useState([]);
  const [medios, setMedios] = useState([]);
  const [detalle, setDetalle] = useState({ turnoId: '', movimientos: [] });
  const [form, setForm] = useState(inicial);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [mostrarModalNuevo, setMostrarModalNuevo] = useState(false);
  
  // Estados para filtros de fecha y tipo de caja
  const [filtroCaja, setFiltroCaja] = useState('Todas');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const ocupado = useRef(false);

  const cargarDatos = useCallback(async () => {
    if (!profile?.id_usuario) {
      setCargando(false);
      return;
    }
    setCargando(true);
    try {
      const [contexto, catalogo] = await Promise.all([
        getContextoCaja(profile.id_usuario), 
        getMediosPago()
      ]);
      if (catalogo.error) throw catalogo.error;
      
      setTurnos(contexto.turnos || []);
      setMedios((catalogo.data || []).filter(m => /efectivo|tarjeta|transferencia/i.test(m.nombre)));
      setError('');
    } catch (e) {
      setError(e.message); 
      setTurnos([]); 
    } finally { 
      setCargando(false); 
    }
  }, [profile]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos, recarga]);

  const turnoActivo = turnos[0] || null;

  useEffect(() => {
    let activo = true;
    if (turnoActivo?.id) {
      getMovimientosCaja(turnoActivo.id).then(res => {
        if (activo) setDetalle({ turnoId: turnoActivo.id, movimientos: res || [] });
      }).catch(e => { 
        if (activo) setError(e.message); 
      });
    }
    return () => { activo = false; };
  }, [turnoActivo?.id, recarga]);

  const movimientosCrudos = detalle.turnoId === turnoActivo?.id ? detalle.movimientos : [];
  
  // Aplicar filtros de Caja y Fechas
  const movimientos = movimientosCrudos.filter(m => {
    const cumpleCaja = filtroCaja === 'Todas' || String(turnoActivo?.caja_id) === String(filtroCaja) || String(m.caja_id) === String(filtroCaja);
    const fechaMov = new Date(m.fecha_hora).toISOString().split('T')[0];
    const cumpleDesde = !fechaDesde || fechaMov >= fechaDesde;
    const cumpleHasta = !fechaHasta || fechaMov <= fechaHasta;
    return cumpleCaja && cumpleDesde && cumpleHasta;
  });

  const totales = ['Efectivo', 'Tarjeta', 'Transferencia'].map(medio => ({
    medio,
    neto: movimientos
      .filter(m => (m.medio_pago_nombre || m.medio || '').toLowerCase().includes(medio.toLowerCase()))
      .reduce((s, m) => s + (m.tipo === 'Ingreso' ? Number(m.importe) : -Number(m.importe)), 0),
  }));

  const efectivoMovimientos = movimientos
    .filter(m => /efectivo/i.test(m.medio_pago_nombre || m.medio || ''))
    .reduce((s, m) => s + (m.tipo === 'Ingreso' ? Number(m.importe) : -Number(m.importe)), 0);

  const efectivoDisponible = Number(turnoActivo?.saldo_inicial || 0) + efectivoMovimientos;

  async function enviar(e) {
    e.preventDefault();
    if (!turnoActivo || guardando || ocupado.current) return;
    
    const importe = Number(form.importe);
    const conceptoLimpio = capitalizarTexto(form.concepto);

    if (!Number.isFinite(importe) || importe <= 0 || !conceptoLimpio || !form.medioPagoId) {
      Swal.fire({ title: 'Atención', text: 'Completá todos los campos obligatorios correctamente.', icon: 'warning', customClass: { container: 'swal-top-zindex' } });
      return;
    }

    const medioSeleccionado = medios.find(m => String(m.id_medio_pago) === String(form.medioPagoId));
    if (form.tipo === 'Egreso' && medioSeleccionado && /efectivo/i.test(medioSeleccionado.nombre)) {
      if (importe > efectivoDisponible) {
        Swal.fire({ title: 'Fondos insuficientes', text: `No se puede realizar el egreso: excede el efectivo disponible (${pesos(efectivoDisponible)}).`, icon: 'error', customClass: { container: 'swal-top-zindex' } });
        return;
      }
    }

    ocupado.current = true;
    setGuardando(true);
    setError('');

    try {
      await registrarMovimientoCaja({
        turnoId: turnoActivo.id,
        tipo: form.tipo,
        concepto: conceptoLimpio,
        importe,
        medioPagoId: form.medioPagoId
      });

      setForm(inicial);
      setMostrarModalNuevo(false);
      setRecarga(n => n + 1);
      await Swal.fire({ title: 'Registrado', text: 'El movimiento quedó registrado correctamente.', icon: 'success', customClass: { container: 'swal-top-zindex' } });
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.message || 'Ocurrió un error al registrar el movimiento.', icon: 'error', customClass: { container: 'swal-top-zindex' } });
    } finally {
      ocupado.current = false;
      setGuardando(false);
    }
  }

  async function revertir(movimiento) {
    if (ocupado.current) return;
    const { value: motivoRaw, isConfirmed } = await Swal.fire({ 
      title: `Revertir movimiento #${movimiento.id}`, 
      input: 'text', 
      inputLabel: 'Motivo obligatorio', 
      showCancelButton: true, 
      confirmButtonText: 'Continuar', 
      cancelButtonText: 'Cancelar', 
      inputValidator: value => !value?.trim() ? 'Ingresá el motivo.' : undefined,
      customClass: { container: 'swal-top-zindex' }
    });
    
    if (isConfirmed && motivoRaw) {
      const motivo = capitalizarTexto(motivoRaw);
      ocupado.current = true;
      setGuardando(true);
      try {
        await registrarMovimientoCaja({
          turnoId: movimiento.turno_id,
          originalId: movimiento.id,
          concepto: motivo,
          tipo: movimiento.tipo === 'Ingreso' ? 'Egreso' : 'Ingreso',
          importe: movimiento.importe,
          medioPagoId: movimiento.medio_pago_id
        });
        setRecarga(n => n + 1);
        await Swal.fire({ title: 'Revertido', text: 'La reversión se completó con éxito.', icon: 'success', customClass: { container: 'swal-top-zindex' } });
      } catch (err) {
        Swal.fire({ title: 'Error', text: err.message || 'Error al procesar la reversión.', icon: 'error', customClass: { container: 'swal-top-zindex' } });
      } finally {
        ocupado.current = false;
        setGuardando(false);
      }
    }
  }

  return (
    <div style={{ width: '100%', margin: '0', padding: '1.5rem 2rem', boxSizing: 'border-box' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gestión de Caja</span>
          <h1 className="titulo-pagina" style={{ margin: '0.2rem 0 0.25rem 0' }}>Movimientos y saldos</h1>
          <p className="subtitulo" style={{ margin: 0 }}>Consultá las operaciones reales de tu turno o registrá entradas y salidas manuales.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setMostrarModalNuevo(true)}
            disabled={!turnoActivo}
            className="boton-principal"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap', opacity: !turnoActivo ? 0.5 : 1 }}
          >
            <PlusCircle size={16} /> + Nuevo Movimiento
          </button>

          <button 
            type="button"
            onClick={() => setRecarga(n => n + 1)}
            disabled={guardando || cargando}
            style={{ background: '#ffffff', border: '1px solid #d1d5db', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}
          >
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
      </div>

      {error && <div style={{ backgroundColor: '#fee2e2', border: '1px solid #f87171', color: '#b91c1c', padding: '0.75rem 1rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>{error}</div>}

      {cargando ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Cargando cajas y turnos autorizados…</div>
      ) : !turnoActivo ? (
        <div style={{ backgroundColor: '#fff', padding: '3rem', textAlign: 'center', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}>
          <Wallet size={36} color="#65482b" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#111827', margin: '0 0 0.25rem' }}>No hay un turno abierto</h2>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>Necesitás iniciar sesión con permisos de cajero y tener un turno abierto para registrar movimientos manuales.</p>
        </div>
      ) : (
        <>
          <div style={{ backgroundColor: '#ffffff', padding: '1.25rem 1.5rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span style={{ backgroundColor: '#f0fdf4', color: '#166534', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#166534' }}></span> Turno abierto
              </span>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>Los movimientos manuales se registrarán en esta sesión activa.</p>
            </div>
            <div style={{ backgroundColor: '#f9fafb', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Turno Asignado</span>
              <strong style={{ fontSize: '0.9rem', color: '#111827' }}>{turnoActivo.caja} · Sucursal {turnoActivo.sucursal_id} · Turno #{turnoActivo.id}</strong>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: '#166534', color: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#dcfce7' }}>Efectivo disponible</span>
                <Wallet size={22} color="#dcfce7" />
              </div>
              <div>
                <strong style={{ fontSize: '1.6rem', fontWeight: '800' }}>{pesos(efectivoDisponible)}</strong>
                <p style={{ fontSize: '0.75rem', color: '#dcfce7', margin: '0.25rem 0 0' }}>Base inicial: {pesos(turnoActivo?.saldo_inicial || 0)}</p>
              </div>
            </div>
            {totales.filter(t => t.medio !== 'Efectivo').map(t => (
              <div key={t.medio} style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#6b7280' }}>{t.medio}</span>
                  {t.medio === 'Tarjeta' ? <CreditCard size={22} color="#9ca3af" /> : <Landmark size={22} color="#9ca3af" />}
                </div>
                <div>
                  <strong style={{ fontSize: '1.6rem', fontWeight: '800', color: '#111827' }}>{pesos(t.neto)}</strong>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>Neto de movimientos del turno</p>
                </div>
              </div>
            ))}
          </div>

          <div className="tabla-contenedor" style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            
            {/* Cabecera de la tabla con el título y los filtros a la par */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#111827', margin: 0 }}>Historial del turno</h2>

              {/* Filtros alineados a la par del título */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                <div>
                  <select 
                    value={filtroCaja} 
                    onChange={e => setFiltroCaja(e.target.value)}
                    style={{ padding: '0.4rem 0.6rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.8rem', backgroundColor: '#fff' }}
                  >
                    <option value="Todas">Todas las cajas</option>
                    {turnos.map(t => (
                      <option key={t.caja_id || t.id} value={t.caja_id || t.id}>{t.caja || `Caja #${t.caja_id}`}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600' }}>Desde:</span>
                  <input 
                    type="date" 
                    value={fechaDesde} 
                    onChange={e => setFechaDesde(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.8rem' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600' }}>Hasta:</span>
                  <input 
                    type="date" 
                    value={fechaHasta} 
                    onChange={e => setFechaHasta(e.target.value)}
                    style={{ padding: '0.35rem 0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', fontSize: '0.8rem' }}
                  />
                </div>

                {(filtroCaja !== 'Todas' || fechaDesde || fechaHasta) && (
                  <button
                    type="button"
                    onClick={() => { setFiltroCaja('Todas'); setFechaDesde(''); setFechaHasta(''); }}
                    style={{ background: 'none', border: 'none', color: '#b91c1c', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', padding: '0.2rem' }}
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {!movimientos.length ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                <ReceiptText size={32} color="#d1d5db" style={{ margin: '0 auto 0.5rem' }} />
                <p style={{ fontSize: '0.9rem', fontWeight: '600', color: '#4b5563', margin: '0 0 0.2rem' }}>Sin movimientos registrados</p>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>Los ingresos, ventas y egresos correspondientes aparecerán reflejados en este listado.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="tabla-facturas" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Movimiento</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Concepto</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Importe</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Medio</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Estado</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map(m => {
                      const revertido = movimientos.some(r => r.movimiento_original_id === m.id);
                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{ display: 'inline-block', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: m.tipo === 'Ingreso' ? '#dcfce7' : '#fee2e2', color: m.tipo === 'Ingreso' ? '#166534' : '#b91c1c' }}>
                              {m.tipo}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.2rem' }}>#{m.id} · {new Date(m.fecha_hora).toLocaleString('es-AR')}</span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: '#374151', fontWeight: '600', fontSize: '0.85rem' }}>
                            {m.concepto}
                            {m.movimiento_original_id && <span style={{ display: 'block', fontSize: '0.7rem', color: '#9ca3af' }}>Reversión del movimiento #{m.movimiento_original_id}</span>}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: '800', fontSize: '0.9rem', color: m.tipo === 'Ingreso' ? '#166534' : '#b91c1c' }}>
                            {m.tipo === 'Ingreso' ? '+' : '−'} {pesos(m.importe)}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: '#4b5563', fontSize: '0.85rem' }}>{m.medio_pago_nombre || m.medio || '-'}</td>
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', fontWeight: '600', color: '#4b5563' }}>
                            {revertido ? 'Revertido' : m.origen === 'Reversion' ? 'Reversión' : 'Confirmado'}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            {m.origen === 'Manual' && !revertido && (
                              <button 
                                type="button"
                                disabled={guardando} 
                                onClick={() => revertir(m)}
                                style={{ padding: '0.35rem 0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
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
        </>
      )}

      {mostrarModalNuevo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '0.85rem', maxWidth: '640px', width: '100%', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            <div style={{ backgroundColor: '#65482b', color: '#ffffff', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>Registrar entrada o salida manual</h3>
              <button type="button" onClick={() => setMostrarModalNuevo(false)} style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '2rem' }}>
              <form onSubmit={enviar}>
                <fieldset disabled={guardando} style={{ border: 0, padding: 0, margin: 0 }}>
                  
                  <div style={{ display: 'flex', gap: '1rem', maxWidth: '360px', marginBottom: '1.5rem' }}>
                    {['Ingreso', 'Egreso'].map(tipo => (
                      <button 
                        type="button" 
                        key={tipo} 
                        style={{
                          flex: 1, padding: '0.75rem 1rem', borderRadius: '0.5rem', border: form.tipo === tipo ? (tipo === 'Ingreso' ? '2px solid #166534' : '2px solid #dc2626') : '1px solid #d1d5db',
                          backgroundColor: form.tipo === tipo ? (tipo === 'Ingreso' ? '#f0fdf4' : '#fef2f2') : '#ffffff',
                          color: form.tipo === tipo ? (tipo === 'Ingreso' ? '#166534' : '#dc2626') : '#4b5563',
                          fontWeight: '700', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer'
                        }}
                        onClick={() => setForm({ ...form, tipo })}
                      >
                        {tipo === 'Ingreso' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                        {tipo}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Concepto obligatorio</label>
                      <input 
                        required 
                        className="campo-entrada"
                        placeholder="Ej.: Pago de servicios o retiro de cambio" 
                        value={form.concepto} 
                        onChange={e => {
                          const val = e.target.value.startsWith(' ') ? e.target.value.trimStart() : e.target.value;
                          setForm({ ...form, concepto: val });
                        }}
                        onBlur={() => {
                          setForm(prev => ({ ...prev, concepto: capitalizarTexto(prev.concepto) }));
                        }}
                        style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Importe en pesos ($)</label>
                      <input 
                        required 
                        type="number" 
                        min="0.01" 
                        step="0.01" 
                        onKeyDown={(e) => {
                          if (e.key === '-' || e.key === 'e') e.preventDefault();
                        }}
                        className="campo-entrada"
                        placeholder="0.00" 
                        value={form.importe} 
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '' || Number(val) >= 0) {
                            setForm({ ...form, importe: val });
                          }
                        }}
                        style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Medio de pago</label>
                      <select 
                        required 
                        className="select-campo"
                        value={form.medioPagoId} 
                        onChange={e => setForm({ ...form, medioPagoId: e.target.value })}
                        style={{ width: '100%', padding: '0.75rem', fontSize: '1rem' }}
                      >
                        <option value="">Seleccioná un medio</option>
                        {medios.map(m => <option key={m.id_medio_pago} value={m.id_medio_pago}>{m.nombre}</option>)}
                      </select>
                    </div>

                  </div>
                </fieldset>

                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingTop: '1.25rem', borderTop: '1px solid #e5e7eb', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setMostrarModalNuevo(false)}
                    style={{ padding: '0.7rem 1.25rem', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: '0.375rem', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="boton-principal"
                    disabled={guardando}
                    style={{ padding: '0.7rem 1.75rem', fontWeight: '700', fontSize: '0.9rem' }}
                  >
                    {guardando ? 'Registrando…' : 'Registrar ' + form.tipo.toLowerCase()}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}