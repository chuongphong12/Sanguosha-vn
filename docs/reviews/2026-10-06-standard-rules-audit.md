# Đối chiếu luật Tam Quốc Sát cơ bản và source

Ngày: 06-10-2026. Source được kiểm tra: `main` trên GitHub, commit `101c730642cea7b086c60075f234b18f25b34a97`. Đây là audit đọc source và tái hiện lỗi, không phải bản sửa engine.

**Kết luận: chưa implement đúng và chưa cover hết các tình huống.** Có các lỗi tái hiện được làm thay đổi phe thắng, cho phép dùng một lá Thuận Thủ Khiên Dương lấy hai lá, xử lý sai Bát Quái và mất kỹ năng khi di chuyển bài. Test hiện tại chạy thành công nhưng không phát hiện các trường hợp này; một số test còn khẳng định hành vi trái luật.

## Phạm vi và nguồn đối chiếu

README, ARCHITECTURE và `rulesVersion: standard-2013-v2` tuyên bố Tiêu chuẩn 2013. Mốc audit là identity mode, một tướng, bộ cơ bản 108 lá. Không lấy luật Quốc Chiến, Giới Hạn Đột Phá hay Quân Tranh để kết luận game cơ bản thiếu tính năng.

- [Thông cáo Standard 2013 do chính 游卡桌游 phát hành](https://www.prnasia.com/story/79788-1.shtml) khóa phiên bản của Lưu Bị, Hoàng Nguyệt Anh, Điêu Thuyền, Hoa Hùng, Viên Thuật.
- [Trang luật của game do 游卡 vận hành](https://game.qidian.com/Game/showNews/index?name=sgs&nid=1082111) xác nhận identity, phân phối vai trò và mục tiêu thắng.
- [Rules 3.0](https://gltjk.com/sanguosha/rules/) là bản mirror năm 2014 của văn bản do tác giả luật chính thức biên soạn. Dùng quy tắc chung và mục tướng `标`; ghi riêng chỗ có khác biệt phiên bản. Chưa tìm thấy toàn bộ manual Standard 2013 trên domain publisher còn truy cập được.

Danh sách nguồn, rule ID và giới hạn provenance: [Nghiên cứu luật](2026-10-06-rules-primary-sources.md). Các kết luận về luật cần đọc cùng phạm vi nguồn này, đặc biệt policy hòa khi hết bài và phiên bản Hoàng Nguyệt Anh.

## Kiểm chứng và graph

Audit chạy trên checkout riêng của đúng commit trên, giữ nguyên các thay đổi dependency đang có trong workspace chính.

| Kiểm tra | Kết quả và giới hạn |
| --- | --- |
| `npm run check` | Exit 0; 39 file, 234 test pass. Typecheck pass. Lint: 0 lỗi, 41 cảnh báo có sẵn. Vitest có cảnh báo timeout khi dừng worker ở 4 file, dù báo toàn bộ test pass. |
| Inventory | 27 tướng, 43 kỹ năng, 32 định nghĩa/loại bài có mặt trong deck, 108 lá vật lý. 10 skill nằm trong registry; 33 còn lại xử lý ở core/passive. |
| Test theo tên kỹ năng | Có test nhắc đến cả 43 kỹ năng. Đây là inventory, không phải 43/43 kỹ năng đúng hoặc đủ mọi nhánh. |
| Coverage instrumentation | `vitest.config.ts` chỉ cấu hình environment/include; chưa có báo cáo branch/statement coverage hay ngưỡng coverage trong lần audit. Không đưa ra phần trăm coverage giả định. |
| CodeGraph 1.6.0 | Index mới tại đúng commit: 179 file, 1.651 nodes, 6.571 edges; state `complete`, pending refs 0, pending changes 0, worktree mismatch null. Dùng `explore`/`node` để truy vết trước khi đọc chi tiết. |
| GitNexus 1.6.12 | Rebuild đã ghi metadata đúng SHA `101c730…` lúc `2026-10-06T03:28:49.796Z`: 154 file, 2.567 nodes, 9.209 edges, 99 communities, 219 flows. Query ban đầu dùng index cũ hơn 32 commit nên chỉ phục vụ discovery. Pipeline mới báo `truncated: true`: bỏ 78 candidate entry points, chưa trace 96 entry points, bỏ 653 callees và 55 flows, cắt 18 walks vì budget. Không coi flow vắng mặt là implementation vắng mặt. |

Các luồng đã truy vết gồm `drawCards`, `startCardTurn`, `resolveTurnFlow`, `resolveCardGame`, `declareCardUse`, `answerCardPrompt`, `answerAoeSimultaneous`, các trigger LoseHandCard/LoseEquipment và các handler kỹ năng. CodeGraph cho thấy `resumeCardPlayPhase` được gọi qua `TqsGame` và test; `drawCards` có 15 caller ở core, setup và các skill. Việc graph tìm thấy caller/test không chứng minh hiệu ứng đúng luật.

GitNexus còn cảnh báo 5 property read/write sites liên quan `message`/`name` không được nối vì definition ở ngôn ngữ khác. Đây là giới hạn truy vết cần kiểm bằng source, không phải bằng chứng symbol không dùng. Bước khởi tạo chậm được xác minh ở CLI: runtime identity cold hashing trên Windows, không có persistent cache mặc định; heap respawn lặp lại bước này. Không sửa global tool để bỏ kiểm tra.

Hai báo cáo reviewer ghi GitNexus pending tại thời điểm họ kết thúc. Sau đó audit tổng hợp đã xác nhận metadata index mới ở đúng commit nêu trên; giới hạn process truncation vẫn còn nguyên. Không có source runtime được thay đổi trong quá trình này.

Query sau rebuild xác minh `epistemic: exact`, không có stale warning:

`TqsGame` / AI `MOVE_SIMULATORS.answerPrompt` → `answerCardPrompt` (`core:3618–3741`) → `answerAoeSimultaneous` (`core:4016–4110`) → `damageEffect`, `canRespondWithCard`, `startAoeAllySummon` và các hàm di chuyển bài. Context `answerCardPrompt` còn nối tới các nhánh rescue, nullification, duel, Slash và Harvest. Query dùng explicit `--repo C:/Users/Tran.Trong.Nhan/.codex/worktrees/standard-rules-audit/tqs-boardgame`, vì hai worktree có registry entry cùng tên `Sanguosha-vn`. Fresh context xác nhận các call edge đã tìm thấy; cảnh báo thiếu flow vẫn ngăn kết luận tất cả đường đi đều được bao phủ.

## Spec: lỗi luật và hành vi

Các vị trí dưới đây tham chiếu [source cố định tại commit được audit](https://github.com/chuongphong12/Sanguosha-vn/tree/101c730642cea7b086c60075f234b18f25b34a97). Đọc [báo cáo engine](2026-10-06-spec-audit.md) và [báo cáo kỹ năng](2026-10-06-standards-audit.md) để xem thiết lập tái hiện, output và các giới hạn riêng từng kết luận.

### Các lỗi cần ưu tiên trước

| ID / mức | Tình huống và hành vi thực tế | Vị trí / luật |
| --- | --- | --- |
| R01 / P1 | AOE áp dụng damage theo thứ tự trả lời. Nội Gian đánh Vạn Tiễn vào Chủ Công, Trung Thần, Phản Tặc đều còn 1 HP: theo thứ tự mục tiêu Chủ Công chết trước thì Phản Tặc thắng; trả lời Trung Thần → Phản Tặc → Chủ Công lại cho Nội Gian thắng. | `engine/core/index.ts:4024`, `4074`; resolution order, thắng/thua phải kết thúc đúng thời điểm. |
| R02 / P1 | Một lá Thuận Thủ lấy vũ khí của Tôn Thượng Hương, sau đó cho chọn tiếp và lấy thêm một lá tay. Trigger Kiêu Cơ mới được đưa lên đầu stack bị `shift()` nhầm; effect lấy bài cũ còn lại và chạy lần nữa. | `engine/core/index.ts:2984`; một lá Thuận Thủ lấy một lá, mất equipment phải giữ trigger. |
| R03 / P2 | Vạn Tiễn cho người không mặc Bát Quái kích hoạt phán xét Bát Quái; nhánh AOE kiểm tra cờ chung `allowBagua` mà không kiểm equipment từng người. | `engine/core/index.ts:4003`, `4030`; giáp chỉ cấp hiệu ứng cho người sở hữu. |
| R04 / P1 | Khi có giáp, phán xét Bát Quái đỏ thành công trước Sát vẫn yêu cầu Thiểm thêm; bỏ qua làm mất 1 HP. | `engine/core/index.ts:3864`, `1538`; phán xét đỏ đã cung cấp Thiểm. |
| R05 / P2 | Vô Giải trong AOE bị xử lý như hủy riêng cho người trả lời, bỏ lá ngay; không có chuỗi phản Vô Giải và không cho người khác bảo vệ mục tiêu. | `engine/core/index.ts:4057`; hiệu ứng cẩm nang phải có cửa sổ Vô Giải/chuỗi phản Vô Giải theo từng mục tiêu. |

### Các lỗi khác đã xác nhận hoặc có bằng chứng source rõ ràng

| Nhóm | Kết quả |
| --- | --- |
| Thiết Kỵ | Chọn không kích hoạt lại hủy Sát, thay vì tiếp tục yêu cầu Thiểm. Nhánh option chung xử lý trước nhánh riêng Thiết Kỵ (`core:3099`, `3316`). |
| Hàn Băng Kiếm + Lõa Y | Từ chối hiệu ứng Hàn Băng gây 1 damage cố định, mất bonus Lõa Y (`core:3105`). |
| Xà Mâu trong Nam Man | Prompt quảng bá cho phép Xà Mâu nhưng handler AOE từ chối câu trả lời này. |
| Chuyển Sấm | Khi chỉ còn hai người đều có Sấm, Sấm thất bại chuyển vòng lại chính chủ và bị phán xét lại ngay cùng lượt; HP 4 → 1 ở lần phán xét thứ hai. |
| Cẩm nang trì hoãn | Cho Vô Giải ngăn đặt Lạc Bất Tư Thục ngay lúc sử dụng; văn bản quy trình được đối chiếu chỉ mở giải quyết hiệu ứng ở giai đoạn phán xét. |
| Kiêu Cơ / Liên Doanh | Thuận Thủ làm mất equipment có thể mất Kiêu Cơ; Quá Hà bỏ lá tay cuối của Lục Tốn không phát LoseHandCard và không mở Liên Doanh. Đột Tập lấy lá cuối của Lục Tốn cũng bỏ sót trigger. |
| Nhân Đức 2013 | Cho dùng lần thứ hai trong cùng giai đoạn Xuất Bài, trái giới hạn một lần trong thông cáo 2013. Test hiện tại cho phép nhiều lần. |
| Kỳ Tập | Chấp nhận chuyển lá đen thành Thuận Thủ, trong khi luật là Quá Hà. Có test khẳng định cả hành vi sai và test khác khẳng định Quá Hà. |
| Tập Trí 2013 | Engine/test đang dùng rút một lá; chưa implement lựa chọn xử lý lá cơ bản trên đầu deck theo thông cáo phát hành 2013. Cần khóa revision nếu dự án cố ý dùng bản cổ điển. |
| Kỳ Tài 2013 | Có bỏ giới hạn khoảng cách nhưng thiếu bảo vệ trang bị không phải ngựa; người khác vẫn Quá Hà bỏ giáp Hoàng Nguyệt Anh. |
| Khắc Kỷ | Sau khi Lữ Mông đã đánh Sát để đáp Quyết Đấu trong giai đoạn Xuất Bài của mình, vẫn cho bỏ qua bỏ bài. Không theo dõi đủ “sử dụng hoặc đánh ra Sát”. |
| Anh Tư / Thiên Đố | Đang tự động thực hiện, thiếu lựa chọn từ chối của kỹ năng tùy chọn. Báo cáo kỹ năng ghi riêng mức xác minh. |
| Di Kế | Câu trả lời chọn recipient không tồn tại được nhận, xóa lá khỏi hand rồi ném TypeError. Không kiểm membership trong candidate trước khi thực hiện (`damageSkills:151`). |
| UI bỏ bài + Vọng Tôn | Engine dùng `handLimit`, UI dùng HP thuần (`MainScreen:1311`). Tay 4, HP 3, penalty 1: engine yêu cầu bỏ 2, UI hiển thị/cho xác nhận 1; UI vô hiệu hóa xác nhận khi chọn đúng 2. |
| Quay lại Xuất Bài | API và UI cho quay từ giai đoạn Bỏ Bài về Xuất Bài (`core:3754`). Đây là luật nhà/tiện ích quay lại, không phải thứ tự giai đoạn cơ bản; chưa tách mode luật. |

Không nâng lỗi “virtual Slash thất bại nhưng `slashUses` đổi” thành kết luận lỗi trong trận online: probe trực tiếp public helper xác nhận mutation, nhưng move của `TqsGame` trả `INVALID_MOVE`; cần kiểm riêng rollback của boardgame.io. Đây là invariant của helper, không phải bằng chứng state authoritative chắc chắn bị hỏng.

### Policy cần xác nhận theo edition

Theo [quy tắc vùng bài trong mirror Rules 3.0](https://gltjk.com/sanguosha/rules/glossary/zone.html), nếu deck + discard không đủ cho thao tác rút X lá thì kết thúc hòa. `drawCards` hiện rút được bao nhiêu thì rút và trả về im lặng khi hết bài (`rules.ts:22–30`); model cũng chưa có winner hòa. Probe: deck 1, discard 0, yêu cầu 2 → nhận 1, `status=playing`, `winner=null`. Đây là khác biệt đã xác nhận với văn bản đối chiếu; cần xác nhận manual/revision đích trước khi chọn policy sửa.

## Standards: đánh giá riêng

Chi tiết: [Báo cáo Standards và inventory kỹ năng](2026-10-06-standards-audit.md). Các code smell là nhận định thiết kế, tách khỏi vi phạm luật; không coi grep hoặc số dòng là bằng chứng hành vi sai.

- **Possible Duplicated Code:** core và module validators có validator trùng đã lệch luật. Graph xác nhận UI hiện gọi core; validator cũ là rủi ro bảo trì, chưa phải lỗi gameplay đang chạy.
- **Possible Duplicated Code:** fixture gán tướng/kỹ năng lặp giữa các file test. Chỉ cân nhắc gom khi sửa test liên quan, không gộp cleanup vào patch lỗi khẩn cấp.
- **Possible Mysterious Name:** `SkillDefinition` được dùng cho cả metadata và executable handler; dễ nhầm “có tên trong catalogue” với “đã có xử lý runtime”.
- **Tài liệu conformance chưa có bằng chứng:** `SKILL_CONFORMANCE.md` đánh dấu toàn bộ 43 kỹ năng “Conforms” và gọi QSanguosha là chuẩn chính thức, nhưng không có citation/edition hay ma trận tình huống. Kết quả audit hiện tại bác bỏ trạng thái all-green này.
- **Nội dung UI sai:** mô tả Quốc Sắc/Khiêm Tốn trong catalogue không khớp hành vi engine đúng. Những chỗ này cần sửa nội dung, không đổi engine theo mô tả sai.

## Ma trận bao phủ luật

“Có” bên dưới chỉ nghĩa là đã tìm thấy implementation và/hoặc kiểm tra tương ứng. Không phải chứng nhận mọi tổ hợp tương tác.

| Nhóm luật | Implementation/test hiện có | Kết luận audit |
| --- | --- | --- |
| Identity 4–10 người, thắng phe, bonus HP Chủ Công | Role catalogue, setup, determineWinner; test nền tảng | Có nền tảng; AOE order có thể đổi kết quả thắng. |
| 6 giai đoạn, rút thường, giới hạn tay | Phase flow, handLimit, tests | Có; resume discard→play là ngoại lệ, UI thiếu WangZun. |
| Khoảng cách, ngựa, vũ khí, bỏ ghế chết | Helpers và tests | Có; chưa chứng minh mọi trường hợp trả cost mất ngựa/vũ khí rồi kiểm lại tầm. |
| Sát, Thiểm, Đào | Card engine, response tests | Có; Bagua/TieJi branch sai. |
| Trick đơn mục tiêu | Effects/tests | Có; một Snatch lấy hai lá và mất loss triggers. |
| AOE nhiều người | Simultaneous handler/tests | Sai thứ tự, counterchain, điều kiện armor, Spear. |
| Delayed tricks/phán xét | Reverse insertion order có trong source; tests | Reverse order có; Lightning self-loop và cửa sổ Wuxie cần sửa. Chưa exhaust tất cả GuiCai/TianDu kết hợp. |
| Damage vs HP loss, dying | Effect types/rescue tests | Có; probe HP −2 cần ba Peach của cùng rescuer đã pass. Thứ tự/nested interrupt vẫn cần tăng coverage. |
| Death/reward/penalty | killPlayer, determineWinner và tests | Có; chưa chứng minh toàn bộ chuỗi chết giữa AOE/Halberd và termination đúng mọi trigger. |
| 27 tướng / 43 kỹ năng | Tất cả có tên trong code/test | Chưa đủ đúng luật; lỗi cụ thể ở ít nhất RenDe, JiZhi, QiCai, QiXi, KeJi, TuXi, LianYing, XiaoJi, YiJi và lựa chọn tùy ý. |
| Hidden information | Player view và tests | Có lọc; không chứng nhận mọi prompt/effect/event stream theo mọi kỹ năng. |
| Deck exhaustion/reshuffle | Reshuffle khi deck rỗng | Rút thiếu im lặng; hòa/replenish trước thao tác lớn chưa khớp văn bản được đối chiếu. |
| Inputs không hợp lệ | Guard ở moves/prompts | DiKế có crash; thiếu kiểm chứng đầy đủ candidate, duplicate IDs, stale prompt, dead player. |
| UI/bot/online sử dụng được mọi nhánh | Integration và E2E riêng | Suite 234 test không bao gồm E2E. Không có chứng minh toàn bộ luật chơi được qua UI/bot/online. |

## Backlog kiểm thử và sửa theo ưu tiên

1. Regression tests cho đổi phe thắng bởi arrival order, một Snatch lấy hai lá, Bagua sở hữu/kết quả, AOE Wuxie/counterchain/Spear. Sau đó sửa cơ chế giải quyết effect theo thứ tự và effect ID.
2. Chuẩn hóa sự kiện mất hand/equipment và cách giữ nested trigger; test loss bởi Dismantle, Snatch, TuXi, transfer, conversion, thay equipment và death penalty.
3. Khóa revision Tiêu chuẩn 2013 bằng tài liệu nguồn; sửa test kỳ vọng sai của RenDe/QiXi/JiZhi; implement QiCai đúng revision, KeJi và optionality.
4. Dùng handLimit chung trên UI/bot/engine; phân biệt mode luật nhà cho resumePlay; validate mọi prompt answer trước mutation.
5. Thêm matrix theo rule ID và tình huống: negative HP/multiple Peach, dying lồng nhau, damage source chết, game kết thúc giữa nhiều mục tiêu, phán xét kép, mất vũ khí/ngựa làm cost, deck gần cạn, duplicate zone cards, stale prompt và role visibility. Đo branch coverage để tìm nhánh chưa chạy; vẫn cần assertion theo luật vì coverage cao không chứng minh đúng luật.

Không có cam kết “cover mọi trường hợp” từ lần audit này. Kết quả đủ để bác bỏ tuyên bố implementation hoàn chỉnh và xác định các regression cần làm trước; những nhóm chưa kiểm hết đã được ghi rõ thay vì mặc định pass.

## Probe bổ sung của audit tổng hợp

Hai probe không thay đổi runtime; dùng fixture có sẵn ở checkout commit được audit. Có thể đặt trong `.references/root-rules-probe.ts` và chạy `node_modules/.bin/tsx .references/root-rules-probe.ts`.

```ts
import { createStartedGame, resetHands, identityShuffle } from "../tests/helpers/game";
import { drawCards, handLimit } from "../src/game/rules";
const G = createStartedGame();
resetHands(G);
const onlyDraw = G.deck.pop()!;
G.players["1"].hand.push(...G.deck);
G.deck = [onlyDraw];
drawCards(G, "0", 2, identityShuffle);
console.log({status:G.status,winner:G.winner,received:G.players["0"].hand.length});
// Actual: playing, null, 1. Rules 3.0 policy would end in a draw.
G.turn.activePlayerID = G.lordID;
G.turn.wangZunHandLimitPenalty = 1;
G.players[G.lordID].hp = 3;
G.players[G.lordID].hand = G.players["1"].hand.splice(0,4);
console.log({
  engineRequired:G.players[G.lordID].hand.length-handLimit(G,G.lordID),
  uiRequired:G.players[G.lordID].hand.length-Math.max(0,G.players[G.lordID].hp),
});
// Actual: engineRequired 2, uiRequired 1. UI formula is MainScreen:1311.
```
