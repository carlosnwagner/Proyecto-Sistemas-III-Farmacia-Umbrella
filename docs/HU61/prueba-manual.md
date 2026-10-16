# HU61 — Guía de prueba funcional

Usá una cuenta activa con rol `administrador`. No hace falta crear un rol `gerente`. Hacé las pruebas primero en un entorno de desarrollo o con operaciones de prueba acordadas; evitá registrar movimientos ficticios en producción.

## Antes de probar

1. Aplicar, en este orden, las migraciones pendientes `202610150001_hu61_sucursal_pago_proveedor.sql` (solo si todavía no fue aplicada) y `202610150002_hu61_resumen_financiero.sql`.
2. Desplegar la versión actualizada de la aplicación.
3. Confirmar en Supabase que el usuario de prueba tiene `estado = true`, `rol = 'administrador'` y `auth_id` igual al usuario de Authentication.
4. Preparar o identificar dos sucursales y operaciones reales de prueba. Para comprobar conciliaciones históricas, identificar primero el pago o movimiento exacto y su sucursal verdadera.

## 1. Acceso y alcance

- Como administrador activo, abrir **Reportes → Resumen de ingresos y egresos**. Debe cargar el mes actual según Argentina y mostrar sucursales disponibles. (CA01, CA02, CA11)
- Cambiar el usuario de prueba a cajero en un entorno seguro, iniciar una sesión nueva e intentar entrar por menú y por URL `/reportes`. No debe mostrar el reporte. Restaurar el rol administrador después.
- Intentar invocar `finanzas_contexto()` y `finanzas_resumen(...)` como `anon` en el SQL Editor usando `set role anon`; debe rechazarse. Como authenticated con perfil cajero o administrador inactivo, también debe rechazarse.
- Confirmar que «Todas» incluye las sucursales que autoriza el modelo del proyecto y que no permite consultar un ID inexistente.

## 2. Filtros y fechas

- Consultar un día con `desde = hasta`; debe incluir el día completo en zona Argentina.
- Consultar un rango que incluya operaciones a las 00:00 del primer día y al final del último día; ambas deben aparecer. Una operación a las 00:00 del día siguiente debe quedar fuera.
- Probar fecha faltante, fecha imposible y `desde > hasta`; el formulario debe indicar el problema y no reemplazar resultados por datos de otra consulta.
- Consultar un período válido sin movimientos; debe mostrar ingresos, egresos y flujo neto en cero con un mensaje de ausencia de movimientos.
- Si una consulta falla, debe verse el error y **Reintentar** debe conservar el rango y sucursal elegidos. (CA01, CA12)

## 3. Pagos a proveedores

- En **Compras → Pagos a Proveedores**, registrar un pago de prueba con sucursal real, fecha efectiva, medio e importe aplicado. Puede aplicarse a una factura o distribuirse entre varias; el importe del pago debe contar una sola vez.
- Registrar un pago parcial de una factura. En el reporte debe figurar solo el monto efectivamente desembolsado, no el saldo pendiente ni el total de la factura.
- Si un movimiento de caja refleja exactamente ese mismo pago, conciliarlo desde Reportes como **Pago a proveedor ya registrado** e indicar el ID del pago. Debe quedar una sola salida financiera. Fecha, importe y sucursal deben coincidir.
- En un histórico sin sucursal, revisar fecha, importe, proveedor y comprobantes; asignar la sucursal verdadera desde la incidencia. No asignar por defecto.
- Si hay aplicaciones incompletas, el reporte debe advertirlo y no mostrar totales como completos. Corregirlo solo en el módulo de pagos con documentación real.
- Una transferencia bancaria a proveedor es un egreso externo; no se excluye por el medio de pago. (CA04, CA05, CA08, CA09)

## 4. Caja: ingresos, egresos y transferencias internas

- En **Caja → Movimientos y saldos**, registrar un ingreso operativo y un egreso operativo en un turno de prueba. Clasificarlos como **Operativo** al registrarlos. Ambos deben aparecer en el reporte por su importe y fecha efectivos.
- Registrar las dos puntas de una transferencia entre cajas/sucursales y clasificarlas como **Transferencia interna**. Ninguna debe alterar los totales financieros.
- Si el movimiento ya existe como histórico sin clasificación, abrir Reportes y clasificar el original. La clasificación confirmada no debe cambiarse silenciosamente.
- Confirmar que un saldo inicial de caja no aparece en el detalle ni afecta los totales. Los turnos abiertos y cerrados se consultan por igual.
- Si se revierte un movimiento operativo, la reversión debe aparecer en su propia fecha con el tipo opuesto. Si se revierte una transferencia interna, original y reversión deben quedar fuera del resumen. (CA04, CA06, CA07, CA08)

## 5. Ventas

- En **Ventas → Registro de ventas**, completar una venta de prueba con importe exacto y medio permitido. El reporte debe contar el cobro una vez, aunque también exista el registro de pago asociado a la venta.
- En una venta en efectivo con vuelto, comparar con el importe de la venta cobrado, no con el efectivo recibido bruto. El vuelto no debe inflar el ingreso.
- Revertir una venta de prueba si el flujo lo permite; la reversión debe quedar como egreso en su fecha propia. No deben incluirse borradores ni ventas no confirmadas. (CA04, CA05, CA07, CA08)

## 6. Totales y detalle

- Comparar los renglones del detalle contra los totales: ingresos = suma de filas de tipo Ingreso; egresos = suma de filas de tipo Egreso; flujo neto = ingresos − egresos.
- Verificar que cada fila muestre fecha efectiva, concepto, origen, tipo, importe y sucursal identificable.
- Verificar que el texto diga **Flujo neto del período** y aclare que no representa ganancia.
- Comparar períodos que incluyen operaciones enlazadas a varias facturas, una venta o un pago de caja: cada operación económica debe contar una sola vez. (CA03, CA08, CA09, CA10)

## Resultado

Anotar para cada paso: usuario/rol, sucursal, rango, ID de operación, resultado esperado, resultado observado y captura o ID de consulta. Marcar un criterio como aprobado solo después de comprobarlo con datos del entorno conectado. No borrar operaciones de producción para limpiar pruebas.
