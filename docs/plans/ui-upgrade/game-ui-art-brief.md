# Chỉ đạo thiết kế game UI và quyết định sử dụng hình ảnh

Ngày 16/09/2026. Tài liệu này cụ thể hóa [kế hoạch v3](../2026-09-16-ui-upgrade-plan-v3.md), không tạo thêm một kế hoạch thay thế. Phần kiểm ảnh bổ sung đã xem trực tiếp 13 mẫu từ cả ba kho và đo lại kích thước/vùng alpha; không gọi đây là kiểm thị giác toàn bộ hàng nghìn asset. [Số đo có thể chạy lại](asset-sample-inspection.json) · [script đo](inspect-asset-samples.cjs).

## 1. Nếu đây là game của tôi

Tôi muốn người chơi nhớ **gương mặt võ tướng, lá bài đặt xuống và dấu thân phận lộ ra đúng lúc**. Toàn bộ UI xoay quanh ba hình ảnh đó. Không lấy hình một bàn quân nghị làm trung tâm rồi thêm vài đường vàng để gọi là Tam Quốc.

Hướng chọn: Trận đồ dưới chiến kỳ. Lobby có tranh tướng rộng, khoảng sáng và tên game. Trong trận, chân dung nằm trong thẻ sơn then có nẹp đồng; chiến kỳ đánh dấu lượt; tay bài là giấy sáng. Rìa chiến trường có sương/cờ, giữa bàn đủ yên để đọc diễn biến. Son dùng cho lệnh và nguy hiểm; ngọc dùng cho hồi phục; màu phe có vị trí riêng. Không dùng chung một vòng đỏ để vừa báo phe, vừa báo mục tiêu, vừa báo hấp hối.

Tính cách nằm ở art và chuyển động. Chữ chức năng phải rõ: “Ra Né”, “Không đáp”, “Chọn 2 lá bỏ”, “Kết thúc lượt”. Giọng văn cổ phong chỉ dùng ở tiêu đề ngắn hoặc câu thoại, không làm người chơi phải đoán nút đang làm gì.

## 2. Tôi phân sản phẩm thành sáu màn hình

| Màn hình | Người chơi cần biết/làm | Chỉ đạo hình ảnh | Chuyển tiếp |
|---|---|---|---|
| Khởi động | Game đang tải gì; thử lại khi lỗi | Logo, một chi tiết chiến kỳ, tiến độ gọn; không cinematic trước mỗi lần retry | Nền Lobby xuất hiện trước, control sau |
| Đại sảnh | Chơi offline, tạo phòng hoặc vào phòng | Một tranh tướng lớn và một vùng hành động rõ; danh sách phòng gọn | Card phòng mở sang bố cục phòng |
| Phòng chờ | Ai đã vào, ai là bot/host, luật gì | Thẻ người chơi + tờ luật cạnh bên; một nút bắt đầu chính | Status chọn tướng mới mở màn chọn |
| Chọn tướng | Role riêng, lựa chọn hợp lệ, kỹ năng và xác nhận | Candidates thành các thẻ dọc; tướng đang chọn nổi hơn; luật đủ chỗ đọc | Chân dung đã chọn thu về ghế khi trận bắt đầu |
| Bàn đấu | Ai có lượt, tôi có thể làm gì, chuyện gì đang diễn ra | Tướng quanh bàn, vùng phân giải giữa, prompt cố định, tay bài ở dưới | Mọi response xử lý ngay tại bàn; không chuyển screen cho từng đòn |
| Kết quả | Ai thắng, tại sao, các thân phận công khai | Banner ngắn + danh sách tướng/role/kết quả; có đường về phòng | Chơi tiếp theo API thực tế, không tự reset trận từ animation |

Chi tiết bài/tướng, thư viện luật, cài đặt, xem role riêng và nhật ký là overlay/panel. Prompt hồi đáp là bộ phận thường trực của bàn. Quan Tinh/chọn nhiều lá dùng panel trung tâm. Không chia mọi popup thành screen mới.

PC/laptop là chuẩn thiết kế đầu tiên. Tại 1366×768, mười người gồm ba ghế trái, ba ghế trên, ba ghế phải và bản thân dưới. Ghế chết giữ chỗ. Role của mình là badge và nút xem riêng; không chiếm một thẻ lớn bên cạnh tay bài. Tay bài đông cuộn trong vùng riêng, không kéo dài cả trang.

## 3. Tôi chia motion thành ba tầng

### Tầng thao tác — phản hồi ngay

