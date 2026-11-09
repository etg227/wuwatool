(()=>{'use strict';
// 界面层：主题、工作区页签、声骸槽位、共鸣链节点、仪表盘、引导与提示。
// 只读取页面状态与 WuwaCore 公开接口，不含评分逻辑。
const $=id=>document.getElementById(id);
const root=document.documentElement,KEY='wuwaTheme',MODES=['auto','light','dark'],LABEL={auto:'跟随系统',light:'浅色',dark:'深色'};
const raf=fn=>{let q=0;return()=>{if(q)return;q=requestAnimationFrame(()=>{q=0;fn()})}};
const TABS=['echoes','advice','compare','stats','data'];

/* ---------- 主题 ---------- */
const getTheme=()=>{try{const t=localStorage.getItem(KEY);return MODES.includes(t)?t:'auto'}catch{return'auto'}};
const sysDark=matchMedia('(prefers-color-scheme: dark)');
const isDark=()=>root.dataset.theme?root.dataset.theme==='dark':sysDark.matches;
function sync(){const d=isDark();document.querySelectorAll('[data-theme-toggle]').forEach(b=>{b.setAttribute('aria-checked',String(d));b.title=`${d?'深色':'浅色'}${getTheme()==='auto'?'（跟随系统）':''} · 点击切换`})}
function applyTheme(m){if(m==='auto')delete root.dataset.theme;else root.dataset.theme=m;sync()}
// 开关只有亮 / 暗两态：没手动切过时跟随系统，切过一次就记住。切换时新主题从开关位置以圆形「照亮」整页。
function setTheme(n,from){const go=()=>{try{localStorage.setItem(KEY,n)}catch{}applyTheme(n)};const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!document.startViewTransition||still||!from)return go();const r=from.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,R=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
  document.startViewTransition(go).ready.then(()=>root.animate({clipPath:[`circle(0 at ${x}px ${y}px)`,`circle(${R}px at ${x}px ${y}px)`]},{duration:620,easing:'cubic-bezier(.45,0,.2,1)',pseudoElement:'::view-transition-new(root)'})).catch(()=>{})}
// 拖动：滑块跟手，--p 直接由位置决定（图标与光带停在中间态）；松手过半即切换，否则弹回。纯点击照常切换。
let dragged=false;
document.addEventListener('pointerdown',e=>{const b=e.target.closest('.lamp[data-theme-toggle]');if(!b||e.button)return;const travel=24,x0=e.clientX,p0=isDark()?1:0;let p=p0;dragged=false;
  const move=ev=>{const dx=ev.clientX-x0;if(!dragged&&Math.abs(dx)<4)return;if(!dragged){dragged=true;b.classList.add('drag');b.setPointerCapture?.(e.pointerId)}p=Math.max(0,Math.min(1,p0-dx/travel));b.style.setProperty('--p',p.toFixed(3))};
  const up=()=>{removeEventListener('pointermove',move);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);if(!dragged)return;b.classList.remove('drag');b.style.removeProperty('--p');const want=p>.5;if(want!==isDark())setTheme(want?'dark':'light',b)};
  addEventListener('pointermove',move);addEventListener('pointerup',up);addEventListener('pointercancel',up)});
document.addEventListener('click',e=>{const b=e.target.closest('[data-theme-toggle]');if(!b)return;if(dragged){dragged=false;return}setTheme(isDark()?'light':'dark',b)});
sysDark.addEventListener?.('change',sync);
applyTheme(getTheme());new MutationObserver(sync).observe(document.body||root,{childList:true});

/* ---------- 工作区页签 ---------- */
function tab(name,focus){if(!TABS.includes(name))return;const calc=$('calc');if(!calc)return;calc.dataset.tab=name;
  TABS.forEach(t=>{const on=t===name,btn=$('tab-'+t),pane=$('pane-'+t);if(btn){btn.setAttribute('aria-selected',String(on));btn.tabIndex=on?0:-1;if(on&&focus)btn.focus()}if(pane)pane.hidden=!on});indicator();
  const ws=$('workspace');if(ws&&window.scrollY>ws.offsetTop-90)window.scrollTo({top:Math.max(0,ws.offsetTop-76),behavior:'smooth'});update()}
