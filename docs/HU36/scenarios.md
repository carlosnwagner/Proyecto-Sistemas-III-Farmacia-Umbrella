# HU36 - Escenarios de aceptacion

Los escenarios utilizan formato Gherkin y constituyen la base de las pruebas funcionales y automatizadas.

## CA01 - Buscar productos activos

```gherkin
Escenario: Buscar un producto activo por nombre
  Dado que existe un articulo activo llamado "Ibuprofeno 400 mg"
  Cuando el empleado busca "Ibuprofeno"
  Entonces el sistema muestra el articulo

Esquema del escenario: Buscar por identificador
  Dado que existe un articulo activo con <campo> igual a <valor>
  Cuando el empleado busca <valor>
  Entonces el sistema muestra el articulo

  Ejemplos:
    | campo            | valor         |
    | codigo interno   | IBU-400       |
    | codigo de barras | 7790000000001 |

Escenario: No mostrar un producto inactivo
  Dado que existe un articulo inactivo que coincide con la busqueda
  Cuando el empleado realiza la busqueda
  Entonces el sistema no muestra el articulo
```

## CA02 - Mostrar precio y stock

```gherkin
Escenario: Consultar disponibilidad comercial
  Dado un articulo activo asociado al deposito de salida
  Y que posee 12 unidades disponibles
  Y que posee un precio vigente de $5.000
  Cuando el empleado selecciona el articulo
  Entonces el sistema muestra un stock disponible de 12 unidades
  Y muestra un precio de $5.000
```

## CA03 - Gestionar el detalle

```gherkin
Escenario: Agregar, modificar y quitar un producto
  Dada una venta en estado Borrador
  Cuando el empleado agrega un producto con cantidad 1
  Entonces el producto aparece en el detalle
  Cuando modifica su cantidad a 2
  Entonces el detalle muestra cantidad 2
  Cuando quita el producto
  Entonces el producto deja de aparecer en el detalle
```

## CA04 - Validar cantidades

```gherkin
Esquema del escenario: Rechazar una cantidad invalida
  Dado un articulo con 10 unidades disponibles
  Cuando el empleado ingresa la cantidad <cantidad>
  Entonces el sistema rechaza la cantidad
  Y no modifica el detalle de la venta

  Ejemplos:
    | cantidad |
    | 0        |
    | -1       |
    | 11       |

Escenario: Aceptar una cantidad disponible
  Dado un articulo con 10 unidades disponibles
  Cuando el empleado ingresa la cantidad 10
  Entonces el sistema agrega el producto con cantidad 10
```

## CA05 - Resolver la vigencia

```gherkin
Escenario: Aplicar una lista dentro de su vigencia
  Dada una lista activa vigente desde el 01/09/2026 hasta el 30/09/2026
  Y una venta con fecha 17/09/2026
  Cuando el sistema determina el precio
  Entonces utiliza esa lista

Escenario: Aplicar una lista sin fecha de finalizacion
  Dada una lista activa vigente desde el 01/09/2026
  Y sin fecha de finalizacion
  Y una venta con fecha 17/10/2026
  Cuando el sistema determina el precio
  Entonces utiliza esa lista

Esquema del escenario: Ignorar una lista no aplicable
  Dada una lista con <condicion>
  Y una venta con fecha 17/09/2026
  Cuando el sistema determina el precio
  Entonces no utiliza esa lista

  Ejemplos:
    | condicion                              |
    | estado Inactiva                        |
    | fecha de inicio posterior a la venta   |
    | fecha de finalizacion anterior         |
```

## CA06 - Aplicar descuentos y recargos

```gherkin
Esquema del escenario: Calcular un ajuste porcentual
  Dado un producto con precio base de $10.000
  Y un <tipo> del <porcentaje> por ciento
  Cuando el sistema calcula el precio final
  Entonces obtiene <precio_final>

  Ejemplos:
    | tipo      | porcentaje | precio_final |
    | Descuento | 10         | $9.000       |
    | Recargo   | 5          | $10.500      |
    | Sin ajuste| 0          | $10.000      |
```

## CA07 - Producto sin precio vigente

```gherkin
Escenario: Impedir agregar un producto sin precio
  Dado un producto activo con stock disponible
  Pero sin un detalle en una lista vigente
  Cuando el empleado intenta agregarlo
  Entonces el sistema informa "El producto no posee un precio vigente"
  Y no incorpora el producto a la venta
```

## CA08 - Calcular impuestos

```gherkin
Esquema del escenario: Aplicar el tratamiento impositivo
  Dado un producto con precio final de $1.000
  Y tratamiento impositivo <tratamiento>
  Cuando el sistema calcula el renglon
  Entonces aplica la alicuota <alicuota>

  Ejemplos:
    | tratamiento       | alicuota |
    | Gravado general   | 21       |
    | Gravado reducido  | 10.5     |
    | Exento            | 0        |

Escenario: Incorporar percepciones ingresadas manualmente
  Dado que un usuario autorizado ingresa $100 de percepcion de IVA
  Y $50 de percepcion de IIBB
  Cuando el sistema calcula la venta
  Entonces agrega $150 al total

Escenario: Rechazar una percepcion negativa
  Cuando un usuario autorizado ingresa una percepcion menor que cero
  Entonces el sistema rechaza el importe
```

## CA09 - Calcular y recalcular totales

```gherkin
Escenario: Recalcular al modificar la cantidad
  Dado un producto agregado con precio final de $2.000 y cantidad 1
  Cuando el empleado modifica la cantidad a 3
  Entonces el subtotal del renglon es $6.000
  Y el total de la venta se recalcula

Escenario: Recalcular al quitar un producto
  Dada una venta con dos productos
  Cuando el empleado quita uno de ellos
  Entonces el total deja de incluir el subtotal del producto eliminado
```

## CA10 - Conservar los valores aplicados

```gherkin
Escenario: Conservar el precio historico
  Dada una venta confirmada con precio base de $10.000
  Y un descuento del 10 por ciento
  Y un precio final de $9.000
  Cuando posteriormente el precio de la lista cambia a $12.000
  Entonces la venta conserva el precio base de $10.000
  Y conserva el descuento del 10 por ciento
  Y conserva el precio final de $9.000
  Y conserva la alicuota aplicada
```

## Escenarios tecnicos complementarios

```gherkin
Escenario: No descontar stock en un borrador
  Dado un producto agregado a una venta en estado Borrador
  Cuando se consulta el stock del deposito
  Entonces el stock fisico no fue modificado

Escenario: Rechazar una vigencia incoherente
  Cuando se intenta guardar una lista cuya fecha de finalizacion es anterior a la fecha de inicio
  Entonces el sistema rechaza la operacion

Escenario: Evitar precios duplicados en la misma lista
  Dado un producto incluido en una lista
  Cuando se intenta incluir nuevamente el mismo producto en esa lista
  Entonces el sistema rechaza la operacion
```
