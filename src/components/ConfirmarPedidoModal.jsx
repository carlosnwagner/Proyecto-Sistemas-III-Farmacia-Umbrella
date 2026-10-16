import { useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Store, X } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { iniciarPagoPedidoOnline } from '../services/catalogoPublico.js';
import './CheckoutPedido.css';

const moneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });
const pasos = ['Datos personales', 'Retiro y pago', 'Confirmar y pagar'];

export const ConfirmarPedidoModal = ({ isOpen, onClose, sucursalId, sucursalNombre }) => {
  const { items, getSubtotal } = useCart();
  const recuperarPendiente = () => {
    try { return JSON.parse(sessionStorage.getItem(`pedido-online-pendiente-${sucursalId}`) || 'null'); }
    catch { return null; }
  };
  const pendienteInicial = recuperarPendiente();
  const [nombre, setNombre] = useState(pendienteInicial?.payload?.nombre || '');
  const [apellido, setApellido] = useState(pendienteInicial?.payload?.apellido || '');
  const [contacto, setContacto] = useState(pendienteInicial?.payload?.contacto || '');
  const [medioPago, setMedioPago] = useState(pendienteInicial?.payload?.medio_pago || pendienteInicial?.payload?.tipo_tarjeta || 'credito');
  const [paso, setPaso] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState('');

  if (!isOpen) return null;

  const validarDatos = () => {
    if (!nombre.trim() || !apellido.trim() || !contacto.trim()) {
      setErrorEnvio('Completá nombre, apellido y el correo que vas a usar para consultar tus pedidos.');
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(contacto.trim())) {
      setErrorEnvio('Ingresá un correo válido. Lo vas a necesitar para consultar el estado de tus pedidos.');
      return false;
    }
    if (!sucursalId) {
      setErrorEnvio('Seleccioná una sucursal de retiro en el catálogo.');
      return false;
    }
    setErrorEnvio('');
    return true;
  };

  const avanzar = () => {
    if (paso === 0 && !validarDatos()) return;
    if (items.length === 0) {
      setErrorEnvio('El carrito está vacío. Volvé al catálogo para agregar productos.');
      return;
    }
    setErrorEnvio('');
    setPaso((actual) => Math.min(actual + 1, pasos.length - 1));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (paso !== 2) {
      avanzar();
      return;
    }
    if (!validarDatos() || items.length === 0) {
      if (items.length === 0) setErrorEnvio('El carrito está vacío. Volvé al catálogo para agregar productos.');
      return;
    }
    setCargando(true);
    setErrorEnvio('');
    try {
      const claveKey = `pedido-online-pendiente-${sucursalId}`;
      const payload = { id_sucursal: Number(sucursalId), nombre: nombre.trim(), apellido: apellido.trim(), contacto: contacto.trim(), medio_pago: medioPago, items: items.map(({ id_articulo, cantidad, precio_venta }) => ({ id_articulo, cantidad, precio_venta })) };
      let pendiente = recuperarPendiente();
      if (!pendiente?.clave_idempotencia || JSON.stringify(pendiente.payload) !== JSON.stringify(payload)) {
        pendiente = { clave_idempotencia: crypto.randomUUID(), payload };
        sessionStorage.setItem(claveKey, JSON.stringify(pendiente));
      }
      const { data, error } = await iniciarPagoPedidoOnline({ clave_idempotencia: pendiente.clave_idempotencia, ...pendiente.payload });
      if (error) throw error;
      if (!data?.url || !data?.id_intento) throw new Error('Mercado Pago no devolvió el enlace de pago. Podés reintentar.');
      sessionStorage.setItem('pedido-online-intento-mp', data.id_intento);
      window.location.assign(data.url);
    } catch (err) {
      console.error(err);
      if (/cambió|disponible|vigente|sucursal seleccionada/i.test(err.message || '')) {
        sessionStorage.removeItem(`pedido-online-pendiente-${sucursalId}`);
      }
      setErrorEnvio(err.message || 'Hubo un error al iniciar el pago. Podés reintentar; el sistema evita duplicados.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="hu66-checkout-overlay" role="dialog" aria-modal="true" aria-label="Finalizar pedido de retiro">
      <div className="hu66-checkout">
        <header className="hu66-checkout-header">
          <button className="hu66-checkout-back" type="button" onClick={onClose}><ChevronLeft size={16} style={{ verticalAlign: 'middle' }} /> Volver al catálogo</button>
          <div className="hu66-checkout-brand"><img src="/Umbrellafarmacia.svg" alt="" /> Farmacia Umbrella</div>
          <button className="hu66-checkout-close" type="button" onClick={onClose} aria-label="Cerrar checkout"><X /></button>
        </header>

        {
          <div className="hu66-checkout-grid">
            <main className="hu66-checkout-main">
              <nav className="hu66-checkout-steps" aria-label="Pasos del pedido">{pasos.map((nombrePaso, indice) => <div key={nombrePaso} className={`hu66-checkout-step${paso === indice ? ' is-active' : ''}`}>{indice + 1} · {nombrePaso}</div>)}</nav>
              <form className="hu66-checkout-card" onSubmit={handleSubmit}>
                {errorEnvio && <div className="hu66-checkout-alert hu66-checkout-error" role="alert"><AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />{errorEnvio}</div>}

                {paso === 0 && <>
                  <h1>Datos personales</h1>
                  <p className="hu66-checkout-muted">Dejanos un contacto para identificar tu solicitud de retiro.</p>
                  <div className="hu66-checkout-fields">
                    <label className="hu66-checkout-field">Nombre *<input autoComplete="given-name" required maxLength={80} value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Tu nombre" /></label>
                    <label className="hu66-checkout-field">Apellido *<input autoComplete="family-name" required maxLength={80} value={apellido} onChange={(event) => setApellido(event.target.value)} placeholder="Tu apellido" /></label>
                    <label className="hu66-checkout-field is-wide">Correo electrónico *<input type="email" autoComplete="email" required maxLength={160} value={contacto} onChange={(event) => setContacto(event.target.value)} placeholder="tu@gmail.com" /><small>Te identificás con este correo para consultar el estado de tus pedidos.</small></label>
                  </div>
                  <div className="hu66-checkout-actions"><span /><button className="hu66-checkout-button" type="button" onClick={avanzar}>Continuar <ChevronRight size={16} style={{ verticalAlign: 'middle' }} /></button></div>
                </>}

                {paso === 1 && <>
                  <h1>Retiro y pago</h1>
                  <p className="hu66-checkout-muted">Tu solicitud queda asociada a la sucursal que elegiste en el catálogo.</p>
                  <div className="hu66-checkout-branch"><Store color="#5f8f13" /><div><strong>{sucursalNombre || 'Sucursal seleccionada'}</strong><span>Retiro presencial · La sucursal confirma disponibilidad al preparar el pedido.</span></div></div>
                  <div className="hu66-checkout-actions"><button className="hu66-checkout-button is-secondary" type="button" onClick={() => { setErrorEnvio(''); setPaso(0); }}><ChevronLeft size={16} style={{ verticalAlign: 'middle' }} /> Volver</button><button className="hu66-checkout-button" type="button" onClick={avanzar}>Continuar <ChevronRight size={16} style={{ verticalAlign: 'middle' }} /></button></div>
                </>}

                {paso === 2 && <>
                  <h1>Revisá y pagá tu pedido</h1>
                  <p className="hu66-checkout-muted">Verificá tus datos y el importe. El pedido se registra cuando el procesador confirma el pago.</p>
                  <div className="hu66-checkout-alert"><strong>{nombre} {apellido}</strong><br />{contacto}<br />{sucursalNombre || `Sucursal #${sucursalId}`}</div>
                  <div className="hu66-checkout-alert" style={{ marginTop: 16 }}><strong>Elegí cómo pagar</strong><br />Tarjetas y cuenta de Mercado Pago son opciones distintas. El pago se procesa de forma segura en Mercado Pago.</div>
                  <div className="hu66-checkout-payment-options" role="group" aria-label="Tipo de tarjeta">
                    {[
                      ['credito', 'Tarjeta de crédito', 'Visa · Mastercard'],
                      ['debito', 'Tarjeta de débito', 'Visa · Mastercard'],
                      ['mercado_pago', 'Mercado Pago', 'Pagar desde tu cuenta de MP'],
                    ].map(([metodo, etiqueta, detalle]) => <button key={metodo} type="button" aria-pressed={medioPago === metodo} onClick={() => setMedioPago(metodo)} className={`hu66-checkout-payment-option${medioPago === metodo ? ' is-selected' : ''}`}><strong>{etiqueta}</strong><small>{detalle}</small></button>)}
                  </div>
                  <div className="hu66-checkout-alert">{medioPago === 'mercado_pago' ? 'Al continuar, iniciarás sesión en tu cuenta de Mercado Pago para pagar.' : `Pagarás con tarjeta de ${medioPago}. Los datos se cargan en la página segura de Mercado Pago.`}<br />Total estimado: <strong>{moneda.format(getSubtotal())}</strong>. El precio y la disponibilidad se vuelven a validar antes del pago.</div>
                  <div className="hu66-checkout-actions"><button className="hu66-checkout-button is-secondary" type="button" onClick={() => { setErrorEnvio(''); setPaso(1); }}><ChevronLeft size={16} style={{ verticalAlign: 'middle' }} /> Volver</button><button className="hu66-checkout-button" type="submit" disabled={cargando || items.length === 0}>{cargando ? 'Conectando con el procesador…' : 'Confirmar y pagar'}</button></div>
                </>}
              </form>
            </main>

            <aside className="hu66-checkout-summary" aria-label="Resumen del pedido">
              <h2>Resumen del pedido</h2>
              <div className="hu66-checkout-items">{items.map((item) => <div className="hu66-checkout-item" key={item.id_articulo}>
                {item.imagen_url ? <img src={item.imagen_url} alt="" /> : <div aria-hidden="true" />}
                <div><div className="hu66-checkout-item-name">{item.nombre}</div><div className="hu66-checkout-item-qty">Cantidad: {item.cantidad}</div></div>
                <span className="hu66-checkout-item-price">{moneda.format(item.precio_venta * item.cantidad)}</span>
              </div>)}</div>
              <div className="hu66-checkout-total"><span>Importe estimado</span><strong>{moneda.format(getSubtotal())}</strong></div>
              <p className="hu66-checkout-summary-note">Retiro en sucursal · Elegí crédito, débito o tu cuenta de Mercado Pago al confirmar.</p>
            </aside>
          </div>
        }
      </div>
    </div>
  );
};