function indicator(){const bar=document.querySelector('.ws-tabs'),on=bar?.querySelector('[aria-selected="true"]');if(!bar||!on)return;let ind=bar.querySelector('.ws-ind');if(!ind){ind=document.createElement('span');ind.className='ws-ind';ind.setAttribute('aria-hidden','true');bar.prepend(ind)}if(!on.offsetWidth)return;ind.style.setProperty('--x',on.offsetLeft+'px');ind.style.setProperty('--w',on.offsetWidth+'px');bar.classList.add('ready')}
function tabs(){const bar=document.querySelector('.ws-tabs');if(!bar)return;addEventListener('resize',raf(indicator));new ResizeObserver(raf(indicator)).observe(bar);
  bar.addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(b)tab(b.dataset.tab)});
  bar.addEventListener('keydown',e=>{const i=TABS.indexOf($('calc').dataset.tab);const k={ArrowRight:1,ArrowLeft:-1}[e.key];if(k){e.preventDefault();tab(TABS[(i+k+TABS.length)%TABS.length],true)}else if(e.key==='Home'){e.preventDefault();tab(TABS[0],true)}else if(e.key==='End'){e.preventDefault();tab(TABS[TABS.length-1],true)}});
  document.addEventListener('click',e=>{const g=e.target.closest('[data-goto]');if(g)tab(g.dataset.goto)});
  $('welcomePick')?.addEventListener('click',()=>$('characterPick')?.click());
  $('nextPill')?.addEventListener('click',()=>{const a=$('nextPill').dataset.action||'echoes';if(a==='pick')$('characterPick')?.click();else tab(a)});
  tab('echoes')}

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
function gauge(){const arc=$('gaugeArc'),hero=$('hero');if(!arc)return;const len=CIRC*SWEEP/360;arc.style.strokeDasharray=`0 ${CIRC}`;
  const upd=()=>{const v=parseFloat($('buildScore')?.textContent||''),ok=Number.isFinite(v),f=ok?Math.max(0,Math.min(100,v))/100:0;arc.style.strokeDasharray=`${len*f} ${CIRC}`;const g=$('buildChip')?.dataset.g||'';if(hero){hero.dataset.g=g;hero.dataset.has=ok?'1':'0'}};
  const run=raf(()=>{upd();roll()});new MutationObserver(run).observe($('buildScore'),{childList:true,characterData:true,subtree:true});
  // 总分变化时数字带回弹地滚到新值（与开关同一条弹簧曲线）
  const src=$('buildScore'),center=src?.parentElement;let shown=NaN,anim=0;const out=document.createElement('strong');out.className='g-roll';out.setAttribute('aria-hidden','true');src?.insertAdjacentElement('afterend',out);center?.classList.add('rolling');
  const spring=t=>{const c=1.45;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
  function roll(){const txt=src.textContent.trim(),v=parseFloat(txt);cancelAnimationFrame(anim);if(!Number.isFinite(v)||matchMedia('(prefers-reduced-motion: reduce)').matches){out.textContent=txt;shown=v;return}const a=Number.isFinite(shown)?shown:0,t0=performance.now(),D=750;shown=v;const step=now=>{const k=Math.min(1,(now-t0)/D);out.textContent=(a+(v-a)*spring(k)).toFixed(1);if(k<1)anim=requestAnimationFrame(step);else out.textContent=txt};anim=requestAnimationFrame(step)}
  const chip=$('buildChip');if(chip)new MutationObserver(run).observe(chip,{attributes:true,attributeFilter:['data-g']});upd();roll()}

/* ---------- 立绘背景 / 空状态 ---------- */
function art(){const hero=$('hero'),pick=$('characterPick'),calc=$('calc');if(!hero||!pick)return;
  const upd=()=>{const img=pick.querySelector('img'),src=img?.getAttribute('src');if(src){hero.style.setProperty('--art',`url("${src.replace(/"/g,'%22')}")`);hero.dataset.art='1'}else{hero.style.removeProperty('--art');hero.dataset.art='0'}
    const empty=pick.querySelector('#characterName')?.textContent.trim()==='选择角色'?'1':'0';hero.dataset.empty=empty;if(calc)calc.dataset.empty=empty;update()};
  new MutationObserver(raf(upd)).observe(pick,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});upd()}

/* ---------- 声骸槽位（主从结构） ---------- */
const slotHtml=i=>`<button type="button" class="slot" role="tab" data-slot="${i}" aria-selected="false"><span class="slot-no">${i+1}</span><span class="slot-img"></span><span class="slot-main"><b class="slot-name">未指定声骸</b><small class="slot-sub"></small><span class="slot-pips"><i></i><i></i><i></i><i></i><i></i></span></span><span class="slot-score"><strong>—</strong><em></em></span></button>`;
function slots(){const rail=$('slotRail'),grid=$('equippedEchoes');if(!rail||!grid)return;rail.innerHTML=[0,1,2,3,4].map(slotHtml).join('');
  const sel=i=>{grid.dataset.slot=String(i);rail.querySelectorAll('.slot').forEach(b=>{const on=+b.dataset.slot===i;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1})};
  rail.addEventListener('click',e=>{const b=e.target.closest('.slot');if(b)sel(+b.dataset.slot)});
  rail.addEventListener('keydown',e=>{const k={ArrowDown:1,ArrowUp:-1,ArrowRight:1,ArrowLeft:-1}[e.key];if(!k)return;e.preventDefault();const i=(+grid.dataset.slot+k+5)%5;sel(i);rail.querySelector(`[data-slot="${i}"]`)?.focus()});
  sel(0);window.WuwaUI.slot=sel}
