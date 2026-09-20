# Phản biện Astra — UI Tam Quốc Sát, đầu vào cho v3

Ngày 16/09/2026. Phạm vi: kế hoạch v2, mock trong thư mục này, mã UI hiện tại và mẫu tài nguyên từ ba kho anh em. **Đây là đánh giá thiết kế và đề xuất; chưa phải kết quả chạy game hay kiểm thử người dùng.** Nghiên cứu internet được tổng hợp riêng ở bản v3. Lệnh GitNexus `query` đã thử nhưng runner báo thiếu `gitnexus`; không có kết luận về độ bao phủ call graph và không sửa mã ứng dụng.

## 1. Quyết định mỹ thuật: Trận đồ dưới chiến kỳ

Chọn cảm giác **võ tướng đang đối trận dưới chiến kỳ**, với chân dung có sức nặng, mặt trận sâu trong sương và quân lệnh hiện rõ ở thời điểm ra quyết định. Bỏ ellipse vàng bao bàn và bỏ đại ấn luôn chiếm trung tâm. Con dấu dùng khi khai chiến/kết quả; trung tâm thuộc về lá đang phân giải. Giữ khung đồng mảnh ở các cạnh có chức năng; mặt gỗ chỉ ở bệ tay bài. Chồng chiến trường, bàn gỗ, ellipse, đại ấn, bát quái và dải lụa cùng lúc sẽ tạo một bàn nghi lễ chung chung.

Ba hướng đã cân nhắc: “bàn gỗ cổ” dễ đọc nhưng tiếp tục cảm giác bàn quân nghị; “poster điện ảnh toàn màn hình” mạnh ở lobby nhưng phá mật độ thông tin; “trận đồ dưới chiến kỳ” giữ sân khấu chiến đấu và đủ chỗ cho mười người. Chọn hướng thứ ba. Rủi ro mỹ thuật có chủ đích là **chiến kỳ bất đối xứng gắn vào chân dung người đang hành động**, thay cho vòng sáng chung quanh mọi thứ. Chiến kỳ chỉ mã hóa người có lượt; không ngầm tiết lộ thân phận.

Hệ vật liệu đề xuất: mực than `#15191C` cho lớp đọc; đồng già `#A68248` cho nẹp; giấy ngà `#E9DFC6` cho chữ/lá; sơn son `#9F302B` cho lệnh quan trọng; ngọc `#57977E` cho hồi phục; thép lam `#788FA5` cho thông tin phụ. Phe vẫn có biểu tượng và tên riêng. Màu hành động, phe, thân phận không tranh cùng một viền.

Noto Serif 700 dành cho tên tướng, tiêu đề và nhãn sự kiện; Segoe UI/system sans cho prompt, kỹ năng, bộ đếm. Đề xuất chữ thân 14–16 CSS px, tên ghế 14 px, metadata phụ 12 px; không co chữ dài xuống vô hạn. Tên dài hai dòng hoặc rút gọn có inspector. Chữ Hán chỉ làm họa tiết nếu có tài nguyên/font phù hợp; mọi thông tin bắt buộc phải đọc được bằng tiếng Việt. Hiện `typography.css` chỉ khai báo subset Latin/Vietnamese trong khi `PlayerAvatar.ts` dùng “阵亡”, nên không thể coi font Hán đã sẵn sàng.[1]

## 2. Bằng chứng buộc phải sửa cách diễn đạt của v2

| Nhận định trong v2/mock | Kết luận từ nguồn đã đọc |
|---|---|
| Mock thể hiện bố cục 8–10 người | `layout()` trong `index.html` chia toàn bộ ghế sang hai bên. Với 10 người, bên trái có năm ghế tại 11/29/47/65/83%, mỗi ghế cao 17%; dashboard bắt đầu ở 75%. Hai ghế cuối chồng vùng thao tác. Với 8 người đã có bốn ghế một bên. Đây là minh họa vật liệu, chưa là chứng minh bố cục.[2] |
| “17/12/13 file UI-code” mô tả độ rộng source | Script đếm phần mở rộng qml/ui/qss/html/ts/tsx/js/css, bỏ `.cpp/.h`, và không phân loại trách nhiệm UI. Không được dùng số này để đánh giá lượng mã Qt hoặc nói đã audit toàn client.[3] |
| LangKhach là source để học kiến trúc Qt | Thư mục đọc được là phân phối Windows có `.exe`, DLL, Lua, skin, tài nguyên; không có cây `src` C++. Dùng làm bằng chứng tài nguyên, không suy diễn kiến trúc từ đó. Qt interaction được đối chiếu ở kho QSanguosha.[4] |
| `EventBus` đã có nền tảng event presentation | File này đưa các skill trigger vào `effectStack`, dùng `context: any`; đây không phải lịch sử trình diễn đầy đủ. `createPlayerView` trả `effectStack: []`. Không thể chỉ nối một listener rồi có damage/reveal/cards-moved hoàn chỉnh.[5] |
| View đã lọc dữ liệu bí mật | Hand/role/candidates có lọc; nhưng `log` và `cards` được sao chép. Chưa chứng minh toàn bộ gói dữ liệu an toàn. Cần audit producer và correlation của ID, không kết luận riêng `cards` đang làm lộ bài.[5] |
| P0 đã xác định lỗi runtime hiện tại | Mã `fill: [0xd4af37, 0xaa801a]` vẫn tồn tại. Báo cáo này xác nhận cấu hình nghi vấn, chưa tái hiện exception trên browser. V3 phải dẫn chứng runtime riêng nếu gọi nó là lỗi đã tái hiện.[1] |

