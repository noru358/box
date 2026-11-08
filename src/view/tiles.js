// ===== 칸 그리기 =====
// 칸 종류마다 그리는 법(TILE_LOOK). 규칙 쪽 등록표는 engine.js TILES. 새 칸 종류는 두 곳에 한 줄씩.
// 모든 칸 = 바닥판(base 색) + 벨트면 진행 화살표 + 종류별 덧그림(add). 신호는 칸이 아니라 바닥 조명 하나로(scene.js floorLight).
// 도형·재질은 한 번만 만들어 같이 쓴다(맵을 다시 깔아도 새로 안 만듦).
let world=null,W=14,H=6,tileG=new THREE.Group();S.add(tileG);
const wx=x=>(x-(W-1)/2)*CS,wz=y=>(y-(H-1)/2)*CS;
const _geos={};const geo=(key,make)=>_geos[key]||(_geos[key]=make());
const P=CS*.82;
const triGeo=(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([.55,0,0,-.35,0,-.42,-.35,0,.42],3));return g;})();
function arrow(d,color,ox=0,oz=0,s=1){const a=new THREE.Mesh(triGeo,B(color));a.rotation.y=-d*Math.PI/2;a.scale.setScalar(s);a.position.set(ox,.34,oz);return a;}
const box=(key,w,h,d,mat)=>new THREE.Mesh(geo(key,()=>new THREE.BoxGeometry(w,h,d)),mat);
// 연결 분기 짝 방향(engine.js w.pairSides와 같은 규칙, 칸 표만으로)
const pairsOf=(tiles,x,y)=>{const t=(tiles[y]||[])[x];if(!t||!t.sw)return [];return [(t.d+1)%4,(t.d+3)%4].filter(h=>{const n=(tiles[y+DV[h][1]]||[])[x+DV[h][0]];return !!(n&&n.sw);});};
const TILE_LOOK={
  belt:{base:'#3a3936'},
  // 노란 판 + 옆 화살표. 연결 분기(옆 레일 같은 줄도 분기 칸)면 짝 쪽 화살표만, 그리고 짝 쪽으로 다리(아래 buildTiles)
  switch:{base:'#c99a1e',add(g,t,x,y,tiles){const ps=pairsOf(tiles,x,y);(ps.length?ps:[(t.d+1)%4,(t.d+3)%4]).forEach(h=>g.add(arrow(h,'#1e1c18',DV[h][0]*.95,DV[h][1]*.95,.55)));}},
  tunnel:{base:'#3a3936',add(g,t,x,y,tiles){ // 덮개, 바깥쪽 벽(옆도 터널이면 벽 없음), 노란 줄
    const roof=box('roof',CS*1.01,.35,CS*1.01,M('#4a4640'));roof.position.y=2.75;g.add(roof);const v=t.d%2;
    [-1,1].forEach(s=>{const n=(tiles[y+(v?0:s)]||[])[x+(v?s:0)];if(n&&n.tun)return;const wall=box('wall'+v,v?.25:CS*1.01,2.6,v?CS*1.01:.25,M('#5a554d'));wall.position.set(v?s*CS*.5:0,1.3,v?0:s*CS*.5);g.add(wall);});
    const stripe=box('stripe',CS*1.01,.04,.3,B('#f2c230'));stripe.position.y=2.95;g.add(stripe);}},
  spawn:{base:'#24231f',add(g,t){g.add(arrow(t.d,'#ffffff',0,0,1.2));}},
  exit:{base:'#3a3936',add(g,t){const c='#8f8775',v=DV[t.d];[-1,1].forEach(s=>{const pl=box('pillar',.45,3.2,.45,M(c));pl.position.set(v[1]*s*P/2,1.6,v[0]*s*P/2);g.add(pl);});
    const beam=box('beam'+t.d%2,v[1]?P+.5:.6,.6,v[0]?P+.5:.6,M(c));beam.position.y=3.2;g.add(beam);g.add(arrow(t.d,c,0,0,1.1));}}
};
let occ={x0:0,x1:13,y0:0,y1:5}; // 칸이 실제로 있는 범위(카메라 맞추기용)
function buildTiles(tiles){S.remove(tileG);tileG=new THREE.Group();S.add(tileG);H=tiles.length;W=tiles[0].length;
  occ={x0:W,x1:-1,y0:H,y1:-1};tiles.forEach((r,y)=>r.forEach((t,x)=>{if(t){occ.x0=Math.min(occ.x0,x);occ.x1=Math.max(occ.x1,x);occ.y0=Math.min(occ.y0,y);occ.y1=Math.max(occ.y1,y);}}));if(occ.x1<0)occ={x0:0,x1:W-1,y0:0,y1:H-1};
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const t=tiles[y][x];if(!t)continue;const look=TILE_LOOK[t.k];const g=new THREE.Group();g.position.set(wx(x),0,wz(y));tileG.add(g);
    const p=box('plate',P,.3,P,M(look.base));p.position.y=.15;g.add(p);
    if(t.t==='belt')g.add(arrow(t.d,'#6f6c64',0,0,1.1));
    if(look.add)look.add(g,t,x,y,tiles);
    // 다리: 짝 분기 칸 사이(오른쪽·아래 짝만 그려 한 번씩). 다리 위에 코인이 멈춘다
    pairsOf(tiles,x,y).filter(h=>h<2).forEach(h=>{const br=box('bridge'+h,h?P*.5:CS*.62,.34,h?CS*.62:P*.5,M('#c99a1e'));br.position.set(wx(x+DV[h][0]*.5),.17,wz(y+DV[h][1]*.5));tileG.add(br);});}
  fitCam();}
