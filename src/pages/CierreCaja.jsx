import { useRef, useState, useEffect } from 'react';
import useCajaTurnos from '../hooks/useCajaTurnos.js';
import { monedaCaja, fechaCaja } from '../lib/cajaFormato.js';
import { cerrarTurnoReal } from '../services/cajaTurnos.js';
import Swal from 'sweetalert2';
import { Lock, CheckCircle2, AlertTriangle, RefreshCw, ClipboardCheck, X, Clock, User, Wallet, CreditCard, ArrowLeftRight } from 'lucide-react';
import '../App.css';

export default function CierreCaja() {
  const caja = useCajaTurnos();
  const [contado, setContado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [mostrarModalCierre, setMostrarModalCierre] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const ocupado = useRef(false);

  useEffect(() => {
    if (caja.turnos && caja.turnos.length > 0 && !caja.turnoId) {
      caja.setTurnoId(String(caja.turnos[0].id));
    }
  }, [caja.turnos, caja.turnoId]);

  const turnoActual = caja.turno || (caja.turnos || []).find(t => String(t.id) === String(caja.turnoId));
  const cierreInfo = caja.detalle?.cierre || null;
  
  const saldoInicial = Number(turnoActual?.saldo_inicial || 0);
  const efectivoEsperado = cierreInfo?.efectivo_esperado ?? caja.detalle?.totales?.efectivo_esperado ?? saldoInicial;
  
  const efectivoContadoFinal = cierreInfo?.efectivo_contado ?? 0;
  const diferenciaFinal = cierreInfo?.diferencia ?? 0;
  const totalNetoTurnoFinal = cierreInfo?.total_neto_turno ?? 0;

  // Totales por otros medios guardados en el cierre o estimados
  const ingresosTarjeta = cierreInfo?.ingresos_tarjeta ?? 0;
  const egresosTarjeta = cierreInfo?.egresos_tarjeta ?? 0;
  const ingresosTransferencia = cierreInfo?.ingresos_transferencia ?? 0;
  const egresosTransferencia = cierreInfo?.egresos_transferencia ?? 0;

  const contadoNum = contado !== '' ? Number(contado) : null;
  const diferenciaModal = contadoNum !== null ? contadoNum - Number(efectivoEsperado) : null;

  async function guardar(e) {
    e.preventDefault();
    if (ocupado.current || !turnoActual) return;
    
    if (!Number.isFinite(contadoNum) || contadoNum < 0 || !/^\d+(\.\d{1,2})?$/.test(contado)) { 
      Swal.fire({ title: 'Atención', text: 'Ingresá un importe no negativo de hasta dos decimales.', icon: 'warning', customClass: { container: 'swal-top-zindex' } });
      return; 
    }

    // Criterio: Si hay faltante o sobrante, exige motivo u observación obligatoria
    if (diferenciaModal !== 0 && (!observaciones || observaciones.trim() === '')) {
      Swal.fire({ title: 'Observación requerida', text: 'Existe una diferencia (faltante o sobrante). Debes ingresar obligatoriamente un motivo u observación.', icon: 'warning', customClass: { container: 'swal-top-zindex' } });
      return;
    }

    ocupado.current = true;
    setGuardando(true);
    
    const versionMovimientos = turnoActual?.version_movimientos || 1;
    const p = { 
      turno: Number(turnoActual.id), 
      arqueo: contadoNum, 
      version: versionMovimientos, 
      observacion: observaciones, 
      clave: crypto.randomUUID() 
    };

    try {
      await cerrarTurnoReal(p);
      setContado(''); 
      setObservaciones('');
      setMostrarModalCierre(false);
      caja.actualizar();
      await Swal.fire({ title: 'Turno Cerrado', text: 'El cierre de caja se realizó correctamente.', icon: 'success', customClass: { container: 'swal-top-zindex' } });
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.message || 'No se pudo completar el cierre del turno.', icon: 'error', customClass: { container: 'swal-top-zindex' } });
    } finally { 
      ocupado.current = false; 
      setGuardando(false); 
    }
  }

  const nombreCajero = 'Carlos';

  return (
    <div style={{ width: '100%', margin: '0', padding: '1.5rem 2rem', boxSizing: 'border-box' }}>
      
      {/* Encabezado Principal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gestión de Caja</span>
          <h1 className="titulo-pagina" style={{ margin: '0.2rem 0 0.25rem 0' }}>Cierre de caja</h1>
          <p className="subtitulo" style={{ margin: 0 }}>Realizá el cierre definitivo de tu turno de trabajo.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setMostrarModalCierre(true)}
            disabled={!turnoActual || turnoActual.estado !== 'Abierto'}
            className="boton-principal"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap', opacity: (!turnoActual || turnoActual.estado !== 'Abierto') ? 0.5 : 1, cursor: 'pointer' }}
          >
            <Lock size={16} /> + Cerrar Turno
          </button>

          <button 
            type="button"
            disabled={caja.cargando} 
            onClick={caja.actualizar}
            style={{ background: '#ffffff', border: '1px solid #d1d5db', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '600', color: '#374151' }}
          >
            <RefreshCw size={16} /> Actualizar
          </button>
        </div>
      </div>

      {/* Header Estilizado de Información del Turno */}
      <div style={{ backgroundColor: '#ffffff', padding: '1.25rem 1.5rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem', flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ backgroundColor: '#f0fdf4', padding: '0.6rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={22} color="#166534" />
            </div>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Cajero asignado</span>
              <strong style={{ fontSize: '1.05rem', color: '#111827' }}>{nombreCajero}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ backgroundColor: '#f0fdf4', padding: '0.6rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={22} color="#166534" />
            </div>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Fecha y hora de apertura</span>
              <strong style={{ fontSize: '1.05rem', color: '#111827' }}>{turnoActual?.fecha_hora_apertura ? fechaCaja(turnoActual.fecha_hora_apertura) : '—'}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ backgroundColor: '#f0fdf4', padding: '0.6rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={22} color="#166534" />
            </div>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Base inicial</span>
              <strong style={{ fontSize: '1.15rem', color: '#166534' }}>{monedaCaja(saldoInicial)}</strong>
            </div>
          </div>

        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase' }}>Turno:</span>
          <select 
            className="select-campo"
            value={caja.turnoId} 
            disabled={caja.cargando} 
            onChange={e => caja.setTurnoId(e.target.value)}
            style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', background: '#f9fafb', fontWeight: '600' }}
          >
            <option value="">Seleccioná un turno</option>
            {caja.turnos.map(t => {
              const cajaNombre = t.caja_nombre || 'Caja';
              const sucursalNum = t.sucursal_id ? `Sucursal #${t.sucursal_id}` : '';
              return (
                <option key={t.id} value={t.id}>
                  {t.etiqueta_turno || `${cajaNombre} · ${sucursalNum} · #${t.id}`}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {turnoActual && (
        <div className="tabla-contenedor" style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '1.5rem' }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardCheck size={20} color="#166534" /> Estado y Cierre del Turno
            </h3>
            <span style={{ display: 'inline-block', padding: '0.2rem 0.75rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '700', backgroundColor: turnoActual.estado === 'Abierto' ? '#dcfce7' : '#fef2f2', color: turnoActual.estado === 'Abierto' ? '#166534' : '#b91c1c' }}>
              {turnoActual.estado}
            </span>
          </div>

          <div style={{ padding: '1.5rem' }}>
            {/* Tarjetas principales de efectivo */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              
              <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Efectivo Esperado</span>
                <strong style={{ fontSize: '1.1rem', color: '#111827' }}>{monedaCaja(efectivoEsperado)}</strong>
              </div>

              <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Efectivo Contado</span>
                <strong style={{ fontSize: '1.1rem', color: '#166534' }}>{monedaCaja(efectivoContadoFinal)}</strong>
              </div>

              <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Diferencia</span>
                <strong style={{ fontSize: '1.1rem', color: Number(diferenciaFinal) === 0 ? '#166534' : Number(diferenciaFinal) > 0 ? '#1e40af' : '#b91c1c' }}>
                  {Number(diferenciaFinal) > 0 ? `+ ${monedaCaja(diferenciaFinal)}` : monedaCaja(diferenciaFinal)}
                </strong>
              </div>

              <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Total Neto del Turno</span>
                <strong style={{ fontSize: '1.1rem', color: '#166534' }}>{monedaCaja(totalNetoTurnoFinal)}</strong>
              </div>

            </div>

            {/* Desglose de Totales por Otros Medios (Criterio de Aceptación) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '0.9rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CreditCard size={20} color="#0284c7" />
                <div>
                  <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Operaciones con Tarjeta</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#334155' }}>Ingresos: {monedaCaja(ingresosTarjeta)} | Egresos: {monedaCaja(egresosTarjeta)}</span>
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '0.9rem 1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ArrowLeftRight size={20} color="#0d9488" />
                <div>
                  <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block', fontWeight: '700', textTransform: 'uppercase' }}>Operaciones con Transferencia</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#334155' }}>Ingresos: {monedaCaja(ingresosTransferencia)} | Egresos: {monedaCaja(egresosTransferencia)}</span>
                </div>
              </div>
            </div>

            {cierreInfo?.observacion && (
              <div style={{ backgroundColor: '#fefce8', border: '1px solid #fef08a', padding: '0.75rem 1rem', borderRadius: '0.5rem', fontSize: '0.85rem', color: '#854d0e' }}>
                <strong>Observaciones:</strong> {cierreInfo.observacion}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Flotante para el Cierre de Turno */}
      {mostrarModalCierre && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '0.85rem', maxWidth: '540px', width: '100%', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            <div style={{ backgroundColor: '#65482b', color: '#ffffff', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Lock size={22} /> Cierre Definitivo de Turno
              </h3>
              <button type="button" onClick={() => setMostrarModalCierre(false)} style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '2rem' }}>
              <div style={{ backgroundColor: '#f9fafb', padding: '1rem 1.25rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Efectivo esperado para el cierre</span>
                <strong style={{ fontSize: '1.4rem', color: '#166534' }}>{monedaCaja(efectivoEsperado)}</strong>
              </div>

              <form onSubmit={guardar}>
                <fieldset disabled={guardando} style={{ border: 0, padding: 0, margin: 0 }}>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Efectivo contado para el cierre ($)
                    </label>
                    <input 
                      type="number" 
                      min="0" 
                      max="999999999999.99" 
                      step="0.01" 
                      required 
                      value={contado} 
                      onChange={e => setContado(e.target.value)} 
                      className="campo-entrada"
                      placeholder="0.00"
                      style={{ width: '100%', padding: '0.75rem', fontSize: '1.1rem', fontWeight: '700' }}
                    />
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Observaciones / Motivo de diferencias {diferenciaModal !== 0 && <span style={{ color: '#b91c1c' }}>(Obligatorio por diferencia)</span>}
                    </label>
                    <input 
                      type="text" 
                      value={observaciones} 
                      onChange={e => setObservaciones(e.target.value)} 
                      className="campo-entrada"
                      placeholder={diferenciaModal !== 0 ? "Indique el motivo del faltante o sobrante..." : "Ej. Vuelto entregado de más, etc. (Opcional)"}
                      style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', borderColor: diferenciaModal !== 0 && (!observaciones || observaciones.trim() === '') ? '#fca5a5' : '#d1d5db' }}
                    />
                  </div>

                  {diferenciaModal !== null && (
                    <div style={{ backgroundColor: diferenciaModal === 0 ? '#f0fdf4' : diferenciaModal > 0 ? '#eff6ff' : '#fef2f2', border: `1px solid ${diferenciaModal === 0 ? '#bbf7d0' : diferenciaModal > 0 ? '#bfdbfe' : '#fecaca'}`, padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: diferenciaModal === 0 ? '#166534' : diferenciaModal > 0 ? '#1e40af' : '#b91c1c' }}>
                          {diferenciaModal === 0 ? 'Sin diferencia (Correcto)' : diferenciaModal > 0 ? 'Sobrante' : 'Faltante'}
                        </span>
                        {diferenciaModal === 0 ? <CheckCircle2 size={18} color="#166534" /> : <AlertTriangle size={18} color={diferenciaModal > 0 ? '#1e40af' : '#b91c1c'} />}
                      </div>
                      <strong style={{ fontSize: '1.25rem', color: diferenciaModal === 0 ? '#166534' : diferenciaModal > 0 ? '#1e40af' : '#b91c1c' }}>
                        {diferenciaModal > 0 ? `+ ${monedaCaja(diferenciaModal)}` : monedaCaja(diferenciaModal)}
                      </strong>
                    </div>
                  )}
                </fieldset>

                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingTop: '1.25rem', borderTop: '1px solid #e5e7eb', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setMostrarModalCierre(false)}
                    style={{ padding: '0.7rem 1.25rem', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: '0.375rem', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="boton-principal"
                    disabled={guardando}
                    style={{ padding: '0.7rem 1.75rem', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}
                  >
                    {guardando ? 'Cerrando turno…' : 'Cerrar Turno Definitivamente'}
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