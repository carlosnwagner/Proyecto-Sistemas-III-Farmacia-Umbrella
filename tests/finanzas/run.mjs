import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// Base efímera local: no lee .env ni se conecta a Supabase.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bin = process.env.CAJA_PG_BIN || 'C:/Program Files/PostgreSQL/17/bin';
const port = process.env.FINANZAS_TEST_PORT || '15434';
const temp = mkdtempSync(join(tmpdir(), 'umbrella-finanzas-tests-'));
const data = join(temp, 'data');
const ext = process.platform === 'win32' ? '.exe' : '';
let started = false;
function run(name, args) {
  const result = spawnSync(join(bin, name + ext), args, {
    cwd: root, encoding: 'utf8', windowsHide: true,
    ...(name === 'pg_ctl' ? { stdio: 'ignore' } : {}),
  });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout);
}
try {
  run('initdb', ['-D', data, '-U', 'finanzas_test', '--auth=trust', '--encoding=UTF8', '--locale=C']);
  run('pg_ctl', ['-D', data, '-l', join(temp, 'server.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  started = true;
  run('psql', ['-h', '127.0.0.1', '-p', port, '-U', 'finanzas_test', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-f', 'tests/finanzas/sucursal-pago.sql']);
  console.log('PASS: histórico sin asignación, conciliación, sucursal obligatoria/válida/activa, FK y acceso administrador activo.');
  for (const file of ['tests/finanzas/resumen-fixtures.sql', 'tests/finanzas/resumen-acceptance.sql']) {
    run('psql', ['-h', '127.0.0.1', '-p', port, '-U', 'finanzas_test', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-f', file]);
  }
  console.log('PASS: resumen financiero, fechas, deduplicación, reversiones, clasificación, diagnósticos, permisos e idempotencia.');
} finally {
  if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
  const resolved = realpathSync(temp);
  if (dirname(resolved).toLowerCase() !== realpathSync(tmpdir()).toLowerCase() || !basename(resolved).startsWith('umbrella-finanzas-tests-')) {
    throw new Error('Ruta temporal inesperada');
  }
  rmSync(resolved, { recursive: true, force: true });
}
