// ===== 택배 숨바꼭질 엔진 (규칙만, 화면 없음) =====
// 브라우저에선 빌드 때 dist/index.html 안에 들어가고, node에선 require로 불러 테스트한다.
// 설계 설명: docs/2-design/engine.md, ai.md, balance.md
const DIRS='>v<^',DX=[1,0,-1,0],DY=[0,1,0,-1];
const BASE=1.25; // 벨트 속도(칸/초)
const WANDER=.45; // 분기 칸이 없는 맵에서 일반 상자가 초록에 옆으로 옮기는 빈도(초당, 한 초록에 한 번까지)
// 분기 칸(v12-switch): 'W' 기호. 일반 상자는 분기 칸에서만 옆 레일로 간다(지날 때 SW_P 확률, 초록일 때).
// 미끼: 분기 칸 바로 앞뒤 칸에서 SW_BAIT 확률로 넘어가는 일반 상자도 있다. 사람은 어디서든 넘어갈 수 있지만 분기 칸이 아니면 티가 난다.
const SW_P=.55,SW_BAIT=.06;
// 터널: 'U' 기호. 덮개 아래라 찾는 쪽에게 안 보인다. 터널 안에서 터널 안으로 넘어가면 안 보이고 걸리지도 않는다. 일반 상자도 터널을 지날 때 TUN_P 확률로 한 번 안에서 갈아탄다(나온 줄이 바뀐 게 확실한 증거가 되지 않게).
const TUN_P=.12; // 터널을 한 번 지날 때 안에서 갈아탈 확률(칸마다가 아니라 한 번)
const DIFF={easy:{name:'쉬움',yellow:.65,late:.35,green:[1.6,4.2],red:[1.4,2.4],fake:.12,aim:1.0,slack:1.6,k:1.4},normal:{name:'보통',yellow:.45,late:.22,green:[1.0,3.8],red:[1.6,2.8],fake:.2,aim:.75,slack:1.25,k:1},hard:{name:'어려움',yellow:.3,late:.12,green:[.6,3.4],red:[1.8,3.2],fake:.3,aim:.55,slack:1.0,k:.7}};
// 가로 레일 맵: rows = [{d:'>'|'<', ex:{열:기호}}], 양 끝은 입고·출고
function laneMap(rows,W){W=W||14;const g=[Array(W).fill('..')];
  rows.forEach(r=>{const t=Array(W).fill('n'+r.d);const right=r.d==='>';t[right?0:W-1]='I'+r.d;t[right?W-1:0]='X'+r.d;Object.entries(r.ex||{}).forEach(([k,v])=>t[+k]=v);g.push(t);});
  g.push(Array(W).fill('..'));return g.map(r=>r.join(' ')).join('/');}
// 굽은 길(v12-switch 시험): 바깥 고리(시계 방향)와 안쪽 고리(반시계) + 가운데 두 줄(입고→출고). 세로로 흐르는 길, 모퉁이, 세로 터널.
function loopMap(){const W=14,H=8,g=Array.from({length:H},()=>Array(W).fill('..'));const set=(x,y,t)=>{g[y][x]=t;};
  for(let x=1;x<=11;x++)set(x,1,'n>');set(12,1,'nv');for(let y=2;y<=5;y++)set(12,y,'nv');set(12,6,'n<');for(let x=2;x<=11;x++)set(x,6,'n<');set(1,6,'n^');for(let y=2;y<=5;y++)set(1,y,'n^');
  for(let x=3;x<=11;x++)set(x,2,'n<');set(2,2,'nv');for(let y=3;y<=4;y++)set(2,y,'nv');set(2,5,'n>');for(let x=3;x<=10;x++)set(x,5,'n>');set(11,5,'n^');for(let y=3;y<=4;y++)set(11,y,'n^');
  set(3,3,'I>');for(let x=4;x<=9;x++)set(x,3,'n>');set(10,3,'X>');set(10,4,'I<');for(let x=4;x<=9;x++)set(x,4,'n<');set(3,4,'X<');
  [[5,1,'W>'],[9,1,'W>'],[4,6,'W<'],[8,6,'W<'],[6,2,'W<'],[7,5,'W>'],[1,3,'W^'],[2,4,'Wv'],[6,3,'W>'],[7,4,'W<'],[12,3,'Uv'],[12,4,'Uv'],[11,3,'U^'],[11,4,'U^']].forEach(([x,y,t])=>set(x,y,t));
  return g.map(r=>r.join(' ')).join('/');}
