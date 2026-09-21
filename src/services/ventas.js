import { supabase } from '../lib/supabase';
import { generateStandardPDF } from '../components/pdfGenerador.jsx';

export async function getSucursalesYDepositos() {
  const { data: sucursales } = await supabase
    .from('sucursal')
    .select('*')
    .eq('estado', true);

  const { data: depositos } = await supabase
    .from('deposito')
    .select('*')
    .eq('estado', true);

  return { sucursales: sucursales || [], depositos: depositos || [] };
}

export async function buscarClientes(query = '') {
  let q = supabase.from('cliente').select('*').eq('estado', true);
  if (query && query.trim()) {
    const termino = query.trim().replace(/[,%()]/g, '');
    q = q.or(`nombre.ilike.%${termino}%,cuit.ilike.%${termino}%,dni.ilike.%${termino}%,telefono.ilike.%${termino}%`);
  }
  const { data, error } = await q.limit(20);
  return { data: data || [], error };
}

export async function getMediosPagoActivos() {
  const { data, error } = await supabase
    .from('medio_pago')
    .select('id_medio_pago, codigo, nombre, descripcion')
    .eq('estado', true)
    .order('nombre', { ascending: true });

  return { data: data || [], error };
}

export async function getBorradoresVenta() {
  const { data, error } = await supabase
    .from('venta_borrador')
    .select(`
      *,
      cliente:id_cliente (*),
      detalle_venta_borrador (*)
    `)
    .eq('estado', 'Borrador')
    .order('fecha_actualizacion', { ascending: false });

  return { data: data || [], error };
}

export async function guardarVentaBorrador(payload) {
  const items = (payload.items || []).map((item) => ({
    id_articulo: Number(item.id_articulo),
    id_articulo_deposito: Number(item.id_articulo_deposito),
    cantidad: Number(item.cantidad),
    precio_unitario: Number(item.precio_venta),
    alicuota_iva: Number(item.iva_porcentaje ?? 21)
  }));

  const { data, error } = await supabase.rpc('guardar_venta_borrador', {
    p_id_borrador: payload.id_borrador || null,
    p_id_sucursal: Number(payload.id_sucursal),
    p_id_deposito: Number(payload.id_deposito),
    p_id_cliente: payload.id_cliente ? Number(payload.id_cliente) : null,
    p_id_lista: payload.id_lista ? Number(payload.id_lista) : null,
    p_items: items,
    p_id_medio_pago: payload.id_medio_pago ? Number(payload.id_medio_pago) : null,
    p_importe_pagado: payload.importe_pagado === '' ? null : Number(payload.importe_pagado),
    p_referencia_pago: payload.referencia_pago?.trim() || null,
    p_percepcion_iva: Number(payload.percepcion_iva || 0),
    p_percepcion_iibb: Number(payload.percepcion_iibb || 0),
    p_idempotency_key: payload.idempotency_key || null
  });

  return { data, error };
}

export async function cancelarVentaBorrador(idBorrador) {
  const { error } = await supabase.rpc('cancelar_venta_borrador', {
    p_id_borrador: Number(idBorrador)
  });
  return { error };
}

function validarCuitArgentino(cuit) {
  const cleanCuit = String(cuit).replace(/\D/g, '');
  if (cleanCuit.length !== 11) return false;
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let acumulado = 0;
  for (let i = 0; i < 10; i++) {
    acumulado += parseInt(cleanCuit[i], 10) * multipliers[i];
  }
  let digito = 11 - (acumulado % 11);
  if (digito === 11) digito = 0;
  if (digito === 10) digito = 9;
  return digito === parseInt(cleanCuit[10], 10);
}

function validarDniArgentino(dni) {
  const cleanDni = String(dni).replace(/\D/g, '');
  if (!/^\d{7,8}$/.test(cleanDni)) return false;
  const invalidas = [
    '00000000', '11111111', '22222222', '33333333', '44444444',
    '55555555', '66666666', '77777777', '88888888', '99999999',
    '12345678', '87654321'
  ];
  if (invalidas.includes(cleanDni)) return false;
  const num = parseInt(cleanDni, 10);
  return !(num < 1000000 || num > 99999999);
}

