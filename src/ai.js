// ===== AI (규칙만, 화면 없음 — 브라우저·node 공용, engine.js 뒤에 붙는다) =====
// 1) 찾는 쪽 판의 숨은 상자: 초록마다 창(window) 하나를 골라 그대로 다시 한다. 사람 기록이 HUMAN_MIN개 넘으면 거기서
//    (코인까지 남은 줄 수가 같은 창), 아니면 성격별 기본 패턴에서. 기본 패턴은 소셜 스텔스 게임에서 사람이 들키는 습관을 옮긴 것:
//    초록 직후 몰아치기, 일찍 얼기, 되돌리기, 일반 상자처럼 아무 때나 한 번, 시간 없으면 빨강에 지르기.
// 2) 숨는 쪽 판의 AI 직원: 빨강 중 의심 큰 상자를 겨눠 스캔. 화면 연출(직원·레이저)은 view/hunter.js.
// ctx = {humanWins: 사람 창 배열, time: 남은 시간(초), diff: DIFF 값}
const HUMAN_MIN=12;
const PERS={rush:{react:.5},careful:{react:.3},mimic:{react:.2}};
const rnd=(a,b)=>a+Math.random()*(b-a),chance=p=>Math.random()<p;
function synthWin(pers,need,panic){const hops=[];
  if(pers==='rush'){if(need>0){let t=chance(.5)?rnd(.15,.4):rnd(.8,2.6);hops.push({ph:'g',t,dir:1});if(chance(.25)){t+=rnd(.4,.6);hops.push({ph:'g',t,dir:-1});t+=rnd(.4,.6);hops.push({ph:'g',t,dir:1});}if(need>1){t+=rnd(.42,.65);hops.push({ph:'g',t,dir:1});}}
    else if(chance(.3))hops.push({ph:'g',t:rnd(.2,.6),dir:0});if(need>0&&chance(.12+panic*.2))hops.push({ph:'r',t:rnd(.3,1.6),dir:1});}
  else if(pers==='careful'){if(need>0&&!chance(.2))hops.push({ph:'g',t:rnd(1,2.6),dir:1});if(need>0&&chance(panic*.15))hops.push({ph:'r',t:rnd(.8,2),dir:1});}
  else{if(need>0&&!chance(.3))hops.push({ph:'g',t:rnd(.3,2.6),dir:1});else if(chance(.35))hops.push({ph:'g',t:rnd(.3,2.6),dir:0});}
  return {need,hops};}
// 분기 갈래 기본 패턴: 성격별로 분기 칸까지 기다릴 확률(나머지는 아무 데서나 지름)
const SW_WAIT={rush:.5,careful:1,mimic:.9};
function swWin(pers,w){return {need:w.need,hops:w.hops.map(h=>Object.assign({},h,{sw:h.sw!=null?h.sw:(chance(SW_WAIT[pers])?1:0)}))};}
// 이 상자가 노리는 코인 경계의 레일까지 남은 줄 수(0 = 경계 레일 위라 건너기만 하면 됨, 1, 2 = 2 이상)
function needOf(w,b){const g=b&&b.coin&&coinGap(w,b,b.coin);return g?Math.min(2,g.dl):0;}
// 화면에 보이는 위치가 터널 덮개 아래인가(찾는 쪽에게 안 보임)
function inTunnel(w,b){const [x,y]=w.pos(b);return w.isTunnel(Math.round(x),Math.round(y));}
function pickWin(w,b,ctx){const need=needOf(w,b),pool=ctx.humanWins;
  if(pool.length>=HUMAN_MIN){const same=pool.filter(x=>Math.min(2,x.need|0)===need);const src=same.length?same:pool;b.src='human';return src[(Math.random()*src.length)|0];}
  b.src='synth';return swWin(b.pers,synthWin(b.pers,need,1-Math.max(0,ctx.time)/Math.max(1,b.T0||150)));}
