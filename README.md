<div align="center">
  <img src="https://raw.githubusercontent.com/chuongphong12/Sanguosha-vn/main/public/favicon.ico" alt="Logo" width="120" />
  <h1>Tam Quốc Sát VN (Sanguosha Web)</h1>
  <p>
    <strong>Bản chuyển thể mã nguồn mở tựa game thẻ bài chiến thuật kinh điển - Tam Quốc Sát (Tiêu chuẩn 2013)</strong>
  </p>
  <p>
    <a href="https://github.com/chuongphong12/Sanguosha-vn/actions"><img src="https://img.shields.io/github/actions/workflow/status/chuongphong12/Sanguosha-vn/ci.yml?branch=main" alt="Build Status" /></a>
    <img src="https://img.shields.io/badge/PixiJS-v8-ff69b4" alt="PixiJS" />
    <img src="https://img.shields.io/badge/boardgame.io-v0.50-blue" alt="Boardgame.io" />
  </p>
</div>

---

## 📜 Lời Ngỏ & Giới Thiệu (Introduction)

**Tam Quốc Sát VN** là một dự án phi lợi nhuận, mã nguồn mở, được phát triển với mục đích đưa trải nghiệm của board game thẻ bài **Tam Quốc Sát (Sanguosha)** lên nền tảng web hiện đại.

Dự án tái hiện lại một cách trung thực **luật chơi Tiêu chuẩn (2013)** — bao gồm toàn bộ hệ thống tướng, kỹ năng phức tạp, sự kiện tính thời gian (Timing), các chuỗi Vô Giải Khả Kích đan chéo, và hệ thống trang bị kinh điển.

Chúng tôi mong muốn tạo ra một sân chơi mượt mà, dễ tiếp cận và hoàn toàn miễn phí cho cộng đồng yêu thích Tam Quốc Sát tại Việt Nam, đồng thời cung cấp một cấu trúc mã nguồn (architecture) mẫu mực cho những ai muốn học hỏi về phát triển Game Web đa người chơi.

![Giao diện Game](docs/images/gameplay.png) *(Ảnh minh họa: Bạn có thể cập nhật ảnh Screenshot giao diện thật tại docs/images/gameplay.png)*

---

## ✨ Tính Năng Nổi Bật (Key Features)

- ⚔️ **Game Engine Chuẩn Xác:** Mô phỏng chính xác tuyệt đối logic của Tam Quốc Sát. Hệ thống vòng đời (Phases), Trì hoãn sự kiện (Event Queue), và Trigger Kỹ Năng được thiết kế chặt chẽ, loại bỏ hoàn toàn các lỗi mâu thuẫn (edge cases) thường gặp.
- 🎨 **Đồ Họa & Hiệu Ứng Sắc Nét:** Được vận hành bởi **PixiJS v8** (thông qua WebGL) kết hợp cùng hệ thống hoạt ảnh **Spine**, mang lại trải nghiệm mượt mà 60FPS, hiệu ứng kỹ năng mãn nhãn và quản lý tài nguyên cực kỳ tối ưu (AssetPack).
- 🌐 **Đồng Bộ Hóa Đa Người Chơi (Real-Time Multiplayer):** Tích hợp **Boardgame.io** làm xương sống cho hệ thống mạng. Hỗ trợ Client-Server State Management hoàn hảo, người chơi có thể tạo phòng, tham gia lobby, và đồng bộ trạng thái theo thời gian thực.
- 🤖 **Heuristic AI (Bot Thông Minh):** Hỗ trợ chế độ chơi Offline/Luyện tập với Bot. Bot được trang bị hệ thống đánh giá (Heuristics) có khả năng nhận diện đồng đội, tự động bơm máu, né đòn, mặc trang bị và chủ động tấn công kẻ thù.
- 🧩 **Kiến Trúc Mở Rộng (EventBus):** Việc thêm mới một Kỹ năng tướng hay một lá Cẩm Nang cực kỳ dễ dàng nhờ kiến trúc EventBus, giúp tách biệt (decouple) logic game cốt lõi với hiệu ứng thẻ bài.
- 🛡️ **Bảo Chứng Bằng 170+ Bài Test Tự Động:** Toàn bộ logic (từ Quá Hà Sách Kiều, Vạn Tiễn Tề Phát cho tới các kỹ năng phức tạp của Tào Tháo, Quách Gia...) đều được bảo vệ bởi mạng lưới Unit Tests (Vitest) nghiêm ngặt.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

