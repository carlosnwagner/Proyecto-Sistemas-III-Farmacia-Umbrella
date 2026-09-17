import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';

// 1. Obtener sucursales y depósitos para el contexto de venta
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

// 2. Buscar clientes por DNI, CUIT o Nombre (HU37)
export async function buscarClientes(query = '') {
  let q = supabase.from('cliente').select('*');
  if (query.trim()) {
    q = q.or(`nombre.ilike.%${query}%,cuit.ilike.%${query}%,dni.ilike.%${query}%`);
  }
  const { data, error } = await q.limit(20);
  return { data: data || [], error };
}

// 3. Crear cliente rápido en línea (HU37)
export async function crearCliente(clienteData) {
  const { data, error } = await supabase
    .from('cliente')
    .insert([clienteData])
    .select()
    .single();
  return { data, error };
}

// 4. Obtener productos y calcular stock real dinámicamente desde movimientos (HU36)
export async function getProductosConStock(idDeposito) {
  // Traer los movimientos de stock para calcular la existencia real
  const { data: movimientos, error: errMov } = await supabase
    .from('movimiento_stock')
    .select('*')
    .eq('id_deposito', idDeposito);

  if (errMov) {
    console.error('Error al cargar movimientos de stock:', errMov);
  }

  const stockMap = new Map();

  // Calcular stock acumulado por artículo (Ingresos - Egresos)
  if (movimientos) {
    movimientos.forEach(m => {
      const artId = m.id_articulo;
      const cant = Number(m.cantidad || 0);
      const tipo = (m.tipo_movimiento || '').toLowerCase();

      const current = stockMap.get(artId) || 0;
      if (tipo.includes('ingreso') || tipo.includes('entrada') || tipo.includes('alta')) {
        stockMap.set(artId, current + cant);
      } else if (tipo.includes('egreso') || tipo.includes('salida') || tipo.includes('venta')) {
        stockMap.set(artId, current - cant);
      } else {
        // Por defecto si el tipo es genérico
        stockMap.set(artId, current + cant);
      }
    });
  }

  // Complementar con la tabla articulo_deposito por si hay registros base
  const { data: stockData } = await supabase
    .from('articulo_deposito')
    .select('*')
    .eq('id_deposito', idDeposito);

  if (stockData) {
    stockData.forEach(s => {
      const artId = s.id_articulo;
      if (!stockMap.has(artId) || stockMap.get(artId) === 0) {
        const baseStock = Number(s.stock_actual ?? s.stock ?? s.cantidad ?? 0);
        if (baseStock > 0) {
          stockMap.set(artId, baseStock);
        }
      }
    });
  }

  const idsArticulos = Array.from(stockMap.keys());
  if (idsArticulos.length === 0) {
    return { data: [], error: null };
  }

  // Traer los datos de los artículos
  const { data: articulos, error: errArt } = await supabase
    .from('articulo')
    .select('*')
    .in('id_articulo', idsArticulos);

  if (errArt) {
    console.error('Error al cargar artículos:', errArt);
    return { data: [], error: errArt };
  }

  const productosConStock = (articulos || []).map(art => {
    const descripcion = art.descripcion || art.nombre || art.titulo || 'Artículo sin nombre';
    const codigo = art.codigo || art.sku || 'S/C';
    const precio_venta = Number(art.precio_venta || art.precio || art.monto || 0);
    const iva_porcentaje = Number(art.iva_porcentaje || art.iva || 21);
    const es_exento = Boolean(art.es_exento || art.exento || false);

    return {
      ...art,
      descripcion,
      codigo,
      precio_venta,
      iva_porcentaje,
      es_exento,
      stock_actual: stockMap.get(art.id_articulo) || 0
    };
  });

  return { data: productosConStock, error: null };
}

