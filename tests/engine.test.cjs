// 엔진만 돌리는 테스트(브라우저 없음). 실패하면 이유를 찍고 종료 코드 1.
// 실행: node tests/engine.test.cjs
const E = require('../src/engine.js');
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failed++; };

function fill(w) { const n = w.tiles.flat().filter(Boolean).length; for (let i = 0; i < Math.round(n * .42); i++) w.add('npc'); }

// 1. 맵마다 상자가 막히지 않고 계속 흐르고 출고된다(색 켬·끔 둘 다)
for (const k of Object.keys(E.MAPS)) for (const colors of [true, false]) {
  const w = E.createWorld(E.MAPS[k].str, { colors }); fill(w);
  const sig = E.signalAI(E.DIFF.normal);
  let del = 0;
  for (let i = 0; i < 120 * 30; i++) { sig(w, 1 / 30); w.step(1 / 30); del += w.events.filter(e => e.type === 'deliver').length; w.events = []; }
  const p0 = w.boxes.map(b => w.pos(b));
  for (let i = 0; i < 300; i++) { sig(w, 1 / 30); w.step(1 / 30); w.events = []; }
  const moved = w.boxes.filter((b, i) => { const p = w.pos(b); return Math.hypot(p[0] - p0[i][0], p[1] - p0[i][1]) > .5; }).length;
  const tag = `${k}${colors ? '' : '(색 끔)'}`;
  ok(del > 50, `${tag}: 120초 동안 출고 ${del}회 (50회 넘어야 함)`);
  ok(moved >= w.boxes.length * .7, // 정체 칸 맵은 가끔 .8 아래로 떨어져서 .7
    `${tag}: 10초 동안 움직인 상자 ${moved}/${w.boxes.length}`);
}

// 2. 맵 문자열을 읽고 다시 쓰면 같은 맵이 된다(공유 문자열)
for (const k of Object.keys(E.MAPS)) {
  const s = E.MAPS[k].str;
  ok(E.mapToStr(E.parseMap(E.mapToStr(E.parseMap(s)))) === E.mapToStr(E.parseMap(s)), `${k}: 공유 문자열 왕복`);
}

// 3. 빨간불이 켜지는 순간 레일 사이에 걸친 사람 상자는 'frozen'이 난다
{
  const w = E.createWorld(E.MAPS.basic.str); for (let i = 0; i < 10; i++) w.add('npc');
  const p = w.add('player');
  let hopped = null;
  for (let i = 0; i < 300 && !hopped; i++) { w.step(1 / 30); w.events = []; for (const h of [(p.d + 1) % 4, (p.d + 3) % 4]) { if (!hopped) hopped = w.hop(p, h); } }
  w.setLight('yellow'); w.setLight('red');
  ok(!!hopped && w.events.some(e => e.type === 'frozen' && e.b === p), '넘어가는 도중 빨간불이면 걸림(frozen)');
  w.events = [];
  const r = w.hop(p, (p.d + 1) % 4) || w.hop(p, (p.d + 3) % 4);
  ok(!r || w.events.some(e => e.type === 'thud' && e.off), '빨간불 중에 움직이면 off 덜컹');
}

// 4. 제한 시간 보정이 말이 되는 범위다(도장 4개, 모범 플레이 기준 초)
for (const k of Object.keys(E.MAPS)) for (const colors of [true, false]) {
  const c = E.calibrate(E.MAPS[k].str, { colors });
  ok(c > 8 && c < 200, `${k}${colors ? '' : '(색 끔)'}: 보정값 ${c.toFixed(1)}초`);
}

// 6. 색 끔: 일반 상자는 초록 때 옆으로 옮기고(한 초록에 한 번까지), 빨강 순간 걸리는 일반 상자(미끼)가 생긴다
{
  let hops = 0, greens = 0, frozen = 0, reds = 0, twice = 0;
  const w = E.createWorld(E.MAPS.plain.str, { colors: false }); fill(w);
  const sig = E.signalAI(E.DIFF.normal); const seen = new Map();
  for (let i = 0; i < 30 * 120; i++) {
    sig(w, 1 / 30); w.step(1 / 30);
    for (const e of w.events) {
      if (e.type === 'light' && e.s === 'green') { greens++; seen.clear(); }
      if (e.type === 'light' && e.s === 'red') reds++;
      if (e.type === 'frozen') frozen++;
      if (e.type === 'thud' && w.light === 'green') { hops++; if (seen.has(e.b)) twice++; seen.set(e.b, 1); }
    }
    w.events = [];
  }
  ok(hops / greens > 3, `색 끔: 초록 한 번에 옮긴 일반 상자 ${(hops / greens).toFixed(1)}개`);
  ok(twice === 0, '색 끔: 한 초록에 같은 상자가 두 번 옮기지 않음');
  ok(frozen / reds > .1, `색 끔: 빨강 한 번에 걸린 상자 ${(frozen / reds).toFixed(2)}개`);
}

