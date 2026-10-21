# Histórico ficticio del reporte financiero

1. Aplicar las migraciones anteriores y después `supabase/migrations/202610210001_finanzas_historico_demo.sql` en el SQL Editor de Supabase con rol `postgres`.
2. Ejecutar `docs/sql/cargar-historico-finanzas-demo.sql`. Su `ROLLBACK` final permite revisar los resultados sin guardar la carga.
3. Revisar montos y referencias por sucursal. Para guardar, volver a ejecutar el script cambiando únicamente el `ROLLBACK` final por `COMMIT`.
4. Abrir el reporte de 2026 y verificar cada sucursal y la opción de todas las sucursales.

Se generan enero a septiembre de 2026 para todas las sucursales existentes, incluidas las inactivas. Octubre al día 21 es la referencia de ingresos y egresos, proyectada a 31 días. Hay variaciones deterministas por mes y sucursal. Si no hay ingresos de referencia, se usa el promedio de las demás sucursales; si ninguna tiene datos, se usa $2.700.000. Sin egresos de referencia se estima el 68 % del ingreso base. Son supuestos de demostración, no una reconstrucción contable.

La carga es aditiva: conserva los datos operativos de los meses anteriores. No modifica ventas, compras, stock, pagos ni caja. Los agregados del reporte incorporan la tabla `finanzas_historico_demo`. El frontend muestra estos registros como `Resumen mensual`, sin la etiqueta ni el identificador interno de demostración. La API y la base conservan su identificación interna. El reporte de medios de pago continúa mostrando exclusivamente operaciones reales. Las incidencias de conciliación reales siguen impidiendo mostrar totales completos.

Cada resumen tiene fecha efectiva el último día de su mes: un filtro parcial solo lo incluye si contiene ese día. La clave sucursal/mes impide duplicados, incluso al repetir el script. Si cambian los importes reales de octubre, las filas ya guardadas se conservan.

Para retirar exclusivamente esta carga, ejecutar con rol `postgres`:

```sql
begin;
delete from public.finanzas_historico_demo where lote = 'historico-demo-2026-v1';
commit;
```

La integración permanece instalada, con su fuente ficticia vacía. No es necesario borrar ni modificar movimientos operativos.

Validación pendiente: ejecutar la migración y la vista previa contra una base de desarrollo con el esquema actualizado. No se ejecutó la carga en una base conectada desde este entorno.
