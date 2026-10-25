(()=>{'use strict';
// 抽卡代理地址：部署 worker/ 目录下的 Cloudflare Worker 后填入（见 README「抽卡记录」）。
// 游戏的唤取记录接口不允许浏览器跨域直连，必须经由代理转发；代理只转发、不存储。
const GACHA_PROXY='';
const KEY='wuwaGachaV1';
const POOLS={1:'角色活动唤取',2:'武器活动唤取',3:'角色常驻唤取',4:'武器常驻唤取',5:'新手唤取',6:'新手自选唤取',7:'感恩定向唤取'};
const QUERY_TYPES=[1,2,3,4,5,6,7,8,9];
// 角色活动池出现常驻五星即视为「歪」。
const STANDARD_5=['鉴心','卡卡罗','安可','维里奈','凌阳'];
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
let current='';

function load(){try{const d=JSON.parse(localStorage.getItem(KEY)||'{}');return d&&typeof d.accounts==='object'?d:{accounts:{}}}catch{return{accounts:{}}}}
function save(d){localStorage.setItem(KEY,JSON.stringify(d));try{navigator.storage?.persist?.()}catch{}}

function parseUrl(raw){const m=String(raw||'').trim().match(/https?:\/\/[^\s"'<>]+/);if(!m)throw new Error('没有找到链接');const u=new URL(m[0].replace('#/record?','?').replace('#/','/'));const p=u.searchParams,get=k=>p.get(k)||'';
  const out={playerId:get('player_id'),serverId:get('svr_id'),recordId:get('record_id'),cardPoolId:get('resources_id')||get('gacha_id'),languageCode:get('lang')||'zh-Hans',region:u.hostname.endsWith('.com')?'cn':'global'};
  if(!/^\d{5,12}$/.test(out.playerId)||!out.serverId||!out.recordId||!out.cardPoolId)throw new Error('链接缺少 player_id / svr_id / record_id / resources_id，请复制完整的唤取记录链接');return out}

// 按「同一时间点」分组合并：每个时间点取记录更完整的一方，跨来源去重且保留十连内部顺序。
function mergeLists(a=[],b=[]){const group=l=>{const m=new Map();for(const r of l){if(!m.has(r.time))m.set(r.time,[]);m.get(r.time).push(r)}return m};const ga=group(a),gb=group(b),times=[...new Set([...ga.keys(),...gb.keys()])].sort();return times.flatMap(t=>{const x=ga.get(t)||[],y=gb.get(t)||[];return y.length>x.length?y:x})}
const clean=r=>({name:String(r.name||''),rank:Number(r.qualityLevel??r.rank)||3,kind:String(r.resourceType??r.kind??''),time:String(r.time||'')});

async function fetchPool(q,type){const res=await fetch(GACHA_PROXY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...q,cardPoolType:type})});const d=await res.json().catch(()=>null);if(!res.ok||!d||d.code!==0)throw new Error(d?.message||`代理返回 ${res.status}`);return(d.data||[]).map(clean).reverse()}
async function importUrl(raw,msg){if(!GACHA_PROXY)throw new Error('抽卡代理尚未部署，暂时无法在线导入');const q=parseUrl(raw);const d=load(),acc=d.accounts[q.playerId]||{region:q.region,pools:{}};let added=0;
  for(const t of QUERY_TYPES){msg(`正在读取 ${POOLS[t]||'卡池 '+t}…`);const list=await fetchPool(q,t);if(!list.length)continue;const before=(acc.pools[t]||[]).length;acc.pools[t]=mergeLists(acc.pools[t],list);added+=Math.max(0,acc.pools[t].length-before)}
  acc.region=q.region;acc.serverId=q.serverId;acc.updatedAt=new Date().toISOString();d.accounts[q.playerId]=acc;save(d);current=q.playerId;return added}
function mergeBackup(g){const d=load();let n=0;for(const[uid,acc]of Object.entries(g?.accounts||{})){if(!/^\d{5,12}$/.test(uid)||typeof acc?.pools!=='object')continue;const cur=d.accounts[uid]||{region:acc.region,pools:{}};for(const[t,l]of Object.entries(acc.pools)){if(!Array.isArray(l))continue;const before=(cur.pools[t]||[]).length;cur.pools[t]=mergeLists(cur.pools[t],l.map(clean));n+=Math.max(0,cur.pools[t].length-before)}cur.updatedAt=cur.updatedAt||acc.updatedAt;d.accounts[uid]=cur}save(d);return n}

function stats(type,list){let pity=0,four=0;const fives=[];for(const r of list){pity++;if(r.rank===5){fives.push({...r,pity,off:+type===1&&STANDARD_5.includes(r.name)});pity=0}else if(r.rank===4)four++}const avg=fives.length?fives.reduce((s,x)=>s+x.pity,0)/fives.length:0;return{total:list.length,pity,four,fives,avg,off:fives.filter(x=>x.off).length}}
function poolCard(type,list){const s=stats(type,list);return `<article class="hub-card gacha-pool"><header><b>${esc(POOLS[type]||'卡池 '+type)}</b><span class="micro">共 ${s.total} 抽</span></header><div class="gacha-nums"><div><strong>${s.pity}</strong><small>已垫</small></div><div><strong>${s.fives.length}</strong><small>五星</small></div><div><strong>${s.avg?s.avg.toFixed(1):'—'}</strong><small>平均出金</small></div><div><strong>${s.four}</strong><small>四星</small></div>${+type===1?`<div><strong>${s.fives.length?s.off+'/'+s.fives.length:'—'}</strong><small>歪</small></div>`:''}</div><div class="gacha-fives">${s.fives.slice().reverse().map(f=>`<span class="${f.off?'off':''}" title="${esc(f.time)}">${esc(f.name)} <em>${f.pity}</em></span>`).join('')||'<span class="micro">暂无五星</span>'}</div></article>`}

function summary(){const a=Object.values(load().accounts);if(!a.length)return '';const n=a.reduce((s,x)=>s+Object.values(x.pools||{}).reduce((t,l)=>t+l.length,0),0);return `${a.length} 个账号的 ${n} 条抽卡记录`}
function render(view){const d=load(),uids=Object.keys(d.accounts);if(!uids.includes(current))current=uids[0]||'';const acc=d.accounts[current];
  view.innerHTML=`<div class="hub-head"><div><h2>抽卡记录</h2><p class="micro">粘贴游戏内唤取记录链接导入，导入后自动保存在本浏览器，多次导入会合并去重——游戏只保留近期记录，在这里可以长期累积。</p></div></div>
  ${GACHA_PROXY?'':'<p class="hub-warn">抽卡代理尚未部署，在线导入暂不可用；已有记录可通过「数据」页导入备份查看。</p>'}
  <div class="hub-card gacha-import"><textarea id="gachaUrl" rows="3" placeholder="粘贴唤取记录链接，形如 https://aki-gm-resources.aki-game.com/aki/gacha/index.html#/record?svr_id=…&player_id=…&record_id=…&resources_id=…"></textarea><div class="hub-actions"><button type="button" class="primary" id="gachaImport" ${GACHA_PROXY?'':'disabled'}>导入并保存</button>${uids.length>1?`<select id="gachaAccount">${uids.map(u=>`<option ${u===current?'selected':''}>${esc(u)}</option>`).join('')}</select>`:''}<span class="micro" id="gachaMsg"></span></div>
  <details class="micro"><summary>如何获取链接（PC）</summary><ol><li>在游戏内打开「唤取」→「唤取记录」页面，翻看一下。</li><li>用记事本打开游戏目录下的 <code>Wuthering Waves Game\\Client\\Saved\\Logs\\Client.log</code>。</li><li>搜索 <code>aki-gm-resources</code>，复制最后一条包含 <code>record_id</code> 的完整链接粘贴到上面。</li></ol><p>链接只用于读取你的唤取记录，经代理转发给游戏服务器，不会被保存或上传到别处。手机端获取链接较复杂，暂推荐用 PC。</p></details></div>
  ${acc?`<p class="micro">UID ${esc(current)} · ${acc.region==='cn'?'国服':'国际服'} · 最近导入 ${esc((acc.updatedAt||'').slice(0,16).replace('T',' '))}</p><div class="gacha-grid">${Object.keys(acc.pools).sort((a,b)=>a-b).map(t=>poolCard(t,acc.pools[t])).join('')}</div>`:''}`;
  const msg=t=>{if($('gachaMsg'))$('gachaMsg').textContent=t};
  if($('gachaAccount'))$('gachaAccount').onchange=e=>{current=e.target.value;render(view)};
  $('gachaImport').onclick=async()=>{const b=$('gachaImport');b.disabled=true;try{const n=await importUrl($('gachaUrl').value,msg);render(view);msg(`导入完成，新增 ${n} 条记录`)}catch(e){msg('导入失败：'+e.message)}finally{if($('gachaImport'))$('gachaImport').disabled=!GACHA_PROXY}}}
window.WuwaGacha={render,mergeBackup,summary,parseUrl,mergeLists,stats};
})();
