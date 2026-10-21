import { supabase } from '../lib/supabase';
/**
 * Sube una imagen a un bucket de Supabase y devuelve la URL pública.
 * 
 * @param {File} file - El objeto File proveniente del input de React.
 * @param {string} bucketName - El nombre exacto del bucket en Supabase.
 * @param {string} folder - (Opcional) Subcarpeta, ej: 'productos' o 'proveedores'.
 * @returns {Promise<{ url: string|null, error: Error|null }>}
 */

export async function uploadImage(file, bucketName, folder = 'general') {
  try {
    const fileExtension = file.name.split('.').pop();
    // Se genera nombre único para evitar sobreescribir imágenes con el mismo nombre
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
    const filePath = `${folder}/${uniqueFileName}`;

    // Subir el archivo a Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    // Obtener la URL pública para guardarla en la base de datos
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return { url: publicUrlData.publicUrl, error: null };

  } catch (error) {
    console.error("Error en uploadImage:", error);
    return { url: null, error };
  }
}

