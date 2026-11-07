// AI 테스트(브라우저 없음): src/engine.js + src/ai.js를 브라우저처럼 이어 붙여 한 번에 돌린다.
// 실행: node tests/ai.test.cjs
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = ['engine.js', 'ai.js'].map(f => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8')).join('\n;\n');
const module_ = { exports: {} };
vm.runInNewContext(src, { module: module_, Math, Object, Array, Set, Map, JSON, console });
const E = module_.exports;
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failed++; };
const fill = (w, k = .28) => { const n = w.tiles.flat().filter(t => t && t.t !== 'exit').length; for (let i = 0; i < Math.round(n * k); i++) w.add('npc'); };

// 1. AI 직원: 빨강 중 의심 큰 상자를 겨눠 aim초 뒤 스캔한다. 초록에는 안 겨눈다. 덮개 아래 상자는 못 겨눈다
{
  const w = E.createWorld(E.MAPS.compact.str); fill(w);
  const target = w.boxes.find(b => !E.inTunnel(w, b)); target.sus = 3;
  const h = { t: 0, target: null, aim: 0, scans: 15, stun: 0 };
  for (let i = 0; i < 30; i++) E.hunterStep(w, h, 1 / 30, E.DIFF.normal);
  ok(!h.target, 'AI 직원: 초록에는 안 겨눔');
  w.setLight('yellow'); w.setLight('red');
  let scanned = null;
  for (let i = 0; i < 120 && !scanned; i++) { const r = E.hunterStep(w, h, 1 / 30, E.DIFF.normal); if (r) scanned = r.scan; }
  ok(scanned === target && h.scans === 14, `AI 직원: 빨강 중 의심 3인 상자를 스캔 (남은 스캔 ${h.scans})`);
  const w2 = E.createWorld(E.MAPS.compact.str); fill(w2, .6);
  w2.boxes.forEach(b => { b.sus = 0; }); const hid = w2.boxes.find(b => E.inTunnel(w2, b));
  if (hid) { hid.sus = 5; w2.setLight('yellow'); w2.setLight('red'); const h2 = { t: 0, target: null, aim: 0, scans: 15, stun: 0 };
    let aimed = false; for (let i = 0; i < 60; i++) { E.hunterStep(w2, h2, 1 / 60, E.DIFF.normal); if (h2.target === hid) aimed = true; }
    ok(!aimed, 'AI 직원: 터널 덮개 아래 상자는 못 겨눔'); }
}

// 2. 숨은 AI: 기본 패턴으로 90초 돌리면 대부분 초록에 넘어가고, 분기 칸에서 넘어가는 비율이 높다
{
  const w = E.createWorld(E.MAPS.compact.str); fill(w);
  const sig = E.signalAI(E.DIFF.normal), ctx = { humanWins: [], time: 90, diff: E.DIFF.normal };
  const bots = w.boxes.slice(0, 3); ['rush', 'careful', 'mimic'].forEach((p, i) => { bots[i].kind = 'bot'; bots[i].pers = p; });
  const aim = b => { const r = b.cy <= 3 ? 6 : 1; b.stamp = [4, r]; }; // 코인은 반대편 줄에 있다고 친다
  let hops = 0, green = 0, red = 0, sw = 0;
  for (let i = 0; i < 90 * 30; i++) {
    sig(w, 1 / 30); bots.forEach(aim); ctx.time = 90 - i / 30;
    bots.forEach(b => E.botThink(w, b, 1 / 30, ctx)); w.step(1 / 30);
    for (const e of w.events) {
      if (e.type === 'light' && e.s === 'green') bots.forEach(b => E.botPlan(w, b, ctx));
      if (e.type === 'thud' && bots.includes(e.b)) { hops++; if (w.light === 'green') green++; if (e.off) red++; if (e.sw) sw++; }
    }
    w.events = [];
  }
  ok(hops > 10 && red / hops < .15, `숨은 AI: 넘어가기 ${hops}번 중 초록 ${green}번, 빨강에 걸림 ${red}번(드물어야, 나머지는 노랑 늦게·터널 안)`);
  ok(sw / hops > .3, `숨은 AI: 분기 칸에서 넘어간 비율 ${(sw / hops).toFixed(2)}`);
  ok(bots.every(b => b.src === 'synth'), '숨은 AI: 사람 기록이 없으면 기본 패턴');
}

// 3. 사람 기록이 HUMAN_MIN개 넘으면 사람 창을 쓴다
{
  const w = E.createWorld(E.MAPS.compact.str); const b = w.add('npc'); b.kind = 'bot'; b.pers = 'rush'; b.stamp = [4, b.cy === 1 ? 3 : 1];
  const wins = Array.from({ length: E.HUMAN_MIN }, () => ({ need: 2, g: 2, hops: [{ ph: 'g', t: .5, dir: 1, sw: 0 }] }));
  E.botPlan(w, b, { humanWins: wins, time: 60, diff: E.DIFF.normal });
  ok(b.src === 'human' && b.plan.length === 1, `숨은 AI: 사람 창 ${wins.length}개면 사람 기록을 따라 함 (${b.src})`);
}

console.log(failed ? `\n${failed}개 실패` : '\nAI 테스트 전부 통과');
process.exit(failed ? 1 : 0);
