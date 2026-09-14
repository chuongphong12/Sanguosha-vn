# Sanguosha VN (Tam Quốc Sát)

Một phiên bản mã nguồn mở đưa board game thẻ bài đình đám **Tam Quốc Sát (Sanguosha)** lên trình duyệt web. Dự án được xây dựng bằng công nghệ web hiện đại (TypeScript, Pixi.js, Boardgame.io), mang lại trải nghiệm mượt mà, đồng bộ thời gian thực và hỗ trợ các tính năng tự động hóa luật chơi phức tạp của game gốc.

## 🌟 Tính Năng Nổi Bật

- **Game Engine Mô Phỏng Chuẩn Mực:** Khung luật chơi được thiết kế chính xác theo tiêu chuẩn 2013, bao gồm cả những phase và trigger skills phức tạp.
- **Thiết Kế Đồ Hoạ Tối Ưu:** Sử dụng PixiJS (WebGL) cùng Spine Animation mang lại hiệu năng cao và hiệu ứng hình ảnh sống động.
- **Đồng Bộ Thời Gian Thực:** Boardgame.io xử lý toàn bộ server/client state management, cho phép người chơi dễ dàng tạo phòng, tham gia trận chiến và giữ trạng thái mạng đồng nhất.
- **Hệ Thống Skill Mở Rộng Dễ Dàng (EventBus):** Kiến trúc EventBus cho phép tách biệt từng kỹ năng Tướng (Generals) và Thẻ Trang bị, dễ dàng thêm hoặc chỉnh sửa kỹ năng mà không làm phình to Engine cốt lõi.
- **Kiểm Thử Chặt Chẽ:** Được bao phủ bởi hơn 170 bài test tự động (Vitest) cho tất cả các tình huống phản ứng bài và sử dụng skill phức tạp nhất, đảm bảo tính nhất quán của luật chơi.

## 🛠️ Công Nghệ Sử Dụng

- **Ngôn ngữ chính:** [TypeScript](https://www.typescriptlang.org/)
- **Frontend Rendering:** [PixiJS v8](https://pixijs.com/) & [Spine](http://esotericsoftware.com/)
- **UI Components:** `@pixi/ui` & [Motion](https://motion.dev/)
- **Game State & Networking:** [Boardgame.io](https://boardgame.io/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Testing:** [Vitest](https://vitest.dev/) (Logic) & [Playwright](https://playwright.dev/) (E2E)

## 🚀 Hướng Dẫn Cài Đặt & Chạy Trực Tiếp

### 1. Yêu cầu hệ thống
- Node.js (phiên bản 18+ hoặc mới nhất)
- Trình quản lý gói `npm`, `yarn` hoặc `pnpm`

### 2. Cài đặt các gói phụ thuộc
Clone repo về máy, sau đó mở terminal tại thư mục gốc và chạy:
```bash
npm install
```

### 3. Khởi chạy Server và Client (Môi trường phát triển)
Sử dụng các câu lệnh sau để chạy dự án:

```bash
# Chạy Frontend Client (tự động mở port qua Vite)
npm run dev

# Chạy Backend Server (Server của Boardgame.io xử lý multiplayer)
npm run serve
```
*Ghi chú: Khi chạy `npm run dev`, script tự động dọn dẹp các asset cũ (`npm run clean`) và tạo lại môi trường.*

### 4. Build môi trường Production
```bash
npm run build
```

## 🧪 Kiểm Thử (Testing)

Dự án bao gồm một bộ Unit Test chi tiết cho toàn bộ flow của Game và Skill:

```bash
# Chạy bộ test một lần
npm run test

# Chạy chế độ watch khi dev
npm run test:watch
```

## 📂 Cấu Trúc Dự Án (Tham khảo)

- `src/game/` - Chứa toàn bộ Game Engine: core rule, `cardEngine.ts`, `setup.ts`, danh sách thẻ bài.
- `src/game/engine/` - Trái tim của hệ thống xử lý Sự kiện & Kỹ năng (EventBus, SkillRegistry).
- `src/app/` - Phần giao diện người chơi, render đồ hoạ (PixiJS), quản lý phòng chờ (Lobby UI).
- `server/` - Thiết lập máy chủ Boardgame.io.
- `tests/` - Các bộ test Vitest chia theo rules, skills, UI.

## 📝 Giấy Phép (License)
Dự án được xây dựng với mục đích học tập và chia sẻ mã nguồn mở. Tài sản đồ hoạ (Assets) phụ thuộc vào bên thứ ba và có thể thuộc bản quyền của nhà phát hành gốc Yoka Games.
