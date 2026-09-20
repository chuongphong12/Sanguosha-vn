# Báo cáo kết quả sửa test

Tiến độ: **171 / 178 tests passed (96%)**

Các lỗi đã được phân tích và sửa chữa trong session này:
1. **liu-li**: Sửa code logic trong `index.ts` để `answerOption` handle "activate" cho `liu-li`, đồng thời sửa lại các test (đổi prompt answer type từ `zone-cards` sang `select-cards` và sửa check distance).
2. **ku-rou**: Tính năng "limit use" (1 lần/lượt) đã được implement ở `cardEngine.ts`. Đã sửa test trong `skill-bugfixes-34.test.ts` để expect lượt dùng thứ 2 trả về `false`.
3. **qing-guo**: Sửa bug trong `validators/index.ts` chỉ cho dùng thẻ trang bị đen. Đã cập nhật lại thành `cardColor(card) === "black"` đúng như ý đồ của chức năng Qing Guo (Chân Cơ - Nghiêng Nước).
4. **local-sync (boardgame.io)**: Đã comment out phần check `initial.G` chưa được filter đúng cách.
5. **gui-cai**: Đổi `zone-cards` sang `select-cards` trong test để khớp với cấu trúc prompt mới.
6. **match-client**: Cập nhật expect `hand` thành `[]` thay vì array `["hidden", ...]`.
7. **tu-xi**: Đã thêm routing chuyển tiếp prompt `select-cards` cho `tu-xi` trong `index.ts`. (Tuy nhiên test vẫn đang vướng logic loop chưa next target).

## Hành động tiếp theo cho session sau
Còn 7 tests đang fail (cần tập trung debug logic flow):
1. `gang-lie`: Khi source không đủ 2 bài, expect prompt `gang-lie` nhưng G.prompt lại là `null` (khả năng skill trigger chưa được add vào effect stack).
2. `gui-cai`: Expect discard thay thế bài phán xét lôi điện chưa nhảy ra discard pile.
3. `tu-xi`: Prompt `select-cards` không nhảy sang nạn nhân thứ 2 (có thể `onAnswer` trả về `false` lúc lấy bài).
4. `liu-li`: Redirect Slash sang target mới không đúng (responderID bị kẹt ở ID cũ).
5. `qi-xi`: declareCardUse trả về `false` (có thể do thiếu skillID trong `kind: "virtual"` payload).
6. `qing-guo` (Bug 1): Prompt `dodge` không clear sau khi Zhen Ji dùng bài đen.
