# HU61 — Plan y estado

## Especificación

- [x] Relevar fuentes, rutas y permisos; definir criterios, reglas y escenarios.
- [x] Acordar sucursal explícita del pago e históricos sin asignación automática.
- [x] Acordar uso del administrador existente sin nuevo rol ni permiso.
- [x] Primera migración y formulario de pagos; pruebas de sucursal y autorización.
- [x] Primera migración ejecutada en Supabase por el usuario.

## Datos y resumen

- [x] Identidad canónica por operación y vínculo único entre caja y pago.
- [x] Clasificación explícita de transferencias internas y herencia en reversiones.
- [x] RPC de contexto y resumen con autorización y validación en servidor.
- [x] Totales y detalle consistentes, decimal exacto y fecha efectiva local.
- [x] Diagnóstico de históricos, pagos incompletos y vínculos modificados.
- [x] RPC de caja con movimiento y clasificación atómicos e idempotentes.
- [x] Pruebas SQL de fechas, pagos por varias facturas, deduplicación, reversión, volumen, centavos, permisos y rollback.

## Interfaz

- [x] Reporte integrado a `/reportes`, con fechas, sucursales, totales y detalle.
- [x] Mes actual según servidor, validación del rango y período aplicado visible.
- [x] Carga, vacío, error, reintento y protección contra respuestas tardías.
- [x] Conciliación de sucursales históricas y clasificación desde el reporte.
- [x] Selector de clasificación/vínculo para nuevos movimientos de caja.
- [x] Mantener ruta y menú exclusivos del administrador.

## Validación y puesta en marcha

- [x] Build y lint de nuevos archivos y archivos de caja modificados.
- [x] Pruebas locales financieras y de fechas; regresión existente de caja y ventas.
- [x] Actualizar diseño, trazabilidad y guía de instalación.
- [ ] Ejecutar segunda migración en Supabase.
- [ ] Conciliar históricos reales cuando el reporte los identifique.
- [ ] Verificar visualmente filtros, reintento y conciliación en la aplicación conectada.
- [ ] Verificar datos reales y permisos del entorno desplegado.

No se marca la HU cerrada hasta completar la validación integrada. La atomicidad del registrador anterior de pagos es una mejora separada; el reporte detecta cabeceras y aplicaciones incompletas.
