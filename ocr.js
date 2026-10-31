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

// ---------- 角色面板卡片（WutheringWavesUID / GsCore 机器人生成的长图）----------
// 版式固定：以「声骸信息」标题为锚点，按宽度比例裁出每个区域分别识别。坐标以 634 像素宽为基准。
const CARD={name:[92,-358,240,-322],weapon:[402,-370,500,-336],
  panel:[[360,-697,610,-669],[360,-669,460,-641],[360,-641,610,-613],[360,-613,610,-585],[360,-585,610,-557],[360,-557,610,-529],[360,-529,610,-501],[360,-501,610,-473]],
  cols:[22,224,427],rows:[[192,274],[512,592]]};
const isCard=img=>img.height/img.width>2.2;
function otsu(h,n){let sum=0;for(let i=0;i<256;i++)sum+=i*h[i];let sb=0,wb=0,best=0,t=128;for(let i=0;i<256;i++){wb+=h[i];if(!wb)continue;const wf=n-wb;if(!wf)break;sb+=i*h[i];const mb=sb/wb,mf=(sum-sb)/wf,v=wb*wf*(mb-mf)**2;if(v>best){best=v;t=i}}return t}
// 彩色字（白/金/青）在深色底上：默认取 RGB 最大值作亮度（gold / teal 模式只看对应色相），按区域 Otsu 二值化成白底黑字。
function crop(img,box,u,y0,target=900,gold){const[x1,y1,x2,y2]=box,r={x:Math.max(0,x1*u),y:Math.max(0,y0+y1*u),w:(x2-x1)*u,h:(y2-y1)*u};const k=Math.max(1,target/r.w);const c=document.createElement('canvas');c.width=Math.round(r.w*k);c.height=Math.round(r.h*k);const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingQuality='high';g.drawImage(img,r.x,r.y,r.w,r.h,0,0,c.width,c.height);const d=g.getImageData(0,0,c.width,c.height),p=d.data,h=new Array(256).fill(0);for(let i=0;i<p.length;i+=4){const[R,G,B]=[p[i],p[i+1],p[i+2]],m=gold==='gold'?Math.max(0,Math.min(R,G)-B*.6)|0:gold==='teal'?Math.max(0,Math.min(G,B)-R*.6)|0:Math.max(R,G,B);p[i]=m;h[m]++}const t=otsu(h,p.length/4);for(let i=0;i<p.length;i+=4){const y=p[i]>t?0:255;p[i]=p[i+1]=p[i+2]=y}g.putImageData(d,0,0);return c}
async function cardAnchor(w,img){const u=img.width/634,band={x:0,y:Math.round(img.height*.3),w:img.width,h:Math.round(img.height*.3)};const k=Math.max(1,1300/img.width);const c=document.createElement('canvas');c.width=Math.round(band.w*k);c.height=Math.round(band.h*k);const g=c.getContext('2d');g.drawImage(img,band.x,band.y,band.w,band.h,0,0,c.width,c.height);const d=g.getImageData(0,0,c.width,c.height),p=d.data;for(let i=0;i<p.length;i+=4){const y=255-Math.max(p[i],p[i+1],p[i+2]);p[i]=p[i+1]=p[i+2]=y}g.putImageData(d,0,0);
  const r=await w.recognize(c,{},{blocks:true});for(const b of r.data.blocks||[])for(const pa of b.paragraphs)for(const l of pa.lines){const t=cjk(l.text);if(/声.?信息|骸信息|声骸信/.test(t))return band.y+l.bbox.y0/k;if(/评分模板/.test(t))return band.y+l.bbox.y0/k-32*u}
  return 886*u}
