# HU61 — Consultar resumen de ingresos y egresos (S5)

Estado: implementación en el repositorio; segunda migración y validación integrada pendientes.
Puntos de historia: 8.
Método: Spec Driven Development (SDD). La implementación y sus pruebas deberán derivarse de los criterios y escenarios de este directorio.

## Historia

**Como** Responsable de Gestión, **necesito** consultar un resumen de ingresos y egresos **para** conocer los cobros y pagos registrados y su diferencia en un período.

## Alcance

Consulta financiera por período y sucursal, con totales y detalle de operaciones efectivamente registradas. Incluye cobros de ventas, pagos a proveedores y otros movimientos operativos, en todos los medios de pago admitidos. No calcula rentabilidad.

## Precondiciones

- Sesión autenticada y administrador activo, utilizando el rol existente.
- Sucursales autorizadas asignadas al usuario.
- Operaciones identificadas de manera única, con fecha efectiva, sucursal y clasificación financiera.

## Flujo principal

1. El responsable ingresa a Reportes → Resumen de ingresos y egresos.
2. El sistema obtiene las sucursales autorizadas y propone el primer y último día del mes actual, según la zona horaria del negocio.
3. Se selecciona una sucursal o todas las autorizadas y se consulta el período.
4. El sistema valida fechas y autorización en el servidor.
5. Obtiene una única población de movimientos incluidos y calcula ingresos, egresos y flujo neto sobre esa misma población.
6. Presenta el período y alcance efectivamente consultados, los tres totales y el detalle con fecha efectiva, concepto, origen e importe.
7. El responsable modifica filtros y vuelve a consultar.

## Criterios de aceptación

| ID | Criterio |
| --- | --- |
| CA01 | Fechas desde/hasta obligatorias, válidas e inclusivas; desde ≤ hasta; mes actual predeterminado. |
| CA02 | Una sucursal o todas las autorizadas; el servidor rechaza una sucursal ajena. |
| CA03 | Total de ingresos, total de egresos y diferencia neta = ingresos − egresos. |
| CA04 | Incluye cobros de ventas, pagos efectivos a proveedores y otros ingresos/egresos operativos, por su importe efectivamente cobrado/pagado. |
| CA05 | Usa fecha efectiva del movimiento; excluye pedidos, borradores y comprobantes pendientes sin desembolso. Un pago parcial sí se incluye por lo pagado. |
| CA06 | Excluye saldos iniciales y transferencias internas, incluidas sus reversiones. |
| CA07 | Refleja las reversiones en su propia fecha efectiva, sin borrar ni trasladar la operación original. |
| CA08 | Cada operación se cuenta una vez aunque tenga vínculos con ventas, proveedores, caja o varias facturas. |
| CA09 | Detalle con fecha, concepto, origen, tipo e importe; permite identificar la sucursal y la operación. |
| CA10 | Identifica la diferencia como «Flujo neto del período» y aclara que no representa ganancia. |
| CA11 | Acceso restringido en navegación, ruta y servidor; sin acceso anónimo ni ampliación de sucursales desde el cliente. |
| CA12 | Estados de carga, ausencia de datos y error con reintento; no presenta resultados de una consulta anterior como si fueran del nuevo filtro. |

## Alternativas

- Rango inválido: mensaje junto al formulario; no se ejecuta la consulta.
- Sin movimientos: totales cero y mensaje de ausencia de datos.
- Sin sucursales autorizadas: mensaje de falta de alcance; no se interpreta como ausencia de actividad financiera.
- Fallo de red o servidor: mensaje de error y opción de reintentar conservando filtros.
- Datos históricos sin clasificación o sucursal: conciliación previa; nunca se muestran totales parciales como si fueran completos.

## Fuera de alcance

Rentabilidad, costos, márgenes, devengamiento, cuentas pendientes, proyecciones, modificación de operaciones, exportación y comparaciones entre períodos. La consulta no abre ni exige un turno de caja y considera turnos abiertos y cerrados.

## Decisiones y propuestas

- D01 (acordada): agregar `id_sucursal` a `pago_proveedor` con clave foránea y selección explícita en el formulario. Históricos inicialmente nulos hasta conciliación con su sucursal real. No inferirla por el usuario que consulta ni multiplicar el pago por sus facturas.
- D02 (acordada): utilizar el administrador existente; no crear otro rol ni un permiso adicional.
- D03 (propuesta técnica): días civiles de `America/Argentina/Buenos_Aires`; límites desde 00:00 inclusive hasta 00:00 del día siguiente exclusivo.
- D04 (propuesta técnica): reversión como movimiento de signo económico contrario en su propia fecha. Revierte ingreso → egreso; revierte egreso → ingreso.

D01 se implementa en la migración `202610150001_hu61_sucursal_pago_proveedor.sql` y en el formulario real de pagos; el usuario confirmó su ejecución en Supabase. D03 y D04 están implementadas en la segunda migración y probadas localmente. El administrador consulta todas las sucursales según el modelo de autorización existente, incluidas las inactivas para consulta histórica.
