# HU36 - Escenarios de aceptación de listas de precios

## CA01 - Crear una lista

### Escenario: fecha final opcional

```gherkin
Dado que el empleado abre una nueva lista
Cuando informa nombre "Lista octubre", inicio 01/10/2026 y deja vacía la fecha final
Entonces el sistema guarda la lista con fecha final nula
Y la lista queda inactiva
```

### Escenario: rango inválido

```gherkin
Dado que el inicio informado es 01/10/2026
Cuando informa como fecha final 30/09/2026
Entonces el sistema rechaza la operación
Y muestra que la fecha final no puede ser anterior al inicio
```

## CA02 - Carga automática

```gherkin
Dado que existen artículos activos con precio de venta positivo
Y también existen artículos inactivos o sin precio válido
Cuando el empleado crea una lista
Entonces el sistema incorpora todos los artículos activos con precio positivo
Y omite los artículos inactivos o sin precio válido
Y mantiene la lista inactiva
```

## CA03 - Administrar productos incluidos

### Escenario: quitar y reincorporar

```gherkin
Dado que un artículo pertenece a la lista
Cuando el empleado lo quita
Entonces deja de aparecer en el detalle
Y aparece entre los productos no incluidos
Cuando el empleado lo selecciona nuevamente
Entonces se reincorpora una sola vez
```

### Escenario: edición de precio base

```gherkin
Dado un artículo con precio base al público de $5.000
Cuando el empleado actualiza el precio base a $5.500
Entonces la lista conserva $5.500 como precio base
Y recalcula su precio final
```

## CA04 - Descuentos y recargos

### Esquema del escenario

```gherkin
Dado un precio base al público de $10.000
Cuando el empleado configura <tipo> por <porcentaje>
Entonces el precio final al público es <precio_final>
```

| tipo | porcentaje | precio_final |
| --- | ---: | ---: |
| Sin ajuste | 0 % | $10.000 |
| Descuento | 10 % | $9.000 |
| Recargo | 10 % | $11.000 |

## CA05 - Estado temporal

### Esquema del escenario

```gherkin
Dada una lista habilitada desde 01/10/2026 hasta 31/10/2026
Cuando la fecha actual es <fecha>
Entonces la pantalla muestra <estado>
```

| fecha | estado |
| --- | --- |
| 30/09/2026 | PROGRAMADA |
| 01/10/2026 | VIGENTE |
| 31/10/2026 | VIGENTE |
| 01/11/2026 | VENCIDA |

### Escenario: desactivación manual

```gherkin
Dada una lista cuya fecha pertenece al período de vigencia
Cuando el empleado la desactiva
Entonces la pantalla muestra INACTIVA
Y deja de ser aplicable
```

## CA06 - Requisitos de activación

### Escenario: lista vacía

```gherkin
Dada una lista sin productos
Cuando el empleado intenta activarla
Entonces el sistema rechaza la activación
```

### Escenario: producto sin IVA definido

```gherkin
Dada una lista con al menos un artículo sin tratamiento de IVA
Cuando el empleado intenta activarla
Entonces el sistema rechaza la activación
Y solicita clasificar los artículos pendientes
```

### Escenario: activación válida

```gherkin
Dada una lista con productos
Y todos poseen tratamiento de IVA definido
Y no existe otra lista activa con vigencia superpuesta
Cuando el empleado la activa
Entonces la lista queda habilitada
```

## CA07 - Vigencia única

```gherkin
Dada una lista activa desde 01/10/2026 hasta 31/10/2026
Cuando el empleado intenta activar otra lista desde 15/10/2026
Entonces el sistema rechaza la activación
Y comunica que ya existe una vigencia activa superpuesta
```

## CA08 - Integridad de precios y ajustes

### Esquema del escenario

```gherkin
Dado el formulario de precio de un artículo
Cuando el empleado intenta guardar <dato_invalido>
Entonces el sistema rechaza la operación
```

| dato_invalido |
| --- |
| precio base igual a cero |
| precio base negativo |
| porcentaje negativo |
| descuento igual o superior a 100 % |
| descuento y recargo simultáneos |

## CA09 - Conservación de listas

```gherkin
Dada una lista vencida o desactivada
Cuando el empleado consulta todas las listas
Entonces la lista continúa disponible con su detalle
Y puede filtrarse por su estado
Y no existe una acción para eliminarla definitivamente
```

## CA10 - IVA incluido e informativo

```gherkin
Dado un artículo clasificado con IVA 21 %
Y un precio base al público de $1.950
Cuando se aplica un descuento del 10 %
Entonces la lista muestra un precio final al público de $1.755
Y muestra "21 %" como IVA incluido
Y no adiciona nuevamente el 21 % al precio final
```

### Escenario: medicamento inicializado

```gherkin
Dado un artículo nuevo cuyo código comienza con "MED-"
Cuando el sistema inicializa su tratamiento fiscal
Entonces asigna IVA 10,5 %
Y permite que un empleado autorizado lo corrija a exento o 21 % cuando corresponda
```

### Escenario: producto no medicinal

```gherkin
Dado un artículo nuevo cuyo código no comienza con "MED-"
Cuando el sistema inicializa su tratamiento fiscal
Entonces asigna IVA 21 %
```