async function txt(w,c,line){if(line)await w.setParameters({tessedit_pageseg_mode:'7'});try{return (await w.recognize(c)).data.text}finally{if(line)await w.setParameters({tessedit_pageseg_mode:'3'})}}
function bestName(text,names,min=.5){const t=cjk(text);let b=null;for(const n of names){const sc=t.includes(cjk(n))?1:sim(t,cjk(n));if(!b||sc>b.sc)b={n,sc}}return b&&b.sc>=min?b:null}
// 卡片每行的标签很短，「攻击/暴击」常被认混：先用数值筛出可能的词条（固定档位表），再用标签相似度在候选里挑。
const CARD_LABEL={critRate:'暴击',critDmg:'暴击伤害',atkPct:'攻击',flatAtk:'攻击',hpPct:'生命',flatHp:'生命',defPct:'防御',flatDef:'防御',energyRegen:'共鸣效率',basicDmg:'普攻伤害加成',heavyDmg:'重击伤害加成',skillDmg:'共鸣技能伤害加成',liberationDmg:'共鸣解放伤害加成',elementDmg:'伤害加成',healing:'治疗效果加成'};
function rowValue(t){let s=String(t||'').replace(/\s/g,'').replace(/[oO]/g,'0');const k=s.search(/[一-龥][^一-龥]*$/);if(k>=0&&/\d/.test(s.slice(k+1)))s=s.slice(k+1);const m=s.match(/(\d{1,4})(?:[.,](\d))?/);if(!m)return null;return{value:Number(m[1]+(m[2]!=null?'.'+m[2]:'')),pct:m[2]!=null||/%/.test(s)}}
// OCR 常把 0/6/8/9、1/7、3/8 认混：逐位替换后再去档位表里找。
const CONF={'0':'689','6':'058','8':'036','9':'08','1':'7','7':'1','3':'8','5':'6'};
function confusions(v){const s=String(v),out=[];for(let i=0;i<s.length;i++)for(const d of CONF[s[i]]||'')out.push(+(s.slice(0,i)+d+s.slice(i+1)));return out}
function pickType(label,cands){const l=cjk(label);let b=null;for(const t of cands){const ref=CARD_LABEL[t]||'';let sc=l.includes(ref)&&ref?1+ref.length/10:sim(l,ref);if(t==='elementDmg'&&/[冷热导气衍湮][凝熔电动射灭]/.test(l))sc=1.5;if(!b||sc>b.sc)b={t,sc}}return b?.t}
function parseCardEcho(nameText,rows,R){const out={cost:0,name:'',nameScore:0,set:'',setScore:0,mainType:'',mainOk:false,sub:[],warnings:[],raw:rows};
  const vals=rows.map(rowValue);const fx=vals[1]?.value;out.cost=fx===150?4:fx===100?3:fx===2280?1:0;
  if(!out.cost){const any=vals.slice(0,3).map(v=>v?.value);out.cost=any.includes(150)?4:any.includes(2280)?1:any.includes(100)?3:0}
  if(!out.cost)out.warnings.push('没有识别到 COST');
  const mv=R.mainValue[out.cost]||{},v0=vals[0];if(v0){const c=Object.keys(mv).filter(t=>Math.abs(mv[t]-v0.value)<.15);const t=pickType(rows[0],c.length?c:Object.keys(mv));if(t){out.mainType=t;out.mainOk=c.includes(t)}}if(!out.mainType)out.warnings.push('没有识别到主词条');
  const seen=new Set();for(let i=2;i<7;i++){const v=vals[i];if(!v)continue;const fits=x=>Object.keys(R.rolls).filter(t=>!seen.has(t)&&t.startsWith('flat')!==v.pct&&R.rolls[t].some(r=>Math.abs(r-x)<(v.pct?.06:.6)));let val=v.value,c=fits(val),ok=true;if(!c.length){for(const alt of confusions(v.value)){const c2=fits(alt);if(c2.length){val=alt;c=c2;ok=false;break}}}const t=pickType(rows[i],c);if(!t){out.warnings.push(`无法识别的副词条「${rows[i].trim()}」`);continue}seen.add(t);out.sub.push({type:t,value:snap(R.rolls[t],val),ok,raw:v.value})}
  if(out.sub.length<5)out.warnings.push(`只识别到 ${out.sub.length} 条副词条`);
  const pool=R.echoes.filter(e=>!out.cost||e.cost===out.cost);out.cands=[];for(const t of [].concat(nameText)){const c=cjk(t);if(c)for(const e of pool){const sc=c.includes(cjk(e.name))?1:sim(c,cjk(e.name));if(sc>=.3)out.cands.push({n:e.name,sc,sets:e.sets||[]})}}
  return out}
