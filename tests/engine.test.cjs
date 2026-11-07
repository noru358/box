// 엔진만 돌리는 테스트(브라우저 없음). 실패하면 이유를 찍고 종료 코드 1.
// 실행: node tests/engine.test.cjs
const E = require('../src/engine.js');
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failed++; };

// 분기 칸 없는 네 줄 맵(일반 상자가 아무 데서나 옆으로 가는 규칙 시험용). 맵 만들기에서 분기 칸을 안 놓은 맵과 같다
const PLAIN = E.laneMap([{ d: '>' }, { d: '<' }, { d: '>' }, { d: '>' }]);
function fill(w) { const n = w.tiles.flat().filter(Boolean).length; for (let i = 0; i < Math.round(n * .42); i++) w.add('npc'); }

// 1. 맵마다(분기 칸 없는 맵 포함) 상자가 막히지 않고 계속 흐르고 출고된다
for (const [k, str] of [...Object.entries(E.MAPS).map(([k, m]) => [k, m.str]), ['plain', PLAIN]]) {
  const w = E.createWorld(str); fill(w);
  const sig = E.signalAI(E.DIFF.normal);
  let del = 0;
  for (let i = 0; i < 120 * 30; i++) { sig(w, 1 / 30); w.step(1 / 30); del += w.events.filter(e => e.type === 'deliver').length; w.events = []; }
  const p0 = w.boxes.map(b => w.pos(b));
  for (let i = 0; i < 300; i++) { sig(w, 1 / 30); w.step(1 / 30); w.events = []; }
  const moved = w.boxes.filter((b, i) => { const p = w.pos(b); return Math.hypot(p[0] - p0[i][0], p[1] - p0[i][1]) > .5; }).length;
  const tag = k;
  ok(del > 50, `${tag}: 120초 동안 출고 ${del}회 (50회 넘어야 함)`);
  ok(moved >= w.boxes.length * .7,
    `${tag}: 10초 동안 움직인 상자 ${moved}/${w.boxes.length}`);
}

// 2. 맵 문자열을 읽고 다시 쓰면 같은 맵이 된다(공유 문자열)
for (const k of Object.keys(E.MAPS)) {
  const s = E.MAPS[k].str;
  ok(E.mapToStr(E.parseMap(E.mapToStr(E.parseMap(s)))) === E.mapToStr(E.parseMap(s)), `${k}: 공유 문자열 왕복`);
}

// 3. 빨간불이 켜지는 순간 레일 사이에 걸친 사람 상자는 'frozen'이 난다
{
  const w = E.createWorld(PLAIN); for (let i = 0; i < 10; i++) w.add('npc');
  const p = w.add('player');
  let hopped = null;
  for (let i = 0; i < 300 && !hopped; i++) { w.step(1 / 30); w.events = []; for (const h of [(p.d + 1) % 4, (p.d + 3) % 4]) { if (!hopped) hopped = w.hop(p, h); } }
  w.setLight('yellow'); w.setLight('red');
  ok(!!hopped && w.events.some(e => e.type === 'frozen' && e.b === p), '넘어가는 도중 빨간불이면 걸림(frozen)');
  w.events = [];
  const r = w.hop(p, (p.d + 1) % 4) || w.hop(p, (p.d + 3) % 4);
  ok(!r || w.events.some(e => e.type === 'thud' && e.off), '빨간불 중에 움직이면 off 덜컹');
}

// 6. 분기 칸 없는 맵: 일반 상자는 초록 때 옆으로 옮기고(한 초록에 한 번까지), 빨강 순간 걸리는 일반 상자(미끼)가 생긴다
{
  let hops = 0, greens = 0, frozen = 0, reds = 0, twice = 0;
  const w = E.createWorld(PLAIN); fill(w);
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
  ok(hops / greens > 3, `분기 칸 없음: 초록 한 번에 옮긴 일반 상자 ${(hops / greens).toFixed(1)}개`);
  ok(twice === 0, '분기 칸 없음: 한 초록에 같은 상자가 두 번 옮기지 않음');
  ok(frozen / reds > .1, `분기 칸 없음: 빨강 한 번에 걸린 상자 ${(frozen / reds).toFixed(2)}개`);
}

