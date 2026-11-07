// ===== 친구와 하기 (1:1) =====
// 같은 링크를 연 두 사람, presence만 쓴다. 술래가 판 전체를 돌리고 0.1초마다 snap을 뿌린다(노랑은 바로).
// 숨는 쪽은 같은 맵을 puppet 세계로 따라 그리고, 넘어가기는 바로 보여 주며 q로 보낸다.
// 걸림 판정은 숨는 쪽 화면이 한다: 노랑을 받은 순간부터 자기 시계로 빨강을 켜고, 걸리면 al을 올린다. 술래 화면은 숨는 쪽 상자를 스스로 판정하지 않는다.
// presence {nb:1, r:'seek'|'hide', sw:역할 바꾸기 누른 횟수, ph:'lobby'|'play'|'end', map, ep:판 번호, as:[[peer, 상자 id]], snap, q:[[번호, 방향]], al:걸림 횟수}
const NET_MAP='compact';let net=null,ROOM=null,roomState='wait';
(async()=>{try{const c=window.claude;if(!c||!c.use){roomState='none';return;}ROOM=await c.use('room');roomState=ROOM?'ok':'none';}catch(e){roomState='none';}if(mode===null&&$('netNote'))$('netNote').textContent=netNote();})();
function netNote(){return roomState==='none'?'실시간 방에 연결할 수 없어요. claude.ai에 로그인해서 연 링크(초대받은 사람)끼리만 돼요.':roomState==='wait'?'방 연결 확인 중…':'같은 링크를 연 친구와 1:1. 술래와 숨는 쪽은 방에서 바꿀 수 있어요.';}
const myPeer=()=>{const m=ROOM&&ROOM.peers().find(p=>p.sameTab);return m?m.peer:null;};
const otherOf=peers=>peers.find(p=>!p.sameTab&&p.presence&&p.presence.nb);
function netPush(patch){if(!net)return;Object.assign(net.me,patch);ROOM.presence(patch).catch(e=>{if(e&&e.code==='invalid_argument')console.warn('presence',e.message);});}
function setRole(r){net.r=r;net.role=r==='seek'?'host':'hider';netPush({r});}
function netOpen(){if(!ROOM){say(roomState==='wait'?'방 연결 확인 중이에요. 잠시 뒤 다시':'실시간 방에 연결할 수 없어요',2.5);return;}
  if(net)netLeave();const o=otherOf(ROOM.peers()),r=o&&o.presence.r==='seek'?'hide':'seek';
  net={r,role:r==='seek'?'host':'hider',me:{},ep:0,seen:0,q:[],seq:0,hopAt:0,snapT:0,frozen:false,sw:0,swSeen:0,peer:null,al:0,alSeen:0};
  net.unsub=ROOM.onPeers(ch=>netPeers(ch.peers));
  netPush({nb:1,r,sw:0,ph:'lobby',map:null,ep:0,as:null,snap:null,q:[],al:0,res:null,win:null});netLobby();}
function netLeave(){if(!net)return;const n=net;net=null;if(n.unsub)n.unsub();ROOM.presence({nb:null,r:null,sw:null,ph:null,map:null,ep:null,as:null,snap:null,q:null,al:null,res:null,win:null}).catch(()=>{});}
function netLobby(){if(!net)return;idleUi('<b>친구와 1:1</b>');curKey=NET_MAP;if(!world||world.puppet)newWorld();
  if(net.r==='seek')netPush({ph:'lobby',snap:null,res:null});
  $('panelBox').innerHTML=`<h1>친구와 1:1</h1><p id="lobbyL"></p><div class="row"><button id="netGo">시작</button><button class="alt" id="netSw">역할 바꾸기</button><button class="alt" id="toMenu">나가기</button></div>`;
  $('netGo').onclick=netStart;$('netSw').onclick=()=>{net.sw++;netPush({sw:net.sw});setRole(net.r==='seek'?'hide':'seek');lobbyText();};$('toMenu').onclick=()=>menu();netPeers(ROOM.peers());}
