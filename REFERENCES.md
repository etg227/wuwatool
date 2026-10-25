# References and Methodology

Reference snapshot: **2026-09-25**. Intended for Wuthering Waves **v3.6** theorycrafting. The tool is deployed standalone at [wuwatool.etg227.com](https://wuwatool.etg227.com/); the companion blog lives at [blog.etg227.com](https://blog.etg227.com/).

This project is an **unofficial fan-made theory tool**. It distinguishes community-tested formulas from official in-game descriptions. Kuro Games does not publish one complete player-facing formula reference covering every character-specific mechanic.

## 1. Damage formula / multiplier structure

### Wuthering Tools — Info
https://www.wutheringtools.com/info

Used to cross-check the commonly implemented community structure:

```text
scaling stat × motion value × amplify × damage bonus × crit × defense × resistance
```

and the basic attribute relationship:

```text
base stat × (1 + percent bonuses) + flat bonuses
```

### 鳴潮 Wiki* — ダメージ計算式
https://wikiwiki.jp/w-w/%E3%83%80%E3%83%A1%E3%83%BC%E3%82%B8%E8%A8%88%E7%AE%97%E5%BC%8F

Used to cross-check:

- ATK / multiplier structure.
- Damage Bonus and Amplify-like categories.
- Expected Crit relationship.
- Defense and resistance descriptions.

### WuwaEchoTool — primary upstream (GQin404)

https://github.com/GQin404/WuwaEchoTool

Open-sourced and no longer maintained; the author has publicly stated the project data may be reused. This project takes from it, with attribution:

- the static substat coefficient scheme (section 7; the graduation thresholds and letter grades are this site's own);
- `type_weights` damage compositions for characters up to 陆·赫斯, and the per-chain `mzProperty` composition tables (section 8);
- the Echo catalogue in `data/echoes.json` (names, COST and Kuro BBS image URLs from its `costList`);
- the gacha-record request format used by `worker/gacha-proxy.js` (fields `playerId / serverId / recordId / cardPoolId / cardPoolType / languageCode`, CN and global endpoints);
- the Sonata set icons in `icons/sonata/` (copied from its `image/attribute/` folder, matched by its `suiteAttributeMap`; the artwork itself is Kuro Games' in-game iconography).

Characters whose `source_kind` names WuwaEchoTool carry this repository URL in their `sources` field inside the mechanics data files.

### Open-source implementation cross-checks

- https://github.com/chuan-hane/wuwa-damage-calculator
- https://github.com/devyur/Wuwa-rotation-calculator
- https://github.com/k4wai1/un-waves-optimizer

These are implementation references, not official Kuro Games specifications.

### Game data tables (Arikatsu/WutheringWaves_Data)

https://github.com/Arikatsu/WutheringWaves_Data (branch `3.7`, global client 3.7.0)

Source of each Echo's possible Sonata sets in `data/echoes.json`: `BinData/phantom/phantomitem.json` (`FetterGroup`) joined with `phantomfettergroup.json` and the zh-Hans `multi_text` text map, including the 异相 variants (whose set lists can differ from the base Echo).

### Screenshot recognition (Tesseract.js)

`ocr.js` runs [Tesseract.js](https://github.com/naptha/tesseract.js) 5.1.1 (Apache-2.0) with the `chi_sim` 4.0.0_best_int model from [tessdata](https://github.com/tesseract-ocr/tessdata_best) (Apache-2.0), self-hosted under `vendor/tesseract/` with their licence files. OCR text is only a hint: stat names are matched to the fixed label list, values are snapped to legal roll tiers, Echo names to `data/echoes.json` and set names to the Sonata database; low-confidence fields are highlighted for the user to confirm.

## 2. Character catalogue data

### 库街区《鸣潮》WIKI
https://wiki.kurobbs.com/mc/home

The repository keeps a periodically refreshed local snapshot of the public Resonator catalogue for character names and portrait images (no player account login required). This repository's `data/` directory is the master copy; the character catalogue snapshot refreshes weekly via the `update-characters` CI job.

## 3. Echo substat ranges

### Prydwen — Echoes Stats
https://www.prydwen.gg/wuthering-waves/guides/echo-stats

Used to cross-check Rank 5 Echo substat ranges, including examples such as:

- Crit Rate: 6.3% – 10.5%
- Crit DMG: 12.6% – 21.0%
- ATK% / HP%: 6.4% – 11.6%
- DEF%: 8.1% – 14.7%
- Flat ATK: 30 – 60
- Flat HP: 320 – 580
- Flat DEF: 40 – 70

Substat values in the UI are hard-locked to the real in-game roll tiers (dropdowns), so impossible values cannot be entered. Duplicate substat types on one Echo are rejected, matching the in-game rule.

### 鳴潮 Wiki* — 音骸/厳選と確率
https://wikiwiki.jp/w-w/%E9%9F%B3%E9%AA%B8/%E5%8E%B3%E9%81%B8%E3%81%A8%E7%A2%BA%E7%8E%87

Used to cross-check discrete Echo substat tiers presented by that community wiki.

## 4. Crit expectation

The UI displays Crit DMG including the normal 100% hit. Expected critical multiplier is modeled as:

```text
E[Crit] = 1 + CR × (CD - 1)
```

where CR and CD are decimals and CR is capped at 100% for expected damage.

This directly produces the marginal effect discussed in the tool: large self Crit-DMG buffs reduce the value of adding more Echo Crit DMG, while Crit Rate becomes more valuable until the cap.

## 5. Single-character damage weighting

The current version deliberately removes team Buff windows. A character is represented by:

- Main scaling stat: ATK / HP / DEF.
- Current static panel.
- Combat-only self buffs / Resonance Chain corrections.
- Main damage type.
- Share of total damage belonging to that type.

For the selected main type with share `q`:

```text
TotalFactor = q × MainTypeFactor + (1 - q) × OtherDamageFactor
```

This lets type-specific Echo substats receive partial value without requiring the player to model a full rotation.

## 6. Echo replacement model

The user-entered current panel is assumed to contain all five currently equipped Echoes.

For replacement slot `n`:

```text
CandidatePanel = CurrentPanel - OldEcho[n] + CandidateEcho
ReplacementGain = CandidateFactor / CurrentFactor - 1
```

Both main stats and substats can therefore affect replacement gain.

## 7. Individual Echo score and build graduation (static)

Since 2026-09-17 the per-Echo score is a **static, character-scoped score** adapted from the open-source [WuwaEchoTool](https://github.com/GQin404/WuwaEchoTool) coefficient scheme. It replaced the earlier marginal-equivalent-roll formula.

Each substat type has a character- and chain-dependent coefficient. Since 2026-10-25 the coefficients are **derived** (`coefFor` in `app.js`) as partial derivatives of the damage formula at a fixed graduated reference panel, normalised so that 1% of the scaler stat = 1 (the same approach WuwaEchoTool adopted for its newer characters; for 锁暝 S0/S2 the crit coefficients match its published 1.844/0.820 and 1.993/0.725):

```text
Reference: scaler stat = base × 2.5 (ATK 1000→2500, HP 16000→40000, DEF 1100→2750),
           total DMG bonus +100%, in-combat Crit Rate 80% / Crit DMG 280%
Chain effects at the selected chain are added (Crit DMG, DMG bonus, Amplify); Crit Rate is not,
because players re-balance echoes to roughly 80% in-combat crit regardless of chain crit.

Crit Rate  = (CD − 1) / critFactor          Crit DMG = CR / critFactor
type DMG   = actual damage share of that type / (1 + that type's total DMG bonus)
element    = Σ share / (1 + that type's total DMG bonus)   (main stat only)
flat stat  = 100 / base · Energy Regen 0.5 (no damage contribution; fixed) · off-scaler 0
```

For split-convention characters, DMG-bonus and Amplify chain effects reshape the actual damage shares; legacy WuwaEchoTool compositions are already fully folded and are used as-is.

Amplify (加深) is its own multiplier zone in both the static derivation and the panel-based model: per damage type the factor is `(1 + DMG bonus + type bonus) × (1 + global Amplify + type Amplify)`. Effects described in game as 加深 are stored as `basicAmp / heavyAmp / skillAmp / liberationAmp / globalAmp` (2026-10-25 migration: 锁暝 S3, 景燃 S6, 清宵 S6, 秧秧·玄翎 S3/S6, 洛瑟菈 S2, 西格莉卡 S6, 心's signature weapon).

LineScore   = value × coefficient
EchoScore   = Σ LineScore / (theoretical best 5 distinct max-roll lines) × 100
BuildScore  = Σ(main + fixed main + substats) / theoretical full loadout × 100
```

Graduation tiers on BuildScore (this site's thresholds, inclusive): `≥90 大毕业 SSS · ≥80 中毕业 SS · ≥70 小毕业 S · ≥60 接近毕业 A · ≥50 B · ≥40 C · else 咸鱼一条 D`. Single-Echo letter grades top out at S: `≥80 S · ≥65 A · ≥50 B · ≥35 C · else D`.

Properties and limits of this score — stated deliberately so players know what it can and cannot claim:

- `100` = five distinct best-effective substats all at max roll.
- The score depends only on the character (and its per-chain damage composition), **not** on the entered panel or the other four Echoes. Editing Echo B never changes Echo A's score.
- Because it ignores the live panel, **a high-scoring Echo is not automatically the better swap for the current build** (e.g. Crit Rate lines near the 100% cap). The replacement gain and the actionable-upgrade ranking are the panel-aware, fully recomputed numbers to use for that decision. The two systems intentionally coexist: static score = "how good is this Echo's substat budget for this character", marginal calculations = "what should I change next on this build".
- The letter grades (S for a single Echo, up to SSS for a full build) are a presentation layer for this site's own score, not an official game grade.

The actionable-upgrade ranking does **not** use ratio approximations: every candidate action (raise an existing line to max roll, or replace one existing line with an average roll of the target type) is evaluated by cloning the full 5-Echo loadout and recomputing the damage factor, so crit-cap clamping and conditional set thresholds (e.g. ER ≥ 250%) are honored per scenario.

## 8. Resonance Chain handling

The character-mechanics dataset now carries, per character:

- `chains[].effects`: combat-only stat buffs per chain level (ATK%, Crit, type/element damage bonus, Amplify), applied automatically when the chain level is selected. Permanent panel-visible chain stats are marked `apply: "panel"` and excluded, since they are already inside the user-entered panel.
- `chain_type_weights`: per-chain damage-composition tables ("1"–"6"), used when a chain changes motion multipliers, adds new tagged damage or converts tags. Legacy characters reuse WuwaEchoTool's `mzProperty` tables; post-陆·赫斯 characters were derived from 2026-09 community guides with per-character sources recorded in the data.
- Chain buffs that only raise crit damage of a single skill cannot be honestly encoded as flat type-damage bonuses; they are kept as text notes and (approximately) reflected via the composition tables instead.

**Two encoding conventions coexist inside `chain_type_weights`**, distinguishable by each character's `source_kind`:

1. Legacy characters imported from WuwaEchoTool's `mzProperty` use a *fully folded* convention: the outcome of every chain effect — motion-multiplier increases, damage-bonus/amplify buffs, crit buffs — is baked into the per-chain composition tables, because those tables were measured inside that author's complete damage calculator. This is why some legacy characters' dominant-tag share rises (or even flips entirely) at high chains.
2. Characters researched in 2026-09 use a *split* convention: only motion-multiplier increases, newly added tagged damage and tag conversions shift the composition tables; flat damage-bonus/amplify chain buffs live in `chains[].effects`, and skill-specific crit buffs remain text notes. A chain that strengthens the dominant tag via a damage-bonus therefore leaves the composition table unchanged here, while one that strengthens a secondary tag's multiplier dilutes the dominant share.

The calculator consumes both representations (weights through the type mix, effects through the bonus bucket), so substat valuations stay consistent either way. But the *magnitude and direction* of composition shift across the two groups is not directly comparable: a legacy character whose dominant share climbs at S6 and a researched character whose share stays flat may reflect the same kind of chain, encoded differently.

A constant multiplier affecting Current and Candidate identically still cancels out of the replacement ratio.

## 9. Product / UX reference

### wuwacalc.cn — 南边道友TEIO
https://wuwacalc.cn

Bilibili introduction:
https://www.bilibili.com/video/BV1qTuh63E4c/

Used only as a product / interaction reference for making theorycrafting easier to enter and read in a browser. This project does not treat it as the sole damage-formula source and does not copy its UI, assets or private data.