// 7. 코인(느리게 굴러가는 물건, 닿으면 먹기)
//    - 맵 셋에서 넘어가지 않고 실려만 가는 상자 셋은 90초 동안 코인 0개(같은 레일에선 코인 뒤에 줄 서서 안 닿음, 모퉁이 포함)
//    - 코인은 벨트보다 느리다, 같은 레일 뒤 상자는 코인 뒤 0.62칸 밖에서 줄 선다
//    - 옆 레일에서 나란할 때(coinDir ready) 넘어가면 닿아서 먹는다, 같은 코인은 한 번만
{
  let free = 0;
  for (const k of Object.keys(E.MAPS)) for (let r = 0; r < 3; r++) {
    const w = E.createWorld(E.MAPS[k].str); fill(w); E.initCoins(w); const ps = [0, 1, 2].map(() => w.add('player'));
    for (let i = 0; i < 90 * 30; i++) { w.step(1 / 30); free += E.coinStep(w, b => ps.includes(b)).length; w.events = []; }
  }
  ok(free === 0, `실려만 가는 상자는 코인을 못 먹는다 (맵 셋 × 3판 × 상자 셋, 먹은 수 ${free})`);
  const w = E.createWorld(E.MAPS.switch.str); E.initCoins(w);
  ok(w.coins.length === E.COIN_N && w.coins.every(c => !c.pending && w.T(c.cx, c.cy).t === 'belt'), `코인 ${w.coins.length}개, 모두 벨트 위`);
  // 같은 레일: 코인 한 칸 뒤에 상자를 두고 10초
  const c0 = w.coins.find(c => w.T(c.cx - 1, c.cy) && w.T(c.cx - 1, c.cy).t === 'belt' && w.T(c.cx, c.cy).d === 0) || w.coins[0];
  w.coins = [c0]; c0.s = 0; c0.t = 99; const q = w.add('player'); q.cx = c0.cx - 1; q.cy = c0.cy; q.d = 0; q.s = 0;
  let minGap = 9, cs0 = c0.cx + c0.s; for (let i = 0; i < 30; i++) { w.step(1 / 30); if (!c0.pending) minGap = Math.min(minGap, (c0.cx + c0.s) - (q.cx + q.s)); w.events = []; }
  ok((c0.cx + c0.s) - cs0 > .6 && (c0.cx + c0.s) - cs0 < .9, `코인은 벨트보다 느림 (1초에 ${((c0.cx + c0.s) - cs0).toFixed(2)}칸, 벨트 ${E.BASE})`);
  ok(minGap >= .6, `같은 레일 뒤 상자는 코인 뒤에서 줄 섬 (가장 가까운 간격 ${minGap.toFixed(2)}칸)`);
  ok(E.coinStep(w, b => b === q).length === 0, '줄 선 상자는 코인을 못 먹음');
  // 옆 레일에서 나란할 때 넘기: 분기 맵 3·4번 줄(둘 다 →). 코인을 4번 줄 x=4에, 상자를 3번 줄 x=1에 두고 따라잡다 ready에 넘는다
  const w2 = E.createWorld(E.MAPS.switch.str); const c = { id: 1, coin: true, cx: 4, cy: 4, d: 0, s: 0, follow: 1, pending: false, t: 99 }; w2.coins = [c];
  const r = w2.add('player'); r.cx = 1; r.cy = 3; r.d = 0; r.s = 0;
  let hopped = false; const early = E.coinDir(w2, r, c);
  for (let i = 0; i < 300 && !hopped; i++) { const d = E.coinDir(w2, r, c); if (d.ready) hopped = !!w2.hop(r, d.h); w2.step(1 / 30); w2.events = []; }
  let n = 0; for (let i = 0; i < 30; i++) { n += E.coinStep(w2, b => b === r).length; w2.step(1 / 30); w2.events = []; }
  ok(early.on && !early.ready && hopped && n === 1 && r.got === 1, `옆 레일에서 따라잡다 나란할 때 넘으면 닿아서 먹음 (넘음 ${hopped}, 먹음 ${n})`);
  r.slide = null; w2.hop(r, 3); let again = 0; for (let i = 0; i < 20; i++) { again += E.coinStep(w2, b => b === r).length; w2.step(1 / 30); w2.events = []; }
  ok(again === 0 && r.got === 1, '같은 코인은 한 번만');
}

