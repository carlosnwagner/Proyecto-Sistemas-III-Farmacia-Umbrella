# HU36 - Matriz de trazabilidad de listas de precios

## Relación entre criterios e implementación

| Criterio | Reglas | Escenarios principales | Implementación | Verificación |
| --- | --- | --- | --- | --- |
| CA01 | RN01-RN03 | Lista abierta y rango inválido | `ListasPrecios.jsx`, restricciones de `lista_precio` | Crear con y sin fecha final; invertir fechas |
| CA02 | RN04, RN07 | Alta inactiva y carga automática | RPC `crear_lista_precio_con_productos` | Comparar artículos agregados y omitidos |
| CA03 | RN08-RN10 | Editar, quitar y reincorporar | Pantalla y servicio de listas; RPC de productos faltantes | Comprobar unicidad y selector filtrado |
| CA04 | RN11-RN13 | Sin ajuste, descuento y recargo | Columnas derivadas y formulario de detalle | Validar las tres fórmulas |
| CA05 | RN05 | Programada, vigente, vencida e inactiva | Estado calculado en `ListasPrecios.jsx` | Probar límites de inicio y final |
| CA06 | RN14-RN15 | Lista vacía y producto sin IVA | Validación de servicio y trigger de activación | Intentar activar en ambos casos |
| CA07 | RN06 | Períodos superpuestos | Trigger `lista_precio_vigencia_unica` | Probar rangos abiertos y cerrados |
| CA08 | RN09, RN12-RN13 | Valores inválidos | Restricciones de `detalle_lista_precio` y formulario | Cero, negativos, 100 % y ajustes simultáneos |
| CA09 | RN20 | Consulta histórica | Filtros de pantalla y ausencia de eliminación de cabecera | Consultar vencidas e inactivas |
| CA10 | RN16-RN19 | IVA informativo incluido | `articulo.alicuota_iva` y detalle de lista | Mostrar 21 %, 10,5 %, exento y sin definir |

## Modelo de datos

| Entidad | Responsabilidad en HU36 |
| --- | --- |
| `lista_precio` | Nombre, descripción, inicio, final opcional y habilitación administrativa. |
| `detalle_lista_precio` | Artículo, precio base al público, descuento, recargo y precio final derivado. |
| `articulo` | Estado, precio de venta inicial y tratamiento de IVA; la lista solo consulta estos datos. |

## Componentes

| Archivo | Responsabilidad |
| --- | --- |
| `src/pages/ListasPrecios.jsx` | Administración, estados temporales, detalle de productos y ajustes. |
| `src/services/listasPrecios.js` | Operaciones con listas y detalles. |
| `src/pages/InventarioProductos.jsx` | Clasificación fiscal del artículo. |
| `supabase/migrations/202609170001_listas_precios.sql` | Integridad, precio final, vigencias y consulta de precio aplicable. |
| `supabase/migrations/202609180001_permisos_listas_precios.sql` | Permisos requeridos por la pantalla. |
| `supabase/migrations/202609180002_crear_lista_con_productos.sql` | Creación atómica con productos activos. |
| `supabase/migrations/202609190001_agregar_productos_activos_lista.sql` | Reincorporación masiva de productos faltantes. |
| `supabase/migrations/202609190002_alicuota_iva_articulos.sql` | Clasificación fiscal y bloqueo de activación incompleta. |

## Estado actual

| Criterio | Estado de desarrollo | Prueba pendiente |
| --- | --- | --- |
| CA01 | Implementado | Ejecución funcional con Supabase |
| CA02 | Implementado | Validar conteos agregados y omitidos |
| CA03 | Implementado | Quitar y reincorporar varios artículos |
| CA04 | Implementado | Verificar redondeo y los tres ajustes |
| CA05 | Implementado | Probar fechas de frontera |
| CA06 | Implementado en código y migración | Ejecutar migración y probar activación |
| CA07 | Implementado | Probar superposición abierta y cerrada |
| CA08 | Implementado | Probar restricciones desde interfaz y SQL |
| CA09 | Implementado | Consultar una lista vencida real |
| CA10 | Implementado en código y migración | Clasificar artículos y verificar presentación |

## Cobertura mínima para finalizar la HU

- Ejecutar las migraciones pendientes en Supabase.
- Verificar que los artículos `MED` existentes se inicialicen en 10,5 %.
- Verificar que los demás artículos se inicialicen en 21 %.
- Probar una lista con fecha final nula.
- Probar fechas exactamente iguales al inicio y al final.
- Probar períodos superpuestos.
- Probar una lista vacía y otra con IVA sin definir.
- Probar sin ajuste, descuento y recargo.
- Verificar que los precios mostrados no adicionen nuevamente el IVA.
- Registrar el resultado de cada escenario de `scenarios.md`.

## Integración con ventas

Aunque el cálculo y registro de la venta permanecen fuera del alcance funcional de HU36, el módulo de ventas consume su resultado respetando estas reglas:

- Utiliza la única lista global activa cuya vigencia incluya la fecha de venta.
- Admite una fecha final nula como vigencia abierta.
- Solo ofrece productos que estén simultáneamente en la lista vigente y asociados al depósito seleccionado.
- Usa `detalle_lista_precio.precio_final`, que ya incluye descuentos, recargos e IVA.
- Lee la clasificación desde `articulo.alicuota_iva` sin solicitarla manualmente en la venta.
- Conserva en la venta la lista utilizada y en cada detalle la alícuota aplicada.
- Las percepciones de IVA e IIBB se ingresan manualmente en ventas y no modifican el precio definido por HU36.

## Decisiones adoptadas

| ID | Decisión | Definición |
| --- | --- | --- |
| DP01 | Alcance de HU36 | Se limita a administrar listas de precios; ventas, stock, clientes, pagos y comprobantes pertenecen a otras HU. |
| DP02 | Significado del precio | El precio base y final son precios al público con IVA incluido. |
| DP03 | Fecha final | Es opcional y su valor es inclusivo. |
| DP04 | Listas generales | La lista no depende de una sucursal. |
| DP05 | Vigencia única | No se permiten períodos activos superpuestos. |
| DP06 | Carga de productos | Una lista nueva incorpora automáticamente todos los artículos activos con precio positivo. |
| DP07 | Tratamiento de IVA | Se configura en el artículo y se muestra como solo lectura en la lista. |
| DP08 | Medicamentos | Como regla simplificada del proyecto, los códigos `MED-*` se inicializan en 10,5 % y admiten corrección manual a 21 % o exento. |
| DP09 | Rubros no medicinales | Se inicializan con la tasa general del 21 %. |