function updateSlots(){const rail=$('slotRail');if(!rail)return;
  [0,1,2,3,4].forEach(i=>{const b=rail.querySelector(`[data-slot="${i}"]`),c=document.querySelector(`#equippedEchoes .echo-card[data-echo="${i}"]`);if(!b||!c)return;
    const cost=c.querySelector('.echo-cost')?.value||'',idSel=c.querySelector('.echo-id'),name=idSel?.value?idSel.selectedOptions[0]?.textContent:'',mainSel=c.querySelector('.main-primary .echo-type'),main=mainSel?.value?mainSel.selectedOptions[0]?.textContent:'';
    const set=(el,t)=>{if(el&&el.textContent!==t)el.textContent=t};
    set(b.querySelector('.slot-name'),name||'未指定声骸');set(b.querySelector('.slot-sub'),`${cost} COST · ${main||'未选主词条'}`);
    const src=c.querySelector('.echo-ident img')?.getAttribute('src'),im=b.querySelector('.slot-img');if(im){const want=src?`<img src="${src.replace(/"/g,'&quot;')}" alt="" data-fallback="${cost}C">`:`<span>${cost}C</span>`;if(im.dataset.k!==(src||cost)){im.innerHTML=want;im.dataset.k=src||cost}}
    const rows=[...c.querySelectorAll('.sub-rows .echo-row')];b.querySelectorAll('.slot-pips i').forEach((p,k)=>{const r=rows[k],q=r?.style.getPropertyValue('--q')||'0';if(p.style.getPropertyValue('--q')!==q)p.style.setProperty('--q',q);const m=r?.dataset.max||'',f=r?.dataset.fx||'';if((p.dataset.max||'')!==m)p.dataset.max=m;if((p.dataset.fx||'')!==f)p.dataset.fx=f});
    const sc=document.getElementById('miniScore'+i)?.textContent||'—',gr=document.getElementById('miniGrade'+i);set(b.querySelector('.slot-score strong'),sc);set(b.querySelector('.slot-score em'),gr?.textContent||'');const g=gr?.dataset.g||'';if((b.dataset.g||'')!==g)b.dataset.g=g})}

/* ---------- roll 品质 / 无效词条 / 汇总 / 徽标 / 引导 ---------- */
const panelFilled=()=>['totalAtk','totalHp','totalDef'].some(id=>($(id)?.value||'')!=='');
function annotate(){const C=window.WuwaCore;if(!C?.coef||!C.ROLLS)return;
  const name=$('characterName')?.textContent.trim(),prof=name&&name!=='选择角色'?C.profile(name):null;let coef=null;try{coef=prof?C.coef(name,+$('chainLevel')?.value||0,$('scaler')?.value):null}catch{}
  document.querySelectorAll('#equippedEchoes .sub-rows .echo-row,#candidateSubRows .echo-row').forEach(row=>{
    const type=row.querySelector('.echo-type')?.value||'',val=+row.querySelector('.echo-value')?.value||0,list=C.ROLLS[type];let q='',m='',fx='';
    if(type&&list){const i=list.indexOf(val);q=i>=0?((i+1)/list.length).toFixed(3):'0';m=i===list.length-1?'1':'0';fx=!coef?'':coef[type]>0?'ok':'dead'}
    if(row.style.getPropertyValue('--q')!==q)q?row.style.setProperty('--q',q):row.style.removeProperty('--q');
    if((row.dataset.max||'')!==m)row.dataset.max=m;if((row.dataset.fx||'')!==fx){row.dataset.fx=fx;row.title=fx==='dead'?'这条词条对当前角色没有评分价值':''}});
  const rows=[...document.querySelectorAll('#equippedEchoes .sub-rows .echo-row')].filter(r=>r.querySelector('.echo-type')?.value),sum=$('echoSummary');
  if(sum){const ok=rows.filter(r=>r.dataset.fx==='ok').length,dead=rows.filter(r=>r.dataset.fx==='dead').length,max=rows.filter(r=>r.dataset.max==='1'&&r.dataset.fx!=='dead').length;
    const html=rows.length?`<span>已录入 <b>${rows.length}</b> 条副词条</span><span class="ok">有效 <b>${ok}</b></span><span class="max">满档 <b>${max}</b></span>${dead?`<span class="dead">无效 <b>${dead}</b></span>`:''}`:'';if(sum.innerHTML!==html)sum.innerHTML=html;sum.hidden=!rows.length}
  document.querySelectorAll('#equippedEchoes .echo-card').forEach(c=>{const g=c.querySelector('.echo-mini-grade')?.dataset.g||'';if((c.dataset.g||'')!==g)c.dataset.g=g});
  updateSlots();update()}
