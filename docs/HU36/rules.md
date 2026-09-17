# HU36 - Reglas de negocio

## Productos y stock

### RN01 - Productos habilitados

Solo pueden buscarse y agregarse articulos cuyo estado sea activo.

### RN02 - Deposito de consulta

El stock se consulta en el deposito de salida asociado a la venta, no como existencia global del articulo.

### RN03 - Cantidad valida

La cantidad debe ser mayor que cero y menor o igual al stock disponible.

### RN04 - Momento del egreso

Agregar un producto a una venta en borrador no modifica el stock. El egreso se genera al confirmar la venta.

## Listas de precios

### RN05 - Estado de la lista

Solo se consideran listas con estado `Activa`.

### RN06 - Inicio de vigencia

`fecha_desde` es obligatoria y la lista solo puede aplicarse cuando:

```text
fecha_desde <= fecha_venta
```

### RN07 - Finalizacion opcional

`fecha_hasta` es opcional. Cuando esta informada, la lista es aplicable si:

```text
fecha_venta <= fecha_hasta
```

Cuando es nula, la lista permanece vigente desde `fecha_desde` mientras este activa.

### RN08 - Coherencia de fechas

Si `fecha_hasta` esta informada, debe ser igual o posterior a `fecha_desde`.

### RN09 - Lista aplicable unica

Para el alcance inicial debe existir una unica lista general aplicable a una fecha. No se permiten vigencias activas ambiguas. Si en el futuro se agregan listas por sucursal o canal, debe definirse expresamente su prioridad.

### RN10 - Producto incluido

El articulo debe poseer un detalle dentro de la lista aplicable. En caso contrario, no tiene precio vigente y no puede incorporarse a la venta.

### RN11 - Precio base

El precio base debe ser mayor que cero.

## Ajustes

### RN12 - Tipos de ajuste

Los tipos admitidos son:

- `Sin ajuste`.
- `Descuento`.
- `Recargo`.

### RN13 - Valor del ajuste

El valor porcentual del ajuste debe ser mayor o igual a cero. Para `Sin ajuste`, el valor debe ser cero.

### RN14 - Calculo del precio final

```text
Sin ajuste: precio_final = precio_base
Descuento:  precio_final = precio_base * (1 - valor_ajuste / 100)
Recargo:    precio_final = precio_base * (1 + valor_ajuste / 100)
```

El precio final debe ser mayor que cero.

### RN15 - Redondeo

Todos los importes monetarios se redondean a dos decimales. El mismo mecanismo de redondeo debe utilizarse en interfaz, servicios y base de datos.

## Impuestos y totales

### RN16 - Tratamientos admitidos

Cada articulo debe indicar uno de los tratamientos previstos por la HU:

- Gravado al 21 %.
- Gravado al 10,5 %.
- Exento, con alicuota 0 %.

### RN17 - Percepciones

Las percepciones de IVA e IIBB serán ingresadas manualmente por un usuario autorizado. Los importes deben ser mayores o iguales a cero y se incorporarán al total de la venta. El sistema no determinará automáticamente si corresponden ni calculará sus porcentajes durante este sprint.

### RN18 - Recalculo

Todo cambio de producto o cantidad debe recalcular el subtotal del renglon y los totales de la venta.

## Conservacion historica

### RN19 - Instantanea comercial

Al confirmar la venta, cada renglon conserva como datos propios:

- Identificador de la lista aplicada.
- Precio base.
- Tipo y valor del ajuste.
- Precio unitario final.
- Alicuota.
- Importes neto, impositivo y subtotal.

### RN20 - Inmutabilidad historica

Una modificacion posterior de la lista o del articulo no debe cambiar los importes de una venta confirmada.

## Restricciones de integridad sugeridas

- Combinacion unica de lista y articulo en el detalle de precios.
- `precio_base > 0`.
- `valor_ajuste >= 0`.
- `fecha_hasta is null or fecha_hasta >= fecha_desde`.
- Alicuota limitada a `0`, `10.5` o `21` para esta HU.
- Cantidad de venta mayor que cero.
