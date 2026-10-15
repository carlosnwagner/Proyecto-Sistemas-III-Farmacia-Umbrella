# HU61 — Diseño implementado

## Fuentes e identidad

`finanzas_resumen` combina movimientos efectivos de caja con pagos a proveedores confirmados por sus aplicaciones. No suma ventas, pedidos, facturas ni pago_venta como flujos adicionales. Identificadores: `caja:<id>` y `pago:<id>`.

- Cobros de venta: `movimiento_caja`, por el importe de la venta neto del vuelto registrado en HU69.
- Movimientos manuales: se clasifican como Operativo, TransferenciaInterna o PagoProveedor.
- Pagos: una cabecera de `pago_proveedor` cuenta una vez, independientemente de la cantidad de facturas aplicadas. Debe tener sucursal, importe válido y aplicaciones por el mismo total.
- Si un movimiento de caja refleja un pago existente, su clasificación lo vincula por ID. Se incluye la cabecera del pago y se excluye esa representación de caja. El vínculo exige mismo importe, fecha efectiva y sucursal; es único por pago.
- Reversiones: heredan la clasificación del original y se computan por su tipo y fecha propios. También se incluye una reversión de pago vinculado, como ingreso de contrapartida del egreso original.
- Transferencias internas: original y reversión se excluyen. El medio bancario Transferencia no implica que una operación sea interna.
- Saldo inicial: no participa en la consulta.

Los metadatos se guardan en `clasificacion_flujo_caja` sin modificar movimientos inmutables. La RPC `hu61_registrar_movimiento_caja` envuelve la función de HU50: movimiento y clasificación se confirman juntos o se revierten juntos; conserva autorización de caja, bloqueo e idempotencia. La pantalla utiliza esta RPC. Los clientes anteriores que usen HU50 pueden producir movimientos sin clasificar, que se diagnostican en el reporte.

## Autorización

Se reutiliza `administrador`, activo y vinculado por `usuario.auth_id` a la sesión. No se incorpora otro rol ni permiso adicional. El administrador existente tiene alcance sobre todas las sucursales; el reporte incluye inactivas para consultar su historia. La selección de una sucursal inexistente se rechaza en servidor.

El menú Reportes y la ruta `/reportes` ya eran exclusivos de administrador. Todas las RPC financieras verifican identidad en servidor. Se revoca ejecución a public/anon y acceso directo a metadatos; funciones security definer con search_path fijo. Las funciones internas no son invocables por authenticated.

## Fechas, importes y consistencia

Mes actual y días civiles de `America/Argentina/Buenos_Aires`. Ventana `[desde 00:00, día posterior a hasta 00:00)`. La fecha de pago proveedor es `fecha_pago`; la de caja, `fecha_hora`. No depende de la apertura/cierre del turno ni de la zona del navegador o sesión SQL.

Un único CTE genera diagnósticos, movimientos y totales sobre el mismo snapshot. Importes numeric en SQL, enviados como cadenas decimales; el cliente solo formatea. Detalle agregado JSON para evitar truncamiento por límite de filas de PostgREST, probado con 1105 movimientos. El costo de carga crece con el período; paginación por snapshot queda como mejora si el volumen real lo requiere.

## Contrato

`finanzas_contexto()` devuelve `sucursales: [{id,nombre}]`, `desde` y `hasta` del mes actual.

`finanzas_resumen(p_desde date,p_hasta date,p_sucursal bigint default null)`:

```json
{
  "periodo": { "desde": "2026-10-01", "hasta": "2026-10-31" },
  "sucursal_id": null,
  "completo": true,
  "incidencias": [],
  "totales": { "ingresos": "1100.00", "egresos": "350.00", "flujo_neto": "750.00" },
  "movimientos": []
}
```

En el ejemplo se omite el detalle. Cada movimiento contiene ID estable, fecha efectiva, sucursal, concepto, origen, tipo e importe. Se ordena por fecha e ID descendentes.

Si hay datos faltantes, `completo=false`, `totales=null` y `movimientos=[]`; las incidencias describen los registros a corregir, sin presentar totales parciales. Se detectan pagos sin sucursal, aplicaciones inconsistentes, movimientos manuales sin clasificación (también originales fuera del período cuyas reversiones caen dentro) y pagos cuyos datos cambiaron después de vincularlos.

La pantalla permite asignar sucursal real a históricos y clasificar movimientos originales. Una clasificación confirmada no se sobrescribe silenciosamente. Los pagos con aplicaciones incompletas remiten a la pantalla de proveedores para revisión.

## Interfaz y límites

`ResumenFinanciero.jsx` incluye filtros, período aplicado visible, tarjetas y detalle, carga, vacío, error y reintento. Una secuencia de solicitudes impide que una respuesta tardía reemplace otra más reciente. Al consultar se retiran resultados anteriores.

El registro existente de cabecera y aplicaciones de pagos usa llamadas separadas y no se reescribió en esta HU de consulta. Si quedó incompleto, el reporte lo diagnostica; debe corregirse con evidencia del pago real. El servicio alternativo `src/services/pagos.js` no lo utiliza la pantalla actual y referencia una RPC no versionada.

La primera migración fue ejecutada por el usuario en Supabase. La segunda está probada localmente y pendiente de aplicación/validación con datos reales. No se accedió a Supabase desde el ejecutor de pruebas.
