// ===== 택배 숨바꼭질 엔진 (규칙만, 화면 없음) =====
// 브라우저에선 빌드 때 dist/index.html 안에 들어가고, node에선 require로 불러 테스트한다.
// 설계 설명: docs/2-design/engine.md, ai.md, balance.md
const DIRS='>v<^',DX=[1,0,-1,0],DY=[0,1,0,-1];
const SPD={n:1,f:1.55,s:.6},BASE=1.25; // 칸/초
const CYCLE=4,ON=1.2,WARN=1;
const WANDER=.45; // 색 끔일 때 일반 상자가 초록에 옆으로 옮기는 빈도(초당, 한 초록에 한 번까지)
// 벨트 정지 시험(v12-stop): 빨강이면 벨트가 서고, 일반 상자는 0~NPC_LAG초 미끄러지다 선다(초록에 다시 갈 때도 0~NPC_LAG초 늦게).
// 일반 상자 중 NPC_LATE 비율은 빨강마다 GRACE를 넘겨 늦게 선다(미끼).
// 사람 상자는 go가 참일 때 간다(기본은 감, 누르고 있는 동안 go=false). 빨강이 GRACE초 지났는데도 가고 있으면 걸림.
// 옆 레일로 넘어가던 상자도 빨강 뒤 GRACE초까지는 마저 넘어가고, 그때도 걸쳐 있으면 걸림.
const NPC_LAG=.22,GRACE=.45,NPC_LATE=.04;
const DIFF={easy:{name:'쉬움',yellow:.65,late:.35,green:[1.6,4.2],red:[1.4,2.4],fake:.12,aim:1.0,slack:1.6,k:1.4},normal:{name:'보통',yellow:.45,late:.22,green:[1.0,3.8],red:[1.6,2.8],fake:.2,aim:.75,slack:1.25,k:1},hard:{name:'어려움',yellow:.3,late:.12,green:[.6,3.4],red:[1.8,3.2],fake:.3,aim:.55,slack:1.0,k:.7}};
function laneMap(rows,bars){const W=14,g=[Array(W).fill('..')];
  rows.forEach(r=>{const t=Array(W).fill(r.sp+r.d);const right=r.d==='>';t[right?0:W-1]='I'+r.d;t[right?W-1:0]='X'+r.d+r.c;bars.forEach(c=>t[c]='S'+r.d);Object.entries(r.ex||{}).forEach(([k,v])=>t[+k]=v);g.push(t);});
  g.push(Array(W).fill('..'));return g.map(r=>r.join(' ')).join('/');}
const MAPS={
  plain:{name:'기본',str:laneMap([{d:'>',sp:'n',c:0},{d:'<',sp:'n',c:1},{d:'>',sp:'n',c:2},{d:'>',sp:'n',c:3}],[])},
  basic:{name:'기본(섞임)',str:laneMap([{d:'>',sp:'n',c:0},{d:'<',sp:'f',c:1},{d:'>',sp:'s',c:2,ex:{6:'J>'}},{d:'>',sp:'n',c:3}],[])},
  five:{name:'다섯 줄',str:laneMap([{d:'>',sp:'n',c:0},{d:'>',sp:'f',c:1,ex:{5:'C>3'}},{d:'<',sp:'n',c:2},{d:'>',sp:'s',c:3,ex:{8:'J>'}},{d:'<',sp:'n',c:4,ex:{10:'C<0'}}],[])}
};
function parseTile(tok){if(!tok||tok==='..')return null;const t=tok[0],d=DIRS.indexOf(tok[1]);if(d<0)return null;
  switch(t){case 'n':case 'f':case 's':return {t:'belt',sp:t,d};
    case 'S':return {t:'belt',sp:'n',d};
    case 'T':{const s=DIRS.indexOf(tok[2]);return s<0?null:{t:'turn',d,s,per:Math.max(1,+tok[3]||2)};}
    case 'J':return {t:'jam',d};case 'C':return {t:'relabel',d,c:Math.min(4,+tok[2]||0)};case 'X':return {t:'exit',d,c:Math.min(4,+tok[2]||0)};
    case 'I':return {t:'spawn',d};case 'G':return {t:'belt',sp:'n',d};}return null;}