Hover/focus, nhấc lá, đánh dấu đích, nút pending, báo lệnh bị từ chối. Khoảng 80–180 ms. Đây là tầng phải làm đầu tiên vì người chơi sử dụng liên tục. Click/kéo/touch/phím đi chung một lựa chọn, không tạo bốn bộ luật.

### Tầng chiến đấu — giải thích diễn biến

Lá ra từ nguồn tới sân xử lý; mục tiêu được đánh dấu; prompt trả lời xuất hiện; chỉ sau kết quả xác nhận mới có impact. Mỗi đoạn chính khoảng 160–320 ms; đoạn chờ response kéo dài theo game state, không theo clip.

| Tình huống | Hình tôi sẽ làm | Ý nghĩa phải giữ |
|---|---|---|
| Sát | Đường lệnh ngắn, vết chém tại đích sau xác nhận | Preview mục tiêu khác với đòn trúng |
| Né đủ để hóa giải | Nét gạt, chữ “Đã né”, đường tấn công tắt | Không chạy damage ngay sau Né thành công |
| Sát lửa/sét | Giữ cùng cấu trúc đòn; đổi chất liệu, màu phụ và âm | Không nổ toàn màn cho đòn thường |
| Đào | Vòng ngọc tại người hồi phục, lượng hồi thật | Ra lá chưa có nghĩa đã được hồi |
| Quyết Đấu | Liên kết hai ghế, đổi nhấn theo bên phải đáp | Diễn từng bước của chuỗi |
| AoE | Đánh dấu tập mục tiêu, nhấn người đang phân giải | Không kết luận mọi đích trúng cùng lúc |
| Vô Giải | Nút thắt trên đường hiệu lực, nhãn vô hiệu/khôi phục | Theo kết quả của chuỗi Vô Giải |
| Phán xét | Lá công khai ở giữa và nhãn điều kiện/kết quả | Không mặc định đỏ là tốt |
| Mất thể lực | HP và nhãn giảm, không thêm kẻ tấn công giả | Tách khỏi sát thương |

Kỹ năng bị động dùng badge/nhãn nhỏ tại nguồn. Kỹ năng chủ động có trạng thái dùng được, cost và mục tiêu. Kỹ năng chuyển hóa cho xem rõ lá hiệu lực khác với lá trả chi phí. Thoại và tên kỹ năng bật sau sự kiện được cấp cho viewer, không suy từ text nhật ký.

### Tầng điện ảnh — dành cho vài khoảnh khắc

- **Khai chiến:** nền mở, chân dung về ghế, dấu “Khai chiến”, bài chia vào tay, chiến kỳ nhấn người bắt đầu. Tổng khoảng 0,8–1,2 giây; có bỏ qua; không làm lại khi reconnect.
- **Kỹ năng đặc biệt:** chân dung lớn xuất hiện lệch bên, nét mực mang tên kỹ năng, một nhịp âm mạnh, rồi nhường bàn. Khoảng 0,5–0,8 giây, chỉ một lớp và một danh sách kỹ năng được tuyển chọn.
- **Hấp hối:** cảnh báo tại ghế và prompt cứu; đây là trạng thái chờ, chưa phải cảnh tử trận.
- **Lộ thân phận:** sau khi dữ liệu được phép công khai, huy hiệu role đổi ngay; dấu “Tử trận”/role mở trên ghế trong khoảng 0,3–0,6 giây. Không tiết lộ các ghế còn sống và không chỉ xử lý ghế local.
- **Kết thúc:** chốt tác động cuối, role công khai hiện đồng thời hoặc lệch nhịp ngắn, banner kết quả, sang Result. Tổng khoảng 0,8–1,4 giây. Không bắt xem chín animation lật nối tiếp.

Mọi thời lượng là ngân sách đề xuất. Prompt mới có thể cắt cinematic; Skip chỉ bỏ animation. Chế độ giảm chuyển động giữ nhãn/mốc trạng thái, bỏ rung và bay xa. Audio được trộn theo UI/lá/chiến đấu/thoại/nhạc; một thoại nổi bật cùng lúc.

## 4. Kết quả xem trực tiếp hình ảnh

Kết luận thiết kế của tôi: **tận dụng có chọn lọc cho giao diện nhỏ; phần HD và nhận diện tiếng Việt cần sản xuất bổ sung**. Tính đủ pixel, phù hợp mỹ thuật và quyền sử dụng là ba điều kiện riêng. Các nhận xét dưới chỉ kết luận về mẫu đã xem; dùng bản phát hành còn cần trạng thái quyền ở registry.

