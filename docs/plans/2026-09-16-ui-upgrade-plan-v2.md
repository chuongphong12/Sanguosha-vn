# Nâng cấp UI toàn diện — đối chiếu ba source

> Đã được thay thế bởi [v3 sau phản biện Astra và khảo sát internet](2026-09-16-ui-upgrade-plan-v3.md). Giữ bản này để truy lịch sử; các số UI-code, khẳng định runtime và bố cục mock đã được đính chính trong v3.

Ngày khảo sát lại: 16/09/2026. Thiết bị ưu tiên: PC/laptop, sau đó tablet ngang. Đây là bản nghiên cứu độc lập được làm lại sau khi các research trước bị xoá.

## Kết luận thiết kế

Bản UI hiện tại có nhiều logic điều khiển nhưng hình ảnh vẫn giống một canvas debug: nền xanh/texture yếu, ghế và nút chưa có vật liệu Tam Quốc, dashboard chiếm chiều cao lớn, role card chiếm diện tích tay bài, và MainScreen dựng lại nhiều object thay vì giữ bàn sống. Tôi chọn hướng **chiến trường trên bàn**: nền dàn trận thật, mặt bàn gỗ đỏ nâu viền đồng, huy hiệu phe/role, đại ấn trung tâm và dải quân lệnh chạy từ nguồn tới mục tiêu.

Visual anchor này lấy đúng tinh thần ba source mà không sao chép nguyên layout: `QSanguosha` cho thao tác, `LangKhach-QuocChien` cho chất liệu và hierarchy asset, `3qs` cho flow prompt/thư viện/web state. Mục tiêu là nhìn vào game đã biết Tam Quốc trước khi đọc chữ.

## Audit ba source tham khảo

| Source | Điều đã kiểm tra | Học được | Không dùng nguyên trạng |
|---|---|---|---|
| `QSanguosha` | Client C++/Qt Graphics View, `sanguosha.qss`, `image/animate`, `image/big-card`, `image/system` | Kéo card vào target; phím tắt; sort bài; multilayer khi tay bài dài; QSS có border-image, trạng thái control | UI Qt legacy nhiều panel; không lấy làm bố cục responsive |
| `QSanguosha-LangKhach-QuocChien` | Kho `image`, `hero-skin`, `sanguosha`/style resources; button normal/hover/down/disabled, promptbox, role/faction badge, battlefield | Vật liệu gỗ/đồng/đỏ; nút có state thật; fullskin/avatar/card có hierarchy; background `table.jpg`, `battle.png`, `tableBg.jpg` | Không copy bulk skin/extension; không giả định mọi art có quyền hoặc mọi role là luật project |
| `3qs` | `webport/public/index.html` và server; lobby, room, library, 3 candidate cards, hand, prompt, log, CSS hit/heal/shake/float | Flow web rõ; filter bằng trạng thái; prompt theo card/target; fallback DOM dễ truy cập | 1440×900 có document cao ~1.709 px; phải cuộn; log `room.ts:139` lộ role đầu ván; `server.ts:549` gửi log cuối |

Số lượng audit bằng Sharp (bỏ `.git`, `node_modules`, build output): `QSanguosha` 2.053 ảnh/116,8 MB/17 file UI-code; `QSanguosha-LangKhach-QuocChien` 4.148 ảnh/363,9 MB/12 file UI-code, riêng `hero-skin` 1.174 ảnh; `3qs` 2.939 ảnh/185,7 MB/13 file UI-code; project `raw-assets` 2.014 ảnh/122,2 MB. Hash giao nhau: current–3qs 1.013; current–LangKhach 1.015; 3qs–LangKhach 2.646. Chi tiết lưu tại [three-source-inventory.json](ui-upgrade/three-source-inventory.json).

### Nguồn ảnh nên dùng thế nào

- `LangKhach/image/backdrop/table.jpg`: nền chính MatchScreen, phủ tối 38–58% và vignette để không phá chữ.
- `LangKhach/image/system/battle.png`: header/lobby/transition; `tableBg.jpg`: nền phụ mờ.
- `QSanguosha/backdrop/default.jpg`: texture rồng/vân đẹp cho role peek, mặt bàn phụ hoặc frame; không dùng full-screen vì tương phản thấp.
- `LangKhach/image/system/button/platter/*`: moodboard cho nút normal/hover/down/disabled/focus; text và border phải được registry riêng khi chuyển sang Pixi.
- `hero-skin/full` 250×292 và avatar 276×233: dùng seat/inspector/cut-in nhỏ; không phóng thành portrait HD.
- Card 93×130 chỉ thumbnail; big-card 200×281 chỉ cỡ nhỏ. Master card mới tối thiểu khoảng 512×716 cho 240×336 CSS ở DPR2, text/suit/rank tách lớp.
- `image/animate` là cutout tĩnh. `image/system/emotion` là PNG frame, cần atlas, frame sort số, pivot và blend mode. Không có Spine skeleton/atlas trong kho tham khảo.

