import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';

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
  let q = supabase.from('cliente').select('*');
  if (query && query.trim()) {
    q = q.or(`nombre.ilike.%${query}%,cuit.ilike.%${query}%,dni.ilike.%${query}%`);
  }
  const { data, error } = await q.limit(20);
  return { data: data || [], error };
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

      const stockCalculado = Math.max(0, stockReal > 0 ? stockReal : (item.stock_actual || 0));
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

      // Lectura robusta de la alícuota de IVA individual del artículo
      const alicuotaIva = Number(
        art.iva_porcentaje !== undefined && art.iva_porcentaje !== null ? art.iva_porcentaje : 
        (art.iva !== undefined && art.iva !== null ? art.iva : 
        (art.alicuota !== undefined && art.alicuota !== null ? art.alicuota : 
        (art.porcentaje_iva !== undefined && art.porcentaje_iva !== null ? art.porcentaje_iva : 21)))
      );

      return {
        ...art,
        id_articulo_deposito: item.id_articulo_deposito,
        nombre,
        descripcion,
        codigo,
        precio_venta: Number(precioFinal.toFixed(2)),
        iva_porcentaje: alicuotaIva,
        es_exento: Boolean(art.es_exento),
        stock_actual: stockCalculado,
        stock: stockCalculado
      };
    })
  );

  return { data: productosConStock, error: null };
}

export async function confirmarVenta(ventaPayload) {
  const puntoVenta = 1;
  const { count } = await supabase.from('venta').select('*', { count: 'exact', head: true });
  const numeroFactura = (count || 0) + 1;

  for (const item of ventaPayload.items) {
    let stockDisponible = Number(item.stock_actual !== undefined ? item.stock_actual : (item.stock !== undefined ? item.stock : 9999));

    let idArticuloDeposito = item.id_articulo_deposito;
    if (!idArticuloDeposito) {
      const { data: depFind } = await supabase
        .from('articulo_deposito')
        .select('id_articulo_deposito, stock_actual')
        .eq('id_deposito', Number(ventaPayload.id_deposito))
        .eq('id_articulo', Number(item.id_articulo))
        .maybeSingle();
      if (depFind) {
        idArticuloDeposito = depFind.id_articulo_deposito;
        if (depFind.stock_actual !== undefined) {
          stockDisponible = Number(depFind.stock_actual);
        }
      }
    }

    if (stockDisponible < Number(item.cantidad)) {
      return { 
        data: null, 
        error: { message: `Stock insuficiente para el artículo: ${item.descripcion || item.nombre}. Stock disponible: ${stockDisponible}` } 
      };
    }
  }

  const { data: ventaIns, error: errVenta } = await supabase
    .from('venta')
    .insert([{
      id_sucursal: Number(ventaPayload.id_sucursal),
      id_deposito: Number(ventaPayload.id_deposito),
      id_cliente: ventaPayload.id_cliente ? Number(ventaPayload.id_cliente) : null,
      tipo_comprobante: String(ventaPayload.tipo_comprobante),
      punto_venta: puntoVenta,
      numero_comprobante: Number(numeroFactura),
      fecha: new Date().toISOString(),
      medio_pago: String(ventaPayload.medio_pago),
      neto_21: Number(ventaPayload.neto_21 || 0),
      iva_21: Number(ventaPayload.iva_21 || 0),
      neto_105: Number(ventaPayload.neto_105 || 0),
      iva_105: Number(ventaPayload.iva_105 || 0),
      exento: Number(ventaPayload.exento || 0),
      percepciones: Number(ventaPayload.percepciones || 0),
      importe_total: Number(ventaPayload.total || 0),
      estado: 'Confirmada'
    }])
    .select()
    .single();

  if (errVenta) {
    return { data: null, error: errVenta };
  }

  const idVenta = ventaIns.id_venta;

  for (const item of ventaPayload.items) {
    await supabase
      .from('detalle_venta')
      .insert([{
        id_venta: Number(idVenta),
        id_articulo: Number(item.id_articulo),
        cantidad: Number(item.cantidad),
        precio_unitario: Number(item.precio_unitario || item.precio_venta || 0),
        subtotal: Number(item.subtotal)
      }]);

    let idArticuloDeposito = item.id_articulo_deposito;
    if (!idArticuloDeposito) {
      const { data: depFind } = await supabase
        .from('articulo_deposito')
        .select('id_articulo_deposito')
        .eq('id_deposito', Number(ventaPayload.id_deposito))
        .eq('id_articulo', Number(item.id_articulo))
        .maybeSingle();
      if (depFind) idArticuloDeposito = depFind.id_articulo_deposito;
    }

    if (idArticuloDeposito) {
      await supabase
        .from('movimiento_stock')
        .insert([{
          id_deposito: Number(ventaPayload.id_deposito),
          id_articulo_deposito: Number(idArticuloDeposito),
          tipo_movimiento: 'EGRESO',
          cantidad: Number(item.cantidad)
        }]);

      const { data: artDepReg } = await supabase
        .from('articulo_deposito')
        .select('stock_actual')
        .eq('id_articulo_deposito', Number(idArticuloDeposito))
        .maybeSingle();

      if (artDepReg) {
        const stockActualVal = Number(artDepReg.stock_actual || 0);
        const nuevoStock = Math.max(0, stockActualVal - Number(item.cantidad));

        await supabase
          .from('articulo_deposito')
          .update({ stock_actual: Number(nuevoStock) })
          .eq('id_articulo_deposito', Number(idArticuloDeposito));
      }
    }
  }

  return { data: ventaIns, error: null };
}

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

  if (venta.tipo_comprobante === 'A') {
    if (Number(venta.neto_21 || 0) > 0) {
      pdf.text(`Neto Gravado 21%: $${Number(venta.neto_21).toFixed(2)}`, 110, y); y += 6;
      pdf.text(`IVA 21%: $${Number(venta.iva_21).toFixed(2)}`, 110, y); y += 6;
    }
    if (Number(venta.neto_105 || 0) > 0) {
      pdf.text(`Neto Gravado 10.5%: $${Number(venta.neto_105).toFixed(2)}`, 110, y); y += 6;
      pdf.text(`IVA 10.5%: $${Number(venta.iva_105).toFixed(2)}`, 110, y); y += 6;
    }
    if (Number(venta.exento || 0) > 0) {
      pdf.text(`Importe Exento: $${Number(venta.exento).toFixed(2)}`, 110, y); y += 6;
    }
    if (Number(venta.percepciones || 0) > 0) {
      pdf.text(`Percepciones: $${Number(venta.percepciones).toFixed(2)}`, 110, y); y += 6;
    }
  } else {
    if (Number(venta.exento || 0) > 0) {
      pdf.text(`Importe Exento: $${Number(venta.exento).toFixed(2)}`, 110, y); y += 6;
    }
    pdf.text(`Subtotal Operación: $${Number(venta.importe_total || 0).toFixed(2)}`, 110, y); y += 6;
  }
  
  pdf.setFontSize(12);
  pdf.text(`Total: $${Number(venta.importe_total || 0).toFixed(2)}`, 110, y + 4);

  pdf.save(`factura_${venta.tipo_comprobante}_${String(venta.numero_comprobante).padStart(8, '0')}.pdf`);
}