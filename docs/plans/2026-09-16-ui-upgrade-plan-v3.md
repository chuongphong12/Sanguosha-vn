# Kế hoạch nâng cấp UI toàn diện — v3, sau phản biện Astra

Ngày 16/09/2026 · PC/laptop trước, tablet ngang sau · Trạng thái: đặc tả thiết kế và kế hoạch triển khai, chưa triển khai vào game.

Bổ sung: [Chỉ đạo thiết kế và kiểm trực tiếp 13 mẫu ảnh tham khảo](ui-upgrade/game-ui-art-brief.md) — quyết định giữ/xử lý/vẽ mới, storyboard và phân việc theo nhóm.

Bản này thay thế v2. Đầu vào gồm mã hiện tại, ba kho tham khảo, [phản biện độc lập bằng model gpt-6-astra](ui-upgrade/astra-design-review.md) và [nghiên cứu internet có ảnh, nguồn và niên đại](ui-upgrade/internet-design-research.md). [Trang xem dẫn chứng và sơ đồ bố cục](ui-upgrade/review-v3.html) đi kèm. Các số đo bố cục dưới đây là đề xuất; kết quả chạy game, kiểm thử người dùng và profiling phải được ghi riêng khi triển khai.

## 1. Quyết định thiết kế

Tôi chọn hướng **Trận đồ dưới chiến kỳ**: người chơi đối diện những võ tướng có chân dung và thẻ lệnh rõ nét; sau họ là chiến địa chìm trong sương, cờ và ánh lửa ở rìa. Người có lượt được nhận diện bằng chiến kỳ cạnh chân dung. Trung tâm dành cho lá vừa ra, mục tiêu và kết quả phân giải.

Tam Quốc phải hiện ở tướng, phục sức, tranh chiến trận, khung sơn then, nẹp đồng và giấy bài. Bỏ ellipse vàng và đại ấn thường trực của mock trước. Con dấu chỉ xuất hiện ở khoảnh khắc khai chiến, tử trận và kết quả. Gỗ nằm ở bệ tay bài; không phủ đồng thời cả màn bằng chiến trường, bàn gỗ, bát quái và lụa trang trí.

