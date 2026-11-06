# 친구와 하기 v0 확인용(npm run check에는 안 들어감, 크롬 필요). 헤드리스 크롬 두 개를 띄워 mock.js(가짜 room: presence만)로 잇는다.
# 같은 브라우저 탭 둘은 뒤 탭 프레임이 멈춰서 안 됨 → 브라우저 둘 + 파이썬이 메시지를 옮겨 준다.
# 준비: WORK 폴더에 dist/index.html의 three.js CDN 주소를 three.min.js로 바꾼 index.html, three r128 three.min.js(npm pack three@0.128.0), 이 폴더의 mock.js를 net/mock.js로.
#   cd WORK && python3 -m http.server 8765 &   그다음  python3 tests/net/two_browsers.py WORK
# 주의: v0 전용. 멀티를 다시 만들면 이 테스트도 새로 쓴다.
import asyncio,sys
from playwright.async_api import async_playwright
SP=sys.argv[1]
async def main():
  async with async_playwright() as p:
    br=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'])
    br2=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    errs=[];pages=[]
    for b in (br,br2):
      ctx=await b.new_context(viewport={'width':1100,'height':640});await ctx.add_init_script(path=SP+'/net/mock.js');pg=await ctx.new_page();pages.append(pg)
    host,hid=pages
    async def relay(src,msg):
      for o in pages:
        if o is not src:
          try: await o.evaluate('m=>window.__onRelay&&window.__onRelay(m)',msg)
          except Exception as e: pass
    for pg in pages:
      await pg.expose_function('__relay',lambda m,pg=pg:asyncio.ensure_future(relay(pg,m)))
    for n,pg in (('host',host),('hider',hid)):
      pg.on('pageerror',lambda e,n=n:errs.append(n+': '+str(e)))
      pg.on('console',lambda m,n=n:errs.append(n+' console: '+m.text) if m.type in('error','warning') else None)
      await pg.goto('http://127.0.0.1:8765/index.html')
    await asyncio.sleep(1)
    await host.click('#bHost');await asyncio.sleep(.3);await hid.click('#bJoin');await asyncio.sleep(1)
    print('host lobby:',await host.text_content('#lobbyL'));print('hider lobby:',await hid.text_content('#lobbyL'))
    await host.click('#netGo');await asyncio.sleep(1.5)
    print('host mode',await host.evaluate('__box.mode'),'hider mode',await hid.evaluate('__box.mode'))
    rid=await hid.evaluate('__box.player&&__box.player.id');print('hider box id',rid)
    print('host remote', await host.evaluate('__box.bots.map(b=>[b.id,!!b.remote])'))
    # 위치 오차와 넘어가기 전달
    hops=0
    for k in range(40):
      await asyncio.sleep(.25)
      st=await hid.evaluate('(()=>{const p=__box.player,w=__box.world;return {mid:w.midMove(p),d:p.d,cy:p.cy,cx:p.cx,light:w.light,over:__box.over}})()')
      if st['over']:break
      if k%4==0 and not st['mid']:
        await hid.keyboard.press('ArrowDown' if st['cy']<3 else 'ArrowUp');hops+=1
      err=await host.evaluate(f'(()=>{{const b=__box.world.boxes.find(o=>o.id==={rid});return [__box.world.pos(b),b.cy]}})()')
      mine=await hid.evaluate('[__box.world.pos(__box.player),__box.player.cy]')
      if k%5==0:print(k,'host',[round(v,2) for v in err[0]],err[1],'hider',[round(v,2) for v in mine[0]],mine[1],st['light'])
    await asyncio.sleep(.6)
    hc=await host.evaluate(f'__box.world.boxes.find(o=>o.id==={rid}).cy');hcy=await hid.evaluate('__box.player.cy')
    print('hops sent',hops,'final cy host',hc,'hider',hcy,'light',await host.evaluate('__box.world.light'),await hid.evaluate('__box.world.light'))
    print('time host',await host.evaluate('__box.time'),'hider',await hid.evaluate('__box.time'))
    await hid.screenshot(path=SP+'/net/hider.png');await host.screenshot(path=SP+'/net/host.png')
    # 직원이 숨은 친구 스캔
    await host.evaluate(f'(()=>{{const b=__box.world.boxes.find(o=>o.id==={rid});b.found=true;b.kind="npc";}})()')
    await asyncio.sleep(1)
    print('hider over after found:',await hid.evaluate('__box.over'),await hid.text_content('#panelBox'))
    print('max presence bytes',await host.evaluate('__mockRoom.maxBytes'))
    # 다음 판
    await hid.click('#again');await asyncio.sleep(.3)
    # 직원이 판을 끝내고 다시 시작 → 상자 쪽도 새 판
    await host.evaluate('(()=>{const B=__box;B.bots.forEach(b=>{b.found=true});})()');await asyncio.sleep(.3)
    await host.evaluate('__box.world&&(__box.bots[1].gone=false)');
    await host.evaluate('document.querySelector("#pauseBtn").click()');await asyncio.sleep(.3)
    await host.click('#quit');await asyncio.sleep(.5);await host.click('#bHost');await asyncio.sleep(.8)
    print('host lobby 2:',await host.text_content('#lobbyL'))
    await host.click('#netGo');await asyncio.sleep(1.5)
    print('round2 hider mode',await hid.evaluate('__box.mode'),'over',await hid.evaluate('__box.over'))
    await host.evaluate('document.querySelector("#pauseBtn").click()');await asyncio.sleep(.3)
    print('host paused panel',(await host.text_content('#panelBox'))[:40])
    await host.click('#quit');await asyncio.sleep(1)
    print('hider after host left:',await hid.evaluate('__box.over'),await hid.text_content('#panelBox'))
    print('errors',errs[:10])
    await br.close()
asyncio.run(main())
