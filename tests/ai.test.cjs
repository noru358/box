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

// 2. 숨은 AI: 기본 패턴으로 90초 판 세 번(난수라 한 판은 들쭉날쭉해서 합으로 본다).
//    빨강에 걸리는 일이 드물고, 분기 칸에서 넘어가는 비율이 높고, 코인 경계를 건너 코인을 먹는다
{
  let hops = 0, green = 0, red = 0, sw = 0, got = 0; const per = []; let synth = true;
  for (let game = 0; game < 3; game++) {
    const w = E.createWorld(E.MAPS.compact.str); fill(w);
    const sig = E.signalAI(E.DIFF.normal), ctx = { humanWins: [], time: 90, diff: E.DIFF.normal };
    const bots = w.boxes.slice(0, 3); ['rush', 'careful', 'mimic'].forEach((p, i) => { bots[i].kind = 'bot'; bots[i].pers = p; });
    const coins = E.initCoins(w); const aim = b => { b.took = b.took || new Set(); b.coin = E.pickCoin(w, b, coins); };
    for (let i = 0; i < 90 * 30; i++) {
      sig(w, 1 / 30); bots.forEach(aim); ctx.time = 90 - i / 30;
      bots.forEach(b => E.botThink(w, b, 1 / 30, ctx)); E.coinStep(w, coins, 1 / 30, b => bots.includes(b)); w.step(1 / 30);
      for (const e of w.events) {
        if (e.type === 'light' && e.s === 'green') bots.forEach(b => E.botPlan(w, b, ctx));
        if (e.type === 'thud' && bots.includes(e.b)) { hops++; if (w.light === 'green') green++; if (e.off) red++; if (e.sw) sw++; }
      }
      w.events = [];
    }
    synth = synth && bots.every(b => b.src === 'synth');
    per.push(bots.map(b => Math.min(E.COIN_GOAL, b.got | 0)).join(',')); got += bots.reduce((a, b) => a + Math.min(E.COIN_GOAL, b.got | 0), 0);
  }
  console.log(`     세 판 숨은 AI 코인(4개에서 멈춘다고 치고): ${per.join(' / ')}`);
  ok(hops > 30 && red / hops < .15, `숨은 AI: 넘어가기 ${hops}번 중 빨강에 걸림 ${red}번 (15% 미만)`);
  // 기준 0.2: v13.5부터 코인은 코인 자리에서 건너야 하고, 코인 절반쯤은 분기 칸 옆이 아니다(그 코인은 티 나는 대신 가까울 때만 노림)
  ok(sw / hops > .2, `숨은 AI: 분기 칸에서 넘어간 비율 ${(sw / hops).toFixed(2)} (0.2 넘게)`);
  ok(synth, '숨은 AI: 사람 기록이 없으면 기본 패턴');
  ok(got >= 9, `숨은 AI: 코인 경계를 건너 코인을 먹는다 (세 판 아홉 상자 합 ${got}개, 한 상자 평균 1개 이상)`);
}

// 3. 사람 기록이 HUMAN_MIN개 넘으면 사람 창을 쓴다
{
  const w = E.createWorld(E.MAPS.compact.str); const b = w.add('npc'); b.kind = 'bot'; b.pers = 'rush'; b.coin = E.initCoins(w)[0];
  const wins = Array.from({ length: E.HUMAN_MIN }, () => ({ need: 2, g: 2, hops: [{ ph: 'g', t: .5, dir: 1, sw: 0 }] }));
  E.botPlan(w, b, { humanWins: wins, time: 60, diff: E.DIFF.normal });
  ok(b.src === 'human' && b.plan.length === 1, `숨은 AI: 사람 창 ${wins.length}개면 사람 기록을 따라 함 (${b.src})`);
}

console.log(failed ? `\n${failed}개 실패` : '\nAI 테스트 전부 통과');
process.exit(failed ? 1 : 0);
