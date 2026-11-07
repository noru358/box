// ===== 상자와 그 위 효과 레이어(코인·!·내 상자 표시·AI 직원) =====
const boxGeo=new THREE.BoxGeometry(1,1,1),labelGeo=new THREE.BoxGeometry(.72,.05,.54),shadowGeo=new THREE.CircleGeometry(.75,16);
const redMat=M('#d6322a'),cardMats=['#c08d5c','#b07f52','#cc9b6b'].map(M),shadowMat=new THREE.MeshBasicMaterial({color:'#000',transparent:true,opacity:.28,depthWrite:false});
let meshes=new Map();const plainLabel=new THREE.MeshBasicMaterial({color:'#f3efe4'});
// 상자 무늬: 0 없음, 1 빨간 테이프, 2 파란 테이프, 3 검은 십자 테이프, 4 노란 동그라미 스티커. 같은 무늬가 판에 여러 개라 따라갈 수는 있어도 확신은 못 한다
const PATS=5,tapeGeo=new THREE.BoxGeometry(1.02,.06,.22),dotGeo=new THREE.CylinderGeometry(.2,.2,.06,16),patMats=[null,B('#d6322a'),B('#2f6fd6'),B('#1e1c18'),B('#f2c230')];
const newPat=()=>(Math.random()*PATS)|0;
function decorate(m,b){if(m.deco){m.g.remove(m.deco);m.deco=null;}m.pat=b.pat;if(!b.pat)return;const d=new THREE.Group(),top=.33+b.size*.8+.06;
  if(b.pat===4){const c=new THREE.Mesh(dotGeo,patMats[4]);c.position.set(b.size*.22,top,b.size*.22);c.scale.setScalar(b.size);d.add(c);}
  else{const t=new THREE.Mesh(tapeGeo,patMats[b.pat]);t.position.y=top;t.scale.setScalar(b.size);d.add(t);if(b.pat===3){const t2=t.clone();t2.rotation.y=Math.PI/2;d.add(t2);}}
  m.g.add(d);m.deco=d;}
function meshFor(b){if(b.pat==null)b.pat=newPat();let m=meshes.get(b);if(m){if(m.pat!==b.pat)decorate(m,b);return m;}const g=new THREE.Group();const sh=new THREE.Mesh(shadowGeo,shadowMat);sh.rotation.x=-Math.PI/2;sh.position.y=.33;sh.scale.setScalar(b.size);g.add(sh);
  const body=new THREE.Mesh(boxGeo,cardMats[b.id%3]);body.scale.set(b.size,b.size*.8,b.size);body.position.y=.33+b.size*.4;g.add(body);
  const lab=new THREE.Mesh(labelGeo,plainLabel);lab.position.y=.33+b.size*.8+.03;lab.scale.setScalar(b.size);g.add(lab);S.add(g);body.userData.box=b;lab.userData.box=b;m={g,body,lab,bump:0};meshes.set(b,m);decorate(m,b);return m;}
function clearMeshes(){meshes.forEach(m=>S.remove(m.g));meshes=new Map();}
// 코인 그리기(규칙은 engine.js "코인"): 두 레일 사이 경계 위, 넘어가는 방향으로 놓인 금색 띠 + 위에 떠서 도는 동전.
// 띠는 수명이 줄면 짧아지고, 3초 남으면 동전이 깜빡. 내가 먹은 코인은 내 화면에서만 지운다(loop.js)
let coins=[],coinMeshes=new Map();
const goldMat=B('#f2a900'),coinMat=M('#ffcc33'),coinGeo=new THREE.CylinderGeometry(.75,.75,.18,24),coinQ=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
function coinMesh(c){let g=coinMeshes.get(c.id);if(g)return g;g=new THREE.Group();
  const bar=box('coinbar'+c.h,c.h===0?CS*.9:.55,.08,c.h===0?.55:CS*.9,goldMat);bar.position.y=.42;g.add(bar);
  const k=new THREE.Mesh(coinGeo,coinMat);k.position.y=2.6;g.add(k);g.userData={coin:k,bar};g.position.set(wx(c.x),0,wz(c.y));S.add(g);coinMeshes.set(c.id,g);return g;}
