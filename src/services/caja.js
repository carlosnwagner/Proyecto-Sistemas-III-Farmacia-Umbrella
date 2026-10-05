import { supabase } from '../lib/supabase';

/**
 * HU51 - Registrar Arqueo de Caja
 * Registra el efectivo contado y su diferencia respecto al esperado, sin alterar 
 * el saldo real ni generar movimientos contables.
 * 
 * @param {Object} payload 
 * @param {number} payload.turno_id - ID del turno de caja abierto
 * @param {number} payload.usuario_id - ID del usuario/cajero que realiza el arqueo
 * @param {number|string} payload.efectivo_esperado - Lo que el sistema dice que debería haber
 * @param {number|string} payload.efectivo_contado - Lo que el cajero contó físicamente
 * @param {number|string} payload.diferencia - Resultado de (contado - esperado)
 * 
 * @returns {Promise<{ data: object|null, error: Error|null }>}
 */
export async function registrarArqueoBackend(payload) {
  try {
    // armado de objeto asegurando que los valores monetarios sean números
    const insertPayload = {
      turno_id: payload.turno_id,
      usuario_id: payload.usuario_id,
      efectivo_esperado: Number(payload.efectivo_esperado),
      efectivo_contado: Number(payload.efectivo_contado),
      diferencia: Number(payload.diferencia)
      // Nota: 'fecha_hora' y 'valido_para_cierre' se autogeneran en la base de datos
    };

    // 2. Insertamos en Supabase
    const { data, error } = await supabase
      .from('arqueo_caja')
      .insert([insertPayload])
      .select()
      .single();

    // 3. Manejamos los errores de red o restricciones de PostgreSQL
    if (error) {
      console.error("Error en Supabase al registrar arqueo:", error);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };

  } catch (err) {
    // Capturamos cualquier error inesperado de ejecución
    console.error("Excepción en registrarArqueoBackend:", err);
    return { data: null, error: err };
  }
}