// ===== 프레임 루프: 신호 → AI·입력 → 코인 → 엔진 한 걸음 → 이벤트 → 그리기 =====
let last=performance.now();
let fps=60;
// 숨은 상자가 코인을 먹었을 때: 나면 안내·승리, AI·친구 상자면 4개에 빠져나감
function coinScored(b){if(b===player){say(`코인 ${b.got}/${goal}`);if(b.got>=goal)end(true,`${Math.round((performance.now()-t0)/1000)}초 만에 코인 ${goal}개, 직원 스캔 ${hunt.scans}번 남음.`);}
  else if(b.got>=goal&&!b.gone){b.gone=true;escaped++;say('누군가 코인을 다 모으고 빠져나갔다…');checkSeekEnd();}}
function frame(now){const raw=(now-last)/1000,dt=Math.min(.05,raw);last=now;if(raw>0&&raw<1)fps+=(1/raw-fps)*.05; // 일시정지 화면에 보여 주는 평균 FPS
  const cl=!!(net&&net.role==='hider'&&mode==='hide'); // 친구와 하기의 상자 쪽: 규칙은 직원 화면이 정한다
  if(world&&!paused&&!(cl&&net.frozen)){const live=(mode==='hide'||mode==='seek')&&!over;
    if(live){time-=dt;
      const ctx=mode==='seek'?aiCtx():null;
      if(mode==='seek')bots.forEach(b=>{if(!b.T0)b.T0=time;if(b.remote){if(b.q&&!world.midMove(b)){const q=b.q;b.q=null;if(performance.now()-q.t<400)remoteHop(b,q.h);}}else botThink(world,b,dt,ctx);});
      if(mode==='seek'&&net&&net.role==='host'&&(net.snapT-=dt)<=0){net.snapT=.1;netPush({snap:netSnap()});}}
    // 터널에 들어간 줄과 나온 줄이 다르면 직원이 놓친다: 의심 0
    if(live&&mode==='hide'&&!cl)world.boxes.forEach(b=>{if(b.gone||b.pending)return;const it=inTun(b);if(it&&!b.wasTun)b.tunY=b.cy;if(!it&&b.wasTun&&b.tunY!=null&&b.cy!==b.tunY){b.sus=0;if(b===player)say('직원이 놓쳤다',1.2);}b.wasTun=it;});
    if(live&&mode==='hide'&&hopQ&&player&&!world.midMove(player)){const q=hopQ;hopQ=null;if(performance.now()-q.t<300)playerHop(q.h);}
    if(cl){if(live&&world.light==='yellow'&&world.lightT>=DIFF[DIFF_KEY].yellow)world.setLight('red');}else if(live&&mode==='hide'){sig(world,dt);
      const c=player.coin;if(c&&world.light==='green'&&world.lightT>.6&&world.boxes.some(b=>{if(b.gone||b.pending)return false;const [x,y]=world.pos(b);return Math.abs(x-c.x)<=1.5&&Math.abs(y-c.y)<=1.5;})&&Math.random()<dt*.9)world.setLight('yellow');} // 코인 근처에 상자가 있으면 AI 직원이 더 자주 돌아본다
    else if(live&&mode==='seek')seekSignal(dt);else if(!live)idleSig(world,dt);
    // 코인(engine.js coinStep): 수명 다 되면 옮기고, 이번 프레임 넘어가기 중 코인 경계를 지난 것을 먹는다.
    // 숨는 쪽 판은 나, 찾는 쪽 판은 AI 숨은 상자. 친구 상자는 친구 화면이 판정해 알려 온다(net.js)
    if(live&&!over&&!cl){const hid=mode==='hide'?[player]:bots.filter(b=>!b.remote);
      const got=coinStep(world,coins,dt,b=>hid.includes(b)&&!b.gone&&!b.found&&!b.pending);syncCoins();
      for(const [b] of got){coinScored(b);if(over)break;}
      if(!over)(mode==='hide'?[player]:bots).forEach(b=>{if(b&&!b.gone)aimCoin(b);});}
    world.step(dt);
    if(cl&&live&&!over)for(const c of coinTouched(world,player,coins))if(!player.took.has(c.id)){player.took.add(c.id);netCoin(c.id);say(`코인 ${player.got+1}/${goal}`);} // 친구와 하기: 코인도 숨는 쪽 화면이 판정해 알린다
    world.events.forEach(ev=>{
      if(cl&&live&&ev.b===player&&(ev.type==='frozen'||(ev.type==='thud'&&ev.off)))netAlert(); // 친구와 하기: 걸림은 숨는 쪽 화면이 정해서 알린다
      if(ev.type==='thud'){const m=meshes.get(ev.b);if(m)m.bump=.3;if(ev.off&&!ev.b.remote)alertOn(ev.b);if(live&&mode==='hide'&&ev.off)sus(ev.b,3.6);if(live&&mode==='hide'&&world.hasSwitches&&!ev.off&&!ev.sw&&!ev.tun)sus(ev.b,1.6);}
      if(ev.type==='deliver'&&ev.b.kind==='npc'){ev.b.pat=newPat();clearedOff(ev.b);} // 출고된 일반 상자는 새 상자로(무늬·확인 표시 새로)
      if(ev.type==='frozen'){if(!ev.b.remote)alertOn(ev.b);if(live&&mode==='hide'){sus(ev.b,3.2);if(ev.b===player)say('넘어가다 걸렸다!',1.2);}}
      if(ev.type==='light'){if(live)lightSound(ev.s);if(ev.s==='green')alertsOff();if(live&&mode==='hide')recLight(ev.s);if(live&&mode==='seek'&&ev.s==='green'){const ctx=aiCtx();bots.forEach(b=>{if(!b.found&&!b.gone&&!b.remote)botPlan(world,b,ctx);});}}});
    {const on=live&&world.light==='red';$('redTag').hidden=!on;if(on)$('redTag').textContent=mode==='seek'?`보는 중 ${Math.max(0,2.5-world.lightT).toFixed(1)}초 · 지금 옆으로 가는 상자는 !`:'직원이 보는 중';}
    floorLight(world.light,now); // 신호 = 바닥 조명
    world.events=[];

    world.boxes.forEach(b=>{const m=meshFor(b);if(b.gone||b.pending||inTun(b)){m.g.visible=false;return;}m.g.visible=true;
      let [x,y]=world.pos(b);if(b.vo){x+=b.vo[0];y+=b.vo[1];const k=Math.exp(-dt/.12);b.vo[0]*=k;b.vo[1]*=k;if(Math.abs(b.vo[0])+Math.abs(b.vo[1])<.01)b.vo=null;}let h=0;if(m.bump>0){m.bump-=dt;h=Math.abs(Math.sin(m.bump*30))*.15;}m.g.position.set(wx(x),h,wz(y));});
    coins.forEach((c,i)=>{const g=coinMeshes.get(c.id);if(!g)return;const k=g.userData.coin,f=Math.max(0,c.t/COIN_LIFE);
      g.visible=!(mode==='hide'&&player&&player.took&&player.took.has(c.id)); // 내가 먹은 코인은 내 화면에서만 지운다(남들 화면엔 그대로라 들통나지 않음)
      k.scale.y=k.scale.z=.6+.4*f;k.visible=!(c.t<3&&Math.floor(now/120)%2);
      k.quaternion.copy(cam.quaternion).multiply(coinQ);k.scale.x=(.25+.75*Math.abs(Math.cos(now/260+i)))*(.6+.4*f);k.position.y=1.1+.12*Math.sin(now/300+i);}); // 크기가 수명, 폭이 변하며 도는 것처럼(v13.5 모양) // 동전 면이 늘 카메라를 본다
    const hv=!!(hover&&mode==='seek'&&!over&&!hover.gone&&!hover.found);hoverRing.visible=hv;if(hv){const [hx,hy]=world.pos(hover);hoverRing.position.set(wx(hx),.42,wz(hy));}
    if(mode==='hide'&&player&&!player.pending){const [x,y]=world.pos(player);const X=wx(x),Z=wz(y),h=player.size*.8+.33;
      meArrow.position.set(X,h+1.4+.35*Math.sin(now/220),Z);meArrow.quaternion.copy(cam.quaternion);meArrow.scale.setScalar(1.35);
      if(live&&!cl)huntStep(dt);}
    if(live&&!cl&&time<=0){if(mode==='hide')end(false,`시간 끝. 코인 ${player.got}/${goal}.`);else end(false,`시간 끝. 찾음 ${found}, 놓침 ${escaped}.`);}
    if(live)updHud();}
  if(msgT>0){msgT-=dt;if(msgT<=0)$('msg').hidden=true;}
  if(follow&&mode==='hide'&&player&&!player.pending){const [px]=world.pos(player);const tx=Math.max(follow.min,Math.min(follow.max,wx(px)));follow.cx+=(tx-follow.cx)*Math.min(1,dt*4);
    cam.position.set(follow.cx+follow.off.x,follow.off.y,follow.cz+follow.off.z);cam.lookAt(follow.cx,0,follow.cz);}
  {const e=$('edgeMark');let show=false;if(follow&&mode==='hide'&&player&&player.coin&&!over){edgeV.set(wx(player.coin.x),1,wz(player.coin.y)).project(cam);
    if(edgeV.x<-1||edgeV.x>1){show=true;const r=stage.getBoundingClientRect();e.textContent=edgeV.x<0?'◀ 코인':'코인 ▶';e.style.left=edgeV.x<0?'6px':'';e.style.right=edgeV.x<0?'':'6px';e.style.top=Math.max(40,Math.min(r.height-40,(1-edgeV.y)/2*r.height))+'px';}}
    e.hidden=!show;}
  R.render(S,cam);requestAnimationFrame(frame);}
// 테스트용 들여다보기(화면 흐름 테스트가 씀)
window.__box={scan:id=>{const b=world.boxes.find(o=>o.id===id);if(b&&mode==='seek'&&!over)scanBox(b);},s2w:(x,y)=>screenToWorld(x,y),human:{get plays(){return humanPlays.length;},get windows(){return humanWins().length;},get src(){return humanSrc;}},get bots(){return bots;},get mode(){return mode;},get player(){return player;},get world(){return world;},get over(){return over;},get net(){return net;},get time(){return time;},get coins(){return coins;}};
resize();menu();requestAnimationFrame(frame);