`MainScreen` thực sự scale theo chiều cao tối thiểu 860, `render()` gọi `clearContent()`, và `clearContent()` destroy children. `Dashboard` thực sự cao 240 với avatar và role card 180×224. Đây là bằng chứng đủ để ưu tiên ownership và layout mới; “có leak” vẫn là nguy cơ, chưa phải kết quả profiler.[6]

QSanguosha đáng học ở mô hình chọn lá → hiện đích hợp lệ, kéo dùng lá và sort; README cũng nêu shortcut/multilayer. `3qs` đáng học ở nhãn hành động và sự phân biệt kỹ năng chủ động, nhưng không lấy nguyên layout flex-wrap tay bài. Log đầu ván chứa role trong `room.ts`, còn server gửi 40 dòng log cuối; chính là ví dụ phải lọc cả đường dữ liệu ngoài chân dung.[4][7]

## 3. Chứng minh hình học 1366×768, mười ghế

Đây là **tọa độ đề xuất theo CSS viewport**, chưa phải ảnh chạy thật. 1366×768 nghĩa là diện tích trang game, không phải độ phân giải màn hình bao gồm thanh trình duyệt. Cần thêm lượt kiểm tra viewport 1366×640 cho laptop cửa sổ thường.

| Vùng | x, y | w × h | Ràng buộc |
|---|---:|---|
| Header | 0, 0 | 1366 × 48 | Phòng, phase, kết nối; không có mô tả dài |
| Ba ghế trái | 16, 68 / 212 / 356 | 196 × 124 mỗi ghế | Ghế cuối kết thúc y=480 |
| Ba ghế phải | 1154, 68 / 212 / 356 | 196 × 124 mỗi ghế | Mép phải 1350, còn 16 px |
| Ba ghế trên | 377 / 585 / 793, 60 | 196 × 124 mỗi ghế | Khoảng cách 12 px; không đụng cột bên |
| Sân phân giải | 228, 208 | 910 × 284 | Card stack, đường đích, judgement |
| Prompt cố định | 16, 500 | 1334 × 52 | Text trái, hành động phải |
| Cụm bản thân | 16, 560 | 216 × 192 | Chân dung, HP, role peek, trang bị |
| Tay bài | 244, 560 | 850 × 192 | Cuộn cục bộ theo chiều ngang |
| Kỹ năng/tiện ích | 1110, 560 | 240 × 192 | Tên kỹ năng, trạng thái, nút nhật ký |

Tổng số = chín ghế đối phương + bản thân. Giữ thứ tự vòng theo seat order thực tế; không đổi chỗ khi chết, đổi lượt hoặc bị chọn. Một đường nối mảnh theo vòng chỉ hiện khi xem khoảng cách; vị trí màn hình không được diễn giải là khoảng cách luật. Với 4–9 người dùng cấu hình neo riêng nhưng giữ cùng thứ tự, không giãn thành ellipse tùy ý.

Ghế 196×124 dùng crop chân dung 72×88 bên trái, hai dòng tên/HP/hand count bên phải, dải 24 px dưới cho trang bị và delayed trick. Icon nhỏ là thông tin, toàn ghế hoặc nút inspector 44×44 mới là vùng chạm. Active turn dùng chiến kỳ, target hợp lệ dùng dấu góc trắng + nhãn, selected target thêm số thứ tự; disabled có lý do khi inspect. Chân dung chết vẫn đọc được tên, trạng thái và role công khai.

