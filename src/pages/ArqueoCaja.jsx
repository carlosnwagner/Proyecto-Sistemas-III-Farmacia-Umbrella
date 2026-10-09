import { useRef, useState, useEffect } from 'react';
import useCajaTurnos from '../hooks/useCajaTurnos.js';
import { monedaCaja, fechaCaja } from '../lib/cajaFormato.js';
import { registrarArqueoReal } from '../services/cajaTurnos.js';
import Swal from 'sweetalert2';
import { Calculator, CheckCircle2, AlertTriangle, RefreshCw, ClipboardCheck, History, PlusCircle, X, Clock, User, Wallet } from 'lucide-react';
import '../App.css';

export default function ArqueoCaja() {
  const caja = useCajaTurnos();
  const [contado, setContado] = useState('');
  const [mostrarModalArqueo, setMostrarModalArqueo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const ocupado = useRef(false);

  useEffect(() => {
    if (caja.turnos && caja.turnos.length > 0 && !caja.turnoId) {
      caja.setTurnoId(String(caja.turnos[0].id));
    }
  }, [caja.turnos, caja.turnoId]);

  const turnoActual = caja.turno || (caja.turnos || []).find(t => String(t.id) === String(caja.turnoId));
  const efectivoEsperado = caja.detalle?.totales?.efectivo_esperado ?? turnoActual?.saldo_inicial ?? 0;
  
  const contadoNum = contado !== '' ? Number(contado) : null;
  const diferencia = contadoNum !== null ? contadoNum - Number(efectivoEsperado) : null;

  async function guardar(e) {
    e.preventDefault();
    if (ocupado.current || !turnoActual) return;
    
    if (!Number.isFinite(contadoNum) || contadoNum < 0 || !/^\d+(\.\d{1,2})?$/.test(contado)) { 
      Swal.fire({ title: 'Atención', text: 'Ingresá un importe no negativo de hasta dos decimales.', icon: 'warning', customClass: { container: 'swal-top-zindex' } });
      return; 
    }

    ocupado.current = true;
    setGuardando(true);
    
    const versionMovimientos = caja.detalle?.turno?.version_movimientos || 1;
    const p = { turno: turnoActual.id, contado: contadoNum, version: versionMovimientos, clave: crypto.randomUUID() };

    try {
      await registrarArqueoReal(p);
      setContado(''); 
      setMostrarModalArqueo(false);
      caja.actualizar();
      await Swal.fire({ title: 'Registrado', text: 'El arqueo se registró correctamente sin alterar el saldo.', icon: 'success', customClass: { container: 'swal-top-zindex' } });
    } catch (err) {
      Swal.fire({ title: 'Error', text: err.message || 'No se pudo completar el arqueo.', icon: 'error', customClass: { container: 'swal-top-zindex' } });
    } finally { 
      ocupado.current = false; 
      setGuardando(false); 
    }
  }

  const arqueos = caja.detalle?.arqueos || [];
  const nombreCajero = caja.detalle?.turno?.cajero_nombre || 'Carlos';

  return (
    <div style={{ width: '100%', margin: '0', padding: '1.5rem 2rem', boxSizing: 'border-box' }}>
      
      {/* Encabezado Principal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gestión de Caja</span>
          <h1 className="titulo-pagina" style={{ margin: '0.2rem 0 0.25rem 0' }}>Arqueo de caja</h1>
          <p className="subtitulo" style={{ margin: 0 }}>Registrá el efectivo contado sin alterar el saldo operativo.</p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={() => setMostrarModalArqueo(true)}
            disabled={!turnoActual || turnoActual.estado !== 'Abierto'}
            className="boton-principal"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap', opacity: (!turnoActual || turnoActual.estado !== 'Abierto') ? 0.5 : 1, cursor: 'pointer' }}
          >
            <PlusCircle size={16} /> + Registrar Arqueo
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
              <strong style={{ fontSize: '1.15rem', color: '#166534' }}>{monedaCaja(turnoActual?.saldo_inicial || 0)}</strong>
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
        <>
          {/* Historial de Arqueos del Turno */}
          <div className="tabla-contenedor" style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ClipboardCheck size={20} color="#166534" /> Historial de arqueos del turno
              </h3>
            </div>

            {arqueos.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#9ca3af' }}>
                <History size={32} color="#d1d5db" style={{ margin: '0 auto 0.5rem' }} />
                <p style={{ fontSize: '0.9rem', fontWeight: '600', color: '#4b5563', margin: '0 0 0.2rem' }}>Sin arqueos registrados</p>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>Utilizá el botón "+ Registrar Arqueo" para realizar el conteo físico de efectivo.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="tabla-facturas" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Fecha y Hora</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Esperado</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Contado</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Diferencia</th>
                      <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arqueos.map(a => (
                      <tr key={a.id_arqueo} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.85rem 1rem', color: '#4b5563' }}>{fechaCaja(a.fecha_hora)}</td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '600' }}>{monedaCaja(a.efectivo_esperado)}</td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '600' }}>{monedaCaja(a.efectivo_contado)}</td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '800', color: Number(a.diferencia) === 0 ? '#166534' : Number(a.diferencia) > 0 ? '#1e40af' : '#b91c1c' }}>
                          {Number(a.diferencia) > 0 ? `+ ${monedaCaja(a.diferencia)}` : monedaCaja(a.diferencia)}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700', backgroundColor: a.vigente ? '#dcfce7' : '#fef2f2', color: a.vigente ? '#166534' : '#b91c1c' }}>
                            {a.vigente ? 'Vigente' : 'No vigente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Flotante Profesional para el Registro de Arqueo */}
      {mostrarModalArqueo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '0.85rem', maxWidth: '540px', width: '100%', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            <div style={{ backgroundColor: '#65482b', color: '#ffffff', padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calculator size={22} /> Registrar Arqueo de Caja
              </h3>
              <button type="button" onClick={() => setMostrarModalArqueo(false)} style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer' }}><X size={24} /></button>
            </div>
            
            <div style={{ padding: '2rem' }}>
              <div style={{ backgroundColor: '#f9fafb', padding: '1rem 1.25rem', borderRadius: '0.5rem', marginBottom: '1.5rem', border: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Efectivo esperado en turno</span>
                <strong style={{ fontSize: '1.4rem', color: '#166534' }}>{monedaCaja(efectivoEsperado)}</strong>
              </div>

              <form onSubmit={guardar}>
                <fieldset disabled={guardando} style={{ border: 0, padding: 0, margin: 0 }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#374151', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                      Efectivo contado ($)
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

                  {diferencia !== null && (
                    <div style={{ backgroundColor: diferencia === 0 ? '#f0fdf4' : diferencia > 0 ? '#eff6ff' : '#fef2f2', border: `1px solid ${diferencia === 0 ? '#bbf7d0' : diferencia > 0 ? '#bfdbfe' : '#fecaca'}`, padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: diferencia === 0 ? '#166534' : diferencia > 0 ? '#1e40af' : '#b91c1c' }}>
                          {diferencia === 0 ? 'Sin diferencia (Correcto)' : diferencia > 0 ? 'Sobrante' : 'Faltante'}
                        </span>
                        {diferencia === 0 ? <CheckCircle2 size={18} color="#166534" /> : <AlertTriangle size={18} color={diferencia > 0 ? '#1e40af' : '#b91c1c'} />}
                      </div>
                      <strong style={{ fontSize: '1.25rem', color: diferencia === 0 ? '#166534' : diferencia > 0 ? '#1e40af' : '#b91c1c' }}>
                        {diferencia > 0 ? `+ ${monedaCaja(diferencia)}` : monedaCaja(diferencia)}
                      </strong>
                    </div>
                  )}
                </fieldset>

                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingTop: '1.25rem', borderTop: '1px solid #e5e7eb', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setMostrarModalArqueo(false)}
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
                    {guardando ? 'Registrando…' : 'Confirmar Arqueo'}
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