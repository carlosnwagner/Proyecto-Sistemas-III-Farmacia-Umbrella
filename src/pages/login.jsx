import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Mail,
  Lock,
  User,
  AtSign,
  Eye,
  EyeOff,
  AlertCircle,
  Send,
  X,
  RefreshCw,
  LogIn,
  UserPlus,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext.jsx';

// Rol con menos privilegios. Todo registro público entra con este rol;
// un administrador debe promover la cuenta después (ver nota de seguridad).
const DEFAULT_ROLE = 'vendedor';
const BRAND_COLOR = '#65482b';

// Evita inyectar HTML en las alertas de SweetAlert con datos del usuario
const escapeHtml = (str = '') =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const styles = `
  .lg-page {
    min-height: 100vh;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    box-sizing: border-box;
    background: radial-gradient(circle at 50% 15%, #3a2e26 0%, #201813 100%);
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
    color: #1f2937;
  }
  .lg-card {
    width: 100%;
    max-width: 420px;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px); /* Safari */
    border: 1px solid rgba(255, 255, 255, 0.25);
    border-radius: 0.5rem;
    padding: 2rem;
    box-sizing: border-box;
    box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.5);
  }
  .lg-brand { display: flex; align-items: center; gap: 0.85rem; margin-bottom: 1.75rem; }
  .lg-logo {
    width: 48px; height: 48px; flex-shrink: 0;
    display: grid; place-items: center;
    background: #2d241e; border-radius: 0.8rem;
  }
  .lg-logo img { width: 30px; height: 30px; object-fit: contain; }
  .lg-title { margin: 0; font-size: 1.15rem; font-weight: 700; color: #2d241e; line-height: 1.2; }
  .lg-subtitle {
    margin: 0.2rem 0 0; font-size: 0.8rem; color: #6b720;
    display: flex; align-items: center; gap: 0.4rem;
  }
  .lg-dot { width: 7px; height: 7px; border-radius: 50%; background: #84cc16; }

  .lg-tabs {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0.25rem;
    padding: 0.25rem; margin-bottom: 1.5rem;
    background: #f3f1ef; border-radius: 0.75rem;
  }
  .lg-tab {
    padding: 0.55rem; border: none; border-radius: 0.55rem;
    background: transparent; color: #6b7280;
    font: inherit; font-size: 0.875rem; font-weight: 500; cursor: pointer;
    transition: background-color 0.15s, color 0.15s, box-shadow 0.15s;
  }
  .lg-tab:hover { color: #2d241e; }
  .lg-tab[aria-selected='true'] {
    background: #fff; color: ${BRAND_COLOR}; font-weight: 600;
    box-shadow: 0 1px 3px rgba(45, 36, 30, 0.15);
  }

  .lg-form { display: flex; flex-direction: column; gap: 1rem; }
  .lg-field { display: flex; flex-direction: column; gap: 0.35rem; }
  .lg-row { display: flex; justify-content: space-between; align-items: center; }
  .lg-label { font-size: 0.825rem; font-weight: 600; color: #374151; }
  .lg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  @media (max-width: 440px) { .lg-grid { grid-template-columns: 1fr; } .lg-card { padding: 1.5rem; } }

  .lg-input-wrap { position: relative; }
  .lg-icon {
    position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%);
    color: #9ca3af; pointer-events: none; transition: color 0.15s;
  }
  .lg-input-wrap:focus-within .lg-icon { color: ${BRAND_COLOR}; }
  .lg-input {
    width: 100%; box-sizing: border-box;
    padding: 0.65rem 0.8rem 0.65rem 2.6rem;
    border: 1px solid #e5e7eb; border-radius: 0.65rem;
    background: #fafafa; font: inherit; font-size: 0.9rem; color: #1f2937;
    outline: none; transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;
  }
  .lg-input.has-toggle { padding-right: 2.6rem; }
  .lg-input::placeholder { color: #b6bbc3; }
  .lg-input:hover { border-color: #d1d5db; }
  .lg-input:focus {
    background: #fff; border-color: ${BRAND_COLOR};
    box-shadow: 0 0 0 3px rgba(101, 72, 43, 0.15);
  }
  .lg-input.is-invalid { border-color: #ef4444; }
  .lg-input.is-invalid:focus { box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15); }
  .lg-hint { margin: 0; font-size: 0.75rem; color: #ef4444; }

  .lg-toggle {
    position: absolute; right: 0.4rem; top: 50%; transform: translateY(-50%);
    display: grid; place-items: center; width: 32px; height: 32px;
    border: none; border-radius: 0.5rem; background: none; color: #9ca3af; cursor: pointer;
  }
  .lg-toggle:hover { color: #2d241e; background: #f3f1ef; }

  .lg-link {
    padding: 0; border: none; background: none; cursor: pointer;
    font: inherit; font-size: 0.775rem; font-weight: 600; color: ${BRAND_COLOR};
  }
  .lg-link:hover { text-decoration: underline; }

  .lg-btn {
    width: 100%; padding: 0.75rem; margin-top: 0.35rem;
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    border: none; border-radius: 0.7rem;
    background: #3f2d1f; color: #fff;
    font: inherit; font-size: 0.925rem; font-weight: 600; cursor: pointer;
    transition: background-color 0.15s, transform 0.1s;
  }
  .lg-btn:hover:not(:disabled) { background: #503822; }
  .lg-btn:active:not(:disabled) { transform: scale(0.99); }
  .lg-btn:disabled { opacity: 0.65; cursor: not-allowed; }
  .lg-btn-ghost {
    width: auto; margin: 0; padding: 0.55rem 1rem;
    background: #fff; color: #374151; border: 1px solid #e5e7eb; font-size: 0.875rem;
  }
  .lg-btn-ghost:hover:not(:disabled) { background: #f9fafb; }
  .lg-btn-sm { width: auto; margin: 0; padding: 0.55rem 1rem; font-size: 0.875rem; }

  .lg-alert {
    display: flex; gap: 0.6rem; align-items: flex-start;
    padding: 0.8rem 0.9rem; margin-bottom: 1.1rem;
    border-radius: 0.7rem; font-size: 0.825rem; line-height: 1.45;
  }
  .lg-alert-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .lg-alert-warn { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; flex-direction: column; }
  .lg-alert-warn p { margin: 0; }
  .lg-alert-warn .lg-btn {
    width: auto; margin: 0; padding: 0.4rem 0.8rem; font-size: 0.775rem;
    background: #92400e;
  }
  .lg-alert-warn .lg-btn:hover:not(:disabled) { background: #78350f; }

  .lg-note { margin: 0; font-size: 0.775rem; color: #6b7280; line-height: 1.45; }
  .lg-footer { margin: 1.5rem 0 0; text-align: center; font-size: 0.75rem; color: #9ca3af; }

  .lg-overlay {
    position: fixed; inset: 0; z-index: 1000; padding: 1rem;
    display: flex; align-items: center; justify-content: center;
    background: rgba(20, 14, 10, 0.6); backdrop-filter: blur(3px);
  }
  .lg-modal {
    width: 100%; max-width: 400px; padding: 1.5rem;
    background: #fff; border-radius: 1.1rem;
    box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.45);
  }
  .lg-modal-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem; }
  .lg-modal-title { margin: 0; font-size: 1.05rem; font-weight: 700; color: #2d241e; }
  .lg-modal-text { margin: 0 0 1.1rem; font-size: 0.85rem; color: #6b7280; line-height: 1.5; }
  .lg-close {
    display: grid; place-items: center; width: 30px; height: 30px; margin: -0.25rem -0.25rem 0 0;
    border: none; border-radius: 0.5rem; background: none; color: #9ca3af; cursor: pointer;
  }
  .lg-close:hover { background: #f3f1ef; color: #2d241e; }
  .lg-actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.25rem; }

  .lg-spin { animation: lg-spin 0.9s linear infinite; }
  @keyframes lg-spin { to { transform: rotate(360deg); } }
  .lg-tab:focus-visible, .lg-btn:focus-visible, .lg-link:focus-visible,
  .lg-toggle:focus-visible, .lg-close:focus-visible {
    outline: 2px solid ${BRAND_COLOR}; outline-offset: 2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .lg-spin { animation-duration: 2s; }
    .lg-btn, .lg-input, .lg-tab { transition: none; }
  }
`;