Tay bài: lá 96×136, bước x=80. Mười lá chiếm `96 + 9×80 = 816 px`, vừa 850 px. Hai mươi lá chiếm 1616 px và cuộn trong vùng này. Phần lộ 80 px vượt tiêu chí chạm 44 px. Nhãn card dài được viết hai dòng trong khoảng 80 px lộ ra; lá focus nổi lên để xem toàn bộ. Không dùng hai hàng mặc định: hai lá cao 136 px không thể vừa dashboard 192 px cùng nhãn và khoảng nâng. “Multilayer” chỉ được chọn nếu có thiết kế chồng hàng chứng minh metadata vẫn truy cập được; cuộn ngang là phương án mặc định có thể kiểm chứng ngay.

Inspector nằm trong sân trung tâm, tối đa khoảng 420×284 ở bản 1366; nội dung dài cuộn riêng. Không trượt một drawer đè mất cột ghế phải. Khi prompt cần đọc mô tả dài, sân trung tâm cấp thêm panel; action row và thời hạn vẫn hiện. Trên tablet 1024×768 phải **reflow**, không scale cả layout: giảm bề ngang ghế, đưa mô tả kỹ năng vào inspector, giữ card/action touch target. Cần bản tọa độ và ảnh tablet riêng mới gọi là đạt.

## 4. Screen phải gắn trách nhiệm và đường quay lại

| Screen | Trách nhiệm duy nhất | Chuyển cảnh/điều kiện |
|---|---|---|
| Boot | Tải shell tối thiểu, thông báo lỗi có thử lại | Logo + tài nguyên trọng yếu; không tải toàn skin trước lobby |
| Lobby | Vào trận mong muốn | Danh sách phòng, tạo/join, offline; settings/library là overlay DOM |
| Room | Xác nhận cấu hình và người ngồi | Ready, host, bot, rule pack, trạng thái khóa; chủ phòng rời cần hành vi rõ |
| General Select | Chọn tướng từ thông tin viewer được phép thấy | Gồm substate chọn Chủ Công và những người còn lại; reconnect có thể vào trực tiếp |
| Match | Ra quyết định trong trận hiện tại | BattleView sống ổn định; chờ người khác vẫn cho đọc inspector |
| Result | Hiểu kết quả và quyết định chơi tiếp | Winner từ engine; rematch chỉ hiện hoạt động khi server hỗ trợ |

`MatchSession` giữ kết nối/snapshot/credentials/round; `ScreenCoordinator` chọn scene theo authoritative status; adapter tạo view model và interaction state; `BattlePresentation` chỉ trình diễn. Không đặt luật chọn đích vào animation. Kế hoạch phải phân biệt **đang có**, **cần frontend mới**, **cần protocol/server mới** cho ready/rematch/reconnect/deadline; mock không chứng minh các năng lực này đã tồn tại.

Overlay ưu tiên: HotseatHandoff che toàn bộ dữ liệu riêng; prompt đang chờ phản hồi cao hơn inspector và cinematic; reconnect khóa gửi lệnh nhưng giữ bàn với nhãn dữ liệu cũ; settings không xóa prompt. Đóng overlay trả focus về control trước đó. Chuyển hotseat phải hủy tooltip, role peek, card preview và voice riêng trước khi người kế tiếp xác nhận. Chưa có hành động xác nhận thì màn hình vẫn che.

Lobby→Room 200–300 ms; lựa chọn tướng→seat 350–500 ms nếu có chung art/anchor. Khi vào trực tiếp sau reconnect, dùng fade ngắn; không giả vờ chạy lại quy trình. Intro 800–1200 ms chỉ một lần mỗi round. Prompt mới đến phải hiện ngay và cắt intro nếu cần; Skip chỉ bỏ animation, không gửi nước đi.

## 5. Ngữ pháp combat phải đúng nguyên nhân và kết quả

Thay ví dụ “Sát → Né → damage” bằng hai fixture: **Sát → Né thành công → không mất HP** và **Sát → không Né/không đủ Né → damage confirmed**. Thêm fixture cần nhiều Né nếu luật hiện tại hỗ trợ. “Một Né đã xuất hiện” không tự khẳng định đòn đánh bị hóa giải.