export async function crearCliente(clienteData) {
  if (clienteData.dni && clienteData.dni.trim() !== '') {
    if (!validarDniArgentino(clienteData.dni)) {
      return { data: null, error: { message: 'El DNI ingresado no es válido según el formato de Argentina.' } };
    }
  }

  if (clienteData.cuit && clienteData.cuit.trim() !== '') {
    if (!validarCuitArgentino(clienteData.cuit)) {
      return { data: null, error: { message: 'El CUIT ingresado no es válido (dígito verificador incorrecto).' } };
    }
  }

  const identificadores = [];
  if (clienteData.dni) identificadores.push(`dni.eq.${clienteData.dni}`);
  if (clienteData.cuit) identificadores.push(`cuit.eq.${clienteData.cuit}`);

  if (identificadores.length > 0) {
    const { data: existente, error: errorBusqueda } = await supabase
      .from('cliente')
      .select('id_cliente')
      .or(identificadores.join(','))
      .limit(1)
      .maybeSingle();

    if (errorBusqueda) return { data: null, error: errorBusqueda };
    if (existente) {
      return { data: null, error: { message: 'Ya existe un cliente registrado con el mismo DNI o CUIT.' } };
    }
  }

  const { data, error } = await supabase
    .from('cliente')
    .insert([clienteData])
    .select()
    .single();
  return { data, error };
}

export async function getProductosConStock(idDeposito) {
  if (!idDeposito) {
    return { data: [], error: null };
  }

  const { data: articulosDep, error: errDep } = await supabase
    .from("articulo_deposito")
    .select(`
      id_articulo_deposito,
      id_articulo,
      stock_minimo,
      stock_actual,
      articulo:id_articulo (*)
    `)
    .eq("id_deposito", idDeposito);

  if (errDep) {
    console.error('Error al cargar inventario del depósito:', errDep);
    return { data: [], error: errDep };
  }

  if (!articulosDep || articulosDep.length === 0) {
    return { data: [], error: { message: 'El depósito seleccionado no posee productos asociados.' } };
  }

  const hoy = new Date().toISOString().split('T')[0];
  const { data: listaVigente, error: errLista } = await supabase
    .from("lista_precio")
    .select("id_lista, nombre")
    .eq("estado", true)
    .lte("fecha_inicio", hoy)
    .or(`fecha_fin.is.null,fecha_fin.gte.${hoy}`)
    .maybeSingle();

  if (errLista) return { data: [], error: errLista };
  if (!listaVigente) {
    return { data: [], error: { message: 'No existe una lista de precios activa y vigente para la fecha actual.' } };
  }

  const { data: detallesLista, error: errDetalles } = await supabase
    .from("detalle_lista_precio")
    .select("id_articulo, precio_final")
    .eq("id_lista", listaVigente.id_lista);

  if (errDetalles) return { data: [], error: errDetalles };

  const preciosVigentes = new Map(
    (detallesLista || []).map((detalle) => [Number(detalle.id_articulo), Number(detalle.precio_final || 0)])
  );

  const inventarioIncluidoEnLista = articulosDep.filter((item) =>
    preciosVigentes.has(Number(item.id_articulo))
  );

  if (inventarioIncluidoEnLista.length === 0) {
    return {
      data: [],
      error: { message: 'El depósito no posee productos incluidos en la lista de precios vigente.' }
    };
  }

  const productosConStock = await Promise.all(
    inventarioIncluidoEnLista.map(async (item) => {
      const { data: movs } = await supabase
        .from("movimiento_stock")
        .select("cantidad, tipo_movimiento")
        .eq("id_articulo_deposito", item.id_articulo_deposito);

      const stockReal = (movs || []).reduce((sum, m) => {
        const cant = Math.abs(Number(m.cantidad) || 0);
        const tipoNorm = (m.tipo_movimiento || "").toUpperCase();
        const esResta = tipoNorm.includes("EGRESO") || 
                        tipoNorm.includes("MERMA") || 
                        tipoNorm.includes("ROTURA") || 
                        tipoNorm.includes("VENCIMIENTO") ||
                        tipoNorm.includes("VENTA");
        return esResta ? sum - cant : sum + cant;
      }, 0);

      const stockCalculado = Math.max(0, stockReal > 0 ? stockReal : (item.stock_actual || 0));
      const art = item.articulo || {};
      const descripcion = art.descripcion || art.nombre || 'Artículo sin nombre';
      const nombre = art.nombre || descripcion;
      const codigo = art.codigo || 'S/C';

      const precioFinal = Number(preciosVigentes.get(Number(art.id_articulo)) || 0);
      const alicuotaIva = Number(art.alicuota_iva);

      return {
        ...art,
        id_articulo_deposito: item.id_articulo_deposito,
        nombre,
        descripcion,
        codigo,
        id_lista: listaVigente.id_lista,
        nombre_lista: listaVigente.nombre,
        precio_venta: Number(precioFinal.toFixed(2)),
        iva_porcentaje: alicuotaIva,
        es_exento: alicuotaIva === 0,
        stock_actual: stockCalculado,
        stock: stockCalculado
      };
    })
  );

  return { data: productosConStock.filter((producto) => producto.precio_venta > 0), error: null };
}