README nguồn khai báo art/audio/font CC BY-NC-ND 4.0; code có GPLv3 cộng MCFR hạn chế thương mại. Registry phải ghi source, SHA-256, kích thước, pivot, CSS size, license, attribution và allowed modification. Có thể dùng để audit/moodboard; phát hành phải xác minh từng asset.

## Đối chiếu code UI hiện tại

- `src/app/screens/main/MainScreen.ts` là screen rất lớn, `render()` gọi `clearContent()` và destroy/rebuild nhiều phần. Điều này làm animation mất anchor, dễ làm lại prompt và tạo leak/ticker nếu thêm tween trực tiếp.
- `Dashboard.ts` dành panel cao 240, avatar 180×224 và role card 180×224. Role nên thành badge/peek overlay; mô tả skill dài chuyển vào Inspector.
- `SeatView.ts` dùng avatar 140×160, có target glow và hand badge; giữ logic nhưng cần skin frame, faction badge, death/reveal state và compact layout theo số người.
- `CardView.ts`/`assetAliases.ts` đã có catalog/alias và interaction; cần text layer rõ ở DPR1/2, click/drag/keyboard dùng chung.
- `LobbyUI.ts` đang dùng DOM cho form, password, offline và danh sách phòng; giữ DOM, làm lại visual theo texture/skin, không chuyển form sang Pixi.
- `MatchClient.ts` có local hotseat và remote; quyền sở hữu client nên ra khỏi MainScreen để chuyển screen không làm mất session.
- `player-view.ts` lọc hand/role/candidates, nhưng trả `effectStack: []`; `EventBus`/engine vẫn có effect stack authoritative. UI không được suy hiệu ứng bằng HP delta hoặc parse log.
- `src/app/ui/typography.ts:23` hiện ném `Unable to convert color ...` vì PixiJS 8 không nhận mảng hai số hex như đang truyền vào TextStyle. P0 phải sửa bằng màu hợp lệ hoặc `FillGradient` đúng kiểu rồi chạy smoke runtime nguyên trạng.

## Kiến trúc screen

`BootScreen → LobbyScreen → RoomScreen → GeneralSelectScreen → MatchScreen → ResultScreen`.

Overlay/drawer: `Settings`, `RulesLibrary`, `CardInspector`, `GeneralInspector`, `PrivateRolePeek`, `HotseatHandoff`, `Prompt`, `Reconnecting`, `MatchIntro`, `PublicRoleReveal`, `MatchOutro`.

| Screen | Nhiệm vụ người chơi | Nội dung |
|---|---|---|
| Boot | Biết tải đến đâu, thử lại | Logo, progress bundle thiết yếu, lỗi font/asset/network |
| Lobby | Chọn chơi và vào phòng | Tên, danh sách phòng, tạo/join/offline, library/settings |
| Room | Biết ai sẵn sàng | 4–10 ghế, người/bot/trống, host, rule pack, start |
| General Select | Đọc role riêng và chọn tướng | Chủ Công trước, candidates riêng, skill preview, confirm |
| Match | Thực hiện nước đi hợp lệ | Bàn, seat, hand, equipment, prompt tray, log drawer |
| Result | Hiểu ai thắng và vì sao | winner từ engine, điều kiện, reveal toàn bàn, rematch/leave |

`MatchSession` giữ socket/client, credentials, snapshot, reconnect và round ID xuyên screen. `ScreenCoordinator` chỉ chọn screen từ status; screen không sở hữu session.

## Bố cục MatchScreen

```text
┌ ấn game/phòng ───────── phase · turn · countdown ───────── kết nối ┐
│ các ghế trên và badge phe/role, vị trí cố định                     │
│ nguồn ───── dải quân lệnh / vùng phân giải / đại ấn ───── mục tiêu │
├ prompt: “P2 dùng Sát vào P4” ─── Hủy / Xác nhận / Bỏ qua            ┤
│ avatar + equipment │ tay bài multilayer/scroll │ skill + log drawer │
└────────────────────────────────────────────────────────────────────┘
```

1366×768 là tiêu chí chính, không scale mù từ 1024×860. Header 48–56 px; prompt 48–64 px; dashboard 176–208 px; log mặc định drawer 220–260 px. Card hitbox tối thiểu 44 px. 4 người một ghế trên/hai bên; 5–8 chia top/hai bên; 9–10 tối đa ba ghế mỗi bên. Ghế chết giữ vị trí.

Tay bài dùng multilayer/scroll riêng khi >10–12 lá; không giảm text còn 7 px. Role là badge + nút `Xem thân phận`, không chiếm thêm 180×224. Skill description mở trong Inspector. Màu phe là nhận diện phụ, không thay role identity.

## Luồng chuyển cảnh và identity

