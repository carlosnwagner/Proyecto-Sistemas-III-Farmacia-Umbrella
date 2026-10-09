import test from 'node:test';
import assert from 'node:assert/strict';
import { crearConfirmacionMovimiento } from '../../src/lib/confirmacionMovimiento.js';

test('respuesta perdida conserva UUID y bloquea otra operación hasta verificar', async () => {
  let n = 0;
  const confirmar = crearConfirmacionMovimiento(() => `clave-${++n}`);
  const claves = [];
  await assert.rejects(confirmar({ importe: 100 }, async p => {
    claves.push(p.clave); throw new Error('Sin conexión');
  }));
  await assert.rejects(confirmar({ importe: 200 }, async () => assert.fail('No debe enviarse')));
  await confirmar({ importe: 100 }, async p => claves.push(p.clave));
  assert.deepEqual(claves, ['clave-1', 'clave-1']);
  await confirmar({ importe: 100 }, async p => claves.push(p.clave));
  assert.equal(claves[2], 'clave-2');
});

test('rechazo SQL definitivo permite corregir el importe con otra clave', async () => {
  let n = 0;
  const confirmar = crearConfirmacionMovimiento(() => `clave-${++n}`);
  await assert.rejects(confirmar({ importe: 100 }, async () => {
    throw Object.assign(new Error('Saldo insuficiente'), { code: 'P0001' });
  }));
  await confirmar({ importe: 50 }, async p => assert.equal(p.clave, 'clave-2'));
});
