import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getSucursalesAutorizadas, 
  getCajasSucursalConDisponibilidad, 
  getTurnoActivoCajero, 
  abrirTurnoCaja,
  crearCaja 
} from '../services/caja.js';
import { useAuth } from '../context/AuthContext.jsx';
import Swal from 'sweetalert2';
import { 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  MapPin, 
  RefreshCw, 
  ArrowRight, 
  Store, 
  Lock, 
  X
} from 'lucide-react';
import '../App.css';

export default function AperturaCaja() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [cargando, setCargando] = useState(true);
  const [procesandoApertura, setProcesandoApertura] = useState(false);
  const [sucursales, setSucursales] = useState([]);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState('');
  const [cajas, setCajas] = useState([]);
  const [turnoActivo, setTurnoActivo] = useState(null);

  const [cajaElegida, setCajaElegida] = useState(null);
  const [saldoInicial, setSaldoInicial] = useState('0');
  const [errorSaldo, setErrorSaldo] = useState('');
  const [mostrarModalConfirmacion, setMostrarModalConfirmacion] = useState(false);

  const [mostrarModalCrearCaja, setMostrarModalCrearCaja] = useState(false);
  const [nombreNuevaCaja, setNombreNuevaCaja] = useState('');

  // Cargar contexto inicial una sola vez al montar (sin disparar por cambios de foco de pestaña)
  const cargarContextoInicial = useCallback(async () => {
    try {
      if (!profile) {
        setCargando(false);
        return;
      }

      // Si es cajero, verificar turno activo
      if (profile.rol === 'cajero') {
        const resTurno = await getTurnoActivoCajero(profile.id_usuario);
        if (resTurno.tieneTurno) {
          setTurnoActivo(resTurno.turno);
        } else {
          setTurnoActivo(null);
        }
      } else {
        setTurnoActivo(null);
      }

      // Traer sucursales autorizadas ordenadas
      const resSuc = await getSucursalesAutorizadas(profile);
      const listaSuc = resSuc.data || [];
      setSucursales(listaSuc);

      if (listaSuc.length > 0) {
        const preferida = listaSuc.find(s => s.id_sucursal === profile?.sucursal_id) || listaSuc[0];
        setSucursalSeleccionada(String(preferida.id_sucursal));
      } else {
        setSucursalSeleccionada('');
      }
    } catch (err) {
      console.error('Error cargando contexto inicial:', err);
    } finally {
      setCargando(false);
    }
  }, [profile]);

  useEffect(() => {
    cargarContextoInicial();
  }, [cargarContextoInicial]);

  // Cargar cajas de la sucursal seleccionada
  const cargarCajas = useCallback(async (sucId) => {
    if (!sucId) {
      setCajas([]);
      return;
    }
    try {
      const res = await getCajasSucursalConDisponibilidad(Number(sucId));
      setCajas(res.data || []);
      setCajaElegida(prev => {
        if (!prev) return null;
        const sigueValida = (res.data || []).find(c => c.id === prev.id && c.disponible);
        return sigueValida || null;
      });
    } catch (err) {
      console.error('Error cargando cajas:', err);
    }
  }, []);

  useEffect(() => {
    if (sucursalSeleccionada) {
      cargarCajas(sucursalSeleccionada);
    }
  }, [sucursalSeleccionada, cargarCajas]);

  // Validación de saldo inicial
  const handleSaldoChange = (valor) => {
    setSaldoInicial(valor);
    if (valor === '' || valor === null) {
      setErrorSaldo('El importe inicial es obligatorio.');
      return;
    }
    const num = Number(valor);
    if (isNaN(num)) {
      setErrorSaldo('El importe debe ser numérico.');
    } else if (num < 0) {
      setErrorSaldo('El importe no puede ser negativo.');
    } else {
      setErrorSaldo('');
    }
  };

  const handlePreConfirmar = (e) => {
    e.preventDefault();
    if (!cajaElegida) {
      Swal.fire('Atención', 'Por favor selecciona una caja disponible para continuar.', 'warning');
      return;
    }
    const num = Number(saldoInicial);
    if (isNaN(num) || num < 0 || saldoInicial === '') {
      setErrorSaldo('Ingrese un importe inicial numérico válido mayor o igual a 0.');
      return;
    }
    setErrorSaldo('');
    setMostrarModalConfirmacion(true);
  };

  const handleConfirmarApertura = async () => {
    setProcesandoApertura(true);
    try {
      const payload = {
        cajaId: cajaElegida.id,
        sucursalId: Number(sucursalSeleccionada),
        cajeroId: profile.id_usuario,
        saldoInicial: Number(saldoInicial)
      };

      const res = await abrirTurnoCaja(payload);

      if (!res.success) {
        setMostrarModalConfirmacion(false);
        Swal.fire('Error', res.error || 'No se pudo abrir la caja', 'error');
        cargarCajas(sucursalSeleccionada);
        return;
      }

      setMostrarModalConfirmacion(false);
      await Swal.fire('Éxito', `¡Caja abierta exitosamente!\nTurno N° ${res.data?.id || ''} iniciado.`, 'success');
      
      setCajaElegida(null);
      await cargarContextoInicial();
    } catch (err) {
      console.error('Error durante la apertura:', err);
      Swal.fire('Error', 'Ocurrió un error inesperado al procesar la apertura.', 'error');
    } finally {
      setProcesandoApertura(false);
    }
  };

  const formatMoneda = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
  };

  const formatFecha = (isoString) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const sucursalObj = sucursales.find(s => String(s.id_sucursal) === String(sucursalSeleccionada));

  if (cargando) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Cargando módulo de caja...</div>;
  }

  return (
    <div style={{ width: '100%', margin: '0', padding: '1.5rem 2rem', boxSizing: 'border-box' }}>
      
      {/* VISTA ADMINISTRADOR */}
      {profile?.rol === 'administrador' && (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
            <div>
              <h1 className="titulo-pagina" style={{ margin: '0 0 0.25rem 0' }}>Supervisión de Cajas</h1>
              <p className="subtitulo" style={{ margin: 0 }}>Panel de control y monitoreo en tiempo real del estado de cajas en todas las sucursales.</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
              <button
                type="button"
                className="boton-principal"
                onClick={() => setMostrarModalCrearCaja(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
              >
                + Nueva Caja
              </button>

              <div style={{ minWidth: '260px' }}>
                <select
                  value={sucursalSeleccionada}
                  onChange={(e) => setSucursalSeleccionada(e.target.value)}
                  className="select-campo"
                  style={{ width: '100%' }}
                >
                  {sucursales.map((s) => (
                    <option key={s.id_sucursal} value={s.id_sucursal}>
                      {s.codigo ? `[${s.codigo}] ` : ''}{s.descripcion}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem', width: '100%' }}>
            <div style={{ backgroundColor: '#fff', padding: '1rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Total Cajas</span>
              <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.5rem', fontWeight: '800', color: '#111827' }}>{cajas.length}</h3>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '1rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#166534', textTransform: 'uppercase' }}>Cajas Abiertas (En Uso)</span>
              <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.5rem', fontWeight: '800', color: '#166534' }}>{cajas.filter(c => c.en_uso).length}</h3>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '1rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#2563eb', textTransform: 'uppercase' }}>Cajas Disponibles</span>
              <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.5rem', fontWeight: '800', color: '#2563eb' }}>{cajas.filter(c => c.disponible).length}</h3>
            </div>
          </div>

          <div className="tabla-contenedor" style={{ width: '100%', boxSizing: 'border-box' }}>
            <table className="tabla-facturas" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Caja</th>
                  <th>Sucursal</th>
                  <th>Estado</th>
                  <th>Cajero Responsable</th>
                  <th>Hora Apertura</th>
                  <th style={{ textAlign: 'right' }}>Saldo Inicial</th>
                </tr>
              </thead>
              <tbody>
                {cajas.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                      No se encontraron cajas registradas para esta sucursal.
                    </td>
                  </tr>
                ) : (
                  cajas.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: '700', color: '#111827' }}>{c.nombre}</td>
                      <td>{sucursalObj?.descripcion || '-'}</td>
                      <td>{c.en_uso ? 'ABIERTA' : c.disponible ? 'DISPONIBLE' : 'INACTIVA'}</td>
                      <td>{c.cajero_nombre || '-'}</td>
                      <td>{formatFecha(c.fecha_hora_apertura)}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700' }}>{c.saldo_inicial !== null ? formatMoneda(c.saldo_inicial) : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA CAJERO: TURNO ACTIVO */}
      {profile?.rol === 'cajero' && turnoActivo && (
        <div style={{ width: '100%' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 className="titulo-pagina" style={{ margin: '0 0 0.25rem 0' }}>Gestión de Caja</h1>
            <p className="subtitulo" style={{ margin: 0 }}>Estado operativo de tu turno de trabajo actual.</p>
          </div>

          <div style={{ backgroundColor: '#ffffff', border: '2px solid #84cc16', borderRadius: '0.75rem', padding: '2rem', marginBottom: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span style={{ backgroundColor: '#f0fdf4', color: '#166534', padding: '0.35rem 0.85rem', borderRadius: '9999px', fontWeight: '700', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                  <CheckCircle2 size={16} /> TURNO ABIERTO Y ACTIVO
                </span>
                <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#111827', margin: '0 0 0.5rem' }}>
                  {turnoActivo.caja?.nombre || `Caja #${turnoActivo.caja_id}`}
                </h2>
                <p style={{ color: '#4b5563', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                  <MapPin size={16} color="#65482b" /> {turnoActivo.sucursal?.descripcion || 'Sucursal Asignada'}
                </p>
              </div>

              <div style={{ textAlign: 'right', backgroundColor: '#f9fafb', padding: '1rem 1.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Saldo Inicial en Efectivo</span>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#65482b' }}>{formatMoneda(turnoActivo.saldo_inicial)}</div>
              </div>
            </div>

            <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '1.5rem 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic' }}>
                * No se permite abrir otra caja simultáneamente mientras este turno se encuentre abierto.
              </p>
              <button 
                type="button" 
                className="boton-principal" 
                onClick={() => {
                  // Si la ruta /ventas no existe aún, avisar o navegar a ingresos/egresos o saldo
                  navigate('/caja/ingresos-egresos');
                }} 
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                Ir a Operaciones de Caja <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VISTA CAJERO: SIN TURNO ACTIVO (APERTURA) */}
      {profile?.rol === 'cajero' && !turnoActivo && (
        <div style={{ width: '100%' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 className="titulo-pagina" style={{ margin: '0 0 0.25rem 0' }}>Apertura de Caja</h1>
            <p className="subtitulo" style={{ margin: 0 }}>Seleccione una caja disponible de su sucursal autorizada e ingrese el saldo inicial en efectivo.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', alignItems: 'start', width: '100%' }}>
            
            <div className="tarjeta-formulario">
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem', fontWeight: '600' }}>
                  <Store size={16} color="#65482b" /> Sucursal Autorizada
                </label>
                <select value={sucursalSeleccionada} onChange={(e) => setSucursalSeleccionada(e.target.value)} className="select-campo" style={{ width: '100%', padding: '0.6rem' }}>
                  {sucursales.map((s) => (
                    <option key={s.id_sucursal} value={s.id_sucursal}>
                      {s.codigo ? `[${s.codigo}] ` : ''}{s.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 className="subtitulo-seccion" style={{ margin: 0 }}>Cajas de la Sucursal</h3>
                <button type="button" onClick={() => cargarCajas(sucursalSeleccionada)} style={{ background: 'none', border: 'none', color: '#65482b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: '600' }}>
                  <RefreshCw size={14} /> Actualizar
                </button>
              </div>

              {cajas.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: '#6b7280', border: '1px dashed #d1d5db', borderRadius: '0.5rem' }}>
                  No se encontraron cajas registradas para esta sucursal.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {cajas.map((caja) => {
                    const isSelected = cajaElegida?.id === caja.id;
                    const isDisponible = caja.disponible;

                    return (
                      <div
                        key={caja.id}
                        onClick={() => { if (isDisponible) setCajaElegida(caja); }}
                        style={{
                          border: isSelected ? '2px solid #65482b' : '1px solid #e5e7eb',
                          backgroundColor: isSelected ? '#faf5f0' : !isDisponible ? '#f9fafb' : '#ffffff',
                          borderRadius: '0.5rem', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          cursor: isDisponible ? 'pointer' : 'not-allowed', boxShadow: isSelected ? '0 2px 4px rgba(101, 72, 43, 0.15)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? '#65482b' : isDisponible ? '#f0fdf4' : '#f3f4f6', color: isSelected ? '#ffffff' : isDisponible ? '#166534' : '#9ca3af' }}>
                            {isDisponible ? <DollarSign size={20} /> : <Lock size={20} />}
                          </div>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: isDisponible ? '#111827' : '#6b7280' }}>{caja.nombre}</h4>
                            <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>{isDisponible ? 'Habilitada para apertura' : 'En uso'}</p>
                          </div>
                        </div>
                        <div>
                          {isDisponible ? <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '0.25rem 0.65rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '700' }}>DISPONIBLE</span> : <span style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.25rem 0.65rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>EN USO</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="tarjeta-formulario">
              <h3 className="subtitulo-seccion" style={{ marginTop: 0 }}>Datos de Apertura</h3>

              {cajaElegida ? (
                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fdf8f4', border: '1px solid #ebdcd0', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#65482b', fontWeight: '700', textTransform: 'uppercase' }}>Caja Seleccionada</span>
                  <div style={{ fontWeight: '800', color: '#2d241e', fontSize: '1.1rem' }}>{cajaElegida.nombre}</div>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{sucursalObj?.descripcion}</span>
                </div>
              ) : (
                <div style={{ padding: '1rem', backgroundColor: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '0.5rem', color: '#6b7280', fontSize: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={18} color="#65482b" /> Selecciona una caja disponible.
                </div>
              )}

              <form onSubmit={handlePreConfirmar}>
                <div className="grupo-campo" style={{ marginBottom: '1.25rem' }}>
                  <label htmlFor="saldoInicial" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600', fontSize: '0.85rem' }}>
                    Importe Inicial de Efectivo ($) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6b7280', fontWeight: '600' }}>$</span>
                    <input
                      id="saldoInicial"
                      type="number"
                      step="any"
                      min="0"
                      disabled={!cajaElegida}
                      value={saldoInicial}
                      onChange={(e) => handleSaldoChange(e.target.value)}
                      placeholder="0.00"
                      className={`campo-entrada ${errorSaldo ? 'campo-error' : ''}`}
                      style={{ width: '100%', paddingLeft: '2rem', padding: '0.6rem 0.6rem 0.6rem 2rem', fontSize: '1.1rem', fontWeight: '700' }}
                    />
                  </div>
                  {errorSaldo && <span className="texto-error" style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{errorSaldo}</span>}
                </div>

                <button
                  type="submit"
                  disabled={!cajaElegida || !!errorSaldo || procesandoApertura}
                  className="boton-principal"
                  style={{ width: '100%', padding: '0.75rem' }}
                >
                  Abrir Caja (Confirmar)
                </button>
              </form>
            </div>

          </div>
        </div>
      )}

      {/* MODAL CREAR CAJA (ADMIN) */}
      {mostrarModalCrearCaja && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', maxWidth: '440px', width: '100%', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ backgroundColor: '#65482b', color: '#ffffff', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Registrar Nueva Caja</h3>
              <button type="button" onClick={() => setMostrarModalCrearCaja(false)} style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!nombreNuevaCaja.trim()) {
                  Swal.fire('Atención', 'Ingrese un nombre para la caja.', 'warning');
                  return;
                }
                const res = await crearCaja({ nombre: nombreNuevaCaja, sucursalId: sucursalSeleccionada, activa: true });
                if (!res.success) {
                  Swal.fire('Error', 'Error al crear la caja: ' + res.error, 'error');
                } else {
                  Swal.fire('Éxito', '¡Caja creada exitosamente!', 'success');
                  setNombreNuevaCaja('');
                  setMostrarModalCrearCaja(false);
                  cargarCajas(sucursalSeleccionada);
                }
              }}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', color: '#374151' }}>Nombre de la Caja <span style={{ color: '#dc2626' }}>*</span></label>
                  <input type="text" value={nombreNuevaCaja} onChange={(e) => setNombreNuevaCaja(e.target.value)} placeholder="Ej: Caja 03 - Express" className="campo-entrada" style={{ width: '100%', padding: '0.6rem' }} required />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" onClick={() => setMostrarModalCrearCaja(false)} style={{ padding: '0.6rem 1rem', border: '1px solid #d1d5db', backgroundColor: '#fff', borderRadius: '0.375rem', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
                  <button type="submit" className="boton-principal" style={{ padding: '0.6rem 1rem' }}>Guardar Caja</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PREVIA */}
      {mostrarModalConfirmacion && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '0.75rem', maxWidth: '480px', width: '100%', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ backgroundColor: '#65482b', color: '#ffffff', padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Confirmación de Apertura</h3>
              <button type="button" onClick={() => setMostrarModalConfirmacion(false)} style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <p style={{ margin: '0 0 1.25rem', color: '#4b5563', fontSize: '0.9rem' }}>Por favor revise los datos de inicio de turno antes de confirmar:</p>
              <div style={{ backgroundColor: '#f9fafb', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}><span style={{ color: '#6b7280' }}>Caja:</span><strong style={{ color: '#111827' }}>{cajaElegida?.nombre}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}><span style={{ color: '#6b7280' }}>Sucursal:</span><strong style={{ color: '#111827' }}>{sucursalObj?.descripcion}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}><span style={{ color: '#6b7280' }}>Cajero Operador:</span><strong style={{ color: '#111827' }}>{profile?.nombre_completo}</strong></div>
                <hr style={{ border: 0, borderTop: '1px dashed #d1d5db', margin: '0.25rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', alignItems: 'center' }}><span style={{ fontWeight: '700', color: '#374151' }}>Importe Inicial:</span><strong style={{ fontSize: '1.25rem', color: '#65482b' }}>{formatMoneda(saldoInicial)}</strong></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setMostrarModalConfirmacion(false)} disabled={procesandoApertura} style={{ padding: '0.6rem 1rem', border: '1px solid #d1d5db', backgroundColor: '#ffffff', color: '#374151', borderRadius: '0.375rem', fontWeight: '600', cursor: 'pointer' }}>Cancelar</button>
                <button type="button" onClick={handleConfirmarApertura} disabled={procesandoApertura} className="boton-principal" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>{procesandoApertura ? 'Abriendo Turno...' : 'Confirmar y Abrir Caja'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}