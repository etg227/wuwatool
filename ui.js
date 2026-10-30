(()=>{'use strict';
// 界面增强层：主题、共鸣链节点、评分仪表盘、角色立绘背景、词条 roll 品质与无效词条提示。
// 只读取页面状态与 WuwaCore 的公开接口，不含任何评分逻辑。
const $=id=>document.getElementById(id);
const root=document.documentElement,KEY='wuwaTheme',MODES=['auto','light','dark'],LABEL={auto:'跟随系统',light:'浅色',dark:'深色'};
const raf=fn=>{let q=0;return()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;fn()})}};

/* ---------- 主题 ---------- */
const getTheme=()=>{try{const t=localStorage.getItem(KEY);return MODES.includes(t)?t:'auto'}catch{return'auto'}};
function applyTheme(m){if(m==='auto')delete root.dataset.theme;else root.dataset.theme=m;document.querySelectorAll('[data-theme-toggle]').forEach(b=>{b.title=`主题：${LABEL[m]}（点击切换）`;b.setAttribute('aria-label',`切换主题，当前${LABEL[m]}`)})}
document.addEventListener('click',e=>{const b=e.target.closest('[data-theme-toggle]');if(!b)return;const n=MODES[(MODES.indexOf(getTheme())+1)%3];try{n==='auto'?localStorage.removeItem(KEY):localStorage.setItem(KEY,n)}catch{}applyTheme(n)});
applyTheme(getTheme());

/* ---------- 共鸣链：星座节点（原下拉框保留并隐藏，作为唯一数据源） ---------- */
function chainTrack(){const sel=$('chainLevel');if(!sel||$('chainSeg'))return;const label=sel.closest('label');label?.classList.add('visually-hidden');
  const box=document.createElement('div');box.id='chainSeg';box.className='chain-seg';
  box.innerHTML='<span class="eyebrow" id="chainSegLabel">RESONANCE CHAIN · 共鸣链</span><div class="chain-track" role="radiogroup" aria-labelledby="chainSegLabel">'+[0,1,2,3,4,5,6].map(i=>`<button type="button" role="radio" data-chain="${i}" aria-checked="false" aria-label="${i} 链">${i||'<i></i>'}</button>`).join('')+'</div>';
  (label||sel).insertAdjacentElement('beforebegin',box);
  const sync=()=>{const v=+sel.value||0;box.querySelectorAll('button').forEach(b=>{const n=+b.dataset.chain;b.setAttribute('aria-checked',String(n===v));b.dataset.lit=n>0&&n<=v?'1':'0'})};
  box.addEventListener('click',e=>{const b=e.target.closest('button[data-chain]');if(!b)return;const n=+b.dataset.chain;sel.value=String(n===+sel.value&&n>0?n-1:n);sel.dispatchEvent(new Event('change',{bubbles:true}));sync()});
  sel.addEventListener('change',sync);setInterval(sync,400);sync()}

/* ---------- 仪表盘 ---------- */
const SWEEP=270,R=84,CIRC=2*Math.PI*R;
function gauge(){const arc=$('gaugeArc'),hero=$('hero');if(!arc)return;
  const len=CIRC*SWEEP/360;arc.style.strokeDasharray=`0 ${CIRC}`;
  const upd=()=>{const t=$('buildScore')?.textContent||'',v=parseFloat(t),ok=Number.isFinite(v),f=ok?Math.max(0,Math.min(100,v))/100:0;arc.style.strokeDasharray=`${len*f} ${CIRC}`;
    const g=$('buildChip')?.dataset.g||'';if(hero){hero.dataset.g=g;hero.dataset.has=ok?'1':'0'}};
  const run=raf(upd);new MutationObserver(run).observe($('buildScore'),{childList:true,characterData:true,subtree:true});
  const chip=$('buildChip');if(chip)new MutationObserver(run).observe(chip,{attributes:true,attributeFilter:['data-g']});upd()}

