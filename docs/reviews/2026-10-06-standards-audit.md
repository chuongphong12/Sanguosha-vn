# Standards, catalogue and general-skill audit

Audit date: 2026-10-06. Source pinned to `101c730642cea7b086c60075f234b18f25b34a97` in `C:/Users/Tran.Trong.Nhan/.codex/worktrees/standard-rules-audit/tqs-boardgame`. Engine source was not changed. Rules provenance and edition limitations are recorded in [primary-source research](2026-10-06-rules-primary-sources.md).

## Scope and evidence limits

Reviewed all 27 advertised generals / 43 skill names for implementation presence and named behavioural tests. Inspected catalogue, public engine entry points, skill registry, relevant tests, state types, and player-view filtering. Executed eight targeted probes through the existing public `cardEngine` seam; all eight independently exposed discrepancies. A named test or indexed symbol is not proof of every branch or interaction.

CodeGraph's current worktree graph resolved `yiJiSkill` to its registered handler and `canSelectCardTarget` to live core implementation / MainScreen callers. GitNexus queries resolved the earlier primary-workspace index but explicitly warned it was **32 commits stale** relative to this pinned worktree; its results are discovery aids, not a clean architectural certification. Worktree GitNexus rebuild was pending when this report was prepared. No commit or push was performed.

## Standards findings (separate from rule compliance)

No hard violation of the supplied coding standards is inferred from historical workflow: the tree alone cannot prove whether previous authors ran impact analysis, obtained design approval, or wrote tests first. Formatting/lint findings are omitted because tooling enforces them.

1. **Possible Duplicated Code, medium maintenance risk:** `src/game/engine/core/index.ts:680` and `src/game/engine/validators/index.ts:203` both implement `canSelectCardTarget`; their Qian Xun rules already differ (`core:731` checks Snatch/Indulgence; `validators:250` checks Snatch/Dismantle). `matchesResponse` is also duplicated, with old validators restricting Qing Guo to equipment (`validators:300`) while live core supports black handcards. CodeGraph resolves current UI callers to core, and `src/game/cardEngine.ts:1` re-exports core. Therefore this is demonstrated drift and future maintenance risk, **not evidence that the stale validator is used in current gameplay**. Keep one maintained rule implementation; audit references before deleting the other.
2. **Possible Duplicated Code, low maintenance risk:** the `assignGeneral` fixture at `tests/skills/skill-conformance.test.ts:21` repeats the same general/active-skill assignment across batch and bugfix test files. A shared fixture can avoid inconsistent lord-skill assumptions. This is a judgment call, subordinate to Karpathy's surgical-change rule; do not combine it with an urgent engine patch.
3. **Possible Mysterious Name, low maintenance risk:** both `src/game/types/cards.ts:28` and `src/game/engine/SkillRegistry.ts:5` declare `SkillDefinition`, one for displayed metadata and one for executable handlers. Distinguish these names when modifying this boundary so catalogue completeness is not confused with handler registration.

`@ts-nocheck` in `damageSkills.ts:1` and `phaseSkills.ts:1`, plus `any` contexts in `SkillRegistry.ts:8`, materially limit what a successful typecheck proves. The supplied standards do not explicitly forbid these, so this is a verification limitation rather than an invented hard violation. They allow stage/payload mismatches to escape static checking; candidate validation must still occur at the public move boundary.

## Spec findings