const PANEL_LABELS=[['共鸣效率','energyRegen'],['暴击伤害','critDmg'],['暴击','critRate'],['攻击','totalAtk'],['生命','totalHp'],['防御','totalDef']];
async function recognizeCard(file,msg){const w=await getWorker(msg);const img=await bitmap(file);msg('识别角色卡片…');const u=img.width/634,y0=await cardAnchor(w,img),C=window.WuwaCore,R=ref();
  const out={card:true,file:file.name||'截图',character:'',weapon:'',rank:1,panel:{},echoes:[],warnings:[]};
  const nm=bestName(await txt(w,crop(img,CARD.name,u,y0,500),true),C.roster().map(r=>r.name),.4);if(nm)out.character=nm.n;else out.warnings.push('没有识别到角色名');
  const wt=await txt(w,crop(img,CARD.weapon,u,y0,500),true),wn=bestName(wt.split(/\d/)[0],Object.keys(C.baseStats().weapons||{}),.5);if(wn)out.weapon=wn.n;const rk=norm(wt).match(/([1-5])阶/);if(rk)out.rank=+rk[1];
  for(const[i,box]of CARD.panel.entries()){const t=await txt(w,crop(img,box,u,y0,i===1?400:800),true);const s=norm(t);
    if(i===0){const m=s.match(/生.?(\d{4,6}).*?攻.?(\d{3,5})/);if(m){out.panel.totalHp=+m[1];out.panel.totalAtk=+m[2]}continue}
    if(i===1){const m=s.match(/(\d{3,5})/);if(m)out.panel.totalDef=+m[1];continue}
    const lb=PANEL_LABELS.find(([l])=>s.includes(l)),v=readValue(t);if(lb&&v&&!(lb[1]in out.panel))out.panel[lb[1]]=v.value}
  let n=0;for(const[hy,sy]of CARD.rows)for(const[ci,x]of CARD.cols.entries()){if(hy===192&&ci===0)continue;n++;msg(`识别声骸 ${n}/5…`);
    const nb=[x+60,hy+5,x+150,hy+26],name=[];for(const[tg,md]of[[500],[900,'gold']]){name.push(await txt(w,crop(img,nb,u,y0,tg,md),true))}const lines=[];for(let k=0;k<7;k++){const y=sy-6+k*29.15;const rb=[x+22,y,x+182,y+29.15];let l=(await txt(w,crop(img,rb,u,y0,640),true)).trim();for(const md of['teal','gold']){if(rowValue(l))break;const l2=(await txt(w,crop(img,rb,u,y0,640,md),true)).trim();if(rowValue(l2))l=l2}lines.push(l)}
    const r=parseCardEcho(name,lines,R);r.rawName=name;r.file=out.file;out.echoes.push(r)}
  // 名称认不准时用套装投票：同一套声骸通常共享一个套装，取出现最多的套装给候选加分（也用来区分「金/瓷庭候」这类只差一字的）。
  const vote={};for(const e of out.echoes){const top=e.cands.filter(c=>c.sc>=.75);if(new Set(top.map(c=>c.n)).size===1)top[0].sets.forEach(st=>vote[st]=(vote[st]||0)+1)}const rank=Object.entries(vote).sort((a,b)=>b[1]-a[1]),major=rank[0]&&(!rank[1]||rank[0][1]>rank[1][1])?rank[0][0]:'';out.set=major;
  for(const e of out.echoes){const by={};for(const c of e.cands){const v=c.sc+(major&&c.sets.includes(major)?.25:0);if(!(c.n in by)||v>by[c.n].v)by[c.n]={...c,v}}const l=Object.values(by).sort((a,b)=>b.v-a.v),best=l[0];
    if(best&&best.v>=.45&&!(l[1]&&l[1].v>best.v-.1)){e.name=best.n;e.nameScore=Math.min(1,best.sc)}else e.warnings.push(best&&best.v>=.45?`名称不确定（${l.slice(0,3).map(x=>x.n).join(' / ')}），请手动选择`:'没有匹配到声骸名称');delete e.cands}
  return out}

