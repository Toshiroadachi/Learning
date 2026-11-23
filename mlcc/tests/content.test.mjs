// 教材データとコード解読の検証: node tests/content.test.mjs
import assert from 'node:assert/strict';
import { MAT_LESSONS } from '../data/mat-lessons.js';
import { PROC_LESSONS } from '../data/proc-lessons.js';
import { MEAS_LESSONS } from '../data/meas-lessons.js';
import { REL_LESSONS } from '../data/rel-lessons.js';
import { MKT_LESSONS } from '../data/mkt-lessons.js';
import { TERMS } from '../data/terms.js';
import { capCode, tempCode, voltCode, tolCode, sizeCode, fmtSI } from '../js/tools.js';

const all = [...MAT_LESSONS, ...PROC_LESSONS, ...MEAS_LESSONS, ...REL_LESSONS, ...MKT_LESSONS];
const ids = new Set();
let nq = 0;
for (const l of all) {
  assert.ok(!ids.has(l.id), 'id 重複 ' + l.id); ids.add(l.id);
  for (const k of ['title', 'goal', 'body', 'work']) assert.ok(l[k] && l[k].length > (k === 'title' ? 3 : 10), `${l.id}.${k}`);
  assert.ok(l.quiz.length >= 3, l.id + ' quiz');
  for (const q of l.quiz) {
    nq++;
    assert.equal(q.choices.length, 4, `${l.id}: ${q.q}`);
    assert.ok(q.a >= 0 && q.a < 4, `${l.id}: a`);
    assert.equal(new Set(q.choices).size, 4, `${l.id}: 選択肢の重複 ${q.q}`);
    assert.ok(q.exp.length > 10, `${l.id}: exp`);
  }
  // コードブロックが閉じている
  assert.equal((l.body.match(/```/g) || []).length % 2, 0, l.id + ' code fence');
}
const tn = new Set(TERMS.map(t => t.t));
assert.equal(tn.size, TERMS.length, '用語の重複');
for (const t of TERMS) assert.ok(['mat', 'proc', 'meas', 'rel', 'mkt'].includes(t.tr) && t.d && t.en, t.t);

// コード解読
assert.equal(capCode('104').pf, 100000);
assert.equal(capCode('475').pf, 4700000);
assert.equal(capCode('4R7').pf, 4.7);
assert.equal(capCode('R50').pf, 0.5);
assert.equal(capCode('abc').ok, false);
assert.equal(tempCode('X7R').high, 125);
assert.equal(tempCode('x5r').low, -55);
assert.ok(tempCode('Y5V').text.includes('−82'));
assert.ok(tempCode('C0G').text.includes('30 ppm'));
assert.equal(tempCode('Q9R').ok, false);
assert.equal(voltCode('1H').v, 50);
assert.equal(voltCode('0j').v, 6.3);
assert.ok(tolCode('K').text.includes('±10 %'));
assert.ok(sizeCode('0603').text.includes('同じ数字'));
assert.ok(sizeCode('1005').text.includes('1.0×0.5'));
assert.equal(fmtSI(2.5e-6, 'F'), '2.5 µF');
assert.equal(fmtSI(7.12e6, 'Hz'), '7.12 MHz');

// 本文中の計算例の検算
const f0 = 1 / (2 * Math.PI * Math.sqrt(1e-6 * 0.5e-9));
assert.ok(Math.abs(f0 / 1e6 - 7.12) < 0.02, 'SRF 例');
const C = 8.854e-12 * 3000 * 3.2e-7 / 1e-6 * 300;
assert.ok(Math.abs(C * 1e6 - 2.55) < 0.05, '容量の例');
const AF = 8 * Math.exp(1.3 / 8.617e-5 * (1 / 358 - 1 / 423));
assert.ok(AF > 5000 && AF < 5400, '加速係数の例 ' + AF);

console.log(`OK: レッスン ${all.length}・クイズ ${nq}・用語 ${TERMS.length}`);
