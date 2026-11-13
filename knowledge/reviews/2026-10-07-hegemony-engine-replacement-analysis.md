> Historical evidence from `docs/reviews/2026-10-07-hegemony-engine-replacement-analysis.md` in game `4b19fddcb6547066de0db0ae078c0db7642877ba`. Results apply only to the revision and adapter scope described below. Later corrections and current capabilities are indexed in [engine scope](../engine/overview.md) and the [port plan](../plans/hegemony-port.md). Original game blob: `0b546c8a8ec534bf7fedf97bbd9088dcc480e330`. Machine-local link targets have been replaced with pinned native links or labelled source-relative references.

# Phân tích thay engine Standard 2013 bằng Quốc Chiến

Ngày: 2026-10-07. Trạng thái: nghiên cứu và đề xuất thiết kế; chưa triển khai hoặc xóa engine đang chạy.

## 1. Mục tiêu theo yêu cầu mới

Sản phẩm cuối chỉ có **engine Quốc Chiến**, dùng TypeScript, PixiJS và boardgame.io hiện tại. Không giữ chế độ Identity/Standard 2013, không xây framework hỗ trợ đồng thời hai bộ luật. Đề xuất giữ hai chế độ trong báo cáo khả thi trước đây đã được thay thế bởi yêu cầu này.

Việc loại bỏ bao gồm luật, state, catalog kỹ năng phiên bản cũ, AI theo thân phận, giao thức tạo/join trận và các nhánh UI dành riêng cho Identity. Giữ hoặc chuyển đổi hạ tầng transport, rendering, asset loading, presentation và những primitive bài được kiểm chứng theo luật Quốc Chiến.

**Kết luận:** không thể hoàn thành chuyển đổi bằng cách đổi tên game, thêm thế lực hoặc xóa `cardEngine.ts`. File đó chỉ re-export engine thật trong `engine/core/index.ts`. Phải thay mô hình domain và cơ chế giải quyết sự kiện, rồi chuyển toàn bộ consumer sang engine mới trước khi xóa engine cũ.

## 2. Nguồn luật và phạm vi đã kiểm tra

- Bản đính kèm `QSanguosha-LangKhach-QuocChien` là bản phát hành Windows 2.3.41.1, có Lua, bản dịch và assets, thiếu C++ core. Không chạy executable hoặc Lua từ bản đính kèm.
- **Baseline đã được người dùng chọn:** `TamQuocSat-LangKhach/QSanguosha-QuocChien`, commit **ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f**, trả version **2.3.43-beta2**. Đây là chuẩn cho engine mới, không tuyên bố khớp bản đính kèm 2.3.41.1.
- Đã đọc sâu scheduler, useCard, movement, damage/dying/death, show/hideGeneral, friend predicates, winner và careerist recruitment. Các kết luận bên dưới gắn với commit này, không đại diện cho mọi revision Quốc Chiến.
- Engine TypeScript được đối chiếu ở **59025fa095048f3364fb2a2e397b3df602c4d21f**. Đã fetch và xác nhận `origin/main` là **936d9656f1875a51af8cc6d4ccaa9504a1487a9a**. `src/game`, `src/client`, `server`, `package.json`, E2E không khác giữa hai commit; khác biệt ở main chỉ là layout và test layout. Khi triển khai phải dùng main hiện hành.
- Đây là phân tích core và các seam cần chuyển đổi. Chưa chứng minh parity của toàn bộ package/kỹ năng và chưa chạy test Quốc Chiến.