| Sự kiện | Trình diễn đề xuất | Điều không được suy diễn |
|---|---|---|
| Card committed | Lá ra vùng xử lý 160–240 ms; đánh dấu nguồn/đích | Click/drag chưa được chấp nhận không tạo đòn trúng |
| Chờ response | Đường mảnh giữ lại, prompt nói ai cần làm gì | Không cho slash impact chạy trong lúc còn cứu được |
| Né thành công | Nét gạt lam nhạt + “Đã né”, đường tấn công tắt | Không trừ HP bằng hiệu ứng |
| Damage confirmed | Vết chém/lửa/sét tại đích 200–320 ms; số lượng damage | Không luôn hiển thị “−1”; tách lượng damage và biến động HP nếu luật khác nhau |
| Mất HP trực tiếp | Pips giảm + “Mất thể lực” | Không vẽ kẻ tấn công hay giáp đỡ |
| Đào/hồi phục | Vòng ngọc nhỏ + lượng hồi thực tế | Không hiện +HP chỉ vì card đã ra |
| Vô Giải | Nút thắt trên đường hiệu lực, cập nhật trạng thái vô hiệu/khôi phục | Không dùng shield khiến mọi người hiểu là chặn damage vĩnh viễn |
| AoE/Duel | Liên kết theo từng bước phân giải, nhấn người đang trả lời | Không nổ đồng loạt trước khi biết từng kết quả |
| Judgement | Lá công khai ở sân giữa, nhãn điều kiện/kết quả | Không mặc định đỏ=thành công với mọi phán xét |
| Skill | Tên kỹ năng và nguồn; cost/convert preview trước xác nhận | Passive được kích hoạt không phải luôn có nút bấm |
| Death/reveal | Đóng dấu “Tử trận”, role công khai chỉ theo dữ liệu được cấp | HP≤0/hấp hối không phải death; người chết bất kỳ có thể cần reveal, không chỉ ghế local |
| End | Kết quả authoritative, reveal hợp lệ, bảng thắng/thua | Không tự suy thắng từ hình ảnh người vừa ngã; không bắt chín role lật nối tiếp |

Cut-in 500–800 ms chỉ một lớp; ưu tiên art đủ nét và kỹ năng đặc biệt có danh sách rõ. Dying là trạng thái kéo dài theo cứu viện, không phải clip 600 ms. Reveal công khai cập nhật badge ngay, animation chạy phụ; reconnect dựng trạng thái tĩnh. End có thể có nhiều người thắng và kết quả khác nhau cho từng viewer; tiêu đề kết quả phải theo winner model đã xác nhận.

Interface nhỏ của v2 hợp lý nhưng `kind` union + `payload: unknown` **không phải discriminated union có payload typed**. Mỗi kind cần payload riêng: ID nguồn/đích, card identity được phép thấy hoặc back/count, amount/nature, correlation/parent ID, outcome, viewer visibility. Protocol cần định nghĩa version snapshot, sequence gap, cursor khi reconnect, round đổi và retention. Không phát lại thông tin riêng bằng event lịch sử cho viewer mới.

Queue có thể rút ngắn đường bay/cut-in; không được bỏ kết quả có ý nghĩa như death/reveal hoặc để stale response đè prompt hiện tại. `sync(snapshot)` phải đưa UI đến hiện tại kể cả không có event backlog. Cần quy tắc preempt, cancellation khi dispose/resize và snapshot đi trước animation. Audio cũng đi theo event đã lọc; hủy hàng voice của round cũ khi rời trận.

## 6. Giới hạn tài nguyên và cổng triển khai

Inventory cho biết battlefield LangKhach/3qs là **960×540**, `battle.png` **990×239**, nút confirm **100×36**. Hai kho chia sẻ hash các file này. Battlefield có thể làm lớp nền mờ chủ động; không phải nguồn cảnh full-screen sắc nét ở DPR2. `battle.png` là banner rất rộng, không phải ảnh dọc để cover toàn màn hình. Nút 36 px cao không đạt target 44 px chỉ bằng việc dùng nguyên sprite; tách frame/text và mở rộng hit area, rồi kiểm tra gap thật.[3]

Master 512×716 cho card 240×336 CSS ở DPR2 là chuẩn đề xuất hợp lý về số pixel, không bảo đảm art đẹp. Portrait 250×292 không đủ cho cut-in nửa màn hình. Cần crop anchor theo mặt, safe zone chữ, kiểm alpha/viền đen ở blending, glyph tiếng Việt và tên dài. Chỉ lập atlas sau khi chốt pivot/frame order/scale. Không có skeleton trong mẫu tài nguyên không đồng nghĩa project thiếu runtime: package hiện đã khai báo Spine; quyết định giữ hoặc bỏ runtime nằm ngoài bằng chứng về ảnh.[8]

README `3qs` khai báo điều kiện art/audio/font và LICENSE LangKhach có MCFR; đây là **tuyên bố trong từng kho**, không phải xác minh quyền của mọi file giống hash. Registry ghi nguồn gốc, kích thước, hash, phạm vi dùng dự kiến và trạng thái quyền; chỗ chưa rõ phải ghi chưa xác minh. Không viết “nội bộ/moodboard thì mặc nhiên được phép” như một kết luận pháp lý.[7][9]

