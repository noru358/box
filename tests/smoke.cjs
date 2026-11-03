// 완성본(dist/index.html)을 가짜 화면(3D와 DOM을 흉내 낸 빈 껍데기)에서 돌려,
// 메뉴 → (맵 만들기 → 기록) → 숨는 쪽 한 판 → 찾는 쪽 한 판이 오류 없이 도는지 본다.
// 기본은 지금 판(덜어낸 스위치 그대로). --full을 붙이면 FEAT 스위치를 전부 켠 판으로 돈다.
// 그림이 제대로 나오는지, 손맛은 못 본다. 실행: node src/build.mjs && node tests/smoke.cjs [--full]
const fs = require('fs');
const path = require('path');
const full = process.argv.includes('--full');
const file = process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(__dirname, '../dist/index.html');
let html = fs.readFileSync(file, 'utf8');
if (full) {
  const m = html.match(/const FEAT=\{[^}]*\}/);
  if (!m) { console.log('FAIL FEAT 스위치를 못 찾음'); process.exit(1); }
  html = html.replace(m[0], m[0].replace(/false/g, 'true'));
}
console.log(full ? '[스위치 다 켠 판]' : '[지금 판]');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

function P(name = 'p') {
  const f = function () { return P(name + '()'); };
  return new Proxy(f, {
    get(t, k) { if (k === Symbol.toPrimitive) return () => 0; if (k === 'then') return undefined; if (k === 'length') return 0; if (k in t && k !== 'name') return t[k]; return P(name + '.' + String(k)); },
    set() { return true; }, construct() { return P('new ' + name); }, apply() { return P(name + '()'); },
  });
}
const els = {};
const el = id => els[id] || (els[id] = { id, hidden: false, innerHTML: '', textContent: '', style: {}, value: 'basic', classList: { toggle() {} }, addEventListener(t, f) { ((this.h = this.h || {})[t] = this.h[t] || []).push(f); }, fire(t, e) { (this.h && this.h[t] || []).forEach(f => f(e)); }, querySelector: () => el('q' + Math.random()), querySelectorAll: () => [], setPointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }), focus() {}, select() {}, dataset: {} });
const docH = {};
global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => P('ctx') }), getElementById: el, querySelectorAll: () => [], activeElement: null, addEventListener(t, f) { (docH[t] = docH[t] || []).push(f); }, fire(t, e) { (docH[t] || []).forEach(f => f({ target: { closest: () => null }, ...e })); } };
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

  if (full) {
    els.bEdit.onclick(); run(10); els.editDone.onclick();
    ok(els.panelBox.innerHTML.includes('공유 문자열'), '맵 만들기 → 공유 문자열 화면');
    els.backEd.onclick(); run(5); els.editDone.onclick(); els.edMenu.onclick();
    els.bRec.onclick(); ok(els.panelBox.innerHTML.includes('기록'), '기록 화면'); els.recBack.onclick();
  } else {
    ok(!els.panelBox.innerHTML.includes('bEdit') && !els.panelBox.innerHTML.includes('bRec') && !els.panelBox.innerHTML.includes('mapSel'), '덜어낸 판: 맵 만들기·기록·맵 선택이 메뉴에 없음');
  }

  // 상자가 옮길 수 있는 상태가 될 때까지(넘어가는 중 아님, 양 끝 출고·입고 칸 아님) 한 프레임씩
  const ready = () => { for (let i = 0; i < 600; i++) { const B = global.__box, p = B.player; if (B.over) return false; if (p && !p.pending && !B.world.midMove(p) && p.cx >= 1 && p.cx <= B.world.W - 3) return true; run(1); } return false; };
  // 스와이프 한 번 = 옆 레일로 한 번 (터치 조작). 찍혀서 판이 끝나면 다시 시작
  els.bHide.onclick(); run(20); for (let k = 0; k < 5 && !ready(); k++) { if (global.__box.over) els.again.onclick(); run(5); }
  {
    const B = global.__box, p = B.player, cy0 = p.cy, up = cy0 > 1;
    const c = global.document, e0 = { pointerId: 7, pointerType: 'touch', button: 0, clientX: 480, clientY: 270 };
    c.fire('pointerdown', e0);
    c.fire('pointermove', { ...e0, clientY: 270 + (up ? -10 : 10) });
    const before = p.cy;
    c.fire('pointermove', { ...e0, clientY: 270 + (up ? -40 : 40) });
    const after = p.cy;
    c.fire('pointermove', { ...e0, clientY: 270 + (up ? -90 : 90) });
    c.fire('pointerup', { ...e0, clientY: 270 + (up ? -90 : 90) });
    ok(before === cy0 && after === cy0 + (up ? -1 : 1) && p.cy === after, `스와이프: 10px는 무시, 40px에 한 줄 이동, 한 번 밀기에 한 번만 (${cy0}→${p.cy})`);
  }
  // 톡 누르기: 가짜 화면에선 내 상자가 화면 한가운데(y=270)로 잡히므로, 그보다 위를 누르면 위 레일
  // 빨간불이면 미끄러지던 상자가 멈춰 있으므로, 다 넘어갈 때까지 기다린다
  for (let k = 0; k < 5 && !ready(); k++) { if (global.__box.over) els.again.onclick(); run(5); }
  {
    const B = global.__box, p = B.player, cy0 = p.cy, up = cy0 > 1, c = global.document;
    const e1 = { pointerId: 8, pointerType: 'touch', button: 0, clientX: 300, clientY: up ? 120 : 420 };
    c.fire('pointerdown', e1); c.fire('pointerup', e1);
    ok(p.cy === cy0 + (up ? -1 : 1), `톡 누르기: 내 상자보다 ${up ? '위' : '아래'}를 누르면 그쪽 레일로 (${cy0}→${p.cy})`);
    ready();
    const cy1 = p.cy, e2 = { pointerId: 9, pointerType: 'mouse', button: 0, clientX: 300, clientY: up ? 420 : 120 };
    c.fire('pointerdown', e2); c.fire('pointerup', e2);
    ok(p.cy === cy1, '마우스 클릭은 레일을 옮기지 않음(PC는 키보드)');
  }
  // 기다리는 사이 직원에게 찍혀 판이 끝났을 수도 있다
  if (!global.__box.over) { els.pauseBtn.onclick(); els.quit.onclick(); } else els.toMenu.onclick();

  els.bHide.onclick(); run(300); els.fakeBtn.onclick && els.fakeBtn.onclick(); run(2400);
  ok(/도장/.test(els.goalL.innerHTML) || /통과|실패/.test(els.panelBox.innerHTML), '숨는 쪽 한 판(80초)이 끝까지 돈다');

  {
    const H = global.__box.human;
    ok(H.plays >= 1 && H.windows >= 1, `사람 기록: 숨는 쪽 한 판이 끝나면 기록이 남는다 (${H.plays}판, 초록 ${H.windows}번)`);
  }
  if (els.swap && els.swap.onclick) els.swap.onclick(); else els.bSeek.onclick();
  {
    const B = global.__box, n = B.world.boxes.filter(b => !b.gone).length;
    ok(n <= 17, `찾는 쪽 상자 수 ${n}개 (17개 이하)`);
  }
  els.lookBtn.onclick && els.lookBtn.onclick(); run(2400);
  ok(/찾음/.test(els.goalL.innerHTML) || /통과|실패/.test(els.panelBox.innerHTML), '찾는 쪽 한 판(80초)이 끝까지 돈다');
  {
    const bots = global.__box.bots;
    ok(bots.length === 3 && bots.every(b => Array.isArray(b.plan) && (b.src === 'synth' || b.src === 'human')), `숨은 셋이 창(초록마다 계획)으로 움직인다 (${bots.map(b => b.src).join(',')})`);
  }
} catch (e) {
  console.log('FAIL 오류로 멈춤: ' + e.stack.split('\n').slice(0, 4).join('\n'));
  failed++;
}
console.log(failed ? `\n${failed}개 실패` : '\n화면 흐름 테스트 전부 통과');
process.exit(failed ? 1 : 0);
