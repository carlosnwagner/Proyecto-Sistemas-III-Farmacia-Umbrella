import { supabase } from '../lib/supabase.js';

/**
 * Iniciar sesión con email y contraseña.
 * Verifica también el estado activo del usuario en la tabla 'usuario'.
 */
export async function loginUser({ email, password }) {
  const cleanEmail = email.trim();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password,
  });

  if (authError) {
    const errorMsg = authError.message || '';
    if (authError.code === 'email_not_confirmed' || errorMsg.toLowerCase().includes('email not confirmed')) {
      const err = new Error('El correo electrónico aún no ha sido confirmado. Revisa tu bandeja de entrada o spam.');
      err.code = 'EMAIL_NOT_CONFIRMED';
      err.email = cleanEmail;
      throw err;
    }
    if (errorMsg.toLowerCase().includes('invalid login credentials')) {
      throw new Error('Correo o contraseña incorrectos.');
    }
    throw authError;
  }

  const userId = authData.user.id;

  // Consultar el perfil en la tabla 'usuario'
  let { data: profile } = await supabase
    .from('usuario')
    .select('*')
    .eq('auth_id', userId)
    .maybeSingle();

  // Si no se encuentra perfil por auth_id, verificar si existe un registro huérfano por username o crearlo
  if (!profile) {
    const meta = authData.user.user_metadata || {};
    const fallbackUsername = meta.usuario || cleanEmail.split('@')[0];
    const fallbackName = meta.nombre_completo || fallbackUsername;
    const fallbackRole = meta.rol || 'administrador';

    // Verificar si existía por username con auth_id null
    const { data: existingByName } = await supabase
      .from('usuario')
      .select('*')
      .eq('usuario', fallbackUsername)
      .maybeSingle();

    if (existingByName && !existingByName.auth_id) {
      const { data: updatedProfile } = await supabase
        .from('usuario')
        .update({ auth_id: userId, estado: true })
        .eq('id_usuario', existingByName.id_usuario)
        .select()
        .single();
      profile = updatedProfile;
    } else {
      // Crear registro en la tabla usuario
      const { data: newProfile, error: insertError } = await supabase
        .from('usuario')
        .insert([{
          usuario: fallbackUsername,
          nombre_completo: fallbackName,
          rol: fallbackRole,
          estado: true,
          fecha_registro: new Date().toISOString(),
          auth_id: userId,
        }])
        .select()
        .maybeSingle();

      if (!insertError && newProfile) {
        profile = newProfile;
      }
    }
  }

  // Verificar si el usuario está activo
  if (profile && profile.estado === false) {
    await supabase.auth.signOut();
    throw new Error('El usuario se encuentra inactivo. Consulte con el administrador del sistema.');
  }

  return { authData, profile };
}

/**
 * Registro de un nuevo usuario en Supabase Auth y en la tabla 'usuario'.
 */
export async function registerUser({ email, password, usuario, nombreCompleto, rol = 'administrador' }) {
  const cleanEmail = email.trim();
  const cleanUsuario = usuario.trim();
  const cleanNombre = nombreCompleto.trim();

  // 1. Validar si el nombre de usuario ya está tomado por una cuenta activa
  const { data: existingUser } = await supabase
    .from('usuario')
    .select('id_usuario, usuario, auth_id')
    .eq('usuario', cleanUsuario)
    .maybeSingle();

  if (existingUser && existingUser.auth_id) {
    throw new Error('El nombre de usuario ya se encuentra registrado por otra cuenta.');
  }

  // 2. Registrar en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: {
        usuario: cleanUsuario,
        nombre_completo: cleanNombre,
        rol: rol,
      },
    },
  });

  if (authError) {
    const errorMsg = authError.message || '';
    if (errorMsg.toLowerCase().includes('already registered')) {
      throw new Error('El correo electrónico ya se encuentra registrado.');
    }
    if (errorMsg.toLowerCase().includes('rate limit')) {
      throw new Error('Límite de solicitudes alcanzado. Por favor intenta de nuevo en unos minutos.');
    }
    if (errorMsg.toLowerCase().includes('password')) {
      throw new Error('La contraseña no cumple con los requisitos de seguridad.');
    }
    throw authError;
  }

  const userId = authData?.user?.id;
  if (!userId) {
    throw new Error('No se pudo completar el registro de autenticación.');
  }

  // 3. Sincronizar con la tabla public.usuario
  let savedProfile = null;

  if (existingUser && !existingUser.auth_id) {
    // Si ya existía el usuario con auth_id null (ej. usuarios iniciales del seed)
    const { data: updated, error: updateError } = await supabase
      .from('usuario')
      .update({
        auth_id: userId,
        nombre_completo: cleanNombre,
        rol: rol,
        estado: true,
      })
      .eq('id_usuario', existingUser.id_usuario)
      .select()
      .single();

    if (!updateError) savedProfile = updated;
  } else {
    // Verificar si un trigger de Supabase ya creó una fila con ese auth_id
    const { data: triggerRow } = await supabase
      .from('usuario')
      .select('id_usuario')
      .eq('auth_id', userId)
      .maybeSingle();

    if (triggerRow) {
      // Actualizar con los datos reales ingresados en el formulario
      const { data: updated, error: updateError } = await supabase
        .from('usuario')
        .update({
          usuario: cleanUsuario,
          nombre_completo: cleanNombre,
          rol: rol,
          estado: true,
        })
        .eq('id_usuario', triggerRow.id_usuario)
        .select()
        .single();

      if (!updateError) savedProfile = updated;
    } else {
      // Insertar nuevo usuario en la tabla
      const { data: inserted, error: insertError } = await supabase
        .from('usuario')
        .insert([{
          usuario: cleanUsuario,
          nombre_completo: cleanNombre,
          rol: rol,
          estado: true,
          fecha_registro: new Date().toISOString(),
          auth_id: userId,
        }])
        .select()
        .maybeSingle();

      if (!insertError) savedProfile = inserted;
    }
  }

  return {
    authData,
    profile: savedProfile,
    requiresConfirmation: !authData.session,
  };
}

/**
 * Reenviar correo de confirmación de registro
 */
export async function resendConfirmationEmail(email) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
  });
  if (error) throw error;
  return true;
}

/**
 * Enviar enlace para restablecer contraseña
 */
export async function resetPasswordForEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/login`,
  });
  if (error) throw error;
  return true;
}

/**
 * Cerrar sesión actual
 */
export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  return true;
}

/**
 * Obtener perfil de la tabla usuario a partir de su auth_id
 */
export async function fetchUserProfile(authId) {
  if (!authId) return null;
  const { data, error } = await supabase
    .from('usuario')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle();

  if (error) {
    console.error('Error al obtener perfil de usuario:', error);
    return null;
  }
  return data;
}
