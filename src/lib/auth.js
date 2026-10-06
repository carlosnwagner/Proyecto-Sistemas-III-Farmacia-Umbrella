// ==============================================================================
// Helper de Autenticación y Sesión Local (Desacoplado)
// Permite alternar fácilmente entre Cajero y Administrador para pruebas
// mientras se finaliza la pantalla de Login con Supabase Auth.
// ==============================================================================

const STORAGE_KEY = 'usuario_sesion_umbrella';

// Usuarios de prueba basados en los registros reales de Supabase
export const USUARIOS_PRUEBA = [
  {
    id_usuario: 14,
    usuario: 'Gunner912',
    nombre_completo: 'Havertz Kai',
    rol: 'cajero',
    sucursal_id: 5,
    sucursal_nombre: 'Sucursal Central - AV. San Martin 300'
  },
  {
    id_usuario: 13,
    usuario: 'BukayoSaka7',
    nombre_completo: 'Saka Bukayo',
    rol: 'administrador',
    sucursal_id: null,
    sucursal_nombre: 'Todas las sucursales'
  },
  {
    id_usuario: 1,
    usuario: 'jvalentine',
    nombre_completo: 'Jill Valentine',
    rol: 'administrador',
    sucursal_id: null,
    sucursal_nombre: 'Todas las sucursales'
  }
];

export function getUsuarioActual() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Error leyendo usuario de sesión:', err);
  }
  // Por defecto, iniciamos como Cajero (Gunner912) para validar el flujo operativo de la HU
  const defaultUser = USUARIOS_PRUEBA[0];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultUser));
  } catch {}
  return defaultUser;
}

export function setUsuarioActual(usuario) {
  try {
    if (!usuario) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(usuario));
    }
    // Disparar evento para que cualquier componente suscrito se actualice reactivamente
    window.dispatchEvent(new CustomEvent('umbrella-auth-changed', { detail: usuario }));
  } catch (err) {
    console.error('Error guardando usuario de sesión:', err);
  }
}

export function cerrarSesion() {
  setUsuarioActual(null);
}

export function esCajero(usuario = getUsuarioActual()) {
  return usuario?.rol === 'cajero';
}

export function esAdmin(usuario = getUsuarioActual()) {
  return usuario?.rol === 'administrador';
}
