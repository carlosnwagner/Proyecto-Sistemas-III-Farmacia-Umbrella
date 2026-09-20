# HU36 - Gestionar listas de precios

## Historia de usuario

**Como** empleado autorizado de la farmacia,
**para** mantener precios de venta consistentes y temporalmente vigentes,
**necesito** crear y administrar listas de precios con productos, descuentos y recargos.

## Objetivo

Disponer de una lista general de precios al público que pueda prepararse, revisarse y activarse para un período determinado. La lista proporciona a otros módulos el precio comercial aplicable, pero no registra ventas ni calcula impuestos de una operación.

## Definición del precio

- `precio_base` es el precio al público antes del descuento o recargo de la lista.
- `precio_final` es el precio al público después del ajuste.
- Ambos importes incluyen el IVA correspondiente al artículo.
- La lista no agrega IVA sobre esos importes ni modifica la alícuota del artículo.
- El artículo debe indicar su tratamiento fiscal: IVA 21 %, IVA 10,5 % o exento en reventa.
- Como valor inicial del proyecto, los códigos `MED-*` reciben 10,5 % y los demás códigos reciben 21 %; la clasificación puede corregirse manualmente.
- El desglose entre neto e IVA corresponde al proceso de venta, fuera de esta HU.

## Alcance

La HU comprende:

- Crear y editar la cabecera de una lista.
- Definir fecha de inicio y fecha final opcional.
- Incorporar automáticamente los artículos activos con precio de venta válido.
- Agregar nuevamente artículos que hayan sido retirados.
- Quitar artículos de una lista en preparación.
- Editar el precio base al público.
- Configurar descuentos o recargos porcentuales.
- Calcular y mostrar el precio final al público.
- Activar y desactivar listas.
- Identificar listas programadas, vigentes, vencidas e inactivas.
- Evitar períodos activos superpuestos.
- Conservar listas anteriores para consulta.
- Mostrar el tratamiento de IVA del artículo como información no editable.

## Precondiciones

- El empleado posee autorización para administrar precios.
- Existen artículos registrados.
- Los artículos que se incorporen automáticamente están activos y poseen `precio_venta > 0`.
- Antes de activar una lista, todos sus artículos poseen tratamiento de IVA definido.

## Flujo principal

1. El empleado selecciona **Nueva lista**.
2. Informa nombre, descripción, fecha de inicio y, opcionalmente, fecha final.
3. El sistema valida las fechas y crea la lista en estado inactivo.
4. El sistema incorpora automáticamente los artículos activos con precio de venta mayor que cero.
5. El empleado revisa los precios base al público y la condición de IVA mostrada.
6. Puede quitar productos, reincorporar productos faltantes o modificar precios.
7. Puede definir para cada artículo un descuento, un recargo o ningún ajuste.
8. El sistema calcula y muestra el precio final al público.
9. El empleado activa la lista.
10. El sistema comprueba que tenga productos, que todos posean tratamiento de IVA y que no se superponga con otra lista activa.

## Flujos alternativos

### Fecha final vacía

La lista queda vigente desde su fecha de inicio hasta que sea desactivada o se establezca una fecha final.

### Fechas inválidas

Si la fecha final es anterior a la inicial, el sistema informa el error y no guarda la lista.

### Lista vacía

La lista puede permanecer inactiva, pero no puede activarse hasta contener al menos un producto.

### Producto sin tratamiento de IVA

El sistema lo identifica como `Sin definir`. La lista puede guardarse en preparación, pero no puede activarse hasta que el artículo sea clasificado desde la administración de productos.

### Vigencia superpuesta

Si la lista que se intenta activar comparte alguna fecha con otra lista activa, el sistema rechaza la activación.

### Producto quitado

El empleado puede reincorporarlo mediante la opción de productos no incluidos. El selector solo ofrece artículos que no estén actualmente en la lista.

## Criterios de aceptación

| ID | Criterio |
| --- | --- |
| CA01 | Permite crear una lista con nombre, fecha de inicio obligatoria y fecha final opcional; la fecha final no puede ser anterior a la inicial. |
| CA02 | Toda lista nueva se crea inactiva e incorpora automáticamente los artículos activos que posean precio de venta mayor que cero. |
| CA03 | Permite editar el precio base al público, quitar productos y reincorporar únicamente productos no incluidos. |
| CA04 | Permite definir `Sin ajuste`, `Descuento` o `Recargo`, valida el porcentaje y calcula el precio final al público. |
| CA05 | Distingue visualmente listas inactivas, programadas, vigentes y vencidas según su estado y período. |
| CA06 | Solo permite activar una lista que contenga al menos un producto y cuyos artículos posean tratamiento de IVA definido. |
| CA07 | Impide que existan dos listas activas con períodos de vigencia superpuestos. |
| CA08 | El precio base y el precio final son mayores que cero; un descuento no puede alcanzar o superar el 100 % y no pueden coexistir descuento y recargo. |
| CA09 | Las listas desactivadas o vencidas permanecen disponibles para consulta y no se eliminan desde la pantalla. |
| CA10 | Muestra el tratamiento de IVA del artículo como dato informativo y considera que los precios de la lista son precios al público con IVA incluido, sin volver a adicionar el impuesto. |

## Postcondiciones

- La lista queda almacenada con su período, estado y detalle de productos.
- Cada detalle conserva precio base, ajuste y precio final.
- Como máximo existe una lista activa aplicable a una fecha determinada.
- Las listas históricas permanecen consultables.
- Otros módulos pueden consultar el precio final de una lista vigente.

## Fuera de alcance

- Crear ventas o administrar su estado.
- Buscar productos para una venta.
- Consultar o descontar stock.
- Calcular neto, IVA, percepciones o total de una venta.
- Registrar clientes o medios de pago.
- Confirmar ventas o emitir comprobantes.
- Modificar la alícuota de IVA desde la lista de precios.
- Mantener un historial de cada edición individual realizada sobre una misma lista.
