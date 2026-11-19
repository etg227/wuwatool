// 数值与存档回归测试：用真实页面跑，断言具体输入的具体结果。
// 运行：node tests/regression.cjs（需要 playwright 与 chromium；CI 中自动安装）
const path = require('path'), http = require('http'), fs = require('fs');
let pw; try { pw = require('playwright') } catch { pw = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright')) }
const ROOT = path.join(__dirname, '..'), TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp' };
const S = (type, value) => ({ type, value });
const fails = []; const check = (name, cond, info) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}${info !== undefined ? ' · ' + JSON.stringify(info) : ''}`); if (!cond) fails.push(name) };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const server = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end() } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res) });

const profile = (name, echoes, extra = {}) => ({ version: 7, characterName: name, chainLevel: 0, scaler: 'atk', gear: { weaponMode: 'signature', sonataMain: '', sonataPieces: 'none', sonataSecondary: '', ...(extra.gear || {}) }, stats: extra.stats || {}, echoes, savedAt: '2026-11-19T00:00:00Z' });
const SET = '衔梦照世之心';
const good = [S('critRate', 9.3), S('critDmg', 18.6), S('atkPct', 10.1), S('basicDmg', 10.1), S('flatHp', 470)];
const five = (set, subs = good) => [[4, 'critRate'], [3, 'elementDmg'], [3, 'elementDmg'], [1, 'atkPct'], [1, 'atkPct']].map(([cost, mainType]) => ({ cost, mainType, set, sub: subs }));

(async () => {
  await new Promise(r => server.listen(0, r)); const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await pw.chromium.launch(); const errors = [];
  const open = async (store, extraKeys = {}) => { const ctx = await browser.newContext(); await ctx.route(/kurobbs\.com/, r => r.abort()); const p = await ctx.newPage(); p.on('pageerror', e => errors.push(e.message));
    await p.goto(base + '#/calc'); await p.evaluate(([s, k]) => { localStorage.clear(); if (s) localStorage.wuwaEchoBuildProfilesV6 = JSON.stringify(s); for (const [a, b] of Object.entries(k)) localStorage[a] = JSON.stringify(b) }, [store, extraKeys]);
    await p.reload(); await p.evaluate(() => WuwaCore.ready); return p };
  const load = async (p, name) => { await p.evaluate(n => WuwaProfiles.open(n), name); await p.waitForTimeout(400) };

  // 1. 单只评分锚点
  let p = await open(null);
  const sc = await p.evaluate(() => { const S = (t, v) => ({ type: t, value: v }), C = WuwaCore; return { perfect: C.scoreEcho('锁暝', 0, 'atk', { sub: [S('critRate', 10.5), S('critDmg', 21), S('atkPct', 11.6), S('basicDmg', 11.6), S('energyRegen', 12.4)] }), grad: C.scoreEcho('锁暝', 0, 'atk', { sub: [S('critRate', 9.3), S('critDmg', 18.6), S('atkPct', 10.1), S('basicDmg', 10.1), S('flatHp', 470)] }) } });
  check('完美声骸 = 100', near(sc.perfect, 100, .05), sc.perfect); check('毕业级声骸约 69（A）', near(sc.grad, 69, 1), sc.grad);

  // 2. 自动面板与换装模型同一口径（锁暝 + 精1 沉冥，+11.6% 攻击 ≈ (462+588)×11.6%）
  p = await open({ 锁暝: profile('锁暝', five(SET)) }); await load(p, '锁暝');
  const m = await p.evaluate(() => { const d = WuwaCore._debug; return { panel: +document.getElementById('totalAtk').value, now: d.model().atk, plus: d.model([{ type: 'atkPct', value: 11.6 }]).atk, weapon: document.getElementById('panelWeapon').value } });
  check('换装模型攻击 = 自动面板攻击', near(m.now, m.panel, 1.5), m); check('+11.6% 攻击的增量 = 基础攻击 × 11.6%', near(m.plus - m.now, (462 + 588) * .116, 1.5), m.plus - m.now);

  // 3. 按声骸统计套装：换进异套声骸会掉五件套
  const pc = await p.evaluate(s => { const d = WuwaCore._debug, es = JSON.parse(JSON.stringify(window.WuwaProfiles.get('锁暝').echoes)); const swap = JSON.parse(JSON.stringify(es)); swap[1].set = '彻空冥雷'; return { now: d.pieces(es), swap: d.pieces(swap) } }, SET);
  check('五只同套 = 2 件 + 5 件', pc.now.includes(SET + ':2') && pc.now.includes(SET + ':5'), pc.now); check('换进一只异套后只剩 2 件', pc.swap.includes(SET + ':2') && !pc.swap.includes(SET + ':5'), pc.swap);

  // 4. 无惧浪涛之勇：面板 240% 不触发 250% 条件，255% 触发
  const tide = '无惧浪涛之勇';
  p = await open({ 锁暝: profile('锁暝', five(tide), { gear: { autoPanel: false }, stats: { totalAtk: 2400, totalHp: 13000, totalDef: 1100, critRate: 70, critDmg: 250, energyRegen: 240 } }) }); await load(p, '锁暝');
  const el = async er => p.evaluate(v => { const i = document.getElementById('energyRegen'); i.value = String(v); i.dispatchEvent(new Event('input', { bubbles: true })); return WuwaCore._debug.model().elementDmg }, er);
  const e240 = await el(240), e255 = await el(255); check('效率 240% 不触发 +30% 属伤', near(e255 - e240, 30, .01), { e240, e255 });

  // 5. 没录齐 5 只不给毕业评级
  p = await open({ 锁暝: profile('锁暝', five(SET).map((e, i) => i < 3 ? e : { ...e, sub: [] })) }); await load(p, '锁暝');
  const tier = await p.evaluate(() => document.getElementById('buildTier').textContent); check('3/5 时显示「录齐后评定」', /3\/5/.test(tier) && /录齐后评定/.test(tier) && !/[大中小]毕业|完美毕业|接近毕业/.test(tier), tier);

  // 6. 删光角色后不会从旧版存档复活
  p = await open(null, { wuwaEchoBuildProfilesV5: { 锁暝: profile('锁暝', five(SET)) } });
  const before = await p.evaluate(() => Object.keys(WuwaProfiles.all())); await p.evaluate(() => WuwaProfiles.remove('锁暝')); await p.reload(); await p.evaluate(() => WuwaCore.ready);
  const after = await p.evaluate(() => Object.keys(WuwaProfiles.all())); check('旧档迁移后删除不复活', before.length === 1 && after.length === 0, { before, after });

  // 7. OCR：80.1% 暴击不能当成满档静默写入
  const o = await p.evaluate(() => { const C = WuwaCore; const r = WuwaOCR.parse('无常凶鹭\nCOST 4\n暴击 22.0%\n攻击 150\n暴击 80.1%\n暴击伤害 21.0%\n攻击 11.6%\n普攻伤害加成 10.1%\n共鸣效率 9.2%', { rolls: C.ROLLS, mainValue: C.MAIN_VALUE, echoes: C.echoes(), setNames: C.sets().map(s => s.name) }); return r.sub.find(x => x.type === 'critRate') });
  check('80.1% 暴击标为待核对', o && o.ok === false, o);

  // 8. 莉莉：效率进入换装模型，未达 260% 前提高效率会提高暴击
  p = await open({ 莉莉: profile('莉莉', five('茜染怀想之花', [S('energyRegen', 10), S('hpPct', 8.6), S('critRate', 6.3)])) }); await load(p, '莉莉');
  const ly = await p.evaluate(() => { const d = WuwaCore._debug; return { er: d.model().energyRegen, f: d.factor(), f2: d.factor([{ type: 'energyRegen', value: 12.4 }]), hint: document.getElementById('erTarget').textContent, recs: document.getElementById('standardBars').textContent } });
  check('莉莉效率提高 → 伤害因子提高', ly.er < 260 && ly.f2 > ly.f, ly); check('莉莉的提升建议包含共鸣效率', /共鸣效率/.test(ly.recs), ly.recs.slice(0, 200)); check('莉莉显示效率达标提示', /260/.test(ly.hint), ly.hint);

  // 9. 旧存档（手选五件套、声骸未标注套装）：候选选异套会掉五件套；只给一只补标签时其余四只仍按手选推定
  const legacy = five('').map(e => ({ ...e, set: '' }));
  p = await open({ 锁暝: profile('锁暝', legacy, { gear: { sonataMain: SET, sonataPieces: '5' } }) }); await load(p, '锁暝');
  const lg = await p.evaluate(s => { const d = WuwaCore._debug, es = WuwaProfiles.get('锁暝').echoes.map(e => ({ ...e, set: '' })); const swap = JSON.parse(JSON.stringify(es)); swap[0].set = '彻空冥雷'; const one = JSON.parse(JSON.stringify(es)); one[2].set = s; return { now: d.pieces(es), swap: d.pieces(swap), one: d.pieces(one) } }, SET);
  check('旧档手选五件套 = 2 + 5 件', lg.now.includes(SET + ':5'), lg.now); check('旧档换进异套声骸会掉五件套', !lg.swap.includes(SET + ':5') && lg.swap.includes(SET + ':2'), lg.swap); check('补标一只后仍是五件套', lg.one.includes(SET + ':5'), lg.one);

  // 10. 低分区仍有区分度；三只满分 + 两只极差不能算大毕业；主词条为空不算录入
  const lo = await p.evaluate(() => { const S = (t, v) => ({ type: t, value: v }), C = WuwaCore, a = C.scoreEcho('锁暝', 0, 'atk', { sub: [S('critRate', 6.3), S('critDmg', 12.6), S('hpPct', 6.4), S('defPct', 8.1), S('flatDef', 40)] }), b = C.scoreEcho('锁暝', 0, 'atk', { sub: [S('hpPct', 6.4), S('defPct', 8.1), S('flatDef', 40), S('flatHp', 320), S('energyRegen', 6.8)] });
    const P = [S('critRate', 10.5), S('critDmg', 21), S('atkPct', 11.6), S('basicDmg', 11.6), S('energyRegen', 12.4)], J = [S('hpPct', 6.4), S('defPct', 8.1), S('flatDef', 40), S('flatHp', 320), S('energyRegen', 6.8)];
    const es = [[4, 'critRate', P], [3, 'elementDmg', P], [3, 'elementDmg', P], [1, 'atkPct', J], [1, 'atkPct', J]].map(([cost, mainType, sub]) => ({ cost, mainType, sub })), bs = C.buildScore('锁暝', 0, 'atk', es), fl = C.buildFloor('锁暝', 0, 'atk', es);
    return { a, b, bs, tier: C.byzt(bs, fl), cap100: C.byzt(100, 0), cap100Ok: C.byzt(100, 50), entered: C.entered([{ cost: 4, mainType: '', sub: [S('critRate', 6.3)] }]) } });
  check('双暴低档 + 3 废 高于 5 条全废', lo.a > lo.b, lo); check('三只满分 + 两只全废不是大毕业', lo.tier !== '大毕业' && lo.tier !== '完美毕业', lo); check('平均 100% 但最差一只 0 分不算大毕业', lo.cap100 !== '大毕业' && lo.cap100Ok === '大毕业', lo); check('主词条为空不算录入', lo.entered === 0, lo);

  // 11. 主词条选错不能加分（负分时同样单调）
  const mm = await p.evaluate(() => { const S = (t, v) => ({ type: t, value: v }), C = WuwaCore, L = [S('critRate', 6.3), S('critDmg', 12.6), S('hpPct', 6.4), S('defPct', 8.1), S('flatDef', 40)];
    const es = m4 => [[4, m4], [3, 'elementDmg'], [3, 'elementDmg'], [1, 'atkPct'], [1, 'atkPct']].map(([cost, mainType]) => ({ cost, mainType, sub: L })); return { right: C.buildScore('锁暝', 0, 'atk', es('critRate')), wrong: C.buildScore('锁暝', 0, 'atk', es('hpPct')) } });
  check('4C 主词条从暴击改成生命% 不会加分', mm.wrong < mm.right, mm);

  // 12. 长图没认出角色时，「全部填入」不能写进当前角色
  const before0 = await p.evaluate(() => [...document.querySelectorAll('.echo-card[data-echo="0"] .sub-rows .echo-type')].map(x => x.value).join(','));
  await p.evaluate(() => { WuwaOCR.results.push({ card: true, file: 't.png', character: '', weapon: '', rank: 1, panel: {}, set: '', warnings: ['没有识别到角色名'], echoes: [{ cost: 4, name: '', mainType: 'critRate', mainOk: true, sub: [{ type: 'hpPct', value: 6.4, ok: true }], warnings: [] }] }); document.getElementById('ocrFillAll').disabled = false; document.getElementById('ocrFillAll').click() });
  await p.waitForTimeout(400); const after0 = await p.evaluate(() => [...document.querySelectorAll('.echo-card[data-echo="0"] .sub-rows .echo-type')].map(x => x.value).join(','));
  check('未识别角色的长图不会覆盖当前角色', before0 === after0, { before0, after0 });

  // 13. 旧档 3+2：按声骸名称推定，换掉彻空冥雷的紫羽鹭应保留失序三件套、掉彻空两件；候选「无套装」不继承原套装
  const A = '失序彼岸之梦', B = '彻空冥雷', S5 = [S('critRate', 8.1), S('critDmg', 16.2)];
  const old32 = [[4, '梦魇·赫卡忒'], [3, '紫羽鹭'], [3, '浮灵偶'], [1, '幽翎火'], [1, '惊蛰猎手']].map(([cost, echoId]) => ({ cost, echoId, set: '', mainType: cost === 4 ? 'critRate' : cost === 3 ? 'elementDmg' : 'atkPct', sub: S5 }));
  p = await open({ 锁暝: profile('锁暝', old32, { gear: { sonataMain: A, sonataPieces: '3', sonataSecondary: B } }) }); await load(p, '锁暝');
  const t32 = await p.evaluate(([A, B]) => { const d = WuwaCore._debug, es = WuwaProfiles.get('锁暝').echoes.map(e => ({ ...e, set: '' })), sw = (k, set) => { const n = JSON.parse(JSON.stringify(es)); n[k] = { ...n[k], echoId: '', set }; return n };
    return { now: d.pieces(es), swapOther: d.pieces(sw(1, '凝夜白霜')), swapNone: d.pieces(sw(1, '-')) } }, [A, B]);
  check('旧档 3+2 推定正确', t32.now.includes(A + ':3') && t32.now.includes(B + ':2'), t32.now);
  check('换掉紫羽鹭（彻空）保留失序三件套、掉彻空两件', t32.swapOther.includes(A + ':3') && !t32.swapOther.includes(B + ':2'), t32.swapOther);
  check('候选「无套装」不继承原套装', t32.swapNone.includes(A + ':3') && !t32.swapNone.includes(B + ':2'), t32.swapNone);

  check('页面无脚本错误', !errors.length, errors);
  await browser.close(); server.close();
  if (fails.length) { console.error(`\n${fails.length} 项失败`); process.exit(1) } console.log('\n全部通过');
})().catch(e => { console.error(e); process.exit(1) });