const MAPS={
  compact:{name:'세로 폰용(9칸)',str:laneMap([{d:'>',ex:{2:'W>',6:'W>'}},{d:'<',ex:{3:'W<',6:'W<'}},{d:'>',ex:{2:'W>',5:'W>'}},{d:'>',ex:{2:'W>',4:'U>',5:'U>',7:'W>'}},{d:'>',ex:{2:'W>',4:'U>',5:'U>',7:'W>'}},{d:'<',ex:{3:'W<',6:'W<'}},{d:'>',ex:{2:'W>',5:'W>'}}],9)},
  loop:{name:'굽은 길',str:loopMap()},
  switch:{name:'분기',str:laneMap([{d:'>',ex:{3:'W>',7:'W>',11:'W>'}},{d:'<',ex:{5:'W<',9:'W<'}},{d:'>',ex:{3:'W>',6:'U>',7:'U>',8:'U>',11:'W>'}},{d:'>',ex:{5:'W>',6:'U>',7:'U>',8:'U>',9:'W>'}}])}
};
// 칸 종류 등록표. 맵 기호는 [종류 한 글자][방향 > v < ^]. 새 칸 종류는 여기 한 줄 + 화면 쪽 TILE_LOOK(그리는 법) 한 줄.
// 칸 객체: {k: 등록표 키, t: 'belt'|'spawn'|'exit'(움직임 규칙), d: 방향, sw: 분기 칸, tun: 터널}
const TILES={
  belt:{sym:'n',name:'벨트',make:d=>({t:'belt',d})},
  switch:{sym:'W',name:'분기',make:d=>({t:'belt',d,sw:true})},
  tunnel:{sym:'U',name:'터널',make:d=>({t:'belt',d,tun:true})},
  spawn:{sym:'I',name:'입고',make:d=>({t:'spawn',d})},
  exit:{sym:'X',name:'출고',make:d=>({t:'exit',d})}
};
const TILE_OF_SYM={};for(const k in TILES)TILE_OF_SYM[TILES[k].sym]=k;
function parseTile(tok){if(!tok||tok==='..')return null;const k=TILE_OF_SYM[tok[0]],d=DIRS.indexOf(tok[1]);if(!k||d<0)return null;return Object.assign(TILES[k].make(d),{k});}
function tileToken(t){return t?TILES[t.k].sym+DIRS[t.d]:'..';}
function parseMap(str){const rows=str.trim().split('/').map(r=>r.trim().split(/\s+/));const H=rows.length,W=Math.max(...rows.map(r=>r.length));
  return {W,H,tiles:rows.map(r=>Array.from({length:W},(_,x)=>parseTile(r[x])))};}
function mapToStr(m){return m.tiles.map(r=>r.map(tileToken).join(' ')).join('/');}

