// ===== 장면 준비: 상수, three.js 렌더러·카메라·조명, 맵 목록 =====
const GAME_TIME=90; // 판 시간(초). 코인 수·수명·목표는 engine.js COIN_N·COIN_LIFE·COIN_GOAL
const SEEK_DENSITY=.28,HIDE_DENSITY=.42; // 상자 밀도(칸 수에 곱함). 찾는 쪽은 눈으로 쫓을 수 있게 적게(약 15개), 숨는 쪽은 미끼가 적당하게
const DIFF_KEY='normal'; // 난이도는 '보통' 하나(engine.js DIFF)
const $=id=>document.getElementById(id);
const cv=$('c'),stage=$('stage');
const R=new THREE.WebGLRenderer({canvas:cv,antialias:true});R.setPixelRatio(Math.min(2,devicePixelRatio));
const S=new THREE.Scene();S.background=new THREE.Color('#d6d0c2');
const cam=new THREE.PerspectiveCamera(36,16/9,.5,400);
S.add(new THREE.HemisphereLight('#ffffff','#8c8574',.95));const sun=new THREE.DirectionalLight('#fff4e0',.55);sun.position.set(-10,30,12);S.add(sun);
function resize(){const r=stage.getBoundingClientRect();if(!r.width||!r.height)return;R.setSize(r.width,r.height,false);cam.aspect=r.width/r.height;cam.updateProjectionMatrix();fitCam();}
addEventListener('resize',resize);
// 재질은 색마다 한 번만 만들어 같이 쓴다(판마다 새로 만들고 안 버리면 폰에서 점점 무거워짐)
const _mats={};
const M=c=>_mats['L'+c]||(_mats['L'+c]=new THREE.MeshLambertMaterial({color:c}));
const B=c=>_mats['B'+c]||(_mats['B'+c]=new THREE.MeshBasicMaterial({color:c,side:THREE.DoubleSide}));
const CS=3.4,DV=[[1,0],[0,1],[-1,0],[0,-1]];
const floorMat=new THREE.MeshLambertMaterial({color:'#cfc8b8'}); // 신호용이라 색 캐시(M)와 따로
const floor=new THREE.Mesh(new THREE.PlaneGeometry(400,240),floorMat);floor.rotation.x=-Math.PI/2;S.add(floor);
// 신호 = 바닥 조명 하나. 직원이 보고 있나는 판 전체에 하나뿐인 상태라 맵 모양과 상관없이 바닥 전체 색으로만 보인다.
// 초록 = 푸른 기, 노랑 = 깜빡임, 빨강 = 붉게. 판 밖(메뉴)에선 기본색
const FLOOR={idle:['#cfc8b8','#d6d0c2'],green:['#6fae6a','#86bd80'],yellow:['#d9ae22','#e2bf4a'],red:['#d4604f','#dc786a']}; // 조명(밝기 1.5)에 씻겨 옅어지므로 진하게
function floorLight(L,now){const k=L==='yellow'&&Math.floor(now/120)%2?'idle':(FLOOR[L]?L:'idle');floorMat.color.set(FLOOR[k][0]);S.background.set(FLOOR[k][1]);}

// ---------- 맵 목록 ----------
const mapList=()=>['compact','switch','loop'].map(k=>({k,name:MAPS[k].name,str:MAPS[k].str}));
let curKey='compact';
const wopt=()=>({diff:DIFF_KEY});
const curEntry=()=>mapList().find(m=>m.k===curKey)||mapList()[0];
