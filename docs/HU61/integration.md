# HU61 — Instalación y validación

## Instalación

La primera migración `202610150001_hu61_sucursal_pago_proveedor.sql` fue ejecutada por el usuario. No volver a ejecutarla.

Siguiente paso: aplicar `supabase/migrations/202610150002_hu61_resumen_financiero.sql` antes de desplegar los cambios de reporte y caja. Crea metadatos de clasificación y RPC; no cambia importes ni saldos existentes. Se ejecuta dentro de una transacción.

La segunda migración requiere las migraciones existentes de caja HU50/HU51–53/HU69, además de `pago_proveedor`, `detalle_pago` y la primera migración. Usa `pago_proveedor.id_pago`, `id_proveedor`, `fecha_pago`, `importe_total`, `id_sucursal`, y `detalle_pago.id_pago`, `importe_aplicado`.

Precondiciones del esquema existente: tablas `pago_proveedor` (incluyendo `fecha_pago`), `sucursal` (id_sucursal integer y estado boolean), `usuario` (auth_id, estado, rol). No se crean ni reemplazan estas tablas. Se conserva la política RLS existente de pagos.

El trigger exige una sesión con perfil administrador activo para insertar pagos o asignar/cambiar su sucursal; no modifica los permisos RLS existentes. La función de trigger no es invocable directamente por clientes.

## Históricos

Los registros previos quedan con `id_sucursal = NULL`. Su detalle indica que requieren conciliación. El reporte permite asignar la sucursal real con sesión de administrador. No ejecutar una asignación masiva a una sucursal por defecto.

Los movimientos manuales históricos requieren clasificación. En Reportes, seleccionar Operativo, Transferencia interna o Pago a proveedor ya registrado, indicando su número cuando corresponda. Un vínculo de pago debe coincidir en sucursal, fecha efectiva e importe. Las clasificaciones no se sobrescriben: verificar antes de guardar. Las reversiones heredan la clasificación del original; las ventas se identifican por su origen sin clasificación manual.

Si hay incidencias, se muestran en lugar de totales para evitar resultados incompletos. Un pago con aplicaciones inconsistentes requiere revisión de su registro; la consulta no modifica aplicaciones ni saldos de facturas. Los movimientos nuevos de caja guardan su clasificación en la misma transacción y conservan idempotencia.

Consulta administrativa de diagnóstico, sin modificaciones:

```sql
select id_pago, fecha_pago, importe_total
from public.pago_proveedor
where id_sucursal is null
order by fecha_pago, id_pago;
```

Los nuevos pagos requieren una sucursal activa. Un pago conserva su referencia histórica si esa sucursal se da de baja posteriormente.

## Verificación

`node tests/finanzas/run.mjs` crea un cluster PostgreSQL temporal local y lo elimina al finalizar; no carga `.env` ni usa Supabase. Verifica históricos sin asignación automática, conciliación explícita, pagos nuevos, campos faltantes, sucursal inexistente/inactiva, FK y rechazo de cajero, administrador inactivo y anónimo. Ejecutado con resultado satisfactorio.

`npm.cmd run build`: satisfactorio, con advertencia de tamaño de bundle. La página conserva un hallazgo previo de ESLint por actualización de estado dentro del efecto que carga facturas/historial; la carga de sucursales nueva no introduce ese patrón.

## Comprobación en Supabase

1. Ingresar como administrador activo y abrir Reportes.
2. Verificar mes actual y selector de sucursales; consultar un solo día y un período vacío.
3. Conciliar los históricos identificados usando datos reales.
4. Comparar totales con los movimientos incluidos, sin sumar saldos iniciales ni facturas pendientes.
5. Registrar un operativo y una transferencia interna desde caja; verificar inclusión/exclusión y sus reversiones.
6. Si caja refleja un pago ya registrado, vincular el número de pago y verificar que se cuente una sola vez.
7. Verificar con cajero que Reportes no sea accesible y que las RPC rechacen la consulta.

## Límites y pendientes

La segunda migración está verificada en PostgreSQL temporal, pendiente de aplicación en Supabase. El reporte devuelve todo el detalle en un único JSON; para volúmenes mayores, evaluar paginación consistente. No se realizó QA visual conectada. La cabecera/detalles de pago aún se escriben en llamadas separadas como en la versión previa; su atomicidad queda fuera de la consulta y las inconsistencias se diagnostican. El reporte depende de que las clasificaciones manuales reflejen la operación real; no intenta inferir duplicados por textos o importes parecidos.
