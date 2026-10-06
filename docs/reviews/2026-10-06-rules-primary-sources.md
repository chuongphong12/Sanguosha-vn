# Nguồn luật cho audit Tam Quốc Sát cơ bản

Ngày kiểm tra: 2026-10-06. Đây là tài liệu nghiên cứu luật, **không phải kết luận source đã tuân thủ**. Ma trận dưới đây là checklist để đối chiếu implementation và test. Phạm vi mặc định: identity mode, một tướng, Standard 2013; các expansion được tách riêng. Các mô tả ngắn bằng tiếng Anh giữ thuật ngữ rõ ràng khi đối chiếu source.

## Chất lượng và phạm vi nguồn

1. **Primary, đúng năm 2013:** [Thông cáo do 游卡桌游 phát hành ngày 20-05-2013](https://www.prnasia.com/story/79788-1.shtml). Trang ghi rõ publisher và “消息来源：游卡桌游”; PRNewswire là nơi phân phối thông cáo của chính nhà phát hành. Dùng để khóa các tướng được sửa/thêm trong 2013.
2. **Primary, vận hành chính thức:** [Trang luật của game trên Qidian](https://game.qidian.com/Game/showNews/index?name=sgs&nid=1082111), bài ngày 07-11-2017, ghi đơn vị game 杭州游卡网络技术有限公司. Xác nhận identity và kết thúc; số lượng 25 tướng ở đây thuộc standard đời cũ, không dùng để phủ định 2013.
3. **Văn bản tác giả luật chính thức qua mirror:** [Rules 3.0](https://gltjk.com/sanguosha/rules/) ghi tác giả 凌天翼, mirror do 天气真好 làm ngày 16-07-2014. [Lời tác giả](https://gltjk.com/sanguosha/rules/appendix/tutorial.html) giải thích tài liệu được 游卡 và 边锋 chấp nhận, chuyển giao chính thức năm 2013. Đây **không phải domain nhà phát hành**; bảo toàn provenance và không xem mọi mục của mirror là Standard 2013: nó có 界限突破, 1v1, 3v3, 国战, quân tranh và SP. Chỉ dùng mục 标 hoặc quy tắc chung; thay đổi sau 2013 cần đánh dấu.
4. [Thông báo chính thức OL 2.48 năm 2014](https://www.sanguosha.com/news/20140805_4377_0616) xác nhận RenDe/LiJian trên OL. Không suy ra các kỹ năng chỉ bắt đầu tồn tại năm 2014: thông cáo 2013 đã có chúng.

Chưa tìm được bản scan đầy đủ của manual Standard 2013 trên domain publisher còn truy cập được. Không dùng wiki, blog diễn giải hay luật Quốc Chiến để tự lấp điểm chưa xác minh.

## Identity, thắng thua, setup

| ID | Rule/checkpoint | Evidence |
| --- | --- | --- |
| I01 | Initially reveal Lord only; other identities remain secret. | [Qidian](https://game.qidian.com/Game/showNews/index?name=sgs&nid=1082111) |
| I02 | Lord/Loyalists win after every Rebel and Renegade dies. | [Qidian](https://game.qidian.com/Game/showNews/index?name=sgs&nid=1082111) |
| I03 | Lord death: sole surviving Renegade wins; otherwise Rebels win, including dead Rebels. | [Official identity-derived mode, explicitly same ending](https://sanguosha.com/news/20151020_9798_4319) |
| I04 | Standard roles Lord/Loyal/Rebel/Renegade: 4=1/1/1/1; 5=1/1/2/1; 6=1/1/3/1; 7=1/2/3/1; 8=1/2/4/1. Double-Renegade variants are alternatives. | [Qidian](https://game.qidian.com/Game/showNews/index?name=sgs&nid=1082111) |
| I05 | Lord maxHP +1 only with at least five players; initial HP equals maxHP. | [Values](https://gltjk.com/sanguosha/rules/glossary/value.html) |

Nguồn “忠胆英杰” chỉ dùng phần tác giả ghi rõ giống identity mode cho thắng/thua. Setup của mode đó khác; không áp dụng Lord ẩn, Loyalist lộ hay bonus Loyalist vào game cơ bản.

## Turn, zones, distance và interruption

| ID | Rule/checkpoint | Evidence |
| --- | --- | --- |
| F01 | Preparation → Judgement → Draw → Play → Discard → End. Normal Draw gives two cards. | [Game flow](https://gltjk.com/sanguosha/rules/flow/game.html) |
| F02 | Resolve delayed tricks last-placed-first. Skipped phases must skip their events. | [Game flow](https://gltjk.com/sanguosha/rules/flow/game.html) |
| F03 | Play-phase activations require idle timepoints; a pending response/rescue interrupts normal play. | [Game flow](https://gltjk.com/sanguosha/rules/flow/game.html) |
| F04 | Stop every remaining resolution immediately once victory condition holds. | [Game flow](https://gltjk.com/sanguosha/rules/flow/game.html) |
| F05 | Discard hand excess over modified current-HP limit; minimum limit zero. | [Values](https://gltjk.com/sanguosha/rules/glossary/value.html) |
| F06 | Distance uses shorter living-seat path; dead seats removed; directed horse/skill adjustments; other-player minimum one. Default attack range one, weapon overrides. | [Values](https://gltjk.com/sanguosha/rules/glossary/value.html) |
| F07 | Same-name delayed tricks cannot coexist in one judgement zone. Hands hidden; equipment/judgement public; processing separate. | [Zones](https://gltjk.com/sanguosha/rules/glossary/zone.html) |
| F08 | Before requested deck operation X, replenish from shuffled discard if necessary. If deck+discard cannot supply X, end in a draw, including GuanXing. | [Zones](https://gltjk.com/sanguosha/rules/glossary/zone.html) |
| F09 | New interrupting event resolves before suspended parent. Multi-player effects/responses use order starting current-turn player. Skill text overrides card text, which overrides general rules. | [Resolution principles](https://gltjk.com/sanguosha/rules/rule/principle.html) |

F08 là quy tắc của rules mirror 2014; nếu repo cố ý dùng policy deck exhaustion khác, phải ghi edition/house rule và không đánh dấu “official complete”.

## Basic cards, tricks và equipment

| ID | Rule/checkpoint | Evidence |
| --- | --- | --- |
| C01 | Slash: one normal use per Play phase, legal target in range, one damage; Dodge cancels incoming Slash. | [Basic cards](https://gltjk.com/sanguosha/rules/card/basic.html) |
| C02 | Peach heals one or rescues dying; cannot heal above maxHP. Ordinary Play-phase Peach self-targeting needs original Standard manual confirmation: mirror's generic target wording includes modifications. | [Basic cards](https://gltjk.com/sanguosha/rules/card/basic.html), [publisher FAQ](https://www.sanguosha.com/faq.html) |
| C03 | Dismantle discards another player's zone card; Steal obtains one within distance one. Empty-zone targets invalid. | [Tricks](https://gltjk.com/sanguosha/rules/card/scroll.html) |
| C04 | Duel: target first, alternate Slashes, first failure takes opponent's one damage. | [Tricks](https://gltjk.com/sanguosha/rules/card/scroll.html) |
| C05 | Borrowed Sword: armed other player plus legal Slash victim; recheck legality before forced Slash; refusal transfers weapon. | [Tricks](https://gltjk.com/sanguosha/rules/card/scroll.html) |
| C06 | Draw-two; AOE others respond Slash/Dodge or take one; global heal injured; Harvest public pool sequential picks, leftovers discarded. | [Tricks](https://gltjk.com/sanguosha/rules/card/scroll.html) |
| C07 | Wuxie interrupts trick effect against one target, including Wuxie; counter-Wuxie restores effect. Delayed effects have separate windows. | [Tricks](https://gltjk.com/sanguosha/rules/card/scroll.html) |
| C08 | Indulgence: non-heart skips Play. Lightning: spade 2–9 causes three sourceless thunder damage; otherwise passes to next legal living seat. | [Tricks](https://gltjk.com/sanguosha/rules/card/scroll.html) |
| C09 | Delayed trick placement completes pre-use steps, then defers effect resolution until target Judgement; Wuxie is offered before that effect, not initial placement. | [Use flow: paragraph before “使用结算中”, then “生效前”](https://gltjk.com/sanguosha/rules/flow/use.html) |
| E01 | Crossbow removes Slash count; Qinggang ignores target armor for that Slash; dual swords differing sex: target discard hand or attacker draws. | [Equipment](https://gltjk.com/sanguosha/rules/card/equipment.html) |
| E02 | Axe after Dodge: optional discard two to force hit. Green Dragon after Dodge: optional new Slash against same target without distance restriction. | [Equipment](https://gltjk.com/sanguosha/rules/card/equipment.html) |
| E03 | Spear converts two handcards to Slash; Halberd last-hand Slash allows two extra targets; Bow optionally discards target horse on Slash damage. | [Equipment](https://gltjk.com/sanguosha/rules/card/equipment.html) |
| E04 | Bagua optional red judgement supplies Dodge. Renwang nullifies black Slash. Ice Sword optionally prevents Slash damage and discards two owned cards sequentially. | [Equipment](https://gltjk.com/sanguosha/rules/card/equipment.html) |
| E05 | Attack horse lowers outgoing distance; defence horse raises incoming distance. Ice Sword cannot discard judgement-zone cards. | [Equipment](https://gltjk.com/sanguosha/rules/card/equipment.html), [Zones](https://gltjk.com/sanguosha/rules/glossary/zone.html) |

Equipment card removal/replacement must trigger applicable equipment-loss skills; spending a weapon or horse as conversion cost requires recalculating legal range/distance after cost, not merely checking before it.

## Damage, dying, death

| ID | Rule/checkpoint | Evidence |
| --- | --- | --- |
| D01 | Damage and HP loss are distinct event types; HP-loss skills do not automatically trigger damage-only skills. | [Damage flow](https://gltjk.com/sanguosha/rules/flow/damage.html), [HP-loss flow](https://gltjk.com/sanguosha/rules/flow/loselife.html) |
| D02 | HP may become negative; entering dying is not immediate death. Rescue must restore HP to at least one. | [Values](https://gltjk.com/sanguosha/rules/glossary/value.html), [Dying flow](https://gltjk.com/sanguosha/rules/flow/neardeath.html) |
| D03 | Rescue responders start current-turn player. Same responder may continue healing when one Peach did not restore positive HP; stop promptly after recovery. | [Dying flow](https://gltjk.com/sanguosha/rules/flow/neardeath.html) |
| D04 | Nested dying resolves before suspended damage/parent event, then resumes it. | [Resolution principles](https://gltjk.com/sanguosha/rules/rule/principle.html) |
| D05 | Reveal dead identity and check victory before later death resolution; clear dead cards and exclude dead seats from distance/turns. | [Death flow](https://gltjk.com/sanguosha/rules/flow/death.html) |
| D06 | Any killer of Rebel draws three. Lord kills Loyalist: discard owned hand/equipment, not judgement cards. Sourceless damage has no killer reward. | [Death flow](https://gltjk.com/sanguosha/rules/flow/death.html), [Zones](https://gltjk.com/sanguosha/rules/glossary/zone.html) |
| D07 | Active-player death does not erase pending effects on surviving players; finish surviving event before next turn unless victory already ended game. | [Death flow](https://gltjk.com/sanguosha/rules/flow/death.html) |

## Các tướng: checkpoints phải có test theo phiên bản

### Standard 2013 được primary release xác nhận

| General | Required checkpoint |
| --- | --- |
| Liu Bei | RenDe once per Play phase; give handcards, at least two heals one. JiJiang solicits Shu Slash for use/response attributed to Lord. |
| Huang YueYing | JiZhi on trick use: reveal top; basic card discard or swap one handcard, otherwise obtain. QiCai removes trick distance and protects non-horse equipment from others' discard. |
| Diao Chan | Once discard one card, select two males; virtual Duel attributed to one male. End-start optional draw one. |
| Hua Xiong | Red Slash damage lets its source choose heal one or draw one. |
| Yuan Shu | WangZun at Lord preparation optionally draw one and lower Lord hand limit one that turn. TongJi when hand>HP forces Slash target to YuanShu if in attacker's range. |

Tất cả hàng trên: [Thông cáo của chính nhà phát hành 20-05-2013](https://www.prnasia.com/story/79788-1.shtml). Không thay thế Huang YueYing bằng classic “non-delayed trick → draw one” mà vẫn nhận là đã chứng minh đúng 2013. Nếu physical revision hoặc spec repo cố ý khác thông cáo, cần trích rõ tài liệu thay thế.

### Classic Standard checkpoints từ mục 标 của mirror

| Faction | General/skill audit checklist | Evidence |
| --- | --- | --- |
| Wei | CaoCao: obtain actual damage card when available; HuJia Wei Dodge. SimaYi: FanKui once/damage event, GuiCai hand replacement before judgement. XiahouDun: non-heart GangLie source discard two handcards or take damage. ZhangLiao: replace draw with one/two distinct others' handcards. XuChu: draw one fewer, Slash/Duel damage +1 this turn. GuoJia: obtain judgement; YiJi optional per damage point, distribute two cards including self. ZhenJi: black-hand Dodge; optional repeat black LuoShen judgement. | [Wei, read 标 rather than 界限突破/国-标](https://gltjk.com/sanguosha/rules/card/hero/wei.html) |
| Shu | GuanYu: red owned card as Slash. ZhangFei unlimited Slashes. ZhugeLiang: optional top min(alive,5), arrange top/bottom; empty hand forbids Slash/Duel targets. ZhaoYun swaps Slash/Dodge for use/response. MaChao outgoing distance −1 and optional red judgement forbids Dodge. See release above for LiuBei/HuangYueYing. | [Shu, read 标](https://gltjk.com/sanguosha/rules/card/hero/shu.html) |
| Wu | SunQuan: once discard owned cards/draw same; other Wu Peach rescues dying Lord +1. GanNing black owned card as Dismantle. LüMeng can skip discard if no Slash used/played during Play phase. HuangGai loses HP before drawing two, dying interrupts. ZhouYu optional extra draw; FanJian target chooses suit then obtains/reveals random handcard, mismatch damage. DaQiao diamond card Indulgence; LiuLi discard cost then redirect legal Slash in own range. LuXun cannot be Steal/Indulgence target, optional last-hand loss draw. SunShangXiang each equipment loss draws two; once discard two handcards heal self/injured male. | [Wu, read 标](https://gltjk.com/sanguosha/rules/card/hero/wu.html) |
| Neutral | HuaTuo red owned card Peach only outside own turn; once discard handcard QingNang heals injured target. LüBu requires two Dodges for Slash and two Slashes per enemy Duel response. DiaoChan/HuaXiong/YuanShu above. | [Neutral, read 标](https://gltjk.com/sanguosha/rules/card/hero/neutral.html) |

Các tướng SP/Wind khác trong catalogue không mặc nhiên thuộc Standard 2013. Audit source cần tách “extra supported” khỏi “missing basic”. Skill checklist là mục tiêu kiểm thử; không phải chứng nhận đã kiểm exhaustively mọi tổ hợp.

## Expansion: kiểm riêng nếu source bật trong deck

Wine, Fire/Thunder Slash, FireAttack, IronChain, SupplyShortage, GudingBlade, Fan, Vine, SilverLion thuộc quân tranh; thiếu chúng không đồng nghĩa Standard cơ bản thiếu luật. Source nào bật chúng phải kiểm đủ cứu mình bằng Wine, bonus chỉ Slash kế tiếp, elemental chain order/reset, recast, FireAttack suit, SupplyShortage non-club skip draw, Vine fire amplification and immunity, SilverLion cap/heal-on-loss. [Basic](https://gltjk.com/sanguosha/rules/card/basic.html), [Tricks](https://gltjk.com/sanguosha/rules/card/scroll.html), [Equipment](https://gltjk.com/sanguosha/rules/card/equipment.html).

## Các trường hợp nên được xác minh bằng integration test

Đây là test proposals suy ra từ luật trên, không khẳng định source hiện đã sai:

- AOE kills active player mid-resolution while match continues; remaining targets still resolve.
- Last enemy dies in first of several Halberd targets; later targets receive no events after match ends.
- Lightning at HP1 reaches HP−2: require three ordinary Peaches; same rescuer can supply several; order starts current player.
- Nested GangLie dying/death resumes original parent without prompt loss or duplicate effects.
- Two delayed tricks reverse insertion order, with GuiCai and TianDu at each judgement.
- Dismantle last LuXun handcard, RenDe transfer last handcard, conversion/equipment replacement: loss triggers occur once, after real move.
- JiJiang/HuJia responses retain physical card ownership/provenance and do not consume turn Slash allowance for mere response.
- Spend range-granting weapon/horse as Wusheng/Guose/Qixi/Spear cost: check legality after cost.
- Per-target Wuxie on AOE/Harvest and odd/even counter chains; no-response windows do not hide legal responder.
- Lord kills Loyalist with judgement cards: hand/equipment cleared, judgement remains; survivor distance recalculated immediately.
- Deck exhaustion with only processing cards and no discard, and GuanXing needs more cards than available: explicit draw policy, not silent partial draw.
- Huang YueYing basic top-card choice and equipment protection; separate classic/2013 version if both supported.

Để nói “đã cover tất cả”, cần thêm coverage theo từng rule ID, từng nhánh timing và cặp tương tác; số lượng test pass hay graph có symbol chưa chứng minh kết luận đó.
