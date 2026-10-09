# Corrección de confirmación de venta con caja

Ejecutar en SQL Editor el archivo `supabase/migrations/202610090001_hu69_confirmacion_venta_caja.sql`. Requiere la migración HU51-HU52-HU53 ya aplicada y la función `confirmar_venta_transaccional` que se compartió en el diagnóstico. No ejecutar los fixtures de tests en Supabase.

El frontend ahora llama a `confirmar_venta_caja`, una función con nombre nuevo para evitar la ambigüedad entre las versiones de `confirmar_venta_desde_borrador`. La migración no borra las funciones viejas, pero revoca su ejecución directa a anon y authenticated; cualquier otro cliente que confirme ventas debe actualizar su llamada. La función nueva utiliza internamente la confirmación transaccional existente.

No necesita `sucursal.nombre`: usa el punto de venta de la sucursal, como la función original validada. Guarda venta, detalle, pago, stock y cobro de caja dentro de la misma transacción. El cobro registra el total calculado, no el efectivo entregado antes del vuelto. Resuelve el turno abierto del usuario y sucursal correctos, bloqueándolo mientras confirma. Los movimientos automáticos conservan referencia a venta y activan la invalidación de arqueos instalada previamente.

## Antes de presentar

La cuenta debe tener una sesión válida, usuario activo, vínculo activo en `usuario_auth_caja`, `puede_movimientos=true`, y asignación en `usuario_sucursal_caja`. Tener rol cajero en la interfaz no reemplaza esos permisos. Si falta el vínculo, solicitar al responsable de usuarios que asocie el UUID real al usuario correcto; no habilitar operaciones anónimas.

1. Aplicar la migración nueva y usar el frontend actualizado. No reemplazar solo una línea de la función defectuosa.
2. Abrir un turno en la sucursal donde se hará la venta.
3. Iniciar un borrador nuevo, seleccionar depósito, producto y medio de pago. Un borrador antiguo eliminado por la función anterior no se recupera con esta migración.
4. Confirmar una venta acordada para la presentación. Genera registros reales y descuenta stock.
5. Verificar desde SQL Editor el movimiento con origen Venta, importe igual al total, turno y referencia correctos. La consulta de saldos del frontend sigue teniendo los problemas reportados: esta entrega corrige la confirmación de ventas, no esas pantallas.

## Pruebas realizadas

`node tests/caja/run.mjs`: cluster PostgreSQL temporal, sin conexión a Supabase. Usa la función transaccional del repositorio y un esquema mínimo de ventas compatible con la definición compartida. Verifica pago con vuelto, detalle, descuento único de stock, reintento sin duplicado, turno correcto, stock insuficiente, rechazo sin turno o permisos y rollback de venta/stock si falla el cobro. También ejecuta las pruebas existentes de cierre concurrente de caja. No demuestra compatibilidad con cambios adicionales hechos directamente en la base compartida.

`npm.cmd run build`: compilación correcta. Pendiente: prueba del recorrido con la cuenta y esquema reales en Supabase. No se modificaron registros ni funciones remotas desde Codex.
