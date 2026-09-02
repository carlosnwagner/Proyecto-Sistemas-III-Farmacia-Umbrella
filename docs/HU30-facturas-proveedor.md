# HU 30 - Facturas de proveedor

## Especificación ejecutable

- Una factura requiere un proveedor existente.
- El comprobante requiere tipo, punto de venta, número correlativo y fecha.
- Los importes permitidos son subtotal, IVA, conceptos exentos y conceptos no gravados.
- El total debe ser igual a subtotal + IVA + exentos + no gravados, con tolerancia de un centavo.
- No se puede repetir el mismo tipo, punto de venta y número para un proveedor.
- La orden de compra es opcional y, si se informa, debe existir.
- Una factura nueva comienza en estado `Pendiente`.
- El saldo pendiente es total menos pagos aplicados y se muestra junto con el estado.

## Escenarios

| Dado | Cuando | Entonces |
| --- | --- | --- |
| proveedor existente e importes consistentes | se registra la factura | se guarda y queda pendiente |
| comprobante ya registrado para ese proveedor | se intenta registrar nuevamente | la operación se rechaza |
| total distinto a la suma de conceptos | se intenta registrar | se muestra error de importes |
| factura con pagos parciales | se consulta | muestra total, saldo y `Pagada Parcial` |
| factura asociada a orden de compra | se consulta | conserva y muestra la orden relacionada |