// 9. 분기 맵: 일반 상자는 분기 칸이나 그 바로 앞뒤에서만 넘어가고, 덜컹 이벤트에 분기 칸 여부가 붙는다
{
  const w = E.createWorld(E.MAPS.switch.str); fill(w);
  const sig = E.signalAI(E.DIFF.normal); let on = 0, near = 0, off = 0, flag = 0, tun = 0, tunFlag = 0, tunOff = 0;
  const oh = w.hop; w.hop = function (b, h) { const sw = w.isSwitch(b.cx, b.cy), nr = w.nearSwitch(b.cx, b.cy), tn = w.isTunnel(b.cx, b.cy); const r = oh.call(w, b, h); if (r) { if (tn) { tun++; if (!b.slide.hid) tunOff++; } else if (sw) on++; else if (nr) near++; else off++; } return r; };
  for (let i = 0; i < 30 * 120; i++) { sig(w, 1 / 30); w.step(1 / 30); flag += w.events.filter(e => e.type === 'thud' && e.sw).length; tunFlag += w.events.filter(e => e.type === 'thud' && e.tun).length; w.events = []; }
  ok(off === 0 && on > near && on > 50, `분기 맵: 일반 상자 넘어가기 분기 칸 ${on}, 바로 앞뒤 ${near}, 그 밖 ${off}`);
  ok(flag === on, `분기 맵: 분기 칸에서 넘어간 덜컹에 sw 표시 (${flag}/${on})`);
  ok(tun > 4 && tunOff === 0 && tunFlag === tun, `터널: 일반 상자는 터널 안에서 터널 안으로만 갈아탐(${tun}번, 밖으로 ${tunOff}), 덜컹에 tun 표시(${tunFlag})`);
}

// 10. 터널 안에서 터널 안으로 넘어가다 빨간불이 돼도 안 걸리고, 빨간불 중에 넘어가도 off가 아니다
{
  const w = E.createWorld(E.MAPS.switch.str); const p = w.add('player'); let done = false;
  for (let i = 0; i < 3000 && !done; i++) { w.step(1 / 60); w.events = [];
    const [vx, vy] = w.pos(p).map(Math.round); // 터널 판정은 화면 위치 기준
    if (!w.midMove(p) && w.isTunnel(vx, vy)) for (const h of [1, 3]) { if (done) break; if (w.isTunnel(vx + E.DX[h], vy + E.DY[h]) && w.hop(p, h)) {
      w.setLight('yellow'); w.setLight('red'); const fr = w.events.some(e => e.type === 'frozen' && e.b === p); const th = w.events.find(e => e.type === 'thud' && e.b === p);
      ok(!fr && th && th.tun && !th.off, `터널: 안에서 넘어가다 빨강이어도 안 걸림(frozen ${fr}), 덜컹 tun ${th && th.tun}`); done = true; } } }
  ok(done, '터널 시험 상황을 만들었다');
}