function tileToken(t){if(!t)return '..';const D=DIRS[t.d];switch(t.t){case 'belt':return t.sp+D;case 'sort':return 'S'+D;case 'turn':return 'T'+D+DIRS[t.s]+t.per;
  case 'jam':return 'J'+D;case 'relabel':return 'C'+D+t.c;case 'exit':return 'X'+D+t.c;case 'spawn':return 'I'+D;}return '..';}
function parseMap(str){const rows=str.trim().split('/').map(r=>r.trim().split(/\s+/));const H=rows.length,W=Math.max(...rows.map(r=>r.length));
  return {W,H,tiles:rows.map(r=>Array.from({length:W},(_,x)=>parseTile(r[x])))};}
function mapToStr(m){return m.tiles.map(r=>r.map(tileToken).join(' ')).join('/');}

function createWorld(str,opt){opt=opt||{};const rng=opt.rng||Math.random;const {W,H,tiles}=parseMap(str);const diff=DIFF[opt.diff||'normal'];
  const cells=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(tiles[y][x])cells.push([x,y]);
  const colors=[...new Set(cells.map(([x,y])=>tiles[y][x]).filter(t=>t.t==='exit').map(t=>t.c))];if(!colors.length)colors.push(0);
  const spawns=cells.filter(([x,y])=>tiles[y][x].t==='spawn');
  // colorsOn=false(v12 기본): 일반 상자는 초록 때 무작위로 옆 레일, 출고구는 색 상관없이 받는다
  const colorsOn=opt.colors!==false,beltStop=!!opt.beltStop;
  const w={W,H,tiles,colors,diff,colorsOn,beltStop,boxes:[],t:0,light:'green',lightT:0,sortOn:true,win:0,events:[]};
  const T=(x,y)=>(x>=0&&y>=0&&x<W&&y<H)?tiles[y][x]:null;w.T=T;
  const wrap=(x,y)=>[(x+W)%W,(y+H)%H];
  const hopable=t=>t&&t.t!=='turn'&&t.t!=='exit';
  // 색마다 출고까지 거리
  const dist={};for(const c of colors){const D=tiles.map(r=>r.map(()=>1e9));const q=[];cells.forEach(([x,y])=>{const t=tiles[y][x];if(t.t==='exit'&&t.c===c){D[y][x]=0;q.push([x,y]);}});
    const preds={};cells.forEach(([x,y])=>{const t=tiles[y][x];const outs=t.t==='turn'?[t.d,t.s]:[t.d];outs.forEach(d=>{let [nx,ny]=wrap(x+DX[d],y+DY[d]);if(T(nx,ny))(preds[nx+','+ny]=preds[nx+','+ny]||[]).push([x,y]);});
      if(hopable(t))for(let d=0;d<4;d++){const nx=x+DX[d],ny=y+DY[d];const nt=T(nx,ny);if(nt&&hopable(nt)&&d%2!==t.d%2)(preds[nx+','+ny]=preds[nx+','+ny]||[]).push([x,y,1]);}});
    while(q.length){const [x,y]=q.shift();(preds[x+','+y]||[]).forEach(([px,py,side])=>{const v=D[y][x]+(side?2:1);if(D[py][px]>v){D[py][px]=v;q.push([px,py]);}});}
    dist[c]=D;}
  w.dist=(c,x,y)=>dist[c]?dist[c][y][x]:1e9;
  // 레일 색: 이 칸에서 곧장 가면 닿는 출고구 색
  const laneC=tiles.map((r,y)=>r.map((t,x)=>{if(!t)return -1;let cx=x,cy=y,d=t.d;for(let i=0;i<W*H;i++){const tt=tiles[cy][cx];if(!tt||tt.t==='turn')return -1;if(tt.t==='exit')return tt.c;d=tt.d;[cx,cy]=wrap(cx+DX[d],cy+DY[d]);}return -1;}));
  w.laneC=(x,y)=>(T(x,y)?laneC[y][x]:-1);
  // 노란 막대에서 이 상자가 가야 할 옆 방향(-1 = 안 감)
  w.bestSide=(b,x,y)=>{const t=T(x,y);if(!hopable(t)||laneC[y][x]===b.dest)return -1;let best=-1,bd=w.dist(b.dest,x,y);
    for(const h of [(t.d+1)%4,(t.d+3)%4]){const nx=x+DX[h],ny=y+DY[h];if(!hopable(T(nx,ny)))continue;const v=w.dist(b.dest,nx,ny);if(v<bd){bd=v;best=h;}}return best;};
  // 색 없이: 넘어갈 수 있는 옆 방향 중 아무거나(-1 = 못 감)
  w.randSide=b=>{const t=T(b.cx,b.cy);if(!hopable(t))return -1;const o=[(t.d+1)%4,(t.d+3)%4].filter(h=>hopable(T(b.cx+DX[h],b.cy+DY[h])));return o.length?o[(rng()*o.length)|0]:-1;};
  w.turnDir=(t,x,y)=>Math.floor((w.t+(x+y)*.37)/t.per)%2?t.s:t.d;
  w.jamOpen=(x,y)=>((w.t+x*.7+y*.3)%5)<2.2;
  const human=b=>b.kind!=='npc';
  w.add=function(kind){const free=cells.filter(([x,y])=>!w.boxes.some(b=>!b.gone&&b.cx===x&&b.cy===y)&&tiles[y][x].t!=='exit');if(!free.length)return null;const [x,y]=free[(rng()*free.length)|0];
    const b={id:w.boxes.length,kind,dest:colors[(rng()*colors.length)|0],size:[1.25,1.5,1.75][(rng()*3)|0],cx:x,cy:y,d:tiles[y][x].d,s:rng()*.9,mul:1,follow:1,sus:0,deliv:0,gone:false,found:false,pending:false,slide:null,hold:0,fakeT:0,lastWin:-1,go:true,lagS:rng()*NPC_LAG,lagG:rng()*NPC_LAG,caughtWin:-1};
    if(tiles[y][x].t==='sort'||tiles[y][x].t==='turn')b.s=0;w.boxes.push(b);return b;};
  w.center=(x,y)=>[x,y];
  w.pos=b=>{let x=b.cx+DX[b.d]*b.s,y=b.cy+DY[b.d]*b.s;if(b.slide){const k=1-Math.min(1,b.slide.t);x+=b.slide.ox*k;y+=b.slide.oy*k;}return [x,y];};
  w.midMove=b=>!!(b.slide&&b.slide.t<1);
  function respawn(b){const free=spawns.filter(([x,y])=>!w.boxes.some(o=>o!==b&&!o.gone&&!o.pending&&Math.hypot(o.cx+DX[o.d]*o.s-x,o.cy+DY[o.d]*o.s-y)<1));
    if(!free.length){b.pending=true;return;}const [x,y]=free[(rng()*free.length)|0];b.cx=x;b.cy=y;b.d=tiles[y][x].d;b.s=0;b.pending=false;b.slide=null;}
  // 칸 중앙 도착: 다음 방향을 정한다
  function arrive(b){const t=tiles[b.cy][b.cx];
    if(t.t==='relabel'){b.dest=t.c;}
    if(t.t==='exit'&&(t.c===b.dest||!colorsOn)){b.deliv++;w.events.push({type:'deliver',b});
      if(b.kind==='npc')b.dest=colors[(rng()*colors.length)|0];else{const o=colors.filter(c=>c!==b.dest);if(o.length)b.dest=o[(rng()*o.length)|0];}
      respawn(b);return;}
    if(t.t==='turn'){b.d=w.turnDir(t,b.cx,b.cy);return;}
    b.d=t.d;}
  // 신호: 초록(등 돌림) → 노랑(돌아보는 중) → 빨강(봄)
  w.setLight=function(s){if(w.light===s)return;w.light=s;w.lightT=0;w.sortOn=s==='green';if(s==='green')w.win++;
    if(beltStop){w.graceDone=false;for(const b of w.boxes){if(s==='red')b.lagS=rng()<NPC_LATE?GRACE+.05+rng()*.25:rng()*NPC_LAG;if(s==='green')b.lagG=rng()*NPC_LAG;}}
    if(s==='red'&&!beltStop)for(const b of w.boxes){if(b.gone||b.pending)continue;if(w.midMove(b)||(!beltStop&&b.kind!=='npc'&&b.mul!==1))w.events.push({type:'frozen',b,x:w.pos(b)[0],y:w.pos(b)[1]});}
    w.events.push({type:'light',s});};
  // 사람 상자의 옆 칸 갈아타기
  w.thud=function(b,move){const [x,y]=w.pos(b);const off=w.light==='red';if(move)b.lastWin=w.win;w.events.push({type:'thud',b,x,y,off});return off;};
  w.hop=function(b,h){if(b.pending||b.gone||b.slide&&b.slide.t<1)return null;if(h%2===b.d%2)return null;
    const here=tiles[b.cy][b.cx];if(!hopable(here))return null;
    const [px,py]=w.pos(b);const nx=b.cx+DX[h],ny=b.cy+DY[h];const nt=T(nx,ny);if(!hopable(nt))return null;
    const dir2=nt.d;let cx=nx,cy=ny,s=b.s,d=dir2;
    if(dir2===b.d){}else if(dir2===(b.d+2)%4){const fx=nx+DX[b.d],fy=ny+DY[b.d];if(T(fx,fy)){cx=fx;cy=fy;s=1-b.s;}else s=0;}else s=0;
    b.cx=cx;b.cy=cy;b.s=s;b.d=d;const nb=[cx+DX[d]*s,cy+DY[d]*s];b.slide={ox:px-nb[0],oy:py-nb[1],t:0};
    return {off:w.thud(b,true)};};
  w.step=function(dt){w.t+=dt;w.lightT+=dt;
    // NPC: 초록일 때 흩어져서 한 줄, 노랑일 땐 아주 가끔 늦게(=걸릴 수 있음)
    const rate=(w.light==='green'?(colorsOn?1.3:WANDER):w.light==='yellow'?w.diff.late:0);
    if(rate>0)for(const b of w.boxes){if(b.kind!=='npc'||b.gone||b.pending||w.midMove(b)||b.lastWin===w.win)continue;if(rng()<dt*rate){const h=colorsOn?w.bestSide(b,b.cx,b.cy):w.randSide(b);if(h>=0)w.hop(b,h);}}
    // 차간 거리
    const P=w.boxes.map(b=>(b.gone||b.pending)?null:w.pos(b));
    w.boxes.forEach((b,i)=>{b.follow=1;if(!P[i])return;const hx=DX[b.d],hy=DY[b.d];
      for(let j=0;j<w.boxes.length;j++){if(j===i||!P[j])continue;if(w.boxes[j].d!==b.d||w.boxes[j].slide)continue;const rx=P[j][0]-P[i][0],ry=P[j][1]-P[i][1];const al=rx*hx+ry*hy;if(al<=0||al>.95)continue;const lat=Math.abs(rx*hy-ry*hx);if(lat>.42)continue;
        b.follow=Math.min(b.follow,Math.max(0,(al-.62)/.33));}});
    for(const b of w.boxes){if(b.gone)continue;if(b.slide&&(w.light!=='red'||(beltStop&&w.lightT<GRACE))){b.slide.t+=dt/.38;if(b.slide.t>=1)b.slide=null;}
      if(b.pending){respawn(b);continue;}b.sus=Math.max(0,b.sus-dt*.35);if(b.fakeT>0)b.fakeT-=dt;
      if(b.hold>0){b.hold-=dt;continue;}
      if(beltStop){const npc=b.kind==='npc';
        if(w.light==='red'&&w.lightT>GRACE&&b.caughtWin!==w.win&&((!npc&&b.go)||(npc&&b.lagS>GRACE)||w.midMove(b))){b.caughtWin=w.win;const [x,y]=w.pos(b);w.events.push({type:'frozen',b,x,y,late:true});}
        const moving=npc?(w.light==='red'?w.lightT<b.lagS:(w.light==='yellow'||w.lightT>=b.lagG)):b.go;
        if(!moving)continue;}
      const t=tiles[b.cy][b.cx];if(t.t==='jam'&&b.s===0&&!w.jamOpen(b.cx,b.cy))continue;
      const sp=(t.t==='belt'?SPD[t.sp]:1)*BASE*b.mul*b.follow;let s=b.s+sp*dt;
      if(t.t==='jam'&&b.s<1e-9&&s>0&&!w.jamOpen(b.cx,b.cy)){s=0;}
      while(s>=1){s-=1;let nx=b.cx+DX[b.d],ny=b.cy+DY[b.d];let wrapped=false;if(!T(nx,ny)){[nx,ny]=wrap(nx,ny);wrapped=true;}
        if(!T(nx,ny)){s=0;break;}b.cx=nx;b.cy=ny;if(wrapped)b.slide=null;arrive(b);if(b.pending)break;
        if(tiles[b.cy][b.cx].t==='jam'&&!w.jamOpen(b.cx,b.cy)){s=0;break;}}
      if(!b.pending)b.s=s;}
  };
  return w;}