const results=[];
function emptySlot(i){const c=document.querySelector(`.echo-card[data-echo="${i}"]`);return c&&!c.querySelector('.main-primary .echo-type')?.value&&![...c.querySelectorAll('.sub-rows .echo-type')].some(s=>s.value)}
function slotCost(i){return +document.querySelector(`.echo-card[data-echo="${i}"] .echo-cost`)?.value||0}
function suggest(r){const used=new Set(results.filter(x=>x!==r&&x.target!=null).map(x=>x.target));const order=[0,1,2,3,4].filter(i=>!used.has(i));return order.find(i=>emptySlot(i)&&slotCost(i)===r.cost)??order.find(i=>emptySlot(i))??order.find(i=>slotCost(i)===r.cost)??order[0]??0}
function chip(t,v,ok,main){const L=window.WuwaCore.LABEL;return `<span class="ocr-chip${main?' main':''}${ok?'':' warn'}">${esc(L[t]||t)} ${v}${t.startsWith('flat')?'':'%'}</span>`}
function renderResults(){const box=$('ocrResults');if(!box)return;const C=window.WuwaCore;box.innerHTML=results.map((r,k)=>{if(r.card)return cardHtml(r,k);if(r.status)return `<div class="ocr-item"><span class="micro">${esc(r.file)}：${esc(r.status)}</span></div>`;const e=C.echo(r.name),mv=C.MAIN_VALUE[r.cost]?.[r.mainType];return `<div class="ocr-item"><div class="ocr-id">${e?.image?`<img src="${esc(e.image)}" alt="" referrerpolicy="no-referrer" data-fallback="${r.cost}C">`:`<span class="img-fallback">${r.cost||'?'}C</span>`}<div><b class="${r.nameScore<.8?'warn-text':''}">${esc(r.name||'未识别声骸')}</b><small>${r.cost||'?'} COST${r.set?' · '+esc(r.set):''}</small></div></div><div class="ocr-stats">${r.mainType?chip(r.mainType,mv,r.mainOk,true):''}${r.sub.map(s=>chip(s.type,s.value,s.ok)).join('')}</div>${r.warnings.length?`<p class="ocr-warn">${r.warnings.map(esc).join('；')}</p>`:''}<div class="ocr-fill"><select data-k="${k}">${[0,1,2,3,4].map(i=>`<option value="${i}" ${i===r.target?'selected':''}>填入声骸 ${i+1}（${slotCost(i)} COST）</option>`).join('')}</select><button type="button" class="mini" data-fill="${k}">${r.done?'已填入':'填入'}</button></div></div>`}).join('');
  $('ocrFillAll').disabled=!results.some(r=>!r.status&&!r.done)}
function cardHtml(r,k){const C=window.WuwaCore,L=C.LABEL,P=r.panel,pv=[['totalAtk','攻击'],['totalHp','生命'],['totalDef','防御'],['critRate','暴击','%'],['critDmg','暴击伤害','%'],['energyRegen','共鸣效率','%']].filter(([id])=>P[id]!=null).map(([id,l,u])=>`${l} ${P[id]}${u||''}`).join(' · ');
  return `<div class="ocr-item ocr-card"><div class="ocr-card-head"><b class="${r.character?'':'warn-text'}">${esc(r.character||'未识别角色')}</b><span class="micro">${r.weapon?esc(r.weapon)+' · '+r.rank+' 阶':'未识别武器'}${r.set?' · '+esc(r.set):''}</span>${pv?`<span class="micro">截图面板：${esc(pv)}</span>`:''}</div>${r.warnings.length?`<p class="ocr-warn">${r.warnings.map(esc).join('；')}</p>`:''}<div class="ocr-card-echoes">${r.echoes.map((e,i)=>{const ec=C.echo(e.name),mv=C.MAIN_VALUE[e.cost]?.[e.mainType];return `<div class="ocr-item"><div class="ocr-id">${ec?.image?`<img src="${esc(ec.image)}" alt="" referrerpolicy="no-referrer" data-fallback="${e.cost}C">`:`<span class="img-fallback">${e.cost||'?'}C</span>`}<div><b class="${e.nameScore<.8?'warn-text':''}">${i+1}. ${esc(e.name||'未识别声骸')}</b><small>${e.cost||'?'} COST</small></div></div><div class="ocr-stats">${e.mainType?chip(e.mainType,mv,e.mainOk,true):''}${e.sub.map(s=>chip(s.type,s.value,s.ok)).join('')}</div>${e.warnings.length?`<p class="ocr-warn">${e.warnings.map(esc).join('；')}</p>`:''}</div>`}).join('')}</div><div class="ocr-fill"><button type="button" class="primary" data-fill="${k}">${r.done?'已导入':'导入整套（角色 + 武器 + 5 只声骸）'}</button></div></div>`}
async function fillCard(r){const C=window.WuwaCore;if(r.character&&document.getElementById('characterName')?.textContent.trim()!==r.character){await window.WuwaProfiles.select(r.character);await new Promise(x=>setTimeout(x,120))}
  const pw=$('panelWeapon');if(pw&&r.weapon&&[...pw.options].some(o=>o.value===r.weapon)){pw.value=r.weapon;pw.dispatchEvent(new Event('change',{bubbles:true}))}const pr=$('panelRank');if(pr){pr.value=String(r.rank||1);pr.dispatchEvent(new Event('change',{bubbles:true}))}
  for(const[i,e]of r.echoes.entries())if(e.cost)await window.WuwaProfiles.fillEcho(i,{cost:e.cost,echoId:e.name,mainType:e.mainType,sub:e.sub.map(s=>({type:s.type,value:s.value}))});
  const auto=$('autoPanel');if(auto&&(auto.disabled||!auto.checked)){const P=r.panel;for(const id of ['totalAtk','totalHp','totalDef','critRate','critDmg','energyRegen'])if(P[id]!=null&&$(id)){$(id).value=String(P[id]);$(id).dispatchEvent(new Event('input',{bubbles:true}))}}
  const m=$('sonataMain');if(r.set&&m&&!m.value&&[...m.options].some(o=>o.value===r.set)){m.value=r.set;m.dispatchEvent(new Event('change',{bubbles:true}))}
  r.done=true;window.WuwaUI?.tab?.('echoes')}