Thứ tự v2 đang ngược: P1 muốn combat slice trước khi P4 tạo event đủ tin cậy. Accessibility, quyền asset và ngân sách GPU cũng quá muộn nếu để hết vào P6. Đề nghị các cổng sau:

1. **Bằng chứng chạy:** tái hiện/sửa runtime blocker, chụp baseline thật, ghi viewport/DPR/browser; tách mock khỏi screenshot ứng dụng.
2. **Khả thi bố cục + art:** fixture mười ghế, 20 lá, tên dài, đủ trang bị/delayed trick, prompt nhiều lựa chọn. Xuất ảnh idle/target/response/inspector ở 1366×768; duyệt bản sắc ở kích thước thật trước skin toàn bộ.
3. **Session + privacy + event contract:** ownership ổn định, viewer filtering, reconnect/round cursor, typed payload tối thiểu. Đủ hai nhánh Sát ở trên trước combat polish.
4. **Bàn hoàn chỉnh và screen shell:** prompt taxonomy, drag/click/keyboard/touch chung selection model, lỗi server/timeout, chuyển màn và hotseat. Không phát hành nếu còn prompt không trả lời được.
5. **Vật liệu và motion:** mở rộng atlas/audio/skill/judgement/reveal/result trên event đã xác nhận; art thiếu có fallback tiếng Việt đọc được.
6. **Cổng phát hành:** đầy đủ luồng 4–10 người, tablet ngang, mất mạng giữa prompt, mute/reduced motion, lặp vào/rời, kiểm quyền asset đã chọn. Hiệu năng đo trên cấu hình máy công bố: ghi p95 frame time, long stalls, renderer texture memory và bộ đếm listener/ticker sau warm-up; “60fps” đơn lẻ chưa đủ.

Ước lượng 25–41 ngày trong v2 chưa có độ tin cậy vì chưa đo khối lượng prompt migration/protocol/art. Giữ dưới dạng dải sơ bộ có giả định; ước lượng lại sau cổng 2–3. Milestone đầu tiên phải chơi trọn một trận có đọc trạng thái và phản hồi combat cơ bản; cinematic có thể thêm sau, nhưng không thể lấy ảnh nền đẹp thay cho khả năng chơi.

## Nguồn cục bộ

[1] [typography.ts](../../../src/app/ui/typography.ts), [typography.css](../../../src/app/ui/typography.css), [PlayerAvatar.ts](../../../src/app/ui/PlayerAvatar.ts).

[2] [Mock index.html](index.html), đặc biệt CSS `.seat/.dash` và `layout()`; [revised-board.png](revised-board.png) là ảnh mock đã xem, không phải ảnh runtime game.

[3] [Inventory](three-source-inventory.json), [script audit](audit-three-sources.cjs), [moodboard đã xem](three-source-moodboard.png). Số lượng là dữ liệu lưu trước đó, không được tái đếm toàn bộ trong lượt review này.

[4] `../QSanguosha/README.markdown`; `../QSanguosha/src/ui/roomscene.cpp` khoảng 1057–1096; `../QSanguosha/src/ui/dashboard.cpp` khoảng 755; `../QSanguosha/sanguosha.qss`; danh sách gốc `../QSanguosha-LangKhach-QuocChien`.

[5] [player-view.ts](../../../src/game/player-view.ts), [EventBus.ts](../../../src/game/engine/EventBus.ts).

[6] [MainScreen.ts](../../../src/app/screens/main/MainScreen.ts) dòng 66, 249–252, 363–372, 2703–2705; [Dashboard.ts](../../../src/app/ui/Dashboard.ts); [SeatView.ts](../../../src/app/ui/SeatView.ts); [CardView.ts](../../../src/app/ui/CardView.ts).

[7] `../3qs/webport/public/index.html`; `../3qs/webport/src/room.ts` khoảng 139; `../3qs/webport/src/server.ts` khoảng 549; `../3qs/README.md` dòng 34–35.

[8] [package.json](../../../package.json). Đã có Pixi, Motion, @pixi/sound, AssetPack, Spine runtime; không cần suy từ ảnh để kết luận dependency.

[9] `../QSanguosha-LangKhach-QuocChien/LICENSE`. Mọi đường dẫn bắt đầu `../QSanguosha` hoặc `../3qs` ở trên được tính từ root repository.


---

> **Trạng thái lịch sử:** các đề xuất hữu ích đã được hợp nhất và đối chiếu lại trong [UI upgrade v4 Gemini handoff](../2026-09-20-gitnexus-plan-ui-upgrade-handoff.md). Không dùng file này để suy ra tình trạng source hiện tại.
