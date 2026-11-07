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
// 코인(규칙 쪽 이름은 도장 stamp): 바닥 금색 고리 + 위에 떠서 도는 동전
let stampMeshes=[];const goldRing=B('#f2a900'),coinMat=M('#ffcc33'),coinQ=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);const coinGeo=new THREE.CylinderGeometry(.75,.75,.18,24),stampRingGeo=new THREE.RingGeometry(1.05,1.45,4);
function stampMesh(){const g=new THREE.Group();const r=new THREE.Mesh(stampRingGeo,goldRing);r.rotation.x=-Math.PI/2;r.rotation.z=Math.PI/4;r.position.y=.42;g.add(r);
  const c=new THREE.Mesh(coinGeo,coinMat);c.position.y=2.6;g.add(c);g.userData.coin=c;S.add(g);stampMeshes.push(g);return g;}
function clearStamps(){stampMeshes.forEach(g=>S.remove(g));stampMeshes=[];}
// 공용 코인: 판에 POOL_N개. 아무나 어느 도장이든 찍을 수 있고, 각자 같은 도장은 한 번만. 찍어도 사라지지 않는다(사라지면 찍은 상자가 들통나서).
// 도장마다 수명 STAMP_LIFE초, 다 되면 다른 곳에 새로. 내가 먹은 코인은 내 화면에서만 지운다(loop.js).
const POOL_N=4;let pool=[],poolId=0;
function poolNew(){const used=pool.map(s=>[s.x,s.y]);const c=[];for(let y=0;y<world.H;y++)for(let x=2;x<world.W-2;x++){const t=world.T(x,y);if(!t||t.t!=='belt'||t.tun)continue;if(used.some(([ux,uy])=>Math.abs(ux-x)<=1&&Math.abs(uy-y)<=1))continue;c.push([x,y]);}
  const free=c.filter(([x,y])=>!used.some(([,uy])=>uy===y));const src=free.length?free:c;if(!src.length)return null;const [x,y]=src[(Math.random()*src.length)|0];
  const s={id:++poolId,x,y,t:STAMP_LIFE*(.7+Math.random()*.3),mesh:stampMesh()};s.mesh.position.set(wx(x),0,wz(y));return s;}
function poolInit(){pool=[];for(let i=0;i<POOL_N;i++){const s=poolNew();if(s)pool.push(s);}}
// 이 상자가 노릴 도장: 아직 안 찍은 것 중, 줄 차이와 앞쪽 거리로 가장 가까운 것
function poolTarget(b){const t0=world.T(b.cx,b.cy);if(!t0)return null;const vert=t0.d%2===1;let best=null,bc=1e9;
  for(const s of pool){if(b.took&&b.took.has(s.id))continue;const lane=vert?Math.abs(s.x-b.cx):Math.abs(s.y-b.cy);let fwd=vert?(s.y-b.cy)*DY[t0.d]:(s.x-b.cx)*DX[t0.d];if(fwd<0)fwd+=vert?world.H:world.W;
    const cost=fwd/1.25+lane*.9+(fwd/1.25>s.t?6:0);if(cost<bc){bc=cost;best=s;}}return best;}
function poolAim(b){const s=poolTarget(b);b.stamp=s?[s.x,s.y]:null;b.stampT=s?s.t:STAMP_LIFE;b.aimId=s?s.id:0;}
function placeStamp(b){b.took=b.took||new Set();poolAim(b);}
// 걸린 상자 표시
const alertTex=(()=>{const c=document.createElement('canvas');c.width=64;c.height=96;const g=c.getContext('2d');g.fillStyle='#d6322a';g.beginPath();g.arc(32,40,30,0,Math.PI*2);g.fill();g.fillStyle='#fff';g.font='bold 52px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText('!',32,42);return new THREE.CanvasTexture(c);})();
const alertMat=new THREE.SpriteMaterial({map:alertTex,depthTest:false});
function alertOn(b){const m=meshes.get(b);if(!m||m.alert)return;const s=new THREE.Sprite(alertMat);s.scale.set(1.3,1.95,1);s.position.y=b.size*.8+2.4;m.g.add(s);m.alert=s;}
function alertsOff(){meshes.forEach(m=>{if(m.alert){m.g.remove(m.alert);m.alert=null;}});}
// 표시
function arrowShape(s){const sh=new THREE.Shape();sh.moveTo(-.35*s,1.6*s);sh.lineTo(.35*s,1.6*s);sh.lineTo(.35*s,.7*s);sh.lineTo(.85*s,.7*s);sh.lineTo(0,-.2*s);sh.lineTo(-.85*s,.7*s);sh.lineTo(-.35*s,.7*s);sh.closePath();return new THREE.ShapeGeometry(sh);}
const meArrow=new THREE.Group();{const out=new THREE.Mesh(arrowShape(1.22),B('#1e1c18'));out.position.set(0,-.12,-.02);meArrow.add(out);const fill=new THREE.Mesh(arrowShape(1),B('#ff2bd6'));meArrow.add(fill);}S.add(meArrow);
const meEdge=new THREE.Group(),meRing=new THREE.Group();{const o=new THREE.Mesh(new THREE.RingGeometry(1.25,1.75,32),B('#1e1c18'));o.rotation.x=-Math.PI/2;meRing.add(o);const i=new THREE.Mesh(new THREE.RingGeometry(1.32,1.68,32),B('#ff2bd6'));i.rotation.x=-Math.PI/2;i.position.y=.01;meRing.add(i);}S.add(meRing); // 내 상자: 바닥 분홍 고리(내 화면에만)
const worker=new THREE.Group();{const wb=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,2.4,10),M('#2c4a7a'));wb.position.y=1.2;worker.add(wb);const wh=new THREE.Mesh(new THREE.SphereGeometry(.5,10,8),M('#e5c19b'));wh.position.y=2.8;worker.add(wh);}S.add(worker);
const laser=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:'#d6322a'}));S.add(laser);
const ring=new THREE.Mesh(new THREE.RingGeometry(1.15,1.4,24),B('#d6322a'));ring.rotation.x=-Math.PI/2;S.add(ring);
function hideMarks(){[meArrow,meEdge,meRing,worker,laser,ring].forEach(o=>o.visible=false);}hideMarks();

