# HU36 - Matriz de trazabilidad

Esta matriz relaciona los criterios de aceptacion con reglas, escenarios, componentes previstos y pruebas. Los nombres de archivos de implementacion son propuestas y pueden actualizarse cuando se defina la estructura definitiva del modulo de ventas.

| Criterio | Reglas | Escenarios principales | Implementacion prevista | Pruebas previstas |
| --- | --- | --- | --- | --- |
| CA01 | RN01 | Busqueda por nombre, codigo y barras; exclusion de inactivos | `src/services/ventas.js`, buscador de productos | Busqueda por cada campo y filtro por estado |
| CA02 | RN02, RN05-RN11 | Consulta de precio y stock | Servicio de disponibilidad comercial | Stock del deposito y precio vigente correctos |
| CA03 | RN04, RN18 | Agregar, modificar y quitar | Pagina o componente de venta | Cambios del detalle sin impacto de stock |
| CA04 | RN03 | Cantidad cero, negativa, superior e igual al stock | Validador del detalle | Limites y mensajes de validacion |
| CA05 | RN05-RN10 | Lista vigente, abierta, futura, vencida e inactiva | Funcion/RPC de resolucion de precio | Casos de frontera de las fechas |
| CA06 | RN12-RN15 | Sin ajuste, descuento y recargo | Calculador de precios | Formulas y redondeo a dos decimales |
| CA07 | RN10 | Producto sin detalle de precio | Servicio y pantalla de venta | Bloqueo y mensaje de error |
| CA08 | RN16-RN17 | IVA 21 %, IVA 10,5 %, exento y percepciones | Calculador impositivo | Resultado por tratamiento fiscal |
| CA09 | RN18 | Cambio de cantidad y eliminacion | Calculador de totales | Recalculo de renglon y cabecera |
| CA10 | RN19-RN20 | Cambio posterior de la lista | Confirmacion de venta y persistencia | Inmutabilidad de la venta confirmada |

## Modelo de datos previsto

| Entidad | Responsabilidad minima |
| --- | --- |
| `lista_precio` | Nombre, inicio de vigencia, finalizacion opcional y estado. |
| `detalle_lista_precio` | Producto, precio base, tipo de ajuste y valor del ajuste. |
| `venta` | Fecha, sucursal, deposito, empleado, estado y totales. |
| `detalle_venta` | Producto, cantidad e instantanea completa del precio e impuestos aplicados. |

## Cobertura minima para dar la HU por terminada

- Cada criterio CA01-CA10 posee al menos una prueba verificable.
- RN05-RN10 se validan tambien en la base de datos o en una funcion transaccional, no solamente en la interfaz.
- RN19-RN20 se comprueban modificando una lista despues de confirmar una venta.
- Las pruebas incluyen fechas iguales a `fecha_desde` y `fecha_hasta`.
- Se prueba una lista con `fecha_hasta = null`.
- Se prueba un producto sin stock y otro sin precio vigente.
- Se prueban los tres tratamientos impositivos y los tres tipos de ajuste.
- Los importes se redondean consistentemente a dos decimales.

## Secuencia de implementacion

1. Aprobar `specification.md` y `rules.md` con el equipo.
2. Crear migraciones para `lista_precio` y `detalle_lista_precio`.
3. Cargar una lista general de prueba a partir de los precios actuales de los articulos.
4. Implementar y probar la resolucion del precio vigente.
5. Implementar y probar ajustes, impuestos y redondeo.
6. Crear las entidades de venta y detalle de venta.
7. Construir el buscador y el detalle editable de la venta.
8. Guardar la instantanea comercial al confirmar.
9. Ejecutar todos los escenarios y registrar su resultado.

## Decisiones adoptadas

Las siguientes decisiones definen el alcance inicial de la HU36:

| ID | Decision | Definicion adoptada |
| --- | --- | --- |
| DP01 | ¿El precio de la lista incluye IVA? | Si, precio final al publico; el sistema obtiene el desglose para el comprobante. |
| DP02 | ¿Puede haber mas de una lista general vigente? | No. |
| DP03 | ¿La lista puede depender de la sucursal? | No, en todas las sucursales se manejan los mismos precios. |
| DP04 | ¿Como se cargaran las listas? | La migracion adapta las tablas existentes y se utiliza una pantalla administrativa minima para gestionar las listas. |
| DP05 | ¿Que regla exacta activa las percepciones? | Las percepciones de IVA e IIBB serán ingresadas manualmente por un usuario autorizado. Los importes deben ser mayores o iguales a cero y se incorporarán al total de la venta. El sistema no determinará automáticamente si corresponden ni calculará sus porcentajes durante este sprint. |