// 직원(AI)의 신호 조작: 초록 길이는 들쭉날쭉, 가끔 짧게 끊는 낚시
function signalAI(diff,rng){rng=rng||Math.random;const r=(a)=>a[0]+rng()*(a[1]-a[0]);let next=r(diff.green);
  return function(w,dt){if(w.light==='green'){if(w.lightT>=next){w.setLight('yellow');}}
    else if(w.light==='yellow'){if(w.lightT>=diff.yellow){w.setLight('red');next=r(diff.red);}}
    else if(w.lightT>=next){w.setLight('green');next=rng()<diff.fake?.4+rng()*.5:r(diff.green);}};}
// 도장: 한 번에 하나씩 켜진다. 다음 도장은 지금 레일과 다른 레일, 가운데 열 중 하나
function nextStamp(w,b,rng){rng=rng||Math.random;const c=[];for(let y=0;y<w.H;y++)for(let x=2;x<w.W-2;x++){const t=w.T(x,y);if(t&&t.t==='belt'&&y!==b.cy)c.push([x,y]);}
  if(!c.length)for(let y=0;y<w.H;y++)for(let x=2;x<w.W-2;x++){const t=w.T(x,y);if(t&&t.t==='belt')c.push([x,y]);}return c.length?c[(rng()*c.length)|0]:null;}