function lobbyText(o){if(!$('lobbyL'))return;o=o||otherOf(ROOM.peers());const nm=r=>r==='seek'?'술래(직원)':'숨는 쪽(상자)';
  $('lobbyL').textContent=!o?`나는 ${nm(net.r)}. 친구를 기다리는 중… 친구가 같은 링크에서 "친구와 1:1"을 누르면 들어와요.`:`나는 ${nm(net.r)}, 친구는 ${nm(o.presence.r)}. `+(net.r==='seek'?'시작을 누르면 같이 시작해요.':'술래가 시작하면 바로 시작해요.');
  $('netGo').hidden=net.r!=='seek';$('netGo').disabled=!o;}
function netStart(){if(!net||net.r!=='seek')return;const o=otherOf(ROOM.peers());if(!o||o.presence.r!=='hide'){say('숨는 쪽 친구가 아직 없어요',2);return;}
  curKey=NET_MAP;start('seek');if(mode!=='seek')return;
  bots.slice(1).forEach(b=>{b.kind='npc';b.stamp=null;});bots=bots.slice(0,1); // 1:1이라 AI 숨은 상자는 없다
  const b=bots[0];b.remote=o.peer;b.src='friend';
  net.ep=Date.now()%1e9;net.seen=Math.max(0,...((o.presence.q||[]).map(x=>x[0])));net.alSeen=o.presence.al||0;
  net.snapT=0;netPush({ph:'play',map:curKey,ep:net.ep,as:[[o.peer,b.id]],snap:netSnap(),res:null,win:null});}
function netSnap(){world.boxes.forEach(b=>{const m=meshes.get(b);b.alert=!!(m&&m.alert);});
  return {t:+time.toFixed(1),L:world.light,lt:+world.lightT.toFixed(2),pz:paused?1:0,bx:world.packBoxes(),po:pool.map(s=>[s.id,s.x,s.y,+s.t.toFixed(1)]),hs:bots.map(b=>[b.id,b.got|0,[...(b.took||[])],b.found?1:0,b.gone?1:0]),sc:[found,escaped,scans]};}
function remoteHop(b,h){if(b.found||b.gone||b.pending||mode!=='seek'||over)return;if(world.midMove(b)){b.q={h,t:performance.now()};return;}if(h%2!==b.d%2)world.hop(b,h);}
function netHop(h){net.hopAt=performance.now();net.q=[...net.q,[++net.seq,h]].slice(-8);netPush({q:net.q});}
function netAlert(){net.al++;netPush({al:net.al});}
function netPeers(peers){if(!net)return;const o=otherOf(peers),P=o?o.presence:null,idle=mode===null||over;
  if(!o)net.peer=null;else if(net.peer!==o.peer){net.peer=o.peer;net.swSeen=P.sw||0;}
  if(P&&(P.sw||0)>net.swSeen){net.swSeen=P.sw;if(idle)setRole(net.r==='seek'?'hide':'seek');} // 친구가 역할 바꾸기를 누르면 나도 바뀐다
  // 동시에 들어와 역할이 겹치면 peer 순서로 나눈다. 바꾸기 직후 친구가 아직 안 바뀐 순간은 겹침이 아니므로 1초 이어질 때만
  if(P&&idle&&P.r===net.r){if(!net.clash)net.clash=setTimeout(()=>{if(!net)return;net.clash=null;const ps=ROOM.peers(),q=otherOf(ps),me=myPeer();if(q&&q.presence.r===net.r&&(mode===null||over)){setRole(me&&me<q.peer?'seek':'hide');if(mode===null)lobbyText(q);}},1000);}
  if(mode===null)lobbyText(o);
  if(net.role==='host'){if(mode!=='seek'||over)return;const b=bots[0];
    if(!o||o.peer!==b.remote||P.r!=='hide'){end(false,'친구가 나갔어요.');return;}
    for(const [n,h] of (P.q||[]))if(n>net.seen){net.seen=n;remoteHop(b,h);}
    if((P.al||0)>net.alSeen){net.alSeen=P.al;alertOn(b);}
    return;}
  // 숨는 쪽
  if(!o||P.r!=='seek'){if(mode==='hide'&&!over)end(false,'친구가 나갔어요.');return;}
  if(P.ph==='play'&&P.ep!==net.ep&&P.snap){const a=(P.as||[]).find(x=>x[0]===myPeer());if(a&&idle){net.ep=P.ep;startRemote(P.map,a[1],P.snap);}return;}
  if(P.ep!==net.ep||mode!=='hide')return;
  if(P.ph==='play'&&P.snap)applySnap(P.snap);
  else if(P.ph==='end'&&!over){if(P.snap)applySnap(P.snap);if(!over)end(!P.win,(P.win?'술래가 찾았다. ':'끝까지 안 들켰다. ')+(P.res||''));} // 숨는 쪽 결과 = 술래 결과의 반대
  else if(P.ph==='lobby'&&!over)end(false,'술래가 판을 끝냈어요.');}
