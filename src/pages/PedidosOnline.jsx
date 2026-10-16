import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, ClipboardList, RefreshCw, Search, Store, CreditCard, PackageCheck, CircleCheck, Ban, X, RotateCcw } from "lucide-react";
import { actualizarEstadoPedidoOnline, listarPedidosOnline, reembolsarPedidoOnline } from "../services/catalogoPublico.js";
import "./PedidosOnline.css";

const moneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const fecha = (valor) => new Date(valor).toLocaleString("es-AR");
const pedidoAbierto = (estado) => ["Pendiente", "Preparado"].includes(estado);

export default function PedidosOnline() {
  const [pedidos, setPedidos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [pedidoCancelacion, setPedidoCancelacion] = useState(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [errorCancelacion, setErrorCancelacion] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    const { data, error: errorCarga } = await listarPedidosOnline();
    if (errorCarga) setError(`No se pudieron cargar los pedidos: ${errorCarga.message}`);
    else setPedidos(Array.isArray(data) ? data : []);
    setCargando(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const conteos = useMemo(() => ({
    todos: pedidos.length,
    pendientes: pedidos.filter((pedido) => pedidoAbierto(pedido.estado)).length,
    entregados: pedidos.filter((pedido) => pedido.estado === "Entregado").length,
    cancelados: pedidos.filter((pedido) => pedido.estado === "Cancelado").length,
  }), [pedidos]);

  const pedidosVisibles = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase("es");
    return pedidos.filter((pedido) => {
      const coincideEstado = estadoFiltro === "Todos"
        || (estadoFiltro === "Pendientes" && pedidoAbierto(pedido.estado))
        || (estadoFiltro === "Entregados" && pedido.estado === "Entregado")
        || (estadoFiltro === "Cancelados" && pedido.estado === "Cancelado");
      const coincideTexto = !termino || [pedido.nombre_cliente, pedido.apellido_cliente, pedido.contacto, pedido.referencia, pedido.sucursal?.descripcion]
        .some((valor) => String(valor || "").toLocaleLowerCase("es").includes(termino));
      return coincideEstado && coincideTexto;
    });
  }, [pedidos, busqueda, estadoFiltro]);

  const pedidosPorPagina = 4;
  const totalPaginas = Math.max(1, Math.ceil(pedidosVisibles.length / pedidosPorPagina));
  const pedidosPagina = pedidosVisibles.slice((pagina - 1) * pedidosPorPagina, pagina * pedidosPorPagina);

  useEffect(() => { setPagina(1); }, [busqueda, estadoFiltro]);
  useEffect(() => { if (pagina > totalPaginas) setPagina(totalPaginas); }, [pagina, totalPaginas]);

  function abrirCancelacion(pedido) {
    setPedidoCancelacion(pedido);
    setMotivoCancelacion("");
    setErrorCancelacion("");
    setError("");
  }

  function cerrarCancelacion() {
    if (actualizando) return;
    setPedidoCancelacion(null);
    setMotivoCancelacion("");
    setErrorCancelacion("");
  }

  async function cambiarEstado(pedido, nuevoEstado, motivo = null) {
    const pagadoOnline = pedido.estado_pago === "Aprobado";
    if (nuevoEstado === "Cancelado" && !motivo?.trim()) return;
    setActualizando(pedido.id_pedido);
    setAviso("");
    setErrorCancelacion("");
    try {
      let errorCambio;
      let pagoReembolsado = false;
      if (nuevoEstado === "Cancelado" && pagadoOnline) {
        const { data, error } = await reembolsarPedidoOnline(pedido.id_pedido, motivo);
        errorCambio = error;
        pagoReembolsado = data?.status === "Cancelado";
        if (!error && !pagoReembolsado) {
          setAviso("Mercado Pago todavía está procesando el reembolso. El pedido sigue activo; actualizá la lista antes de volver a intentarlo.");
          setPedidoCancelacion(null);
          return;
        }
      } else {
        const result = await actualizarEstadoPedidoOnline(pedido.id_pedido, nuevoEstado, motivo);
        errorCambio = result.error;
      }
      if (errorCambio) {
        const mensaje = `No se pudo actualizar el pedido: ${errorCambio.message}`;
        if (nuevoEstado === "Cancelado") setErrorCancelacion(mensaje);
        else setError(mensaje);
      } else {
        setPedidos((actuales) => actuales.map((item) => item.id_pedido === pedido.id_pedido ? { ...item, estado: nuevoEstado, estado_pago: pagoReembolsado ? "Reembolsado" : item.estado_pago, motivo_cancelacion: motivo, fecha_actualizacion: new Date().toISOString() } : item));
        setAviso(`Pedido ${pedido.referencia} actualizado a ${nuevoEstado.toLocaleLowerCase("es")}.`);
        setError("");
        if (nuevoEstado === "Cancelado") setPedidoCancelacion(null);
      }
    } catch (errorOperacion) {
      const mensaje = `No se pudo actualizar el pedido: ${errorOperacion.message || "Ocurrió un error inesperado."}`;
      if (nuevoEstado === "Cancelado") setErrorCancelacion(mensaje);
      else setError(mensaje);
    } finally {
      setActualizando(null);
    }
  }

  return <section className="pedidos-online">
    <header className="po-encabezado">
      <div><span className="po-eyebrow">GESTIÓN DE SUCURSAL</span><h1>Pedidos online</h1><p>Prepará los pedidos de retiro y actualizá su estado para el cliente.</p></div>
      <button className="po-boton po-boton-secundario" type="button" onClick={cargar} disabled={cargando}><RefreshCw size={16} className={cargando ? "po-girando" : ""} />Actualizar</button>
    </header>

    <div className="po-resumen" aria-label="Resumen de pedidos">
      <div className="po-indicador"><span className="po-indicador-icono po-icono-todos"><ClipboardList size={19} /></span><span><small>Todos</small><strong>{conteos.todos}</strong></span></div>
      <div className="po-indicador"><span className="po-indicador-icono po-icono-pendientes"><PackageCheck size={19} /></span><span><small>Pendientes</small><strong>{conteos.pendientes}</strong></span></div>
      <div className="po-indicador"><span className="po-indicador-icono po-icono-entregados"><CircleCheck size={19} /></span><span><small>Entregados</small><strong>{conteos.entregados}</strong></span></div>
      <div className="po-indicador"><span className="po-indicador-icono po-icono-cancelados"><Ban size={19} /></span><span><small>Cancelados</small><strong>{conteos.cancelados}</strong></span></div>
    </div>

    {error && <div className="po-mensaje po-mensaje-error" role="alert"><AlertCircle size={18} />{error}</div>}
    {aviso && <div className="po-mensaje po-mensaje-ok" role="status">{aviso}</div>}

    <div className="po-panel-listado">
      <div className="po-listado-encabezado"><div><h2>Pedidos recibidos</h2><p>{pedidosVisibles.length} {pedidosVisibles.length === 1 ? "pedido" : "pedidos"}</p></div>
        <div className="po-filtros">
          <label className="po-busqueda"><Search size={17} /><input aria-label="Buscar pedidos" value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar cliente, correo o referencia" /></label>
          <select aria-label="Filtrar pedidos por estado" value={estadoFiltro} onChange={(event) => setEstadoFiltro(event.target.value)}>
            <option value="Todos">Todos</option><option value="Pendientes">Pendientes</option><option value="Entregados">Entregados</option><option value="Cancelados">Cancelados</option>
          </select>
        </div>
      </div>

      {cargando ? <p className="po-vacio" role="status">Cargando pedidos…</p> : pedidosVisibles.length === 0 ? <div className="po-vacio"><ClipboardList size={34} /><strong>No hay pedidos para mostrar</strong><span>Probá con otro filtro o término de búsqueda.</span></div> : (
        <div className="po-grid-pedidos">
          {pedidosPagina.map((pedidoPagina) => <article className="po-tarjeta" key={pedidoPagina.id_pedido}>
            <div className="po-tarjeta-cabecera">
              <div className="po-cliente"><strong>{pedidoPagina.nombre_cliente} {pedidoPagina.apellido_cliente}</strong><span>{pedidoPagina.contacto}</span><small><Store size={14} />{pedidoPagina.sucursal?.codigo} — {pedidoPagina.sucursal?.descripcion}</small></div>
              <div className="po-meta"><span className={`po-estado po-estado-${pedidoPagina.estado.toLowerCase()}`}>{pedidoPagina.estado}</span><time>{fecha(pedidoPagina.fecha_creacion)}</time><code>Ref. {pedidoPagina.referencia}</code></div>
            </div>
            <div className="po-items">{(pedidoPagina.items || []).map((item) => <div className="po-item" key={item.id_articulo}><span>{item.cantidad} × {item.nombre}</span><span>{moneda.format(Number(item.subtotal))}</span></div>)}</div>
            {pedidoPagina.estado === "Cancelado" && <p className="po-motivo">Motivo informado al cliente: {pedidoPagina.motivo_cancelacion}</p>}
            <footer className="po-pie-tarjeta">
              <div className="po-total"><strong>{moneda.format(Number(pedidoPagina.importe_estimado))}</strong><span><CreditCard size={14} />{pedidoPagina.estado_pago === "Aprobado" ? (pedidoPagina.medio_pago_online || "Pagado online") : "Pago pendiente de confirmación"}</span></div>
              <div className="po-acciones">
                {pedidoPagina.estado === "Pendiente" && <><button className="po-boton po-boton-peligro" type="button" disabled={actualizando === pedidoPagina.id_pedido} onClick={() => abrirCancelacion(pedidoPagina)}>{pedidoPagina.estado_pago === "Aprobado" ? "Reembolsar y cancelar" : "Cancelar"}</button><button className="po-boton po-boton-principal" type="button" disabled={actualizando === pedidoPagina.id_pedido} onClick={() => cambiarEstado(pedidoPagina, "Preparado")}>{actualizando === pedidoPagina.id_pedido ? "Guardando…" : "Marcar preparado"}</button></>}
                {pedidoPagina.estado === "Preparado" && <button className="po-boton po-boton-principal" type="button" disabled={actualizando === pedidoPagina.id_pedido} onClick={() => cambiarEstado(pedidoPagina, "Entregado")}>{actualizando === pedidoPagina.id_pedido ? "Guardando…" : "Confirmar retiro"}</button>}
              </div>
            </footer>
          </article>)}
          {totalPaginas > 1 && <nav className="po-paginacion" aria-label="Paginación de pedidos">
            <span>Pedidos {(pagina - 1) * pedidosPorPagina + 1}–{Math.min(pagina * pedidosPorPagina, pedidosVisibles.length)} de {pedidosVisibles.length}</span>
            <div>
              <button className="po-boton po-boton-secundario" type="button" onClick={() => setPagina((actual) => Math.max(1, actual - 1))} disabled={pagina === 1}><ChevronLeft size={16} />Anterior</button>
              <span className="po-pagina-actual">{pagina} / {totalPaginas}</span>
              <button className="po-boton po-boton-secundario" type="button" onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))} disabled={pagina === totalPaginas}>Siguiente<ChevronRight size={16} /></button>
            </div>
          </nav>}
        </div>
      )}
    </div>

    {pedidoCancelacion && <div className="po-modal-fondo" onMouseDown={(event) => { if (event.target === event.currentTarget) cerrarCancelacion(); }}>
      <section className="po-modal-cancelacion" role="dialog" aria-modal="true" aria-labelledby="po-modal-titulo">
        <header className="po-modal-cabecera">
          <span className="po-modal-icono"><RotateCcw size={21} /></span>
          <button className="po-modal-cerrar" type="button" aria-label="Cerrar" onClick={cerrarCancelacion} disabled={Boolean(actualizando)}><X size={19} /></button>
          <span className="po-eyebrow">PEDIDO {pedidoCancelacion.referencia}</span>
          <h2 id="po-modal-titulo">{pedidoCancelacion.estado_pago === "Aprobado" ? "Reembolsar y cancelar" : "Cancelar pedido"}</h2>
          <p>{pedidoCancelacion.nombre_cliente} {pedidoCancelacion.apellido_cliente} · {moneda.format(Number(pedidoCancelacion.importe_estimado))}</p>
        </header>
        <div className={`po-modal-aviso ${pedidoCancelacion.estado_pago === "Aprobado" ? "po-modal-aviso-reembolso" : ""}`}>
          <AlertCircle size={18} />
          <span>{pedidoCancelacion.estado_pago === "Aprobado" ? "Se solicitará el reembolso en Mercado Pago. El pedido se cancelará cuando se confirme." : "El motivo quedará registrado y se informará al cliente."}</span>
        </div>
        <label className="po-modal-label" htmlFor="po-motivo-cancelacion">Motivo <span>Obligatorio</span></label>
        <textarea id="po-motivo-cancelacion" className="po-modal-textarea" value={motivoCancelacion} onChange={(event) => setMotivoCancelacion(event.target.value)} maxLength={500} rows={4} placeholder="Contá brevemente por qué se cancela este pedido…" autoFocus />
        <div className="po-modal-contador">{motivoCancelacion.length}/500</div>
        {errorCancelacion && <div className="po-mensaje po-mensaje-error po-modal-error" role="alert"><AlertCircle size={18} />{errorCancelacion}</div>}
        <footer className="po-modal-acciones">
          <button className="po-boton po-boton-secundario" type="button" onClick={cerrarCancelacion} disabled={Boolean(actualizando)}>Volver</button>
          <button className="po-boton po-boton-confirmar-cancelacion" type="button" disabled={!motivoCancelacion.trim() || Boolean(actualizando)} onClick={() => cambiarEstado(pedidoCancelacion, "Cancelado", motivoCancelacion.trim())}>{actualizando ? "Procesando…" : pedidoCancelacion.estado_pago === "Aprobado" ? "Solicitar reembolso" : "Confirmar cancelación"}</button>
        </footer>
      </section>
    </div>}
  </section>;
}
