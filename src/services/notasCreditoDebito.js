import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';

export const TIPOS_NOTA = ['Crédito', 'Débito'];

export async function getFacturasParaNota() {
  const { data: facturas, error } = await supabase
    .from('factura_proveedor')
    .select('id_factura_proveedor, tipo_comprobante, tipo_factura, punto_venta, numero_comprobante, importe_total, estado, id_proveedor, proveedor(razon_social, identificacion_fiscal)')
    .order('fecha', { ascending: false });

  if (error || !facturas?.length) return { data: facturas ?? [], error };

  const ids = facturas.map(f => f.id_factura_proveedor);

  const [resPagos, resNotas] = await Promise.all([
    supabase.from('detalle_pago').select('id_factura_proveedor, importe_aplicado').in('id_factura_proveedor', ids),
    supabase.from('nota_credito_debito_proveedor').select('id_factura_proveedor, tipo_nota, importe').in('id_factura_proveedor', ids)
  ]);

  const aplicaciones = resPagos.data || [];
  const notas = resNotas.data || [];

  const pagadoPorFactura = new Map();
  for (const a of aplicaciones) {
    pagadoPorFactura.set(a.id_factura_proveedor, (pagadoPorFactura.get(a.id_factura_proveedor) || 0) + Number(a.importe_aplicado));
  }

  const impactoNotas = new Map();
  for (const n of notas) {
    const imp = Number(n.importe);
    impactoNotas.set(n.id_factura_proveedor, (impactoNotas.get(n.id_factura_proveedor) || 0) + (n.tipo_nota === 'Crédito' ? -imp : imp));
  }

  const dataConSaldo = facturas.map(f => {
    const pagado = pagadoPorFactura.get(f.id_factura_proveedor) || 0;
    const notasImp = impactoNotas.get(f.id_factura_proveedor) || 0;
    const saldo = Number(f.importe_total) + notasImp - pagado;
    
    let estadoReal = f.estado;
    if (saldo <= 0) estadoReal = 'Pagada Total';

    return {
      ...f,
      estado: estadoReal,
      saldo_pendiente: Number(Math.max(0, saldo).toFixed(2))
    };
  });

  return { data: dataConSaldo, error: null };
}

