# HU36 - Reglas de negocio de listas de precios

## Cabecera y vigencia

### RN01 - Nombre obligatorio

Toda lista debe poseer un nombre no vacío.

### RN02 - Inicio obligatorio

La fecha de inicio es obligatoria.

### RN03 - Finalización opcional

La fecha final puede ser nula. Cuando se informa, debe ser igual o posterior a la fecha de inicio.

### RN04 - Estado inicial

Toda lista nueva se crea inactiva para permitir su revisión antes de utilizarla.

### RN05 - Estado temporal mostrado

El estado visible se determina de la siguiente manera:

- `Inactiva`: `estado = false`.
- `Programada`: está activa y la fecha actual es anterior al inicio.
- `Vigente`: está activa y la fecha actual pertenece al período.
- `Vencida`: está activa y la fecha actual es posterior a la fecha final.

La fecha final es inclusiva.

### RN06 - Vigencia activa no superpuesta

No pueden existir dos listas activas cuyos períodos compartan al menos una fecha. Una fecha final nula representa un período abierto.

## Productos de la lista

### RN07 - Carga inicial

Al crear la lista se incorporan todos los artículos que cumplan simultáneamente:

- `estado = true`.
- `precio_venta` no nulo.
- `precio_venta > 0`.

### RN08 - Producto único

Un artículo solo puede aparecer una vez dentro de una misma lista.

### RN09 - Precio base al público

El precio base debe ser mayor que cero y representa un precio al público con IVA incluido.

### RN10 - Productos no incluidos

La carga individual solo ofrece artículos que no pertenezcan actualmente a la lista. Un artículo retirado puede reincorporarse.

## Ajustes comerciales

### RN11 - Tipos admitidos

Los ajustes posibles son `Sin ajuste`, `Descuento` y `Recargo`.

### RN12 - Porcentajes válidos

- Los porcentajes no pueden ser negativos.
- `Sin ajuste` exige descuento y recargo iguales a cero.
- No pueden coexistir descuento y recargo.
- El descuento debe ser menor que 100 %.

### RN13 - Precio final

```text
Sin ajuste: precio_final = precio_base
Descuento:  precio_final = precio_base × (1 - descuento / 100)
Recargo:    precio_final = precio_base × (1 + recargo / 100)
```

El precio final se redondea a dos decimales y debe ser mayor que cero.

## Activación

### RN14 - Lista no vacía

Una lista vacía no puede activarse.

### RN15 - Clasificación fiscal completa

Antes de activar una lista, todos sus artículos deben poseer una alícuota configurada entre `21`, `10.5` y `0` para exento en reventa. La clasificación se administra en el artículo, no en la lista.

## IVA y precio al público

### RN16 - IVA incluido

El precio base y el precio final de la lista incluyen el IVA que corresponda. El módulo no adiciona nuevamente la alícuota.

### RN17 - Alícuota informativa

La lista muestra la alícuota del artículo como información de solo lectura. El desglose de neto e IVA pertenece al proceso de venta.

### RN18 - Medicamentos

Como regla simplificada del proyecto, los artículos cuyo código comienza con `MED-` se inicializan con IVA 10,5 %. Un empleado autorizado puede corregir la clasificación a IVA 21 % o exento en reventa cuando el caso particular lo requiera.

### RN19 - Rubros no medicinales

Los artículos de perfumería, cosmética, higiene personal, accesorios y demás códigos que no comiencen con `MED-` se inicializan con la alícuota general del 21 %, sin impedir una corrección autorizada del maestro de artículos.

## Conservación

### RN20 - Baja lógica

Las listas no se eliminan desde la pantalla. Se desactivan y permanecen disponibles para consulta.

### RN21 - Uso externo

Otros módulos deben consultar solamente listas activas cuya vigencia incluya la fecha solicitada. La confirmación de una venta y la conservación de su precio histórico pertenecen a otras historias de usuario.