- Boot→Lobby: nền/ấn game hiện trước, control sau, 180–280 ms.
- Lobby→Room: room card mở thành ghế, 250–350 ms.
- Room→GeneralSelect: tối nền, role peek riêng, candidates trải ngang, 450–650 ms.
- GeneralSelect→Match: portrait thu về seat/dashboard, 450–650 ms.
- MatchIntro: đại ấn đóng dấu, battlefield hiện, chia bài, Chủ Công sáng lên, tổng ≤1.300 ms, có Skip.
- Turn/phase: viền seat và phase strip đổi 150–250 ms; không cinematic toàn màn mỗi lượt.
- Dying: vòng cảnh báo + `Cần Đào`; không lật role.
- Dead confirmed: ghế local lật role 600–900 ms, role giữ nguyên sau đó.
- End: kết liễu đã xác nhận → public reveal → Result 1.200–1.800 ms.

Ba quyền xem phải tách rõ: `PrivateRolePeek` chỉ owner/hotseat hiện tại; `PublicRoleReveal` chỉ người đã chết hoặc người bị rule reveal; `ResultScreen` mới lộ toàn bàn. Log và event cũng filter, không thể giấu role bằng CSS sau khi đã gửi.

## BattlePresentation

Tạo module sâu với interface nhỏ: `consume(events)`, `sync(snapshot)`, `setPreferences()`, `dispose()`. Event authoritative dạng discriminated union:

```ts
type PresentationEvent = {
  id: string; roundID: string; sequence: number; stateVersion: number;
  kind: 'card-played'|'response-resolved'|'damage-resolved'|'hp-lost'
    |'healed'|'cards-moved'|'judgement-resolved'|'skill-activated'
    |'player-died'|'role-revealed'|'game-ended';
  payload: unknown; // đã lọc theo viewer
};
```

Event có dedupe bằng `id`, backlog rút gọn khi >1 giây, không chạy lại sau reconnect, không sửa state và không gọi `move` trong callback. BattleView giữ object theo `playerID/cardID/zoneID`; resize chỉ cập nhật anchor, không destroy cả bàn.

### Ngữ pháp hiệu ứng

`ra bài/kích hoạt → nguồn/đích → chờ hồi đáp → phân giải → kết quả`. Sát thường dùng đường son và slash frame; Né chặn đường và badge Né; fire/thunder đổi vật liệu; Đào dùng vòng ngọc +HP; Duel dùng dây nối hai seat; AoE đánh dấu từng mục tiêu; Vô Giải dùng shield; judgement có vùng lá phán; equip đi vào đúng slot; HP loss trực tiếp không giả dạng damage.

Skill chia passive (badge nhỏ), active/convert (preview lá và chi phí), response (prompt ưu tiên), rare cut-in (650–900 ms, chỉ tướng/art đủ chất lượng). Âm thanh chia UI/card/combat/voice/music, tối đa một voice nổi bật; mute/reduced-motion vẫn đủ thông tin.

## Mốc triển khai

1. P0 (1–3 ngày công): sửa typography, asset fallback, smoke thật 1366×768.
2. P1 (4–6): token, texture battlefield, table frame, seat/button state, lát cắt Sát→Né→damage.
3. P2 (4–7): MatchSession, Coordinator, sáu screen, reconnect/hotseat privacy.
4. P3 (4–6): prompt tray, drag target, multilayer hand, General/Card Inspector.
5. P4 (5–8): typed event, atlas/pivot/pool, slash/fire/thunder/jink/peach/judge/equip.
6. P5 (3–5): MatchIntro, death reveal, outro, ResultScreen.
7. P6 (4–6): tablet ngang, accessibility, performance, registry quyền và asset QA.

Tổng sơ bộ 25–41 ngày công kỹ thuật, chưa tính art/voice mới. Release đầu nên dừng ở P0–P3 + feedback combat cơ bản; cinematic hoàn thiện sau khi bàn và privacy ổn định.

## Nghiệm thu

Kiểm tra 4/5/6/7/8/9/10 người; 1366×768/1440×900/1920×1080/1024×768; 1/6/15/20 lá; tên tướng/skill dài; mọi prompt hiện có; Sát/Né/Duel/AoE/Vô Giải/judge/equip/rescue; reconnect ở chọn tướng/prompt/death/result; owner/dead/ended role privacy; keyboard/touch/reduced motion; frame sort/pivot/alpha; thiếu asset/audio; lặp vào/rời match 20 lần không tăng listener/ticker/object; 60fps warm-up trên laptop công bố.

Không thêm framework UI mới: giữ PixiJS, boardgame.io, Motion, @pixi/sound và AssetPack. Thay đổi lớn là visual language, ownership, layout và event presentation.


---

> **Đã thay thế.** Dùng [UI upgrade v4 Gemini handoff](2026-09-20-gitnexus-plan-ui-upgrade-handoff.md) cho mọi triển khai từ commit 7385794 trở đi.
