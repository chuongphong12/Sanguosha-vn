# Bản cập nhật tham khảo mỹ thuật

Đọc thêm: [Chỉ đạo thiết kế game UI và kiểm chất lượng 13 mẫu ảnh](game-ui-art-brief.md), bổ sung cụ thể cho v3 về màn hình, motion, gói art mới và cách phân việc.

> Bản hiện hành: [kế hoạch v3](../2026-09-16-ui-upgrade-plan-v3.md), [phản biện Astra](astra-design-review.md), [tham khảo internet](internet-design-research.md), [trang xem v3](review-v3.html). Phần dưới là nghiên cứu v2 lưu lại; mock `index.html` và `revised-board.png` cũ không chứng minh bố cục 8–10 người, và hướng đại ấn thường trực đã được thay thế.

Đây là bộ nghiên cứu mới, kết hợp cả `QSanguosha`, `QSanguosha-LangKhach-QuocChien`, `3qs` và code hiện tại. [Moodboard ba source](three-source-moodboard.png) cho thấy khác biệt giữa nền rồng/vân, chiến trường dàn trận, texture thành trì, nút vật liệu và banner/frames web.

Hai nguồn mới đã được đọc trực tiếp:

- `QSanguosha`: client C++/Qt Graphics View, dùng `sanguosha.qss`, drag card vào target, keyboard shortcut, sort bài và multilayer display khi nhiều bài. Đây là nguồn tốt để học interaction model và bộ khung UI cổ điển.
- `QSanguosha-LangKhach-QuocChien`: nhánh Windows/Quốc Chiến có `image/backdrop`, `image/system/button` với đủ normal/hover/down/disabled, promptbox, role/faction badge, battlefield/table background, và kho `hero-skin` lớn. Đây là nguồn tốt để học texture language, không nên bê nguyên bố cục Qt.

Các ảnh đại diện đã xem:

- `image/backdrop/table.jpg`: chiến trường dàn trận, ánh sáng trung tâm; phù hợp làm nền MatchScreen sau khi phủ gradient để giữ độ tương phản.
- `image/system/tableBg.jpg`: nền rừng xanh bị làm mờ, hợp lobby/room hơn bàn đấu chính.
- `image/system/battle.png`: thành trì cổ phong, hợp header/transition hoặc nền lobby.
- `image/system/button/platter/confirm/normal.png`: nút xác nhận có khung đá/đỏ và chữ Việt, cho thấy trạng thái nút nên là asset có vật liệu, không chỉ Graphics phẳng.
- `image/animate/*.png` và `image/system/emotion/*`: cut-in/frame tĩnh với alpha; cần atlas + pivot, không tự biến thành animation xương.

Ước lượng kho ảnh: `QSanguosha` khoảng 2.053 ảnh; `QSanguosha-LangKhach-QuocChien` khoảng 4.148 ảnh; `3qs` khoảng 2.939 ảnh; project raw-assets khoảng 2.014 ảnh. Con số lớn phản ánh skin/extension và asset legacy, không phải số màn hình hay số tướng có thể dùng trong project hiện tại. Metadata đầy đủ và hash giao nhau nằm trong [three-source-inventory.json](three-source-inventory.json).

## Vì bản trước thất bại về cảm giác Tam Quốc

`Bàn quân nghị` bản đầu dùng nền xanh phẳng, đường ellipse mảnh, ghế card đơn giản, không có texture gỗ/đồng, huy hiệu phe, vân/rồng hoặc vật liệu thẻ. Nó diễn đạt “bảng điều khiển có người ngồi” nhưng không diễn đạt “một bàn cờ Tam Quốc”. Bản sửa phải thay **visual anchor** chứ không chỉ đổi vài mã màu.

Visual anchor mới: **chiến trường nhìn từ trên xuống + mặt bàn gỗ sẫm đóng khung đồng + đại ấn ở trung tâm + đường quân lệnh như dải lụa đỏ/vàng**. Một bề mặt mang ảnh chiến trường, một hệ khung có chất liệu, một dấu ấn trung tâm. HUD và text chỉ phục vụ việc đọc.

### Token mỹ thuật mới

| Vai trò | Màu / vật liệu |
|---|---|
| Nền chiến trường | `table.jpg` hoặc battle backdrop, phủ `#160b09` 38–58% |
| Bàn | gỗ đỏ nâu `#4A2D22`, vân ảnh nhẹ, viền đen và đường đồng |
| Đồng cổ | `#D3A44F`, chỉ dùng ở khung, active seat, seal |
| Giấy thẻ | `#F3E3BC`, chữ mực `#35221D` |
| Son chiến trận | `#B52F25`, damage và trạng thái nguy hiểm |
| Ngọc hồi phục | `#5FA477`, luôn đi kèm icon/chữ |
| Mực phụ | `#241A18`, panel/log để không phá nền |

Không dùng gradient hai màu sai kiểu cho PixiJS 8 TextStyle. Lỗi hiện tại `Unable to convert color 13938487,11173914` ở `src/app/ui/typography.ts:23` phải sửa trước khi đánh giá runtime tiếp.

## Bố cục mới

