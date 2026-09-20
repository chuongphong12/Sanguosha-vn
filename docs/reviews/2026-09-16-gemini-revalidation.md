# Revalidation và audit bản sửa Gemini

Ngày: 2026-09-16, Asia/Saigon. Mốc audit chính: `2dd781be521c31d883b980f0d9f5742192cce481`.

**Kết luận: bản sửa chưa hoàn thiện và chưa thể nghiệm thu.** Trong 13 mục cũ, 8 mục đã được xử lý trong phạm vi lỗi được báo, 5 mục mới xử lý một phần. Audit phát hiện thêm 4 lỗi hồi quy/tích hợp. Nghiêm trọng nhất: frontend không build được; client có credentials vẫn có thể kết thúc ván trái phép qua SocketIO; luồng online khởi tạo các ghế chưa có người.

Đây là đánh giá bản code được cung cấp, không phải điểm năng lực tổng quát của model Gemini. Mục “đã sửa” bên dưới chỉ áp dụng cho hành vi được kiểm tra; không có nghĩa toàn bộ hệ thống hay toàn bộ kỹ năng đã được chứng nhận.

## Phạm vi và mốc dữ liệu

- Đối chiếu báo cáo `docs/reviews/2026-09-15-implementation-validation.md`, từng mục F1–F8 và R1–R5.
- Diff chính: `git diff 444b25c7cbb2289b97bade6369912edce38651f2...2dd781b`. Có 15 commit trong khoảng này, bao gồm sửa bảo mật, sửa luật và thay đổi UI.
- Working tree sạch khi bắt đầu kiểm tra. Commit `98c9d26` đưa vào phần sửa kỹ năng và đồng thời xóa một đoạn lớn của MainScreen; `2dd781b` chỉ dọn script tạm.
- Trong khi audit, tác nhân khác sửa tiếp core/index.ts ở nhánh Thiết Kỵ/Bát Quái và Cứu Viện, đồng thời tạo find.cjs, print-full.cjs, print-last.cjs. Không sửa hay xóa các thay đổi đó. Chúng không thay đổi nguyên nhân của các findings dưới đây, nhưng làm dịch số dòng core và thay đổi kết quả test cuối.
- Số dòng core trong phần findings ưu tiên mốc HEAD đã audit; với thay đổi chưa commit, dùng tên hàm/đoạn code để định vị.
- Không sửa source sản phẩm. Build làm AssetPack xóa ảnh tracked ở thư mục output; đã khôi phục đúng byte của ảnh từ HEAD sau khi ghi nhận vấn đề. Báo cáo được lưu cục bộ và đang nằm dưới quy tắc ignore `*.md` của repo.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| Vitest ở HEAD sạch, 10:53 | **176/176 PASS**, 28/28 file |
| Typecheck | **FAIL**: MainScreen.ts:256, TS1128 |
| ESLint ở mốc đầu | **FAIL**: 387 errors, 19 warnings, gồm 1 parsing error |
| Build Vite thực tế | **FAIL** ở MainScreen.ts:256 sau khi AssetPack hoàn tất khoảng 69 giây |
| Server bằng `npm.cmd run serve` | Khởi động được trên cổng trống |
| Local sync, 3 seed cố định | Vai trò đối thủ chưa công khai đều null; initial random.data và deck không được gửi |
| SocketIO initial sync | Waiting-room không lộ initial random.data/deck; effectStack rỗng |
| SocketIO raw endGame | **FAIL bảo mật**: server chấp nhận gameover giả mạo từ người chơi đã join |
| Phòng riêng qua HTTP | Password sai → 401; sau 4 lần join đúng, public metadata không còn password |
| Vitest chạy lại lúc 10:58 sau thay đổi đồng thời | **175/176 PASS**; test Cứu Viện thất bại do fixture/kỳ vọng cũ, xem phần cuối |
| Browser/E2E frontend mới | Không xác nhận chạy được: source hiện tại không build/parse được |

Phiên bản thực cài: Node 22.20.0, PixiJS 8.20.1, boardgame.io 0.50.2, Vite 8.3.0, Vitest 4.1.11, TypeScript 5.7.3, Playwright 1.63.0. Không dùng bản dist cũ làm bằng chứng giao diện hiện tại hoạt động.

Probe với code TypeScript có thể chạy qua shim pnpm `node_modules/.bin/tsx.cmd --input-type=module`. Bare `node --import tsx` gặp khác biệt resolve dependency; đó không phải bằng chứng lệnh serve được hỗ trợ bị hỏng. Không thay dependency để làm test pass.

## Ma trận 13 mục cũ

| ID | Trạng thái | Bằng chứng / phần còn thiếu |
| --- | --- | --- |

### G2 — P2, R2 chưa hoàn chỉnh: Hoàng Cái đã chết vẫn rút hai lá

Vị trí tại HEAD: `src/game/engine/core/index.ts:3304` và `:2414–2416`, useSkill ku-rou và case draw. Sau thay đổi đang diễn ra, tìm tại các hàm tương ứng.

Bản sửa đặt draw tiếp sau dying, đúng cho nhánh được cứu. Nhưng draw không có điều kiện người nhận còn sống. Repro dùng Hoàng Cái **không phải Chủ Công**, 1 HP, không bài, tất cả bỏ cứu và các phe khác vẫn sống: sau giải quyết, alive=false, hp=0 nhưng hand.length=2, game vẫn playing và lượt đã sang người khác. Chọn Chủ Công làm fixture sẽ che lỗi vì trận kết thúc xóa effect stack.

