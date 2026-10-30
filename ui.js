(()=>{'use strict';
// 界面增强：主题切换、共鸣链分段选择、角色选择弹窗的关闭行为。不含任何计算逻辑。
const $=id=>document.getElementById(id);
const KEY='wuwaTheme',root=document.documentElement;
const MODES=['auto','light','dark'],LABEL={auto:'跟随系统',light:'浅色',dark:'深色'};
const get=()=>{try{const t=localStorage.getItem(KEY);return MODES.includes(t)?t:'auto'}catch{return'auto'}};
function apply(m){if(m==='auto')delete root.dataset.theme;else root.dataset.theme=m;document.querySelectorAll('[data-theme-toggle]').forEach(b=>{b.title=`主题：${LABEL[m]}（点击切换）`;b.setAttribute('aria-label',`切换主题，当前${LABEL[m]}`)})}
document.addEventListener('click',e=>{const b=e.target.closest('[data-theme-toggle]');if(!b)return;const n=MODES[(MODES.indexOf(get())+1)%3];try{n==='auto'?localStorage.removeItem(KEY):localStorage.setItem(KEY,n)}catch{}apply(n)});
apply(get());

function chainSeg(){const sel=$('chainLevel');if(!sel||$('chainSeg'))return;const label=sel.closest('label');label?.classList.add('visually-hidden');
  const box=document.createElement('div');box.id='chainSeg';box.className='chain-seg';box.innerHTML='<span id="chainSegLabel">共鸣链</span><div role="radiogroup" aria-labelledby="chainSegLabel">'+[0,1,2,3,4,5,6].map(i=>`<button type="button" role="radio" data-chain="${i}" aria-checked="false" aria-label="${i} 链">${i}</button>`).join('')+'</div>';
  (label||sel).insertAdjacentElement('beforebegin',box);
  const sync=()=>box.querySelectorAll('button').forEach(b=>b.setAttribute('aria-checked',String(b.dataset.chain===sel.value)));
  box.addEventListener('click',e=>{const b=e.target.closest('button[data-chain]');if(!b)return;sel.value=b.dataset.chain;sel.dispatchEvent(new Event('change',{bubbles:true}));sync()});
  sel.addEventListener('change',sync);new MutationObserver(sync).observe(sel,{attributes:true});
  // 脚本直接改 value 时不会触发事件，定时对齐最安全
  setInterval(sync,400);sync()}

function dialog(){const br=$('characterBrowser');if(!br)return;
  const close=()=>{if(!br.hidden)br.hidden=true};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
  document.addEventListener('click',e=>{if(br.hidden)return;if(e.target.closest('#characterBrowser,#characterPick'))return;e.preventDefault();e.stopPropagation();close()},true);
  new MutationObserver(()=>{if(!br.hidden){const q=$('characterSearch');if(q&&q.value){q.value='';q.dispatchEvent(new Event('input',{bubbles:true}))}q?.focus()}}).observe(br,{attributes:true,attributeFilter:['hidden']})}

function init(){chainSeg();dialog()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
