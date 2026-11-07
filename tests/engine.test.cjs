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

// 7. 코인(경계): 실려만 가서는 절대 못 먹고, 코인 자리에서 그 경계를 넘어가면 먹는다. 다른 자리에서 넘으면 못 먹는다
{
  const w = E.createWorld(E.MAPS.compact.str); fill(w);
  const p = w.add('player'); let coins = E.initCoins(w);
  ok(coins.length === E.COIN_N && coins.every(c => w.T(...c.a).t === 'belt' && w.T(...c.b).t === 'belt'), `코인 ${coins.length}개, 모두 두 벨트 사이 경계`);
  let got = 0; for (let i = 0; i < 90 * 30; i++) { w.step(1 / 30); got += E.coinStep(w, coins, 1 / 30, b => b === p).length; w.events = []; }
  ok(got === 0 && !(p.got > 0), `가만히 실려 가는 상자는 90초 동안 코인 0개 (${got})`);
  // 코인 자리에서 넘어가기: 코인 경계 레일 위에 올려 두고 코인 열 바로 앞에서 기다렸다 넘는다
  const w2 = E.createWorld(E.MAPS.compact.str); const q = w2.add('player'); const c = E.coinSeams(w2).find(s => !s.sw && s.a[0] >= 3 && w2.T(...s.a).d === 0 && w2.T(s.a[0] - 1, s.a[1]).t === 'belt' && w2.T(s.a[0] - 1, s.b[1]).t === 'belt');
  const coin = { id: 1, a: c.a, b: c.b, h: c.h, x: c.x, y: c.y, t: 99 }; const cs = [coin];
  q.cx = c.a[0] - 1; q.cy = c.a[1]; q.d = 0; q.s = .3; q.slide = null; // 화면 위치 = 코인 열 0.7칸 앞
  let early = 0; { const h = E.coinDir(w2, q, coin); ok(h.on && !h.ready, '코인 경계 레일 위, 코인 자리 전: 아직 아님'); }
  const hopped = !!w2.hop(q, 1); early = E.coinStep(w2, cs, 0, b => b === q).length; w2.events = [];
  ok(hopped && early === 0, `코인 자리 0.7칸 앞에서 넘으면 못 먹음 (넘어감 ${hopped})`);
  const w3 = E.createWorld(E.MAPS.compact.str); const r = w3.add('player'); r.cx = c.a[0]; r.cy = c.a[1]; r.d = 0; r.s = .2; r.slide = null;
  const d3 = E.coinDir(w3, r, coin); ok(d3.ready && d3.h === 1, `코인 자리: 지금 아래로 넘으면 먹음 (h ${d3.h})`);
  w3.hop(r, d3.h); const g3 = E.coinStep(w3, cs, 0, b => b === r); w3.events = [];
  ok(g3.length === 1 && r.got === 1, '코인 자리에서 경계를 넘으면 먹음');
  r.slide = null; r.s = .2; w3.hop(r, 3); const again = E.coinStep(w3, cs, 0, b => b === r).length; w3.events = [];
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
