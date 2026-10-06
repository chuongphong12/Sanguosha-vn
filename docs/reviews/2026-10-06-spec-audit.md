# Card, reaction, phase and death specification audit

Audit date: 2026-10-06 (Asia/Saigon). Audited commit: `101c730642cea7b086c60075f234b18f25b34a97` (latest main pinned for this audit), read in `C:/Users/Tran.Trong.Nhan/.codex/worktrees/standard-rules-audit/tqs-boardgame`. User requested a comprehensive rule implementation audit, not fixes. No checked-in engine or test files were changed.

## Evidence and limits

Graph-first exploration used GitNexus concept query and CodeGraph exploration, including dying, answerAoeSimultaneous, transferLightning and loseEquipmentCard. The initial registered primary index was stale after the engine refactor; its warning was preserved and it was not treated as proof of current callers. Subsequent CodeGraph queries targeted the newly indexed audit worktree. Implementation and exact line references below are from the pinned source, not cached graph snippets.

Specification references are the rule IDs in [primary source research](2026-10-06-rules-primary-sources.md). Core card/rules citations below point to the official rules author's 2014 mirror, not a publisher-hosted 2013 manual. Findings about execution order, card behavior, and skill continuation are concrete implementation observations. Historical edition certainty is called out for delayed-trick timing and phase-resume behavior. The publisher's 2013 release is used by the separate hero audit for edition-specific skill changes.

Public API reproductions used existing game fixtures, physical cards and exported engine entry points. They ran with `node_modules/.bin/tsx.cmd .references/spec-repro.ts` and exited 0. This script prints observed results; it is an audit probe, not a regression test asserting that the erroneous results are correct. It was removed after execution; its complete source is retained below. All examples clear unrelated general skills to isolate the effect under review, then enable the relevant skill explicitly. They do not patch game rules.

## Confirmed incorrect behavior

| ID | Priority | Observation | Exact source |
| --- | --- | --- | --- |
| S01 | P1 | AOE response arrival order can change the winning faction. | `src/game/engine/core/index.ts:4024`, `:4074` |
| S02 | P1 | A single Snatch can take two cards after an equipment-loss trigger is discarded instead of the parent effect. | `src/game/engine/core/index.ts:2973`, `:2984`; `src/game/engine/EventBus.ts:43` |
| S03 | P1 | Successful red Bagua judgment does not finish an ordinary Slash's Dodge requirement. | `src/game/engine/core/index.ts:3864`, `:1538` |
| S04 | P2 | Arrow Barrage grants Bagua judgment to players without the armor. | `src/game/engine/core/index.ts:4003`, `:4030` |
| S05 | P2 | AOE Wuxie has neither counter-Wuxie nor protection of another target. | `src/game/engine/core/index.ts:4057` |
| S06 | P2 | Barbarian Invasion advertises Spear response but rejects it. | `src/game/engine/core/index.ts:4004`, `:4030` |
| S07 | P2 | Declining TieJi cancels the entire Slash instead of proceeding to Dodge. | `src/game/engine/core/index.ts:3099`, `:3117`, `:3316` |
| S08 | P2 | Declining Ice Sword loses LuoYi's damage bonus. | `src/game/engine/core/index.ts:3105`, `:456` |
| S09 | P2 | Lightning can be judged again during the same turn when both survivors have Lightning. | `src/game/engine/core/index.ts:1381`, `:1388`, `:2385` |
| S10 | P2 | Dismantle removing LuXun's last handcard skips LianYing. | `src/game/engine/core/index.ts:1327`; `src/game/engine/skills/generals/phaseSkills.ts:146` |
| S11 | P2, edition-qualified | Delayed tricks offer Wuxie during initial placement, before their deferred resolution. | `src/game/engine/core/index.ts:883`, `:2398` |

### S01 — AOE arrival order changes victory