function createWorld(str,opt){opt=opt||{};const rng=opt.rng||Math.random;const {W,H,tiles}=parseMap(str);const diff=DIFF[opt.diff||'normal'];
  const cells=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(tiles[y][x])cells.push([x,y]);
  const spawns=cells.filter(([x,y])=>tiles[y][x].t==='spawn');
  // puppet: 친구와 하기의 상자 쪽 화면. 일반 상자의 결정·재입고는 직원(방장) 화면이 하고, 여기선 벨트만 굴리며 받은 상태로 덮어쓴다
  const puppet=!!opt.puppet;
  const w={W,H,tiles,diff,puppet,boxes:[],t:0,light:'green',lightT:0,win:0,events:[]};
  const T=(x,y)=>(x>=0&&y>=0&&x<W&&y<H)?tiles[y][x]:null;w.T=T;
  const wrap=(x,y)=>[(x+W)%W,(y+H)%H];
  const hopable=t=>t&&t.t!=='exit';
  w.isSwitch=(x,y)=>{const t=T(x,y);return !!(t&&t.sw);};
  w.isTunnel=(x,y)=>{const t=T(x,y);return !!(t&&t.tun);};
  // 터널 안에서 터널 안으로 갈 수 있는 옆 방향(-1 = 없음)
  w.tunSide=b=>{if(!w.isTunnel(b.cx,b.cy))return -1;const d=T(b.cx,b.cy).d;const o=[(d+1)%4,(d+3)%4].filter(h=>w.isTunnel(b.cx+DX[h],b.cy+DY[h]));return o.length?o[(rng()*o.length)|0]:-1;};
  // 분기 칸 바로 앞이나 뒤(같은 레일)인가: 미끼 자리
  w.nearSwitch=(x,y)=>{const t=T(x,y);if(!t||t.sw)return false;return w.isSwitch(x+DX[t.d],y+DY[t.d])||w.isSwitch(x-DX[t.d],y-DY[t.d]);};
  w.hasSwitches=cells.some(([x,y])=>tiles[y][x].sw);
  // 넘어갈 수 있는 옆 방향 중 아무거나(-1 = 못 감)
  w.randSide=b=>{const t=T(b.cx,b.cy);if(!hopable(t))return -1;const o=[(t.d+1)%4,(t.d+3)%4].filter(h=>hopable(T(b.cx+DX[h],b.cy+DY[h])));return o.length?o[(rng()*o.length)|0]:-1;};
  w.add=function(kind){const free=cells.filter(([x,y])=>!w.boxes.some(b=>!b.gone&&b.cx===x&&b.cy===y)&&tiles[y][x].t!=='exit');if(!free.length)return null;const [x,y]=free[(rng()*free.length)|0];
    const b={id:w.boxes.length,kind,size:[1.25,1.5,1.75][(rng()*3)|0],cx:x,cy:y,d:tiles[y][x].d,s:rng()*.9,follow:1,sus:0,deliv:0,gone:false,found:false,pending:false,slide:null,lastWin:-1};
    w.boxes.push(b);return b;};
  w.center=(x,y)=>[x,y];
  w.pos=b=>{let x=b.cx+DX[b.d]*b.s,y=b.cy+DY[b.d]*b.s;if(b.slide){const k=1-Math.min(1,b.slide.t);x+=b.slide.ox*k;y+=b.slide.oy*k;}return [x,y];};
  w.midMove=b=>!!(b.slide&&b.slide.t<1);
  function respawn(b){if(puppet){b.pending=true;return;}const free=spawns.filter(([x,y])=>!w.boxes.some(o=>o!==b&&!o.gone&&!o.pending&&Math.hypot(o.cx+DX[o.d]*o.s-x,o.cy+DY[o.d]*o.s-y)<1));
    if(!free.length){b.pending=true;return;}const [x,y]=free[(rng()*free.length)|0];b.cx=x;b.cy=y;b.d=tiles[y][x].d;b.s=0;b.pending=false;b.slide=null;}
  // 칸 중앙 도착: 다음 방향을 정한다
  function arrive(b){const t=tiles[b.cy][b.cx];
    if(t.t==='exit'){b.deliv++;w.events.push({type:'deliver',b});respawn(b);return;}
    b.d=t.d;}
  // 신호: 초록(등 돌림) → 노랑(돌아보는 중) → 빨강(봄)
  w.setLight=function(s){if(w.light===s)return;w.light=s;w.lightT=0;if(s==='green')w.win++;
    if(s==='red')for(const b of w.boxes){if(b.gone||b.pending)continue;if(b.slide&&b.slide.hid)continue;if(w.midMove(b))w.events.push({type:'frozen',b,x:w.pos(b)[0],y:w.pos(b)[1]});}
    w.events.push({type:'light',s});};
  // 사람 상자의 옆 칸 갈아타기
  w.thud=function(b,move,sw,tun,h,from){const [x,y]=w.pos(b);const off=w.light==='red'&&!tun;if(move)b.lastWin=w.win;w.events.push({type:'thud',b,x,y,off,sw:!!sw,tun:!!tun,h,from});return off;}; // sw: 분기 칸에서 넘어갔나, h·from: 넘어간 방향과 넘기 전 화면 위치의 칸(코인 판정)
  w.hop=function(b,h){if(b.pending||b.gone||b.slide&&b.slide.t<1)return null;if(h%2===b.d%2)return null;
    const here=tiles[b.cy][b.cx];if(!hopable(here))return null;
    const [px,py]=w.pos(b);const nx=b.cx+DX[h],ny=b.cy+DY[h];const nt=T(nx,ny);if(!hopable(nt))return null;
    const dir2=nt.d;let cx=nx,cy=ny,s=b.s,d=dir2;
    if(dir2===b.d){}else if(dir2===(b.d+2)%4){const fx=nx+DX[b.d],fy=ny+DY[b.d];if(T(fx,fy)){cx=fx;cy=fy;s=1-b.s;}else s=0;}else s=0;
    // 분기 칸 위였나·터널 안이었나는 화면에 보이는 위치로 본다(칸 번호는 최대 한 칸 뒤라, 터널 입구·출구 근처에서 안에 있는데도 밖으로 잡혔다)
    const fromSw=w.isSwitch(Math.round(px),Math.round(py)),fromTun=w.isTunnel(Math.round(px),Math.round(py))&&w.isTunnel(Math.round(px+DX[h]),Math.round(py+DY[h]));
    b.cx=cx;b.cy=cy;b.s=s;b.d=d;const nb=[cx+DX[d]*s,cy+DY[d]*s];const hid=fromTun;b.slide={ox:px-nb[0],oy:py-nb[1],t:0,hid};
    return {off:w.thud(b,true,fromSw,hid,h,[Math.round(px),Math.round(py)])};}; // hid: 터널 안에서 터널 안으로(안 보임)
  w.step=function(dt){w.t+=dt;w.lightT+=dt;
    // NPC: 초록일 때 흩어져서 한 줄, 노랑일 땐 아주 가끔 늦게(=걸릴 수 있음)
    const rate=(w.light==='green'?WANDER:w.light==='yellow'?w.diff.late:0);
    // 분기 칸 맵: 일반 상자는 분기 칸(과 미끼 자리)에 들어선 직후 한 번만 정한다. 노랑이면 아주 가끔 늦게(late).
    if(w.hasSwitches&&!puppet)for(const b of w.boxes){if(b.kind!=='npc'||b.gone||b.pending||w.midMove(b))continue;if(b.tunPass&&!w.isTunnel(b.cx,b.cy))b.tunPass=false;if(b.s>.5)continue;const key=b.cx+','+b.cy;if(b.swKey===key)continue;
      if(w.isTunnel(b.cx,b.cy)){b.swKey=key;if(!b.tunPass){b.tunPass=true;if(rng()<TUN_P){const h=w.tunSide(b);if(h>=0)w.hop(b,h);}}continue;} // 터널 안: 신호와 상관없이 가끔 갈아탐
      const sw=w.isSwitch(b.cx,b.cy),bait=!sw&&w.nearSwitch(b.cx,b.cy);if(!sw&&!bait)continue;b.swKey=key;
      const ok=w.light==='green'||(w.light==='yellow'&&rng()<w.diff.late);if(ok&&rng()<(sw?SW_P:SW_BAIT)){const h=w.randSide(b);if(h>=0)w.hop(b,h);}}
    if(rate>0&&!w.hasSwitches&&!puppet)for(const b of w.boxes){if(b.kind!=='npc'||b.gone||b.pending||w.midMove(b)||b.lastWin===w.win)continue;if(rng()<dt*rate){const h=w.randSide(b);if(h>=0)w.hop(b,h);}}
    // 차간 거리
    const P=w.boxes.map(b=>(b.gone||b.pending)?null:w.pos(b));
    w.boxes.forEach((b,i)=>{b.follow=1;if(!P[i])return;const hx=DX[b.d],hy=DY[b.d];
      for(let j=0;j<w.boxes.length;j++){if(j===i||!P[j])continue;if(w.boxes[j].d!==b.d||w.boxes[j].slide)continue;const rx=P[j][0]-P[i][0],ry=P[j][1]-P[i][1];const al=rx*hx+ry*hy;if(al<=0||al>.95)continue;const lat=Math.abs(rx*hy-ry*hx);if(lat>.42)continue;
        b.follow=Math.min(b.follow,Math.max(0,(al-.62)/.33));}});
    for(const b of w.boxes){if(b.gone)continue;if(b.slide){b.slide.t+=dt/.38;if(b.slide.t>=1)b.slide=null;}
      if(b.pending){respawn(b);continue;}b.sus=Math.max(0,b.sus-dt*.35);
      let s=b.s+BASE*b.follow*dt;
      while(s>=1){s-=1;let nx=b.cx+DX[b.d],ny=b.cy+DY[b.d];let wrapped=false;if(!T(nx,ny)){[nx,ny]=wrap(nx,ny);wrapped=true;}
        if(!T(nx,ny)){s=0;break;}b.cx=nx;b.cy=ny;if(wrapped)b.slide=null;arrive(b);if(b.pending)break;}
      if(!b.pending)b.s=s;}
  };
  // 친구와 하기: 상자 상태를 짧은 배열로 주고받는다 [id,cx,cy,d,s,크기,무늬,상태비트,slide t,ox,oy]
  w.packBoxes=function(){return w.boxes.map(b=>{const f=(b.gone?1:0)|(b.pending?2:0)|(b.found?4:0)|(b.alert?8:0)|(b.slide&&b.slide.hid?16:0);const a=[b.id,b.cx,b.cy,b.d,+b.s.toFixed(3),b.size,b.pat|0,f];
    if(b.slide&&b.slide.t<1)a.push(+b.slide.t.toFixed(2),+b.slide.ox.toFixed(2),+b.slide.oy.toFixed(2));return a;});};
  w.loadBoxes=function(arr,keep){for(const a of arr){let b=w.boxes.find(o=>o.id===a[0]);
      if(!b){b={id:a[0],kind:'npc',follow:1,sus:0,deliv:0,lastWin:-1,slide:null};w.boxes.push(b);}
      const f=a[7];b.size=a[5];b.pat=a[6];b.gone=!!(f&1);b.found=!!(f&4);b.alert=!!(f&8);if(keep&&keep(b))continue;
      b.cx=a[1];b.cy=a[2];b.d=a[3];b.s=a[4];b.pending=!!(f&2);b.slide=a.length>8?{t:a[8],ox:a[9],oy:a[10],hid:!!(f&16)}:null;}};
  return w;}
