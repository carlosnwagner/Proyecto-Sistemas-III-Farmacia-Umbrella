export function validarPeriodo(desde, hasta) {
  const valida = valor => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor || '')) return false;
    const fecha = new Date(`${valor}T12:00:00Z`);
    return Number.isFinite(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
  };
  if (!valida(desde) || !valida(hasta)) return 'Ingresá fechas válidas desde y hasta.';
  if (desde > hasta) return 'La fecha desde debe ser anterior o igual a hasta.';
  return '';
}

export const monedaFinanzas = valor => Number(valor).toLocaleString('es-AR', {
  style: 'currency', currency: 'ARS',
});
export const fechaFinanzas = valor => new Date(valor).toLocaleDateString('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
});
