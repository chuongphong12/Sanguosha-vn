# Kế hoạch nâng cấp UI — hướng Tam Quốc (bản cũ)

> Bản nghiên cứu được làm lại sau khi tham khảo đồng thời ba source nằm tại [2026-09-16-ui-upgrade-plan-v2.md](2026-09-16-ui-upgrade-plan-v2.md). Dùng bản v2 làm tài liệu chuẩn.

## Quyết định mới

Bản “bàn quân nghị” trước quá phẳng và thiếu dấu hiệu Tam Quốc. Hướng mới dùng chiến trường dàn trận làm visual anchor, khung gỗ đỏ nâu viền đồng, huy hiệu phe/role, đại ấn trung tâm và dải quân lệnh nối nguồn với mục tiêu. Xem bản duyệt trực quan tại [bàn chiến trường](ui-upgrade/index.html).

## Đối chiếu ba source

`QSanguosha` là client C++/Qt Graphics View, có `sanguosha.qss`, kéo card vào mục tiêu, phím tắt, sort bài và multilayer hand. `QSanguosha-LangKhach-QuocChien` bổ sung kho texture lớn, battlefield/table backdrop, bộ nút đủ normal/hover/down/disabled, promptbox, role/faction badges và hero-skin. `3qs/webport` là HTML/CSS/JS đơn giản hơn, dễ đọc flow nhưng bố cục trận bị kéo dài để cuộn và log làm lộ role quá sớm.

Project hiện tại có lợi thế PixiJS/AssetPack/Motion, SeatView, CardView, Dashboard, player-view và validators; điểm cần làm là giữ bàn không cuộn, sửa typography runtime, tách MatchSession khỏi MainScreen, và tạo event trình diễn typed thay vì suy VFX từ thay đổi HP/log.

## Màn hình và chuyển tiếp

`BootScreen → LobbyScreen → RoomScreen → GeneralSelectScreen → MatchScreen → ResultScreen`.

Settings, Rules Library, Card Inspector, PrivateRolePeek, HotseatHandoff, Prompt, Reconnecting, MatchIntro, PublicRoleReveal và MatchOutro là overlay/drawer. MatchSession giữ client và snapshot xuyên các screen; reset screen không được destroy match.

- Boot: logo, progress tải thật, lỗi và retry.
- Lobby: tạo/vào phòng, offline, thư viện, cài đặt.
- Room: ghế, người thật/bot, sẵn sàng, gói luật, start.
- General Select: role riêng, ứng viên riêng, Chủ Công chọn trước, đọc skill rồi xác nhận.
- Match: bàn chiến trường, ghế 4–10 người, tay bài trong màn hình, prompt cố định và log thu gọn.
- Result: winner từ engine, điều kiện thắng, lộ toàn bộ role sau ended, đường về phòng/sảnh.

PC chính: 1366×768, 1440×900, 1920×1080. Tablet ngang: 1024×768. Không dùng toàn trang cuộn trong Match. Tay bài nhiều dùng multilayer/scroll riêng; chữ không giảm xuống 7 px. Layout vùng: 4 người một ghế trên/hai bên; 5–8 chia top và hai bên; 9–10 tối đa ba ghế mỗi bên, ghế chết giữ vị trí.

## Ngữ pháp hiệu ứng

`ra bài/kích hoạt → nguồn/đích → hồi đáp → phân giải authoritative → kết quả`. Dải quân lệnh là signature: lá rời tay, nối tới seat, chờ Né/Vô Giải, sau đó mới phát hit/damage. Prompt luôn được ưu tiên hơn cinematic.

Các family: Sát thường, Né, Sát lửa/sấm, Đào/cứu, Quyết Đấu, AoE, Vô Giải, phán xét, rút/cướp/bỏ, trang bị, mất HP trực tiếp, chain/mark. Kỹ năng chia passive, active/convert, response, rare cut-in; không phát cut-in cho mọi skill.

- Khai chiến: đại ấn + dải chiến trường, 900–1.300 ms, Skip.
- Skill: tên skill + nguồn, 180–450 ms; cut-in hiếm 650–900 ms.
- Damage: slash/fire/thunder + số −HP, 200–350 ms, chỉ sau event xác nhận.
- Cứu: vòng ngọc +HP; dying không lộ role.
- Death/reveal: chỉ sau death confirmed, role seal lật 600–900 ms.
- End: kết liễu → public reveal → result 1.200–1.800 ms.

Reduced motion bỏ rung/flash/parallax, giữ fade/chữ. VFX không thay state, không gọi move trong callback, không kéo dài server deadline, không phát lại khi reconnect.

## Tài nguyên và chất lượng

Nguồn mới có khoảng 2.053 ảnh (`QSanguosha`) và 4.148 ảnh (`LangKhach`). Kho `3qs` trước đó có 2.939 ảnh; raw hiện tại đã trùng SHA-256 1.125 file. Tận dụng có chọn lọc, không copy bulk.

- `backdrop/table.jpg` và `image/system/battle.png`: phù hợp nền MatchScreen/lobby sau phủ tối.
- `image/system/tableBg.jpg`: nền phụ mờ, không làm tâm bàn.
- Button normal/hover/down/disabled: học hệ trạng thái và vật liệu.
- `hero-skin/full`: chỉ dùng portrait/cut-in khi độ phân giải đủ; avatar không phóng thành portrait HD.
- `animate` là cutout tĩnh; `system/emotion` là PNG frames cần atlas, thứ tự số và pivot.
- Card 93×130 chỉ thumbnail; card 200×281 chỉ cỡ nhỏ. Master mới nên tối thiểu 512×716 cho khoảng 240×336 CSS DPR2.

Registry bắt buộc có source, hash, kích thước, pivot, CSS size, license, attribution và allowed modification. README nguồn khai báo art/audio/font CC BY-NC-ND 4.0; code có MCFR. Dùng nội bộ/moodboard được ghi rõ; phát hành cần xác minh từng asset.

## Kiến trúc và mốc

Giữ PixiJS 8.20.1, boardgame.io 0.50.2, Motion, @pixi/sound, AssetPack. Tách các deep module: MatchSession, ScreenCoordinator, BattleView, ActionController, PromptPresenter, BattlePresentation, AssetRegistry. Event có id/roundID/sequence/stateVersion/kind và payload đã lọc viewer.

P0 sửa lỗi `src/app/ui/typography.ts:23` (`TextStyle.fill`), fallback asset, smoke thật. P1 thay background/table/seat/button và lát cắt Sát→Né→damage. P2 tách screen/session. P3 hoàn thiện prompt/drag/multilayer hand. P4 event/atlas/VFX. P5 intro/reveal/result. P6 tablet, reduced motion, performance, quyền asset.

Nghiệm thu: 4–10 người, 1366×768, 15–20 card, tên skill dài, mọi prompt hiện có, reconnect ở prompt/death/result, role privacy owner/dead/ended, keyboard/touch/reduced motion, không lặp event, không leak ticker/listener.


---

> **Đã thay thế.** Dùng [UI upgrade v4 Gemini handoff](2026-09-20-gitnexus-plan-ui-upgrade-handoff.md) cho mọi triển khai từ commit 7385794 trở đi.