function Field({ id, label, icon: Icon, children }) {
  return (
    <div className="lg-field">
      <label className="lg-label" htmlFor={id}>
        {label}
      </label>
      <div className="lg-input-wrap">
        {Icon && <Icon size={17} className="lg-icon" />}
        {children}
      </div>
    </div>
  );
}

function PasswordToggle({ visible, onToggle }) {
  return (
    <button
      type="button"
      className="lg-toggle"
      onClick={onToggle}
      aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
    >
      {visible ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );
}

export default function Login() {
  const { user, login, register, resendConfirmation, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = location.state?.from?.pathname || '/inventario';

  // Redirigir si ya está autenticado (cubre también el caso post-login)
  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  const [activeTab, setActiveTab] = useState('login');

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Registro
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [unconfirmedEmail, setUnconfirmedEmail] = useState(null);
  const [resendingEmail, setResendingEmail] = useState(false);

  // Recuperar contraseña
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const passwordsMismatch = regConfirmPassword && regConfirmPassword !== regPassword;

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setErrorMsg('');
    setUnconfirmedEmail(null);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setUnconfirmedEmail(null);
    setLoading(true);

    try {
      const { profile } = await login({ email: loginEmail.trim(), password: loginPassword });
      const welcomeName = profile?.nombre_completo || profile?.usuario || 'Usuario';

      Swal.fire({
        position: 'center',
        icon: 'success',
        title: `¡Bienvenido, ${escapeHtml(welcomeName)}!`,
        text: 'Acceso autorizado al sistema Umbrella',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: true,
      });
      // La redirección la hace el useEffect cuando `user` se actualiza
    } catch (err) {
      console.error('Error en login:', err);
      if (err.code === 'EMAIL_NOT_CONFIRMED') {
        setUnconfirmedEmail(err.email || loginEmail);
        setErrorMsg(err.message);
      } else {
        setErrorMsg(err.message || 'No se pudo iniciar sesión. Revisa tus datos.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (!regFullName.trim()) throw new Error('El nombre completo es obligatorio.');
      if (regUsername.trim().length < 3) throw new Error('El usuario debe tener al menos 3 caracteres.');
      if (!regEmail.trim()) throw new Error('El correo electrónico es obligatorio.');
      if (regPassword.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
      if (regPassword !== regConfirmPassword) throw new Error('Las contraseñas no coinciden.');

      const result = await register({
        email: regEmail.trim(),
        password: regPassword,
        usuario: regUsername.trim(),
        nombreCompleto: regFullName.trim(),
        rol: DEFAULT_ROLE, // el usuario no elige su rol
      });

      if (result.requiresConfirmation) {
        await Swal.fire({
          icon: 'info',
          title: 'Cuenta creada',
          html: `
            <p style="margin-bottom:0.75rem;color:#374151;">
              Registramos al usuario <b>${escapeHtml(regUsername)}</b>.
            </p>
            <p style="font-size:0.9rem;color:#4b5563;background:#f3f4f6;padding:0.75rem;border-radius:0.5rem;">
              Enviamos un correo de confirmación a <b>${escapeHtml(regEmail)}</b>. Confírmalo antes de iniciar sesión.
            </p>
          `,
          confirmButtonText: 'Ir a iniciar sesión',
          confirmButtonColor: BRAND_COLOR,
        });

        setLoginEmail(regEmail.trim());
        setLoginPassword('');
        setRegPassword('');
        setRegConfirmPassword('');
        setActiveTab('login');
      } else {
        Swal.fire({
          icon: 'success',
          title: 'Registro exitoso',
          text: `Bienvenido a Farmacia Umbrella, ${regFullName}.`,
          showConfirmButton: false,
          timer: 1600,
        });
        navigate('/inventario', { replace: true });
      }
    } catch (err) {
      console.error('Error en registro:', err);
      setErrorMsg(err.message || 'No se pudo crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!unconfirmedEmail) return;
    setResendingEmail(true);
    try {
      await resendConfirmation(unconfirmedEmail);
      Swal.fire({
        icon: 'success',
        title: 'Correo reenviado',
        text: `Enviamos un nuevo enlace de activación a ${unconfirmedEmail}.`,
        confirmButtonColor: BRAND_COLOR,
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo reenviar',
        text: err.message || 'Inténtalo de nuevo más tarde.',
        confirmButtonColor: BRAND_COLOR,
      });
    } finally {
      setResendingEmail(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);

    try {
      await resetPassword(resetEmail.trim());
      setIsResetModalOpen(false);
      setResetEmail('');
      Swal.fire({
        icon: 'success',
        title: 'Enlace enviado',
        text: 'Te enviamos un correo con instrucciones para restablecer tu contraseña.',
        confirmButtonColor: BRAND_COLOR,
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo enviar',
        text: err.message || 'No se pudo procesar la solicitud.',
        confirmButtonColor: BRAND_COLOR,
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="lg-page">
      <style>{styles}</style>

      <main className="lg-card">
        <header className="lg-brand">
          <div className="lg-logo">
            <img src="/Umbrellafarmacia.svg" alt="" />
          </div>
          <div>
            <h1 className="lg-title">Farmacia Umbrella</h1>
            <p className="lg-subtitle">
              <span className="lg-dot" />
              Acceso y control del sistema
            </p>
          </div>
        </header>

        <div className="lg-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'login'}
            className="lg-tab"
            onClick={() => handleTabChange('login')}
          >
            <LogIn size={17} /> Iniciar sesión
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'register'}
            className="lg-tab"
            onClick={() => handleTabChange('register')}
          >
           <UserPlus size={17} /> Crear cuenta
          </button>
        </div>

        {errorMsg && (
          <div className="lg-alert lg-alert-error" role="alert">
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>{errorMsg}</div>
          </div>
        )}

        {unconfirmedEmail && (
          <div className="lg-alert lg-alert-warn">
            <p>
              ¿No te llegó el correo de activación a <b>{unconfirmedEmail}</b>?
            </p>
            <button type="button" className="lg-btn" onClick={handleResendConfirmation} disabled={resendingEmail}>
              <RefreshCw size={14} className={resendingEmail ? 'lg-spin' : ''} />
              {resendingEmail ? 'Reenviando…' : 'Reenviar correo'}
            </button>
          </div>
        )}

        {/* ============ LOGIN ============ */}
        {activeTab === 'login' && (
          <form className="lg-form" onSubmit={handleLoginSubmit}>
            <Field id="login-email" label="Correo electrónico" icon={Mail}>
              <input
                id="login-email"
                className="lg-input"
                type="email"
                required
                autoComplete="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="nombre@umbrella.corp"
              />
            </Field>

            <div className="lg-field">
              <div className="lg-row">
                <label className="lg-label" htmlFor="login-password">
                  Contraseña
                </label>
                <button
                  type="button"
                  className="lg-link"
                  onClick={() => {
                    setResetEmail(loginEmail);
                    setIsResetModalOpen(true);
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="lg-input-wrap">
                <Lock size={17} className="lg-icon" />
                <input
                  id="login-password"
                  className="lg-input has-toggle"
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Tu contraseña"
                />
                <PasswordToggle
                  visible={showLoginPassword}
                  onToggle={() => setShowLoginPassword((v) => !v)}
                />
              </div>
            </div>

            <button type="submit" className="lg-btn" disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw size={17} className="lg-spin" /> Verificando…
                </>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>
        )}

        {/* ============ REGISTRO ============ */}
        {activeTab === 'register' && (
          <form className="lg-form" onSubmit={handleRegisterSubmit}>
            <Field id="reg-name" label="Nombre completo" icon={User}>
              <input
                id="reg-name"
                className="lg-input"
                type="text"
                required
                autoComplete="name"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                placeholder="Jill Valentine"
              />
            </Field>

            <Field id="reg-username" label="Usuario" icon={AtSign}>
              <input
                id="reg-username"
                className="lg-input"
                type="text"
                required
                minLength={3}
                autoComplete="username"
                value={regUsername}
                onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                placeholder="jvalentine"
              />
            </Field>

            <Field id="reg-email" label="Correo electrónico" icon={Mail}>
              <input
                id="reg-email"
                className="lg-input"
                type="email"
                required
                autoComplete="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="jill.valentine@umbrella.corp"
              />
            </Field>

            <div className="lg-grid">
              <div className="lg-field">
                <label className="lg-label" htmlFor="reg-password">
                  Contraseña
                </label>
                <div className="lg-input-wrap">
                  <Lock size={17} className="lg-icon" />
                  <input
                    id="reg-password"
                    className="lg-input has-toggle"
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Mínimo 6"
                  />
                  <PasswordToggle visible={showRegPassword} onToggle={() => setShowRegPassword((v) => !v)} />
                </div>
              </div>

              <div className="lg-field">
                <label className="lg-label" htmlFor="reg-confirm">
                  Confirmar
                </label>
                <div className="lg-input-wrap">
                  <Lock size={17} className="lg-icon" />
                  <input
                    id="reg-confirm"
                    className={`lg-input${passwordsMismatch ? ' is-invalid' : ''}`}
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Repítela"
                    aria-invalid={Boolean(passwordsMismatch)}
                  />
                </div>
              </div>
            </div>
            {passwordsMismatch && <p className="lg-hint">Las contraseñas no coinciden.</p>}

            <p className="lg-note">
              Tu cuenta se crea con acceso básico. Un administrador puede asignarte más permisos después.
            </p>

            <button type="submit" className="lg-btn" disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw size={17} className="lg-spin" /> Creando cuenta…
                </>
              ) : (
                'Crear cuenta'
              )}
            </button>
          </form>
        )}

        <p className="lg-footer">Acceso restringido a personal autorizado de Umbrella Corporation.</p>
      </main>

      {/* ============ MODAL RECUPERAR CONTRASEÑA ============ */}
      {isResetModalOpen && (
        <div
          className="lg-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-title"
          onClick={(e) => e.target === e.currentTarget && setIsResetModalOpen(false)}
        >
          <div className="lg-modal">
            <div className="lg-modal-head">
              <h2 id="reset-title" className="lg-modal-title">
                Recuperar contraseña
              </h2>
              <button
                type="button"
                className="lg-close"
                onClick={() => setIsResetModalOpen(false)}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetSubmit}>
              <p className="lg-modal-text">
                Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.
              </p>
              <Field id="reset-email" label="Correo electrónico" icon={Mail}>
                <input
                  id="reset-email"
                  className="lg-input"
                  type="email"
                  required
                  autoFocus
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="nombre@umbrella.corp"
                />
              </Field>

              <div className="lg-actions">
                <button type="button" className="lg-btn lg-btn-ghost" onClick={() => setIsResetModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="lg-btn lg-btn-sm" disabled={resetLoading}>
                  {resetLoading ? (
                    'Enviando…'
                  ) : (
                    <>
                      <Send size={15} /> Enviar enlace
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
