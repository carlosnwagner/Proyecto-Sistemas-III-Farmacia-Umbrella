# HU61 — Reglas de negocio

| ID | Regla |
| --- | --- |
| RN01 | Fechas civiles válidas y obligatorias; desde ≤ hasta. No se impone un máximo de días sin requerimiento de negocio. |
| RN02 | Mes actual calculado en la zona del negocio, independientemente del reloj o zona del navegador. |
| RN03 | «Todas» significa exclusivamente el conjunto de sucursales autorizado por el servidor. |
| RN04 | Gestión utiliza el rol administrador existente. Ser cajero no habilita el reporte. Usuario inactivo o sesión ausente no accede. |
| RN05 | Solo hechos monetarios registrados: cobros y pagos, no importes de pedidos ni saldos pendientes de comprobantes. |
| RN06 | Importes de venta cobrados se consideran netos del vuelto. Pagos parciales se incluyen por el desembolso real. |
| RN07 | Un identificador estable por operación efectiva. Las aplicaciones a facturas y vínculos comerciales son referencias, no nuevos flujos. |
| RN08 | No deduplicar por coincidencia de fecha, concepto o importe: dos pagos reales iguales son dos operaciones. |
| RN09 | Excluir apertura/saldo inicial y ambas puntas de transferencias internas. Un pago mediante transferencia bancaria a un proveedor sigue siendo un egreso externo. |
| RN10 | La reversión conserva vínculo único al original, invierte su dirección y hereda su clasificación operativa/interna. Se considera en su fecha, aun si el original queda fuera del rango. |
| RN11 | No restar la reversión dos veces: incluir original y contrapartida; no excluir también el original. |
| RN12 | Ingresos y egresos son sumas de importes positivos por dirección; flujo neto = ingresos − egresos. Usar numeric decimal en base, nunca punto flotante para acumular dinero. |
| RN13 | Totales y detalle proceden del mismo conjunto y de una misma consulta consistente. Si se pagina el detalle, los totales incluyen todo el período. |
| RN14 | El reporte nunca cambia operaciones, stock, saldos, turnos ni estados de facturas. |
| RN15 | Una operación sin sucursal o sin clasificación no se asigna silenciosamente ni se omite como si el reporte fuera completo. Requiere conciliación y diagnóstico explícito. |

RN10 adopta la interpretación D04 descrita en la especificación.
