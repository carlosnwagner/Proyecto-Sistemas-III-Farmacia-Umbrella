import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// Cluster nuevo, puerto local, sin credenciales ni conexión a Supabase.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bin = process.env.CAJA_PG_BIN || 'C:/Program Files/PostgreSQL/17/bin';
const port = process.env.CAJA_TEST_PORT || '15433';
const temp = mkdtempSync(join(tmpdir(),'umbrella-caja-tests-'));
const data = join(temp,'data');
const ext = process.platform === 'win32' ? '.exe' : '';
let started = false;
function run(name,args) {
  const r = spawnSync(join(bin,name+ext),args,{ cwd: root, encoding: 'utf8', windowsHide: true, ...(name === 'pg_ctl' ? { stdio: 'ignore' } : {}) });
  if (r.error || r.status !== 0) throw new Error(r.error?.message || r.stderr || r.stdout);
  return (r.stdout || '').trim();
}
const args = ['-h','127.0.0.1','-p',port,'-U','caja_test','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1'];
const sql = query => run('psql',[...args,'-c',query]);
const identity = "set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001'; set role authenticated;";
function concurrent(query) {
  const child = spawn(join(bin,'psql'+ext),[...args,'-c',query],{cwd:root,windowsHide:true});
  let output=''; child.stdout.on('data',d=>{output+=d;}); child.stderr.on('data',d=>{output+=d;});
  return new Promise((ok,fail)=>{ child.on('error',fail); child.on('close',code=>ok({code,output})); });
}
async function waitLock(name) {
  const deadline=Date.now()+10000;
  while(Date.now()<deadline){
    if(sql(`select count(*) from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.application_name='${name}' and l.relation='turno_caja'::regclass and l.mode='RowShareLock' and l.granted;`)==='1') return;
    await new Promise(r=>setTimeout(r,50));
  }
  throw new Error('No se obtuvo bloqueo para la prueba concurrente');
}
try {
  run('initdb',['-D',data,'-U','caja_test','--auth=trust','--encoding=UTF8','--locale=C']);
  run('pg_ctl',['-D',data,'-l',join(temp,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);
  started=true;
  for(const file of ['tests/caja/fixtures.sql','supabase/migrations/202610010001_hu50_movimientos_caja.sql','supabase/migrations/202610010003_hu50_retirar_modo_prueba.sql','supabase/migrations/202610070001_hu51_hu52_hu53_caja_real.sql','tests/caja/acceptance.sql']) run('psql',[...args,'-f',file]);
  console.log('PASS: permisos, saldos, arqueos, invalidación, cierre, motivo, reintentos y reapertura');
  const close=(turn,arqueo,key)=>`select caja_cerrar_turno(${turn},${arqueo},0,'','${key}');`;
  const movement=turn=>`select hu50_registrar_movimiento(${turn},'Ingreso','Concurrente',1,1,gen_random_uuid());`;
  // Movimiento confirma primero: cierre con versión vieja debe fallar.
  const m=concurrent("set application_name='test_mov'; begin; "+identity+movement(2)+' select pg_sleep(1); commit;');
  await waitLock('test_mov');
  const c=concurrent(identity+close(2,3,'30000000-0000-0000-0000-000000000002'));
  let [a,b]=await Promise.all([m,c]); assert.equal(a.code,0,a.output);assert.notEqual(b.code,0);assert.match(b.output,/movimientos/);
  console.log('PASS: movimiento durante confirmación rechaza cierre desactualizado');
  // Cierre confirma primero: movimiento esperando debe fallar.
  const first=concurrent("set application_name='test_close'; begin; "+identity+close(3,4,'30000000-0000-0000-0000-000000000003')+' select pg_sleep(1); commit;');
  await waitLock('test_close');
  [a,b]=await Promise.all([first,concurrent(identity+movement(3))]);assert.equal(a.code,0,a.output);assert.notEqual(b.code,0);assert.match(b.output,/cerrado/);
  console.log('PASS: cierre concurrente impide nuevos movimientos');
  const duplicate=identity+close(4,5,'30000000-0000-0000-0000-000000000004');
  for(const r of await Promise.all([concurrent(duplicate),concurrent(duplicate)]))assert.equal(r.code,0,r.output);
  assert.equal(sql("select count(*) from turno_caja where id=4 and estado='Cerrado'"),'1');
  console.log('PASS: cierres simultáneos con la misma clave son idempotentes');
} finally {
  if(started) run('pg_ctl',['-D',data,'-m','fast','-w','stop']);
  // Solo elimina el directorio exacto generado para este cluster temporal.
  const resolved=realpathSync(temp);
  if(dirname(resolved).toLowerCase() !== realpathSync(tmpdir()).toLowerCase() || !basename(resolved).startsWith('umbrella-caja-tests-')) throw new Error('Ruta temporal inesperada');
  rmSync(resolved,{recursive:true,force:true});
}