| Mẫu đã xem | Đo lại | Quan sát và quyết định |
|---|---|---|
| QS `backdrop/default.jpg` | 1024×610 | Vân rồng/ngọc nhạt, độ tương phản thấp. Hợp tham khảo hoa văn; nếu dùng làm nền chính vẫn thiếu chất chiến trận mà người dùng muốn |
| 3qs `image/backdrop/table.jpg` | 960×540 | Hai đạo quân mở vùng giữa sáng, bố cục hợp bàn đấu. Dùng tạm như nền mềm; cần bản lớn hơn nếu muốn nhìn rõ cảnh ở laptop/desktop |
| 3qs avatar Tào Tháo | 276×233 | Gương mặt, mão và áo giáp rõ tại cỡ nhỏ. Phù hợp ghế; không kéo thành portrait lớn |
| 3qs general-card Tào Tháo | 200×278 | Có thân người và cờ, hợp crop dọc hơn avatar ngang. Chọn variant theo vùng hiển thị thay vì ép avatar vào mọi chỗ |
| LangKhach Tào Tháo skin1 | 250×292 | Tranh có khí chất, nhưng là một ảnh khung hoàn chỉnh với nền. Không phải sprite nhân vật tách nền hoặc tranh HD |
| 3qs Sát nhỏ | 93×130 | Tên Việt ghép sẵn, art/chữ nhỏ và mềm. Không dùng làm master; phóng to không giải quyết chất lượng chữ |
| 3qs Sát lớn | 200×281 | Art rõ hơn và có chữ Hán lớn; hợp nguồn art nhỏ sau khi xử lý được phép. Cần lớp tên Việt riêng, không đè thêm chữ lên mẫu nhỏ |
| QS Sát lớn | 200×290 | Cùng chủ đề nhưng khung đen, nẹp góc khác bản 3qs viền giấy cháy. Phải chọn một họ khung xuyên game, không trộn ngẫu nhiên |
| Hoa Hùng `animate/huaxiong.png` | Canvas1000×550; bounds alpha>16 chỉ397×511 | Hình còn các mảng nền cắt theo khối; canvas lớn không phải cutout1000px. Chưa phù hợp cinematic sạch nửa màn |
| Nút xác nhận | 100×36 | Texture và chữ ghép chặt vào kích thước thấp. Dùng để học vật liệu; làm frame co giãn và text mới cho control44px trở lên |
| Sát frame12 | 188×184; bounds158×165 | Hiệu ứng son có chữ Hán; có thể làm bản tạm quanh ghế nếu hợp art direction. Không phóng thành đòn chém lớn toàn bàn |
| Né frame10 | 240×240; bounds181×217 | Sáng xanh mạnh và có chữ Hán. Cần xem trên nền tối/sáng và kiểm blend trước chọn; có nguy cơ lấn át art son/đồng |
| Banner thắng | 398×180 | Chữ Hán đã ghép cùng họa tiết vàng/đỏ. Cần banner tiếng Việt mới; không phải animation hoàn chỉnh |

Thư mục Sát đỏ có24 PNG, Né có23 PNG. Việc đếm frame chưa xác minh timing, pivot và nhịp phát đã mượt; cần chạy sequence trong pipeline VFX. `hasAlpha=true` cũng không chứng minh nền thực sự trong suốt: mẫu Sát lớn có toàn bộ pixel trên ngưỡng alpha16, nên không được tự giả định viền đen sẽ biến mất khi ghép nền.

### Cỡ dùng hợp lý và DPR2

Trên màn hình DPR2, một vùng100×140 CSS cần khoảng200×280 pixel để có tỷ lệ1:1. Vì vậy ảnh big-card200×281 có thể đủ pixel cho lá96×136 CSS; ảnh93×130 không đủ để giữ cùng độ nét. Cùng asset đó không đủ cho Inspector240×336 CSS — vùng này cần ít nhất480×672 pixel, mục tiêu master512×716 có phần dư.

Skin250×292 tương ứng125×146 CSS ở DPR2 nếu dùng toàn ảnh. Avatar276×233 phải tính lại theo crop: không được lấy số chiều rộng để khẳng định đủ cho mọi portrait dọc. Với Hoa Hùng, bounds397×511 chỉ tương ứng khoảng198,5×255,5 CSS ở DPR2 trước crop bổ sung. Đo alpha không thay thế đánh giá vẻ đẹp hay chất lượng cạnh.

Nền960×540 phủ1366×768 đã cần phóng khoảng1,42 lần ở DPR1; tại DPR2 thiếu pixel nhiều hơn. Có thể chấp nhận khi chủ ý để mềm phía sau HUD; không gọi đó là art nền HD sắc nét.

## 5. Tôi đặt hàng phần art mới như thế nào

