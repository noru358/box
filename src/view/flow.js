// ===== 판 흐름: 상태, 시작·메뉴·끝·일시정지, 상단 상태줄, 신호음 =====
let sig=null,idleSig=signalAI(DIFF.normal),mode=null,over=true,paused=false,goal=4,time=0,player=null,hunt=null,msgT=0,scans=0,found=0,escaped=0,t0=0,bots=[],hover=null;
function say(s,t=1.8){$('msg').textContent=s;$('msg').hidden=false;msgT=t;}
function sus(b,v){b.sus+=v;}
function newWorld(withBoxes=true){world=createWorld(curEntry().str,wopt());buildTiles(world.tiles);clearMeshes();
  if(withBoxes){const n=Math.round(world.tiles.flat().filter(t=>t&&t.t!=='exit').length*(mode==='seek'?SEEK_DENSITY:HIDE_DENSITY));for(let i=0;i<n;i++)world.add('npc');}}

// 터치 기기 무대 위 버튼(돌아보기·밀기 안내). m=null이면 모두 숨김
function touchUi(m){$('tPause').hidden=true;$('tLook').hidden=m!=='seek';$('tHint').hidden=m!=='hide';}
const coarse=()=>typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
// 폰: 판을 시작할 때 전체 화면 시도(안드로이드만 됨)
function goFull(){if(!coarse())return;try{const d=document.documentElement;if(!document.fullscreenElement&&d.requestFullscreen)d.requestFullscreen().then(()=>{},()=>{});}catch(e){}}
// 신호음: 모두에게 같은 신호. 노랑 = 짧게 두 번 올라가는 소리, 빨강 = 낮은 경보, 초록 = 짧은 덜컥. M으로 끄고 켬
let AC=null,soundOn=true;try{soundOn=localStorage.getItem('box-sound')!=='off';}catch(e){}
function tone(f,d,type,v,at){if(!AC||!soundOn)return;const t=AC.currentTime+(at||0),o=AC.createOscillator(),g=AC.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(v||.12,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(AC.destination);o.start(t);o.stop(t+d+.02);}
function lightSound(s){if(s==='yellow'){tone(880,.09,'square',.08);tone(1180,.09,'square',.08,.11);}else if(s==='red')tone(196,.45,'sawtooth',.1);else if(s==='green')tone(330,.07,'triangle',.1);}
function initSound(){if(AC)return;try{const C=window.AudioContext||window.webkitAudioContext;if(C)AC=new C();}catch(e){}}
// 판 화면으로: 도구줄·상태줄을 이 판 쪽(m)에 맞춘다(혼자 하기·친구와 하기 공용)
function playUi(m,label){$('panel').hidden=true;$('susWrap').hidden=m!=='hide';$('hideTools').hidden=m!=='hide';$('seekTools').hidden=m!=='seek';$('timeWrap').hidden=false;$('pauseBtn').hidden=false;touchUi(m);
  $('modeL').innerHTML=label;cv.style.cursor=m==='seek'?'crosshair':'default';hud={};updHud();}
function start(m){goFull();initSound();mode=m;over=false;paused=false;newWorld();fitCam();
  goal=COIN_GOAL;time=GAME_TIME;scans=6;found=0;escaped=0;sig=signalAI(DIFF[DIFF_KEY]);world.setLight('green');t0=performance.now();clearCoins();
  hunt={t:2,target:null,aim:0,scans:15,stun:0};bots=[];hideMarks();player=null;rec=m==='hide'?{wins:[],cur:null,ps:world.t}:null;
  if(m==='hide'){player=world.add('player')||world.boxes[0];player.kind='player';player.got=0;recLight('green');[meArrow,worker].forEach(o=>o.visible=true);}
  else{const pers=['rush','careful','mimic'];for(let i=0;i<3;i++){const b=world.boxes[i];b.kind='bot';b.pers=pers[i];b.got=0;bots.push(b);}}
  initCoins(world);syncCoins();(m==='hide'?[player]:bots).forEach(aimCoin);
  playUi(m,(m==='hide'?'<b>숨는 쪽</b>':'<b>찾는 쪽</b>')+` · ${curEntry().name}`);}
// 메뉴판에서 판 화면 요소를 다 숨긴다(메뉴·친구와 하기 방 공용)
function idleUi(label){mode=null;over=true;paused=false;hideMarks();touchUi(null);clearCoins();['hideTools','seekTools','pauseBtn','susWrap','timeWrap'].forEach(id=>$(id).hidden=true);$('goalL').textContent='';$('modeL').innerHTML=label;$('panel').hidden=false;}

function menu(){if(net)netLeave();idleUi('<b>메뉴</b>');newWorld();
  const opts=mapList().map(m=>`<option value="${m.k}"${m.k===curKey?' selected':''}>${m.name}</option>`).join('');
  $('panelBox').innerHTML=`<h1>택배 숨바꼭질</h1>
  <div class="row"><label for="mapSel">맵</label><select id="mapSel">${opts}</select></div>
  <h2>AI와 하기</h2><div class="row"><button id="bHide">숨는 쪽</button><button class="alt" id="bSeek">찾는 쪽</button></div><p id="humanNote">${humanNote()}</p>
  <h2>친구와 하기</h2><div class="row"><button id="bNet">친구와 1:1</button></div><p id="netNote">${netNote()}</p>`;
  $('mapSel').onchange=e=>{curKey=e.target.value;newWorld();};
  $('bHide').onclick=()=>start('hide');$('bSeek').onclick=()=>start('seek');$('bNet').onclick=()=>netOpen();$('bHide').focus();}

function end(win,text){if(over)return;over=true;if(net&&net.role==='host')netPush({ph:'end',res:text,win:!!win});ring.visible=laser.visible=false;$('pauseBtn').hidden=true;touchUi(null);
  if(mode==='hide')recSave(win);
  $('panel').hidden=false;$('panelBox').innerHTML=`<h1>${win?'통과':'실패'}</h1><p>${text}</p><div class="row"><button id="again">한 판 더</button><button class="alt" id="swap">반대쪽으로</button><button class="alt" id="toMenu">메뉴로</button></div>`;
  $('toMenu').onclick=()=>menu();
  if(net){$('swap').hidden=true;$('again').textContent='방으로';$('again').onclick=()=>netLobby();$('again').focus();return;}
  $('again').onclick=()=>start(mode);$('swap').onclick=()=>start(mode==='hide'?'seek':'hide');$('again').focus();}
function pause(){if(over||!mode||paused)return;paused=true;$('panel').hidden=false;
  $('panelBox').innerHTML=`<h1>일시정지</h1><div class="row"><button id="resume">계속하기</button><button class="alt" id="restart">처음부터</button><button class="alt" id="quit">메뉴로 나가기</button></div><p>나가면 이번 판은 기록되지 않아요.</p><p class="note">화면 ${fps|0} FPS</p>`;
  if(net)$('restart').hidden=true;
  $('resume').onclick=resume;$('restart').onclick=()=>start(mode);$('quit').onclick=()=>menu();$('resume').focus();}
function resume(){paused=false;$('panel').hidden=true;}
$('pauseBtn').onclick=pause;$('tPause').onclick=pause;
// 상태줄: 값이 바뀔 때만 DOM에 쓴다(매 프레임 innerHTML을 다시 쓰던 것)
let hud={};const setHud=(id,k,v)=>{if(hud[id+k]===v)return;hud[id+k]=v;if(k==='html')$(id).innerHTML=v;else if(k==='text')$(id).textContent=v;else if(k==='w')$(id).style.width=v;else if(k==='hot')$(id).classList.toggle('hot',v);else if(k==='dis')$(id).disabled=v;};
function updHud(){setHud('timeL','text',Math.max(0,Math.ceil(time))+'초');
  if(mode==='hide'&&player){setHud('goalL','html',`코인 <b>${player.got||0}/${goal}</b> · 직원 스캔 <b>${hunt.scans}</b>번`);setHud('susBar','w',Math.min(100,player.sus/3*100).toFixed(0)+'%');setHud('susWrap','hot',player.sus>1.1);}
  else if(mode==='seek'){setHud('goalL','html',`찾음 <b>${found}</b> · 놓침 <b>${escaped}</b> · 스캔 <b>${scans}</b>번`);
    const dis=!(world.light==='green'&&world.lightT>=1);setHud('lookBtn','dis',dis);setHud('tLook','dis',dis);}}
