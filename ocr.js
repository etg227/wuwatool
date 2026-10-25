(()=>{'use strict';
// 声骸详情截图识别：Tesseract.js 在浏览器本地运行，图片不上传。
// OCR 文本只作线索，最终结果都对齐到固定词表（副词条名、合法档位、声骸图鉴、套装名）。
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const STAT_LABELS=[['共鸣技能伤害加成','skillDmg'],['共鸣解放伤害加成','liberationDmg'],['普攻伤害加成','basicDmg'],['重击伤害加成','heavyDmg'],['冷凝伤害加成','elementDmg'],['热熔伤害加成','elementDmg'],['导电伤害加成','elementDmg'],['气动伤害加成','elementDmg'],['衍射伤害加成','elementDmg'],['湮灭伤害加成','elementDmg'],['治疗效果加成','healing'],['共鸣效率','energyRegen'],['暴击伤害','critDmg'],['暴击','critRate'],['攻击','atk'],['生命','hp'],['防御','def']];
const SPLIT={atk:['atkPct','flatAtk'],hp:['hpPct','flatHp'],def:['defPct','flatDef']};
const FIXED={4:['flatAtk',150],3:['flatAtk',100],1:['flatHp',2280]};

function lcs(a,b){const m=a.length,n=b.length;if(!m||!n)return 0;let prev=new Array(n+1).fill(0);for(let i=1;i<=m;i++){const cur=[0];for(let j=1;j<=n;j++)cur[j]=a[i-1]===b[j-1]?prev[j-1]+1:Math.max(prev[j],cur[j-1]);prev=cur}return prev[n]}
const sim=(a,b)=>a&&b?2*lcs(a,b)/(a.length+b.length):0;
const norm=s=>String(s||'').replace(/[\s·・.。,，'"“”‘’`]/g,'');
const cjk=s=>norm(s).replace(/[^一-龥]/g,'');

function matchLabel(text){const s=norm(text).replace(/^[^一-龥]+/,''),head=s.split(/\d/)[0];if(!head)return null;
  for(const[l,t]of STAT_LABELS)if(head.includes(l))return{label:l,type:t};
  let best=null;for(const[l,t]of STAT_LABELS){const sc=Math.max(sim(head,l),sim(head.slice(1),l));if(sc>=.66&&(!best||sc>best.sc))best={label:l,type:t,sc}}return best}
// 数值总在行尾：取最后一个汉字之后的数字，避开标签前面图标被误读出的杂散数字。
function readValue(text){const s=String(text||'').replace(/\s/g,'');let last=-1;for(let i=0;i<s.length;i++)if(/[\u4e00-\u9fa5]/.test(s[i]))last=i;let tail=s.slice(last+1);if(!/\d/.test(tail))tail=s.slice(Math.max(0,s.search(/[\u4e00-\u9fa5]/))+1);tail=tail.slice(tail.search(/\d/));const m=tail.match(/(\d+)(?:[.,](\d))?(\d*)(%?)/);if(!m)return null;const v=Number(m[1]+(m[2]!=null?'.'+m[2]:''));return{value:v,pct:!!m[4]||m[2]!=null||!!m[3]}}
function snap(list,v){let best=list[0];for(const x of list)if(Math.abs(x-v)<Math.abs(best-v))best=x;return best}

// lines: OCR 文本行；ref: {rolls, mainValue, echoes, setNames}
function parse(text,ref){const lines=String(text||'').split('\n').map(l=>l.trim()).filter(Boolean);const out={cost:0,name:'',nameScore:0,set:'',setScore:0,mainType:'',mainOk:false,sub:[],warnings:[]};
  const ci=lines.findIndex(l=>/COST\s*[134]/i.test(l.replace(/\s/g,'')));if(ci>=0)out.cost=+lines[ci].replace(/\s/g,'').match(/COST([134])/i)[1];
  const stats=[];for(let i=Math.max(0,ci+1);i<lines.length&&stats.length<8;i++){if(/声骸技能|合鸣效果/.test(cjk(lines[i])))break;const lb=matchLabel(lines[i]),v=lb&&readValue(lines[i]);if(!lb||!v)continue;let type=lb.type;if(SPLIT[type])type=v.pct?SPLIT[type][0]:SPLIT[type][1];stats.push({type,value:v.value,label:lb.label})}
  if(!out.cost&&stats.length){const f=stats.find(s=>Object.entries(FIXED).some(([,x])=>x[0]===s.type&&x[1]===s.value));if(f)out.cost=+Object.entries(FIXED).find(([,x])=>x[0]===f.type&&x[1]===f.value)[0]}
  const main=stats.shift();
  if(main){const mv=ref.mainValue[out.cost]||{};if(main.type in mv){out.mainType=main.type;out.mainOk=Math.abs(mv[main.type]-main.value)<.15}else out.warnings.push(`主词条「${main.label} ${main.value}」不是 ${out.cost||'?'} COST 的合法主词条`)}else out.warnings.push('没有识别到主词条');
  const fx=FIXED[out.cost];if(stats[0]&&fx&&stats[0].type===fx[0])stats.shift();
  const seen=new Set();for(const s of stats.slice(0,5)){const list=ref.rolls[s.type];if(!list||seen.has(s.type)){out.warnings.push(`无法识别的副词条「${s.label} ${s.value}」`);continue}seen.add(s.type);const v=snap(list,s.value);out.sub.push({type:s.type,value:v,ok:Math.abs(v-s.value)<=(s.type.startsWith('flat')?.5:.051),raw:s.value})}
  if(out.sub.length<5)out.warnings.push(`只识别到 ${out.sub.length} 条副词条`);
  const head=lines.slice(0,ci>=0?ci:2).map(cjk).join('');const pool=ref.echoes.filter(e=>!out.cost||e.cost===out.cost);let bn=null;for(const e of pool){const sc=sim(head,cjk(e.name));if(!bn||sc>bn.sc)bn={e,sc}}if(bn&&bn.sc>=.5){out.name=bn.e.name;out.nameScore=bn.sc}else out.warnings.push('没有匹配到声骸名称');
  const si=lines.findIndex(l=>/合鸣/.test(cjk(l)));const own=bn?.e?.sets||[];let bs=null;for(const l of lines.slice(si>=0?si:0)){const t=cjk(l);if(t.length<3)continue;for(const n of ref.setNames){const sc=(t.includes(n)?1:sim(t.slice(0,n.length+1),n))+(own.includes(n)?.1:0);if(sc>=.6&&(!bs||sc>bs.sc))bs={n,sc}}}if(bs){out.set=bs.n;out.setScore=Math.min(1,bs.sc)}
  return out}

// ---------- 浏览器部分 ----------
const VENDOR=()=>new URL('vendor/tesseract/',location.href).href;
let workerP=null;
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('识别组件加载失败'));document.head.appendChild(s)})}
function getWorker(msg){if(!workerP)workerP=(async()=>{if(!window.Tesseract)await loadScript(VENDOR()+'tesseract.min.js');msg('正在加载识别模型（首次约 6MB，之后会缓存）…');return Tesseract.createWorker('chi_sim',1,{workerPath:VENDOR()+'worker.min.js',corePath:VENDOR()+'core',langPath:VENDOR()+'lang',gzip:true,workerBlobURL:false})})().catch(e=>{workerP=null;throw e});return workerP}
function bitmap(file){return createImageBitmap(file)}
// 详情面板靠右，按屏幕高度换算位置，可适配不同分辨率；识别失败时退回右半屏。
function prep(img,wide,target=800){const W=img.width,H=img.height;const r=wide?{x:Math.round(W*.5),y:0,w:Math.round(W*.5),h:H}:{x:Math.max(0,Math.round(W-.40*H)),y:Math.round(.12*H),w:Math.min(W,Math.round(.36*H)),h:Math.round(.80*H)};const k=Math.max(1,Math.min(5,target/r.w));const c=document.createElement('canvas');c.width=Math.round(r.w*k);c.height=Math.round(r.h*k);const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingQuality='high';g.drawImage(img,r.x,r.y,r.w,r.h,0,0,c.width,c.height);const d=g.getImageData(0,0,c.width,c.height),p=d.data;let lo=255,hi=0;for(let i=0;i<p.length;i+=4){const y=255-(.299*p[i]+.587*p[i+1]+.114*p[i+2]);p[i]=y;if(y<lo)lo=y;if(y>hi)hi=y}const span=Math.max(1,hi-lo);for(let i=0;i<p.length;i+=4){const y=(p[i]-lo)*255/span;p[i]=p[i+1]=p[i+2]=y}g.putImageData(d,0,0);return c}
const quality=r=>(r.cost?2:0)+(r.mainType?2:0)+r.sub.length+(r.name?1:0);
function ref(){const C=window.WuwaCore;return{rolls:C.ROLLS,mainValue:C.MAIN_VALUE,echoes:C.echoes(),setNames:C.sets().map(s=>s.name)}}
async function recognize(file,msg){const w=await getWorker(msg);const img=await bitmap(file);msg('识别中…');const t1=(await w.recognize(prep(img,false))).data.text;window.WuwaOCR.lastText=t1;let r=parse(t1,ref());for(const[wide,target]of[[false,1300],[true,1100]]){if(r.sub.length>=5&&r.mainType&&r.cost&&r.name)break;const t2=(await w.recognize(prep(img,wide,target))).data.text;const r2=parse(t2,ref());if(quality(r2)>quality(r))r=r2}return r}