Version native được xác nhận tại [engine.cpp:680](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/engine.cpp#L680).

## 3. Bằng chứng phạm vi ảnh hưởng

Đã dùng GitNexus query/context/impact trước khi đọc quan hệ phụ thuộc, bổ sung CodeGraph và kiểm tra text khi graph không giải được export, object property hoặc overload.

| Symbol hiện tại | GitNexus impact, gồm tests | Ý nghĩa khi thay engine |
| --- | --- | --- |
| `emitEvent` | **CRITICAL**, 35 symbol, 4 caller trực tiếp, 12 process, 6 module | Chạm luồng damage, mất bài/trang bị và chuyển phase; cần thay scheduler và kiểm chứng các luồng này |
| `declareCardUse` | **HIGH**, 36 symbol, 25 caller trực tiếp | TqsGame, AI và nhiều rule/skill test dùng chung entry point |
| `selectGeneral`, đúng file `setup.ts` | **HIGH**, 41 symbol, 5 caller trực tiếp | Setup mới kéo theo client, fixtures, AI và test tích hợp |
| `PlayerState` | MEDIUM, 62 symbol; graph là lower bound | Thay một tướng/thân phận bằng hai tướng/thế lực ảnh hưởng rộng qua các type dẫn xuất |
| `playerView` | LOW theo graph, 3 caller trực tiếp | Rủi ro bảo mật vẫn cao: việc lọc thông tin ẩn thay đổi hoàn toàn |
| `TqsGame` | **UNKNOWN**, GitNexus không thấy caller | CodeGraph và kiểm tra import xác nhận MatchClient local/online, server registration và local-sync test phụ thuộc trực tiếp |

`UNKNOWN` không phải all-clear. CodeGraph chỉ thấy file cho barrel `cardEngine.ts`; caller thực tế được xác định qua implementation `declareCardUse`. Native graph cũng thiếu receiver typing và một số overload/cross-language call; source được dùng xác minh các contract cụ thể, không tuyên bố đã giải hết mọi thiếu sót của index.

## 4. Những khác biệt bắt buộc ở domain

| Domain | Engine hiện tại | Quốc Chiến cần có |
| --- | --- | --- |
| Setup | Chia lord/loyalist/rebel/renegade, lord chọn trước, một tướng | Chọn cặp chủ/phó theo quy tắc ghép, ban pair và package đã pin; quản lý kín từng slot |
| Danh tính | `generalID`, `roleRevealed`, `lordID` | Head/deputy IDs ở server, shown/preshow flags riêng, public identity theo từng slot |
| Quan hệ | Team suy ra từ Role | `isFriendWith` khác `willBeFriendWith`; faction, majority, lord-general và careerist group ảnh hưởng quan hệ |
| HP | MaxHP một tướng và bonus chủ công | Native lấy `floor((head.getMaxHpHead() + deputy.getMaxHpDeputy()) / 2)`; các chỉnh sửa head/deputy và mark liên quan xử lý riêng |
| Skill | `activeSkillIDs` phẳng, nhiều biến riêng trong TurnState | Skill ownership theo slot, hidden/shown/preshow, acquired/equipment/global skills, limited marks, disable/filter/modifier hooks |
| Card/equipment | CardName đóng, 4 slot, damage normal/thunder | Catalog theo package; fire, chained/turned state, treasure/special piles và các protocol mà nội dung được bật yêu cầu |
| Kết thúc | Chủ công chết/phản tặc hết/nội gián sống cuối | Winner theo quan hệ thực tế/tiềm năng, forced reveal, careerist recruitment; gồm cả đồng minh đã chết |
| Client view | Khi playing thì mọi general hiện | Từng slot chỉ hiện khi được phép; lọc cả skills, candidate, private piles, prompt, log và presentation payload |

Nguồn domain: PlayerState (game source: `src/game/types/state.ts:14`), core types (game source: `src/game/types/core.ts:3`), [native HP](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/serverplayer.cpp#L1324), [native friend predicates](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/player.cpp#L2209).

Lưu ý: tên package `Standard` trong native vẫn có thể là package Quốc Chiến hợp lệ. Lord-general của Quốc Chiến cũng không phải thân phận Chủ Công trong Identity. Không xóa máy móc mọi tên `standard` hoặc `lord`.

## 5. Scheduler phải được thay, không chỉ mở rộng registry

Native có thứ tự xử lý:

1. Event frame giữ payload có thể thay đổi và ngữ cảnh cha.
2. Stable sort theo dynamic priority, chia priority band.
3. `record` rồi tính `triggerable`; hành động theo thứ tự người chơi của native, có trường hợp gồm người đã chết.
4. Cho actor chọn thứ tự các trigger hợp lệ; phân biệt compulsory đã hiện và kỹ năng còn ẩn.
5. Chạy `cost`; cost có thể phát sinh movement, prompt hoặc event con.
6. Cost thành công thì `showSkill`/`GeneralShown` hoàn tất **trước** `effect`.
7. Tính lại eligibility, loại occurrence đã tiêu thụ; phân biệt skill owner, head/deputy, target và lần xuất hiện.
8. Phân biệt consume event với ngắt phase, turn hoặc game; unwind và cleanup theo từng loại.

`EventBus` hiện chỉ có 8 event name, quét skill một lần và đẩy `skill-trigger` vào stack. Nó không có generic priority band, record/cost/effect, lựa chọn thứ tự, consumed-instance ledger hoặc eligibility refresh. Các skill tự viết nhiều stage không thay được contract chung này.

Nguồn: [RoomThread::trigger](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/roomthread.cpp#L224), EventBus (game source: `src/game/engine/EventBus.ts:17`), SkillRegistry (game source: `src/game/engine/SkillRegistry.ts:5`).

Không cần port Qt thread/semaphore. Trong browser/server TypeScript, phải biểu diễn trạng thái chờ bằng **frame dữ liệu có thể serialize**: stage, cursor, ID, payload, consumed occurrences và pending child. JS callback, Promise stack hoặc pointer native không được lưu trong game state.

## 6. Các pipeline cần bảo toàn thứ tự

| Pipeline | Contract native và yêu cầu cho bản port |
| --- | --- |
| Card use | Validation có thể thay card; materials thật/ảo và provenance; mutable target list qua các target event; response counts và nullification masks; finish/cleanup đúng một lần |
| Movement | Intent → BeforeCardsMove/ConfirmMoveCards → commit mọi from/to → postcommit events. Có reason, visibility, pile/zone metadata; interceptor có thể sửa/hủy batch |
| Damage | Nhiều stage prevention/reduction/transfer; chain continuation; DamageDone giảm HP và có thể hoàn tất dying/death trước Damage/Damaged tiếp theo |
| Dying | Nested dying stack; saver có thể cứu nhiều lần đến HP > 0; view-as/token rescue không được bỏ qua vì không có Đào vật lý |
| Death | Mark dead → forced reveal/winner judge → Death → detach → BuryVictim/reward → DeathFinished. GameOver có thể dừng các bước sau |
| Reveal/hide | Thay kỹ năng/marks/card filters và quan hệ trước event; ẩn lại không xóa private original identity |
| Winner | Một operation có thể hỏi recruitment, dùng hidden actual identities, ép reveal và include deceased allies; không phải hàm đếm faction công khai |

Nguồn: [Room::useCard](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4187), [Card::onUse](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/core/card.cpp#L746), [movement](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L5163), [damage](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L4476), [dying](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L244), [death](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L364), [showGeneral](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/serverplayer.cpp#L1753), [getWinner](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L1058).

Thưởng/phạt tại baseline: killer chết hoặc chưa hiện tướng không được thưởng; plain careerist giết địch rút 3; killer khác rút `1 + số đồng minh còn sống của nạn nhân`; giết đồng minh bỏ toàn bộ tay/trang bị. Không dùng lại thưởng giết phản tặc hoặc phạt giết trung thần. Nguồn: [rewardAndPunish](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/gamerule.cpp#L1036), [getOtherPlayers default](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.h#L87).

## 7. Điểm cần quyết định khi chốt baseline

Có sai khác source–bản dịch cụ thể: tại `doCareeristRule`, nhánh **no** nhận rút đủ 4 và hồi 1; nhánh **yes** gia nhập rồi break. Bản dịch Việt trong bản đính kèm lại mô tả lợi ích khi gia nhập. Chưa có bằng chứng để kết luận đó là bug hay thay đổi revision.

Đề xuất mặc định của nghiên cứu: lấy executable semantics của source đã pin làm chuẩn, ghi discrepancy trong rule manifest và test tương ứng. Nếu muốn sửa sang mô tả Việt, phải ghi thành deviation được duyệt, không tuyên bố parity tuyệt đối. Điểm này phải được chốt trước khi bật recruitment cho người chơi.

Nguồn: [doCareeristRule](https://github.com/TamQuocSat-LangKhach/QSanguosha-QuocChien/blob/ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f/src/server/room.cpp#L8340), bản dịch BasaraMode (supplied 2.3.41.1 distribution: `lang/vi_VN/BasaraMode.lua:137`; not the chosen native baseline).

## 8. So sánh cách thay engine

| Cách | Ưu điểm | Chi phí/rủi ro | Đánh giá |
| --- | --- | --- | --- |
| **Engine Quốc Chiến mới, chuyển consumer theo lát cắt, xóa legacy khi cutover** | Interface rõ; test contract độc lập; khoanh vùng lỗi trong quá trình chuyển | Có khoảng thời gian hai implementation tồn tại trên nhánh phát triển | **Đề xuất**; bản phát hành cuối chỉ đăng ký Quốc Chiến |
| Sửa trực tiếp core Standard thành Quốc Chiến | Ít di chuyển file ban đầu | State/skill/role assumptions tiếp tục lẫn nhau; khó xác định phần 2013 còn sót | Không đề xuất vì thay đổi lớn hơn interface hiện tại |
| Xóa và viết lại toàn bộ trong một lần | Tree sớm sạch legacy | Game không chạy trong thời gian dài; nhiều lỗi integration xuất hiện đồng thời | Không đề xuất |

Tồn tại legacy tạm trên nhánh phát triển phục vụ chuyển đổi, không phải giữ tính năng chọn Identity trong sản phẩm. Không đưa native Qt backend vào kiến trúc phát hành; source native chỉ làm tài liệu chuẩn đối chiếu.

## 9. Ranh giới module được đề xuất

**Engine Quốc Chiến** có interface nhỏ: tạo game/setup, nhận command, chạy đến điểm chờ hoặc kết thúc, tính command hợp lệ cho actor, xuất player view. Command có kiểu rõ cho chọn cặp, reveal/hide hợp lệ, dùng bài/kỹ năng, trả lời prompt và kết thúc phase.

Các trách nhiệm bên trong:

- Domain: head/deputy, relations, marks/piles, zones, phase, winner; authoritative state tách khỏi view.
- Resolver: scheduler, data-only frames, action order, nested prompt và unwind.
- Rule operations: movement, useCard, damage/dying/death, reveal/winner. Tất cả chuyển bài đi qua cùng movement pipeline.
- Content: manifest và definitions/handlers theo baseline; ban pairs, skill slot, modifiers và package dependencies.
- Projection: player-specific state, prompt, log và presentation; không gửi private engine frames cho client.

`TqsGame` trở thành boardgame.io adapter, chịu actor/credential và command envelope; không đặt luật Quốc Chiến riêng trong UI hay AI. MatchClient/Pixi dùng view và legal choices; AI dùng knowledge hợp lệ cho bot và cùng command validator, không đọc tướng ẩn của đối thủ để quyết định.

RNG dùng cơ chế deterministic của hệ thống hiện tại; cùng snapshot + command + RNG state phải cho cùng kết quả. Resume kiểm tra frameID/stage/responder và consumption ID; câu trả lời trễ, trùng hoặc sai actor không được chạy lại cost/reward.

Giao thức dùng game key mới và schema version mới. Không diễn giải match/save Standard cũ thành Quốc Chiến. Client cũ phải bị từ chối rõ khi không tương thích; chỉ game Quốc Chiến được đăng ký trên server sau cutover.

## 10. Danh sách thay thế và xóa

| File/nhóm hiện tại | Hành động tại cutover |
| --- | --- |
| `src/game/catalog/roles.ts` | **Xóa** bảng role, double-renegade và role labels của Identity |
| `src/game/setup.ts` | **Thay** setup/select/start: bỏ lord selection, roleVariant, lordExtraHp và lord-first turn; dùng setup Quốc Chiến đã pin |
| `src/game/rules.ts` | **Thay** `determineWinner`, `roleSide`, WangZun/lord policy và deck-exhaustion policy; chuyển primitive distance/range/draw sang core mới sau đối chiếu |
| `src/game/engine/core/index.ts`, `EventBus.ts`, `SkillRegistry.ts` | **Xóa implementation legacy** sau khi các entry point có replacement; scheduler/pipelines mới không import core cũ |
| `src/game/engine/skills/**`, `validators/**` | **Thay rồi xóa legacy**; kỹ năng trùng tên phải đối chiếu mô tả và source Quốc Chiến, không giữ handler theo tên |
| `src/game/cardEngine.ts` | **Xóa barrel legacy** khi mọi caller đã chuyển; đây không phải file engine chính |
| `src/game/types/{core,state,effects,prompts,cards}.ts`, `model.ts` | **Thay** schema và exports; bỏ Role/lordID/roleRevealed, single-general state, effect/prompt dành riêng cho luật cũ |
| `src/game/catalog/{generals,cards}.ts` | **Thay** catalog/deck/skill text bằng content manifest Quốc Chiến; chỉ tái sử dụng primitive/metadata đúng baseline |
| `src/game/TqsGame.ts` | **Thay** registration và adapter; xóa game key `tam-quoc-sat-standard-2013` |
| `src/game/ai/**` | **Thay** role-team heuristic và general pick; thêm two-general/reveal/action policy, giữ transport bot khi dùng được |
| `src/client/MatchClient.ts`, `server/server.ts` | **Chuyển** client local/online, server game registration, setup/protocol; giữ transport/password flow sau kiểm chứng |
| `FormationScene`, `requiredActor`, waiting-room model/UI, `MainScreen`, `LobbyUI`, `ResultScene`, `Dashboard` | **Chuyển** chọn cặp, hai slot, reveal controls, skill choices, faction/winner và mọi create/join/leave game key |
| `types/presentation.ts`, `engine/presentation.ts`, `AnimationManager`, asset aliases/LoadScreen | **Chuyển** event/view mapping từ role reveal sang general-slot/faction changes; giữ animation/sequence primitives hợp lệ |
| `tests/helpers`, catalog/rules/skills/AI/security/integration tests, `e2e/*.spec.ts` | **Thay fixtures và assertions** theo Quốc Chiến. Chỉ xóa test đặc thù Identity sau khi thay coverage tương ứng; không xóa invariant/privacy/transport tests để làm CI xanh |

Đây là removal inventory theo contract, không phải lệnh xóa tất cả thư mục ngay lập tức. Trước từng đợt code edit phải chạy impact trên symbol sẽ sửa; trước commit chạy detect-changes, xử lý mọi partial/truncated/UNKNOWN.

## 11. Thứ tự thực hiện được đề xuất

1. Chốt source baseline, discrepancy policy và manifest nội dung đầu tiên. Ghi bộ contract tests từ source; không lấy toàn bộ bản dịch làm specification thực thi.
2. Xây domain và scheduler Quốc Chiến trong nhánh phát triển từ main hiện hành. Kiểm chứng nested cost/reveal, movement và serialize/resume bằng skill fixture tối thiểu.
3. Hoàn tất một ván Quốc Chiến xuyên suốt: chọn cặp, phát bài, reveal, card/skill responses, damage/rescue/death, quan hệ, reward và victory. Manifest chỉ bật nội dung đã có handler và test; không silently no-op kỹ năng thiếu.
4. Chuyển boardgame.io, local/online client, AI, Pixi views và E2E sang cùng engine. Đưa game key/schema mới vào mọi luồng tạo/join/leave và kiểm tra reconnect.
5. Xóa runtime/exports/catalog/Identity-only tests cũ, bỏ mọi lựa chọn Standard 2013. Verify build/check/E2E và graph changes trước PR.
6. Mở rộng các package Quốc Chiến còn lại theo manifest và source. Nếu first cutover chỉ bật subset thì báo rõ subset; engine migration thành công không đồng nghĩa toàn bộ roster/scenario đã port xong.

Không giao một PR chỉ xóa engine mà thiếu replacement chạy được. Các bước trên cần chia milestone có acceptance riêng; toàn bộ content port là công việc tiếp theo lớn hơn thay core.

## 12. Các tình huống kiểm chứng bắt buộc

Các ca sau là yêu cầu cho test mới, **chưa được chạy** trong lượt nghiên cứu này:

1. Hai trigger đồng priority cho chọn thứ tự; effect đầu thay eligibility sau; record không chạy lặp.
2. Hidden compulsory có thể từ chối khi native cho phép; shown/global/equipment compulsory không bị cancel sai.
3. Skill trùng, head/deputy và per-target occurrences không bị resolve thiếu hoặc hai lần sau reload.
4. Cost bỏ trang bị tạo movement/event con; GeneralShown hoàn tất trước effect cha.
5. Reveal trong cost làm kết thúc game; parent effect/target tiếp theo không tiếp tục sai.
6. TargetConfirming sửa target list; response counts và effects sau dùng danh sách mới.
7. BeforeCardsMove sửa/hủy batch; chỉ commit một lần, bảo toàn card ownership và đúng visibility.
8. Movement lồng trong cost rồi cancel/reload; không lặp transfer hoặc phát postcommit event sớm.
9. Damage prevention/reduction/transfer và từng nature đúng thứ tự, đúng source attribution.
10. HP âm cần nhiều lần cứu; Đào ảo/token vẫn có cơ hội; Wansha/prohibition loại đúng actor/action.
11. Cứu người A khiến B hấp hối; trả lại dying context A sau khi B giải quyết xong.
12. Chain damage giải quyết xong chết/cứu một nạn nhân trước nạn nhân tiếp theo; không lặp damage/reward.
13. Death reveal trước judgement; killer chết/chưa hiện không thưởng; enemy/careerist/ally reward đúng; game over ngắt burial đúng source.
14. Majority/careerist với/không living lord, lord death, hai plain careerist không thành đồng minh.
15. Lật head trước/deputy trước, dual-faction, hide slot cuối rồi reveal lại; skills/marks/filters đúng và không lộ slot còn ẩn.
16. Hidden potential ally/careerist có thể trì hoãn thắng; recruitment pause/resume; winners include dead friends.
17. Event consumed khác TurnBroken/game termination; CardFinished, phase end, materials và temporary flags cleanup đúng một lần.
18. Serialize/reload ở mọi prompt boundary; reply trùng/trễ/sai actor không đổi state sai; kiểm chứng bằng người chơi thật và bots local/online.

Bổ sung property/state-machine tests cho card conservation, invalid-command rejection, deterministic replay và projection privacy. Native trace là chuẩn mục tiêu; chưa chạy native executable để tạo differential trace tự động, nên không gọi các source-derived fixtures là runtime differential tests.

## 13. Điều kiện xác nhận đã loại bỏ Standard 2013

- Server chỉ đăng ký game Quốc Chiến; client local/online không còn route hoặc setup Identity.
- Không có import/caller runtime tới legacy core/registry/roles; không còn `standard-2013`, Identity `lord-selection`, `roleVariant` hoặc `lordExtraHp` trong gameplay source. Search literals đi kèm graph review, không đủ nếu đứng một mình.
- State/view/protocol không còn thân phận 2013, bonus chủ công hoặc giả định một general. Các lord-general/package Standard hợp lệ của Quốc Chiến được giữ đúng nghĩa.
- Tất cả bài/kỹ năng trong manifest bật có handlers và tests; nội dung chưa port không được selectable.
- `npm run check`, build, E2E local/online/bots/reconnect/privacy pass trên source đã chuyển. Số test xanh của Standard trước đây không được dùng làm bằng chứng cho Quốc Chiến.
- Các ca conformance core bên trên pass; stale prompt và game termination không gây double execution.
- Report/release ghi baseline commit, package scope và deviation cụ thể. Không tuyên bố “100%” cho mọi tổ hợp kỹ năng khi chưa có coverage tương ứng.

## 14. Kết quả hiện tại và quyết định kế tiếp

Đã hoàn thành phân tích core native, đối chiếu engine hiện tại, impact analysis, danh sách retirement, đề xuất interface/pipelines và acceptance matrix. Chỉ thêm tài liệu nghiên cứu; **chưa xóa/sửa gameplay engine, chưa commit/push/PR cho chuyển đổi này**. Primary checkout có thay đổi riêng của người dùng được giữ nguyên.

Baseline 2.3.43-beta2 đã được duyệt. Phần còn cần duyệt là **engine TypeScript Quốc Chiến duy nhất, thay từng lát cắt rồi xóa hoàn toàn Standard 2013 tại cutover**. Sau khi thiết kế được duyệt, viết spec/implementation plan cho milestone đầu tiên; chưa bắt đầu implementation trước gate này theo `.agents/skills/brainstorming/SKILL.md`.
