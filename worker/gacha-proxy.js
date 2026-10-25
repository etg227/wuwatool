// wuwatool 抽卡记录代理：只把唤取记录查询转发给库洛官方接口，不记录、不存储任何内容。
const UPSTREAM={cn:'https://gmserver-api.aki-game2.com/gacha/record/query',global:'https://gmserver-api.aki-game2.net/gacha/record/query'};
const ALLOWED_ORIGINS=['https://wuwatool.etg227.com','http://localhost:8000','http://127.0.0.1:8000'];
const LANGS=['zh-Hans','zh-Hant','en','ja','ko','fr','de','es'];

function cors(origin){return{'Access-Control-Allow-Origin':ALLOWED_ORIGINS.includes(origin)?origin:ALLOWED_ORIGINS[0],'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400','Vary':'Origin'}}
function reply(body,status,origin){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...cors(origin)}})}
function valid(b){return b&&['cn','global'].includes(b.region)&&/^\d{5,12}$/.test(b.playerId)&&/^[A-Za-z0-9_-]{1,128}$/.test(b.serverId)&&/^[\w-]{8,256}$/.test(b.recordId)&&/^[\w-]{1,128}$/.test(b.cardPoolId)&&Number.isInteger(b.cardPoolType)&&b.cardPoolType>=1&&b.cardPoolType<=20&&LANGS.includes(b.languageCode)}

export default{async fetch(request){
  const origin=request.headers.get('Origin')||'';
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
  if(request.method!=='POST')return reply({code:-1,message:'只支持 POST'},405,origin);
  if(!ALLOWED_ORIGINS.includes(origin))return reply({code:-1,message:'来源不允许'},403,origin);
  let b;try{b=await request.json()}catch{return reply({code:-1,message:'请求格式错误'},400,origin)}
  if(!valid(b))return reply({code:-1,message:'参数不合法'},400,origin);
  const {region,...query}=b;
  let r;try{r=await fetch(UPSTREAM[region],{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({playerId:query.playerId,serverId:query.serverId,languageCode:query.languageCode,recordId:query.recordId,cardPoolId:query.cardPoolId,cardPoolType:query.cardPoolType})})}catch{return reply({code:-1,message:'无法连接游戏服务器'},502,origin)}
  const d=await r.json().catch(()=>null);
  if(!d||d.code!==0||!Array.isArray(d.data))return reply({code:-1,message:d?.message||'游戏服务器返回异常，链接可能已过期，请重新打开唤取记录页面后再复制'},502,origin);
  return reply({code:0,data:d.data.map(x=>({name:String(x.name||''),qualityLevel:Number(x.qualityLevel)||3,resourceType:String(x.resourceType||''),time:String(x.time||'')}))},200,origin);
}};