export function validateNotaPayload(payload, saldoPendienteFactura = null, numeroFacturaOriginal = null) {
  const errors = {};

  if (!payload?.id_factura_proveedor) errors.id_factura_proveedor = 'Debe seleccionar la factura.';
  if (!payload?.tipo_nota || !TIPOS_NOTA.includes(payload.tipo_nota)) errors.tipo_nota = 'Debe elegir Crédito o Débito.';
  
  if (!payload?.numero_comprobante?.trim()) {
    errors.numero_comprobante = 'Número de comprobante obligatorio.';
  } else {
    const regexFormato = /^([AB]\s)?\d{4,5}-\d{8}$/i;
    if (!regexFormato.test(payload.numero_comprobante.trim())) {
      errors.numero_comprobante = 'Formato inválido. Ejemplo: "A 0001-00000001".';
    } else if (payload.numero_comprobante.trim().toLowerCase() === numeroFacturaOriginal?.trim().toLowerCase()) {
      errors.numero_comprobante = 'La nota no puede tener el mismo número que la factura original.';
    }
  }

  if (!payload?.fecha) errors.fecha = 'Fecha obligatoria.';
  if (payload?.fecha && Number.isNaN(new Date(payload.fecha).getTime())) errors.fecha = 'Fecha inválida.';

  const importe = Number(payload?.importe);
  if (!Number.isFinite(importe) || importe <= 0) errors.importe = 'Importe debe ser mayor a 0.';

  if (payload?.tipo_nota === 'Crédito' && saldoPendienteFactura !== null && importe > saldoPendienteFactura) {
    errors.importe = `El importe ($${importe}) supera el saldo pendiente ($${saldoPendienteFactura}).`;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export async function createNotaCreditoDebito(payload) {
  const idFactura = Number(payload.id_factura_proveedor);
  if (!idFactura || idFactura <= 0) {
    return { data: null, error: { field: 'id_factura_proveedor', message: 'ID de factura inválido.' } };
  }

  // Verificamos si ya existe una nota con EXACTAMENTE este mismo número de comprobante para evitar duplicados fiscales
  const { data: notaExistente } = await supabase
    .from('nota_credito_debito_proveedor')
    .select('id_nota')
    .eq('numero_comprobante', payload.numero_comprobante.trim())
    .maybeSingle();

  if (notaExistente) {
    return { data: null, error: { field: 'numero_comprobante', message: `El número de comprobante "${payload.numero_comprobante.trim()}" ya fue registrado anteriormente.` } };
  }

  const { data: facturaActual, error: facturaError } = await supabase
    .from('factura_proveedor')
    .select('id_factura_proveedor, id_proveedor, importe_total, estado, numero_comprobante')
    .eq('id_factura_proveedor', idFactura)
    .maybeSingle();

  if (facturaError || !facturaActual) {
    return { data: null, error: { field: 'id_factura_proveedor', message: 'Factura no existe o fue eliminada.' } };
  }

  const [resPagos, resNotas] = await Promise.all([
    supabase.from('detalle_pago').select('importe_aplicado').eq('id_factura_proveedor', idFactura),
    supabase.from('nota_credito_debito_proveedor').select('tipo_nota, importe').eq('id_factura_proveedor', idFactura)
  ]);

  const pagos = resPagos.data || [];
  const notas = resNotas.data || [];

  const totalPagado = pagos.reduce((sum, p) => sum + Number(p.importe_aplicado || 0), 0);
  const impactoNotas = notas.reduce((sum, n) => sum + (n.tipo_nota === 'Crédito' ? -Number(n.importe) : Number(n.importe)), 0);
  const saldoActual = Math.max(0, Number(facturaActual.importe_total) + impactoNotas - totalPagado);

  const { valid, errors } = validateNotaPayload(payload, saldoActual, facturaActual.numero_comprobante);
  if (!valid) {
    return { data: null, error: { field: null, message: 'Revisá los campos marcados.', fieldErrors: errors } };
  }

  const importeNota = Number(payload.importe);
  const saldoCambio = payload.tipo_nota === 'Crédito' ? -importeNota : importeNota;
  const nuevoSaldo = saldoActual + saldoCambio;
  const saldoFinal = Math.max(0, nuevoSaldo);

  let nuevoEstado;
  if (saldoFinal <= 0) nuevoEstado = 'Pagada Total';
  else if (saldoFinal < Number(facturaActual.importe_total)) nuevoEstado = 'Pagada Parcial';
  else nuevoEstado = 'Pendiente';

  const { data: notaGuardada, error: insertError } = await supabase
    .from('nota_credito_debito_proveedor')
    .insert({
      id_proveedor: facturaActual.id_proveedor,
      id_factura_proveedor: facturaActual.id_factura_proveedor,
      tipo_nota: payload.tipo_nota,
      numero_comprobante: payload.numero_comprobante.trim(),
      fecha: payload.fecha,
      importe: importeNota,
    })
    .select('id_nota, tipo_nota, numero_comprobante, fecha, importe')
    .single();

  if (insertError) {
    return { data: null, error: { field: null, message: 'Error al guardar la nota: ' + insertError.message } };
  }

  const { error: updateError } = await supabase
    .from('factura_proveedor')
    .update({ estado: nuevoEstado })
    .eq('id_factura_proveedor', idFactura);

  if (updateError) {
    return { data: notaGuardada, error: { field: null, message: 'Nota guardada, pero no se pudo actualizar el estado de la factura.' } };
  }

  return {
    data: {
      ...notaGuardada,
      saldo_anterior: saldoActual,
      saldo_nuevo: saldoFinal,
      estado_nuevo: nuevoEstado,
    },
    error: null,
  };
}

export async function getNotasPorFactura(idFacturaProveedor) {
  const { data, error } = await supabase
    .from('nota_credito_debito_proveedor')
    .select('id_nota, tipo_nota, numero_comprobante, fecha, importe')
    .eq('id_factura_proveedor', idFacturaProveedor)
    .order('fecha', { ascending: false });
  return { data: data ?? [], error };
}

export function downloadNotaPdf(nota, factura, proveedor) {
  const pdf = new jsPDF();
  let y = 20;

  pdf.setFontSize(16);
  pdf.text(`NOTA DE ${nota.tipo_nota.toUpperCase()}`, 20, y);
  y += 10;
  
  pdf.setFontSize(10);
  pdf.text(`Comprobante N°: ${nota.numero_comprobante}`, 20, y);
  y += 6;
  pdf.text(`Fecha de Emisión: ${nota.fecha}`, 20, y);
  y += 10;

  pdf.line(20, y, 190, y);
  y += 8;

  pdf.text(`Proveedor: ${proveedor?.razon_social || '-'}`, 20, y);
  y += 6;
  pdf.text(`CUIT: ${proveedor?.identificacion_fiscal || '-'}`, 20, y);
  y += 6;
  pdf.text(`Factura Asociada: ${factura.tipo_comprobante || 'Factura'} ${factura.tipo_factura || ''} ${String(factura.punto_venta || 1).padStart(4, '0')}-${String(factura.numero_comprobante || factura.id_factura_proveedor).padStart(8, '0')}`, 20, y);
  y += 12;

  pdf.line(20, y, 190, y);
  y += 8;

  pdf.text('Concepto / Detalle', 20, y);
  pdf.text('Importe', 160, y);
  y += 6;
  pdf.line(20, y, 190, y);
  y += 8;

  pdf.text(`Corrección por Nota de ${nota.tipo_nota} aplicada a comprobante`, 20, y);
  pdf.text(`$${Number(nota.importe).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 160, y);
  y += 15;

  pdf.line(20, y, 190, y);
  y += 10;

  pdf.setFontSize(12);
  pdf.text(`Importe Total: $${Number(nota.importe).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, 130, y);

  pdf.save(`nota_${nota.tipo_nota.toLowerCase()}_${nota.numero_comprobante.replace(/\s+/g, '_')}.pdf`);
}