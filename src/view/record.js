// ===== 사람 기록: 숨는 쪽 판의 내 움직임을 남겨, 찾는 쪽 판의 숨은 AI가 따라 하게 한다(ai.js) =====
// 숨는 쪽 판에서 내 입력을 신호 기준으로 남긴다. 초록 한 번 = 창(window) 하나:
// {need: 초록 시작 때 노리는 코인 경계 레일까지 남은 줄 수(0,1,2=2 이상), g: 그 초록의 길이(초), hops: [{ph: 'g'|'y'|'r' 옮긴 순간의 신호, t: 그 신호가 켜진 뒤 초, dir: 1 코인 쪽(건너기 포함), -1 반대쪽, 0 코인 없음}]}
// 아무것도 안 한 초록도 창으로 남긴다(사람이 기다린 것도 패턴이다). 판이 끝나면 저장: 아티팩트에선 공유 db(plays), 아니면 이 브라우저.
const HUMAN_VER=5,HUMAN_KEY='box-human5'; // 5: 코인이 경계로 바뀌어 need·dir 뜻이 바뀜(v13.5) // 사람 창이 이만큼 모이면 숨은 AI가 사람 기록을 쓴다
let rec=null,humanPlays=[],humanSrc='none',DB=null;
function recLight(s){if(!rec||!player)return;const now=world.t;
  if(rec.cur&&rec.cur.ph==='g'&&s!=='green')rec.cur.g=+(now-rec.cur.t0).toFixed(2);
  if(s==='green'){recClose();rec.cur={need:needOf(world,player),g:0,hops:[],t0:now,ph:'g'};}else if(rec.cur)rec.cur.ph=s;rec.ps=now;}
function recHop(dir,sw,tun){if(!rec||!rec.cur)return;const h={ph:world.light==='green'?'g':world.light==='yellow'?'y':'r',t:+(world.t-rec.ps).toFixed(2),dir};h.sw=sw?1:0;if(tun)h.tun=1;rec.cur.hops.push(h);}
function recClose(){if(rec&&rec.cur){const c=rec.cur;if(!c.g)c.g=+(world.t-c.t0).toFixed(2);rec.wins.push({need:c.need,g:c.g,hops:c.hops});rec.cur=null;}}
function recSave(win){if(!rec)return;recClose();const play={v:HUMAN_VER,at:Date.now(),map:curKey,win:!!win,got:player?player.got||0:0,wins:rec.wins.slice(0,60)};rec=null;if(!play.wins.length)return;
  humanPlays.unshift(play);humanPlays=humanPlays.slice(0,80);
  try{const L=JSON.parse(localStorage.getItem(HUMAN_KEY)||'[]');L.unshift(play);localStorage.setItem(HUMAN_KEY,JSON.stringify(L.slice(0,40)));}catch(e){}
  if(DB){DB.collection('plays').add(play).catch(()=>{});}}
// 기록 판들을 창 하나씩으로 편다. humanPlays가 바뀔 때만 다시 편다(매 프레임 4천 개 넘게 펴던 것)
let _hw=[],_hwOf=null;const humanWins=()=>{if(_hwOf!==humanPlays){_hwOf=humanPlays;_hw=humanPlays.flatMap(p=>Array.isArray(p.wins)?p.wins:[]).filter(w=>w&&Array.isArray(w.hops));}return _hw;};
const aiCtx=()=>({humanWins:humanWins(),time,diff:DIFF[DIFF_KEY]});
try{const L=JSON.parse(localStorage.getItem(HUMAN_KEY)||'[]');if(Array.isArray(L)&&L.length){humanPlays=L;humanSrc='local';}}catch(e){}
// 아티팩트로 열었을 때: 공유 db에서 최근 기록을 읽는다(10초 안에 답 없으면 이 브라우저 기록만)
(async()=>{try{const c=window.claude;if(!c||!c.use)return;const db=await c.use('db');if(!db)return;DB=db;
  const q=await Promise.race([db.collection('plays').orderBy('at','desc').limit(80).get(),new Promise((_,r)=>setTimeout(()=>r(0),10000))]);
  const ps=q.docs.map(d=>d.data()).filter(p=>p&&p.v===HUMAN_VER&&Array.isArray(p.wins));if(ps.length){humanPlays=ps;humanSrc='db';}if(mode===null&&$('humanNote'))$('humanNote').textContent=humanNote();}catch(e){}})();
function humanNote(){const n=humanWins().length;return n>=HUMAN_MIN?`찾는 쪽의 숨은 셋은 지금 사람 기록 ${humanPlays.length}판(초록 ${n}번)을 따라 움직여요.`:`찾는 쪽의 숨은 셋은 아직 기본 패턴으로 움직여요. 숨는 쪽을 하면 내 움직임이 기록되고, 초록 ${HUMAN_MIN}번 넘게 모이면 숨은 셋이 그걸 따라 해요(지금 ${n}번).`;}

