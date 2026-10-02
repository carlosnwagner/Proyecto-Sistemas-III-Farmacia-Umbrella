/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import {
  loginUser,
  registerUser,
  logoutUser,
  fetchUserProfile,
  resendConfirmationEmail,
  resetPasswordForEmail,
} from '../services/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cargar usuario y perfil
  const loadUserData = async (authUser) => {
    if (!authUser) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const userProfile = await fetchUserProfile(authUser.id);
      if (userProfile && userProfile.estado === false) {
        // Usuario dado de baja
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
      } else {
        setUser(authUser);
        setProfile(userProfile);
      }
    } catch (err) {
      console.error('Error cargando datos de usuario:', err);
      setUser(authUser);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Obtener sesión activa al iniciar
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadUserData(session?.user ?? null);
    });

    // 2. Suscribirse a cambios de estado de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await loadUserData(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (credentials) => {
    const result = await loginUser(credentials);
    setUser(result.authData.user);
    setProfile(result.profile);
    return result;
  };

  const register = async (userData) => {
    const result = await registerUser(userData);
    if (result.authData?.user && result.authData?.session) {
      setUser(result.authData.user);
      setProfile(result.profile);
    }
    return result;
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user?.id) {
      const updated = await fetchUserProfile(user.id);
      setProfile(updated);
    }
  };

  const value = {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    refreshProfile,
    resendConfirmation: resendConfirmationEmail,
    resetPassword: resetPasswordForEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
}

/**
 * Componente para proteger rutas que requieren autenticación.
 */
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: '#2d241e',
          color: '#ffffff',
          gap: '1.25rem',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#3f332a',
            borderRadius: '1rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            animation: 'pulse 1.8s infinite ease-in-out',
          }}
        >
          <img
            src="/Umbrellafarmacia.svg"
            alt="Umbrella Farmacia"
            style={{ width: '64px', height: '64px', objectFit: 'contain' }}
          />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: '700', fontSize: '1.1rem', letterSpacing: '0.05em', color: '#ffffff' }}>
            FARMACIA UMBRELLA
          </p>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', marginTop: '0.25rem' }}>
            Verificando credenciales de acceso...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
