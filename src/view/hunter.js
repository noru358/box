// ===== AI 직원 화면 쪽(숨는 쪽 판): 판단은 ai.js hunterStep, 여기선 직원·레이저·고리를 그리고 결과를 처리 =====
function huntStep(dt){const p=player;worker.position.z=wz(H-1)+CS*.9;const stunned=hunt.stun>0;
  const r=hunterStep(world,hunt,dt,DIFF[DIFF_KEY]),t=hunt.target;
  if(t){const [tx,ty]=world.pos(t);worker.position.x+=(THREE.MathUtils.clamp(wx(tx),wx(0),wx(W-1))-worker.position.x)*dt*1.5;ring.visible=laser.visible=true;ring.position.set(wx(tx),.38,wz(ty));
    laser.geometry.setFromPoints([new THREE.Vector3(worker.position.x,2.4,worker.position.z),new THREE.Vector3(wx(tx),t.size*.8+.33,wz(ty))]);}
  else{ring.visible=laser.visible=false;if(!stunned){const [ppx]=world.pos(p);worker.position.x+=(THREE.MathUtils.clamp(wx(ppx)*.4,wx(0),wx(W-1))-worker.position.x)*dt*.6;}}
  if(r){if(r.scan===p){end(false,`코인 ${p.got}/${goal}에서 스캐너에 찍힘.`);return;}say('직원: 아… 그냥 상자네');hunt.stun=3;r.scan.sus=0;}}
