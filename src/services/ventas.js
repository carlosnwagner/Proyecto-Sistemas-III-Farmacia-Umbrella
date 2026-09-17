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
  if (query && query.trim()) {
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

// 4. Obtener productos y calcular stock real aplicando Listas de Precios con vigencia temporal
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
      articulo:id_articulo (
        id_articulo,
        codigo,
        codigo_barras,
        nombre,
        descripcion,
        precio_costo,
        precio_venta,
        rubro:id_rubro (nombre)
      )
    `)
    .eq("id_deposito", idDeposito);

  if (errDep) {
    console.error('Error al cargar inventario del depósito:', errDep);
    return { data: [], error: errDep };
  }

  if (!articulosDep || articulosDep.length === 0) {
    return { data: [], error: null };
  }

  const hoy = new Date().toISOString().split('T')[0];
  const { data: listaVigente } = await supabase
    .from("lista_precio")
    .select("id_lista, nombre")
    .eq("estado", true)
    .lte("fecha_inicio", hoy)
    .gte("fecha_fin", hoy)
    .maybeSingle();

  let preciosEspeciales = {};
  if (listaVigente) {
    const { data: detallesLista } = await supabase
      .from("detalle_lista_precio")
      .select("id_articulo, precio, porcentaje_descuento")
      .eq("id_lista", listaVigente.id_lista);

    if (detallesLista) {
      detallesLista.forEach(d => {
        preciosEspeciales[d.id_articulo] = {
          precio: Number(d.precio || 0),
          descuento: Number(d.porcentaje_descuento || 0)
        };
      });
    }
  }

  const productosConStock = await Promise.all(
    articulosDep.map(async (item) => {
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

      const stockCalculado = Math.max(0, stockReal);
      const art = item.articulo || {};
      const descripcion = art.descripcion || art.nombre || 'Artículo sin nombre';
      const nombre = art.nombre || descripcion;
      const codigo = art.codigo || 'S/C';

      let precioFinal = Number(art.precio_venta || 0);
      if (preciosEspeciales[art.id_articulo]) {
        const itemLista = preciosEspeciales[art.id_articulo];
        precioFinal = itemLista.precio;
        if (itemLista.descuento > 0) {
          precioFinal = precioFinal * (1 - itemLista.descuento / 100);
        }
      }

      return {
        ...art,
        id_articulo_deposito: item.id_articulo_deposito,
        nombre,
        descripcion,
        codigo,
        precio_venta: Number(precioFinal.toFixed(2)),
        iva_porcentaje: 21,
        es_exento: false,
        stock_actual: stockCalculado,
        stock: stockCalculado
      };
    })
  );

  return { data: productosConStock, error: null };
}

// 5. Confirmar Venta Transaccional y descontar stock automáticamente (HU39)
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
        precio_unitario: Number(item.precio_unitario || item.precio_venta || 0),
        subtotal: item.subtotal
      }]);

    const idArticuloDeposito = item.id_articulo_deposito;

    if (idArticuloDeposito) {
      await supabase
        .from('movimiento_stock')
        .insert([{
          id_articulo_deposito: idArticuloDeposito,
          id_articulo: item.id_articulo,
          id_deposito: ventaPayload.id_deposito,
          tipo_movimiento: 'Egreso',
          cantidad: item.cantidad,
          motivo: `Venta Comp. ${ventaPayload.tipo_comprobante} 000${puntoVenta}-${String(numeroFactura).padStart(8, '0')}`,
          fecha: new Date().toISOString()
        }]);

      const { data: artDepReg } = await supabase
        .from('articulo_deposito')
        .select('stock_actual')
        .eq('id_articulo_deposito', idArticuloDeposito)
        .maybeSingle();

      if (artDepReg) {
        const stockActualVal = Number(artDepReg.stock_actual || 0);
        const nuevoStock = Math.max(0, stockActualVal - item.cantidad);

        await supabase
          .from('articulo_deposito')
          .update({ stock_actual: nuevoStock })
          .eq('id_articulo_deposito', idArticuloDeposito);
      }
    }
  }

  return { data: ventaIns, error: null };
}

// 6. Obtener Historial de Ventas con detalles y datos de cliente
export async function getHistorialVentas() {
  const { data, error } = await supabase
    .from('venta')
    .select(`
      *,
      cliente:id_cliente (id_cliente, nombre, cuit, dni, condicion_fiscal),
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

// 7. Generar comprobante en PDF con formato correcto (HU40)
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
    const nombreArt = item.articulo?.descripcion || item.articulo?.nombre || item.descripcion || 'Artículo';
    const precioUnit = Number(item.precio_unitario || item.precio_venta || 0);
    pdf.text(String(nombreArt), 20, y);
    pdf.text(String(item.cantidad), 120, y);
    pdf.text(`$${precioUnit.toFixed(2)}`, 145, y);
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