[Resolution principles](https://gltjk.com/sanguosha/rules/rule/principle.html) require ordered multiplayer resolution; [death flow](https://gltjk.com/sanguosha/rules/flow/death.html) checks victory before subsequent events. AOE's shared prompt accepts any unresolved target, and a pass immediately pushes damage. It does not defer effects into the target order prepared at declaration.

Reproduction: four living players, seat 0 Lord, 1 Loyalist, 2 Rebel, 3 Renegade; all have HP 1 and no rescue cards. Active seat 3 uses Arrow Barrage. Stack three Slashes as the Rebel-kill reward so that no Peach appears incidentally. Resolving seats `0,1,2` stops at Lord death and declares Rebel victory. Answering `1,2,0` is accepted and declares Renegade victory after killing all three. Same legal starting state and card; network/user response order changes the result.

Observed: `officialOrder.winner="rebel"`; `arrivalOrder.winner="renegade"`. A simultaneous UI may collect decisions early, but applying their effects must preserve rule order.

### S02 — One Snatch takes two cards; XiaoJi disappears

[Snatch text](https://gltjk.com/sanguosha/rules/card/scroll.html) grants one target card. SunShangXiang's [XiaoJi](https://gltjk.com/sanguosha/rules/card/hero/wu.html) offers two cards after equipment loss. Removing her equipment queues a new skill-trigger at the front of the stack. The parent target-card answer then blindly shifts the front, deleting that trigger and leaving the already executed Snatch effect.

Reproduction: target SunShangXiang has an equipped Crossbow and one Slash in hand. A single Snatch selects the weapon. The engine asks for another Snatch selection, then accepts the Slash. Attacker owns both cards; no XiaoJi prompt appears. With no remaining target cards, the parent silently finishes, still losing XiaoJi.

Observed: `first=true,nextPrompt="snatch",second=true,bothReceived=true`. Repair must remove the completed effect by identity or otherwise preserve nested interrupts; fixing only the missing skill prompt is insufficient.

### S03 — Red Bagua still needs another Dodge

[Equipment text](https://gltjk.com/sanguosha/rules/card/equipment.html) says a red Bagua judgment supplies Dodge. Its new judgment resolver increments `dodgesUsed` but leaves a Slash's stage `dodge`. Unlike the ordinary Dodge answer, it never transitions to `dodged` when enough Dodges have been supplied.

Observed after a red judgment against ordinary Slash: `stage="dodge",dodgesUsed=1,prompt.reason="slash"`; passing the extra prompt reduces HP `4→3`. LuBu's two-Dodge case also needs explicit threshold coverage, rather than treating every red result as final.

Existing `tests/rules/cards.test.ts:442` checks HP immediately after judgment. HP is unchanged while the extra prompt is still pending, so that assertion misses the broken continuation. It should also assert the resolved prompt/stack state.

### S04–S06 — AOE response path bypasses the normal card system

[AOE and Wuxie text](https://gltjk.com/sanguosha/rules/card/scroll.html) and [equipment text](https://gltjk.com/sanguosha/rules/card/equipment.html):

- **S04:** `allowBagua=isArrow` applies to every target. The answer verifies this shared flag, not the player's armor. A target with no equipment submits `{kind:"bagua"}`, receives a red judgment, and is marked resolved without damage.
- **S05:** a target's Wuxie is immediately discarded and marks that target resolved. No nullification-chain effect is created. A source holding counter-Wuxie is rejected because the source is not an AOE target; other targets' Wuxie answers affect themselves. This is not equivalent to standard per-target Wuxie and counter-Wuxie.
- **S06:** Barbarian Invasion sets `allowSerpentSpear=true`; a target with the equipped Spear and two distinct handcards submits the supported `serpent-spear` answer and receives `false`. The AOE handler has no Spear branch.

The existing AOE tests in `tests/rules/trick-effects.test.ts` supply ordinary cards/passes in seat order. Their happy path does not check response order, missing armor, cross-target nullification, counter chains, or conversions.

### S07–S08 — Optional branches change the parent attack

- **S07:** declining MaChao's optional TieJi reaches the generic Slash decline branch before the later TieJi-specific branch. With stage `dodge`, that branch advances the target. Observed `accepted=true,nextPrompt=null,HP unchanged,stack=[]`. The normal Dodge window should follow. Existing `tests/skills/skill-batch7.test.ts:126` exercises activation, not decline. See [MaChao](https://gltjk.com/sanguosha/rules/card/hero/shu.html).
- **S08:** Ice Sword decline constructs damage with literal amount 1 instead of the existing melee-damage calculation. With LuoYi active, a passed Slash and declined Ice Sword deal HP `4→3`, expected `4→2`. The same hardcoded amount appears when passing its card selection. Existing `tests/rules/equipment-effects.test.ts:121` exercises activation only. See [Ice Sword](https://gltjk.com/sanguosha/rules/card/equipment.html), [XuChu](https://gltjk.com/sanguosha/rules/card/hero/wei.html).

### S09 — Lightning repeats before the next turn

[Lightning text](https://gltjk.com/sanguosha/rules/card/scroll.html) transfers a missed Lightning to the next legal target. With two survivors, each holding one of the two physical Lightnings, the transfer loop skips the other survivor then revisits the current player. Since this player's current Lightning was temporarily removed, the loop considers that player eligible and returns before recording the card as already resolved this turn.

Reproduction: first judgment heart A; next deck card spade 2. Same Lightning is judged twice in the same turn and deals three thunder damage, HP `4→1`. Log shows heart judgment, transfer, then spade 2 judgment. Cover the no-other-legal-recipient branch explicitly, including dead seats.

### S10 — Card-zone movement bypasses last-hand loss

Dismantle selects LuXun's sole handcard. `removeZoneCard` directly splices the hand; it does not call the event-emitting `removeHandCard`. Observed successful discard, empty hand, empty stack and no LianYing option. [LuXun](https://gltjk.com/sanguosha/rules/card/hero/wu.html) can invoke LianYing on losing his last handcard. The separate standards audit confirms the related TuXi path; this reproduction is the generic card-effect path.

### S11 — Initial delayed-trick placement has an extra Wuxie window

The [card-use flow](https://gltjk.com/sanguosha/rules/flow/use.html) defers delayed-trick use resolution until the later judgment phase (steps around lines 127–153); [Wuxie](https://gltjk.com/sanguosha/rules/card/scroll.html) is offered before the trick's effect. Current source wraps both initial placement and later resolution in nullification effects.

Observed: during `turn.step="play"`, using Indulgence opens `reason="nullification",subjectCardName="indulgence"` while the target's judgment zone is empty. Wuxie is accepted and the Indulgence is discarded without placement. This contradicts that official-author flow. The available source is a 2014 mirror; record an explicit house rule or a differing original 2013 manual if intending to keep the extra window. Do not silently claim exact 2013 conformity from the current tests, which explicitly pass this initial window.

## Separate nonstandard feature and boundary invariant

1. **Discard → Play resume:** `resumeCardPlayPhase` at `src/game/engine/core/index.ts:3754` explicitly accepts a transition back from Discard when no prompt is pending. Repro: hand above limit, end Play, then resume returns true and sets `step="play"`. The [normal turn flow](https://gltjk.com/sanguosha/rules/flow/game.html) progresses Play → Discard → End. This may be an intentional reversible UI feature; document it as a house-rule/undo policy and define which irreversible phase triggers block resumption. It is a concrete deviation, not evidence of an accidental engine bug by itself.
2. **Invalid virtual Slash mutation:** `declareVirtualUse` increments Slash count at line 1094 before target validation at 1108. Direct API call with WuSheng and illegal self target returns false but changes `slashUses:0→1`. Boardgame.io's INVALID_MOVE rollback may discard this draft mutation at the outer boundary; therefore this audit does **not** claim ordinary match players necessarily lose their Slash after a rejected move. The separate standards audit covers the direct API invariant; verify rollback semantics before escalating user impact.

## Positive checks and incomplete coverage

A three-damage event at HP 1 enters dying at HP −2. The same rescuer successfully spends three physical Peaches: `−2→−1→0→1`; the target remains alive and the rescue prompt closes. This validates the inspected multiple-Peach/negative-HP path, not every rescue interaction.

Inspected source also implements the ordinary Lord/Rebel/Renegade victory branches, sourceless Lightning damage, Rebel reward and Lord/Loyalist penalty, living-seat distance, duplicate delayed-trick checks, last-placed-first judgments, and prompt/phase guards for normal use. Those observations are not an exhaustive certification. Specific gaps needing durable tests remain:

- nested dying from GangLie followed by correct parent continuation;
- Lord/Loyalist penalty with retained judgment cards and equipment-loss timing;
- pending AOE after active-player death, plus victory cancellation before later targets;
- consecutive delayed tricks with GuiCai replacement and optional TianDu;
- forced Slash via Borrowed Sword/Green Dragon with skill conversion, empty-hand KongCheng, changed range and TongJi restrictions;
- spending an equipped range/distance modifier as a virtual-card or LiuLi cost;
- full per-target nullification chains across AOE/global/delayed cards;
- legal and illegal reaction input combinations, card conservation, effect removal by identity and no repeated parent action after nested triggers.

A passing existing suite does not establish these branches; S01–S11 were reproduced despite existing positive card/skill tests. Missing tests are listed separately from reproduced wrong behavior.

## Reproduction source

Save the following as ignored `.references/spec-repro.ts` in the pinned worktree, execute `node_modules/.bin/tsx.cmd .references/spec-repro.ts`, then remove it. Fixtures intentionally replace unrelated skills and set minimal legal scenario state; exported engine APIs perform all actions being tested.

```ts
import { answerCardPrompt, declareCardUse, endCardPlayPhase, resumeCardPlayPhase, startCardTurn, damageEffect, resolveCardGame } from '../src/game/cardEngine';
import { createStartedGame, giveCard, givePhysicalCard, resetHands, stackDeck, identityShuffle } from '../tests/helpers/game';
function fresh(){const G=createStartedGame();resetHands(G);for(const p of Object.values(G.players)){p.activeSkillIDs=[];p.generalID='zhang-fei';}return G;}
function answer(G:any,id:string,a:any){return answerCardPrompt(G,id,G.prompt!.id,a,identityShuffle);}
function play(G:any,id:string,cardID:string,targets:string[]=[]){return declareCardUse(G,id,{cardID,targetIDs:targets},identityShuffle);}
{
 const G=fresh(),id=G.seatOrder[1];const card=giveCard(G,'0','arrow-barrage');const red=givePhysicalCard(G,'0',c=>c.suit==='heart');stackDeck(G,[red]);play(G,'0',card);const accepted=answer(G,id,{kind:'bagua'});console.log('BAGUA_NO_ARMOR',JSON.stringify({accepted,armor:G.players[id].equipment.armor,passed:(G.effectStack[0] as any).passedPlayerIDs,hp:G.players[id].hp}));
}
{
 const G=fresh(); const card=giveCard(G,'0','arrow-barrage');const first=giveCard(G,'1','nullification'),counter=giveCard(G,'0','nullification');play(G,'0',card);const accepted=answer(G,'1',{kind:'card',cardID:first});const sourceCounterAccepted=answer(G,'0',{kind:'card',cardID:counter});console.log('AOE_WUXIE_NO_COUNTER',JSON.stringify({accepted,sourceCounterAccepted,prompt:G.prompt?.reason,firstDiscarded:G.discard.includes(first),sourceCounterStillHand:G.players['0'].hand.includes(counter)}));
}
{
 const G=fresh();const card=giveCard(G,'0','barbarian-invasion');const weapon=giveCard(G,'1','serpent-spear');G.players['1'].hand=[];G.players['1'].equipment.weapon=weapon;const a=giveCard(G,'1','dodge'),b=giveCard(G,'1','peach');play(G,'0',card);console.log('AOE_SPEAR_REJECTED',JSON.stringify({allowed:(G.prompt as any).allowSerpentSpear,accepted:answer(G,'1',{kind:'serpent-spear',cardIDs:[a,b]})}));
}
function aoeWinner(order:string[]){const G=fresh();G.turn.activePlayerID='3';G.turn.step='play';G.lordID='0';const roles=['lord','loyalist','rebel','renegade'] as const;G.seatOrder.forEach((id,i)=>{G.players[id].role=roles[i];G.players[id].hp=1;});const card=giveCard(G,'3','arrow-barrage');const reward=Array.from({length:3},()=>giveCard(G,'3','slash'));stackDeck(G,reward);play(G,'3',card);const accepted=[];for(const id of order){if(!G.prompt)break;accepted.push([id,answer(G,id,{kind:'pass'})]);}return{accepted,winner:G.winner?.side,dead:G.seatOrder.filter(id=>!G.players[id].alive)};}
console.log('AOE_ORDER_WINNER',JSON.stringify({officialOrder:aoeWinner(['0','1','2']),arrivalOrder:aoeWinner(['1','2','0'])}));
{
 const G=fresh();G.players['0'].hp=1;for(let i=0;i<3;i++)giveCard(G,'0','slash');endCardPlayPhase(G,'0',identityShuffle);const before=G.turn.step;const accepted=resumeCardPlayPhase(G,'0');console.log('RESUME_DISCARD_PLAY',JSON.stringify({before,accepted,after:G.turn.step}));
}
{
 const G=fresh();G.players['0'].activeSkillIDs=['wu-sheng'];const red=givePhysicalCard(G,'0',c=>c.suit==='heart'&&c.definitionID!=='slash');const before=G.players['0'].slashUses;const accepted=declareCardUse(G,'0',{kind:'virtual',cardID:red,as:'slash',targetIDs:['0']},identityShuffle);console.log('INVALID_VIRTUAL_SLASH_MUTATES',JSON.stringify({accepted,before,after:G.players['0'].slashUses,stillHand:G.players['0'].hand.includes(red)}));
}

{
 const G=fresh();const target='1',slash=giveCard(G,'0','slash'),armor=giveCard(G,target,'bagua-formation');G.players[target].hand=[];G.players[target].equipment.armor=armor;const red=givePhysicalCard(G,'0',c=>c.suit==='heart');stackDeck(G,[red]);const before=G.players[target].hp;play(G,'0',slash,[target]);const accepted=answer(G,target,{kind:'bagua'});const afterBagua={accepted,prompt:G.prompt?.reason,stage:(G.effectStack[0] as any)?.stage,dodgesUsed:(G.effectStack[0] as any)?.dodgesUsed};answer(G,target,{kind:'pass'});console.log('BAGUA_SUCCESS_STILL_DAMAGE',JSON.stringify({before,afterBagua,afterHP:G.players[target].hp}));
}
{
 const G=fresh();G.players['0'].activeSkillIDs=['tie-ji'];const slash=giveCard(G,'0','slash');const before=G.players['1'].hp;play(G,'0',slash,['1']);const prompt=G.prompt?.reason;const accepted=answer(G,'0',{kind:'option',choice:'decline'});console.log('TIEJI_DECLINE_CANCELS_SLASH',JSON.stringify({prompt,accepted,nextPrompt:G.prompt,before,afterHP:G.players['1'].hp,stack:G.effectStack.map(e=>e.kind)}));
}
{
 const G=fresh();G.turn.luoYiBuff=true;const weapon=giveCard(G,'0','ice-sword');G.players['0'].hand=[];G.players['0'].equipment.weapon=weapon;giveCard(G,'1','slash');const slash=giveCard(G,'0','slash');const before=G.players['1'].hp;play(G,'0',slash,['1']);answer(G,'1',{kind:'pass'});const prompt=G.prompt?.reason;answer(G,'0',{kind:'option',choice:'decline'});console.log('ICESWORD_DECLINE_LOSES_LUOYI',JSON.stringify({prompt,before,afterHP:G.players['1'].hp}));
}

{
 const G=fresh();G.config.autoSkipWuxie=true;for(const id of ['1','2'])G.players[id].alive=false;const a=giveCard(G,'0','lightning'),b=giveCard(G,'3','lightning');G.players['0'].hand=[];G.players['3'].hand=[];G.players['0'].judgement=[a];G.players['3'].judgement=[b];const miss=givePhysicalCard(G,'0',c=>c.suit==='heart'),hit=givePhysicalCard(G,'0',c=>c.suit==='spade'&&c.rank==='2');stackDeck(G,[miss,hit]);const before=G.players['0'].hp;startCardTurn(G,'0',identityShuffle);console.log('LIGHTNING_REJUDGED_SAME_TURN',JSON.stringify({before,afterHP:G.players['0'].hp,missDiscarded:G.discard.includes(miss),hitDiscarded:G.discard.includes(hit),log:G.log.filter(x=>x.message.includes('phán xét')||x.message.includes('Thiểm Điện')).map(x=>x.message)}));
}

{
 const G=fresh();G.config.autoSkipWuxie=true;G.players['1'].generalID='sun-shangxiang';G.players['1'].activeSkillIDs=['xiao-ji'];const equip=giveCard(G,'1','crossbow');G.players['1'].hand=[];G.players['1'].equipment.weapon=equip;const trick=giveCard(G,'0','snatch');play(G,'0',trick,['1']);const accepted=answer(G,'0',{kind:'zone-cards',choices:[{zone:'equipment',ownerID:'1',slot:'weapon'}]});console.log('SNATCH_DROPS_XIAOJI',JSON.stringify({accepted,prompt:G.prompt?.reason,targetHand:G.players['1'].hand,sourceReceived:G.players['0'].hand.includes(equip),stack:G.effectStack.map(e=>e.kind)}));
}
{
 const G=fresh();G.config.autoSkipWuxie=true;G.players['1'].generalID='lu-xun';G.players['1'].activeSkillIDs=['lian-ying'];giveCard(G,'1','slash');const trick=giveCard(G,'0','dismantle');play(G,'0',trick,['1']);const accepted=answer(G,'0',{kind:'zone-cards',choices:[{zone:'hand',ownerID:'1',handIndex:0}]});console.log('DISMANTLE_DROPS_LIANYING',JSON.stringify({accepted,prompt:G.prompt?.reason,targetHand:G.players['1'].hand,stack:G.effectStack.map(e=>e.kind)}));
}

{
 const G=fresh();const card=giveCard(G,'0','indulgence'),wuxie=giveCard(G,'1','nullification');play(G,'0',card,['1']);const initial={prompt:G.prompt?.reason,phase:G.turn.step,subject:(G.prompt as any)?.subjectCardName,targetJudgement:[...G.players['1'].judgement]};const accepted=answer(G,'1',{kind:'card',cardID:wuxie});for(let guard=0;guard<8&&G.prompt?.reason==='nullification';guard++)answer(G,(G.prompt as any).responderID,{kind:'pass'});console.log('DELAYED_WUXIE_BEFORE_PLACEMENT',JSON.stringify({initial,accepted,afterJudgement:G.players['1'].judgement,trickDiscarded:G.discard.includes(card)}));
}
{
 const G=fresh();G.players['1'].hp=1;const peaches=Array.from({length:3},()=>giveCard(G,'0','peach'));G.effectStack.push(damageEffect(G,'0','1',3));resolveCardGame(G,identityShuffle);const hp=[G.players['1'].hp],accepted=[];for(const p of peaches){accepted.push(answer(G,'0',{kind:'card',cardID:p}));hp.push(G.players['1'].hp);}console.log('NEGATIVE_HP_RESCUE_OK',JSON.stringify({accepted,hp,alive:G.players['1'].alive,prompt:G.prompt}));
}

{
 const G=fresh();G.config.autoSkipWuxie=true;G.players['1'].generalID='sun-shangxiang';G.players['1'].activeSkillIDs=['xiao-ji'];const equip=giveCard(G,'1','crossbow');G.players['1'].hand=[];G.players['1'].equipment.weapon=equip;const hand=giveCard(G,'1','slash');const trick=giveCard(G,'0','snatch');play(G,'0',trick,['1']);const first=answer(G,'0',{kind:'zone-cards',choices:[{zone:'equipment',ownerID:'1',slot:'weapon'}]});const nextPrompt=G.prompt?.reason;const second=answer(G,'0',{kind:'zone-cards',choices:[{zone:'hand',ownerID:'1',handIndex:0}]});console.log('ONE_SNATCH_STEALS_TWO',JSON.stringify({first,nextPrompt,second,bothReceived:[equip,hand].every(id=>G.players['0'].hand.includes(id)),targetHand:G.players['1'].hand,prompt:G.prompt}));
}

```
