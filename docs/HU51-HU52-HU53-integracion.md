# Caja real: arqueo, cierre y consulta

Implementación basada en los criterios de Grupo06_Backlog_Sprint4.xlsx y en el esquema compartido el 6 de octubre. Los cambios están en el código; todavía no fueron ejecutados en la base compartida.

## Qué ejecutar en Supabase

En SQL Editor, ejecutar **solamente** el contenido de:

`supabase/migrations/202610070001_hu51_hu52_hu53_caja_real.sql`

Está preparada para la base diagnosticada, donde HU50 ya está instalada. No volver a ejecutar las migraciones iniciales de HU50 ni la antigua apertura de HU49. La nueva migración agrega columnas y funciones, conserva los registros existentes y trabaja en una transacción. Revoca las escrituras directas de los roles anon y authenticated: las operaciones pasan por funciones que verifican sesión y permisos. Los arqueos anteriores siguen en el historial, pero hace falta uno nuevo para cerrar porque no tienen una versión verificable del saldo. Los cierres anteriores no adquieren automáticamente un resumen histórico.

No concede acceso anónimo a movimientos, arqueos ni cierres. Conserva las lecturas de caja y turno que ya estaban permitidas en esta base para mostrar datos reales sin login. Revisar esos permisos de lectura junto con la integración del login si se requiere ocultar también esos datos.

## Cuenta y permisos

Hace falta una sesión de Supabase Auth y un vínculo administrativo entre su UUID y `usuario.id_usuario`. El usuario debe estar activo y tener la sucursal asignada en `usuario_sucursal_caja`. Las nuevas columnas de permisos comienzan en false.

Primero comprobar desde SQL Editor que el usuario 14 está vinculado a la cuenta correcta:

```sql
select auth_id, usuario_id, activo, puede_movimientos,
       puede_apertura, puede_arqueo, puede_cierre, puede_consultar
from public.usuario_auth_caja where usuario_id = 14;
select * from public.usuario_sucursal_caja where usuario_id = 14;
```

Si ese vínculo y la sucursal 5 corresponden al cajero que debe operar el turno 5, habilitar los permisos necesarios:

```sql
update public.usuario_auth_caja
set puede_apertura = true, puede_arqueo = true,
    puede_cierre = true, puede_consultar = true
where usuario_id = 14 and activo = true;
```

Esto no crea una cuenta ni inicia sesión. Si la consulta no encuentra el vínculo, el equipo de autenticación debe crearlo con el UUID real de la cuenta. No usar un UUID inventado ni claves privilegiadas en el navegador. HU50 conserva su permiso independiente `puede_movimientos`.

## Pantallas y criterios

El menú lateral conserva el apartado Caja:

- `/caja/arqueo`: esperado calculado en servidor, contado validado, diferencia y clasificación, historial, usuario y hora reales. No altera el saldo. Todo movimiento nuevo, incluidas reversiones, invalida los arqueos anteriores.
- `/caja/cierre`: exige permiso, turno propio abierto y último arqueo vigente; muestra los totales, exige motivo si hay diferencia, registra el resumen de cierre y libera la caja. Verifica nuevamente la versión del saldo al confirmar. Un reintento con la misma clave devuelve el mismo cierre.
- `/turnos-caja`: caja, sucursal, cajero, fechas, estado, base, saldos separados e historial real; filtros por caja, período, tipo y medio. Conserva el original y su reversión. Muestra origen y referencia de venta cuando están registrados.

**HU51:** criterios implementados y probados localmente; falta validación con sesión y permisos reales en Supabase.

**HU52:** flujo de cierre implementado y probado localmente. El libro de caja rechaza movimientos de turnos cerrados. El criterio de impedir la confirmación de ventas depende además de HU69: esta entrega no modifica la transacción de ventas ni garantiza que una venta sin integración al libro sea rechazada.

**HU53:** consulta conectada a registros reales y resumen de cierre. La inclusión automática de cobros y sus referencias depende de HU69. La nueva columna `referencia_venta` permite mostrarlas, pero no genera esos cobros.

La pantalla de login no está implementada aquí. Sin sesión se ven caja, turno y base inicial reales, pero no se simula un saldo ni se habilitan operaciones protegidas. La apertura existente todavía obtiene su usuario del helper local de HU49; el servidor ahora exige que coincida con el usuario autenticado. El equipo de login debe reemplazar ese helper antes de habilitar apertura para otros usuarios.

## Verificación

`npm.cmd run build` y ESLint de los componentes nuevos pasan. Para las pruebas de base:

```powershell
node tests/caja/run.mjs
```

Requiere PostgreSQL 17 instalado. Se puede configurar `CAJA_PG_BIN` y `CAJA_TEST_PORT`. El ejecutor crea una base temporal en localhost, usa datos propios y la elimina al terminar; no lee credenciales de Supabase ni se conecta al proyecto compartido. Los fixtures no deben ejecutarse en Supabase.

Se verifican permisos, saldo inicial sumado una sola vez, medios separados, validación del contado, historial e invalidación, motivo obligatorio, resumen conservado, reapertura y reintentos. Las pruebas concurrentes verifican movimiento durante cierre, movimiento después de cierre y dos confirmaciones simultáneas del mismo cierre.

Después de aplicar SQL y conectar la sesión, repetir el recorrido desde la interfaz con el usuario autorizado. Hasta entonces las HU no deben marcarse como aceptadas en el entorno integrado.