| ID / priority | Finding and location | Evidence / missing test |
| --- | --- | --- |
| SK01 / P1 | Yi Ji does not validate selected recipient against living candidates. `damageSkills.ts:151-165` removes the owner's card then dereferences an arbitrary player ID. `core/index.ts:3647-3650` dispatches directly to the handler after structural answer checks. | Public `answerCardPrompt` with `playerIDs:["missing"]` throws `TypeError ... reading 'hand'` after mutation. Existing Yi Ji tests cover valid recipients only. Validate every candidate before mutation; invalid answers should return false and preserve state. |
| SK02 / P1 | Ren De lacks Standard 2013 once-per-Play-phase restriction. `core/index.ts:3509-3538` never marks the skill used. | Two valid one-card activations in the same Play phase both return true; expected second false. The publisher's [2013 release](https://www.prnasia.com/story/79788-1.shtml) specifies the restriction. `skill-batch5.test.ts:87` rejects only an empty second payload, which cannot demonstrate the cooldown. |
| SK03 / P1 | Ji Zhi uses classic optional draw-one instead of the advertised Standard 2013 reveal/obtain/basic-card discard-or-swap branch. `core/index.ts:1135-1146` queues optional-skill; `:3293-3298` draws one directly. Metadata `catalog/generals.ts:144-150` also describes the classic edition. | [Publisher 2013 release](https://www.prnasia.com/story/79788-1.shtml) explicitly defines the revised branches. `skill-conformance.test.ts:188` and `skill-batch7.test.ts:139` endorse classic draw behaviour; their passing status cannot certify 2013. Static finding, not one of the eight runtime probes. |
| SK04 / P1 | Qi Cai omits protection against other players discarding non-horse equipment. Present checks only waive trick distance (`core/index.ts:641`, `:739`). | Public Dismantle can discard Huang Yueying's equipped Bagua armor; expected rejection. [Publisher 2013 release](https://www.prnasia.com/story/79788-1.shtml). Existing `skill-batch1.test.ts:132` tests distance only. |
| SK05 / P1 | Qi Xi additionally converts black cards to Snatch, an unadvertised and incorrect extra power. `core/index.ts:240-245` offers Snatch; `:1100-1103` accepts either Dismantle or Snatch. | Classic standard Gan Ning converts to Dismantle ([Wu rules, 标](https://gltjk.com/sanguosha/rules/card/hero/wu.html)). `skill-batch2.test.ts:183` and `equipment-zone-skills.test.ts:90` explicitly assert the wrong Snatch effect, while `skill-bugfixes.test.ts:76` tests Dismantle without asserting Snatch is rejected. |
| SK06 / P1 | Tu Xi removes cards with direct hand splice (`phaseSkills.ts:80-87`), bypassing `removeHandCard` / LoseHandCard emission (`core/index.ts:298-310`). | Taking Lu Xun's only handcard through public Tu Xi moves produces no Lian Ying prompt. `skill-batch4.test.ts:39` checks ordinary theft and `:95` checks Lu Xun using his own last card; their combination is untested. |
| SK07 / P2 | Ke Ji checks only proactive `slashUses` (`core/index.ts:2008`), ignoring Slash played as a Duel response in the owner's Play phase. | Lu Meng uses Duel, responds with Slash, then receives Ke Ji's skip option despite having played Slash. Existing `skill-batch1.test.ts:78` only contrasts no Slash with proactive Slash. [Wu rules, 标](https://gltjk.com/sanguosha/rules/card/hero/wu.html). |
| SK08 / helper invariant | Invalid virtual Slash mutates the player's per-phase Slash count. `core/index.ts:1094` increments before target validation at `:1108`. | Direct helper invocation returns false but changes `slashUses` from 0 to 1. This proves a helper state-preservation defect; it does **not** prove ordinary authoritative gameplay spends the allowance: TqsGame returns INVALID_MOVE and boardgame.io rollback needs separate verification. Existing helper tests do not assert full state preservation for invalid targets. |
| SK09 / P2 | Ying Zi is compulsory: `core/index.ts:1988` draws three automatically instead of offering the optional extra draw. | Starting Zhou Yu's turn produces no activation/decline window. Existing `skill-batch1.test.ts:314` verifies only three cards. [Wu rules, 标](https://gltjk.com/sanguosha/rules/card/hero/wu.html). |
| SK10 / P2 | Tian Du is compulsory: `core/index.ts:1862-1872` automatically obtains judgement; analogous code at `:3848-3858` handles Bagua. | Guo Jia's delayed-trick judgement auto-enters hand with no option to decline. Existing `skill-batch1.test.ts:346` verifies only receipt. [Wei rules, 标](https://gltjk.com/sanguosha/rules/card/hero/wei.html). |
| SK11 / P2 | Displayed Guo Se and Qian Xun descriptions conflict with correct live engine rules. `catalog/generals.ts:206-226` says red cards → Supply Shortage and immunity to Snatch/Dismantle. | Live Guo Se requires diamond → Indulgence (`core:1097`); Qian Xun prohibits Snatch/Indulgence (`core:638`, `:646`). [Wu rules, 标](https://gltjk.com/sanguosha/rules/card/hero/wu.html). `skill-batch1.test.ts:195` has a misleading title but correctly allows Dismantle. Metadata Yi Ji (`generals:66`) says HP loss rather than damage; Yao Wu (`:288`) omits the Slash-only condition; Tong Ji (`:303`) omits the attacker's range condition. Correct the text and add catalogue contract checks. |

The classic-rule mirror has explicit provenance and version boundaries in the research report. Findings using its 标 entries should remain distinct from changes locked directly by the publisher's 2013 release. If the product intentionally supports another physical printing or house-rule edition, document that edition instead of claiming full 2013 conformance.

## Inventory: all 27 generals and 43 skills

`R` = registry handler present; `C` = core/passive rule present. Absence from the registry is not missing implementation: 33 skills are handled by core/passive logic. `B1`...`B9` = `tests/skills/skill-batchN.test.ts`; `CF` = skill-conformance; `BF` = skill-bugfixes; `BF5` = skill-bugfixes-5; `EZ` = tests/rules/equipment-zone-skills. Each row has named behavioural tests; **none is certified exhaustive**. A test name is stronger evidence than a bare skill string, but the assertions and edition still require review.

| General | All advertised skills / implementation | Named test evidence | Outstanding boundary / finding |
| --- | --- | --- | --- |
| Cao Cao | Jian Xiong R; Hu Jia C | B7:57, CF:299; B8:33,80 | Material provenance tested; nested judgement/response ordering not exhaustive. |
| Sima Yi | Fan Kui R; Gui Cai C | B3:31; B3:238, BF5:24 | Repeated/multiple-owner replacement and loss-trigger interruption not exhaustively established. |
| Xiahou Dun | Gang Lie R | B3:81,128,167 | Nested dying, source death, and per-event trigger timing need combined tests. |
| Zhang Liao | Tu Xi R | B4:39,81 | SK06: last-card victim loss missing; seeded deterministic RNG path also absent in handler (uses Math.random). |
| Xu Chu | Luo Yi R | B5:196 | Slash buff tested; Duel damage / death-before-buff completion need interaction coverage. |
| Guo Jia | Tian Du C; Yi Ji R | B1:346; B6:152, CF:213 | SK01 invalid recipient; SK10 optional Tian Du. |
| Zhen Ji | Luo Shen C; Qing Guo C | B5:157, CF:111; B2:150, BF:27 | Red/black response regression tested; full judgement replacement interactions not exhaustive. |
| Liu Bei | Ren De C; Ji Jiang C | B5:87; B8:127, CF:393 | SK02 repeated Ren De; proactive Ji Jiang use versus response not fully covered by these named tests. |
| Guan Yu | Wu Sheng C | B2:92; EZ:51 | SK08 invalid conversion state; legality after spending range equipment needs coverage. |
| Zhang Fei | Pao Xiao C | B1:34 | Multiple normal Slashes tested; exotic forced-use interactions not exhaustive. |
| Zhuge Liang | Guan Xing C; Kong Cheng C | B8:196, CF:33,59; B1:152 | Basic top/bottom, decline, living count and another-viewer masking tested; deck exhaustion separate audit. |
| Zhao Yun | Long Dan C | B2:27,56 | Both response directions tested; proactive Dodge-as-Slash legality / per-phase accounting need fuller coverage. |
| Ma Chao | Ma Shu C; Tie Ji C | B1:122; B7:95 | Base distance and red judgement covered; post-cost distance / replacement ordering not exhaustive. |
| Huang Yueying | Ji Zhi C; Qi Cai C | B7:139, CF:188; B1:132 | SK03/SK04: incorrect 2013 edition and missing equipment protection. |
| Sun Quan | Zhi Heng C; Jiu Yuan C | B5:32; B6:31 | Cooldown test uses invalid empty payload, not a second otherwise-valid action; equipment-loss / interrupted draws need coverage. |
| Gan Ning | Qi Xi C | B2:183, BF:76; EZ:90 | SK05: contradictory tests permit incorrect Snatch conversion. |
| Lu Meng | Ke Ji C | B1:78, CF:167 | SK07: response Slash during own Play phase not tracked. |
| Huang Gai | Ku Rou C | B5:49 | HP loss versus damage distinction; lethal activation / rescue before draw not established by normal-HP test. |
| Zhou Yu | Ying Zi C; Fan Jian R | B1:314; B6:195 | SK09 optional draw; Fan Jian transfer-last-card interactions and attribution need fuller checks. |
| Da Qiao | Guo Se C; Liu Li C | B5:123, EZ:133; B7:215, EZ:222 | SK11 description; range after discard and multi-target redirection interactions need coverage. |
| Lu Xun | Qian Xun C; Lian Ying R | B1:195; B4:95,136 | SK11 misleading text/test title; SK06 victim last-card loss path. |
| Sun Shangxiang | Jie Yin C; Xiao Ji R | B6:99; B4:161,196 | Removal/replacement normal case covered; multi-loss / cross-skill continuation requires interaction audit. |
| Hua Tuo | Ji Jiu C; Qing Nang C | B7:166, EZ:164; B5:61 | Hand/equipment rescue outside turn tested; negative-HP repeated rescue and valid cooldown repetition need more cases. |
| Lu Bu | Wu Shuang C | B1:223,262; CF:393 | Two responses and summoned responses tested; all weapons/armor combinations not exhaustive. |
| Diao Chan | Li Jian C; Bi Yue C | B6:126; B1:325, CF:145 | Basic Duel and optional end draw tested; card-use attribution / nullification / Ji Zhi interaction not established. |
| Hua Xiong | Yao Wu R | B9:33,86; CF:348 | Red, black and colourless basic branches present; source death / lethal damage timing not exhaustive. |
| Yuan Shu | Wang Zun C; Tong Ji C | B9:119,150; B9:170 | Basic hand limit and forced target condition covered; UI limit consistency / multiple modifiers separate audit. |

## Card catalogue and expansion boundary

The catalogue has **32 card definitions**, and all 32 occur in the **108-card deck**. There are **zero defined-but-undealt card types**. This is catalogue evidence, not proof of exact suit/rank multiset correctness.

| Group | Types and physical counts |
| --- | --- |
| Basic: 3 types / 53 cards | Slash 30, Dodge 15, Peach 8 |
| Immediate trick: 10 types / 31 cards | Duel 3, Dismantle 6, Snatch 5, Ex Nihilo 4, Barbarian Invasion 3, Arrow Barrage 1, Peach Garden 1, Harvest 2, Borrowed Sword 2, Nullification 4 |
| Delayed trick: 2 types / 5 cards | Indulgence 3, Lightning 2 |
| Equipment: 17 types / 19 cards | Crossbow 2; Bagua 2; one each of Gender Swords, Qinggang Sword, Green Dragon Blade, Serpent Spear, Axe, Halberd, Qilin Bow, Ice Sword, Renwang Shield, Red Hare, Dayuan, Zixing, Jueying, Dilu, Zhaohuang Feidian |

Totals are 3 + 10 + 2 + 17 = 32 types and 53 + 31 + 5 + 19 = 108 cards. EX cards include Ice Sword/Renwang Shield/additional Lightning/Nullification; these are included, not evidence that all larger expansions are supported.

Wine, elemental Slashes, Fire Attack, Iron Chain, Supply Shortage, Guding Blade, Fan, Vine and Silver Lion are absent from this catalogue/deck. They belong to the additional expansion boundary; their absence is not a missing basic Standard rule. The Guo Se metadata incorrectly mentioning Supply Shortage does not make that expansion implemented.

## Player-view/privacy seam

`createPlayerView` removes the authoritative deck and effect stack, masks opponent hand IDs/roles/candidates and selected generals, and masks Guan Xing processing cards for other viewers. Existing `tests/security/player-view.test.ts` and `CF:59` cover these main paths. No demonstrated current secret leak was found in these inspected fields.

This is not a blanket privacy certification: `player-view.ts:49` retains all remaining G fields for the spread at `:171`, and `:165-166` returns unknown presentation events unfiltered. New private fields/events would inherit public serialization unless explicitly overridden. Recheck the serialization boundary when adding skill state or event kinds. Current tests do not supply unknown private events, mutate a returned view, or comprehensively cover spectator/null-viewer states.

The parent audit's separate card-resolution probes also found nested-loss continuation defects (including one Snatch taking two cards). Those findings apply across general-skill seams and prevent interpreting the 43 named skill tests as 43 verified conformant implementations. Rows without a listed confirmed defect mean **named coverage present, remaining boundaries unreviewed**, not “no issues” or a pass certificate.

## Targeted runtime reproduction

Eight temporary tests were run with Vitest 4.1.11 through `declareCardUse`, `answerCardPrompt`, `useSkill`, `startCardTurn`, and `endCardPlayPhase`. They all failed the independent rule/state-preservation expectations; existing suite success does not cover these scenarios. Helpers mutate fixtures only before starting the scenario, matching existing tests. Temporary files were removed after verification.

To rerun, place the following inside an ignored `.references/standards-audit.test.ts`, and use a temporary Vitest config with `test.include:[".references/standards-audit.test.ts"]` and Node environment. Run `node node_modules/vitest/vitest.mjs run --config .references/standards-vitest.config.ts`.

```ts
import { expect, it } from "vitest";
import { answerCardPrompt as answer, declareCardUse as play, useSkill, startCardTurn as start, endCardPlayPhase as end } from "../src/game/cardEngine";
import { createStartedGame, resetHands, giveCard as give, identityShuffle as shuffle, answerNullificationChain as wuxie, givePhysicalCard, stackDeck } from "../tests/helpers/game";
const setup = (n=4) => { const G=createStartedGame(n); resetHands(G); return G; };
const respond = (G, pid, value) => answer(G,pid,G.prompt.id,value,shuffle);

it("Yi Ji invalid recipient rejects without throwing", () => {
  const G=setup(), a=G.turn.activePlayerID, b=G.seatOrder[1];
  G.players[a].activeSkillIDs=[]; G.players[b].activeSkillIDs=["yi-ji"];
  play(G,a,{cardID:give(G,a,"slash"),targetIDs:[b]},shuffle);
  respond(G,b,{kind:"pass"}); respond(G,b,{kind:"option",choice:"activate"});
  respond(G,b,{kind:"zone-cards",choices:[{zone:"hand",ownerID:b,handIndex:0}]});
  const before=structuredClone(G);
  expect(()=>respond(G,b,{kind:"players",playerIDs:["missing"]})).not.toThrow();
  expect(G).toEqual(before);
});
it("Tu Xi last-card theft offers Lian Ying", () => {
  const G=setup(), a=G.turn.activePlayerID, b=G.seatOrder[1];
  G.players[a].activeSkillIDs=["tu-xi"]; G.players[b].activeSkillIDs=["lian-ying"];
  give(G,b,"dodge"); start(G,a,shuffle);
  respond(G,a,{kind:"option",choice:"activate"}); respond(G,a,{kind:"players",playerIDs:[b]});
  expect(G.prompt).toMatchObject({reason:"lian-ying",responderID:b});
});
it("Ke Ji cannot skip after own-phase Duel Slash", () => {
  const G=setup(), a=G.turn.activePlayerID, b=G.seatOrder[1];
  G.players[a].activeSkillIDs=["ke-ji"]; G.players[b].activeSkillIDs=[];
  const d=give(G,a,"duel"), s=give(G,a,"slash"), t=give(G,b,"slash");
  for(let i=0;i<7;i++) give(G,a,"dodge");
  play(G,a,{cardID:d,targetIDs:[b]},shuffle); wuxie(G,{});
  respond(G,b,{kind:"card",cardID:t}); respond(G,a,{kind:"card",cardID:s}); respond(G,b,{kind:"pass"});
  end(G,a,shuffle); expect(G.prompt).toBeNull(); expect(G.turn.step).toBe("discard");
});
it("Qi Cai rejects another player's armor discard", () => {
  const G=setup(), a=G.turn.activePlayerID, b=G.seatOrder[1];
  G.players[a].activeSkillIDs=[]; G.players[b].activeSkillIDs=["qi-cai"];
  const armor=give(G,b,"bagua-formation"); G.players[b].hand=[]; G.players[b].equipment.armor=armor;
  play(G,a,{cardID:give(G,a,"dismantle"),targetIDs:[b]},shuffle); wuxie(G,{});
  expect(respond(G,a,{kind:"zone-cards",choices:[{zone:"equipment",ownerID:b,slot:"armor"}]})).toBe(false);
  expect(G.players[b].equipment.armor).toBe(armor);
});
it("Ren De rejects valid second same-phase activation", () => {
  const G=setup(), a=G.turn.activePlayerID, b=G.seatOrder[1]; G.players[a].activeSkillIDs=["ren-de"];
  const first=give(G,a,"dodge"), second=give(G,a,"peach");
  expect(useSkill(G,a,"ren-de",{cardIDs:[first],targetID:b},shuffle)).toBe(true);
  expect(useSkill(G,a,"ren-de",{cardIDs:[second],targetID:b},shuffle)).toBe(false);
});
it("invalid virtual Slash preserves state", () => {
  const G=setup(5), a=G.turn.activePlayerID, b=G.seatOrder[2]; G.players[a].activeSkillIDs=["wu-sheng"];
  const c=give(G,a,"peach"), before=structuredClone(G);
  expect(play(G,a,{kind:"virtual",cardID:c,as:"slash",targetIDs:[b]},shuffle)).toBe(false);
  expect(G).toEqual(before);
});
it("Ying Zi is optional", () => {
  const G=setup(), a=G.turn.activePlayerID; G.players[a].activeSkillIDs=["ying-zi"];
  start(G,a,shuffle); expect(G.prompt).toMatchObject({reason:"ying-zi",responderID:a});
});
it("Tian Du is optional", () => {
  const G=setup(), a=G.turn.activePlayerID; G.players[a].activeSkillIDs=["tian-du"];
  const lightning=give(G,a,"lightning"); G.players[a].hand=[]; G.players[a].judgement=[lightning];
  const red=givePhysicalCard(G,a,c=>c.suit==="heart"); G.players[a].hand=[]; stackDeck(G,[red]);
  start(G,a,shuffle); wuxie(G,{}); expect(G.prompt).toMatchObject({reason:"tian-du",responderID:a});
  expect(G.players[a].hand).not.toContain(red);
});
```

The repro uses existing fixtures to isolate each skill. It does not prove all frontend actions can generate each invalid payload, nor that all skill combinations are natural in a particular deal. Yi Ji's malformed recipient is a server/public-boundary validation test, not a normal UI choice. The source and regular tests already advertise the audited edition; source changes should follow per-symbol impact analysis and add narrowly scoped regression tests at these existing seams.