// 화면 비율에 맞춰 카메라 거리: 16:9보다 좁으면 가로가 다 들어오게 뒤로, 넓으면(폰 가로) 세로가 다 들어오는 데까지 당긴다
// 카메라: 내려다보는 각도는 고정, 실제 칸 범위 + 신호등 + (숨는 쪽이면) 직원이 화면 가장자리 6% 안에 꽉 차도록 거리와 중심을 맞춘다
// 카메라는 늘 앞(+z)에서 내려다본다(레일이 가로). 폰을 세로로 들어도 같은 화면을 위에 두고, 아래는 조작 버튼 자리
const camDir=new THREE.Vector3(0,.92,.42).normalize(),fitV=new THREE.Vector3();
// 세로 화면 숨는 쪽: 맵 전체를 폭에 맞추면 너무 작아서, 5칸 폭만 크게 보여 주고 내 상자를 따라 옆으로 움직인다
let follow=null;const FOLLOW_COLS=5,edgeV=new THREE.Vector3();
function fitCam(){const tall=(cam.aspect||16/9)<1;camDir.set(0,.92,tall?.18:.42).normalize();const fol=tall&&mode==='hide'&&occ.x1-occ.x0+1>10; // 10칸 넘는 맵만 따라가기(9칸 맵은 전체가 보임)
  const mid=(occ.x0+occ.x1)/2,fx0=fol?mid-(FOLLOW_COLS-1)/2:occ.x0,fx1=fol?mid+(FOLLOW_COLS-1)/2:occ.x1;
  const pts=[],h=CS*.5,X0=wx(fx0)-h,X1=wx(fx1)+h,Z0=wz(occ.y0)-h,Z1=wz(occ.y1)+h;
  [[X0,Z0],[X1,Z0],[X0,Z1],[X1,Z1]].forEach(([x,z])=>{pts.push([x,0,z],[x,3.6,z]);});
  const lx=wx(occ.x0);
  if(mode==='hide')pts.push([X0+h,0,wz(H-1)+CS*.9+1],[X1-h,0,wz(H-1)+CS*.9+1],[X0+h,3.4,wz(H-1)+CS*.9+1]);
  let cx=(X0+X1)/2+lx*.04,cz=(Z0+Z1)/2,d=60;
  const ext=dd=>{cam.position.set(cx+camDir.x*dd,camDir.y*dd,cz+camDir.z*dd);cam.lookAt(cx,0,cz);cam.updateMatrixWorld();let a=1,b=-1,c=1,e=-1;
    pts.forEach(p=>{fitV.set(p[0],p[1],p[2]).project(cam);a=Math.min(a,+fitV.x||0);b=Math.max(b,+fitV.x||0);c=Math.min(c,+fitV.y||0);e=Math.max(e,+fitV.y||0);});return [a,b,c,e];};
  for(let k=0;k<3;k++){let lo=5,hi=400;for(let i=0;i<24;i++){d=(lo+hi)/2;const [a,b,c,e]=ext(d);if(Math.max(-a,b,-c,e)>(tall?.985:.94))lo=d;else hi=d;}d=hi;
    const [a,b,c,e]=ext(d),t=Math.tan(cam.fov*Math.PI/360);const fx=-camDir.x,fz=-camDir.z,fl=Math.hypot(fx,fz)||1,gx=fx/fl,gz=fz/fl,sh=(a+b)/2*d*t*(cam.aspect||16/9),sv=(c+e)/2*d*t/camDir.y;cx+=-gz*sh+gx*sv;cz+=gx*sh+gz*sv;}
  ext(d);follow=fol?{off:cam.position.clone().sub(new THREE.Vector3(cx,0,cz)),cx,cz,min:wx(occ.x0)+(X1-X0)/2-h,max:wx(occ.x1)-(X1-X0)/2+h}:null;}