// 직원(AI)의 신호 조작: 초록 길이는 들쭉날쭉, 가끔 짧게 끊는 낚시
function signalAI(diff,rng){rng=rng||Math.random;const r=(a)=>a[0]+rng()*(a[1]-a[0]);let next=r(diff.green);
  return function(w,dt){if(w.light==='green'){if(w.lightT>=next){w.setLight('yellow');}}
    else if(w.light==='yellow'){if(w.lightT>=diff.yellow){w.setLight('red');next=r(diff.red);}}
    else if(w.lightT>=next){w.setLight('green');next=rng()<diff.fake?.4+rng()*.5:r(diff.green);}};}
// ===== 코인 =====
// 코인은 이웃한 두 레일 사이 경계 위에 뜬다. 그 경계를 코인 자리에서 옆으로 넘어갈 때만 먹힌다.
// 그래서 코인 = 넘어가기 한 번(들킬 위험을 지는 행동)이고, 실려만 가서는 절대 못 먹는다. 덧댄 예외 규칙이 필요 없다.
// 코인 {id, a:[x,y], b:[x,y] (a에서 h 방향 옆 칸), h: 0 가로로 이웃 | 1 세로로 이웃, x,y: 경계 가운데, sw: 분기 칸 옆인가, t: 남은 수명}
const COIN_N=4,COIN_LIFE=14,COIN_GOAL=4;
// 코인이 뜰 수 있는 경계: 두 칸 다 일반 벨트(분기 칸 포함, 터널·입고·출고 제외)이고 둘 다 경계와 나란히 흐를 때(그래야 넘어갈 수 있다)
function coinSeams(w){if(w._seams)return w._seams;const out=[],ok=(t,h)=>t&&t.t==='belt'&&!t.tun&&t.d%2!==h%2;
  for(let y=0;y<w.H;y++)for(let x=0;x<w.W;x++)for(const h of [0,1]){const a=w.T(x,y),b=w.T(x+DX[h],y+DY[h]);
    if(ok(a,h)&&ok(b,h))out.push({a:[x,y],b:[x+DX[h],y+DY[h]],h,x:x+DX[h]/2,y:y+DY[h]/2,sw:!!(a.sw||b.sw)});}
  return w._seams=out;}