const results=[];
function emptySlot(i){const c=document.querySelector(`.echo-card[data-echo="${i}"]`);return c&&!c.querySelector('.main-primary .echo-type')?.value&&![...c.querySelectorAll('.sub-rows .echo-type')].some(s=>s.value)}
function slotCost(i){return +document.querySelector(`.echo-card[data-echo="${i}"] .echo-cost`)?.value||0}
function suggest(r){const used=new Set(results.filter(x=>x!==r&&x.target!=null).map(x=>x.target));const order=[0,1,2,3,4].filter(i=>!used.has(i));return order.find(i=>emptySlot(i)&&slotCost(i)===r.cost)??order.find(i=>emptySlot(i))??order.find(i=>slotCost(i)===r.cost)??order[0]??0}
function chip(t,v,ok,main){const L=window.WuwaCore.LABEL;return `<span class="ocr-chip${main?' main':''}${ok?'':' warn'}">${esc(L[t]||t)} ${v}${t.startsWith('flat')?'':'%'}</span>`}
function renderResults(){const box=$('ocrResults');if(!box)return;const C=window.WuwaCore;box.innerHTML=results.map((r,k)=>{if(r.status)return `<div class="ocr-item"><span class="micro">${esc(r.file)}：${esc(r.status)}</span></div>`;const e=C.echo(r.name),mv=C.MAIN_VALUE[r.cost]?.[r.mainType];return `<div class="ocr-item"><div class="ocr-id">${e?.image?`<img src="${esc(e.image)}" alt="" referrerpolicy="no-referrer" data-fallback="${r.cost}C">`:`<span class="img-fallback">${r.cost||'?'}C</span>`}<div><b class="${r.nameScore<.8?'warn-text':''}">${esc(r.name||'未识别声骸')}</b><small>${r.cost||'?'} COST${r.set?' · '+esc(r.set):''}</small></div></div><div class="ocr-stats">${r.mainType?chip(r.mainType,mv,r.mainOk,true):''}${r.sub.map(s=>chip(s.type,s.value,s.ok)).join('')}</div>${r.warnings.length?`<p class="ocr-warn">${r.warnings.map(esc).join('；')}</p>`:''}<div class="ocr-fill"><select data-k="${k}">${[0,1,2,3,4].map(i=>`<option value="${i}" ${i===r.target?'selected':''}>填入声骸 ${i+1}（${slotCost(i)} COST）</option>`).join('')}</select><button type="button" class="mini" data-fill="${k}">${r.done?'已填入':'填入'}</button></div></div>`}).join('');
  $('ocrFillAll').disabled=!results.some(r=>!r.status&&!r.done)}