function syncCoins(){const ids=new Set(coins.map(c=>c.id));coinMeshes.forEach((g,id)=>{if(!ids.has(id)){S.remove(g);coinMeshes.delete(id);}});coins.forEach(coinMesh);}
function clearCoins(){coins=[];syncCoins();}
function aimCoin(b){b.took=b.took||new Set();b.coin=pickCoin(world,b,coins);}
// 걸린 상자 표시
const alertTex=(()=>{const c=document.createElement('canvas');c.width=64;c.height=96;const g=c.getContext('2d');g.fillStyle='#d6322a';g.beginPath();g.arc(32,40,30,0,Math.PI*2);g.fill();g.fillStyle='#fff';g.font='bold 52px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('!',32,42);return new THREE.CanvasTexture(c);})();
const alertMat=new THREE.SpriteMaterial({map:alertTex,depthTest:false});
function alertOn(b){const m=meshes.get(b);if(!m||m.alert)return;const s=new THREE.Sprite(alertMat);s.scale.set(1.3,1.95,1);s.position.y=b.size*.8+2.4;m.g.add(s);m.alert=s;}
// 찾는 쪽에서 스캔해 '그냥 상자'로 확인한 상자: 회색 X를 계속 띄운다(출고돼 새 상자로 나오면 지움)
const clearedMat=new THREE.SpriteMaterial({map:(()=>{const c=document.createElement('canvas');c.width=64;c.height=64;const g=c.getContext('2d');g.fillStyle='#5f5a50';g.beginPath();g.arc(32,32,28,0,Math.PI*2);g.fill();g.strokeStyle='#fff';g.lineWidth=8;g.beginPath();g.moveTo(20,20);g.lineTo(44,44);g.moveTo(44,20);g.lineTo(20,44);g.stroke();return new THREE.CanvasTexture(c);})(),depthTest:false});
function clearedOn(b){const m=meshes.get(b);b.cleared=true;if(!m||m.clr)return;const s=new THREE.Sprite(clearedMat);s.scale.set(1.1,1.1,1);s.position.y=b.size*.8+1.3;m.g.add(s);m.clr=s;}
function clearedOff(b){b.cleared=false;const m=meshes.get(b);if(m&&m.clr){m.g.remove(m.clr);m.clr=null;}}
function alertsOff(){meshes.forEach(m=>{if(m.alert){m.g.remove(m.alert);m.alert=null;}});}
// 표시
function arrowShape(s){const sh=new THREE.Shape();sh.moveTo(-.35*s,1.6*s);sh.lineTo(.35*s,1.6*s);sh.lineTo(.35*s,.7*s);sh.lineTo(.85*s,.7*s);sh.lineTo(0,-.2*s);sh.lineTo(-.85*s,.7*s);sh.lineTo(-.35*s,.7*s);sh.closePath();return new THREE.ShapeGeometry(sh);}
const meArrow=new THREE.Group();{const out=new THREE.Mesh(arrowShape(1.22),B('#1e1c18'));out.position.set(0,-.12,-.02);meArrow.add(out);const fill=new THREE.Mesh(arrowShape(1),B('#ff2bd6'));meArrow.add(fill);}S.add(meArrow);
const meEdge=new THREE.Group(),meRing=new THREE.Group();{const o=new THREE.Mesh(new THREE.RingGeometry(1.25,1.75,32),B('#1e1c18'));o.rotation.x=-Math.PI/2;meRing.add(o);const i=new THREE.Mesh(new THREE.RingGeometry(1.32,1.68,32),B('#ff2bd6'));i.rotation.x=-Math.PI/2;i.position.y=.01;meRing.add(i);}S.add(meRing); // 내 상자: 바닥 분홍 고리(내 화면에만)
const worker=new THREE.Group();{const wb=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,2.4,10),M('#2c4a7a'));wb.position.y=1.2;worker.add(wb);const wh=new THREE.Mesh(new THREE.SphereGeometry(.5,10,8),M('#e5c19b'));wh.position.y=2.8;worker.add(wh);}S.add(worker);
const laser=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:'#d6322a'}));S.add(laser);
const ring=new THREE.Mesh(new THREE.RingGeometry(1.15,1.4,24),B('#d6322a'));ring.rotation.x=-Math.PI/2;S.add(ring);
function hideMarks(){[meArrow,meEdge,meRing,worker,laser,ring].forEach(o=>o.visible=false);}hideMarks();

