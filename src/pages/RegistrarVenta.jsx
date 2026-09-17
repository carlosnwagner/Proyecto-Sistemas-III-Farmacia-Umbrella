import { useState, useEffect, useMemo } from 'react';
import { 
  getSucursalesYDepositos, 
  buscarClientes, 
  crearCliente, 
  getProductosConStock, 
  confirmarVenta, 
  getHistorialVentas,
  downloadComprobanteVentaPdf 
} from '../services/ventas';
import { showAlert } from '../lib/alerts.js';
import { ShoppingCart, User, Trash2, CheckCircle2, Download, ArrowLeft, Search, DollarSign, FileText } from 'lucide-react';
import '../App.css';

export default function RegistrarVenta() {
  const [cargando, setCargando] = useState(false);
  const [paso, setPaso] = useState(1); // 1: Panel Principal / Historial, 2: Selector de Depósito, 3: POS / Carrito, 4: Éxito

  // Contexto
  const [sucursales, setSucursales] = useState([]);
  const [depositos, setDepositos] = useState([]);
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState('');
  const [depositoSeleccionado, setDepositoSeleccionado] = useState('');

  // Historial y Métricas
  const [historialVentas, setHistorialVentas] = useState([]);
  const [filtroTipoFactura, setFiltroTipoFactura] = useState('TODAS');
  const [busquedaHistorial, setBusquedaHistorial] = useState('');

  // Cliente (HU37)
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [listaClientes, setListaClientes] = useState([]);
  const [clienteElegido, setClienteElegido] = useState(null);
  const [mostrarModalCliente, setMostrarModalCliente] = useState(false);
  const [tempCliente, setTempCliente] = useState({ nombre: '', identificacion: '', condicion: 'Consumidor Final' });

  // Productos y Carrito
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [filtroProducto, setFiltroProducto] = useState('');
  const [carrito, setCarrito] = useState([]);

  // Pago
  const [medioPago, setMedioPago] = useState('Efectivo');
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
    const { data } = await getProductosConStock(depositoSeleccionado);
    setProductosDisponibles(data || []);
    setCargando(false);
    setPaso(3);
  };

  // Validación de Razón Social sin números e Identificación (DNI o CUIT)
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
      condicion_fiscal: tempCliente.condicion
    });

    if (error) {
      showAlert.errorSave('Error al registrar cliente: ' + (error.message || error));
    } else {
      showAlert.successSave('Cliente registrado y seleccionado correctamente.');
      setClienteElegido(data);
      setMostrarModalCliente(false);
      setTempCliente({ nombre: '', identificacion: '', condicion: 'Consumidor Final' });
    }
    setCargando(false);
  };

  const resumenImpuestos = useMemo(() => {
    let neto_21 = 0;
    let iva_21 = 0;
    let neto_105 = 0;
    let iva_105 = 0;
    let exento = 0;
    let total = 0;

    carrito.forEach(item => {
      const sub = Number(item.subtotal);
      total += sub;

      if (item.es_exento) {
        exento += sub;
      } else if (Number(item.iva_porcentaje) === 10.5) {
        const neto = sub / 1.105;
        neto_105 += neto;
        iva_105 += sub - neto;
      } else {
        const neto = sub / 1.21;
        neto_21 += neto;
        iva_21 += sub - neto;
      }
    });

    return {
      neto_21: Number(neto_21.toFixed(2)),
      iva_21: Number(iva_21.toFixed(2)),
      neto_105: Number(neto_105.toFixed(2)),
      iva_105: Number(iva_105.toFixed(2)),
      exento: Number(exento.toFixed(2)),
      total: Number(total.toFixed(2))
    };
  }, [carrito]);

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
    if (carrito.length === 0) return showAlert.errorSave('El carrito está vacío.');
     
    const totalVenta = resumenImpuestos.total;
    if (medioPago === 'Efectivo') {
      const recibido = Number(montoRecibido);
      if (!montoRecibido || recibido < totalVenta) {
        return showAlert.errorSave(`El monto recibido ($${recibido || 0}) no cubre el total de la venta ($${totalVenta}).`);
      }
    } else {
      if (!referenciaPago.trim()) {
        return showAlert.errorSave('El número de referencia u operación es obligatorio.');
      }
    }

    const condicionCliente = clienteElegido?.condicion_fiscal || 'Consumidor Final';
    const tipoComprobante = (condicionCliente === 'Responsable Inscripto' || condicionCliente === 'Monotributista') ? 'A' : 'B';

    setCargando(true);
    const payload = {
      id_sucursal: sucursalSeleccionada,
      id_deposito: depositoSeleccionado,
      id_cliente: clienteElegido ? clienteElegido.id_cliente : null,
      tipo_comprobante: tipoComprobante,
      items: carrito,
      medio_pago: medioPago,
      ...resumenImpuestos,
      percepciones: 0
    };

    const { data, error } = await confirmarVenta(payload);
    if (error) {
      showAlert.errorSave('Error al confirmar venta: ' + error.message);
    } else {
      showAlert.successSave('¡Venta confirmada y stock actualizado con éxito!');
      setVentaConfirmada(data);
      const hist = await getHistorialVentas();
      setHistorialVentas(hist.data || []);
      setPaso(4);
    }
    setCargando(false);
  };

  // Filtrado de ventas para el historial
  const ventasFiltradas = useMemo(() => {
    return historialVentas.filter(v => {
      const matchTipo = filtroTipoFactura === 'TODAS' || v.tipo_comprobante === filtroTipoFactura;
      const matchBusqueda = !busquedaHistorial || 
        String(v.numero_comprobante).includes(busquedaHistorial) || 
        (v.cliente?.nombre || 'Consumidor Final').toLowerCase().includes(busquedaHistorial.toLowerCase());
      return matchTipo && matchBusqueda;
    });
  }, [historialVentas, filtroTipoFactura, busquedaHistorial]);

  // Historial Semanal (últimos 7 días)
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
      
      {/* PASO 1: Panel Principal / Historial a ancho completo */}
      {paso === 1 && (
        <div>
          {/* Cabecera y Botón Nuevo Registro a la derecha */}
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

          {/* Tarjetas de Métricas Semanales */}
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

          {/* Buscador y Filtro Integrados a ancho completo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Buscar N° factura o cliente..."
                value={busquedaHistorial}
                onChange={(e) => setBusquedaHistorial(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '2.5rem' }}
              />
            </div>

            <select
              value={filtroTipoFactura}
              onChange={(e) => setFiltroTipoFactura(e.target.value)}
              style={{ ...inputStyle, width: '180px' }}
            >
              <option value="TODAS">Todos los tipos</option>
              <option value="A">Factura A</option>
              <option value="B">Factura B</option>
            </select>
          </div>

          {/* Tabla de Historial General */}
          <div style={{ backgroundColor: '#fff', borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>Comprobante</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>Fecha y Hora</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>Cliente / Receptor</th>
                    <th style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>Medio Pago</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>Total</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: '600' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: '#6b7280' }}>No se encontraron registros de ventas.</td>
                    </tr>
                  ) : (
                    ventasFiltradas.map(v => (
                      <tr key={v.id_venta} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: '600', color: '#111827' }}>
                          Factura {v.tipo_comprobante} 000{v.punto_venta}-{String(v.numero_comprobante).padStart(8, '0')}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#4b5563' }}>
                          {new Date(v.fecha).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#374151' }}>
                          {v.cliente ? v.cliente.nombre : 'Consumidor Final'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#4b5563' }}>
                          {v.medio_pago}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: '600', color: '#166534' }}>
                          ${Number(v.importe_total).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => downloadComprobanteVentaPdf(v, v.detalle_venta || [], v.cliente, sucursales.find(s => s.id_sucursal === v.id_sucursal))}
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

      {/* PASO 2: Selección de Sucursal y Depósito (Limpio, sin subtítulo innecesario ni recuadro redundante) */}
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
                  <option key={s.id_sucursal} value={s.id_sucursal}>{s.codigo} - {s.descripcion}</option>
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
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: '#111827' }}>
              Terminal de Facturación
            </h1>
            <button
              type="button"
              onClick={() => setPaso(2)}
              style={{ backgroundColor: '#ffffff', color: '#374151', border: '1px solid #d1d5db', padding: '0.625rem 1rem', borderRadius: '0.375rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem' }}
            >
              <ArrowLeft size={16} /> Volver atrás
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem' }}>
            <div>
              {/* Sección Cliente (HU37) */}
              <div style={{ backgroundColor: '#ffffff', borderRadius: '0.5rem', border: '1px solid #e5e7eb', padding: '1.25rem', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#374151' }}>
                    <User size={16} /> Cliente: {clienteElegido ? clienteElegido.nombre : 'Consumidor Final'}
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
                      placeholder="Buscar cliente por DNI, CUIT o Nombre..."
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
                            <b>{c.nombre}</b> — CUIT/DNI: {c.cuit || c.dni || 'Sin ID'} ({c.condicion_fiscal})
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
                Carrito de Venta
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
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', color: '#4b5563' }}>
                  <span>Neto Gravado:</span>
                  <b>${(resumenImpuestos.neto_21 + resumenImpuestos.neto_105).toFixed(2)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', color: '#4b5563' }}>
                  <span>IVA Total:</span>
                  <b>${(resumenImpuestos.iva_21 + resumenImpuestos.iva_105).toFixed(2)}</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: '700', borderTop: '1px solid #d1d5db', paddingTop: '0.4rem', marginTop: '0.3rem', color: '#111827' }}>
                  <span>Total a Cobrar:</span>
                  <span style={{ color: '#166534' }}>${resumenImpuestos.total.toFixed(2)}</span>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.4rem', fontSize: '0.8rem', color: '#374151' }}>Medio de Pago *</label>
                <select
                  value={medioPago}
                  onChange={(e) => setMedioPago(e.target.value)}
                  style={inputStyle}
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Tarjeta">Tarjeta</option>
                  <option value="Transferencia">Transferencia</option>
                </select>
              </div>

              {medioPago === 'Efectivo' && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontWeight: '600', marginBottom: '0.4rem', fontSize: '0.8rem', color: '#374151' }}>Monto Recibido $ *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={montoRecibido}
                    onChange={(e) => setMontoRecibido(e.target.value)}
                    style={inputStyle}
                    placeholder="0.00"
                  />
                  {Number(montoRecibido) >= resumenImpuestos.total && (
                    <small style={{ color: '#166534', fontWeight: '700', display: 'block', marginTop: '0.3rem' }}>
                      Vuelto: ${(Number(montoRecibido) - resumenImpuestos.total).toFixed(2)}
                    </small>
                  )}
                </div>
              )}

              {medioPago !== 'Efectivo' && (
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
                style={{ width: '100%', backgroundColor: '#166534', color: '#fff', border: 0, padding: '0.75rem', borderRadius: '0.375rem', fontWeight: '700', cursor: carrito.length === 0 ? 'not-allowed' : 'pointer' }}
              >
                {cargando ? 'Procesando...' : 'Confirmar Venta y Generar Factura'}
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
            Se generó el comprobante <b>Factura {ventaConfirmada.tipo_comprobante} 000{ventaConfirmada.punto_venta}-{String(ventaConfirmada.numero_comprobante).padStart(8, '0')}</b> y se descontó el stock del depósito.
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
                setPaso(1);
              }}
              style={{ backgroundColor: '#ffffff', color: '#374151', border: '1px solid #d1d5db', padding: '0.625rem 1rem', borderRadius: '0.375rem', fontWeight: '600', cursor: 'pointer' }}
            >
              Volver al Panel
            </button>
          </div>
        </div>
      )}

      {/* Modal Alta Rápida de Cliente */}
      {mostrarModalCliente && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: '#fff', padding: '2rem', borderRadius: '0.5rem', width: '450px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', color: '#111827' }}>Registro Rápido de Cliente</h3>
            <form onSubmit={handleGuardarCliente}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>Nombre / Razón Social *</label>
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
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem', color: '#374151' }}>Condición Fiscal</label>
                <select
                  value={tempCliente.condicion}
                  onChange={(e) => setTempCliente({ ...tempCliente, condicion: e.target.value })}
                  style={inputStyle}
                >
                  <option value="Consumidor Final">Consumidor Final (Factura B)</option>
                  <option value="Responsable Inscripto">Responsable Inscripto (Factura A)</option>
                  <option value="Monotributista">Monotributista (Factura A)</option>
                  <option value="Exento">Exento (Factura B)</option>
                </select>
              </div>

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