```text
┌ ấn game + phòng ───────── phase/turn ───────── connection/settings ┐
│                dải lụa / tiến trình giải quyết                     │
│  ghế có huy hiệu phe     [đại ấn + vùng phân giải]   ghế có huy hiệu │
│        nguồn ────────╲   SÁT / NÉ / KỸ NĂNG   ╱────── đích           │
├ prompt cố định: “P2 dùng Sát vào P4” ───── Hủy / Xác nhận            ┤
│ tướng mình + trang bị │ tay bài xếp lớp │ kỹ năng / log thu gọn     │
└──────────────────────────────────────────────────────────────────────┘
```

Ở 1366×768, bàn không được tạo document dài để cuộn. Card nhỏ hiển thị tên/chất/số bằng text tách khỏi art; số bài nhiều thì xếp lớp hoặc cuộn trong vùng tay bài. Ghế chết giữ vị trí và chỉ lộ role khi state xác nhận death.

### Sáu màn hình

`BootScreen → LobbyScreen → RoomScreen → GeneralSelectScreen → MatchScreen → ResultScreen`.

Settings, Rules Library, Card Inspector, PrivateRolePeek, HotseatHandoff, Prompt, Reconnecting, MatchIntro, PublicRoleReveal và MatchOutro là overlay/drawer. `MatchSession` giữ kết nối xuyên màn hình; không để `MainScreen.reset()` hủy trận khi chuyển view.

### Motion spec

- MatchIntro: đại ấn đóng dấu, nền chiến trường hiện, nhân vật/role riêng xuất hiện; 900–1.300 ms, có Skip.
- Card play: lá rời tay bài → dải lụa nối nguồn tới mục tiêu → chờ response → nhãn kết quả; 180–450 ms mỗi đoạn.
- Skill: tên kỹ năng + huy hiệu tướng ở nguồn; cut-in lớn chỉ dành event hiếm, 650–900 ms.
- Damage: chỉ sau event damage authoritative; slash/fire/thunder + số −HP 200–350 ms.
- Death/reveal: hấp hối vẫn úp; sau death confirmed mới lật seal role 600–900 ms.
- End: kết liễu → reveal công khai → ResultScreen 1.200–1.800 ms.

Reduced motion bỏ rung/flash/parallax, giữ fade và text. Cinematic không được kéo dài deadline server hoặc chặn prompt.

## Đề xuất học từ mỗi source

| Học từ | Đưa vào project thế nào |
|---|---|
| Qt `sanguosha.qss` | Một state-machine cho normal/hover/down/disabled/focus; viết Pixi Button/NineSlice dùng chung |
| Drag card to target | Cho phép kéo lá Sát lên ghế, nhưng vẫn có click/keyboard/touch fallback |
| Multilayer hand | Quạt nhẹ 5–8 lá; trên 15 lá chuyển xếp lớp + scroll, không thu chữ còn 7 px |
| LangKhach button assets | Dùng làm moodboard cho khung, nhưng text/role/card mới phải có registry quyền và độ phân giải |
| Battlefield backdrop | Nền MatchScreen thật, luôn phủ lớp tối/blur cục bộ sau card để giữ khả năng đọc |
| Faction/role badges | Huy hiệu nhỏ ở seat/header; màu phe không thay cho identity role |
| Hero-skin hierarchy | Avatar ở seat, card art ở Inspector, fullskin chỉ cho MatchIntro/cut-in; tránh phóng avatar làm portrait HD |

## Tài nguyên và quyền

Asset registry cần ghi `source`, `sha256`, `width/height`, `pivot`, `intendedCSSSize`, `license`, `attribution`, `allowedModification`. Ảnh 93×130 chỉ dùng thumbnail; master card mới tối thiểu khoảng 512×716 cho 240×336 CSS ở DPR2. Không copy bulk kho 4.148 ảnh.

README của nguồn khai báo art/audio/font CC BY-NC-ND 4.0 và code có MCFR hạn chế thương mại. Có thể dùng làm moodboard/nội bộ; dùng để phát hành chỉ sau khi quyền của từng asset được xác nhận. Tách chữ Việt khỏi ảnh có chữ Trung và tạo bộ role riêng.

## Mốc làm lại

1. P0: sửa typography runtime, asset fallback, xác nhận 1366×768 smoke.
2. P1: thay nền/bàn/khung/seat/button thật, giữ một lát cắt Sát→Né→damage.
3. P2: tách MatchSession và sáu screen.
4. P3: đưa drag/card target, prompt tray, multilayer hand, role privacy.
5. P4: event-typed Presentation, atlas/pivot cho slash/fire/thunder/jink/peach/judge/equip.
6. P5: MatchIntro, reveal death, end reveal/result.
7. P6: kiểm tra 4–10 người, tablet ngang, reduced motion, asset/license QA và profiling.

Không cần thêm framework UI mới: giữ PixiJS 8, boardgame.io, Motion, @pixi/sound và AssetPack. Thay đổi lớn nằm ở visual language, screen ownership và event presentation.


---

## Canonical handoff

**Tài liệu triển khai hiện hành:** [UI upgrade v4 Gemini handoff](../2026-09-20-gitnexus-plan-ui-upgrade-handoff.md), đã đối chiếu source commit 738579454b39ad22ab7b0dd3608f9aebe5f695e6. Các phần trong file này chỉ dùng làm research/provenance, không dùng để kết luận tình trạng code hiện tại.