// 5. Confirmar Venta Transaccional (HU39)
export async function confirmarVenta(ventaPayload) {
  const puntoVenta = 1;
  const { count } = await supabase.from('venta').select('*', { count: 'exact', head: true });
  const numeroFactura = (count || 0) + 1;

  const { data: ventaIns, error: errVenta } = await supabase
    .from('venta')
    .insert([{
      id_sucursal: ventaPayload.id_sucursal,
      id_deposito: ventaPayload.id_deposito,
      id_cliente: ventaPayload.id_cliente || null,
      tipo_comprobante: ventaPayload.tipo_comprobante,
      punto_venta: puntoVenta,
      numero_comprobante: numeroFactura,
      fecha: new Date().toISOString(),
      medio_pago: ventaPayload.medio_pago,
      neto_21: ventaPayload.neto_21,
      iva_21: ventaPayload.iva_21,
      neto_105: ventaPayload.neto_105,
      iva_105: ventaPayload.iva_105,
      exento: ventaPayload.exento,
      percepciones: ventaPayload.percepciones,
      importe_total: ventaPayload.total,
      estado: 'Confirmada'
    }])
    .select()
    .single();

  if (errVenta) return { data: null, error: errVenta };

  const idVenta = ventaIns.id_venta;

  for (const item of ventaPayload.items) {
    await supabase
      .from('detalle_venta')
      .insert([{
        id_venta: idVenta,
        id_articulo: item.id_articulo,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        subtotal: item.subtotal
      }]);

    await supabase
      .from('movimiento_stock')
      .insert([{
        id_articulo: item.id_articulo,
        id_deposito: ventaPayload.id_deposito,
        tipo_movimiento: 'Egreso',
        cantidad: item.cantidad,
        motivo: `Venta Comp. ${ventaPayload.tipo_comprobante} 000${puntoVenta}-${String(numeroFactura).padStart(8, '0')}`,
        fecha: new Date().toISOString()
      }]);

    const { data: stockActualReg } = await supabase
      .from('articulo_deposito')
      .select('*')
      .eq('id_articulo', item.id_articulo)
      .eq('id_deposito', ventaPayload.id_deposito)
      .maybeSingle();

    if (stockActualReg) {
      const stockActualVal = Number(stockActualReg.stock_actual ?? stockActualReg.stock ?? stockActualReg.cantidad ?? 0);
      const nuevoStock = Math.max(0, stockActualVal - item.cantidad);
      const campoStock = stockActualReg.stock_actual !== undefined ? 'stock_actual' : (stockActualReg.stock !== undefined ? 'stock' : 'cantidad');

      await supabase
        .from('articulo_deposito')
        .update({ [campoStock]: nuevoStock })
        .eq('id_articulo', item.id_articulo)
        .eq('id_deposito', ventaPayload.id_deposito);
    }
  }

  return { data: ventaIns, error: null };
}

// 6. Generar comprobante en PDF (HU40)
export function downloadComprobanteVentaPdf(venta, items, cliente, sucursal) {
  const pdf = new jsPDF();
  let y = 20;

  pdf.setFontSize(16);
  pdf.text(`FACTURA ${venta.tipo_comprobante}`, 20, y);
  y += 10;
  
  pdf.setFontSize(10);
  pdf.text(`Punto de Venta: ${String(venta.punto_venta).padStart(4, '0')}  Comp. N°: ${String(venta.numero_comprobante).padStart(8, '0')}`, 20, y);
  y += 6;
  pdf.text(`Fecha: ${new Date(venta.fecha).toLocaleString()}`, 20, y);
  y += 6;
  pdf.text(`Sucursal: ${sucursal?.descripcion || 'Principal'}`, 20, y);
  y += 10;

  pdf.line(20, y, 190, y);
  y += 8;

  pdf.text(`Cliente / Receptor: ${cliente ? cliente.nombre : 'Consumidor Final'} (${cliente?.condicion_fiscal || 'Consumidor Final'})`, 20, y);
  if (cliente?.cuit || cliente?.dni) {
    y += 6;
    pdf.text(`CUIT / DNI: ${cliente.cuit || cliente.dni}`, 20, y);
  }
  y += 12;

  pdf.line(20, y, 190, y);
  y += 8;

  pdf.text('Artículo', 20, y);
  pdf.text('Cant.', 120, y);
  pdf.text('P. Unit', 145, y);
  pdf.text('Subtotal', 170, y);
  y += 6;
  pdf.line(20, y, 190, y);
  y += 8;

  items.forEach(item => {
    pdf.text(String(item.descripcion || 'Artículo'), 20, y);
    pdf.text(String(item.cantidad), 120, y);
    pdf.text(`$${Number(item.precio_unitario).toFixed(2)}`, 145, y);
    pdf.text(`$${Number(item.subtotal).toFixed(2)}`, 170, y);
    y += 6;
  });

  y += 10;
  pdf.line(20, y, 190, y);
  y += 8;

  pdf.text(`Neto Gravado 21%: $${Number(venta.neto_21 || 0).toFixed(2)}`, 120, y); y += 6;
  pdf.text(`IVA 21%: $${Number(venta.iva_21 || 0).toFixed(2)}`, 120, y); y += 6;
  if (Number(venta.neto_105 || 0) > 0) {
    pdf.text(`Neto Gravado 10.5%: $${Number(venta.neto_105 || 0).toFixed(2)}`, 120, y); y += 6;
    pdf.text(`IVA 10.5%: $${Number(venta.iva_105 || 0).toFixed(2)}`, 120, y); y += 6;
  }
  if (Number(venta.exento || 0) > 0) {
    pdf.text(`Exento: $${Number(venta.exento || 0).toFixed(2)}`, 120, y); y += 6;
  }
  
  pdf.setFontSize(12);
  pdf.text(`Total: $${Number(venta.importe_total || 0).toFixed(2)}`, 120, y + 4);

  pdf.save(`factura_${venta.tipo_comprobante}_${String(venta.numero_comprobante).padStart(8, '0')}.pdf`);
}