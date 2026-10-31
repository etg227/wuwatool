# 生成 data/base-stats.json：在 Arikatsu/WutheringWaves_Data 的版本分支根目录运行
# 先用 MultiText.json 抽出名称表 mt-zh.json（RoleInfo_*_Name / WeaponConf_*_WeaponName / WeaponConf_*_Desc）放在上一级目录
# 用法：python3 build-base-stats.py <输出路径>
import json,sys,re
B='BinData/'
mt=json.load(open('../mt-zh.json'))
bp={}
for x in json.load(open(B+'property/baseproperty.json')):
    if x.get('Lv')==1: bp.setdefault(x['Id'],x)
g=[x for x in json.load(open(B+'property/rolepropertygrowth.json')) if x['Level']==90 and x['BreachLevel']==6][0]
wg={x['CurveId']:x['CurveValue'] for x in json.load(open(B+'property/weaponpropertygrowth.json')) if x['Level']==90 and x['BreachLevel']==6}
st=json.load(open(B+'skillTree/skilltree.json'))
# property id -> our stat keys
PK={2:'flatHp',3:'flatHp',7:'flatAtk',8:'critRate',9:'critDmg',10:'flatDef',11:'energyRegen',14:'skillDmg',17:'basicDmg',18:'heavyDmg',19:'liberationDmg',21:'elementDmg',22:'elementDmg',23:'elementDmg',24:'elementDmg',25:'elementDmg',26:'elementDmg',27:'elementDmg',35:'healing',10002:'hpPct',10007:'atkPct',10010:'defPct'}
def val(p):  # -> percent points or flat
    k=p['Id']
    if p.get('IsRatio') or k>10000: return p['Value']*100 if p['Value']<5 else p['Value']/100
    if k in (2,3,7,10): return p['Value']
    return p['Value']/100
chars={}
for r in json.load(open(B+'role/roleinfo.json')):
    if r['RoleType']!=1 or r.get('IsTrial') or r['PropertyId'] not in bp: continue
    name=mt.get(r['Name']); b=bp[r['PropertyId']]
    if not name or name in chars and r['Id']>=10000: continue
    forte={}
    for n in st:
        if n['NodeGroup']==r['SkillTreeGroupId'] and n['NodeType']==4:
            for p in n['Property']:
                k=PK.get(p['Id'],str(p['Id'])); forte[k]=round(forte.get(k,0)+val(p),2)
    chars.setdefault(name,{'id':r['Id'],'weaponType':r['WeaponType'],'hp':round(b['LifeMax']*g['LifeMaxRatio']/1e4),'atk':round(b['Atk']*g['AtkRatio']/1e4),'def':round(b['Def']*g['DefRatio']/1e4),'forte':forte})
weapons={}
for w in json.load(open(B+'weapon/weaponconf.json')):
    name=mt.get(w['WeaponName'])
    if not name or not w.get('FirstPropId') or w['QualityId']<3: continue
    f,s=w['FirstPropId'],w['SecondPropId']
    sv=s['Value']*wg[w['SecondCurve']]/1e4
    sk=PK.get(s['Id'],str(s['Id']))
    d=mt.get(w['Desc'],'');m=re.match(r'^(暴击伤害|暴击|攻击|生命|防御|共鸣效率)提升\{0\}',d);pas=None
    if m and w.get('DescParams'):
        pas={'kind':{'暴击伤害':'critDmg','暴击':'critRate','攻击':'atkPct','生命':'hpPct','防御':'defPct','共鸣效率':'energyRegen'}[m.group(1)],'ranks':[float(x.rstrip('%')) for x in w['DescParams'][0]['ArrayString']]}
    weapons[name]={'type':w['WeaponType'],'q':w['QualityId'],'atk':round(f['Value']*wg[w['FirstCurve']]/1e4),'sub':sk,'subVal':round(sv if s['Id'] in (2,3,7,10) else sv/100 if not s.get('IsRatio') else sv*100,2),**({'passive':pas} if pas else {})}
json.dump({'source':'Arikatsu/WutheringWaves_Data 3.7（游戏解包数据，满级 90 / 突破 6）','characters':chars,'weapons':weapons},open(sys.argv[1],'w'),ensure_ascii=False,separators=(',',':'))
print(len(chars),len(weapons)); print(chars.get('清宵'),chars.get('锁暝')); print(weapons.get('云琅'), list(weapons.items())[:3])