async function fill(r){if(!r||r.status)return;await window.WuwaProfiles.fillEcho(r.target,{cost:r.cost||slotCost(r.target),echoId:r.name,mainType:r.mainType,sub:r.sub.map(s=>({type:s.type,value:s.value}))});r.done=true;const m=$('sonataMain');if(r.set&&m&&!m.value&&[...m.options].some(o=>o.value===r.set)){m.value=r.set;m.dispatchEvent(new Event('change',{bubbles:true}))}}
async function handle(files){files=[...files].filter(f=>/^image\//.test(f.type));if(!files.length)return;const msg=t=>{if($('ocrStatus'))$('ocrStatus').textContent=t};for(const f of files){const r={file:f.name||'截图',status:'排队中'};results.push(r);renderResults();try{Object.assign(r,await recognize(f,msg),{status:''});r.target=suggest(r)}catch(e){r.status='识别失败：'+e.message}renderResults()}msg(`识别完成，请核对后填入（标黄的项需要确认）`)}
function mount(){if($('ocrOpen'))return;const head=$('echoPanelHead');if(!head)return;const b=document.createElement('button');b.type='button';b.id='ocrOpen';b.className='primary';b.textContent='截图导入';head.appendChild(b);
  const p=document.createElement('div');p.id='ocrPanel';p.className='ocr-panel';p.hidden=true;p.innerHTML=`<div class="ocr-drop" id="ocrDrop" tabindex="0"><b>拖入、粘贴（Ctrl+V）或点击选择声骸详情截图</b><span class="micro">支持一次多张；识别在本地完成，图片不会上传。目前针对 PC 端声骸详情界面，其他界面可能识别不准。</span><input type="file" id="ocrFile" accept="image/*" multiple hidden></div><p class="micro" id="ocrStatus"></p><div id="ocrResults" class="ocr-results"></div><div class="hub-actions"><button type="button" class="primary" id="ocrFillAll" disabled>全部填入</button><button type="button" id="ocrClear">清空结果</button><button type="button" id="ocrClose">收起</button></div>`;head.insertAdjacentElement('afterend',p);
  b.onclick=()=>{p.hidden=!p.hidden;if(!p.hidden)$('ocrDrop').focus()};$('ocrClose').onclick=()=>{p.hidden=true};$('ocrClear').onclick=()=>{results.length=0;renderResults();$('ocrStatus').textContent=''};
  const drop=$('ocrDrop');drop.onclick=()=>$('ocrFile').click();$('ocrFile').onchange=e=>{handle(e.target.files);e.target.value=''};drop.ondragover=e=>{e.preventDefault();drop.classList.add('over')};drop.ondragleave=()=>drop.classList.remove('over');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('over');handle(e.dataTransfer.files)};
  document.addEventListener('paste',e=>{if(p.hidden)return;const f=[...e.clipboardData?.files||[]];if(f.length){e.preventDefault();handle(f)}});
  $('ocrResults').addEventListener('change',e=>{const k=e.target.dataset.k;if(k!=null){results[k].target=+e.target.value;results[k].done=false;renderResults()}});
  $('ocrResults').addEventListener('click',async e=>{const k=e.target.dataset.fill;if(k!=null){await fill(results[k]);renderResults()}});
  $('ocrFillAll').onclick=async()=>{for(const r of results)if(!r.status&&!r.done)await fill(r);renderResults()}}
window.WuwaOCR={parse,recognize};
if(typeof document!=='undefined'&&document.addEventListener){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount()}
})();
