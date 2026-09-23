# HU36 - Cargar productos y calcular importes

## Historia de usuario

**Como** empleado o cajero,
**para** registrar los articulos solicitados y determinar correctamente el importe a cobrar,
**necesito** buscar productos, agregarlos a la venta y calcular sus importes e impuestos segun la lista de precios vigente.

## Objetivo

Permitir la construccion del detalle de una venta presencial utilizando productos activos, stock disponible y precios temporalmente vigentes, con sus ajustes e impuestos correspondientes.

## Alcance

La HU comprende:

- Busqueda de productos por nombre, codigo interno o codigo de barras.
- Consulta del stock disponible en el deposito de salida.
- Resolucion automatica de la lista de precios aplicable.
- Aplicacion de descuentos o recargos definidos en la lista.
- Alta, modificacion y eliminacion de renglones del detalle de venta.
- Calculo de subtotales, impuestos, percepciones y total.
- Conservacion de los valores comerciales e impositivos al confirmar la venta.

La administracion completa de listas de precios no forma parte de la interaccion del cajero. Para ejecutar esta HU debe existir al menos una lista cargada y activa.

## Precondiciones

- Existe una venta en estado `Borrador`.
- La venta esta asociada a una sucursal y a un deposito.
- El empleado se encuentra habilitado para operar en esa sucursal.
- Existen articulos activos asociados al deposito.
- Existe una lista de precios activa aplicable a la fecha de la venta.
- Los articulos vendibles poseen tratamiento impositivo configurado.

## Flujo principal

1. El empleado busca un producto por nombre, codigo interno o codigo de barras.
2. El sistema muestra solamente productos activos que coinciden con la busqueda.
3. El sistema muestra el stock disponible y el precio vigente del producto.
4. El empleado selecciona el producto e indica una cantidad.
5. El sistema valida que la cantidad sea mayor que cero y no supere el stock disponible.
6. El sistema obtiene el precio desde la lista activa vigente para la fecha de la venta.
7. El sistema aplica el descuento o recargo configurado y calcula el precio final.
8. El sistema calcula el subtotal y los importes impositivos del renglon.
9. El producto se agrega al detalle de la venta.
10. Al modificar cantidades o productos, el sistema recalcula los importes y el total.
11. Al confirmar la venta, se conservan la lista, los precios, los ajustes y las alicuotas utilizados.

## Flujos alternativos

### Producto sin stock suficiente

El sistema rechaza la cantidad, informa el stock disponible y no modifica el detalle.

### Producto sin precio vigente

El sistema informa que el producto no posee un precio vigente y no permite incorporarlo.

### Lista futura, vencida o inactiva

La lista no se considera aplicable. Si no existe otra lista valida, el producto se trata como producto sin precio vigente.

### Lista sin fecha de finalizacion

Una lista con `fecha_hasta = null` permanece temporalmente vigente desde `fecha_desde`, mientras conserve estado `Activa` y no exista una regla de reemplazo que determine otra lista aplicable.

## Criterios de aceptacion

| ID | Criterio |
| --- | --- |
| CA01 | Permite buscar productos por nombre, codigo interno o codigo de barras y muestra unicamente productos activos. |
| CA02 | Para cada producto muestra el precio vigente y el stock disponible en el deposito correspondiente. |
| CA03 | Permite agregar y quitar productos, ademas de modificar sus cantidades antes de confirmar la venta. |
| CA04 | Solo admite cantidades mayores que cero y que no superen el stock disponible. |
| CA05 | El precio se obtiene de una lista de precios activa y vigente para la fecha de la venta; la fecha de finalizacion puede ser opcional. |
| CA06 | La lista puede definir descuentos o recargos, y el sistema calcula y muestra el precio final resultante. |
| CA07 | Si el producto no posee un precio vigente, el sistema informa la situacion y no permite incorporarlo a la venta. |
| CA08 | El sistema calcula los subtotales, el IVA del 21 % o 10,5 %, los importes exentos y las percepciones cuando correspondan. |
| CA09 | El sistema calcula el total de la venta y recalcula automaticamente los importes al modificar productos o cantidades. |
| CA10 | La venta confirmada conserva la lista de precios, el precio base, el ajuste, el precio final y la alicuota aplicados, aunque posteriormente se modifique la lista. |

## Postcondiciones

- El detalle de la venta en borrador refleja los productos y cantidades seleccionados.
- Los importes mostrados corresponden a la lista vigente y al tratamiento impositivo aplicable.
- Agregar o modificar productos no descuenta stock; el egreso se realiza al confirmar la venta.
- Una venta confirmada no depende de los valores actuales de la lista para reconstruir sus importes historicos.

## Fuera de alcance

- Combinacion de varias listas en un mismo renglon.
- Cupones personalizados.
- Precios negociados manualmente por el cajero.
- Descuentos de obras sociales o recetas.
- Modificacion retroactiva de ventas confirmadas.

