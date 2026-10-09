/**
 * Configuración central de roles.
 * Para agregar un rol nuevo (ej. farmaceutico):
 *   1. Agregarlo en ROLES.
 *   2. Agregarlo en ROLES_ACTIVOS (si debe poder usar el sistema).
 *   3. Definir su página de inicio en RUTA_INICIAL_POR_ROL.
 *   4. Crear su grupo de rutas en App.jsx con <RoleRoute allowedRoles={[ROLES.NUEVO]} />.
 */


export const ROLES = {
  ADMIN: 'administrador',
  CAJERO: 'cajero',
  PENDIENTE: 'pendiente',
};


// Roles que pueden usar el sistema (pendiente queda afuera a propósito)
export const ROLES_ACTIVOS = [ROLES.ADMIN, ROLES.CAJERO];

// Roles que pasan cualquier RoleRoute (acceso total)
export const ROLES_SUPERUSUARIO = [ROLES.ADMIN];

// Ruta a la que va cada rol después de iniciar sesión o al entrar a "/"
export const RUTA_INICIAL_POR_ROL = {
  [ROLES.ADMIN]: '/inventario',
  [ROLES.CAJERO]: '/caja',
  [ROLES.PENDIENTE]: '/inicio',
};
// Para roles sin configurar o perfiles sin rol
export const RUTA_POR_DEFECTO = '/inicio';

export const getRutaInicial = (rol) => RUTA_INICIAL_POR_ROL[rol] ?? RUTA_POR_DEFECTO;

/**
 * Menú lateral: qué ítems ve cada rol.
 * Las claves son las `key` de los ítems de Sidebar.jsx:
 *   Principales: Inicio, Inventario, Sucursales, Depositos, reportes, Configuracion
 *   Compras:      Proveedores, OrdenesCompra, Facturas, Pagos, Notas
 *   Ventas:       RegistroVentas, ClientesVentas, ListasPrecios
 * '*' = ve todo. Un grupo (Compras/Ventas) aparece solo si el rol ve al menos uno de sus submenús.
 */
export const MENU_POR_ROL = {
  [ROLES.ADMIN]: '*',
  [ROLES.CAJERO]: [
    'Inicio',
    'Configuracion',
    // Caja
    'AperturaCaja',
    'TurnosCaja',
    'MovimientosCaja',
    'ArqueoCaja',
    'CierreCaja',
    'DemoCaja',
    // Ventas (Añadido para cumplir con la HU69)
    'RegistroVentas',
  ],
  [ROLES.PENDIENTE]: ['Inicio'],
};
// "Inicio" lo ve cualquier usuario autenticado (igual que la ruta /inicio)
const MENU_BASE = ['Inicio'];

export const puedeVerMenu = (rol, key) => {
  const permitidos = MENU_POR_ROL[rol];
  if (permitidos === '*') return true;
  return [...MENU_BASE, ...(permitidos ?? [])].includes(key);
};