// 5. 다음 도장은 지금 레일과 다른 레일에 뜬다
{
  const w = E.createWorld(E.MAPS.basic.str); const p = w.add('player');
  let same = 0; for (let i = 0; i < 50; i++) { const s = E.nextStamp(w, p); if (s && s[1] === p.cy) same++; }
  ok(same === 0, '다음 도장은 다른 레일');
}

// 7. 도장은 화면에 보이는 위치로 찍힌다: 옆 레일로 넘어가는 0.38초 동안은 안 찍힘
{
  let tested = false;
  for (let tries = 0; tries < 30 && !tested; tries++) {
  const w = E.createWorld(E.MAPS.plain.str, { colors: false });
  const p = w.add('player');
  for (let i = 0; i < 600 && !tested; i++) {
    w.step(1 / 60); w.events = [];
    if (w.midMove(p) || p.s > .3 || p.cx < 1 || p.cx > w.W - 3) continue;
    for (const h of [(p.d + 1) % 4, (p.d + 3) % 4]) {
      const nx = p.cx + E.DX[h], ny = p.cy + E.DY[h], t = w.T(nx, ny);
      if (!t || t.t !== 'belt' || t.d !== p.d) continue;
      const stamp = [nx + E.DX[p.d], ny]; // 한 칸 앞, 옆 레일
      if (!w.hop(p, h)) continue;
      const now = E.onStamp(w, p, stamp);
      let later = false; for (let k = 0; k < 30; k++) { w.step(1 / 60); w.events = []; if (E.onStamp(w, p, stamp)) later = true; }
      ok(!now && later, `도장: 넘어간 순간엔 안 찍히고(${now}), 미끄러져 다 오면 찍힘(${later})`);
      tested = true; break;
    }
  }
  }
  ok(tested, '도장 판정 시험 상황을 만들었다');
}

// 8. 벨트 정지(시험 갈래): 빨강이면 일반 상자는 NPC_LAG 안에 서고, 계속 가는 사람 상자는 GRACE 뒤 걸림, 멈춘 사람은 안 걸림
{
  const w = E.createWorld(E.MAPS.plain.str, { colors: false, beltStop: true }); fill(w);
  const a = w.add('player'), b = w.add('player'); a.go = true; b.go = true;
  for (let i = 0; i < 60; i++) { w.step(1 / 60); w.events = []; }
  w.setLight('yellow'); w.setLight('red'); w.events = [];
  b.go = false;
  const npcs = w.boxes.filter(x => x.kind === 'npc'); let p0 = null, late = [];
  for (let i = 0; i < 60; i++) {
    w.step(1 / 60);
    if (Math.abs(w.lightT - (E.NPC_LAG + .05)) < 1 / 120 || (!p0 && w.lightT > E.NPC_LAG + .05)) p0 = p0 || npcs.map(x => w.pos(x));
    late.push(...w.events.filter(e => e.type === 'frozen' && e.late).map(e => e.b)); w.events = [];
  }
  const moved = npcs.filter((x, i) => { const q = w.pos(x); return Math.hypot(q[0] - p0[i][0], q[1] - p0[i][1]) > .02; }).length;
  ok(moved === 0, `벨트 정지: 빨강 ${E.NPC_LAG + .05}초 뒤 움직인 일반 상자 ${moved}개`);
  ok(late.includes(a) && !late.includes(b), '벨트 정지: 계속 간 사람은 걸리고, 뗀 사람은 안 걸림');
}

console.log(failed ? `\n${failed}개 실패` : '\n엔진 테스트 전부 통과');
process.exit(failed ? 1 : 0);