Cách hoàn tất: phần tiếp diễn Khổ Nhục chỉ rút nếu nhân vật sống sau rescue; có test cả chết không kết thúc ván và cứu thành công. [FAQ Standard Hoàng Cái](https://www.sanguosha.com.tw/newsinfo_905.html) xác định giải quyết hấp hối trước, được cứu rồi mới rút.

### G3 — P1, mới: Auto-skip bỏ qua cả người có Vô Giải

Vị trí: `src/game/engine/core/index.ts:1412`; `src/game/types/cards.ts:23`.

Code kiểm tra `G.cards[cID].name === 'nullification'`, nhưng PhysicalCard dùng definitionID. Vì vậy hasWuxie luôn false cho lá vật lý. Với autoSkipWuxie mặc định true, người có Vô Giải cũng bị bỏ qua.

Repro đối chiếu cùng state: player0 dùng Vô Trung Sinh Hữu, player1 giữ Vô Giải. Auto-skip=false → hỏi player1; auto-skip=true → không hỏi, player0 rút ngay hai lá, Vô Giải vẫn trên tay player1. Các test game hiện dùng helper đặt autoSkipWuxie=false nên không đi qua nhánh mặc định của sản phẩm.

Cách hoàn tất: kiểm tra đúng schema, tốt hơn dùng bộ kiểm tra khả năng đáp ứng chung; kiểm tra cả người có/không có Vô Giải với config mặc định.

### G4 — P2, mới: Người dùng cẩm nang bị loại khỏi cửa sổ Vô Giải đầu tiên

Vị trí: `src/game/engine/core/index.ts:1406–1410`.

Nhánh mới thực sự bỏ qua sourceID khi nullificationCardIDs còn rỗng. Repro tắt auto-skip để không bị G3 che: player0 dùng Nam Man, giữ Vô Giải để bảo vệ đồng đội1. Engine chỉ hỏi [1,2,3], rồi buộc đồng đội1 trả Sát; player0 không được hỏi.

Không có điều kiện cấm người phát cẩm nang sử dụng Vô Giải lên hiệu ứng của chính lá đó. Cần giữ họ trong danh sách responder hợp lệ và kiểm tra theo từng mục tiêu AOE. [Mô tả Vô Giải thường trên website chính thức](https://guozhan.sanguosha.com/a/kapaiyilan/youxipai/jinnanpai/2013/0128/99.html). Trang nằm trong mục Quốc Chiến; ở đây chỉ dùng mô tả lá Vô Giải thường, không áp quy tắc Vô Giải Quốc hay luật thân phận Quốc Chiến vào Standard.

**Spec: 4 findings còn mở, gồm 2 mục sửa một phần và 2 hồi quy; nặng nhất P1 là Quỷ Tài không đổi phán xét và Vô Giải bị bỏ qua.**

## Chất lượng kiểm chứng và thay đổi đồng thời

176 test pass ở HEAD là tiến bộ so với 171/176 trước đây, nhưng **số test không tăng**. Một số kỳ vọng cũ đã được chỉnh đúng, đặc biệt Khiêm Tốn và quyền lựa chọn Cương Liệt. Chưa có regression đủ mạnh cho raw server action, phòng chưa đầy, Quỷ Tài thay lá thật, Khổ Nhục chết không kết thúc trận hoặc autoSkipWuxie=true. Vitest không import toàn bộ MainScreen nên bỏ lọt lỗi khiến frontend không biên dịch.

Lần test lúc 10:58 trên working tree đang thay đổi có 175/176 pass. Test Cứu Viện ở tests/skills/skill-batch6.test.ts:95 kỳ vọng hồi 2 dù fixture người cứu là Gia Cát Lượng, phe Thục. Thay đổi đồng thời bổ sung kiểm tra phe Ngô là đúng điều kiện Standard; cần chỉnh fixture hoặc kỳ vọng và thêm ca Ngô/không phải Ngô, không nên sửa code về hành vi sai chỉ để xanh test. [Luật Standard Tôn Quyền](https://www.sanguosha.com.tw/newsinfo_908.html).

Phần thay đổi đồng thời Thiết Kỵ/Bát Quái không được coi là đã audit đầy đủ mọi tương tác trong báo cáo này. Những script mới do tác nhân khác tạo cũng không thuộc bản sửa được nghiệm thu. Không gán chúng cho các commit cũ.

E2E config vẫn chờ frontend ở 8081 trong khi Vite/baseURL là 8080. Cần thống nhất cổng trước khi sử dụng E2E như điều kiện nghiệm thu. Chưa có bằng chứng browser cho bản frontend mới vì lỗi S1 chặn trước đó.

GitNexus đã thử nhưng runner không tìm thấy executable. Kết luận dựa trên diff/source, tài liệu chính thức, dependency thực cài, test và probe Local/HTTP/SocketIO. Các server/phòng test localhost đã được dừng/dọn sau probe; không thử payload trên dịch vụ thật bên ngoài.

## Điều kiện để hoàn tất bản sửa

1. Khôi phục frontend và làm typecheck/build qua được; xử lý ảnh LoadScreen từ nguồn build tái tạo được.
2. Chặn raw event ở server; start từ danh sách người thực sự đã join; áp dụng đầy đủ options.
3. Hoàn tất hai nhánh còn thiếu của Quỷ Tài/Khổ Nhục và sửa hai hồi quy Vô Giải.
4. Thêm regression theo các tình huống trên, sửa fixture Cứu Viện theo luật, rồi chạy lint/typecheck/Vitest/build và E2E trên cùng một snapshot không thay đổi.
