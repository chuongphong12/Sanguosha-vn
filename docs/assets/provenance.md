# Asset Provenance Registry

Tài liệu này ghi nhận nguồn gốc, quyền sử dụng và trạng thái của toàn bộ asset (hình ảnh, âm thanh, dữ liệu) được sử dụng trong quá trình nâng cấp giao diện v4 (Phase M0-M5).

## 1. Asset Hiện Có (Pre-v4)

Tất cả asset hiện hành (card art, equipment icons, tướng 27 nhân vật cơ bản, icon phe) đều được ánh xạ qua `assetAliases.ts` và được kế thừa từ các phiên bản trước đó của Sanguosha-vn. Không có asset nào mới được thêm vào mà không rõ nguồn gốc.

- **Nguồn:** Kho asset mặc định của dự án (từ các nguồn mã nguồn mở hoặc cộng đồng).
- **Quyền sử dụng:** Dự án mã nguồn mở phi thương mại. (Cần rà soát lại nếu public production).
- **Trạng thái:** Đã kiểm duyệt và đang sử dụng qua Pixi `Assets.get()`.

## 2. Asset Mới (Thêm vào trong v4)

Trong các phase M1-M5, nhóm nâng cấp UI tuân thủ nguyên tắc:
> "Chỉ sử dụng asset hiện có cho card, avatar, icon và effect nhỏ; không dùng splash art hoặc cut-in lớn chưa rõ nguồn gốc".

- *Tính đến cuối M5, không có asset vật lý (`.png`, `.jpg`, `.mp3`) mới nào được thêm vào.*
- Các hiệu ứng hình ảnh (như glow, flash, text damage) đều được tạo động qua hệ thống `PIXI.Graphics` và `PIXI.Text`.

*Ghi chú cho các Executor tiếp theo: Khi thêm bất kỳ file ảnh/âm thanh nào mới vào thư mục `raw-assets` hay `public/assets`, hãy cập nhật bảng dưới đây:*

| Tên Asset | Loại | Nguồn gốc / Tác giả | Giấy phép | Trạng thái |
| :--- | :--- | :--- | :--- | :--- |
| (Chưa có) | (Chưa có) | (Chưa có) | (Chưa có) | (Chưa có) |