| Gói | Đầu ra cần làm | Chuẩn đầu vào |
|---|---|---|
| Nhận diện | Logo, tên game, bộ màu, một họ hoa văn/nẹp, backdrop Lobby/Match cùng thế giới | Tách layer môi trường khỏi lớp đọc; nguồn master và thông tin tác giả/quyền |
| Bộ UI | Frame ghế, self panel, button đủ state, prompt, tooltip/Inspector, icon trang bị/phase | Frame và chữ độc lập; dark/light compositing; control dùng được với touch |
| Bài/role | Card frame, mặt sau, lớp suit/rank/name, bốn role của chế độ hiện tại, trạng thái chưa công khai | Card master512×716 cho Inspector dự kiến; role phải khớp rule pack, không bê role Quốc Chiến |
| Tướng | Chọn họ tranh đồng nhất cho catalog hiện có; crop avatar/card; art lớn cho nhóm cut-in chọn lọc | Portrait lớn chốt theo CSS×DPR và vùng nhân vật thật; không đặt hàng toàn kho skin |
| VFX | Đường nguồn/đích, slash/jink/fire/thunder/heal, judge, skill label, death/reveal | Pivot, timing, frame order, safe zone chữ, reduced-motion variant |
| Khoảnh khắc lớn | Khai chiến, banner thắng/thua, reveal thân phận, vài skill nổi bật | Chữ Việt tách lớp, storyboard và timing; có fallback khi thiếu asset |

Tôi ưu tiên ngân sách art cho frame ghế, tay bài, backdrop và bộ role trước cut-in cho nhiều tướng. Đây là phần xuất hiện suốt trận và tạo khác biệt mạnh hơn số lượng animation hiếm.

## 6. Phân việc triển khai

1. **Thiết kế/UX:** chốt sáu screen, bố cục10 người/20lá, taxonomy prompt, focus/keyboard/touch; xuất bốn trạng thái Match idle/chọn đích/chờ đáp/Inspector tại cỡ thật.
2. **Mỹ thuật:** tuyển asset13mẫu mở rộng thành danh sách theo catalog; vẽ frame/card/role/backdrop thiếu; duy trì style guide và file nguồn. Không chờ hết code mới xem quyền và chất lượng art.
3. **UI engineering:** session sống qua screen, object bàn có ID ổn định, renderer/layout/prompt/controller tách trách nhiệm. Dựng trước một trận chơi trọn tới Result.
4. **Gameplay/network:** cung cấp event đã lọc cho từng viewer, kết quả damage/response/reveal, danh tính lá chuyển hóa, cursor reconnect; không xuất nguyên effect stack nội bộ.
5. **Motion/audio:** làm hai nhánh Sát→Né thành công và Sát→damage trên event đúng; sau đó mở rộng combat, kỹ năng và cinematic. Hỗ trợ cắt/bỏ/giảm hiệu ứng ngay từ đầu.
6. **QA:** kiểm luật và riêng tư, hình/đọc chữ theo viewport/DPR, ghế đông/tay bài đông, reconnect/hotseat và đo hiệu năng trên máy được ghi rõ.

Thứ tự giao: baseline chạy thật → bản vẽ có art tại cỡ thật → session/event tối thiểu → trận hoàn chỉnh → toàn bộ screen/combat → cinematic → tablet và đo nghiệm thu. Các nhóm có thể làm song song nhưng không làm impact trúng đích dựa vào phỏng đoán phía UI.

Mốc đầu tôi muốn thấy là một bàn10 người dùng art đã tuyển,20lá vẫn thao tác được, có response Sát/Né đúng và có một trường hợp chết/lộ role đi tới Result. Sau khi lát cắt đó đạt chất lượng, mới nhân rộng skin và cinematic. Checklist đầy đủ và tọa độ nằm trong v3.

## Giới hạn của lần kiểm này

Đã xem13 file gốc và đo metadata/alpha; chưa kiểm từng skin, chưa phát toàn bộ sequence, chưa đánh giá audio, chưa duyệt quyền phát hành từng file và chưa chạy lại ứng dụng. Không đưa tỷ lệ “dùng được80%” khi chưa có danh sách asset được tuyển. Những việc chưa kiểm nằm ở cổng art/VFX/runtime trong kế hoạch.


---

> **Trạng thái lịch sử:** dùng brief này để xem moodboard, storyboard và đo đạc asset đã khảo sát. Quyết định triển khai, quyền asset và tình trạng source hiện tại nằm trong [UI upgrade v4 Gemini handoff](../2026-09-20-gitnexus-plan-ui-upgrade-handoff.md).
