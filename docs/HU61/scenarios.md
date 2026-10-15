# HU61 — Escenarios de aceptación

Estos escenarios son el contrato para las pruebas automatizadas y funcionales. Véase traceability.md para la evidencia ejecutada y los casos pendientes de validación integrada.

| ID | Dado / Cuando | Entonces |
| --- | --- | --- |
| E01 | Fecha de negocio 15/10/2026; se abre el reporte | Desde 01/10/2026 y hasta 31/10/2026. |
| E02 | Desde posterior a hasta, fecha inexistente o fecha faltante | Rechazo en cliente y servidor; sin consulta de movimientos. |
| E03 | Desde = hasta = 15/10/2026 | Incluye todas las operaciones del día local. |
| E04 | Rango octubre; movimientos a las 00:00 del 01/10, 23:59:59.999 del 31/10 y 00:00 del 01/11 | Incluye los dos primeros y excluye el tercero, incluso con sesión SQL en UTC. |
| E05 | Usuario autorizado solo para A y B; existen operaciones en C | «Todas» incluye A y B; pedir C explícitamente falla. |
| E06 | Cobro 1000; pago proveedor 300; ingreso operativo 100; egreso operativo 50 | Ingresos 1100; egresos 350; flujo neto 750. |
| E07 | Pedido 800, factura pendiente 500, pago parcial efectivo 200 | Solo se computa el pago 200 como egreso. |
| E08 | Comprobante de septiembre cobrado el 05/10 | El cobro pertenece a octubre. |
| E09 | Venta por 1000; cliente entrega 1200 y recibe vuelto 200 | Ingreso 1000 una sola vez, aunque exista pago_venta y movimiento_caja. |
| E10 | Un pago 300 aplicado a tres facturas y vinculado a caja | Egreso 300, una sola operación. |
| E11 | Dos cobros distintos por 100 con igual fecha y concepto | Ingresos 200; se conservan ambos identificadores. |
| E12 | Saldo inicial 5000 y transferencia interna 700 con ambas puntas | Ninguno afecta los totales. |
| E13 | Transferencia bancaria externa a proveedor por 300 | Egreso 300; el medio de pago no determina que sea interna. |
| E14 | Ingreso 500 y su reversión 500 dentro del período | Ingresos 500, egresos 500 y flujo neto 0; ambos visibles. |
| E15 | Ingreso en septiembre revertido en octubre | Octubre contiene el egreso de reversión; no modifica septiembre. |
| E16 | Egreso 300 revertido en octubre | La reversión aporta ingreso 300. |
| E17 | Transferencia interna revertida | La reversión también queda excluida. |
| E18 | No hay operaciones incluidas | Totales cero y estado vacío, sin error. |
| E19 | Usuario anónimo, inactivo o sin permiso financiero | RPC rechazada; ruta y navegación restringidas. |
| E20 | Usuario con permiso pero sin sucursales asignadas | Informa falta de sucursales autorizadas. |
| E21 | Consulta lenta o fallida | Estado de carga/error accesible y reintento; no mezcla filtros y resultados anteriores. |
| E22 | Se inicia consulta B mientras A sigue pendiente | Una respuesta tardía de A no reemplaza el resultado de B. |
| E23 | Operaciones en turnos abiertos y cerrados | Ambas incluidas por fecha efectiva; no exige caja abierta. |
| E24 | Pago histórico sin sucursal o movimiento sin clasificación | Diagnóstico de conciliación; nunca resumen aparentemente completo omitiendo ese pago. |
| E25 | Más movimientos que el límite de filas de la API | Los totales incluyen todos y se puede recorrer el detalle completo. |
| E26 | Ingresos 0.10 y 0.20, egreso 0.10 | Totales 0.30, 0.10 y 0.20, sin error de punto flotante. |
| E27 | Se consulta un período con flujo neto positivo o negativo | Etiqueta «Flujo neto del período»; no se usa «ganancia» para nombrar el resultado. |
