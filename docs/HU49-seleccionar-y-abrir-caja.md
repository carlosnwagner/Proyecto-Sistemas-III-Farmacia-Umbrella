# HU49 – Seleccionar y abrir caja (S4)

## Historia de usuario

**Como** Cajero
**Necesito** seleccionar y abrir una caja con un importe inicial de efectivo
**Para** iniciar mi turno con una base conocida para calcular el saldo.

**Descripción:** Selección de una caja activa de la sucursal y apertura de un turno vinculado a caja, sucursal y cajero.

**Puntos de historia (Fibonacci):** 5 (estimación inicial)

---

## Criterios de aceptación

### CA1 – Acceso y listado de cajas
- Exige sesión iniciada y permiso de apertura.
- Muestra las cajas activas de las sucursales autorizadas para el cajero, con su estado de disponibilidad.

### CA2 – Selección sin reserva
- Permite seleccionar una caja disponible.
- No abre ni reserva un turno hasta que se confirma la apertura.

### CA3 – Validación del importe inicial
- El importe inicial de efectivo es obligatorio.
- Debe ser numérico y mayor o igual a cero.

### CA4 – Confirmación previa
- Antes de confirmar, muestra caja, sucursal e importe inicial.

### CA5 – Registro del turno
- Registra: identificador del turno, caja, sucursal, cajero, fecha y hora de apertura y saldo inicial.
- El turno queda en estado **Abierto**.

### CA6 – Unicidad y concurrencia
- Impide dos turnos abiertos simultáneamente para la misma caja, incluso ante aperturas concurrentes.

### CA7 – Atomicidad ante fallos
- Si falla la apertura, no se crea un turno parcial.
- El importe inicial queda visible en la consulta del turno.

---

## Escenarios (Given / When / Then)

**Escenario 1: Apertura exitosa**
- **Given** un cajero con sesión iniciada y permiso de apertura, y una caja activa y disponible
- **When** selecciona la caja, ingresa un importe inicial válido y confirma
- **Then** se crea un turno en estado Abierto con todos los datos registrados

**Escenario 2: Sin sesión o sin permiso**
- **Given** un usuario sin sesión o sin permiso de apertura
- **When** intenta acceder a la apertura de caja
- **Then** el acceso es rechazado

**Escenario 3: Importe inválido**
- **Given** un cajero en la pantalla de apertura
- **When** deja el importe vacío, ingresa un valor no numérico o un valor negativo
- **Then** se muestra un error de validación y no se abre el turno

**Escenario 4: Caja ya con turno abierto**
- **Given** una caja que ya tiene un turno Abierto
- **When** otro cajero intenta abrirla
- **Then** la apertura es rechazada

**Escenario 5: Aperturas concurrentes**
- **Given** dos cajeros que confirman la apertura de la misma caja al mismo tiempo
- **When** ambas solicitudes se procesan
- **Then** solo una crea el turno y la otra es rechazada

**Escenario 6: Falla en la apertura**
- **Given** un error durante el proceso de apertura
- **When** la operación falla
- **Then** no queda ningún turno parcial creado

---

## Alcance

**Incluye**
- Listado y selección de cajas activas de sucursales autorizadas.
- Ingreso y validación del importe inicial.
- Pantalla de confirmación.
- Creación del turno con control de concurrencia y atomicidad.

**No incluye** (a confirmar)
- Cierre de turno.
- Movimientos de caja, ventas o arqueo.
- Alta y administración de cajas o sucursales.

---

## Notas técnicas para la implementación

> Completar con los datos reales del proyecto antes de pasarle el archivo al agente.

- **Stack:** _(lenguaje, framework, base de datos)_
- **Endpoints / pantallas esperadas:** _(definir)_
- **Modelo de datos del turno:** id, caja_id, sucursal_id, cajero_id, fecha_hora_apertura, saldo_inicial, estado
- **Concurrencia:** garantizar unicidad a nivel de base de datos (por ejemplo, restricción única o índice único parcial sobre caja con estado Abierto) y no solo a nivel de aplicación.
- **Atomicidad:** crear el turno dentro de una única transacción.
- **Permisos:** reutilizar el mecanismo de autenticación y autorización existente.

---

## Definición de terminado

- [ ] Todos los criterios de aceptación cumplidos.
- [ ] Tests unitarios y de integración, incluyendo el caso de concurrencia.
- [ ] Validaciones en frontend y backend.
- [ ] Código acorde a las convenciones del proyecto.
- [ ] Sin regresiones en funcionalidades existentes.

---

## Instrucciones para el agente

1. Leé esta HU completa y el código existente relacionado (sesión, permisos, cajas, sucursales).
2. Antes de escribir código, presentá un plan de implementación y las dudas o supuestos que tengas.
3. Esperá mi aprobación del plan antes de implementar.
4. Implementá respetando la arquitectura y convenciones del proyecto.
5. Incluí tests que cubran los escenarios descritos.