// 도장 칸 쪽 레일로 옮겨야 하면 그 방향(-1=이미 그 줄이거나 못 감)
function stampDir(w,b,s){if(!s||s[1]===b.cy)return -1;const h=s[1]>b.cy?1:3;const nt=w.T(b.cx+DX[h],b.cy+DY[h]);return (nt&&nt.t!=='turn'&&nt.t!=='exit'&&h%2!==b.d%2)?h:-1;}
const STAMPS=4;
// 도장을 찍었나: 칸 번호가 아니라 화면에 보이는 위치로 본다. 옆 레일로 넘어가면 칸 번호는 즉시 바뀌지만 화면에선 0.38초 미끄러지므로,
// 칸 번호로 보면 화면엔 아직 아래 레일에 있는데 도장이 찍히는 일이 생긴다(v12 사용자 지적).
function onStamp(w,b,s){if(!s)return false;const [x,y]=w.pos(b);return Math.abs(x-s[0])<.5&&Math.abs(y-s[1])<.3;}
// 맵마다 "초록일 때만 움직이는" 플레이어가 도장 4개를 모으는 데 걸리는 시간(초, 중간값)
const _cal={};function calibrate(str,opt){opt=opt||{};const key=str+'|'+(opt.colors!==false);if(_cal[key])return _cal[key];let seed=11;const rng=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};const ts=[];
  for(let r=0;r<7;r++){const w=createWorld(str,{rng,colors:opt.colors});const sig=signalAI(DIFF.normal,rng);const n=w.tiles.flat().filter(Boolean).length;for(let i=0;i<Math.round(n*.42);i++)w.add('npc');const p=w.add('player');if(!p)break;
    let got=0,s=nextStamp(w,p,rng),t=0;while(t<300&&got<STAMPS&&s){sig(w,1/20);if(w.light==='green'&&w.lightT>.25&&!w.midMove(p)){const h=stampDir(w,p,s);if(h>=0)w.hop(p,h);}w.step(1/20);w.events=[];t+=1/20;if(onStamp(w,p,s)){got++;s=nextStamp(w,p,rng);}}ts.push(t);}
  ts.sort((a,b)=>a-b);return _cal[key]=ts[(ts.length/2)|0]||90;}
if(typeof module!=='undefined')module.exports={NPC_LATE,NPC_LAG,GRACE,onStamp,STAMPS,nextStamp,stampDir,signalAI,calibrate,createWorld,MAPS,parseMap,mapToStr,parseTile,tileToken,DIFF,DIRS,DX,DY,CYCLE,ON};