// 사람이 노랑을 늦게 알아챈 시간: 기록에 노랑 중 움직임이 있으면 거기서, 없으면 성격값
function reactOf(b,ctx){const ys=ctx.humanWins.flatMap(x=>x.hops).filter(h=>h.ph==='y');return ys.length&&b.src==='human'?ys[(Math.random()*ys.length)|0].t:PERS[b.pers].react*ctx.diff.k;}
function botPlan(w,b,ctx){const x=pickWin(w,b,ctx);b.plan=(x.hops||[]).slice().sort((p,q)=>'gyr'.indexOf(p.ph)-'gyr'.indexOf(q.ph)||p.t-q.t);b.pi=0;b.react=reactOf(b,ctx);}
function botHop(w,b,dir){const sd=coinDir(w,b,b.coin).h;let h=-1;
  if(dir===1)h=sd;else if(dir===-1)h=sd>=0?(sd+2)%4:w.randSide(b);else h=w.randSide(b);
  if(h>=0)w.hop(b,h);b.pi++;}
function botThink(w,b,dt,ctx){if(b.found||b.gone||b.pending)return;if(!b.plan)botPlan(w,b,ctx);if(w.midMove(b))return;
  if(inTunnel(w,b)){const h=coinDir(w,b,b.coin).h,[bx,by]=w.pos(b);if(h>=0&&w.isTunnel(Math.round(bx+DX[h]),Math.round(by+DY[h]))&&Math.random()<dt*3){w.hop(b,h);return;}} // 터널 안이면 안 보이니 코인 쪽으로 갈아탐
  const hp=b.plan[b.pi];if(!hp)return;const L=w.light,lt=w.lightT;
  // 코인 쪽으로 가는 움직임인데 이미 코인 경계 레일 위면, 코인 자리에 올 때까지 기다렸다 건넌다(아무 데서나 건너면 못 먹음).
  // 분기 칸에서 넘어간 움직임이면 분기 칸에 올 때까지 기다린다. 코인 수명이 3초 안 남았거나 지금이 코인 자리면 안 기다린다
  const cd=coinDir(w,b,b.coin),waitCoin=hp.dir===1&&cd.on&&!cd.ready;
  const waitSw=!cd.ready&&hp.sw===1&&hp.ph==='g'&&!(()=>{const [x,y]=w.pos(b);return w.isSwitch(Math.round(x),Math.round(y));})()&&!(b.coin&&b.coin.t<3);
  if(hp.ph==='g'){if(L==='green'){if(lt>=hp.t&&!waitCoin&&!waitSw)botHop(w,b,hp.dir);}
    else if(L==='yellow'&&lt<b.react&&!waitCoin)botHop(w,b,hp.dir); // 노랑을 아직 못 봤다
    else b.pi++;}
  else if(hp.ph==='y'){if(L==='yellow'&&lt>=hp.t)botHop(w,b,hp.dir);else if(L==='red')b.pi++;}
  else if(L==='red'&&lt>=hp.t)botHop(w,b,hp.dir);}
// AI 직원 판단. h = {t: 다음 고르기까지, target, aim: 남은 조준 시간, scans: 남은 스캔, stun: 멈춤}
// 빨강 중 0.35초마다 의심이 가장 큰 상자를 (의심이 클수록 높은 확률로) 겨누고, diff.aim초 뒤 스캔. 덮개 아래로 들어가면 조준 풀림.
// 스캔한 순간 {scan: 상자}를 돌려준다(누구였는지에 따른 결과는 화면 쪽이 처리).
function hunterStep(w,h,dt,diff){if(h.stun>0){h.stun-=dt;return null;}
  if(!h.target){h.t-=dt;if(w.light==='red'&&h.t<=0&&h.scans>0){h.t=.35;const cand=w.boxes.filter(b=>!b.gone&&!b.pending&&!inTunnel(w,b));const top=cand.reduce((a,b)=>b.sus>a.sus?b:a,cand[0]);
      if(top&&top.sus>1.1&&Math.random()<Math.min(.95,(top.sus-.6)/2.4)){h.target=top;h.aim=diff.aim;}}return null;}
  const t=h.target;if(inTunnel(w,t)){h.target=null;return null;}
  h.aim-=dt;if(h.aim<=0||t.pending){h.target=null;if(t.pending)return null;h.scans--;return {scan:t};}
  return null;}
if(typeof module!=='undefined')Object.assign(module.exports,{HUMAN_MIN,synthWin,swWin,needOf,inTunnel,pickWin,botPlan,botThink,hunterStep});