// 새 코인 하나: 다른 코인과 2.5칸(가로+세로) 넘게 떨어진 경계, 되도록 다른 코인과 다른 경계 줄
function newCoin(w,coins,rng){rng=rng||Math.random;const all=coinSeams(w),far=s=>coins.every(c=>Math.abs(c.x-s.x)+Math.abs(c.y-s.y)>=2.5),
  line=s=>s.h===1?'h'+s.y:'v'+s.x;let c=all.filter(s=>far(s)&&coins.every(o=>line(o)!==line(s)));if(!c.length)c=all.filter(far);if(!c.length)return null;
  const s=c[(rng()*c.length)|0];w.coinId=(w.coinId||0)+1;return {id:w.coinId,a:s.a,b:s.b,h:s.h,x:s.x,y:s.y,sw:s.sw,t:COIN_LIFE*(.7+rng()*.3)};}
function initCoins(w,rng){const coins=[];for(let i=0;i<COIN_N;i++){const c=newCoin(w,coins,rng);if(c)coins.push(c);}return coins;}
// 넘어가기(thud 이벤트)가 지난 코인 경계: 넘기 전 칸과 넘은 쪽 칸이 코인의 두 칸이면 그 코인
function coinCrossed(coins,ev){if(!ev||ev.h==null||!ev.from)return null;const [fx,fy]=ev.from,tx=fx+DX[ev.h],ty=fy+DY[ev.h],is=(p,x,y)=>p[0]===x&&p[1]===y;
  return coins.find(c=>(is(c.a,fx,fy)&&is(c.b,tx,ty))||(is(c.b,fx,fy)&&is(c.a,tx,ty)))||null;}