async function fill(r){if(r?.card)return fillCard(r);if(!r||r.status)return;await window.WuwaProfiles.fillEcho(r.target,{cost:r.cost||slotCost(r.target),echoId:r.name,mainType:r.mainType,sub:r.sub.map(s=>({type:s.type,value:s.value}))});r.done=true;const m=$('sonataMain');if(r.set&&m&&!m.value&&[...m.options].some(o=>o.value===r.set)){m.value=r.set;m.dispatchEvent(new Event('change',{bubbles:true}))}}
async function handle(files){files=[...files].filter(f=>/^image\//.test(f.type));if(!files.length)return;const msg=t=>{if($('ocrStatus'))$('ocrStatus').textContent=t};for(const f of files){const r={file:f.name||'截图',status:'排队中'};results.push(r);renderResults();try{const img=await bitmap(f);if(isCard(img)){delete r.status;Object.assign(r,await recognizeCard(f,msg))}else{Object.assign(r,await recognize(f,msg),{status:''});r.target=suggest(r)}}catch(e){r.status='识别失败：'+e.message}renderResults()}msg(`识别完成，请核对后填入（标黄的项需要确认）`)}
function mount(){if($('ocrOpen'))return;const head=$('echoPanelHead');if(!head)return;const b=document.createElement('button');b.type='button';b.id='ocrOpen';b.className='primary';b.textContent='截图导入';head.appendChild(b);
  const p=document.createElement('div');p.id='ocrPanel';p.className='ocr-panel';p.hidden=true;p.innerHTML=`<div class="ocr-drop" id="ocrDrop" tabindex="0"><b>拖入、粘贴（Ctrl+V）或点击选择截图</b><span class="micro">支持两种：PC 端声骸详情截图（可多张），或机器人生成的角色面板长图（一张导入角色、武器和 5 只声骸）。识别在本地完成，图片不会上传。</span><input type="file" id="ocrFile" accept="image/*" multiple hidden></div><p class="micro" id="ocrStatus"></p><div id="ocrResults" class="ocr-results"></div><div class="hub-actions"><button type="button" class="primary" id="ocrFillAll" disabled>全部填入</button><button type="button" id="ocrClear">清空结果</button><button type="button" id="ocrClose">收起</button></div>`;head.insertAdjacentElement('afterend',p);
  b.onclick=()=>{p.hidden=!p.hidden;if(!p.hidden)$('ocrDrop').focus()};$('ocrClose').onclick=()=>{p.hidden=true};$('ocrClear').onclick=()=>{results.length=0;renderResults();$('ocrStatus').textContent=''};
  const drop=$('ocrDrop');drop.onclick=()=>$('ocrFile').click();$('ocrFile').onchange=e=>{handle(e.target.files);e.target.value=''};drop.ondragover=e=>{e.preventDefault();drop.classList.add('over')};drop.ondragleave=()=>drop.classList.remove('over');drop.ondrop=e=>{e.preventDefault();drop.classList.remove('over');handle(e.dataTransfer.files)};
  document.addEventListener('paste',e=>{if(p.hidden)return;const f=[...e.clipboardData?.files||[]];if(f.length){e.preventDefault();handle(f)}});
  $('ocrResults').addEventListener('change',e=>{const k=e.target.dataset.k;if(k!=null){results[k].target=+e.target.value;results[k].done=false;renderResults()}});
  $('ocrResults').addEventListener('click',async e=>{const k=e.target.dataset.fill;if(k!=null){await fill(results[k]);renderResults()}});
  $('ocrFillAll').onclick=async()=>{for(const r of results)if(!r.status&&!r.done)await fill(r);renderResults()}}
window.WuwaOCR={parse,recognize,recognizeCard,results};
if(typeof document!=='undefined'&&document.addEventListener){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount()}
})();
