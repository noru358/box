// 코인 난이도 재기(실험): "노란 칸에서만 넘어가는 숨는 쪽"이 90초에 코인을 몇 개 먹나.
// 가상 숨는 쪽: 초록(0.3초 지난 뒤)에만, 화면 위치가 분기 칸 위일 때만 넘어간다.
//   코인과 나란해져 지금 넘으면 먹는 코인이 있으면 그쪽으로, 아니면 노릴 코인 레일 쪽으로 길을 좁힌다.
// 실행: node tests/sim/coin_rate.cjs [판 수]
const E = require('../../src/engine.js');
const N = +process.argv[2] || 20;
const res = {};
for (const k of Object.keys(E.MAPS)) {
  let tot = 0, full = 0;
  for (let g = 0; g < N; g++) {
    const w = E.createWorld(E.MAPS[k].str); const n = Math.round(w.tiles.flat().filter(t => t && t.t !== 'exit').length * .42);
    for (let i = 0; i < n; i++) w.add('npc');
    const p = w.add('player'); p.took = new Set(); E.initCoins(w); const sig = E.signalAI(E.DIFF.normal);
    for (let i = 0; i < 90 * 30 && (p.got | 0) < E.COIN_GOAL; i++) {
      sig(w, 1 / 30);
      if (w.light === 'green' && w.lightT > .3 && !w.midMove(p) && !p.pending) {
        const [x, y] = w.pos(p);
        if (w.isSwitch(Math.round(x), Math.round(y))) {
          let best = null;
          for (const c of w.coins) { if (p.took.has(c.id)) continue; const d = E.coinDir(w, p, c); if (d.ready) { best = d; break; } }
          if (!best) { const c = E.pickCoin(w, p); const d = c && E.coinDir(w, p, c); if (d && d.h >= 0 && !d.on) best = d; }
          if (best && best.h >= 0) w.hop(p, best.h);
        }
      }
      w.step(1 / 30); E.coinStep(w, b => b === p); w.events = [];
    }
    tot += Math.min(E.COIN_GOAL, p.got | 0); if ((p.got | 0) >= E.COIN_GOAL) full++;
  }
  res[k] = `평균 ${(tot / N).toFixed(2)}개, 4개 다 먹은 판 ${full}/${N}`;
}
console.log(res);
