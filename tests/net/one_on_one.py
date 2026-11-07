# 친구와 1:1 확인용(npm run check에는 안 들어감, 크롬 필요). 헤드리스 크롬 두 개를 mock.js(가짜 room: presence만)로 잇고, 파이썬이 메시지를 0.2초 늦춰 옮긴다.
# 같은 브라우저 탭 둘은 뒤 탭 프레임이 멈춰서 안 됨 → 브라우저 둘.
# 준비: WORK 폴더에 dist/index.html의 three.js CDN 주소를 three.min.js로 바꾼 index.html, three r128 three.min.js(npm pack three@0.128.0), 이 폴더의 mock.js를 net/mock.js로.
#   cd WORK && python3 -m http.server 8765 &   그다음  python3 tests/net/one_on_one.py WORK
import asyncio,sys
from playwright.async_api import async_playwright
SP=sys.argv[1];LAG=.2
async def main():
  async with async_playwright() as p:
    args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']
    brs=[await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=args) for _ in range(2)]
    errs=[];pages=[]
    for b in brs:
      ctx=await b.new_context(viewport={'width':1100,'height':640});await ctx.add_init_script(path=SP+'/net/mock.js');pages.append(await ctx.new_page())
    A,B=pages
    async def relay(src,msg):
      await asyncio.sleep(LAG)
      for o in pages:
        if o is not src:
          try: await o.evaluate('m=>window.__onRelay&&window.__onRelay(m)',msg)
          except Exception: pass
    for n,pg in (('A',A),('B',B)):
      await pg.expose_function('__relay',lambda m,pg=pg:asyncio.ensure_future(relay(pg,m)))
      pg.on('pageerror',lambda e,n=n:errs.append(n+': '+str(e)))
      pg.on('console',lambda m,n=n:errs.append(n+' console: '+m.text) if m.type in('error','warning') else None)
      await pg.goto('http://127.0.0.1:8765/index.html')
    await asyncio.sleep(1)
    def chk(c,t):print(('ok   ' if c else 'FAIL ')+t)
    await A.click('#bNet');await asyncio.sleep(.6);await B.click('#bNet');await asyncio.sleep(1)
    ra,rb=await A.evaluate('__box.net.r'),await B.evaluate('__box.net.r');chk(ra=='seek' and rb=='hide',f'역할 나뉨 A={ra} B={rb}')
    print('  A:',await A.text_content('#lobbyL'));print('  B:',await B.text_content('#lobbyL'))
    async def round1(S,H,tag):
      await S.click('#netGo');await asyncio.sleep(1.2)
      chk(await S.evaluate('__box.mode')=='seek' and await H.evaluate('__box.mode')=='hide',tag+' 같이 시작')
      chk(await S.evaluate('__box.bots.length')==1,tag+' AI 숨은 상자 없음(숨은 상자 1개)')
      rid=await H.evaluate('__box.player.id')
      # 넘어가기 전달·위치 맞음
      for k in range(3):
        cy=await H.evaluate('__box.player.cy');await H.keyboard.press('ArrowDown' if cy<3 else 'ArrowUp');await asyncio.sleep(1.2)
      hc=await S.evaluate(f'__box.world.boxes.find(o=>o.id==={rid}).cy');mc=await H.evaluate('__box.player.cy');chk(hc==mc,f'{tag} 넘어간 줄 같음 술래={hc} 숨는={mc}')
      # 노랑 끝(숨는 쪽 화면 기준 빨강 직전)에 넘어가기: 안 걸려야
      async def wait_green():
        for _ in range(100):
          if await S.evaluate('__box.world.light=="green"&&__box.world.lightT>1.1') and not await H.evaluate('__box.world.midMove(__box.player)'):return True
          await asyncio.sleep(.1)
      await wait_green();al0=await H.evaluate('__box.net.al')
      await S.evaluate('document.querySelector("#lookBtn").click()')
      # 숨는 쪽 화면에 노랑이 켜진 그 프레임에 페이지 안에서 바로 누른다(밖에서 살피면 0.07초 틈을 놓친다)
      await H.evaluate('''new Promise(r=>{const f=()=>{if(__box.world.light==='yellow'){const k=__box.player.cy<3?'ArrowDown':'ArrowUp';document.dispatchEvent(new KeyboardEvent('keydown',{code:k,key:k,bubbles:true}));document.dispatchEvent(new KeyboardEvent('keyup',{code:k,key:k,bubbles:true}));r();}else requestAnimationFrame(f);};f();})''')
      sl=await S.evaluate('__box.world.light');await asyncio.sleep(1.2)
      al1=await H.evaluate('__box.net.al');sa=await S.evaluate(f'(()=>{{const b=__box.world.boxes.find(o=>o.id==={rid});return !!(b.alert)}})()')
      chk(al1==al0,f'{tag} 숨는 쪽 노랑 끝 넘어가기: 안 걸림 (그 순간 술래 화면 신호 {sl})')
      # 숨는 쪽 빨강 중 넘어가기: 걸리고 술래 화면에 ! 뜸
      cy=await H.evaluate('__box.player.cy');tun=await H.evaluate('(()=>{const w=__box.world,p=__box.player,[x,y]=w.pos(p);return w.isTunnel(Math.round(x),Math.round(y))})()');await H.keyboard.press('ArrowDown' if cy<3 else 'ArrowUp');await asyncio.sleep(.8)
      al2=await H.evaluate('__box.net.al');alert=await S.evaluate(f'(()=>{{const b=__box.world.boxes.find(o=>o.id==={rid});return !!(b.alert)}})()')
      if tun: print('  (터널 안이라 빨강 중 넘어가도 안 걸리는 게 규칙 — 이번엔 빨강 시험 건너뜀)')
      else: chk(al2>al1 and alert,f'{tag} 빨강 중 넘어가기: 걸림, 술래 화면 ! 뜸 ({await H.evaluate("__box.world.light")})')
      # 코인: 숨는 쪽이 코인 경계 쪽으로 가서 코인 자리에서 건넌다(페이지 안에서 초록일 때만) → 술래 화면에서 숨은 상자 코인이 오른다
      got0=await S.evaluate('__box.bots[0].got|0')
      res=await H.evaluate('''new Promise(r=>{const B=__box,t0=performance.now();const press=h=>{const k=['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'][h];document.dispatchEvent(new KeyboardEvent('keydown',{code:k,key:k,bubbles:true}));};
        const f=()=>{const w=B.world,p=B.player;if(performance.now()-t0>25000)return r('시간 넘음');if(B.over)return r('판 끝남');
          if(w.light==='green'&&w.lightT>.3&&!w.midMove(p)){let best=null;for(const c of B.coins){if(p.took&&p.took.has(c.id))continue;const d=coinDir(w,p,c);if(d.h<0)continue;if(d.ready){press(d.h);return setTimeout(()=>r('건넘 '+c.id),400);}if(!best||!d.on)best=d;}
            if(best&&!best.on&&Math.random()<.05)press(best.h);}
          requestAnimationFrame(f);};f();})''')
      await asyncio.sleep(1)
      got1=await S.evaluate('__box.bots[0].got|0');hg=await H.evaluate('__box.player.took.size')
      chk(res.startswith('건넘') and got1==got0+1,f'{tag} 코인 닿기: 숨는 쪽 판정 → 술래 화면 코인 {got0}→{got1} ({res}, 숨는 쪽 먹은 수 {hg})')
      # 술래가 스캔으로 찾음 → 둘 다 끝
      await S.evaluate(f'__box.scan({rid})');await asyncio.sleep(1.5)
      chk(await S.evaluate('__box.over'),tag+' 술래 쪽도 끝: '+(await S.text_content('#panelBox'))[:20])
      chk(await H.evaluate('__box.over'),tag+' 찾히면 숨는 쪽도 끝: '+(await H.text_content('#panelBox'))[:30])
      print('  presence 최대 바이트',await S.evaluate('__mockRoom.maxBytes'))
    await round1(A,B,'1판')
    # 방으로 → 역할 바꾸기 → 2판
    await A.click('#again');await B.click('#again');await asyncio.sleep(.8)
    await B.click('#netSw');await asyncio.sleep(1.2)
    ra,rb=await A.evaluate('__box.net.r'),await B.evaluate('__box.net.r');chk(ra=='hide' and rb=='seek',f'역할 바꾸기 A={ra} B={rb}')
    await round1(B,A,'2판')
    # 술래가 실패(스캔 다 씀)하면 숨는 쪽은 통과여야 한다. 틀린 상자는 회색 X(cleared)로 남는다
    await A.click('#again');await B.click('#again');await asyncio.sleep(.8)
    await B.click('#netGo');await asyncio.sleep(1.5)
    rid=await A.evaluate('__box.player.id')
    await B.evaluate(f'(()=>{{const ids=__box.world.boxes.filter(b=>b.id!=={rid}&&!b.gone&&!b.pending).slice(0,6).map(b=>b.id);ids.forEach(i=>__box.scan(i));}})()')
    nclr=await B.evaluate('__box.world.boxes.filter(b=>b.cleared).length');await asyncio.sleep(1.2)
    ta=await A.text_content('#panelBox');tb=await B.text_content('#panelBox')
    chk('통과' in ta and '실패' in tb,f'술래 스캔 다 씀: 술래 실패·숨는 쪽 통과 (숨는 쪽 "{ta[:14]}")')
    chk(nclr==6,f'틀린 상자 6개에 회색 X 남음 ({nclr})')
    await A.click('#again');await B.click('#again');await asyncio.sleep(.8)
    await B.click('#netGo');await asyncio.sleep(1.5)
    # 숨는 쪽 화면 버벅임: 3초 동안 매 프레임, 옆으로 안 넘어가는 일반 상자가 벨트 반대 방향으로 끌려간 최대 거리(받은 상태로 덮어쓸 때 생기던 것)
    back=await A.evaluate('''new Promise(r=>{const B=__box,DX=[1,0,-1,0],DY=[0,1,0,-1],prev=new Map();let mx=0,n=0;const f=()=>{B.world.boxes.forEach(b=>{if(b.gone||b.pending||b===B.player||b.slide)return;const [x,y]=B.world.pos(b),v=b.vo||[0,0],p=[x+v[0],y+v[1]],q=prev.get(b);if(q&&q[2]===b.cy&&q[3]===b.d){const along=(p[0]-q[0])*DX[b.d]+(p[1]-q[1])*DY[b.d];if(along<0&&along>-1.5)mx=Math.max(mx,-along);}prev.set(b,[p[0],p[1],b.cy,b.d]);});if(++n<180)requestAnimationFrame(f);else r(mx);};f();})''')
    chk(back<.1,f'숨는 쪽 화면: 상자가 뒤로 끌려간 최대 거리 {back:.2f}칸 (0.1 미만)')
    await B.evaluate('document.querySelector("#pauseBtn").click()');await asyncio.sleep(.3);await B.click('#quit');await asyncio.sleep(1.2)
    chk(await A.evaluate('__box.over'),'술래가 나가면 숨는 쪽 끝: '+(await A.text_content('#panelBox'))[:20])
    await A.screenshot(path=SP+'/A.png')
    print('errors',errs[:10])
    for b in brs:await b.close()
asyncio.run(main())