// 11. 세로 레일(맵 만들기 대비): 분기 칸·터널이 위아래로 흐르는 레일에서도 똑같이 동작
{
  const rows = ['.. Iv Iv ..', '.. nv nv ..', '.. Wv Wv ..', '.. nv nv ..', '.. Uv Uv ..', '.. Uv Uv ..', '.. nv nv ..', '.. Xv Xv ..'];
  const str = rows.join('/');
  ok(E.mapToStr(E.parseMap(str)) === E.mapToStr(E.parseMap(E.mapToStr(E.parseMap(str)))), '세로 맵: 공유 문자열 왕복(분기 W, 터널 U)');
  const w = E.createWorld(str); for (let i = 0; i < 5; i++) w.add('npc');
  const sig = E.signalAI(E.DIFF.normal); let sw = 0, tun = 0, other = 0, del = 0;
  for (let i = 0; i < 30 * 120; i++) { sig(w, 1 / 30); w.step(1 / 30); for (const e of w.events) { if (e.type === 'thud') { if (e.tun) tun++; else if (e.sw) sw++; else other++; } if (e.type === 'deliver') del++; } w.events = []; }
  ok(del > 20 && sw > 5 && other < sw, `세로 맵: 출고 ${del}, 분기 칸 넘어가기 ${sw}, 터널 안 ${tun}, 그 밖(미끼) ${other}`);
}

// 12. 화면상 노란 분기 칸 위에서 넘어가면 sw로 친다(칸 번호는 한 칸 뒤일 수 있음)
{
  const w = E.createWorld(E.MAPS.compact.str); const p = w.add('player');
  p.cx = 1; p.cy = 1; p.d = 0; p.s = .7; p.slide = null; // 화면 위치 x=1.7 → 2번 칸(분기 칸) 위
  w.events = []; w.hop(p, 1); const th = w.events.find(e => e.type === 'thud' && e.b === p);
  ok(w.isSwitch(2, 1) && th && th.sw, `분기 칸: 화면상 분기 칸 위(1.7칸)에서 넘어가면 sw (${th && th.sw})`);
}

// 13. 친구와 하기: 상자 쪽 화면(puppet)은 일반 상자를 스스로 옮기지 않고, 받은 상태를 따라가면 방장 화면과 거의 같은 자리
{
  const host = E.createWorld(E.MAPS.compact.str); fill(host); const sig = E.signalAI(E.DIFF.normal);
  const cl = E.createWorld(E.MAPS.compact.str, { colors: false, puppet: true }); cl.loadBoxes(JSON.parse(JSON.stringify(host.packBoxes())));
  let selfHop = 0, maxErr = 0;
  for (let i = 0; i < 60 * 40; i++) { sig(host, 1 / 60); host.step(1 / 60); host.events = []; cl.light = host.light; cl.step(1 / 60);
    selfHop += cl.events.filter(e => e.type === 'thud').length; cl.events = [];
    if (i % 6 === 5) { // 0.1초마다 받음, 받기 직전 오차
      host.boxes.forEach(b => { const c = cl.boxes.find(o => o.id === b.id); if (b.pending || b.gone || c.pending) return; const [x, y] = host.pos(b), [u, v] = cl.pos(c); maxErr = Math.max(maxErr, Math.min(Math.hypot(x - u, y - v), 3)); });
      cl.loadBoxes(JSON.parse(JSON.stringify(host.packBoxes()))); } }
  ok(selfHop === 0, `puppet: 일반 상자가 스스로 안 넘어감(${selfHop})`);
  ok(cl.boxes.length === host.boxes.length && maxErr < 1.2, `puppet: 0.1초마다 받으면 상자 수 같고, 받기 직전 오차 ${maxErr.toFixed(2)}칸`);
}

// 14. 칸 등록표: 등록된 종류는 모두 기호로 읽고 쓰기가 왕복된다
for (const [k, T] of Object.entries(E.TILES)) for (const d of E.DIRS) {
  const t = E.parseTile(T.sym + d);
  ok(t && t.k === k && E.tileToken(t) === T.sym + d, `칸 등록표: ${k} ${d}`);
}

console.log(failed ? `\n${failed}개 실패` : '\n엔진 테스트 전부 통과');
process.exit(failed ? 1 : 0);
