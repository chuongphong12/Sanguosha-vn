# Tam Quốc Sát VN — Quốc Chiến web port

Dự án đang chuyển engine sang **Quốc Chiến**, giữ TypeScript, PixiJS và boardgame.io.
Luật tham chiếu đã pin là QSanguosha-QuocChien 2.3.43-beta2 tại commit
`ce4e62b31c4d1a65de79188be11ccdd4f0ac6f9f`.

Runtime hiện vẫn đăng ký engine Standard 2013 trong lúc xây dựng bản thay thế.
Các operation Quốc Chiến đã có kiểm thử theo phạm vi; trạng thái setup `ready`
chưa phải một ván Quốc Chiến có thể chơi hoàn chỉnh.
Xem [kiến trúc và giới hạn tích hợp](knowledge/engine/architecture.md).

## Kiến thức đi cùng source

[Knowledge index](knowledge/README.md) chứa luật, hợp đồng engine, privacy,
roadmap, provenance và bằng chứng theo phiên bản. Đây là snapshot subtree của
repo kiến thức chuẩn; `knowledge.lock.json` ghi đúng commit docs đã nhập.
Clone, đổi nhánh và tạo worktree thông thường có sẵn docs trên các nhánh đã migration.

`npm run docs:verify` kiểm tra snapshot và liên kết offline.
`npm run docs:test` kiểm tra đồng bộ/clone/đổi nhánh bằng repo Git thật.
Khi sửa hợp đồng source, cập nhật repo kiến thức rồi nhập commit đã review qua
[quy trình đồng bộ](knowledge/README.md#updating-knowledge-with-the-game).
Specs/tickets tiếp tục ở [GitHub Issues](https://github.com/chuongphong12/Sanguosha-vn/issues).

## Phát triển

Dùng Node 22 và pnpm 11 như cấu hình CI. Cài dependency bằng
`pnpm install --frozen-lockfile --config.strict-dep-builds=false`.

- `npm run dev`: frontend Vite.
- `npm run serve`: server boardgame.io; cấu hình môi trường qua file local.
- `npm run check`: lint, typecheck và test game.
- `npm run build`: typecheck, xử lý asset và build frontend.
- `npm run test:e2e`: bộ Playwright hiện có; không chứng nhận parity Quốc Chiến.

Giữ các cổng kiểm tra theo [lifecycle](docs/agents/lifecycle.md).
Asset nguồn vẫn nằm trong repo game; xem [provenance](knowledge/assets/provenance.md).