Ảnh trận đấu chính thức cho thấy chân dung chữ nhật, cờ tên/phe và dấu tử trận bám ghế là điểm nhận diện mạnh. Bản v3 học cách phân cấp ấy; tọa độ mười người được thiết kế riêng. [Tam Quốc Sát, ảnh sự kiện 2019](https://www.sanguosha.com/news/20191219_8089_5016).

Ba lựa chọn đã cân nhắc:

| Hướng | Điểm mạnh | Quyết định |
|---|---|---|
| Bàn gỗ cổ, quân nghị | Dễ tổ chức thông tin | Loại làm chủ đề chính: gần hướng người dùng đã chê |
| Poster tướng toàn màn, điện ảnh | Ấn tượng mạnh | Dùng ở Lobby/General Select, tiết chế trong Match |
| Trận đồ dưới chiến kỳ | Tướng nổi bật, chiến địa có chiều sâu, vẫn giữ mật độ bàn | Chọn làm ngôn ngữ xuyên suốt |

Điều kiện duyệt mỹ thuật: khi bỏ logo, người xem vẫn liên tưởng đến Tam Quốc qua tướng và vật liệu; khi làm mờ art nền, vẫn nhận ra người có lượt, lá chọn và yêu cầu hồi đáp. Đây là bài kiểm tra thiết kế đề xuất, chưa phải kết quả khảo sát.

## 2. Dẫn chứng và phần cần sửa trong kế hoạch cũ

| Nguồn | Vai trò thực tế | Học và chuyển hóa |
|---|---|---|
| `../QSanguosha` | Có C++/Qt, `src/ui`, tài nguyên và skin | `dashboard.cpp::sortCards` có sắp theo loại/chất/số; `roomscene.cpp::doAnimation` phân loại hiệu ứng. Học tương tác, anchor và phân loại, không port Qt |
| `../QSanguosha-LangKhach-QuocChien` | Bản phân phối Windows trong thư mục khảo sát, không có cây C++ `src` | Học hệ frame, trạng thái nút, kho avatar/skin và backdrop; không gọi đây là audit C++ |
| `../3qs` | Web UI HTML/CSS/TS cùng server | Học prompt, chọn tướng và thư viện; kiểm đường dữ liệu riêng tư trước khi tham khảo logic |
| Internet chính thức | Ảnh Room/Match Tam Quốc Sát, gallery GWENT, bài VFX và cập nhật chữ lá Hearthstone | Bổ sung phân cấp thị giác, ngữ nghĩa motion và khả năng đọc, không thêm luật của game khác |

Đường dẫn `../...` trong bảng được tính từ root project. Dẫn chứng dòng/file chi tiết ở báo cáo Astra; số liệu ảnh ở [inventory](ui-upgrade/three-source-inventory.json).

Các đính chính bắt buộc:

- Mock [index.html](ui-upgrade/index.html) cũ có ghế chồng dashboard ở 8–10 người; `revised-board.png` là ảnh mock, không phải game hiện tại. Không dùng làm chứng nhận responsive.
- Các số “17/12/13 file UI-code” không hợp lệ để mô tả phạm vi audit: script bỏ phần mở rộng `.cpp/.h`. Không dùng lại.
- Số ảnh đã lưu: QSanguosha 2.053; LangKhach 4.148; 3qs 2.939. Đây là kiểm kê trước lượt refine này, không phải số asset mới hay số màn hình.
- Lọc riêng `raw-assets/` từ inventory: 2.014 file, 122.207.352 byte, 1.842 hash khác nhau. Có 1.125 file trùng 3qs (1.013 hash), 1.127 trùng LangKhach (1.015 hash), 1.601 trùng QSanguosha (1.441 hash). Không cộng ba nhóm: chúng giao nhau. Kho LangKhach và 3qs còn chia sẻ 2.646 hash ảnh.
- `typography.ts` vẫn có `fill: [0xd4af37, 0xaa801a]`; lượt này xác nhận mã nghi vấn, chưa chạy lại browser để tái hiện exception. P0 phải đo baseline mới.
- `player-view.ts` lọc hand/role/candidates nhưng copy `log` và `cards`. Chưa đủ bằng chứng gọi toàn bộ projection an toàn; cũng không kết luận riêng catalog `cards` làm lộ bài khi chưa truy ID/producers.
- `effectStack: []` bảo vệ phần xử lý nội bộ. Không gỡ bộ lọc này để làm animation. EventBus hiện phục vụ trigger kỹ năng, chưa phải dòng sự kiện trình diễn đầy đủ.

## 3. Hệ mỹ thuật và component

| Thành phần | Đặc tả đề xuất |
|---|---|
| Nền | Chiến địa xám khói; vật thể rõ ở rìa, vùng giữa ít tương phản; một nền thống nhất cho v1 |
| Khung | Sơn then với nẹp đồng già; góc có hoa văn mây nhỏ, không viền vàng phát sáng ở mọi panel |
| Tướng | Chân dung crop theo mặt, cờ tên/phe gắn khung; dùng một họ tranh đồng nhất, tránh trộn chibi và tranh hiện thực |
| Lá bài | Giấy sáng, art mực, tên/chất/số cùng vị trí; phần luật dài chuyển Inspector |
| Chiến kỳ có lượt | Cờ nhỏ bất đối xứng ở ghế, nhãn “Đang hành động”; không mã hóa role chưa biết |
| Role | Huy hiệu riêng: chưa biết / riêng của mình / công khai; không dùng màu phe làm thân phận |
| Điều khiển | Nút có default, hover, pressed, focus, disabled, pending; nhãn hành động tiếng Việt rõ |

Token nền `#15191C`, đồng `#A68248`, giấy `#E9DFC6`, son `#9F302B`, ngọc `#57977E`, thép lam `#788FA5`. Đây là bảng hướng dẫn ban đầu; phải đo tương phản sau khi ghép texture. Màu phe nằm ở cờ phe; màu hành động nằm ở dấu chọn/nhãn, không tranh cùng một viền.

Noto Serif 700 cho tên tướng, tiêu đề và khoảnh khắc lớn; Segoe UI/system sans cho prompt, luật và bộ đếm. Chữ chính 14–16 CSS px; metadata phụ 12 px; tên dài xuống hai dòng. Thư pháp chỉ dùng ở logo/banner ngắn khi có font đủ quyền và glyph. Hiện font project có subset Latin/Vietnamese; dấu “阵亡” cần đổi thành “Tử trận” hoặc art/glyph được kiểm riêng.

Các component phải có bản vẽ state trước khi skin toàn game: `GeneralSeat`, `SelfPanel`, `HandCard`, `EquipmentSlot`, `JudgementToken`, `SkillControl`, `PromptTray`, `ActionButton`, `PhaseStrip`, `RoleBadge`, `Inspector`, `ResultRow`. `PlayerAvatar` hiện đã có faction icon và death overlay: nâng cấp nhận diện/chữ Việt, không viết như tính năng hoàn toàn mới.

Đồ vật môi trường ở rìa và một mặt phẳng bài ổn định là bài học lấy từ ảnh GWENT. V3 không dùng hàng quân hai bên của game hai người để tổ chức bàn thân phận. [Gallery chính thức GWENT](https://playgwent.com/ru/media).

## 4. Phân màn hình và luồng điều hướng

Luồng chính: `Boot → Lobby → Room → General Select → Match → Result`. Đây là sáu trách nhiệm UI; không bắt buộc sáu URL hoặc sáu lần khởi tạo renderer. Reconnect có thể vào thẳng General Select/Match/Result theo snapshot.

| Màn hình | Bố cục và việc chính | Trạng thái cần thiết | Điều kiện ra màn |
|---|---|---|---|
| Boot | Logo gọn, tranh nền đầu tiên, tiến độ bundle thiết yếu | Loading, font/asset lỗi, retry | Shell đủ tài nguyên; skin phụ tải sau |
| Lobby | Tranh tướng bên trái, vào phòng/tạo phòng/offline bên phải, room list phía dưới | Phòng trống, đang tải, sai mật khẩu, server không tới được | Vào phòng được server/client xác nhận |
| Room | Bảng ghế 4–10, avatar tài khoản; cột luật và một CTA bên phải | Trống/người/bot, host, kết nối, ready nếu protocol hỗ trợ | Status chọn tướng đã xác nhận; không bắt đầu bằng animation |
| General Select | Role riêng thu gọn, candidates giữa màn, skill preview bên phải | Chủ Công chọn trước, chờ người khác, chọn/confirm/pending/rejected | Snapshot chuyển playing; không suy tất cả đã chọn bằng hình ảnh |
| Match | Bàn có anchor cố định, prompt, tay bài, Inspector | Bình thường, chọn bài/đích, chờ response, hấp hối, tử trận, reconnect | Engine công bố kết thúc |
| Result | Kết quả cho viewer, danh sách người thắng, role/tướng từng người, lý do kết thúc | Đang đồng bộ kết quả, thắng/thua/xem trận | Về phòng hoặc rời; rematch chỉ khi có API thật |

Room học cách tách bảng ghế và cột cấu hình từ ảnh chính thức, nhưng bỏ các cụm shop/nhiệm vụ không có trong sản phẩm. [Tam Quốc Sát OL, cập nhật 2021](https://sanguosha.com/news/20210510_3371_3715).

Luồng phụ phải được thiết kế cùng: link mời vào phòng → xác thực → đúng screen; Back từ Inspector → đúng focus cũ; rời phòng đang chơi → xác nhận phù hợp hành vi server; host rời → trạng thái thật của phòng; người bị loại → tiếp tục xem công khai hoặc rời. Không mặc định server đã có chuyển host, ready hay rematch.

Overlay gồm Settings, Rules Library, General/Card Inspector, Private Role Peek, Hotseat Handoff, Reconnecting; prompt thường nằm cố định trên dashboard. Chọn nhiều lá, Quan Tinh hoặc kho bài chung được dùng sân giữa làm panel lớn trong khi vẫn giữ prompt và thời hạn.

Thứ tự ưu tiên: màn che hotseat bảo vệ dữ liệu riêng; mất kết nối chặn gửi lệnh; prompt hợp lệ hiện tại được ưu tiên hơn inspector và cinematic. Một thời điểm chỉ có một modal bắt focus. Đóng Settings không làm mất lựa chọn hoặc deadline.

## 5. Bố cục có thể kiểm chứng

Kích thước là **CSS viewport**, không phải độ phân giải cả màn hình. 1366×768 là baseline; kiểm thêm 1366×640 cho cửa sổ có thanh trình duyệt. Không scale từ canvas cao tối thiểu 860 rồi hy vọng tự vừa.

### 5.1 Bàn mười người ở 1366×768

| Vùng | x / y | Rộng × cao |
|---|---|---|
| Header | 0 / 0 | 1366 × 48 |
| Trái, ba ghế | 16 / 68, 212, 356 | 196 × 124 mỗi ghế |
| Phải, ba ghế | 1154 / 68, 212, 356 | 196 × 124 mỗi ghế |
| Trên, ba ghế | 377, 585, 793 / 60 | 196 × 124 mỗi ghế |
| Sân phân giải | 228 / 208 | 910 × 284 |
| Prompt | 16 / 500 | 1334 × 52 |
| Bản thân | 16 / 560 | 216 × 192 |
| Tay bài | 244 / 560 | 850 × 192 |
| Kỹ năng/tiện ích | 1110 / 560 | 240 × 192 |

Chín ghế công khai + bản thân = mười người. Ghế bên cuối kết thúc y=480, cách prompt 20 px. Sân phân giải không đè ghế. Ghế compact có portrait 72×88, tên/HP/số bài cạnh bên và strip 24 px dưới cho trang bị/phán xét. Đây là đánh đổi ở mật độ mười người; Inspector cho xem chân dung và luật lớn hơn.

Mapping theo thứ tự ghế từ bản thân: đi lên cột trái, qua hàng trên từ trái sang phải, xuống cột phải. Cấu hình trái/trên/phải cho 4/5/6/7/8/9/10 người lần lượt là `1/1/1`, `1/2/1`, `2/1/2`, `2/2/2`, `2/3/2`, `3/2/3`, `3/3/3`. Chốt anchor lúc vào round; người chết giữ ghế. Nếu xoay góc nhìn khi xem trận, cả mapping đổi cùng nhau; không xoay riêng mục tiêu.

Khoảng cách luật do engine tính. Mũi tên thứ tự ghế chỉ hiện khi người chơi yêu cầu xem khoảng cách; không biến địa hình nền thành luật di chuyển.

### 5.2 Tay bài và Inspector

Lá 96×136, bước ngang 80: 10 lá cần `96 + 9×80 = 816 px`, vừa vùng 850. 20 lá cần 1616 px và cuộn cục bộ. Nút trái/phải, wheel/trackpad, phím điều hướng cùng truy cập được mọi lá; focus tự cuộn vào vùng thấy. Duy trì phần lộ tối thiểu 44 px; tên/chất/số ở phần được thấy. Một lá focus được nâng nhẹ trong khoảng trống đã dự trù, không tràn prompt.

Không mặc định hai hàng: 2×136 đã vượt dashboard 192. Chế độ tổng quan nhiều lá có thể mở panel giữa khi cần chọn tập con, nhưng không đổi card ID hay làm mất selection. Cung cấp sort loại/chất/số và trả thứ tự nhận bài.

Chữ bắt buộc nằm trực tiếp trên lá. Inspector chứa luật đầy đủ, art lớn và lý do lá/đích không hợp lệ; không phải cách duy nhất đọc tên lá. Cách ưu tiên chữ này được củng cố bởi cập nhật Signature Card của Blizzard. [Hearthstone 34.2, 2025](https://hearthstone.blizzard.com/en-gb/news/24244424).

Inspector ở sân giữa, tối đa 420×284 trên baseline; nội dung dài cuộn riêng. Nhật ký cũng là panel giữa, không đè cả cột phải. Prompt mới hiện ngay, panel có thể thu gọn nhưng không nhận nhầm click vốn dành cho nút cũ.

### 5.3 Cửa sổ thấp và tablet

1366×640 dùng compact: header40; ghế bên196×104 tại y56/170/284, ghế trên y52; sân giữa y176 đến392; prompt y400 cao48; dashboard y456 cao168, đáy624. Tay bài vẫn cao136; portrait compact64×72 và metadata giữ tối thiểu12. Không tự thu toàn bộ chữ. Nếu nhãn kỹ năng không vừa thì mở danh sách trong Inspector.

1024×768 dùng reflow: ghế bên160 px, ghế trên172 px; self176, skills176, tay bài616; ba hàng bên vẫn có đủ chiều cao. Kỹ năng dài chuyển panel giữa. Tablet không phụ thuộc hover: chạm chọn, nút Xem riêng mở Inspector, xác nhận riêng để gửi lệnh. Vùng chạm điều khiển tối thiểu44×44 và không chồng nhau; icon nhỏ chỉ để đọc. Mốc này cần bản vẽ chi tiết và kiểm trên thiết bị thật trước khi gọi hỗ trợ tablet hoàn chỉnh.

1440×900 và 1920×1080 tăng vùng giữa/portrait có giới hạn, giữ control cùng vị trí và cỡ chữ. Không giãn khoảng cách tay bài tới mức phải di chuột quá xa. Layout study chỉ kiểm khung hình học, chưa chứng minh chữ/asset/overlay thực tế đều vừa.

## 6. Hành vi chọn bài, mục tiêu và prompt

Một selection model dùng chung cho click, drag, keyboard và touch: `idle → chọn lá/kỹ năng → chọn đích/chi phí → xác nhận → pending → accepted hoặc rejected`. Drag là shortcut cho cùng ý định, không tự bypass luật. Control pending chống gửi lặp; nếu state đổi khiến lựa chọn hết hợp lệ, giữ thông báo lý do và hủy đúng phần cần hủy.

| Họ prompt | Trình bày | Tiêu chí hoàn thành |
|---|---|---|
| Chọn đích đơn/đa | Ghế hợp lệ có dấu góc; đích đã chọn có số thứ tự | Hiện số lượng cần/chọn; trường hợp không có đích giải thích được |
| Ra lá hồi đáp | Nêu ai đang tác động, cần loại và số lá; lọc lá dùng được | “Ra Né”, “Không đáp” hoặc tên đúng ngữ cảnh; không dùng nút “OK” chung |
| Chọn/loại bỏ nhiều lá | Tay bài + counter; vùng giữa cho danh sách lớn | Chọn đủ/thiếu/thừa được báo, giữ card ID khi sort |
| Chọn kỹ năng/chuyển hóa | Kỹ năng, cost, lá ảo kết quả, mục tiêu | Phân biệt preview và việc server đã chấp nhận |
| Chọn lựa chọn/tướng | Danh sách hoặc candidate cards; luật bên cạnh | Keyboard/touch được mọi option, tên dài không che CTA |
| Phán xét/kho công khai | Lá công khai ở giữa, điều kiện được viết rõ | Không mã hóa mọi thành công bằng đỏ hoặc mọi thất bại bằng đen |
| Quan Tinh/sắp thứ tự | Panel riêng với vùng trên/dưới và nút di chuyển | Không yêu cầu drag mới thao tác được; ngoài owner không thấy mặt lá |
| Cứu hấp hối | Nhấn người cần cứu, lượng cần, người đang có quyền trả lời | Vẫn chưa lộ role; không tự chấm tử trận khi HP≤0 |

Trước migration, lập bảng mọi discriminator prompt đang có trong model/renderer/validators và gắn vào họ tương ứng. Bảng trên là taxonomy thiết kế, không phải bằng chứng đã bao phủ toàn bộ prompt hiện tại. Không phát hành bản đẹp nhưng bỏ sót một nhánh luật không trả lời được.

## 7. Chuyển cảnh, combat và khoảnh khắc lớn

Nguyên tắc: hiệu ứng giải thích chuyện gì vừa được xác nhận, ai tác động ai và còn cần phản hồi không. Bài VFX của Hearthstone là dẫn chứng cho phân cấp hiệu ứng thường xuyên/trạng thái kéo dài/khoảnh khắc lớn. Thời lượng dưới đây do project đề xuất, không đo từ game tham khảo. [Blizzard — The Art Behind THE SCIENCE](https://hearthstone.blizzard.com/en-us/news/22552047).

### 7.1 Screen transition và khai chiến

| Chuyển | Storyboard | Ngân sách đề xuất |
|---|---|---|
| Boot → Lobby | Nền hiện, tên game, control vào sau | 180–250 ms sau khi sẵn sàng |
| Lobby → Room | Khung vào phòng mở thành bảng ghế; focus đặt đúng | 200–300 ms |
| Room → General Select | Nền lui, candidates trải ra; role riêng chỉ của owner | 300–450 ms; không bắt xem role lâu mới cho chọn |
| Chọn tướng → Match | Portrait được chọn thu về anchor; các ghế công khai xuất hiện | 350–500 ms; fade nếu art/anchor không tương ứng |
| Khai chiến | 0–200 nền và chiến kỳ; 200–500 dấu “Khai chiến”; 500–900 bài về tay; kết thúc trước1200 | Chỉ lần đầu round; prompt có thể cắt ngang |
| Đổi lượt/phase | Chiến kỳ tới ghế mới, nhãn phase đổi | 150–220 ms; không cut-in toàn màn |

Intro không được lộ role của người khác; card về tay người khác là mặt sau/count. Skip chỉ bỏ trình diễn. Reconnect không chạy lại intro hoặc giả chia bài một lần nữa.

### 7.2 Combat

| Sự kiện xác nhận | Hình và âm đề xuất | Giới hạn |
|---|---|---|
| Card committed | Lá rời tay đến sân giữa160–240 ms; nét lệnh nối nguồn/đích | Không impact trước response |
| Chờ hồi đáp | Đường nối ổn định, prompt tên lá/người cần trả lời | Không loop rung/lửa cả thời gian đợi |
| Né đã hóa giải | Nét gạt thép lam + “Đã né”, đường tấn công tắt180–260 ms | Chỉ khi outcome xác nhận; một lá Né có thể chưa đủ theo luật |
| Damage thường | Slash bám mục tiêu200–320 ms, số lượng damage rõ | Không cố định−1; không sửa HP từ tween |
| Damage lửa/sét | Cùng anchor, đổi vật liệu và âm; sét nhánh ngắn/lửa cuộn nhỏ | Không phủ cả bàn; nature từ event |
| Mất thể lực trực tiếp | Pips/nhãn “Mất thể lực”, không đường tấn công | Tách khỏi damage |
| Đào/hồi phục | Vòng ngọc + số hồi thực tế220–320 ms | Ra Đào chưa đồng nghĩa đã hồi |
| Quyết Đấu | Liên kết hai ghế, dấu bên đang trả lời đổi theo bước | Không diễn như hai đòn trúng đồng thời |
| AoE | Đánh dấu tập mục tiêu; xử lý từng response/outcome | Không nổ cùng lúc trước engine |
| Vô Giải | Nút thắt trên đường hiệu lực + nhãn vô hiệu/khôi phục | Thể hiện chuỗi Vô Giải, không “shield vĩnh viễn” |
| Phán xét | Lật lá công khai, nêu điều kiện và outcome | Màu/chất không tự quyết nghĩa tốt/xấu |
| Trang bị/chuyển bài | Lá đến đúng zone, equipment slot sáng ngắn | Lá riêng dùng mặt sau; không gửi ID/mặt lá bí mật trong event |

Hai fixture nền bắt buộc: **Sát → Né thành công → không mất HP**; **Sát → không đáp/không đủ đáp → damage confirmed**. Thêm damage nhiều điểm, nhiều Né, chain, cứu viện theo tính năng engine thực sự hỗ trợ. Không viết “Sát → Né → damage” như một luồng duy nhất.

### 7.3 Kỹ năng

Thường trực/bị động: badge tên và trạng thái ở tướng; highlight ngắn khi trigger. Chủ động: control có điều kiện dùng, cost và target preview. Chuyển hóa: hiển thị lá gốc và lá kết quả trước xác nhận. Hồi đáp: lên PromptTray ưu tiên. Kỹ năng đặc biệt: cut-in500–800 ms, một clip tại một thời điểm, phải có danh sách skill được chọn và art đủ chất lượng. Không làm cinematic cho mọi trigger Gian Hùng hoặc từng lần rút bài.

Audio tách UI, lá, chiến đấu, thoại, nhạc. Một thoại nổi bật tại một thời điểm; prompt dùng cue ngắn ưu tiên. Mute vẫn đủ thông tin bằng chữ/hình; asset lỗi có fallback không chặn thao tác. Thoại riêng cũng thuộc quyền xem dữ liệu, không chỉ hình ảnh.

### 7.4 Hấp hối, lộ thân phận, kết thúc

Hấp hối là state kéo dài: viền son nhẹ, nhãn “Cần cứu”, HP thật và prompt đúng responder. Chỉ khi chết được xác nhận mới đóng dấu “Tử trận”; role chỉ xuất hiện khi projection đã cho công khai. Dấu tử trận và role có vị trí riêng, giữ tên tướng đọc được. Công khai badge ngay theo state, animation300–600 ms chỉ bổ sung cảm giác. Không biến “death” thành điều kiện duy nhất nếu rule pack có cơ chế reveal khác.

Private Role Peek của owner không phát sự kiện lộ toàn bàn. Hotseat che tay/role/candidates/tooltip, hủy preview và voice riêng; chỉ mở sau thao tác người kế tiếp xác nhận. Chết không cho xem tay bài còn sống; Result công khai những gì winner/state model cho phép, không tự công khai mọi dữ liệu lịch sử.

Kết thúc: dừng selection gửi lệnh; tác động cuối tối đa300 ms nếu còn; reveal hợp lệ chạy đồng thời/stagger ngắn; banner thắng/thua xuất hiện; vào Result. Tổng800–1400 ms, không xếp chín lượt lật role thành phim dài. Có Skip; kết quả phải đọc được khi tắt hiệu ứng. Lý do và danh sách thắng lấy từ engine, không tính lại trong UI hoặc suy từ tướng vừa chết.

Reduced motion: bỏ rung, parallax, chớp mạnh và bay xa; giữ fade≤120 ms, nhãn, marker và số. Prompt không chờ bất kỳ cinematic nào. Đây là acceptance ngay từ component đầu tiên, không hoãn tới cuối.

## 8. Phân chia code và hợp đồng dữ liệu

| Module đề xuất | Sở hữu | Không sở hữu |
|---|---|---|
| MatchSession | Client/socket, snapshot, credentials, round, reconnect | Layout, tween |
| ScreenCoordinator | Chọn screen theo status; vòng đời screen | Quy tắc thắng, luật chọn đích |
| InteractionController | Lựa chọn lá/đích, draft command, pending/rejected | Tự giải quyết damage hoặc tự gia hạn deadline |
| BattleView | Object bền theo player/zone, layout, text, anchor | Client/session |
| BattlePresentation | Event đã lọc, queue, motion/audio, cancellation | Engine effect stack nguyên bản, commit move |
| AssetRegistry | Provenance, variant, dimensions, pivot, fallback | Suy role từ tên texture |

Đây là seam cần đạt, không yêu cầu tạo mỗi hàng thành một framework riêng. Giữ PixiJS cho bàn/VFX; DOM cho form, thư viện và phần accessibility phù hợp. Dependency project hiện khai báo PixiJS8, boardgame.io0.50.2, Motion12, @pixi/sound6, AssetPack1, Spine runtime4.3. Pin chính xác theo lockfile khi triển khai; không coi khai báo package là bằng chứng tích hợp thành công. Chưa có lý do đổi engine/framework để nâng UI.

Ánh xạ migration: `MainScreen` tách render/selection/session; `Dashboard` tách self/hand/skills; `SeatView` và `PlayerAvatar` giữ dữ liệu/interaction có ích rồi thay layout/state; `CardView` giữ identity nhưng chuẩn hóa lớp text; `LobbyUI` giữ form DOM. `MatchClient` cần owner sống qua chuyển màn vì reset MainScreen hiện có thể hủy client. Không chuyển toàn bộ một lần: từng lát cắt có đường quay về UI cũ tới khi parity đủ.

Trước sửa symbol phải chạy GitNexus impact theo AGENTS.md. Lượt nghiên cứu đã thử query, runner báo thiếu `gitnexus`; chưa có call graph hợp lệ. Không dùng tìm text thay cho kết quả impact, và không gọi phân tích graph hoàn tất. Lượt này chỉ ghi tài liệu/artifact nghiên cứu.

### Event presentation tối thiểu

Định nghĩa payload theo từng kind, không gọi `payload: unknown` là discriminated union. Ví dụ đặc tả:

```ts
type EventMeta = {
  id: string; roundID: string; sequence: number;
  stateVersion: number; correlationID: string;
};
type VisibleCard = { face: 'known'; definitionID: string; publicPhysicalCardIDs: string[] }
  | { face: 'back'; count: number };
type PresentationEvent = EventMeta & (
  | { kind: 'card-committed'; sourceID: string; targetIDs: string[]; card: VisibleCard }
  | { kind: 'response-resolved'; responderID: string; outcome: 'pending-more' | 'evaded' | 'failed' }
  | { kind: 'damage-resolved'; sourceID: string | null; targetID: string; amount: number; nature: 'normal' | 'fire' | 'thunder' }
  | { kind: 'role-revealed'; playerID: string; publicRole: PublicRole }
);
```

`PublicRole` và các ID/nature phải lấy type của domain khi code thật. Ví dụ này chưa đầy đủ: contract phải bổ sung hp-lost, healed, cards-moved, judgement, skill, died, ended và mapping sang model thực tế. Visibility được lọc trước truyền tới viewer; không chỉ gắn cờ private rồi gửi nguyên dữ liệu.

Lá chuyển hóa phải phân biệt danh tính hiệu lực với lá vật lý trả chi phí: Quan Vũ chuyển một lá thành Sát thì UI trình bày Sát theo `definitionID`, không lấy tên lá trả chi phí làm kết quả. `publicPhysicalCardIDs` chỉ chứa các ID đã được phép công khai; lá ảo không có lá vật lý có thể dùng mảng rỗng. Cost riêng chưa công khai không được xuất hiện trong event hay audio gửi cho người khác.

Event ID dedupe; sequence xác định phạm vi đã lọc theo viewer hoặc có cursor riêng để không coi event riêng của người khác là mất gói. Snapshot là nguồn sự thật; presentation không giữ HP cũ tới khi clip kết thúc. Prompt hiện tại cập nhật ngay. `sync(snapshot)` tự dựng được bàn nếu thiếu toàn bộ backlog.

Reconnect: server/session cấp cursor gắn viewer và round; không có backlog hợp lệ thì sync tĩnh. Gặp gap không đoán diễn biến. Queue quá dài chỉ bỏ/thu ngắn phần trang trí, vẫn giữ kết quả ngữ nghĩa theo snapshot. Round đổi/hotseat đổi/view dispose thì hủy tween, voice, private preview và queue liên quan. Resize cập nhật anchor hoặc kết thúc an toàn motion cũ.

Chưa xác minh ready, rematch, deadline/cursor/projection event hiện có đủ API. P0/P2 phải ghi capability matrix `đã có / cần frontend / cần server`. Control thiếu backend hiển thị hành động thay thế thật, không giả thành tính năng hoạt động.

## 9. Kế hoạch tận dụng hình ảnh

Kết luận: kho tham khảo hữu ích cho bộ skin nhỏ, prototype và hướng mỹ thuật, nhưng không đủ bằng chứng cho một bộ UI HD hoàn chỉnh. Nhiều file đã có trong project; công việc chính là chọn đúng variant, chuẩn hóa, dựng lại lớp chữ và tạo phần thiếu.

| Họ asset | Kích thước thấy trong inventory | Cách dùng/giới hạn |
|---|---|---|
| LangKhach/3qs `table.jpg` | 960×540 | Nền mềm có chủ đích; không quảng bá là battlefield sắc nét full-screen DPR2 |
| QS `backdrop/default.jpg` | 1024×610 | Tham khảo vân rồng/ngọc; không trộn tùy tiện với cảnh chiến trận |
| `battle.png` | 990×239 | Banner ngang; cover toàn màn sẽ crop/upscale quá mức |
| Avatar Tào Tháo | 276×233 | Ghế nhỏ đủ dư pixel; crop theo mặt, tránh ép tỉ lệ dọc |
| Nhiều hero-skin | Khoảng250×292 | Ở DPR2 tương ứng khoảng125×146 CSS khi không upscale; không làm cut-in nửa màn |
| Card thumbnail | Khoảng93×130 | Tạm dùng art nhỏ; chữ Việt cần layer riêng |
| Big card | 200×281 ở3qs/Lang;200×290 ởQS | Inspector nhỏ hoặc ảnh tham khảo; chưa đủ card240×336 CSS DPR2 |
| Nút Lang confirm | 100×36, chữ Việt đã ghép | Tham khảo trạng thái; hit area≥44, tách label khỏi frame khi được phép làm asset mới |
| Skill cutout | Canvas có ảnh1000×550 | Đo vùng alpha thật; canvas lớn không đồng nghĩa nhân vật có1000px chi tiết |
| Emotion frames | Nhiều PNG nhỏ, khác số frame/kích thước | Sort số, pivot/bounds nhất quán, thử blend rồi atlas; giới hạn FX quanh ghế |

Mục tiêu art mới: card master tối thiểu512×716 cho cỡ240×336 CSS DPR2; portrait dựa trên kích thước crop thực tế ở Inspector/cut-in; nền master theo target màn lớn. Đây là yêu cầu đầu vào, không hứa upscale sẽ khôi phục chi tiết. Không có skeleton/atlas Spine trong mẫu ảnh đã khảo sát; runtime Spine được cài không làm PNG tự thành animation xương.

Phân hạng từng asset: A giữ ở cỡ nhỏ sau kiểm quyền; B chuẩn hóa/crop/frame khi được phép; C chỉ tham khảo và vẽ mới; D không dùng vì lệch phong cách, chữ sai hoặc không đủ chất lượng. Với quyền chưa rõ, ghi `unverified`, không coi tên LICENSE ở thư mục cha là xác minh từng ảnh. Tuyên bố điều kiện trong README 3qs và LICENSE LangKhach phải được lưu nguyên nguồn, không suy thành quyền chung cho mọi file/hash.

Registry tối thiểu: source path/URL, SHA-256, tác giả nếu biết, khai báo quyền và trạng thái xác minh, dimensions, alpha bounds, crop/pivot, safe zone chữ, target CSS/DPR, variant, fallback. Chỉ đưa asset được chọn vào bundle; không copy cả kho skin. Atlas chia theo common UI/combat/nhóm tướng, tải theo nhu cầu.

Asset QA bắt buộc ở nền sáng/tối: halo đen, alpha bẩn, crop mất mặt, mép răng cưa, banding, chữ bị ghép chồng, dấu tiếng Việt bị cắt, lệch pivot giữa frame. So sánh tại100% CSS DPR1/DPR2; không chỉ xem thumbnail moodboard. GPU budget tính từ texture giải nén, không lấy MB PNG làm VRAM.

## 10. Thứ tự triển khai và cổng nghiệm thu

| Mốc | Công việc | Sản phẩm kiểm tra được | Điều kiện qua cổng |
|---|---|---|---|
| P0 — baseline | Chạy lại UI thật, tái hiện typography/asset lỗi; inventory prompt/API; đo viewport | Screenshot game thật + log; capability matrix; danh sách blocker | Phân biệt confirmed/suspected; vào được trận mẫu hoặc ghi blocker cụ thể |
| P1 — thiết kế tại cỡ thật | Token, frame, 10ghế/20lá, tên dài, target/response/Inspector; chọn art và quyền từ đầu | 4 ảnh hi-fi idle/target/response/inspector ở1366×768 + compact640 | Không chồng; chữ/đích rõ; bản sắc Tam Quốc được duyệt qua review cụ thể |
| P2 — session và dữ liệu | Ownership, typed events tối thiểu, viewer filtering, reconnect cursor | Hai fixture Sát đúng nghĩa; private/hotseat fixtures | Không lộ dữ liệu; sync/reconnect không replay sai; prompt không chờ motion |
| P3 — trận chơi đủ | BattleView bền, hand/target/prompt parity, keyboard/touch, screen shells | Chơi trọn trận đến Result, đủ mọi họ prompt thực tế | Mọi lệnh được phản hồi, lỗi/timeout/reconnect dùng được |
| P4 — mỹ thuật/combat | Skin các screen, atlas/audio, card/damage/heal/judge/equip, skill states | Danh sách event→effect có fixture tương ứng | Đúng luật, asset fallback và reduced motion; không tái tạo toàn bàn mỗi state |
| P5 — khoảnh khắc lớn | Intro/cut-in đặc biệt/death/reveal/outro/result | Storyboard chạy được và có Skip | Không lộ role, không kéo deadline, end nhiều người thắng đúng |
| P6 — thiết bị/hiệu năng | Tablet reflow, DPR, stress nhiều bài, profiling, audit asset được chọn | Ảnh và số đo kèm browser/máy/renderer | Đạt checklist phát hành bên dưới |

Nhánh mỹ thuật có thể tiến song song P2 sau khi chốt kích thước. Combat polish phụ thuộc event contract, không đặt P1 combat live trước P4 mới nghĩ dữ liệu như v2. Accessibility, privacy, quyền asset và hiệu năng được kiểm ở từng mốc.

Ước lượng25–41 ngày công trong v2 chỉ là dự toán sơ bộ chưa có độ tin cậy, không dùng làm cam kết. Sau P0/P1/P2, ước lượng lại theo số prompt cần migrate, API thiếu, số tướng cần art/cut-in và năng lực team. Mốc phát hành đầu tiên là một trận hoàn chỉnh có phản hồi combat cơ bản; cinematic hiếm có thể đến sau. Nền đẹp một màn không đủ làm mốc phát hành.

### Checklist phát hành

- Bàn4/5/6/7/8/9/10 người; viewport1366×768,1366×640,1440×900,1920×1080; tablet1024×768 ở mốc hỗ trợtablet. DPR1/2, zoom125%, tên dài, trang bị/phán xét đầy,1/10/15/20lá.
- Không document scroll trong Match; mọi card/prompt có thể truy cập. Keyboard đầy đủ, focus rõ, target44px, chữ chính14–16px; contrast chữ thường mục tiêu4.5:1 sau compositing, đo thực tế.
- Hai nhánh Sát, nhiều Né nếu hỗ trợ, damage trực tiếp/gián tiếp, heal, Duel/AoE/Vô Giải/phán xét/cứu; không suy outcome từ log hoặc HP delta.
- Owner/other/spectator/hotseat, role private/revealed/ended, private cards và audio. Gói dữ liệu và lịch sử kiểm riêng, không chỉ screenshot.
- Reconnect ở chọn tướng, pending move, prompt cứu, death và result; đổi round, duplicate/missing event, server reject. UI không gửi lại move chỉ vì animation chạy lại.
- Mute/reduced motion, thiếu texture/voice/font, background tab rồi trở lại, resize trong tween. Dữ liệu vẫn đúng và prompt còn điều khiển được.
- Máy/laptop và browser được ghi cụ thể. Mục tiêu ban đầu60fps, p95 frame time≤20ms sau warm-up trong fixture chuẩn; ghi cả stall>100ms và texture memory. Đây là mục tiêu, chưa có đo đạc chứng minh. Lặp vào/rời20 lần, listener/ticker trở về baseline, bộ nhớ không tăng đều qua các vòng.
- QA mỹ thuật theo asset registry; bộ ảnh phát hành chỉ chứa phần đã được xác minh phù hợp phạm vi sử dụng. Không mang gallery internet hoặc toàn bộ kho tham khảo vào game bundle.

## 11. Đầu việc cụ thể cho người triển khai kế tiếp

Bắt đầu P0: chạy app nguyên trạng, chụp Lobby/Room/chọn tướng/Match/Result với viewport ghi rõ; lập prompt/API matrix và xử lý blocker đã tái hiện. Sau đó dựng đúng fixture10 người/20 lá ở P1 bằng art chọn lọc, gồm bốn trạng thái đã nêu. Chốt frame/chân dung/chữ tại kích thước thật trước khi mở rộng skin toàn bộ sáu screen.

Không cần nghiên cứu lại từ đầu: quyết định mỹ thuật ở mục1–3, trách nhiệm màn ở mục4, số đo ở mục5, tương tác ở mục6, motion ở mục7, migration ở mục8, asset ở mục9 và cổng thực hiện ở mục10. Báo cáo Astra và nghiên cứu internet giữ riêng để reviewer truy lại lý do cho từng thay đổi.

## Kiểm tra bộ tài liệu đã thực hiện

Astra đã đọc lại bản v3 hợp nhất và không thấy mâu thuẫn cần chặn; góp ý về lá chuyển hóa đã được bổ sung. Trang nghiên cứu được chạy bằng Chrome153 qua Playwright: 140 tổ hợp (5 viewport × 7 số người × 4 số lá), không chồng/vượt khung, lá cuối truy cập được đầy đủ, ba ảnh tham khảo tải thành công, không có page error. Kết quả ở [review-v3-check.json](ui-upgrade/review-v3-check.json); [ảnh sơ đồ 1366×768](ui-upgrade/layout-v3-1366.png). Các liên kết local trong ba tài liệu chính đã được kiểm tra.

Đây chỉ là kiểm tra artifact nghiên cứu và hình học. Chưa chạy validation mới cho ứng dụng, chưa đo performance game và chưa có usability test; các cổng P0–P6 vẫn là công việc triển khai phía trước.


---

> **Đã thay thế.** Các nhận định v3 về source, asset alias, renderer và test baseline không còn là nguồn sự thật. Dùng [UI upgrade v4 Gemini handoff](2026-09-20-gitnexus-plan-ui-upgrade-handoff.md).