// 한 걸음: 수명이 다 된 코인은 다른 경계로 옮긴다(존버 방지). who(상자)가 참인 상자의 넘어가기 중 코인 경계를 지난 것을 먹은 걸로 센다.
// 같은 코인은 상자마다 한 번(코인은 먹어도 그대로 있다. 사라지면 누가 먹었는지 들통나서). 먹은 [상자, 코인] 목록을 돌려준다
function coinStep(w,coins,dt,who,rng){coins.forEach((c,i)=>{c.t-=dt;if(c.t<=0){const n=newCoin(w,coins.filter(o=>o!==c),rng);if(n)coins[i]=n;else c.t=COIN_LIFE;}});
  const got=[];for(const ev of w.events){if(ev.type!=='thud'||!who(ev.b))continue;const c=coinCrossed(coins,ev);const b=ev.b;b.took=b.took||new Set();
    if(c&&!b.took.has(c.id)){b.took.add(c.id);b.got=(b.got|0)+1;got.push([b,c]);}}
  return got;}
// 상자에서 코인 경계까지: lat = 경계 쪽으로 몇 레일(0 = 경계의 두 레일 중 하나에 있음), fwd = 실려 가서 코인 자리까지 몇 칸
function coinGap(w,b,c){const t0=w.T(b.cx,b.cy);if(!t0||t0.d%2===c.h%2)return null;const [px,py]=w.pos(b);
  const lat=c.h===1?py:px,la=c.h===1?c.a[1]:c.a[0],al=c.h===1?px:py,ca=c.h===1?c.a[0]:c.a[1],sgn=c.h===1?DX[t0.d]:DY[t0.d],span=c.h===1?w.W:w.H;
  let fwd=(ca-al)*sgn;if(fwd<-.5)fwd+=span;return {lat:Math.round(lat),la,dl:Math.max(0,Math.min(Math.abs(Math.round(lat)-la),Math.abs(Math.round(lat)-la-1))),fwd};}
// 이 상자가 노릴 코인: 아직 안 먹은 것 중 (레일 거리 + 실려 가는 시간)이 가장 짧은 것. 수명 안에 못 닿으면 뒤로,
// 분기 칸 옆이 아닌 코인은 건너면 티가 나므로 1.5초어치 덜 끌린다(일반 상자도 넘어가는 분기 칸 옆 코인을 먼저)
function pickCoin(w,b,coins){let best=null,bc=1e9;for(const c of coins){if(b.took&&b.took.has(c.id))continue;const g=coinGap(w,b,c);if(!g)continue;
  const cost=g.fwd/BASE+g.dl*.9+(g.fwd/BASE>c.t?6:0)+(c.sw?0:1.5);if(cost<bc){bc=cost;best=c;}}return best;}
// 코인을 먹으려면 어느 쪽으로 넘어가나. 경계의 두 레일 중 하나에 있으면 건너편으로(ready = 지금 코인 자리라 넘으면 먹음), 아니면 경계 쪽 레일로
function coinDir(w,b,c){const g=c&&coinGap(w,b,c);if(!g)return {h:-1,ready:false,on:false};const on=g.lat===g.la||g.lat===g.la+1;
  let h=on?(g.lat===g.la?c.h:c.h+2):(g.lat<g.la?c.h:c.h+2);h%=4;if(h%2===b.d%2)return {h:-1,ready:false,on};
  const nt=w.T(b.cx+DX[h],b.cy+DY[h]);if(!nt||nt.t==='exit')return {h:-1,ready:false,on};
  return {h,on,ready:on&&Math.abs(g.fwd)<.5};}
if(typeof module!=='undefined')module.exports={TUN_P,SW_P,SW_BAIT,WANDER,BASE,COIN_N,COIN_LIFE,COIN_GOAL,coinSeams,newCoin,initCoins,coinCrossed,coinStep,coinGap,pickCoin,coinDir,signalAI,createWorld,MAPS,TILES,parseMap,mapToStr,parseTile,tileToken,laneMap,DIFF,DIRS,DX,DY};
