export const monedaCaja = valor => valor == null ? '—' : Number(valor).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
export const fechaCaja = valor => valor ? new Date(valor).toLocaleString('es-AR') : '—';
