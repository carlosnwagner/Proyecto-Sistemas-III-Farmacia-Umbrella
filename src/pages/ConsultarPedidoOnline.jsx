import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ClipboardList, Search, Store, LogOut, MailCheck } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import {
  consultarEstadoPedidoOnline,
  listarMisPedidosOnline,
  solicitarCodigoCliente,
} from "../services/catalogoPublico.js";

const estados = {
  Pendiente: "Pendiente de revisión en sucursal",
  Preparado: "Preparado para retirar",
  Entregado: "Pedido entregado",
  Cancelado: "Pedido cancelado",
};
const moneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const estiloBoton = { padding: "10px 14px", border: 0, borderRadius: 8, color: "white", background: "#15803d", cursor: "pointer", fontWeight: 600 };
const estiloInput = { width: "100%", boxSizing: "border-box", padding: 12, border: "1px solid #cbd5e1", borderRadius: 8 };

function TarjetaPedido({ pedido }) {
  return <article style={{ marginTop: 16, border: "1px solid #dbe3dc", borderRadius: 12, padding: 16 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <strong>Pedido #{pedido.id_pedido}</strong><strong>{estados[pedido.estado] || pedido.estado}</strong>
    </div>
    <p style={{ color: "#64748b", margin: "6px 0 12px" }}>Creado {new Date(pedido.fecha_creacion).toLocaleString("es-AR")}</p>
    <p><Store size={15} style={{ verticalAlign: "middle" }} /> {pedido.sucursal?.codigo || pedido.sucursal_codigo} — {pedido.sucursal?.descripcion || pedido.sucursal_descripcion}</p>
    {(pedido.items || []).map((item) => <div key={`${item.nombre}-${item.cantidad}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, margin: "6px 0" }}><span>{item.cantidad} × {item.nombre}</span><span>{moneda.format(Number(item.subtotal))}</span></div>)}
    <strong style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: 10, marginTop: 10 }}>Importe <span>{moneda.format(Number(pedido.importe_estimado))}</span></strong>
    {pedido.estado === "Cancelado" && pedido.motivo_cancelacion && <p><b>Motivo:</b> {pedido.motivo_cancelacion}</p>}
    {pedido.estado === "Pendiente" && <p style={{ color: "#475569" }}>El pago fue aprobado online. La sucursal confirmará la disponibilidad al preparar el pedido.</p>}
    <small style={{ color: "#64748b" }}>Última actualización: {new Date(pedido.fecha_actualizacion).toLocaleString("es-AR")}</small>
  </article>;
}

export default function ConsultarPedidoOnline() {
  const [searchParams] = useSearchParams();
  const [referencia, setReferencia] = useState(searchParams.get("referencia") || "");
  const [pedido, setPedido] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [linkEnviado, setLinkEnviado] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [misPedidos, setMisPedidos] = useState([]);
  const [cargandoMisPedidos, setCargandoMisPedidos] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [authError, setAuthError] = useState("");

  async function cargarPedidosCliente() {
    setCargandoMisPedidos(true);
    setAuthError("");
    const { data, error: consultaError } = await listarMisPedidosOnline();
    if (consultaError) setAuthError("No se pudieron cargar tus pedidos. Actualizá la página e intentá nuevamente.");
    else setMisPedidos(data);
    setCargandoMisPedidos(false);
  }

  useEffect(() => {
    let vigente = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!vigente) return;
      const user = data?.user;
      if (user?.email_confirmed_at) {
        setAuthUser(user);
        setEmail(user.email || "");
        cargarPedidosCliente();
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (user?.email_confirmed_at) {
        setAuthUser(user);
        setEmail(user.email || "");
        setLinkEnviado(false);
        setMensaje("Correo verificado. Ya podés consultar tus pedidos.");
        setTimeout(() => cargarPedidosCliente(), 0);
      } else {
        setAuthUser(null);
        setMisPedidos([]);
      }
    });
    return () => { vigente = false; listener.subscription.unsubscribe(); };
  }, []);

  async function buscar(event) {
    event.preventDefault();
    const valor = referencia.trim();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)) {
      setError("Ingresá la referencia privada completa que recibiste al confirmar.");
      setPedido(null);
      return;
    }
    setBuscando(true); setError(""); setPedido(null);
    const { data, error: errorConsulta } = await consultarEstadoPedidoOnline(valor);
    if (errorConsulta) setError("No se pudo consultar el pedido. Intentá nuevamente.");
    else if (!data) setError("No encontramos un pedido con esa referencia.");
    else setPedido(data);
    setBuscando(false);
  }

  async function enviarCodigo(event) {
    event.preventDefault(); setAuthError(""); setMensaje("");
    const limpio = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(limpio)) { setAuthError("Ingresá un correo válido."); return; }
    const { error: sendError } = await solicitarCodigoCliente(limpio);
    if (sendError) setAuthError("No se pudo enviar el enlace. Revisá el correo e intentá nuevamente.");
    else { setEmail(limpio); setLinkEnviado(true); setMensaje("Te enviamos un enlace para ingresar. Abrilo desde este dispositivo y volverás a Mis pedidos."); }
  }

  async function cerrarSesion() {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setAuthError("No se pudo cerrar la sesión. Intentá nuevamente.");
    else { setAuthUser(null); setMisPedidos([]); setMensaje(""); setLinkEnviado(false); }
  }

  useEffect(() => {
    if (!searchParams.get("referencia")) return;
    document.querySelector("[data-consulta-pedido]")?.requestSubmit();
  }, [searchParams]);

  return <main style={{ minHeight: "100vh", background: "#f8fafc", padding: "32px 16px", fontFamily: "system-ui, sans-serif" }}>
    <section style={{ maxWidth: 680, margin: "0 auto", background: "white", borderRadius: 16, padding: 28, boxShadow: "0 8px 30px #00000010" }}>
      <Link to="/catalogo" style={{ color: "#15803d", textDecoration: "none" }}>← Volver al catálogo</Link>
      <div style={{ marginTop: 24, display: "flex", gap: 12, alignItems: "center" }}><ClipboardList color="#15803d" /><div><h1 style={{ margin: 0, fontSize: 24 }}>Mis pedidos</h1><p style={{ margin: "6px 0 0", color: "#64748b" }}>Verificá el correo que usaste al comprar para consultar tus pedidos.</p></div></div>

      {authUser ? <section style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 12, background: "#f0fdf4", borderRadius: 8 }}><span><MailCheck size={16} style={{ verticalAlign: "middle" }} /> Sesión verificada: <strong>{authUser.email}</strong></span><button type="button" onClick={cerrarSesion} style={{ ...estiloBoton, background: "white", color: "#166534", border: "1px solid #86efac" }}><LogOut size={15} style={{ verticalAlign: "middle" }} /> Salir</button></div>
        {mensaje && <p role="status" style={{ color: "#166534" }}>{mensaje}</p>}
        {authError && <p role="alert" style={{ color: "#b91c1c", background: "#fef2f2", padding: 12, borderRadius: 8 }}>{authError}</p>}
        {cargandoMisPedidos ? <p>Cargando pedidos…</p> : misPedidos.length ? misPedidos.map((item) => <TarjetaPedido key={item.id_pedido} pedido={item} />) : !authError && <p style={{ marginTop: 20, color: "#475569" }}>No encontramos compras asociadas a este correo. Usá el mismo correo que escribiste en el checkout.</p>}
        <button type="button" onClick={cargarPedidosCliente} disabled={cargandoMisPedidos} style={{ ...estiloBoton, marginTop: 16 }}>{cargandoMisPedidos ? "Actualizando…" : "Actualizar pedidos"}</button>
      </section> : <section style={{ marginTop: 24, padding: 16, background: "#f8fafc", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Ingresá con tu correo</h2>
        <p style={{ color: "#475569" }}>Te mandamos un enlace de un solo uso; no necesitás crear una contraseña. Abrilo desde este dispositivo para verificar el correo usado en la compra.</p>
        <form onSubmit={enviarCodigo} style={{ display: "grid", gap: 12 }}>
          <label>Correo electrónico<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={linkEnviado} placeholder="tu@gmail.com" style={{ ...estiloInput, marginTop: 6 }} /></label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="submit" style={estiloBoton}>{linkEnviado ? "Reenviar enlace" : "Enviar enlace"}</button>{linkEnviado && <button type="button" onClick={() => { setLinkEnviado(false); setAuthError(""); setMensaje(""); }} style={{ ...estiloBoton, background: "white", color: "#166534", border: "1px solid #86efac" }}>Cambiar correo</button>}</div>
        </form>
        {mensaje && <p role="status" style={{ color: "#166534" }}>{mensaje}</p>}
        {authError && <p role="alert" style={{ color: "#b91c1c", background: "#fef2f2", padding: 12, borderRadius: 8 }}>{authError}</p>}
      </section>}

      <details style={{ marginTop: 28, borderTop: "1px solid #e2e8f0", paddingTop: 18 }}>
        <summary style={{ cursor: "pointer", color: "#475569" }}>¿Tenés la referencia privada? Consultá un pedido sin iniciar sesión</summary>
        <form data-consulta-pedido onSubmit={buscar} style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <input aria-label="Referencia privada del pedido" value={referencia} onChange={(event) => setReferencia(event.target.value)} placeholder="Referencia privada" autoComplete="off" style={{ ...estiloInput, flex: 1, minWidth: 0, fontFamily: "monospace" }} />
          <button type="submit" disabled={buscando} style={{ ...estiloBoton, display: "inline-flex", alignItems: "center", gap: 6 }}><Search size={17} />{buscando ? "Buscando" : "Consultar"}</button>
        </form>
        {error && <p role="alert" style={{ color: "#b91c1c", background: "#fef2f2", padding: 12, borderRadius: 8, marginTop: 16 }}>{error}</p>}
        {pedido && <TarjetaPedido pedido={pedido} />}
      </details>
    </section>
  </main>;
}
