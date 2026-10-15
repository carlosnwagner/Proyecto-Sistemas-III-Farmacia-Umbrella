import test from 'node:test';
import assert from 'node:assert/strict';
import { validarPeriodo, fechaFinanzas } from '../../src/lib/finanzas.js';

test('rechaza fechas inexistentes, formatos inválidos y rangos invertidos', () => {
  for (const [desde, hasta] of [['', '2026-10-01'], ['2026-02-30', '2026-10-01'], ['2026-13-01', '2026-13-02'], ['15/10/2026', '2026-10-31'], ['2026-10-31', '2026-10-01']]) {
    assert.notEqual(validarPeriodo(desde, hasta), '');
  }
});
test('acepta un mismo día, meses completos y años bisiestos', () => {
  assert.equal(validarPeriodo('2026-10-15', '2026-10-15'), '');
  assert.equal(validarPeriodo('2026-10-01', '2026-10-31'), '');
  assert.equal(validarPeriodo('2024-02-29', '2024-02-29'), '');
  assert.notEqual(validarPeriodo('2026-02-29', '2026-03-01'), '');
});
test('muestra fecha efectiva de negocio sin depender de la zona del equipo', () => {
  assert.equal(fechaFinanzas('2026-11-01T02:59:59.999Z'), '31/10/2026');
  assert.equal(fechaFinanzas('2026-11-01T03:00:00Z'), '1/11/2026');
});
