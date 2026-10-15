# HU61 — Trazabilidad

Implementado y probado localmente. Pendiente: segunda migración y validación funcional en Supabase. SQL: `202610150002_hu61_resumen_financiero.sql`; pantalla: `ResumenFinanciero.jsx`.

| Criterio | Reglas | Escenarios | Implementación y evidencia |
| --- | --- | --- | --- |
| CA01 | RN01–RN02 | E01–E04 | Contexto, validación SQL y lib/finanzas.js; pruebas de mes actual, límites UTC y período inválido. |
| CA02 | RN03 | E05, E20 | Administrador con todas las sucursales según modelo existente; sucursal inválida rechazada. No se incorpora un rol con subconjunto de sucursales. |
| CA03 | RN12–RN13 | E06, E26 | Sumas numeric SQL; centavos y flujo neto verificados. |
| CA04 | RN05–RN07 | E06–E10, E13, E23 | Caja para cobros/operativos; cabecera de pago aplicada; sin filtrar por medio de pago ni turno abierto. |
| CA05 | RN01, RN05–RN06 | E04, E07–E09 | Fecha efectiva de caja o pago; facturas, pedidos y saldos pendientes no son fuente del reporte. |
| CA06 | RN09–RN10 | E12–E13, E17 | Clasificación explícita; prueba de original y reversión interna excluidos, incluso con efectivo. |
| CA07 | RN10–RN11 | E14–E16 | Reversión en fecha propia, con clasificación del original; pruebas entre períodos y de ambas direcciones. |
| CA08 | RN07–RN08 | E09–E11 | Vínculo único al pago; tres aplicaciones no multiplican; operaciones iguales conservan identidad. |
| CA09 | RN13 | E10–E11, E25 | JSON completo y tabla con datos de operación; prueba con 1105 movimientos. |
| CA10 | RN12 | E27 | Etiqueta «Flujo neto del período» y explicación de que no representa ganancia; pendiente revisión visual integrada. |
| CA11 | RN03–RN04 | E05, E19–E20 | RPC verificadas como authenticated/anon; cajero, inactivo y sesión vacía rechazados; funciones internas y tabla privadas. |
| CA12 | RN13, RN15 | E18, E20–E22, E24 | Vacío en cero y diagnósticos probados en SQL; carga/error/reintento y secuencia de solicitudes implementados; pendiente prueba funcional visual. |

## Comandos ejecutados

- `node tests/finanzas/run.mjs`: PostgreSQL temporal, migraciones y aceptación financiera.
- `node --test tests/finanzas/periodo.test.mjs`: validación de fechas, bisiestos y formato en zona de negocio.
- `node tests/caja/run.mjs`: regresión existente de caja/ventas y concurrencia.
- `npm.cmd run build`: compilación de producción; advertencia de tamaño de bundle.
- ESLint de nuevos JS/JSX y archivos modificados de caja: sin hallazgos. RegistrarPagoProveedor conserva un error previo documentado en integration.md.

No se automatizó interacción en navegador ni se ejecutó la segunda migración en Supabase. Los fixtures reproducen las columnas utilizadas, no certifican el esquema desplegado completo.
