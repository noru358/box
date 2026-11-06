// 친구와 하기 v0 테스트용 가짜 room. two_browsers.py가 window.__relay로 다른 브라우저에 옮겨 준다.
// BroadcastChannel로 흉내 낸 room (presence + onPeers만)
(function(){const bc={postMessage:m=>window.__relay(JSON.stringify(m)),onmessage:null};window.__onRelay=s=>bc.onmessage&&bc.onmessage({data:JSON.parse(s)});const me='p'+Math.random().toString(36).slice(2,10);let pres={};const others={};const hs=[];let maxB=0;
function peers(){return Object.freeze([{peer:me,sameTab:true,isMe:true,kind:'viewer',presence:Object.freeze({...pres})},...Object.entries(others).map(([peer,p])=>({peer,sameTab:false,isMe:false,kind:'viewer',presence:p}))]);}
let pend=false;function fire(){if(pend)return;pend=true;setTimeout(()=>{pend=false;const ps=peers();hs.forEach(h=>h({peers:ps,joined:[],left:[],updated:ps}));},0);}
let sendT=null;function send(){if(sendT)return;sendT=setTimeout(()=>{sendT=null;bc.postMessage({t:'p',peer:me,p:pres});},33);} // ~30/s로 묶어 보냄
bc.onmessage=e=>{const m=e.data;if(m.t==='p'){others[m.peer]=m.p;fire();}else if(m.t==='hello'){bc.postMessage({t:'p',peer:me,p:pres});}else if(m.t==='bye'){delete others[m.peer];fire();}};
const room={presence(patch){const n={...pres};for(const k in patch){if(patch[k]===null)delete n[k];else n[k]=patch[k];}const len=JSON.stringify(n).length;if(len>4096)return Promise.reject({code:'invalid_argument',message:'too big '+len});maxB=Math.max(maxB,len);pres=n;send();fire();return Promise.resolve();},
 peers,onPeers(h){hs.push(h);fire();return ()=>{const i=hs.indexOf(h);if(i>=0)hs.splice(i,1);};},connected:()=>true};
window.__mockRoom={get maxBytes(){return maxB;},me,leave(){bc.postMessage({t:'bye',peer:me});}};
window.claude={use:async k=>k==='room'?room:null};setTimeout(()=>bc.postMessage({t:'hello'}),300);})();
