import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';

export const TIPOS_COMPROBANTE = ['Factura'];
export const TIPOS_FACTURA = ['A', 'B'];
export const ESTADOS_FACTURA = ['Pendiente', 'Pagada Parcial', 'Pagada', 'Anulada'];
export const ALICUOTAS_IVA = [0, 10.5, 21];

export function formatNumeroComprobante(puntoVenta, numeroComprobante) {
  const punto = String(puntoVenta || '').padStart(5, '0');
  const numero = String(numeroComprobante || '').padStart(8, '0');
  return `${punto}-${numero}`;
}

export function validateFacturaPayload(payload) {
  const errors = {};
  const subtotal = Number(payload?.subtotal);
  const iva = Number(payload?.iva);
  const exentos = Number(payload?.conceptos_exentos || 0);
  const percepcionIva = Number(payload?.percepcion_iva || 0);
  const percepcionIibb = Number(payload?.percepcion_iibb || 0);
  const total = Number(payload?.importe_total);

  if (!payload?.id_proveedor) errors.id_proveedor = 'Debe seleccionar un proveedor.';
  if (!TIPOS_COMPROBANTE.includes(payload?.tipo_comprobante)) {
    errors.tipo_comprobante = 'Debe seleccionar un tipo de comprobante válido.';
  }
  if (!TIPOS_FACTURA.includes(payload?.tipo_factura)) {
    errors.tipo_factura = 'Debe seleccionar una letra de factura válida.';
  }
  if (!payload?.numero_comprobante?.trim()) {
    errors.numero_comprobante = 'El número de comprobante es obligatorio.';
  } else if (!/^\d{1,8}$/.test(payload.numero_comprobante.trim())) {
    errors.numero_comprobante = 'Ingrese un número de comprobante de hasta 8 dígitos.';
  }
  const puntoVenta = Number(payload?.punto_venta);
  if (!Number.isInteger(puntoVenta) || puntoVenta < 1 || puntoVenta > 99999) {
    errors.punto_venta = 'El punto de venta debe tener entre 1 y 99999.';
  }
  if (!payload?.fecha || Number.isNaN(new Date(payload.fecha).getTime())) {
    errors.fecha = 'La fecha ingresada no es válida.';
  }

  if (payload?.detalle?.some((detalle) => !ALICUOTAS_IVA.includes(Number(detalle.tasa_iva)))) {
    errors.detalle = 'Cada producto debe tener una alícuota de IVA válida.';
  }
  if (payload?.detalle?.some((detalle) => !detalle.id_articulo && !detalle.descripcion?.trim())) {
    errors.detalle = 'Cada ítem manual debe tener una descripción.';
  }

  for (const [field, value] of [
    ['subtotal', subtotal],
    ['iva', iva],
    ['conceptos_exentos', exentos],
    ['percepcion_iva', percepcionIva],
    ['percepcion_iibb', percepcionIibb],
    ['importe_total', total],
  ]) {
    if (!Number.isFinite(value) || value < 0) errors[field] = 'El importe debe ser un número mayor o igual a 0.';
  }

  if (Number.isFinite(total) && Number.isFinite(subtotal) && Number.isFinite(iva)
    && Number.isFinite(exentos) && Number.isFinite(percepcionIva) && Number.isFinite(percepcionIibb)
    && exentos > subtotal + 0.01) {
    errors.conceptos_exentos = 'Los exentos no pueden superar el subtotal.';
  }

  if (Number.isFinite(total) && Number.isFinite(subtotal) && Number.isFinite(iva)
    && Number.isFinite(percepcionIva) && Number.isFinite(percepcionIibb)
    && Math.abs(subtotal + iva + percepcionIva + percepcionIibb - total) > 0.01) {
    errors.importe_total = 'El total debe coincidir con la suma de los conceptos.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

function parseSupabaseError(error) {
  if (error?.code === '23505') {
    return {
      field: 'numero_comprobante',
      message: 'Ya existe ese comprobante para el proveedor seleccionado.',
    };
  }
  if (error?.code === '23503') {
    return { field: 'id_proveedor', message: 'El proveedor u orden de compra seleccionados no existen.' };
  }
  if (error?.code === '23514') {
    return { field: null, message: 'Los importes no cumplen las reglas de negocio.' };
  }
  return { field: null, message: error?.message || 'Ocurrió un error al guardar la factura.' };
}

/**
 * FIX: el saldo pendiente de una factura no depende solo de los pagos aplicados
 * (detalle_pago). También lo modifican las notas de crédito/débito
 * (nota_credito_debito_proveedor): una nota de Crédito reduce el saldo, una de
 * Débito lo aumenta. Antes esta función solo restaba los pagos, por lo que una
 * nota registrada no se reflejaba en el listado de facturas. Ver getFacturasProveedores.
 */
export async function getFacturasProveedores() {
  const { data, error } = await supabase
    .from('factura_proveedor')
    .select(`
      id_factura_proveedor, id_proveedor, id_orden_compra, tipo_comprobante,
      tipo_factura, punto_venta, numero_comprobante, fecha, subtotal, iva, conceptos_exentos,
      importe_total, estado,
      proveedor:id_proveedor(razon_social),
      orden_compra:id_orden_compra(numero_orden)
    `)
    .order('fecha', { ascending: false });

  if (error) return { data: [], error };

  const ids = (data || []).map((factura) => factura.id_factura_proveedor);
  if (!ids.length) return { data: [], error: null };

  const [{ data: aplicaciones, error: aplicacionesError }, { data: notas, error: notasError }] = await Promise.all([
    supabase
      .from('detalle_pago')
      .select('id_factura_proveedor, importe_aplicado')
      .in('id_factura_proveedor', ids),
    supabase
      .from('nota_credito_debito_proveedor')
      .select('id_factura_proveedor, tipo_nota, importe')
      .in('id_factura_proveedor', ids),
  ]);

  if (aplicacionesError) return { data: [], error: aplicacionesError };
  if (notasError) return { data: [], error: notasError };

  const pagadoPorFactura = new Map();
  for (const aplicacion of aplicaciones || []) {
    pagadoPorFactura.set(
      aplicacion.id_factura_proveedor,
      (pagadoPorFactura.get(aplicacion.id_factura_proveedor) || 0) + Number(aplicacion.importe_aplicado),
    );
  }

  const impactoNotasPorFactura = new Map();
  for (const nota of notas || []) {
    const importe = Number(nota.importe) || 0;
    const esCredito = nota.tipo_nota === 'Crédito';
    impactoNotasPorFactura.set(
      nota.id_factura_proveedor,
      (impactoNotasPorFactura.get(nota.id_factura_proveedor) || 0) + (esCredito ? -importe : importe),
    );
  }

  return {
    data: data.map((factura) => {
      const totalPagado = pagadoPorFactura.get(factura.id_factura_proveedor) || 0;
      const impactoNotas = impactoNotasPorFactura.get(factura.id_factura_proveedor) || 0;
      const saldo = Number(factura.importe_total) + impactoNotas - totalPagado;
      return {
        ...factura,
        saldo_pendiente: Number(Math.max(0, saldo).toFixed(2)),
      };
    }),
    error: null,
  };
}

export async function createFacturaProveedor(payload) {
  const { valid, errors } = validateFacturaPayload(payload);
  if (!valid) return { data: null, error: { field: null, message: 'Revisá los campos marcados.', fieldErrors: errors } };

  const insertPayload = {
    id_proveedor: Number(payload.id_proveedor),
    id_orden_compra: payload.id_orden_compra ? Number(payload.id_orden_compra) : null,
    tipo_comprobante: payload.tipo_comprobante,
    tipo_factura: payload.tipo_factura,
    punto_venta: Number(payload.punto_venta),
    numero_comprobante: payload.numero_comprobante.trim().padStart(8, '0'),
    fecha: payload.fecha,
    subtotal: Number(payload.subtotal),
    iva: Number(payload.iva),
    conceptos_exentos: Number(payload.conceptos_exentos || 0),
    percepcion_iva: Number(payload.percepcion_iva || 0),
    percepcion_iibb: Number(payload.percepcion_iibb || 0),
    importe_total: Number(payload.importe_total),
  };

  const { data, error } = await supabase
    .from('factura_proveedor')
    .insert(insertPayload)
    .select()
    .single();

  if (error) return { data: null, error: parseSupabaseError(error) };

  if (payload.detalle?.length) {
    const { error: detalleError } = await supabase.from('detalle_factura_proveedor').insert(
      payload.detalle.map((detalle) => ({
        id_factura_proveedor: data.id_factura_proveedor,
        id_detalle_orden_compra: detalle.id_detalle_orden ? Number(detalle.id_detalle_orden) : null,
        id_articulo: detalle.id_articulo ? Number(detalle.id_articulo) : null,
        descripcion: detalle.descripcion || detalle.articulo?.nombre || null,
        cantidad: Number(detalle.cantidad),
        precio_unitario: Number(detalle.precio_unitario),
        tasa_iva: Number(detalle.tasa_iva || 0),
      })),
    );
    if (detalleError) return { data: null, error: parseSupabaseError(detalleError) };
  }

  return { data, error: null };
}

export function downloadFacturaPdf(factura, detalles) {
  const pdf = new jsPDF();
  const numero = formatNumeroComprobante(factura.punto_venta, factura.numero_comprobante);
  let y = 20;

  pdf.setFontSize(18);
  pdf.text('Factura de proveedor', 20, y);
  y += 12;
  pdf.setFontSize(11);
  pdf.text(`Comprobante: ${factura.tipo_comprobante || 'Factura'} ${factura.tipo_factura || ''} - ${numero}`, 20, y);
  y += 7;
  pdf.text(`Proveedor: ${factura.proveedor?.razon_social || '-'}`, 20, y);
  y += 7;
  pdf.text(`Fecha: ${factura.fecha || '-'}`, 20, y);
  y += 12;
  pdf.line(20, y, 190, y);
  y += 9;

  pdf.setFontSize(10);
  pdf.text('Detalle', 20, y);
  pdf.text('Cantidad', 115, y);
  pdf.text('Precio', 140, y);
  pdf.text('Importe', 170, y);
  y += 7;

  for (const detalle of detalles || []) {
    const descripcion = detalle.descripcion || detalle.articulo?.nombre || 'Artículo';
    pdf.text(String(descripcion).slice(0, 45), 20, y);
    pdf.text(String(detalle.cantidad ?? ''), 115, y);
    pdf.text(currencyPdf(detalle.precio_unitario), 140, y);
    pdf.text(currencyPdf(detalle.importe), 170, y);
    y += 7;
    if (y > 275) {
      pdf.addPage();
      y = 20;
    }
  }

  y += 5;
  pdf.line(20, y, 190, y);
  y += 9;
  pdf.text(`Subtotal: ${currencyPdf(factura.subtotal)}`, 130, y);
  y += 7;
  pdf.text(`IVA: ${currencyPdf(factura.iva)}`, 130, y);
  y += 7;
  pdf.text(`Exentos: ${currencyPdf(factura.conceptos_exentos)}`, 130, y);
  y += 7;
  pdf.setFontSize(12);
  pdf.text(`Total: ${currencyPdf(factura.importe_total)}`, 130, y);
  pdf.save(`factura-${numero.replace('-', '_')}.pdf`);
}

function currencyPdf(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export async function getFacturaDetalle(idFactura) {
  const { data, error } = await supabase
    .from('detalle_factura_proveedor')
    .select(`
      id_detalle_factura,
      descripcion,
      cantidad,
      precio_unitario,
      tasa_iva,
      importe,
      articulo:id_articulo(nombre)
    `)
    .eq('id_factura_proveedor', idFactura)
    .order('id_detalle_factura', { ascending: true });

  return { data: data || [], error };
}
