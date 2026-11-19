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
  const ly = await p.evaluate(() => { const d = WuwaCore._debug; return { er: d.model().energyRegen, cr: d.model().critRate, cr2: d.model([{ type: 'energyRegen', value: 12.4 }]).critRate, hint: document.getElementById('erTarget').textContent } });
  check('莉莉效率提高 → 暴击提高', ly.er < 260 && ly.cr2 > ly.cr, ly); check('莉莉显示效率达标提示', /260/.test(ly.hint), ly.hint);

  check('页面无脚本错误', !errors.length, errors);
  await browser.close(); server.close();
  if (fails.length) { console.error(`\n${fails.length} 项失败`); process.exit(1) } console.log('\n全部通过');
})().catch(e => { console.error(e); process.exit(1) });
