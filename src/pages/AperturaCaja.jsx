import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  getSucursalesAutorizadas, 
  getCajasSucursalConDisponibilidad, 
  getTurnoActivoCajero, 
  abrirTurnoCaja 
} from '../services/caja.js';
import { 
  getUsuarioActual, 
  setUsuarioActual, 
  USUARIOS_PRUEBA 
} from '../lib/auth.js';
import { showAlert } from '../lib/alerts.js';
import { 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  User, 
  MapPin, 
  ShieldAlert, 
  RefreshCw, 
  ArrowRight, 
  Store, 
  Lock, 
  Check, 
  X,
  Eye
} from 'lucide-react';
import '../App.css';

export default function AperturaCaja() {
  const navigate = useNavigate();

  // 1. Estado de Sesión y Usuario
  const [usuarioActual, setUsuario] = useState(() => getUsuarioActual());

  // 2. Estados de Datos
  const [cargando, setCargando] = useState(true);
  const [procesandoApertura, setProcesandoApertura] = useState(false);
  const [sucursales, setSucursales] = useState([]);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState('');
  const [cajas, setCajas] = useState([]);

  // Estado del turno activo del cajero (si ya tiene uno abierto)
  const [turnoActivo, setTurnoActivo] = useState(null);

  // 3. Estados del Formulario de Apertura (Cajero)
  const [cajaElegida, setCajaElegida] = useState(null);
  const [saldoInicial, setSaldoInicial] = useState('0');
  const [errorSaldo, setErrorSaldo] = useState('');
  const [mostrarModalConfirmacion, setMostrarModalConfirmacion] = useState(false);

  // Escuchar cambios de usuario en tiempo real desde auth helper
  useEffect(() => {
    const handleAuthChange = (e) => {
      setUsuario(e.detail);
      setCajaElegida(null);
      setSaldoInicial('0');
    };
    window.addEventListener('umbrella-auth-changed', handleAuthChange);
    return () => window.removeEventListener('umbrella-auth-changed', handleAuthChange);
  }, []);

  // Cargar datos de sucursales y turno inicial
  const cargarContextoInicial = useCallback(async () => {
    setCargando(true);
    try {
      if (!usuarioActual) {
        setCargando(false);
        return;
      }

      // 1. Si es cajero, verificar si ya tiene turno activo
      if (usuarioActual.rol === 'cajero') {
        const resTurno = await getTurnoActivoCajero(usuarioActual.id_usuario);
        if (resTurno.tieneTurno) {
          setTurnoActivo(resTurno.turno);
        } else {
          setTurnoActivo(null);
        }
      } else {
        setTurnoActivo(null);
      }

      // 2. Traer sucursales autorizadas para este usuario
      const resSuc = await getSucursalesAutorizadas(usuarioActual);
      const listaSuc = resSuc.data || [];
      setSucursales(listaSuc);

      if (listaSuc.length > 0) {
        // Si el usuario tiene una sucursal_id preferida, la seleccionamos; si no, la primera
        const preferida = listaSuc.find(s => s.id_sucursal === usuarioActual.sucursal_id) || listaSuc[0];
        setSucursalSeleccionada(String(preferida.id_sucursal));
      } else {
        setSucursalSeleccionada('');
      }
    } catch (err) {
      console.error('Error cargando contexto inicial:', err);
      showAlert('error', 'Error al cargar datos del sistema: ' + err.message);
    } finally {
      setCargando(false);
    }
  }, [usuarioActual]);

  useEffect(() => {
    cargarContextoInicial();
  }, [cargarContextoInicial]);

  // Cargar cajas cuando cambia la sucursal seleccionada
  const cargarCajas = useCallback(async (sucId) => {
    if (!sucId) {
      setCajas([]);
      return;
    }
    try {
      const res = await getCajasSucursalConDisponibilidad(Number(sucId));
      setCajas(res.data || []);
      // Si la caja elegida ya no está disponible en la sucursal nueva, deseleccionar
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

  // Validación de saldo inicial (CA3)
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

  // Abrir modal de confirmación previa (CA4)
  const handlePreConfirmar = (e) => {
    e.preventDefault();
    if (!cajaElegida) {
      showAlert('warning', 'Por favor selecciona una caja disponible para continuar.');
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

  // Confirmar y registrar apertura de turno (CA5, CA6, CA7)
  const handleConfirmarApertura = async () => {
    setProcesandoApertura(true);
    try {
      const payload = {
        cajaId: cajaElegida.id,
        sucursalId: Number(sucursalSeleccionada),
        cajeroId: usuarioActual.id_usuario,
        saldoInicial: Number(saldoInicial)
      };

      const res = await abrirTurnoCaja(payload);

      if (!res.success) {
        setMostrarModalConfirmacion(false);
        showAlert('error', res.error || 'No se pudo abrir la caja');
        // Recargar cajas para actualizar estado de concurrencia
        cargarCajas(sucursalSeleccionada);
        return;
      }

      setMostrarModalConfirmacion(false);
      await showAlert('success', `¡Caja abierta exitosamente!\nTurno N° ${res.data?.id || ''} iniciado.`);
      
      // Actualizar pantalla y pasar a vista de turno activo
      setCajaElegida(null);
      await cargarContextoInicial();
    } catch (err) {
      console.error('Error durante la apertura:', err);
      showAlert('error', 'Ocurrió un error inesperado al procesar la apertura.');
    } finally {
      setProcesandoApertura(false);
    }
  };

  // Formatear moneda argentina
  const formatMoneda = (val) => {
    const num = Number(val) || 0;
    return num.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
  };

  // Formatear fecha
  const formatFecha = (isoString) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleString('es-AR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Sucursal seleccionada (objeto)
  const sucursalObj = sucursales.find(s => String(s.id_sucursal) === String(sucursalSeleccionada));

  return (
    <div className="pagos-pagina" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* ========================================================================= */}
      {/* BARRA SUPERIOR DE SESIÓN Y TESTING RÁPIDO                                  */}
      {/* ========================================================================= */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '0.75rem',
        padding: '0.75rem 1.25rem',
        marginBottom: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: usuarioActual?.rol === 'cajero' ? '#eff6ff' : '#fef3c7',
            color: usuarioActual?.rol === 'cajero' ? '#1d4ed8' : '#b45309',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <User size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: '700', color: '#111827', fontSize: '0.95rem' }}>
                {usuarioActual ? usuarioActual.nombre_completo : 'Sin Sesión'}
              </span>
              {usuarioActual && (
                <span style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  backgroundColor: usuarioActual.rol === 'cajero' ? '#dbeafe' : '#fef08a',
                  color: usuarioActual.rol === 'cajero' ? '#1e40af' : '#854d0e'
                }}>
                  {usuarioActual.rol}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
              {usuarioActual?.sucursal_nombre || 'Farmacia Umbrella S.A.'}
            </p>
          </div>
        </div>

        {/* Switch de simulación para pruebas del sprint */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '500' }}>
            Simular rol para testing:
          </span>
          <select
            value={usuarioActual ? usuarioActual.id_usuario : 'sin-sesion'}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'sin-sesion') {
                setUsuarioActual(null);
              } else {
                const u = USUARIOS_PRUEBA.find(p => p.id_usuario === Number(val));
                if (u) setUsuarioActual(u);
              }
            }}
            style={{
              padding: '0.35rem 0.65rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
              fontSize: '0.8rem',
              color: '#374151',
              backgroundColor: '#f9fafb',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            {USUARIOS_PRUEBA.map(u => (
              <option key={u.id_usuario} value={u.id_usuario}>
                {u.nombre_completo} ({u.rol})
              </option>
            ))}
            <option value="sin-sesion">⚠️ Sin Sesión (Test rechazo)</option>
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ESCENARIO 2: SIN SESIÓN INICIADA (ACCESO RECHAZADO)                       */}
      {/* ========================================================================= */}
      {!usuarioActual && (
        <div className="tarjeta-formulario" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 1.25rem',
            borderRadius: '50%',
            backgroundColor: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ShieldAlert size={36} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#111827', marginBottom: '0.5rem' }}>
            Acceso no autorizado
          </h2>
          <p style={{ color: '#4b5563', maxWidth: '480px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
            Para operar en el módulo de cajas debe iniciar sesión con una cuenta autorizada. Utilice el selector de usuario superior para continuar con las pruebas.
          </p>
          <button
            type="button"
            className="boton-principal"
            onClick={() => setUsuarioActual(USUARIOS_PRUEBA[0])}
            style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <User size={16} /> Iniciar Sesión como Cajero
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 1: CAJERO CON TURNO ABIERTO ACTIVO                                  */}
      {/* ========================================================================= */}
      {usuarioActual?.rol === 'cajero' && turnoActivo && (
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 className="titulo-pagina">Gestión de Caja</h1>
            <p className="subtitulo">Estado operativo de tu turno de trabajo actual.</p>
          </div>

          <div style={{
            backgroundColor: '#ffffff',
            border: '2px solid #84cc16',
            borderRadius: '0.75rem',
            padding: '2rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <span style={{
                  backgroundColor: '#f0fdf4',
                  color: '#166534',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '9999px',
                  fontWeight: '700',
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginBottom: '0.75rem'
                }}>
                  <CheckCircle2 size={16} /> TURNO ABIERTO Y ACTIVO
                </span>
                <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#111827', margin: '0 0 0.5rem' }}>
                  {turnoActivo.caja?.nombre || `Caja #${turnoActivo.caja_id}`}
                </h2>
                <p style={{ color: '#4b5563', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem' }}>
                  <MapPin size={16} color="#65482b" /> {turnoActivo.sucursal?.descripcion || 'Sucursal Asignada'}
                </p>
              </div>

              <div style={{
                textAlign: 'right',
                backgroundColor: '#f9fafb',
                padding: '1rem 1.5rem',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  Saldo Inicial en Efectivo
                </span>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#65482b' }}>
                  {formatMoneda(turnoActivo.saldo_inicial)}
                </div>
              </div>
            </div>

            <hr style={{ border: 0, borderTop: '1px solid #e5e7eb', margin: '1.5rem 0' }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600' }}>IDENTIFICADOR DE TURNO</span>
                <p style={{ margin: '0.2rem 0 0', fontWeight: '700', color: '#111827' }}>#{turnoActivo.id}</p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600' }}>FECHA Y HORA DE APERTURA</span>
                <p style={{ margin: '0.2rem 0 0', fontWeight: '700', color: '#111827', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={15} color="#65482b" /> {formatFecha(turnoActivo.fecha_hora_apertura)}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600' }}>CAJERO OPERADOR</span>
                <p style={{ margin: '0.2rem 0 0', fontWeight: '700', color: '#111827' }}>{usuarioActual.nombre_completo}</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic' }}>
                * No se permite abrir otra caja simultáneamente mientras este turno se encuentre abierto.
              </p>
              <button
                type="button"
                className="boton-principal"
                onClick={() => navigate('/ventas')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                Ir al Punto de Venta <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: CAJERO SIN TURNO ABIERTO (FLUJO PRINCIPAL DE APERTURA CA1-CA5)    */}
      {/* ========================================================================= */}
      {usuarioActual?.rol === 'cajero' && !turnoActivo && (
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <h1 className="titulo-pagina">Apertura de Caja</h1>
            <p className="subtitulo">
              Seleccione una caja disponible de su sucursal autorizada e ingrese el saldo inicial en efectivo para comenzar su turno.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
            
            {/* COLUMNA IZQUIERDA: LISTADO DE CAJAS DISPONIBLES (CA1, CA2) */}
            <div className="tarjeta-formulario">
              
              {/* Selector de Sucursal Autorizada (CA1) */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Store size={16} color="#65482b" /> Sucursal Autorizada
                </label>
                <select
                  value={sucursalSeleccionada}
                  onChange={(e) => setSucursalSeleccionada(e.target.value)}
                  className="select-campo"
                >
                  {sucursales.map((s) => (
                    <option key={s.id_sucursal} value={s.id_sucursal}>
                      {s.codigo ? `[${s.codigo}] ` : ''}{s.descripcion}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.35rem', display: 'block' }}>
                  Mostrando las cajas asignadas a esta sucursal.
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 className="subtitulo-seccion" style={{ margin: 0 }}>Cajas de la Sucursal</h3>
                <button
                  type="button"
                  onClick={() => cargarCajas(sucursalSeleccionada)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#65482b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.8rem',
                    fontWeight: '600'
                  }}
                >
                  <RefreshCw size={14} /> Actualizar disponibilidad
                </button>
              </div>

              {/* Grilla de Cajas con disponibilidad */}
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
                        onClick={() => {
                          if (isDisponible) setCajaElegida(caja);
                        }}
                        style={{
                          border: isSelected ? '2px solid #65482b' : '1px solid #e5e7eb',
                          backgroundColor: isSelected 
                            ? '#faf5f0' 
                            : !isDisponible 
                            ? '#f9fafb' 
                            : '#ffffff',
                          borderRadius: '0.5rem',
                          padding: '1rem 1.25rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: isDisponible ? 'pointer' : 'not-allowed',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 2px 4px rgba(101, 72, 43, 0.15)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '0.375rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isSelected 
                              ? '#65482b' 
                              : isDisponible 
                              ? '#f0fdf4' 
                              : '#f3f4f6',
                            color: isSelected 
                              ? '#ffffff' 
                              : isDisponible 
                              ? '#166534' 
                              : '#9ca3af'
                          }}>
                            {isDisponible ? <DollarSign size={20} /> : <Lock size={20} />}
                          </div>

                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: isDisponible ? '#111827' : '#6b7280' }}>
                              {caja.nombre}
                            </h4>
                            <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                              {isDisponible 
                                ? 'Habilitada para apertura de turno' 
                                : caja.en_uso 
                                ? `Ocupada por ${caja.cajero_nombre} desde las ${formatFecha(caja.fecha_hora_apertura).split(' ')[1] || ''}` 
                                : 'Caja inactiva'}
                            </p>
                          </div>
                        </div>

                        <div>
                          {isDisponible ? (
                            <span style={{
                              backgroundColor: '#dcfce7',
                              color: '#15803d',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem'
                            }}>
                              <Check size={12} /> DISPONIBLE
                            </span>
                          ) : (
                            <span style={{
                              backgroundColor: '#fee2e2',
                              color: '#b91c1c',
                              padding: '0.25rem 0.65rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '600'
                            }}>
                              EN USO
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* COLUMNA DERECHA: IMPORTE INICIAL Y ACCIÓN (CA3, CA4) */}
            <div className="tarjeta-formulario">
              <h3 className="subtitulo-seccion" style={{ marginTop: 0 }}>Datos de Apertura</h3>

              {cajaElegida ? (
                <div style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fdf8f4',
                  border: '1px solid #ebdcd0',
                  borderRadius: '0.5rem',
                  marginBottom: '1.25rem'
                }}>
                  <span style={{ fontSize: '0.75rem', color: '#65482b', fontWeight: '700', textTransform: 'uppercase' }}>
                    Caja Seleccionada
                  </span>
                  <div style={{ fontWeight: '800', color: '#2d241e', fontSize: '1.1rem' }}>
                    {cajaElegida.nombre}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {sucursalObj?.descripcion}
                  </span>
                </div>
              ) : (
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#f9fafb',
                  border: '1px dashed #d1d5db',
                  borderRadius: '0.5rem',
                  color: '#6b7280',
                  fontSize: '0.85rem',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <AlertCircle size={18} color="#65482b" />
                  Selecciona una caja disponible de la lista para continuar.
                </div>
              )}

              <form onSubmit={handlePreConfirmar}>
                <div className="grupo-campo" style={{ marginBottom: '1.25rem' }}>
                  <label htmlFor="saldoInicial">
                    Importe Inicial de Efectivo ($) <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute',
                      left: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#6b7280',
                      fontWeight: '600'
                    }}>$</span>
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
                      style={{ paddingLeft: '2rem', fontSize: '1.1rem', fontWeight: '700' }}
                    />
                  </div>
                  {errorSaldo && <span className="texto-error">{errorSaldo}</span>}
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    CA3: Ingrese la base monetaria en caja con la que iniciará el turno (debe ser $\ge 0$).
                  </span>
                </div>

                <div style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: '0.5rem',
                  padding: '0.85rem 1rem',
                  marginBottom: '1.5rem',
                  border: '1px solid #e5e7eb'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.35rem' }}>
                    <span>Cajero a cargo:</span>
                    <strong style={{ color: '#111827' }}>{usuarioActual.nombre_completo}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#6b7280' }}>
                    <span>Fecha/Hora prevista:</span>
                    <strong style={{ color: '#111827' }}>Inmediata (al confirmar)</strong>
                  </div>
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

      {/* ========================================================================= */}
      {/* VISTA 3: MODO ADMINISTRADOR (PANEL DE SUPERVISIÓN)                        */}
      {/* ========================================================================= */}
      {usuarioActual?.rol === 'administrador' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h1 className="titulo-pagina">Supervisión de Cajas</h1>
              <p className="subtitulo">
                Panel de control y monitoreo en tiempo real del estado de cajas en todas las sucursales.
              </p>
            </div>

            {/* Selector de Sucursal para Admin */}
            <div style={{ minWidth: '300px' }}>
              <select
                value={sucursalSeleccionada}
                onChange={(e) => setSucursalSeleccionada(e.target.value)}
                className="select-campo"
              >
                {sucursales.map((s) => (
                  <option key={s.id_sucursal} value={s.id_sucursal}>
                    {s.codigo ? `[${s.codigo}] ` : ''}{s.descripcion}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tarjetas resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: '#fff', padding: '1rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Total Cajas</span>
              <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.5rem', fontWeight: '800', color: '#111827' }}>{cajas.length}</h3>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '1rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#166534', textTransform: 'uppercase' }}>Cajas Abiertas (En Uso)</span>
              <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.5rem', fontWeight: '800', color: '#166534' }}>
                {cajas.filter(c => c.en_uso).length}
              </h3>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '1rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#2563eb', textTransform: 'uppercase' }}>Cajas Disponibles</span>
              <h3 style={{ margin: '0.2rem 0 0', fontSize: '1.5rem', fontWeight: '800', color: '#2563eb' }}>
                {cajas.filter(c => c.disponible).length}
              </h3>
            </div>
          </div>

          {/* Tabla de cajas para supervisión */}
          <div className="tabla-contenedor">
            <table className="tabla-facturas">
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
                      <td>
                        {c.en_uso ? (
                          <span style={{
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '700'
                          }}>
                            ● ABIERTA (EN USO)
                          </span>
                        ) : c.disponible ? (
                          <span style={{
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '700'
                          }}>
                            ● DISPONIBLE
                          </span>
                        ) : (
                          <span style={{
                            backgroundColor: '#f3f4f6',
                            color: '#6b7280',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '600'
                          }}>
                            INACTIVA
                          </span>
                        )}
                      </td>
                      <td>{c.cajero_nombre || '-'}</td>
                      <td>{formatFecha(c.fecha_hora_apertura)}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: c.en_uso ? '#65482b' : '#9ca3af' }}>
                        {c.saldo_inicial !== null ? formatMoneda(c.saldo_inicial) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>
            * Vista exclusiva del rol Administrador: los administradores supervisan todas las cajas pero no abren turnos operativos directamente.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CONFIRMACIÓN PREVIA (CA4)                                        */}
      {/* ========================================================================= */}
      {mostrarModalConfirmacion && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '0.75rem',
            maxWidth: '480px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              backgroundColor: '#65482b',
              color: '#ffffff',
              padding: '1.25rem 1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>
                Confirmación de Apertura (CA4)
              </h3>
              <button
                type="button"
                onClick={() => setMostrarModalConfirmacion(false)}
                style={{ background: 'none', border: 0, color: '#fff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <p style={{ margin: '0 0 1.25rem', color: '#4b5563', fontSize: '0.9rem' }}>
                Por favor revise los datos de inicio de turno antes de confirmar la apertura:
              </p>

              <div style={{
                backgroundColor: '#f9fafb',
                borderRadius: '0.5rem',
                border: '1px solid #e5e7eb',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Caja:</span>
                  <strong style={{ color: '#111827' }}>{cajaElegida?.nombre}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Sucursal:</span>
                  <strong style={{ color: '#111827', textAlign: 'right', maxWidth: '65%' }}>
                    {sucursalObj?.descripcion}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: '#6b7280' }}>Cajero Operador:</span>
                  <strong style={{ color: '#111827' }}>{usuarioActual?.nombre_completo}</strong>
                </div>
                <hr style={{ border: 0, borderTop: '1px dashed #d1d5db', margin: '0.25rem 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: '700', color: '#374151' }}>Importe Inicial:</span>
                  <strong style={{ fontSize: '1.25rem', color: '#65482b' }}>
                    {formatMoneda(saldoInicial)}
                  </strong>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setMostrarModalConfirmacion(false)}
                  disabled={procesandoApertura}
                  style={{
                    padding: '0.6rem 1rem',
                    border: '1px solid #d1d5db',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    borderRadius: '0.375rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar / Modificar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarApertura}
                  disabled={procesandoApertura}
                  className="boton-principal"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {procesandoApertura ? 'Abriendo Turno...' : 'Confirmar y Abrir Caja'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