export async function confirmarVenta(ventaPayload) {
  const items = ventaPayload.items.map((item) => ({
    id_articulo: Number(item.id_articulo),
    id_articulo_deposito: Number(item.id_articulo_deposito),
    cantidad: Number(item.cantidad)
  }));

  const { data, error } = await supabase
    .rpc('confirmar_venta_desde_borrador', {
      p_id_borrador: Number(ventaPayload.id_borrador),
      p_idempotency_key: ventaPayload.idempotency_key,
      p_id_sucursal: Number(ventaPayload.id_sucursal),
      p_id_deposito: Number(ventaPayload.id_deposito),
      p_id_cliente: ventaPayload.id_cliente ? Number(ventaPayload.id_cliente) : null,
      p_tipo_comprobante: String(ventaPayload.tipo_comprobante),
      p_id_lista: Number(ventaPayload.id_lista),
      p_items: items,
      p_id_medio_pago: Number(ventaPayload.id_medio_pago),
      p_importe_pagado: Number(ventaPayload.importe_pagado),
      p_referencia_pago: ventaPayload.referencia_pago?.trim() || null,
      p_percepcion_iva: Number(ventaPayload.percepcion_iva || 0),
      p_percepcion_iibb: Number(ventaPayload.percepcion_iibb || 0)
    })
    .single();

  return { data, error };
}

export async function getHistorialVentas() {
  const { data, error } = await supabase
    .from('venta')
    .select(`
      *,
      cliente:id_cliente (id_cliente, nombre, cuit, dni, condicion_fiscal),
      pago_venta (
        id_pago_venta,
        importe,
        referencia,
        medio_pago:id_medio_pago (id_medio_pago, codigo, nombre)
      ),
      detalle_venta (
        id_detalle_venta,
        id_articulo,
        cantidad,
        precio_unitario,
        subtotal,
        articulo:id_articulo (nombre, descripcion)
      )
    `)
    .order('fecha', { ascending: false });

  return { data: data || [], error };
}

export async function downloadComprobanteVentaPdf(venta, items, cliente, sucursal) {
  const tipo = venta.tipo_comprobante || 'B';
  const puntoVenta = String(venta.punto_venta || 1).padStart(4, '0');
  const numero = String(venta.numero_comprobante || 0).padStart(8, '0');
  const moneda = (valor) => `$${Number(valor || 0).toFixed(2)}`;

  const infoData = [
    { label: 'Comprobante', value: `${tipo} ${puntoVenta}-${numero}` },
    { label: 'Fecha', value: new Date(venta.fecha || Date.now()).toLocaleString('es-AR') },
    { label: 'Sucursal', value: sucursal?.descripcion || sucursal?.nombre || 'Principal' },
    { label: 'Cliente', value: cliente?.nombre || 'Consumidor Final' },
    { label: 'Condición fiscal', value: cliente?.condicion_fiscal || 'Consumidor Final' },
    { label: 'CUIT / DNI', value: cliente?.cuit || cliente?.dni || 'No informado' },
    { label: 'Medio de pago', value: venta.medio_pago || 'No informado' },
  ];

  const rows = (items || []).map((item) => [
    item.articulo?.nombre || item.articulo?.descripcion || item.nombre || item.descripcion || 'Artículo',
    String(item.cantidad || 0),
    moneda(item.precio_unitario ?? item.precio_venta),
    moneda(item.subtotal),
  ]);

  const summaryData = [];
  if (tipo === 'A') {
    if (Number(venta.neto_21 || 0) > 0) {
      summaryData.push({ label: 'Neto gravado 21%', value: moneda(venta.neto_21) });
      summaryData.push({ label: 'IVA 21%', value: moneda(venta.iva_21) });
    }
    if (Number(venta.neto_105 || 0) > 0) {
      summaryData.push({ label: 'Neto gravado 10,5%', value: moneda(venta.neto_105) });
      summaryData.push({ label: 'IVA 10,5%', value: moneda(venta.iva_105) });
    }
    if (Number(venta.exento || 0) > 0) {
      summaryData.push({ label: 'Importe exento', value: moneda(venta.exento) });
    }
    if (Number(venta.percepcion_iva || 0) > 0) {
      summaryData.push({ label: 'Percepción IVA', value: moneda(venta.percepcion_iva) });
    }
    if (Number(venta.percepcion_iibb || 0) > 0) {
      summaryData.push({ label: 'Percepción IIBB', value: moneda(venta.percepcion_iibb) });
    }
  }
  summaryData.push({ label: 'TOTAL', value: moneda(venta.importe_total), emphasis: true });

  return generateStandardPDF({
    title: `FACTURA ${tipo}`,
    subtitle: `${puntoVenta}-${numero}`,
    infoData,
    columns: ['ARTÍCULO', 'CANTIDAD', 'PRECIO UNITARIO', 'SUBTOTAL'],
    rows,
    summaryData,
    footerNote: 'Comprobante generado por el Sistema de Gestión de Farmacia Umbrella',
    fileName: `factura_${tipo}_${numero}.pdf`,
  });
}
