import { useState, useEffect, useMemo } from 'react';
import { 
  getSucursalesYDepositos, 
  getMediosPagoActivos,
  buscarClientes, 
  crearCliente, 
  getProductosConStock, 
  confirmarVenta, 
  getHistorialVentas,
  getBorradoresVenta,
  guardarVentaBorrador,
  cancelarVentaBorrador,
  downloadComprobanteVentaPdf 
} from '../services/ventas';
import { showAlert } from '../lib/alerts.js';
import { User, Trash2, CheckCircle2, Download, ArrowLeft, Search, DollarSign, FileText, Eye, X, PlayCircle, PauseCircle } from 'lucide-react';
import '../App.css';

export default function RegistrarVenta() {
  const [cargando, setCargando] = useState(false);
  const [paso, setPaso] = useState(1); // 1: Panel Principal / Historial, 2: Selector de Depósito, 3: POS / Carrito, 4: Éxito

  // Contexto
  const [sucursales, setSucursales] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [borradores, setBorradores] = useState([]);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState('');
  const [depositoSeleccionado, setDepositoSeleccionado] = useState('');
  const [idBorrador, setIdBorrador] = useState(null);

  // Historial y Métricas
  const [historialVentas, setHistorialVentas] = useState([]);
  const [filtroTipoFactura, setFiltroTipoFactura] = useState('TODAS');
  const [filtroNumero, setFiltroNumero] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroSucursal, setFiltroSucursal] = useState('TODAS');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [ventaDetalle, setVentaDetalle] = useState(null);

  // Cliente (HU37)
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [listaClientes, setListaClientes] = useState([]);
  const [clienteElegido, setClienteElegido] = useState(null);
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
  const [tempCliente, setTempCliente] = useState({
    nombre: '',
    identificacion: '',
    telefono: '',
    condicion: 'Consumidor Final',
    aplica_percepcion_iva: false,
    aplica_percepcion_iibb: false
  });

  // Productos y Carrito
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [filtroProducto, setFiltroProducto] = useState('');
  const [carrito, setCarrito] = useState([]);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // Pago
  const [mediosPago, setMediosPago] = useState([]);
  const [idMedioPago, setIdMedioPago] = useState('');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [referenciaPago, setReferenciaPago] = useState('');

  // Venta confirmada para PDF
  const [ventaConfirmada, setVentaConfirmada] = useState(null);

  useEffect(() => {
    async function init() {
      setCargando(true);
      const res = await getSucursalesYDepositos();
      if (!res.error) {
        setSucursales(res.sucursales || []);
        setDepositos(res.depositos || []);
      }
      const hist = await getHistorialVentas();
      setHistorialVentas(hist.data || []);
      const borr = await getBorradoresVenta();
      setBorradores(borr.data || []);
      const medios = await getMediosPagoActivos();
      setMediosPago(medios.data || []);
      const efectivo = (medios.data || []).find((medio) => medio.codigo === 'EFECTIVO');
      setIdMedioPago(String(efectivo?.id_medio_pago || medios.data?.[0]?.id_medio_pago || ''));
      setCargando(false);
    }
    init();
  }, []);

  const depositosFiltrados = useMemo(() => {
    if (!sucursalSeleccionada) return [];
    return depositos.filter(d => String(d.id_sucursal) === String(sucursalSeleccionada));
  }, [depositos, sucursalSeleccionada]);

  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      const { data } = await buscarClientes(busquedaCliente);
      setListaClientes(data || []);
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [busquedaCliente]);

  const handleIniciarVenta = async () => {
    if (!sucursalSeleccionada || !depositoSeleccionado) {
      return showAlert.errorSave('Debe seleccionar la sucursal y el depósito de salida.');
    }
    setCargando(true);
    const { data, error } = await getProductosConStock(depositoSeleccionado);
    if (error) {
      setCargando(false);
      return showAlert.errorSave(error.message || 'No se pudieron cargar los productos disponibles.');
    }
    const nuevaClave = crypto.randomUUID();
    const { data: borrador, error: errorBorrador } = await guardarVentaBorrador({
      id_sucursal: sucursalSeleccionada,
      id_deposito: depositoSeleccionado,
      id_lista: data?.[0]?.id_lista || null,
      items: [],
      idempotency_key: nuevaClave
    });
    if (errorBorrador) {
      setCargando(false);
      return showAlert.errorSave('No se pudo iniciar el borrador: ' + errorBorrador.message);
    }
    setProductosDisponibles(data || []);
    setIdBorrador(borrador.id_borrador);
    setIdempotencyKey(borrador.idempotency_key || nuevaClave);
    setCargando(false);
    setPaso(3);
  };

  const limpiarVentaActual = () => {
    setIdBorrador(null);
    setCarrito([]);
    setClienteElegido(null);
    setBusquedaCliente('');
    setMontoRecibido('');
    setReferenciaPago('');
    setFiltroProducto('');
    setIdempotencyKey(crypto.randomUUID());
  };

  const recargarBorradores = async () => {
    const { data } = await getBorradoresVenta();
    setBorradores(data || []);
  };

  const payloadBorradorActual = () => ({
    id_borrador: idBorrador,
    id_sucursal: sucursalSeleccionada,
    id_deposito: depositoSeleccionado,
    id_cliente: clienteElegido?.id_cliente || null,
    id_lista: carrito[0]?.id_lista || productosDisponibles[0]?.id_lista || null,
    items: carrito,
    id_medio_pago: idMedioPago || null,
    importe_pagado: montoRecibido,
    referencia_pago: referenciaPago,
    percepcion_iva: resumenImpuestos.percepcion_iva,
    percepcion_iibb: resumenImpuestos.percepcion_iibb,
    idempotency_key: idempotencyKey
  });

  const handleSuspenderVenta = async () => {
    setCargando(true);
    const { error } = await guardarVentaBorrador(payloadBorradorActual());
    if (error) {
      setCargando(false);
      return showAlert.errorSave('No se pudo guardar el borrador: ' + error.message);
    }
    await recargarBorradores();
    limpiarVentaActual();
    setCargando(false);
    setPaso(1);
    showAlert.successSave('Venta suspendida y guardada como borrador.');
  };

  const handleRetomarBorrador = async (borrador) => {
    setCargando(true);
    const { data: productos, error } = await getProductosConStock(borrador.id_deposito);
    if (error) {
      setCargando(false);
      return showAlert.errorSave(error.message || 'No se pudo recuperar el catálogo del borrador.');
    }

    const detalles = borrador.detalle_venta_borrador || [];
    const carritoRecuperado = detalles.map((detalle) => {
      const producto = (productos || []).find((p) =>
        Number(p.id_articulo_deposito) === Number(detalle.id_articulo_deposito)
      );
      if (!producto) return null;
      const cantidad = Math.min(Number(detalle.cantidad), Number(producto.stock_actual));
      if (cantidad <= 0) return null;
      return { ...producto, cantidad, subtotal: cantidad * Number(producto.precio_venta) };
    }).filter(Boolean);

    setIdBorrador(borrador.id_borrador);
    setSucursalSeleccionada(String(borrador.id_sucursal));
    setDepositoSeleccionado(String(borrador.id_deposito));
    setClienteElegido(borrador.cliente || null);
    setProductosDisponibles(productos || []);
    setCarrito(carritoRecuperado);
    setIdMedioPago(borrador.id_medio_pago ? String(borrador.id_medio_pago) : idMedioPago);
    setMontoRecibido(borrador.importe_pagado == null ? '' : String(borrador.importe_pagado));
    setReferenciaPago(borrador.referencia_pago || '');
    setIdempotencyKey(borrador.idempotency_key);
    setCargando(false);
    setPaso(3);

    if (carritoRecuperado.length !== detalles.length) {
      showAlert.errorSave('Algunos productos ya no tienen stock o no pertenecen a la lista vigente y no se recuperaron.');
    }
  };

  const handleCancelarBorrador = async (borradorId, cancelarActual = false) => {
    setCargando(true);
    const { error } = await cancelarVentaBorrador(borradorId);
    if (error) {
      setCargando(false);
      return showAlert.errorSave('No se pudo cancelar el borrador: ' + error.message);
    }
    await recargarBorradores();
    if (cancelarActual) {
      limpiarVentaActual();
      setPaso(1);
    }
    setCargando(false);
    showAlert.successSave('Borrador cancelado sin afectar el stock.');
  };

  const handleGuardarCliente = async (e) => {
    e.preventDefault();
    const nombreTrim = tempCliente.nombre.trim();
    
    if (!nombreTrim) return showAlert.errorSave('El nombre o razón social es obligatorio.');
    if (/\d/.test(nombreTrim)) {
      return showAlert.errorSave('El nombre o razón social no puede contener números.');
    }

    const idVal = tempCliente.identificacion?.trim() || '';
    let dniFinal = null;
    let cuitFinal = null;

    if (idVal) {
      if (idVal.length === 7 || idVal.length === 8) {
        dniFinal = idVal;
      } else if (idVal.length === 11) {
        cuitFinal = idVal;
      } else {
        return showAlert.errorSave('La identificación ingresada debe ser un DNI válido (7 u 8 dígitos) o un CUIT válido (11 dígitos).');
      }
    }

    setCargando(true);
    const { data, error } = await crearCliente({
      nombre: nombreTrim,
      dni: dniFinal,
      cuit: cuitFinal,
      telefono: tempCliente.telefono.trim() || null,
      condicion_fiscal: tempCliente.condicion,
      aplica_percepcion_iva: tempCliente.condicion === 'Responsable Inscripto' && tempCliente.aplica_percepcion_iva,
      aplica_percepcion_iibb: tempCliente.condicion === 'Responsable Inscripto' && tempCliente.aplica_percepcion_iibb
    });

    if (error) {
      showAlert.errorSave('Error al registrar cliente: ' + (error.message || error.mensaje || error));
    } else {
      showAlert.successSave('Cliente registrado y seleccionado correctamente.');
      setClienteElegido(data);
      setMostrarModalCliente(false);
      setTempCliente({
        nombre: '',
        identificacion: '',
        telefono: '',
        condicion: 'Consumidor Final',
        aplica_percepcion_iva: false,
        aplica_percepcion_iibb: false
      });
    }
    setCargando(false);
  };

  const tipoComprobanteActual = useMemo(() => {
    const cond = clienteElegido?.condicion_fiscal || 'Consumidor Final';
    if (cond === 'Responsable Inscripto' || cond === 'Monotributista') {
      return 'A';
    }
    return 'B';
  }, [clienteElegido]);

  const medioPagoSeleccionado = useMemo(
    () => mediosPago.find((medio) => String(medio.id_medio_pago) === String(idMedioPago)) || null,
    [mediosPago, idMedioPago]
  );

  const esEfectivo = medioPagoSeleccionado?.codigo === 'EFECTIVO';
  const condicionFiscalCliente = clienteElegido?.condicion_fiscal || 'Consumidor Final';
  const clienteAplicaPercepcionIva = Boolean(clienteElegido?.aplica_percepcion_iva);
  const clienteAplicaPercepcionIibb = Boolean(clienteElegido?.aplica_percepcion_iibb);

  const resumenImpuestos = (() => {
    let neto_21 = 0;
    let iva_21 = 0;
    let neto_105 = 0;
    let iva_105 = 0;
    let exento = 0;
    let total = 0;

    carrito.forEach(item => {
      const sub = Number(item.subtotal);
      total += sub;
      const alicuota = Number(item.iva_porcentaje ?? 21);

      if (tipoComprobanteActual === 'A') {
        if (item.es_exento) {
          exento += sub;
        } else if (alicuota === 10.5) {
          const neto = Number((sub / 1.105).toFixed(2));
          neto_105 += neto;
          iva_105 += sub - neto;
        } else {
          const neto = Number((sub / 1.21).toFixed(2));
          neto_21 += neto;
          iva_21 += sub - neto;
        }
      } else {
        if (item.es_exento) {
          exento += sub;
        } else {
          const neto = Number((sub / (alicuota === 10.5 ? 1.105 : 1.21)).toFixed(2));
          if (alicuota === 10.5) {
            neto_105 += neto;
            iva_105 += sub - neto;
          } else {
            neto_21 += neto;
            iva_21 += sub - neto;
          }
        }
      }
    });

    const basePercepciones = neto_21 + neto_105;
    const esResponsableInscripto = condicionFiscalCliente === 'Responsable Inscripto';
    const percepcion_iva = esResponsableInscripto && clienteAplicaPercepcionIva
      ? basePercepciones * 0.01
      : 0;
    const percepcion_iibb = esResponsableInscripto && clienteAplicaPercepcionIibb
      ? basePercepciones * 0.036
      : 0;
    const percepcionIvaRedondeada = Number(percepcion_iva.toFixed(2));
    const percepcionIibbRedondeada = Number(percepcion_iibb.toFixed(2));

    return {
      neto_21: Number(neto_21.toFixed(2)),
      iva_21: Number(iva_21.toFixed(2)),
      neto_105: Number(neto_105.toFixed(2)),
      iva_105: Number(iva_105.toFixed(2)),
      exento: Number(exento.toFixed(2)),
      subtotal_productos: Number(total.toFixed(2)),
      percepcion_iva: percepcionIvaRedondeada,
      percepcion_iibb: percepcionIibbRedondeada,
      total: Number((total + percepcionIvaRedondeada + percepcionIibbRedondeada).toFixed(2))
    };
  })();

  const agregarAlCarrito = (prod) => {
    if (prod.stock_actual <= 0) {
      return showAlert.errorSave('El producto seleccionado no cuenta con stock disponible en este depósito.');
    }

    const existe = carrito.find(i => i.id_articulo === prod.id_articulo);
    if (existe) {
      if (existe.cantidad + 1 > prod.stock_actual) {
        return showAlert.errorSave(`Stock insuficiente. Stock máximo: ${prod.stock_actual}`);
      }
      setCarrito(carrito.map(i => i.id_articulo === prod.id_articulo ? {
        ...i,
        cantidad: i.cantidad + 1,
        subtotal: (i.cantidad + 1) * i.precio_venta
      } : i));
    } else {
      setCarrito([...carrito, {
        ...prod,
        cantidad: 1,
        subtotal: Number(prod.precio_venta)
      }]);
    }
  };

  const cambiarCantidad = (id_articulo, nuevaCant) => {
    const cant = parseInt(nuevaCant, 10);
    const prod = productosDisponibles.find(p => p.id_articulo === id_articulo);

    if (isNaN(cant) || cant <= 0) {
      return setCarrito(carrito.filter(i => i.id_articulo !== id_articulo));
    }

    if (cant > prod.stock_actual) {
      return showAlert.errorSave(`No hay suficiente stock. Disponible: ${prod.stock_actual}`);
    }

    setCarrito(carrito.map(i => i.id_articulo === id_articulo ? {
      ...i,
      cantidad: cant,
      subtotal: cant * i.precio_venta
    } : i));
  };

  const quitarDelCarrito = (id_articulo) => {
    setCarrito(carrito.filter(i => i.id_articulo !== id_articulo));
  };

  const handleConfirmarVentaFinal = async () => {
    if (cargando) return; // Previene doble clic concurrente
    if (carrito.length === 0) return showAlert.errorSave('El carrito está vacío.');
    const totalVenta = resumenImpuestos.total;
    if (!medioPagoSeleccionado) {
      return showAlert.errorSave('Debe seleccionar un medio de pago activo.');
    }
    const importePagado = Number(montoRecibido);
    if (!montoRecibido || !Number.isFinite(importePagado) || importePagado < totalVenta) {
      return showAlert.errorSave(`El importe ingresado ($${importePagado || 0}) no cubre el total de la venta ($${totalVenta}).`);
    }
    if (!esEfectivo && !referenciaPago.trim()) {
      return showAlert.errorSave('El número de referencia u operación es obligatorio.');
    }

    setCargando(true);
    const payload = {
      id_borrador: idBorrador,
      id_sucursal: sucursalSeleccionada,
      id_deposito: depositoSeleccionado,
      id_cliente: clienteElegido ? clienteElegido.id_cliente : null,
      tipo_comprobante: tipoComprobanteActual,
      items: carrito,
      id_medio_pago: idMedioPago,
      medio_pago: medioPagoSeleccionado.nombre,
      importe_pagado: importePagado,
      referencia_pago: referenciaPago,
      idempotency_key: idempotencyKey,
      ...resumenImpuestos,
      id_lista: carrito[0]?.id_lista || null
    };

    const { data, error } = await confirmarVenta(payload);
    if (error) {
      showAlert.errorSave('Error al confirmar venta: ' + (error.message || error));
      setCargando(false);
    } else {
      showAlert.successSave('¡Venta confirmada y stock actualizado con éxito!');
      setVentaConfirmada(data);
      setIdBorrador(null);
      await recargarBorradores();
      const hist = await getHistorialVentas();
      setHistorialVentas(hist.data || []);
      setCargando(false);
      setPaso(4);
    }
  };

  const ventasFiltradas = useMemo(() => {
    return historialVentas.filter(v => {
      const matchTipo = filtroTipoFactura === 'TODAS' || v.tipo_comprobante === filtroTipoFactura;
      const matchNumero = !filtroNumero || String(v.numero_comprobante).includes(filtroNumero.trim());
      const matchCliente = !filtroCliente ||
        (v.cliente?.nombre || 'Consumidor Final').toLowerCase().includes(filtroCliente.trim().toLowerCase());
      const matchSucursal = filtroSucursal === 'TODAS' || String(v.id_sucursal) === filtroSucursal;
      const fechaVenta = new Date(v.fecha);
      const matchDesde = !filtroFechaDesde || fechaVenta >= new Date(`${filtroFechaDesde}T00:00:00`);
      const matchHasta = !filtroFechaHasta || fechaVenta <= new Date(`${filtroFechaHasta}T23:59:59.999`);
      return matchTipo && matchNumero && matchCliente && matchSucursal && matchDesde && matchHasta;
    });
  }, [historialVentas, filtroTipoFactura, filtroNumero, filtroCliente, filtroSucursal, filtroFechaDesde, filtroFechaHasta]);

  const estadisticasSemanales = useMemo(() => {
    const ahora = new Date();
    const hace7Dias = new Date();
    hace7Dias.setDate(ahora.getDate() - 7);

    const ventasSemana = historialVentas.filter(v => new Date(v.fecha) >= hace7Dias);
    const totalMonto = ventasSemana.reduce((acc, v) => acc + Number(v.importe_total || 0), 0);
    
    return {
      cantidad: ventasSemana.length,
      montoTotal: totalMonto
    };
  }, [historialVentas]);

  const inputStyle = {
    width: "100%",
    padding: "0.625rem 0.75rem",
    borderRadius: "0.375rem",
    border: "1px solid #d1d5db",
    boxSizing: "border-box",
    fontSize: "0.875rem",
    outline: "none",
    backgroundColor: "#fff",
  };

  return (
    <div style={{ padding: '1.5rem', width: '100%', boxSizing: 'border-box' }}>
      
      {/* PASO 1: Panel Principal / Historial */}
      {paso === 1 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>
                Punto de Venta — Facturación Presencial
              </h1>
              <p style={{ color: '#6b7280', margin: '0.2rem 0 0', fontSize: '0.875rem' }}>
                Historial de operaciones, control de stock en tiempo real y emisión de comprobantes fiscales
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPaso(2)}
              style={{ backgroundColor: '#65482b', color: '#fff', border: 0, padding: '0.625rem 1rem', borderRadius: '0.375rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}
            >
              + Nuevo Registro de Venta
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: '#fff', padding: '1rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#eff6ff', color: '#2563eb', borderRadius: '0.5rem' }}>
                <FileText size={20} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Ventas Semana (7 días)</p>
                <h3 style={{ margin: '0.1rem 0 0', fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>{estadisticasSemanales.cantidad} operaciones</h3>
              </div>
            </div>

            <div style={{ backgroundColor: '#fff', padding: '1rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: '0.5rem' }}>
                <DollarSign size={20} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Facturación Semanal</p>
                <h3 style={{ margin: '0.1rem 0 0', fontSize: '1.25rem', fontWeight: '700', color: '#166534' }}>${estadisticasSemanales.montoTotal.toFixed(2)}</h3>
              </div>
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', borderRadius: '0.5rem', border: '1px solid #e5e7eb', marginBottom: '1.5rem', overflow: 'hidden' }}>
            <div style={{ padding: '0.85rem 1rem', backgroundColor: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <b style={{ color: '#92400e' }}>Ventas suspendidas</b>
                <span style={{ marginLeft: '0.5rem', color: '#a16207', fontSize: '0.8rem' }}>{borradores.length} borrador(es)</span>
              </div>
            </div>
            {borradores.length === 0 ? (
              <p style={{ margin: 0, padding: '1rem', color: '#6b7280', fontSize: '0.85rem' }}>No hay ventas pendientes para retomar.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead style={{ backgroundColor: '#f9fafb' }}>
                    <tr><th style={{ padding: '0.65rem', textAlign: 'left' }}>Actualización</th><th style={{ textAlign: 'left' }}>Sucursal</th><th style={{ textAlign: 'center' }}>Ítems</th><th style={{ textAlign: 'right', paddingRight: '0.65rem' }}>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {borradores.map((borrador) => (
                      <tr key={borrador.id_borrador} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.65rem' }}>{new Date(borrador.fecha_actualizacion).toLocaleString()}</td>
                        <td>{sucursales.find((s) => String(s.id_sucursal) === String(borrador.id_sucursal))?.descripcion || 'Sin identificar'}</td>
                        <td style={{ textAlign: 'center' }}>{borrador.detalle_venta_borrador?.length || 0}</td>
                        <td style={{ textAlign: 'right', padding: '0.5rem 0.65rem' }}>
                          <button type="button" onClick={() => handleRetomarBorrador(borrador)} disabled={cargando} style={{ border: 0, backgroundColor: '#166534', color: '#fff', borderRadius: '0.3rem', padding: '0.35rem 0.55rem', cursor: 'pointer', marginRight: '0.4rem', fontWeight: 600 }}><PlayCircle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Retomar</button>
                          <button type="button" onClick={() => handleCancelarBorrador(borrador.id_borrador)} disabled={cargando} style={{ border: '1px solid #fecaca', backgroundColor: '#fff', color: '#b91c1c', borderRadius: '0.3rem', padding: '0.35rem 0.55rem', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))', marginBottom: '1rem', gap: '0.75rem', alignItems: 'end' }}>
            <label style={{ fontSize: '0.75rem', color: '#4b5563' }}>Número
              <div style={{ position: 'relative', marginTop: '0.3rem' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#9ca3af' }} />
                <input type="text" placeholder="N° comprobante" value={filtroNumero} onChange={(e) => setFiltroNumero(e.target.value.replace(/\D/g, ''))} style={{ ...inputStyle, paddingLeft: '2.5rem' }} />
              </div>
            </label>
            <label style={{ fontSize: '0.75rem', color: '#4b5563' }}>Cliente
              <input type="text" placeholder="Nombre o apellido" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} style={{ ...inputStyle, marginTop: '0.3rem' }} />
            </label>
            <label style={{ fontSize: '0.75rem', color: '#4b5563' }}>Sucursal
              <select value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)} style={{ ...inputStyle, marginTop: '0.3rem' }}>
                <option value="TODAS">Todas</option>
                {sucursales.map((sucursal) => <option key={sucursal.id_sucursal} value={sucursal.id_sucursal}>{sucursal.descripcion || sucursal.nombre || sucursal.codigo}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.75rem', color: '#4b5563' }}>Desde
              <input type="date" value={filtroFechaDesde} onChange={(e) => setFiltroFechaDesde(e.target.value)} style={{ ...inputStyle, marginTop: '0.3rem' }} />
            </label>
            <label style={{ fontSize: '0.75rem', color: '#4b5563' }}>Hasta
              <input type="date" value={filtroFechaHasta} min={filtroFechaDesde || undefined} onChange={(e) => setFiltroFechaHasta(e.target.value)} style={{ ...inputStyle, marginTop: '0.3rem' }} />
            </label>
            <label style={{ fontSize: '0.75rem', color: '#4b5563' }}>Tipo
              <select value={filtroTipoFactura} onChange={(e) => setFiltroTipoFactura(e.target.value)} style={{ ...inputStyle, marginTop: '0.3rem' }}>
                <option value="TODAS">Todos</option>
                <option value="A">Factura A</option>
                <option value="B">Factura B</option>
              </select>
            </label>
            <button type="button" onClick={() => { setFiltroNumero(''); setFiltroCliente(''); setFiltroSucursal('TODAS'); setFiltroFechaDesde(''); setFiltroFechaHasta(''); setFiltroTipoFactura('TODAS'); }} style={{ ...inputStyle, cursor: 'pointer', color: '#374151', fontWeight: 600 }}>
              Limpiar filtros
            </button>
          </div>

          <div style={{ backgroundColor: '#fff', borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>Comprobante</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>Fecha y Hora</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>Cliente / Receptor</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>Sucursal</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>Medio Pago</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>Total</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: '#6b7280' }}>No se encontraron registros de ventas.</td>
                    </tr>
                  ) : (
                    ventasFiltradas.map(v => (
                      <tr key={v.id_venta} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '600', color: '#111827' }}>
                          Factura {v.tipo_comprobante} {String(v.punto_venta).padStart(4, '0')}-{String(v.numero_comprobante).padStart(8, '0')}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#4b5563' }}>
                          {new Date(v.fecha).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#374151' }}>
                          {v.cliente ? v.cliente.nombre : 'Consumidor Final'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#4b5563' }}>
                          {sucursales.find((s) => String(s.id_sucursal) === String(v.id_sucursal))?.descripcion || 'Sin identificar'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#4b5563' }}>
                          {v.pago_venta?.[0]?.medio_pago?.nombre || v.medio_pago}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '600', color: '#166534' }}>
                          ${Number(v.importe_total).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setVentaDetalle(v)}
                            style={{ backgroundColor: '#fff', border: '1px solid #d1d5db', padding: '0.3rem 0.6rem', borderRadius: '0.3rem', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#374151', marginRight: '0.35rem' }}
                            title="Ver detalle"
                          >
                            <Eye size={13} /> Detalle
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadComprobanteVentaPdf(v, v.detalle_venta || [], v.cliente, sucursales.find(s => String(s.id_sucursal) === String(v.id_sucursal)))}
                            style={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', padding: '0.3rem 0.6rem', borderRadius: '0.3rem', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#374151' }}
                            title="Descargar Comprobante PDF"
                          >
                            <Download size={13} /> PDF
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PASO 2: Selección de Sucursal y Depósito */}
      {paso === 2 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>
              Nuevo Registro de Venta
            </h1>
            <button
              type="button"
              onClick={() => setPaso(1)}
              style={{ backgroundColor: '#ffffff', color: '#374151', border: '1px solid #d1d5db', padding: '0.625rem 1rem', borderRadius: '0.375rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}
            >
              <ArrowLeft size={16} /> Volver atrás
            </button>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '2rem', width: '100%', maxWidth: '500px', margin: '2rem auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.4rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#4b5563' }}>Sucursal *</label>
              <select
                value={sucursalSeleccionada}
                onChange={(e) => {
                  setSucursalSeleccionada(e.target.value);
                  setDepositoSeleccionado('');
                }}
                style={inputStyle}
              >
                <option value="">-- Seleccione Sucursal --</option>
                {sucursales.map(s => (
                  <option key={s.id_sucursal} value={s.id_sucursal}>{s.codigo} - {s.descripcion} (PV {String(s.punto_venta || s.id_sucursal).padStart(4, '0')})</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1.75rem' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.4rem', fontSize: '0.8rem', textTransform: 'uppercase', color: '#4b5563' }}>Depósito de Salida de Mercadería *</label>
              <select
                value={depositoSeleccionado}
                onChange={(e) => setDepositoSeleccionado(e.target.value)}
                style={inputStyle}
                disabled={!sucursalSeleccionada}
              >
                <option value="">-- Seleccione Depósito --</option>
                {depositosFiltrados.map(d => (
                  <option key={d.id_deposito} value={d.id_deposito}>{d.codigo} - {d.descripcion}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleIniciarVenta}
              disabled={!sucursalSeleccionada || !depositoSeleccionado || cargando}
              style={{ backgroundColor: '#65482b', color: '#fff', border: 0, padding: '0.625rem 1.25rem', borderRadius: '0.375rem', fontWeight: '700', cursor: (!sucursalSeleccionada || !depositoSeleccionado || cargando) ? 'not-allowed' : 'pointer', width: '100%' }}
            >
              {cargando ? 'Cargando stock...' : 'Continuar con la Venta'}
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: Carrito y Catálogo (POS) */}
      {paso === 3 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>
                Terminal de Facturación {clienteElegido ? `(Factura ${tipoComprobanteActual})` : '(Factura B)'}
              </h1>
              <p style={{ color: '#6b7280', margin: '0.2rem 0 0', fontSize: '0.875rem' }}>
                Condición fiscal del receptor: <b>{clienteElegido ? clienteElegido.condicion_fiscal : 'Consumidor Final'}</b>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" onClick={handleSuspenderVenta} disabled={cargando} style={{ backgroundColor: '#d97706', color: '#fff', border: 0, padding: '0.625rem 0.8rem', borderRadius: '0.375rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}><PauseCircle size={16} /> Suspender</button>
              <button type="button" onClick={() => handleCancelarBorrador(idBorrador, true)} disabled={cargando || !idBorrador} style={{ backgroundColor: '#fff', color: '#b91c1c', border: '1px solid #fecaca', padding: '0.625rem 0.8rem', borderRadius: '0.375rem', fontWeight: '600', cursor: 'pointer' }}>Cancelar venta</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem' }}>
            <div>
              {/* Sección Cliente (HU37) */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '1.25rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#374151' }}>
                    <User size={16} /> Cliente: {clienteElegido ? `${clienteElegido.nombre} (${clienteElegido.condicion_fiscal})` : 'Consumidor Final'}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {clienteElegido && (
                      <button
                        type="button"
                        onClick={() => setClienteElegido(null)}
                        style={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db', padding: '0.35rem 0.6rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', color: '#374151' }}
                      >
                        Quitar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMostrarModalCliente(true)}
                      style={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db', padding: '0.35rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', color: '#374151' }}
                    >
                      Registrar Nuevo Cliente
                    </button>
                  </div>
                </div>

                {!clienteElegido && (
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Buscar por DNI, CUIT, nombre, apellido o teléfono..."
                      value={busquedaCliente}
                      onChange={(e) => setBusquedaCliente(e.target.value)}
                      style={inputStyle}
                    />
                    {listaClientes.length > 0 && busquedaCliente && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid #d1d5db', borderRadius: '0.375rem', zIndex: 10, maxHeight: '150px', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        {listaClientes.map(c => (
                          <div
                            key={c.id_cliente}
                            onClick={() => {
                              setClienteElegido(c);
                              setBusquedaCliente('');
                            }}
                            style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.85rem' }}
                          >
                            <b>{c.nombre}</b> — CUIT/DNI: {c.cuit || c.dni || 'Sin ID'}{c.telefono ? ` — Tel: ${c.telefono}` : ''} ({c.condicion_fiscal})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Catálogo de Productos */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '0.75rem', color: '#374151' }}>Catálogo de Productos Disponibles</h3>
                <input
                  type="text"
                  placeholder="Buscar por nombre, código o código de barras..."
                  value={filtroProducto}
                  onChange={(e) => setFiltroProducto(e.target.value)}
                  style={{ ...inputStyle, marginBottom: '1rem' }}
                />

                <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '0.375rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0, borderBottom: '1px solid #e5e7eb' }}>
                      <tr>
                        <th style={{ padding: '0.625rem 0.75rem', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Artículo</th>
                        <th style={{ padding: '0.625rem 0.75rem', textAlign: 'center', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Stock</th>
                        <th style={{ padding: '0.625rem 0.75rem', textAlign: 'right', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Precio</th>
                        <th style={{ padding: '0.625rem 0.75rem', textAlign: 'center', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productosDisponibles
                        .filter(p => p.descripcion.toLowerCase().includes(filtroProducto.toLowerCase()) || p.codigo.toLowerCase().includes(filtroProducto.toLowerCase()))
                        .map(p => (
                          <tr key={p.id_articulo} style={{ borderBottom: '1px solid #e5e7eb' }}>
                            <td style={{ padding: '0.625rem 0.75rem' }}>
                              <b style={{ color: '#111827' }}>{p.descripcion}</b> <br />
                              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Cód: {p.codigo}</span>
                            </td>
                            <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center', fontWeight: '700', color: p.stock_actual > 0 ? '#166534' : '#dc2626' }}>
                              {p.stock_actual}
                            </td>
                            <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right', fontWeight: '600' }}>
                              ${Number(p.precio_venta).toFixed(2)}
                            </td>
                            <td style={{ padding: '0.625rem 0.75rem', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => agregarAlCarrito(p)}
                                disabled={p.stock_actual <= 0}
                                style={{ backgroundColor: p.stock_actual > 0 ? '#65482b' : '#9ca3af', color: '#fff', border: 0, padding: '0.3rem 0.6rem', borderRadius: '0.3rem', cursor: p.stock_actual > 0 ? 'pointer' : 'not-allowed', fontSize: '0.75rem', fontWeight: '600' }}
                              >
                                Agregar
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Carrito */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', height: 'fit-content' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', color: '#111827' }}>
                Carrito de Venta {clienteElegido ? `(Factura ${tipoComprobanteActual})` : '(Factura B)'}
              </h3>

              {carrito.length === 0 ? (
                <p style={{ color: '#6b7280', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>El carrito está vacío</p>
              ) : (
                <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '1rem' }}>
                  {carrito.map(item => (
                    <div key={item.id_articulo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.5rem', fontSize: '0.85rem' }}>
                      <div style={{ flex: 1 }}>
                        <b style={{ color: '#111827' }}>{item.descripcion}</b>
                        <div style={{ color: '#6b7280', fontSize: '0.75rem' }}>
                          ${Number(item.precio_venta).toFixed(2)} x 
                          <input
                            type="number"
                            min="1"
                            value={item.cantidad}
                            onChange={(e) => cambiarCantidad(item.id_articulo, e.target.value)}
                            style={{ width: '45px', marginLeft: '0.4rem', marginRight: '0.4rem', textAlign: 'center', padding: '0.1rem', borderRadius: '0.25rem', border: '1px solid #d1d5db' }}
                          />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <b style={{ color: '#111827' }}>${Number(item.subtotal).toFixed(2)}</b>
                        <button
                          type="button"
                          onClick={() => quitarDelCarrito(item.id_articulo)}
                          style={{ background: 'none', border: 0, color: '#dc2626', cursor: 'pointer', display: 'block', marginLeft: 'auto', marginTop: '0.2rem' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ backgroundColor: '#f9fafb', padding: '0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem', marginBottom: '1rem', border: '1px solid #e5e7eb' }}>
                {tipoComprobanteActual === 'A' ? (
                  <>
                    {resumenImpuestos.neto_21 > 0 && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', color: '#4b5563' }}>
                          <span>Neto Gravado 21%:</span>
                          <b>${resumenImpuestos.neto_21.toFixed(2)}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', color: '#4b5563' }}>
                          <span>IVA 21%:</span>
                          <b>${resumenImpuestos.iva_21.toFixed(2)}</b>
                        </div>
                      </>
                    )}
                    {resumenImpuestos.neto_105 > 0 && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', color: '#4b5563' }}>
                          <span>Neto Gravado 10.5%:</span>
                          <b>${resumenImpuestos.neto_105.toFixed(2)}</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', color: '#4b5563' }}>
                          <span>IVA 10.5%:</span>
                          <b>${resumenImpuestos.iva_105.toFixed(2)}</b>
                        </div>
                      </>
                    )}
                    {resumenImpuestos.percepcion_iva > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', color: '#4b5563' }}>
                        <span>Percepción IVA:</span>
                        <b>${resumenImpuestos.percepcion_iva.toFixed(2)}</b>
                      </div>
                    )}
                    {resumenImpuestos.percepcion_iibb > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', color: '#4b5563' }}>
                        <span>Percepción IIBB:</span>
                        <b>${resumenImpuestos.percepcion_iibb.toFixed(2)}</b>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', color: '#4b5563' }}>
                          <span>Subtotal Operación:</span>
                          <b>${resumenImpuestos.subtotal_productos.toFixed(2)}</b>
                    </div>
                    {resumenImpuestos.exento > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', color: '#4b5563' }}>
                        <span>Importe Exento / No Gravado:</span>
                        <b>${resumenImpuestos.exento.toFixed(2)}</b>
                      </div>
                    )}
                  </>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '700', borderTop: '1px solid #d1d5db', paddingTop: '0.4rem', marginTop: '0.3rem', color: '#111827' }}>
                  <span>Total a Cobrar:</span>
                  <span style={{ color: '#166534' }}>${resumenImpuestos.total.toFixed(2)}</span>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.4rem', fontSize: '0.8rem', color: '#374151' }}>Medio de Pago *</label>
                <select
                  value={idMedioPago}
                  onChange={(e) => setIdMedioPago(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Seleccionar...</option>
                  {mediosPago.map((medio) => (
                    <option key={medio.id_medio_pago} value={medio.id_medio_pago}>{medio.nombre}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.4rem', fontSize: '0.8rem', color: '#374151' }}>{esEfectivo ? 'Monto recibido' : 'Importe pagado'} $ *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    style={inputStyle}
                    placeholder="0.00"
                  />
                  {esEfectivo && Number(montoRecibido) >= resumenImpuestos.total && (
                    <small style={{ color: '#166534', fontWeight: '700', display: 'block', marginTop: '0.3rem' }}>
                      Vuelto: ${(Number(montoRecibido) - resumenImpuestos.total).toFixed(2)}
                    </small>
                  )}
                </div>

              {!esEfectivo && idMedioPago && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.4rem', fontSize: '0.8rem', color: '#374151' }}>Nº de Referencia / Operación *</label>
                  <input
                    type="text"
                    value={referenciaPago}
                    onChange={(e) => setReferenciaPago(e.target.value)}
                    style={inputStyle}
                    placeholder="Ej: Comprobante Nº 123456"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleConfirmarVentaFinal}
                disabled={carrito.length === 0 || cargando}
                style={{ 
                  width: '100%', 
                  backgroundColor: (carrito.length === 0 || cargando) ? '#9ca3af' : '#166534', 
                  color: '#fff', 
                  border: 0, 
                  padding: '0.75rem', 
                  borderRadius: '0.375rem', 
                  fontWeight: '700', 
                  cursor: (carrito.length === 0 || cargando) ? 'not-allowed' : 'pointer' 
                }}
              >
                {cargando ? 'Procesando Venta y Stock...' : 'Confirmar Venta y Generar Factura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASO 4: Éxito y PDF */}
      {paso === 4 && ventaConfirmada && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '2.5rem', textAlign: 'center', maxWidth: '500px', margin: '2rem auto', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <CheckCircle2 size={56} color="#166534" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: '#111827', marginBottom: '0.5rem' }}>¡Venta Confirmada con Éxito!</h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Se generó el comprobante <b>Factura {ventaConfirmada.tipo_comprobante} {String(ventaConfirmada.punto_venta).padStart(4, '0')}-{String(ventaConfirmada.numero_comprobante).padStart(8, '0')}</b> y se descontó el stock del depósito.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => downloadComprobanteVentaPdf(ventaConfirmada, carrito, clienteElegido, sucursales.find(s => s.id_sucursal === sucursalSeleccionada))}
              style={{ backgroundColor: '#65482b', color: '#fff', border: 0, padding: '0.625rem 1rem', borderRadius: '0.375rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Download size={18} /> Descargar Comprobante PDF
            </button>
            <button
              type="button"
              onClick={() => {
                setVentaConfirmada(null);
                setCarrito([]);
                setClienteElegido(null);
                setMontoRecibido('');
                setReferenciaPago('');
                setIdempotencyKey(crypto.randomUUID());
                setPaso(1);
              }}
              style={{ backgroundColor: '#ffffff', color: '#374151', border: '1px solid #d1d5db', padding: '0.625rem 1rem', borderRadius: '0.375rem', fontWeight: '600', cursor: 'pointer' }}
            >
              Volver al Panel
            </button>
          </div>
        </div>
      )}

      {ventaDetalle && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#fff', width: 'min(850px, 92vw)', maxHeight: '88vh', overflowY: 'auto', borderRadius: '0.6rem', padding: '1.5rem', boxShadow: '0 20px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Detalle de Factura {ventaDetalle.tipo_comprobante}</h2>
                <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{String(ventaDetalle.punto_venta).padStart(4, '0')}-{String(ventaDetalle.numero_comprobante).padStart(8, '0')}</span>
              </div>
              <button type="button" onClick={() => setVentaDetalle(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#6b7280' }}><X size={22} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.4rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <div><span style={{ color: '#6b7280' }}>Fecha</span><br /><b>{new Date(ventaDetalle.fecha).toLocaleString()}</b></div>
              <div><span style={{ color: '#6b7280' }}>Cliente</span><br /><b>{ventaDetalle.cliente?.nombre || 'Consumidor Final'}</b></div>
              <div><span style={{ color: '#6b7280' }}>Sucursal</span><br /><b>{sucursales.find((s) => String(s.id_sucursal) === String(ventaDetalle.id_sucursal))?.descripcion || 'Sin identificar'}</b></div>
              <div><span style={{ color: '#6b7280' }}>Medio de pago</span><br /><b>{ventaDetalle.pago_venta?.[0]?.medio_pago?.nombre || ventaDetalle.medio_pago}</b></div>
              <div><span style={{ color: '#6b7280' }}>Estado</span><br /><b>{ventaDetalle.estado}</b></div>
              <div><span style={{ color: '#6b7280' }}>Total</span><br /><b style={{ color: '#166534' }}>${Number(ventaDetalle.importe_total).toFixed(2)}</b></div>
            </div>

            <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ backgroundColor: '#2d241e', color: '#fff' }}><tr><th style={{ padding: '0.65rem', textAlign: 'left' }}>Producto</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal</th></tr></thead>
                <tbody>{(ventaDetalle.detalle_venta || []).map((item) => <tr key={item.id_detalle_venta} style={{ borderBottom: '1px solid #e5e7eb' }}><td style={{ padding: '0.65rem' }}>{item.articulo?.nombre || item.articulo?.descripcion || 'Artículo'}</td><td style={{ textAlign: 'center' }}>{item.cantidad}</td><td style={{ textAlign: 'right' }}>${Number(item.precio_unitario).toFixed(2)}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>${Number(item.subtotal).toFixed(2)}</td></tr>)}</tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" onClick={() => downloadComprobanteVentaPdf(ventaDetalle, ventaDetalle.detalle_venta || [], ventaDetalle.cliente, sucursales.find((s) => String(s.id_sucursal) === String(ventaDetalle.id_sucursal)))} style={{ border: 0, background: '#65482b', color: '#fff', padding: '0.55rem 0.8rem', borderRadius: '0.35rem', cursor: 'pointer', fontWeight: 600 }}><Download size={15} style={{ verticalAlign: 'middle', marginRight: 5 }} />Descargar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Alta Rápida de Cliente */}
      {mostrarModalCliente && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: '100' }}>
          <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '0.5rem', width: '450px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', color: '#111827' }}>Registro Rápido de Cliente</h3>
            <form onSubmit={handleGuardarCliente}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>Nombre y apellido / Razón Social *</label>
                <input
                  type="text"
                  value={tempCliente.nombre}
                  onChange={(e) => setTempCliente({ ...tempCliente, nombre: e.target.value })}
                  style={inputStyle}
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>DNI o CUIT</label>
                <input
                  type="text"
                  maxLength="11"
                  value={tempCliente.identificacion}
                  onChange={(e) => setTempCliente({ ...tempCliente, identificacion: e.target.value.replace(/\D/g, '') })}
                  style={inputStyle}
                  placeholder="Ej: 35123456 o 20351234567"
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>Teléfono</label>
                <input
                  type="tel"
                  value={tempCliente.telefono}
                  onChange={(e) => setTempCliente({ ...tempCliente, telefono: e.target.value })}
                  style={inputStyle}
                  placeholder="Ej: 3815551234"
                />
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>Condición Fiscal</label>
                <select
                  value={tempCliente.condicion}
                  onChange={(e) => {
                    const condicion = e.target.value;
                    setTempCliente({
                      ...tempCliente,
                      condicion,
                      aplica_percepcion_iva: condicion === 'Responsable Inscripto' ? tempCliente.aplica_percepcion_iva : false,
                      aplica_percepcion_iibb: condicion === 'Responsable Inscripto' ? tempCliente.aplica_percepcion_iibb : false
                    });
                  }}
                  style={inputStyle}
                >
                  <option value="Consumidor Final">Consumidor Final (Factura B)</option>
                  <option value="Responsable Inscripto">Responsable Inscripto (Factura A)</option>
                  <option value="Monotributista">Monotributista (Factura A)</option>
                  <option value="Exento">Exento (Factura B)</option>
                </select>
              </div>

              {tempCliente.condicion === 'Responsable Inscripto' && (
                <div style={{ marginBottom: '1.5rem', padding: '0.75rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.375rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.55rem', color: '#374151' }}>Percepciones aplicables</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', marginBottom: '0.45rem' }}>
                    <input
                      type="checkbox"
                      checked={tempCliente.aplica_percepcion_iva}
                      onChange={(e) => setTempCliente({ ...tempCliente, aplica_percepcion_iva: e.target.checked })}
                    />
                    Percepción de IVA (1% sobre el neto)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
                    <input
                      type="checkbox"
                      checked={tempCliente.aplica_percepcion_iibb}
                      onChange={(e) => setTempCliente({ ...tempCliente, aplica_percepcion_iibb: e.target.checked })}
                    />
                    Percepción de IIBB (3,6% sobre el neto)
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setMostrarModalCliente(false)}
                  style={{ backgroundColor: '#fff', border: '1px solid #d1d5db', padding: '0.5rem 1rem', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600', color: '#374151' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargando}
                  style={{ backgroundColor: '#65482b', color: '#fff', border: 0, padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: '700', cursor: 'pointer' }}
                >
                  Guardar y Seleccionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
