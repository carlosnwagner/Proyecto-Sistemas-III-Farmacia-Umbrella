// Conserva una operación pendiente hasta recibir una respuesta definitiva.
export function crearConfirmacionMovimiento(generarClave = () => crypto.randomUUID()) {
  let pendiente = null;
  return async function confirmar(payload, ejecutar) {
    const firma = JSON.stringify(payload);
    if (pendiente && pendiente.firma !== firma) {
      throw new Error('Hay un movimiento pendiente de verificar. Reintentá con los mismos datos antes de registrar otro.');
    }
    pendiente ||= { firma, clave: generarClave() };
    try {
      const resultado = await ejecutar({ ...payload, clave: pendiente.clave });
      pendiente = null;
      return resultado;
    } catch (error) {
      // Postgres confirmó rechazo y rollback. Fallas de red conservan la clave.
      if (/^[0-9A-Z]{5}$/.test(error.code || '')) pendiente = null;
      throw error;
    }
  };
}