/* ---------- 立绘背景 ---------- */
function art(){const hero=$('hero'),pick=$('characterPick');if(!hero||!pick)return;
  const upd=()=>{const img=pick.querySelector('img'),src=img?.getAttribute('src');if(src){hero.style.setProperty('--art',`url("${src.replace(/"/g,'%22')}")`);hero.dataset.art='1'}else{hero.style.removeProperty('--art');hero.dataset.art='0'}hero.dataset.empty=pick.querySelector('#characterName')?.textContent.trim()==='选择角色'?'1':'0'};
  new MutationObserver(raf(upd)).observe(pick,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});upd()}

/* ---------- roll 品质 / 无效词条 / 卡片等级 ---------- */
function annotate(){const C=window.WuwaCore;if(!C?.coef||!C.ROLLS)return;
  const name=$('characterName')?.textContent.trim(),prof=name&&name!=='选择角色'?C.profile(name):null;
  let coef=null;try{coef=prof?C.coef(name,+$('chainLevel')?.value||0,$('scaler')?.value):null}catch{}
  document.querySelectorAll('#equippedEchoes .sub-rows .echo-row,#candidateSubRows .echo-row').forEach(row=>{
    const type=row.querySelector('.echo-type')?.value||'',val=+row.querySelector('.echo-value')?.value||0,list=C.ROLLS[type];
    let q='',m='',fx='';
    if(type&&list){const i=list.indexOf(val);q=i>=0?((i+1)/list.length).toFixed(3):'0';m=i===list.length-1?'1':'0';fx=!coef?'':coef[type]>0?'ok':'dead'}
    if(row.style.getPropertyValue('--q')!==q)q?row.style.setProperty('--q',q):row.style.removeProperty('--q');
    if((row.dataset.max||'')!==m)row.dataset.max=m;if((row.dataset.fx||'')!==fx){row.dataset.fx=fx;row.title=fx==='dead'?'这条词条对当前角色没有评分价值':''}});
  const rows=[...document.querySelectorAll('#equippedEchoes .sub-rows .echo-row')].filter(r=>r.querySelector('.echo-type')?.value),sum=$('echoSummary');
  if(sum){const ok=rows.filter(r=>r.dataset.fx==='ok').length,dead=rows.filter(r=>r.dataset.fx==='dead').length,max=rows.filter(r=>r.dataset.max==='1'&&r.dataset.fx!=='dead').length;
    const html=rows.length?`<span>已录入 <b>${rows.length}</b> 条副词条</span><span class="ok">有效 <b>${ok}</b></span><span class="max">满档 <b>${max}</b></span>${dead?`<span class="dead">无效 <b>${dead}</b></span>`:''}`:'';
    if(sum.innerHTML!==html)sum.innerHTML=html;sum.hidden=!rows.length}
  document.querySelectorAll('#equippedEchoes .echo-card').forEach(c=>{const g=c.querySelector('.echo-mini-grade')?.dataset.g||'';if((c.dataset.g||'')!==g)c.dataset.g=g})}
function insight(){const run=raf(annotate);['change','input'].forEach(t=>document.addEventListener(t,run,true));
  const eq=$('equippedEchoes');if(eq)new MutationObserver(run).observe(eq,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-g']});
  const cs=$('candidateSubRows');if(cs)new MutationObserver(run).observe(cs,{subtree:true,childList:true});
  const bs=$('buildScore');if(bs)new MutationObserver(run).observe(bs,{childList:true,characterData:true,subtree:true});setTimeout(run,800);run()}

/* ---------- 角色选择弹窗 ---------- */
function dialog(){const br=$('characterBrowser');if(!br)return;const close=()=>{if(!br.hidden)br.hidden=true};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  document.addEventListener('click',e=>{if(br.hidden)return;if(e.target.closest('#characterBrowser,#characterPick'))return;e.preventDefault();e.stopPropagation();close()},true);
  new MutationObserver(()=>{if(!br.hidden){const q=$('characterSearch');if(q&&q.value){q.value='';q.dispatchEvent(new Event('input',{bubbles:true}))}q?.focus()}}).observe(br,{attributes:true,attributeFilter:['hidden']})}

function init(){chainTrack();gauge();art();insight();dialog()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
