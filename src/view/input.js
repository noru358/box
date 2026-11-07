// ===== 입력: 숨는 쪽(키보드·밀기·톡), 찾는 쪽(돌아보기·스캔) =====
const KD={KeyD:0,ArrowRight:0,KeyS:1,ArrowDown:1,KeyA:2,ArrowLeft:2,KeyW:3,ArrowUp:3};
// 넘어가는 0.38초 중에 누른 건 버리지 않고 하나 기억했다가 다 넘어가면 바로 한다(0.3초 안에 누른 것만)
let hopQ=null;
function playerHop(h){if(mode!=='hide'||over||paused||!player)return;if(world.midMove(player)){hopQ={h,t:performance.now()};return;}hopQ=null;const sd=stampDir(world,player,player.stamp),sw=(()=>{const [x,y]=world.pos(player);return world.isSwitch(Math.round(x),Math.round(y));})();if(world.hop(player,h)){recHop(sd<0?0:(h===sd?1:-1),sw,!!(player.slide&&player.slide.hid));if(net&&net.role==='hider')netHop(h);}}
// 키보드·스와이프·버튼이 모두 이 함수로: 옆 방향이면 레일 넘어가기(진행 방향은 무시)
function hideInput(h){if(mode!=='hide'||over||paused||!player||player.pending)return;if(h%2!==player.d%2)playerHop(h);}
addEventListener('keydown',e=>{if(e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;if(e.repeat)return;
  if(e.code==='Escape'&&mode&&!over){paused?resume():pause();return;}
  if(e.code==='KeyM'){soundOn=!soundOn;try{localStorage.setItem('box-sound',soundOn?'on':'off');}catch(err){}say(soundOn?'신호음 켬':'신호음 끔');return;}
  if(paused||over)return;
  if(mode==='hide'){if(e.code in KD){const k=KD[e.code];hideInput(screenToWorld(DV[k][0],DV[k][1]));e.preventDefault();}}
  if(mode==='seek'){if(e.code==='Space'){look();e.preventDefault();}}});
document.querySelectorAll('[data-hop]').forEach(b=>b.onclick=()=>hideInput(+b.dataset.hop));
// 터치·마우스 끌기: 숨는 쪽 판에서 화면을 22px 넘게 밀면 그 방향으로 입력(누르는 중에 바로 발동, 한 번 밀기 = 한 번)
let swipe=null;const SWIPE=22;
// 화면 방향(오른쪽 +x, 아래 +y) → 세계 방향(0~3). 카메라가 돌아가도(세로 화면) 내가 민 쪽으로 간다
const sdA=new THREE.Vector3(),sdB=new THREE.Vector3();
function screenToWorld(sx,sy,only){const legacy=only?(only[0]%2===1?(sy>0?1:3):(sx>0?0:2)):Math.abs(sy)>=Math.abs(sx)?(sy>0?1:3):(sx>0?0:2);if(!world)return legacy;const [x,y]=player&&!player.pending?world.pos(player):[W/2,H/2];
  sdA.set(wx(x),.5,wz(y)).project(cam);let best=-1,bd=-2;const sl=Math.hypot(sx,sy)||1;
  for(const h of only||[0,1,2,3]){sdB.set(wx(x+DV[h][0]),.5,wz(y+DV[h][1])).project(cam);const vx=(sdB.x-sdA.x)*(cam.aspect||1),vy=-(sdB.y-sdA.y),L=Math.hypot(vx,vy);const dot=(vx*sx+vy*sy)/(L*sl);if(isFinite(dot)&&dot>bd){bd=dot;best=h;}}
  return best<0?legacy:best;}
function swipeCheck(e){if(!swipe||swipe.done||e.pointerId!==swipe.id)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;if(Math.hypot(dx,dy)<SWIPE)return;swipe.done=true;hideInput(screenToWorld(dx,dy));$('tHint').hidden=true;}
// 터치 탭: 내 상자보다 위를 누르면 위 레일, 아래를 누르면 아래 레일(세로 레일 맵이면 왼쪽/오른쪽)
const tapV=new THREE.Vector3();
function tapMove(e){if(!player||player.pending)return;const r=cv.getBoundingClientRect(),[x,y]=world.pos(player);tapV.set(wx(x),player.size*.8,wz(y)).project(cam);
  const px=r.left+(1+(+tapV.x||0))/2*r.width,py=r.top+(1-(+tapV.y||0))/2*r.height;if(Math.hypot(e.clientX-px,e.clientY-py)<6)return;
  const d=player.d;hideInput(screenToWorld(e.clientX-px,e.clientY-py,[(d+1)%4,(d+3)%4]));$('tHint').hidden=true;} // 내 상자에서 누른 쪽으로(레일과 수직이 아닌 쪽이면 hideInput이 무시)
// 화면 어디서든(버튼 위 제외): 밀면 그 방향, 터치로 톡 누르면 tapMove
const onBtn=e=>!!(e.target&&e.target.closest&&e.target.closest('button,select,textarea'));
document.addEventListener('pointerdown',e=>{if(mode!=='hide'||over||paused||onBtn(e))return;swipe={id:e.pointerId,x:e.clientX,y:e.clientY,done:false,touch:e.pointerType&&e.pointerType!=='mouse'};});
document.addEventListener('pointermove',e=>{if(mode==='hide')swipeCheck(e);});
document.addEventListener('pointerup',e=>{if(mode==='hide'&&swipe&&e.pointerId===swipe.id){swipeCheck(e);if(!swipe.done&&swipe.touch&&!over&&!paused)tapMove(e);}swipe=null;});
document.addEventListener('pointercancel',()=>swipe=null);

// ---------- 찾는 쪽 ----------
// 직원 신호: 돌아보기를 누르면 노랑 → 빨강(2.5초) → 초록
function seekSignal(dt){const D=DIFF[DIFF_KEY];if(world.light==='yellow'&&world.lightT>=D.yellow)world.setLight('red');else if(world.light==='red'&&world.lightT>=2.5)world.setLight('green');}
function look(){if(mode!=='seek'||over||paused||world.light!=='green'||world.lightT<1)return;world.setLight('yellow');if(net&&net.role==='host')netPush({snap:netSnap()});} // 친구와 하기: 노랑은 바로 보낸다(숨는 쪽은 받은 순간부터 자기 시계로 빨강을 켠다)
$('lookBtn').onclick=look;$('tLook').onclick=look;
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();
function setRay(e){const r=cv.getBoundingClientRect();ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,cam);}
const pickPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-1),pp=new THREE.Vector3();
// 화면에 보이는 위치가 터널 덮개 아래인가(안 보임, 못 집음)
const inTun=b=>inTunnel(world,b);
function pickBox(e,r){setRay(e);if(!ray.ray.intersectPlane(pickPlane,pp))return null;let best=null,bd=r||CS*.8;world.boxes.forEach(b=>{if(b.found||b.cleared||b.gone||b.pending||inTun(b))return;const [x,y]=world.pos(b);const d=Math.hypot(wx(x)-pp.x,wz(y)-pp.z);if(d<bd){bd=d;best=b;}});return best;}
const hoverRing=new THREE.Mesh(new THREE.RingGeometry(1.25,1.6,28),B('#f2c230'));hoverRing.rotation.x=-Math.PI/2;hoverRing.visible=false;S.add(hoverRing);
// 마우스: 올려 둔 상자가 노란 고리, 클릭 = 스캔. 터치: 한 번 누르면 고리(선택), 같은 상자를 한 번 더 누르면 스캔(손가락에 가려 엉뚱한 상자를 찍지 않게)
let lastPtr='mouse';cv.addEventListener('pointerdown',e=>{lastPtr=e.pointerType||'mouse';});
cv.addEventListener('pointermove',e=>{if(e.pointerType&&e.pointerType!=='mouse')return;if(mode!=='seek'||over||paused){hover=null;return;}hover=pickBox(e);});
cv.addEventListener('pointerleave',e=>{if(!e.pointerType||e.pointerType==='mouse')hover=null;});
cv.addEventListener('click',e=>{if(mode!=='seek'||over||paused)return;const touch=lastPtr!=='mouse';const b=pickBox(e,touch?CS*1.05:0);
  if(touch){if(!b){hover=null;return;}if(hover!==b){hover=b;say('한 번 더 누르면 스캔',.8);return;}hover=null;}
  if(b)scanBox(b);});
function scanBox(b){scans--;
  if(b.kind==='bot'){b.found=true;b.kind='npc';found++;meshes.get(b).body.material=redMat;say('사람이다! 삐빅');}else{time-=5;clearedOn(b);say('그냥 상자… −5초');}checkSeekEnd();updHud();}
cv.addEventListener('contextmenu',e=>e.preventDefault()); // 길게 누르기 메뉴 막기
function checkSeekEnd(){if(over)return;if(found+escaped>=bots.length)end(found===bots.length,`찾음 ${found}, 놓침 ${escaped}. 남은 시간 ${Math.ceil(time)}초, 스캔 ${scans}번 남김.`);
  else if(scans<=0)end(false,`스캔을 다 씀. 찾음 ${found}, 놓침 ${escaped}.`);}