Dự án được xây dựng hoàn toàn bằng **TypeScript** nhằm đảm bảo tính chặt chẽ của các mô hình dữ liệu (Type Safety).

| Lĩnh vực | Công nghệ | Mục đích |
| :--- | :--- | :--- |
| **Đồ Họa & UI** | [PixiJS v8](https://pixijs.com/) & `@pixi/ui` | Render Canvas (WebGL) hiệu năng cao. |
| **Animation** | [Spine](http://esotericsoftware.com/) & [Motion](https://motion.dev/) | Xử lý chuyển động, hiệu ứng tướng. |
| **Game Server** | [Boardgame.io](https://boardgame.io/) | Quản lý State, Lobby, Multiplayer Networking. |
| **Build & Tooling**| [Vite](https://vitejs.dev/) & [AssetPack](https://pixijs.io/assetpack/) | Đóng gói siêu tốc, tự động nén Sprite ảnh. |
| **Kiểm Thử** | [Vitest](https://vitest.dev/) & [Playwright](https://playwright.dev/) | Unit Tests cho Logic & E2E Tests cho UI. |

---

## 🚀 Hướng Dẫn Cài Đặt (Setup & Installation)

### 1. Yêu Cầu Hệ Thống (Prerequisites)
- [Node.js](https://nodejs.org/) (Khuyến nghị phiên bản v18 trở lên).
- Trình quản lý gói `npm`, `yarn`, hoặc `pnpm`.

### 2. Tải & Cài Đặt (Clone & Install)
```bash
git clone https://github.com/chuongphong12/Sanguosha-vn.git
cd Sanguosha-vn
npm install
```

### 3. Chạy Môi Trường Phát Triển (Development)
Tam Quốc Sát là một game Client-Server, do đó bạn cần khởi chạy cả 2 môi trường:

```bash
# Terminal 1: Chạy Frontend Client (Vite)
npm run dev

# Terminal 2: Chạy Backend Server (Boardgame.io)
npm run serve
```
*Ghi chú: Lệnh `npm run dev` sẽ tự động dọn dẹp cache cũ (`npm run clean`) và nén lại ảnh nếu cần thiết.*

### 4. Build Môi Trường Mạng (Production)
```bash
# Chạy Linter, Typecheck, Build AssetPack, và đóng gói Web Client
npm run build
```

---

## 🧪 Quy Trình Kiểm Thử (Testing)

Chất lượng của Game Engine là ưu tiên hàng đầu. Chúng tôi có một bộ Test Suite đồ sộ để bảo vệ toàn vẹn logic:

```bash
# Chạy toàn bộ Unit Tests (hơn 110+ Tests đã Pass)
npm run test

# Chạy test ở chế độ theo dõi (Watch mode) dành cho Developer
npm run test:watch
```

---

## 🤝 Lời Cảm Ơn & Tác Quyền (Credits & License)

- **Bản quyền gốc:** Tựa game board game **Tam Quốc Sát (Sanguosha)**, luật chơi, hệ thống nhân vật, và toàn bộ hình ảnh (Artwork / UI / Assets) thuộc bản quyền của nhà phát hành **Yoka Games (游卡桌游)**.
- **Mục đích dự án:** Kho lưu trữ mã nguồn này được xây dựng hoàn toàn với mục đích **giáo dục, nghiên cứu lập trình** (Open-source sharing) và hoàn toàn **phi lợi nhuận**.
- **Đóng góp (Contributors):** Xin gửi lời cảm ơn tới những lập trình viên, cộng đồng đam mê Tam Quốc Sát tại Việt Nam đã đồng hành, đóng góp kiến trúc và mã nguồn để hoàn thiện Game Engine này. Đặc biệt cảm tạ sức mạnh hỗ trợ code từ Antigravity (AI).
- Mọi thắc mắc hoặc yêu cầu gỡ bỏ liên quan tới vấn đề bản quyền, vui lòng liên hệ qua tính năng [Issues](https://github.com/chuongphong12/Sanguosha-vn/issues).

---

<div align="center">
  <i>Được rèn đúc bằng đam mê và ☕ bởi cộng đồng Sanguosha VN.</i>
</div>