function update(){const calc=$('calc');if(!calc)return;const set=(el,t)=>{if(el&&el.textContent!==t)el.textContent=t};
  const filledSlots=[0,1,2,3,4].filter(i=>{const c=document.querySelector(`#equippedEchoes .echo-card[data-echo="${i}"]`);return c&&(c.querySelector('.main-primary .echo-type')?.value||[...c.querySelectorAll('.sub-rows .echo-type')].some(s=>s.value))}).length;
  const filled=panelFilled(),best=$('bestStandard')?.textContent.trim()||'',note=$('bestStandardNote')?.textContent||'',gain=(note.match(/[+-]\d+(\.\d+)?%/)||[''])[0];
  set($('badgeEchoes'),`${filledSlots}/5`);
  const bs=$('badgeStats');set(bs,filled?'':'待填');if(bs)bs.dataset.todo=filled?'0':'1';
  const ba=$('badgeAdvice');const usable=filled&&filledSlots>0&&gain&&!/暂无|等待|—/.test(best);set(ba,usable?gain:'');
  const gate=$('adviceGate'),body=$('adviceBody');if(gate)gate.hidden=filled||filledSlots===0;if(body)body.hidden=!filled&&filledSlots>0;
  const pill=$('nextPill'),txt=$('npText');let t,a;
  if(calc.dataset.empty==='1'){t='选择角色开始';a='pick'}
  else if(filledSlots===0){t='录入声骸后给出评分';a='echoes'}
  else if(!filled){t='填写面板，解锁提升建议';a='stats'}
  else if(usable){const p=note.split(' · ');t=`提升「${best}」· ${p[1]||''} ${gain}`.replace(/\s+/g,' ');a='advice'}
  else{t='暂无可继续提升的词条';a='advice'}
  set(txt,t);if(pill)pill.dataset.action=a;
  set($('wsScore'),$('buildChip')?.textContent==='未评分'?'':$('buildChip')?.textContent||'')}
function insight(){const run=raf(annotate);['change','input'].forEach(t=>document.addEventListener(t,run,true));
  const eq=$('equippedEchoes');if(eq)new MutationObserver(run).observe(eq,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-g','src']});
  const cs=$('candidateSubRows');if(cs)new MutationObserver(run).observe(cs,{subtree:true,childList:true});
  ['buildScore','bestStandard','bestStandardNote'].forEach(id=>{const e=$(id);if(e)new MutationObserver(run).observe(e,{childList:true,characterData:true,subtree:true})});
  setTimeout(run,800);run()}

/* ---------- 保存提示 ---------- */
function toast(){const t=$('toast');if(!t)return;let timer=0;
  const show=s=>{t.textContent=s;t.hidden=false;t.classList.add('on');clearTimeout(timer);timer=setTimeout(()=>{t.classList.remove('on');setTimeout(()=>{if(!t.classList.contains('on'))t.hidden=true},250)},1800)};
  const attach=()=>{const st=$('wuwaSaveStatus');if(!st||st.dataset.toast)return!!st;st.dataset.toast='1';let last=st.textContent;new MutationObserver(()=>{const s=st.textContent;if(s!==last&&/^已(自动保存|自动载入|删除)/.test(s))show(s);last=s}).observe(st,{childList:true,characterData:true,subtree:true});return true};
  if(!attach()){const mo=new MutationObserver(()=>{if(attach())mo.disconnect()});mo.observe(document.body,{childList:true,subtree:true})}}

/* ---------- 角色选择弹窗 ---------- */
function dialog(){const br=$('characterBrowser');if(!br)return;const close=()=>{if(!br.hidden)br.hidden=true};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  document.addEventListener('click',e=>{if(br.hidden)return;if(e.target.closest('#characterBrowser,#characterPick,#nextPill,#welcomePick'))return;e.preventDefault();e.stopPropagation();close()},true);
  new MutationObserver(()=>{if(!br.hidden){const q=$('characterSearch');if(q&&q.value){q.value='';q.dispatchEvent(new Event('input',{bubbles:true}))}q?.focus()}}).observe(br,{attributes:true,attributeFilter:['hidden']})}

window.WuwaUI={tab,slot:()=>{}};
function init(){chainTrack();gauge();slots();art();tabs();insight();toast();dialog()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
