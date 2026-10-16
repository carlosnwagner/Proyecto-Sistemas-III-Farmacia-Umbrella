import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle, CircleAlert, LoaderCircle } from "lucide-react";
import { consultarPagoPedidoOnline, verificarRetornoPagoPedidoOnline } from "../services/catalogoPublico.js";
import { useCart } from "../hooks/useCart";

const moneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export default function ResultadoPagoOnline() {
  const [params] = useSearchParams();
  const { clearCart } = useCart();
  const [intento, setIntento] = useState(null);
  const [pedido, setPedido] = useState(null);
  const [estado, setEstado] = useState("Consultando");
  const [error, setError] = useState("");

  useEffect(() => {
    const id = params.get("intento") || sessionStorage.getItem("pedido-online-intento-mp");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      setEstado("Invalido");
      return undefined;
    }
    setIntento(id);
    let activo = true;
    let intentos = 0;
    let timer;
    const consultar = async () => {
      const { data, error: invokeError } = await consultarPagoPedidoOnline(id);
      if (!activo) return;
      if (invokeError) {
        setError("No pudimos consultar la confirmación. Volvé a intentarlo en unos segundos.");
      } else if (data?.status === "Aprobado") {
        setPedido(data);
        setEstado("Aprobado");
        sessionStorage.removeItem("pedido-online-intento-mp");
        for (const key of Object.keys(sessionStorage)) {
          if (key.startsWith("pedido-online-pendiente-")) sessionStorage.removeItem(key);
        }
        clearCart();
        return;
      } else if (["Reembolsado", "ReembolsoPendiente", "PagoSinPedido"].includes(data?.status)) {
        setEstado(data.status);
        return;
      } else if (params.get("resultado") === "failure") {
        setEstado("NoAprobado");
        return;
      } else {
        setEstado("Pendiente");
      }
      if (intentos++ < 30) timer = window.setTimeout(consultar, 2000);
    };
    const iniciarConsulta = async () => {
      if (params.get("resultado") === "success") {
        const { error: verifyError } = await verificarRetornoPagoPedidoOnline(id);
        if (!activo) return;
        if (verifyError) setError("Mercado Pago todavía no pudo validar el pago. No repitas la compra; consultá nuevamente en unos segundos.");
      }
      if (activo) consultar();
    };
    iniciarConsulta();
    return () => { activo = false; window.clearTimeout(timer); };
  }, [params, clearCart]);

  const titulo = {
    Aprobado: "¡Pago confirmado!",
    Pendiente: "Estamos confirmando tu pago",
    Consultando: "Consultando el pago",
    Reembolsado: "Pago reembolsado",
    ReembolsoPendiente: "Estamos procesando un reembolso",
    PagoSinPedido: "No pudimos registrar el pedido",
    NoAprobado: "El pago no fue aprobado",
    Invalido: "No encontramos una operación de pago",
  }[estado] || "Estado del pago";

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
    <section style={{ width: "min(100%, 560px)", boxSizing: "border-box", background: "white", padding: 32, borderRadius: 16, boxShadow: "0 8px 30px #00000010", textAlign: "center" }}>
      {estado === "Aprobado" ? <CheckCircle size={52} color="#16803d" /> : ["Pendiente", "Consultando", "ReembolsoPendiente"].includes(estado) ? <LoaderCircle size={48} color="#718f27" /> : <CircleAlert size={48} color="#b45309" />}
      <h1 style={{ margin: "16px 0 8px", fontSize: 25 }}>{titulo}</h1>
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      {estado === "Aprobado" && <>
        <p>Mercado Pago verificó el pago y la farmacia registró tu pedido para retirar en sucursal.</p>
        <p><strong>Pedido #{pedido.id_pedido}</strong></p>
        <p>Importe pagado: {moneda.format(Number(pedido.importe))}</p>
        <p>Para volver a encontrar tu pedido, entrá en <strong>Mis pedidos</strong> con el mismo correo que usaste al comprar. Esta referencia también te sirve como alternativa:</p>
        <code style={{ display: "block", overflowWrap: "anywhere", padding: 12, background: "#f0fdf4", borderRadius: 8 }}>{pedido.referencia}</code>
        <Link to="/pedido" style={{ display: "inline-block", marginTop: 18, color: "#15803d" }}>Ir a Mis pedidos</Link>
      </>}
      {estado === "Pendiente" && <p>El proveedor todavía no confirmó el resultado. Esta página seguirá consultando unos momentos; también podés volver luego sin repetir el pago.</p>}
      {estado === "ReembolsoPendiente" && <p>El pago fue aprobado, pero no se pudo validar stock. Estamos solicitando la devolución a Mercado Pago. El pedido no se registró.</p>}
      {estado === "Reembolsado" && <p>El pago fue devuelto porque no pudimos confirmar disponibilidad. El pedido no se registró.</p>}
      {estado === "PagoSinPedido" && <p>El pago fue recibido, pero la devolución automática necesita revisión de la farmacia. Contactanos con este identificador: {intento}</p>}
      {estado === "NoAprobado" && <p>Mercado Pago no confirmó un pago aprobado. No se registró ningún pedido.</p>}
      {estado === "Invalido" && <p>Volvé al catálogo e iniciá el checkout nuevamente.</p>}
      <Link to="/catalogo" style={{ display: "inline-block", marginTop: 22, padding: "12px 18px", borderRadius: 8, background: "#202020", color: "white", textDecoration: "none" }}>Volver al catálogo</Link>
    </section>
  </main>;
}
