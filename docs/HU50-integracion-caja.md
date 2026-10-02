# HU50: movimientos manuales de caja

## Demostración al profesor sin login

Ejecutar `npm.cmd run dev` en Windows y abrir la URL que indique Vite con
la ruta `/demo/hu50` (normalmente `http://localhost:5173/demo/hu50`).
La demo solo está disponible en desarrollo. Usa el mismo formulario que la
pantalla real y un servicio en memoria, sin consultar ni escribir en Supabase.
Muestra una indicación discreta «Vista de demostración»; al recargar se reinicia
todo. Al desplegar esa indicación aparecen los controles de cierre y reinicio.

Guion sugerido:

1. Mostrar caja y turno de ejemplo con base de $1.000.
2. Registrar ingreso de $200 en efectivo: esperado $1.200.
3. Registrar egreso de $100: esperado $1.100.
4. Intentar egreso de $1.101: rechazo por efectivo insuficiente.
5. Registrar ingreso por tarjeta: cambia su total, conserva efectivo.
6. Revertir el primer ingreso con motivo: queda el original y su reversión;
   efectivo esperado $900.
7. Simular turno cerrado: ya no hay turno disponible para registrar.
8. Reiniciar demo para repetir la presentación.

Esto muestra el avance del flujo de HU50. La autorización real, la persistencia
y la concurrencia deben verificarse con sesión, permisos, turnos y migraciones
en un entorno de prueba; el simulador no demuestra esas garantías del backend.
No se aplicaron migraciones a la base compartida para habilitar esta demo.

Ruta: `/caja/movimientos`. Migración: `202610010001_hu50_movimientos_caja.sql`.
La migración se ejecuta manualmente en Supabase, después de crear `usuario`,
`caja` y `turno_caja` con las columnas compartidas por el equipo de HU49.
No reemplaza ni modifica esas tablas. No implementa apertura ni cierre.

## Estado frente a los criterios de aceptación

| Criterio de Trello | Implementación y validación pendiente |
| --- | --- |
| Usuario autorizado y turno abierto | SQL verifica sesión, usuario activo, permisos, sucursal y cajero del turno. Falta prueba integrada con login/HU49. La demo simula un usuario autorizado. |
| Datos obligatorios y trazabilidad | Formulario y SQL validan tipo, concepto, importe y medio. SQL asigna turno, caja, usuario y fecha/hora. Falta verificar persistencia en el entorno integrado. |
| Efectivo y totales separados | Implementado; comprobado en el simulador. Falta integrar cobros de ventas de HU69 para que el efectivo esperado refleje toda la caja. |
| Egreso limitado al efectivo disponible | Validado en SQL bajo bloqueo del turno y en el simulador. Falta ejecutar la prueba SQL concurrente. |
| Cierre antes de confirmar y duplicados | SQL vuelve a comprobar estado y utiliza clave única de confirmación. Simulador verificado; falta probar cierre concurrente con HU52 y reintentos en Supabase. |
| Correcciones por reversión sin borrar | Implementado con motivo, usuario y referencia al original; acceso directo a las tablas restringido. Simulador verificado; falta comprobar permisos y persistencia en Supabase. |

La pantalla y la demo son avances presentables. No se declara la historia
aceptada hasta completar las pruebas integradas y las dependencias indicadas.

## Login y permisos

La cuenta autenticada se obtiene mediante `auth.uid()`. El backend resuelve su
`usuario.id_usuario` a través de `usuario_auth_caja`. El equipo de login debe
provisionar ese vínculo desde SQL administrativo o un backend privilegiado,
nunca desde el navegador con la clave pública. Debe habilitar `activo` y
`puede_movimientos`, y asignar las sucursales en `usuario_sucursal_caja`.
También se verifica `usuario.estado`. No se usa `user_metadata` para permisos.

Sin una sesión válida no se pueden registrar movimientos; no hay usuario fijo
ni acceso anónimo temporal. La pantalla actual muestra esta situación. El equipo
de HU56 debe proteger la ruta y ajustar el menú según permisos. El backend ya
valida autorización aunque alguien acceda a la URL directamente.

Las RPC son `hu50_contexto_caja`, `hu50_consultar_movimientos` y
`hu50_registrar_movimiento`. Esta última recibe turno, tipo, concepto, importe,
medio de pago, clave UUID y opcionalmente el movimiento original a revertir.
Caja, usuario, fecha y hora se resuelven en el servidor. Una reversión completa
deriva tipo contrario, importe y medio del original; exige un motivo y solo
permite una reversión por movimiento manual, siempre en turno abierto.

## Contrato con HU49, HU52 y HU69

Todas las operaciones que alteren o cierren un turno deben usar
`SELECT ... FROM public.turno_caja WHERE id = ... FOR UPDATE` y comprobar su
estado dentro de la misma transacción. La HU50 ya lo hace. El cierre debe
respetar ese bloqueo para impedir movimientos concurrentes después del cierre.

El efectivo esperado es `turno_caja.saldo_inicial` más los ingresos en efectivo
menos los egresos en efectivo de `movimiento_caja`, incluidas reversiones.
Tarjetas y transferencias se totalizan aparte. El medio histórico se conserva
para que cambiar el nombre del catálogo no cambie saldos anteriores.

La HU69 debe integrar los cobros automáticos en este mismo libro de movimientos,
con `origen = 'Venta'`, dentro de la transacción de confirmación de venta. Debe
agregar una referencia única a venta y resolver sus propios permisos de venta.
Hasta integrar HU69, las ventas actuales no se incluyen en el saldo de caja.
No deben cargarse manualmente para suplir esa integración: produciría duplicados.

La HU51/HU52 debe considerar también las reversiones como movimientos nuevos
cuando verifica si el arqueo sigue vigente. El efectivo recibido y su vuelto
deben resultar en un cobro neto igual al total de la venta.

## Verificación funcional después de conectar login y apertura

1. Usuario sin sesión, inactivo, sin permiso o sin sucursal autorizada: rechazo.
2. Abrir turno con base 1000; ingresar 200 en efectivo: esperado 1200.
3. Egresar 100 en efectivo: esperado 1100. Egresar 1100: esperado 0.
4. Intentar egresar 0, negativo, más del saldo o con más de dos decimales: rechazo.
5. Ingreso por tarjeta/transferencia: no cambia efectivo; cambia su total separado.
6. Repetir una confirmación con su misma UUID: un único movimiento.
7. Reutilizar UUID con otros datos: rechazo.
8. Revertir movimiento manual: conserva original y registra contrario con motivo.
9. Revertir nuevamente o revertir una reversión: rechazo.
10. Cerrar turno y registrar/revertir: rechazo. Consultar conserva el historial.
11. Intentar insertar, editar o borrar directamente con rol authenticated: rechazo.
12. Ejecutar egresos concurrentes: el total nunca debe superar el efectivo.

Las pruebas SQL locales usan un PostgreSQL aislado y fixtures de las dependencias;
no ejecutarlas en el proyecto real de Supabase.
