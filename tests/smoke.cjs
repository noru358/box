// 완성본(dist/index.html)을 가짜 화면(3D와 DOM을 흉내 낸 빈 껍데기)에서 돌려,
// 메뉴 → 맵 만들기 → 기록 → 숨는 쪽 한 판 → 찾는 쪽 한 판이 오류 없이 도는지 본다.
// 그림이 제대로 나오는지는 못 본다. 실행: node src/build.mjs && node tests/smoke.cjs
const fs = require('fs');
const path = require('path');
const file = process.argv[2] || path.join(__dirname, '../dist/index.html');
const html = fs.readFileSync(file, 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

function P(name = 'p') {
  const f = function () { return P(name + '()'); };
  return new Proxy(f, {
    get(t, k) { if (k === Symbol.toPrimitive) return () => 0; if (k === 'then') return undefined; if (k === 'length') return 0; if (k in t && k !== 'name') return t[k]; return P(name + '.' + String(k)); },
    set() { return true; }, construct() { return P('new ' + name); }, apply() { return P(name + '()'); },
  });
}
const els = {};
const el = id => els[id] || (els[id] = { id, hidden: false, innerHTML: '', textContent: '', style: {}, value: 'basic', classList: { toggle() {} }, addEventListener() {}, querySelector: () => el('q' + Math.random()), querySelectorAll: () => [], setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }), focus() {}, select() {}, dataset: {} });
global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => P('ctx') }), getElementById: el, querySelectorAll: () => [], activeElement: null };
global.window = global; global.addEventListener = () => {}; global.devicePixelRatio = 1;
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
let raf = [], t = 0;
global.requestAnimationFrame = f => raf.push(f); global.performance = { now: () => t };
global.navigator = {};
const T3 = P('THREE');
global.THREE = new Proxy(T3, { get(o, k) { if (k === 'MathUtils') return { clamp: (v, a, b) => Math.min(Math.max(v, a), b), lerp: (a, b, x) => a + (b - a) * x }; return o[k]; } });
const run = (n, ms = 33) => { for (let i = 0; i < n; i++) { const q = raf; raf = []; t += ms; q.forEach(f => f(t)); } };

let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failed++; };
try {
  (0, eval)(scripts.join('\n;\n'));
  run(5, 16);
  ok(els.panelBox.innerHTML.includes('택배 숨바꼭질'), '메뉴가 뜬다');

  els.bEdit.onclick(); run(10); els.editDone.onclick();
  ok(els.panelBox.innerHTML.includes('공유 문자열'), '맵 만들기 → 공유 문자열 화면');
  els.backEd.onclick(); run(5); els.editDone.onclick(); els.edMenu.onclick();

  els.bRec.onclick(); ok(els.panelBox.innerHTML.includes('기록'), '기록 화면'); els.recBack.onclick();

  els.bHide.onclick(); run(300); els.fakeBtn.onclick && els.fakeBtn.onclick(); run(2400);
  ok(/도장/.test(els.goalL.innerHTML) || /통과|실패/.test(els.panelBox.innerHTML), '숨는 쪽 한 판(80초)이 끝까지 돈다');

  if (els.swap && els.swap.onclick) els.swap.onclick(); else els.bSeek.onclick();
  els.lookBtn.onclick && els.lookBtn.onclick(); run(2400);
  ok(/찾음/.test(els.goalL.innerHTML) || /통과|실패/.test(els.panelBox.innerHTML), '찾는 쪽 한 판(80초)이 끝까지 돈다');
} catch (e) {
  console.log('FAIL 오류로 멈춤: ' + e.stack.split('\n').slice(0, 4).join('\n'));
  failed++;
}
console.log(failed ? `\n${failed}개 실패` : '\n화면 흐름 테스트 전부 통과');
process.exit(failed ? 1 : 0);