function startRemote(mapKey,id,snap){goFull();initSound();if(mapList().some(m=>m.k===mapKey))curKey=mapKey;mode='hide';over=false;paused=false;
  world=createWorld(curEntry().str,Object.assign(wopt(),{puppet:true}));buildTiles(world.tiles);clearMeshes();fitCam();clearStamps();pool=[];
  goal=STAMPS;time=snap.t;scans=6;found=0;escaped=0;hunt={t:0,target:null,aim:0,scans:snap.sc[2],stun:0};bots=[];hideMarks();rec=null;hopQ=null;
  world.loadBoxes(snap.bx);world.light=snap.L;world.lightT=snap.lt;player=world.boxes.find(b=>b.id===id);player.kind='player';player.got=0;player.took=new Set();
  meArrow.visible=true;applySnap(snap);
  playUi('hide','<b>숨는 쪽</b> · 친구와 1:1');$('susWrap').hidden=true;say('친구가 술래. 코인 4개!',2);}
function applySnap(s){if(!world||!world.puppet||!player)return;time=s.t;net.frozen=!!s.pz;
  // 신호: 노랑은 받은 순간 켜고 빨강은 내 시계로(frame). 내가 이미 빨강이면 늦게 온 노랑은 무시
  if(s.L==='green'&&world.light!=='green')world.setLight('green');else if(s.L==='yellow'&&world.light==='green')world.setLight('yellow');else if(s.L==='red'&&world.light!=='red')world.setLight('red');
  // 덮어쓰기 전 화면 위치를 기억했다가, 0.8칸 안으로 튀면(출고 뒤 다시 나오는 건 그대로 순간 이동) 그 차이를 그리는 위치에서만 0.12초에 걸쳐 메운다(loop.js b.vo). 버벅임 원인이었음
  const before=new Map();world.boxes.forEach(b=>{if(!b.gone&&!b.pending){const [x,y]=world.pos(b);before.set(b,[x+(b.vo?b.vo[0]:0),y+(b.vo?b.vo[1]:0)]);}});
  world.loadBoxes(s.bx,b=>b===player&&performance.now()-net.hopAt<700); // 방금 내가 넘어간 건 술래 화면에 닿을 때까지 내 화면 그대로
  before.forEach((p,b)=>{if(b.gone||b.pending){b.vo=null;return;}const [x,y]=world.pos(b),dx=p[0]-x,dy=p[1]-y;b.vo=Math.hypot(dx,dy)<.8?[dx,dy]:null;});
  world.boxes.forEach(b=>{const m=meshFor(b);if(b.alert)alertOn(b);if(b.found&&!m.red){m.red=1;m.body.material=redMat;}});
  const ids=new Set(s.po.map(a=>a[0]));pool=pool.filter(c=>{if(ids.has(c.id))return true;S.remove(c.mesh);stampMeshes=stampMeshes.filter(g=>g!==c.mesh);return false;});
  for(const [id,x,y,t] of s.po){let c=pool.find(o=>o.id===id);if(!c){c={id,x,y,t,mesh:stampMesh()};pool.push(c);}c.x=x;c.y=y;c.t=t;c.mesh.position.set(wx(x),0,wz(y));}
  hunt.scans=s.sc[2];const me=s.hs.find(h=>h[0]===player.id);
  if(me){if(me[1]>player.got)say(`코인 ${me[1]}/${goal}`);player.got=me[1];player.took=new Set(me[2]);poolAim(player);
    if(me[3]&&!over){end(false,`코인 ${player.got}/${goal}에서 술래에게 찍힘.`,player.got*100);return;}
    if(me[4]&&!over){end(true,`코인 ${goal}개 모으고 빠져나감.`,1000);return;}}}

