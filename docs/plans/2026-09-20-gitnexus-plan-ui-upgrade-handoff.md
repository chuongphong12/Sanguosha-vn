# Nâng cấp UI Tam Quốc Sát v4 — handoff triển khai cho Gemini

> **Trạng thái:** canonical implementation plan. Thay thế các quyết định triển khai trong `2026-09-16-ui-upgrade-plan*.md`.
>
> **Nguồn code đã kiểm tra:** commit `738579454b39ad22ab7b0dd3608f9aebe5f695e6` (`fix: Resolve build errors on Vercel`, 18/09/2026).
>
> **Thiết bị ưu tiên:** PC/laptop 1366×768 trước; tablet ngang 1024×768 sau. Không tối ưu điện thoại trong scope này.
>
> **Giới hạn bằng chứng:** GitNexus CLI/MCP không khả dụng trong môi trường lập kế hoạch; mọi nhận định dưới đây là source-derived, không phải graph-derived. Công cụ provenance an toàn của GitNexus cũng từ chối ghi trên Windows. Đây không miễn trừ quy tắc trong `AGENTS.md`: trước khi Gemini sửa production symbol, phải chạy impact bằng GitNexus. Nếu runtime Gemini cũng thiếu công cụ, dừng source edit, ghi blocker và khôi phục công cụ/index; source/test chỉ là bằng chứng bổ sung, không thay thế impact bắt buộc.

## 1. Mục tiêu và quyết định thiết kế

Biến giao diện hiện hữu thành **trận đồ dưới chiến kỳ**: võ tướng là điểm nhận diện chính, chiến địa nằm phía sau, bài và prompt có vùng xử lý rõ ràng. Tránh bàn quân nghị phẳng, con dấu khổng lồ thường trực và hình nền tranh chấp với thông tin game.

Kết quả cần đạt:

1. Trận 4–10 người đọc được ở 1366×768, sau đó 1024×768 ngang.
2. Chuyển cảnh, đánh bài, phản hồi, kỹ năng, lộ thân phận và kết thúc trận có animation đúng **nguyên nhân và kết quả luật**.
3. Không thay đổi luật game, không làm lộ bài, tướng, thân phận, response hoặc effect nội bộ.
4. Giữ các component đã có (`CardView`, `SeatView`, `Dashboard`, `GeneralCardView`) nhưng cho phép thêm interface `sync/update` và layout API của chúng; không viết lại card/asset system.
5. Mỗi milestone vẫn chơi được local hot-seat, local bots và remote.

### Ngôn ngữ hình ảnh

- **Nền:** tranh chiến địa tối ở mép, trung tâm ít chi tiết để đọc lá bài và kết quả.
- **Ghế tướng:** chân dung chữ nhật trên khung sơn then/viền đồng; cờ phe, HP, trang bị, trạng thái lượt và tử trận bám ghế.
- **Người chơi hiện tại:** chiến kỳ và viền sáng có nhịp nhẹ; không dùng flash toàn màn hình.
- **Bài:** giấy sáng, chữ Việt rõ, rank/suit luôn đọc được; inspector dùng khi cần luật dài.
- **Con dấu:** chỉ xuất hiện khi khai trận, tử trận, lộ thân phận và kết quả.
- **Motion:** hiệu ứng lớn chỉ dành cho kết quả đã authoritative; trạng thái kéo dài dùng badge/viền tại ghế.

## 2. Hiện trạng đã xác minh

### Luồng ứng dụng

- `src/main.ts` khởi tạo Pixi, `LoadScreen`, lobby DOM và sau đó `MainScreen`.
- `MainScreen` là renderer immediate-mode duy nhất: `receiveState()` gọi `render()`, còn `render()` gọi `clearContent()` rồi dựng lại toàn bộ màn hình. `resize()` cũng render lại. Xem `src/app/screens/main/MainScreen.ts:269–329, 329–380, 2967–2973`.
- `MIN_LAYOUT_HEIGHT = 860`, vì vậy primary viewport 1366×768 bị scale theo chiều cao thay vì có layout PC thực sự. Xem `MainScreen.ts:67, 321–325`.
- Bàn chờ, selector người xem, ghế, log, dashboard, chọn tướng và role popup đều nằm trong cùng `MainScreen`. `drawLog()` luôn chiếm cột phải 280px; dashboard nhận chiều rộng viewport trừ 280px. Xem `MainScreen.ts:346–383, 990–1050, 1054–1140`.
- Popup role, rescue, AOE và nullification là các overlay trong cùng renderer. Xem `MainScreen.ts:105–185, 1907–1912, 2204–2580`.

### Những phần đã có và phải tái sử dụng

- `CardView` hiển thị art, suit/rank, tên Việt, select/dim.
- `SeatView` dùng `PlayerAvatar`; `Dashboard` đã có hand fan, click và khu tướng/trang bị/thân phận. `handScrollX`/`onScroll` mới chỉ có trong options, chưa được sử dụng trong `Dashboard`; tay bài 20 lá có thể truy cập được là công việc M1, không phải năng lực hiện hữu.
- `assetAliases.ts` đã map toàn bộ card catalog, equipment, equipment icon, portrait 27 tướng và icon 4 phe. `tests/ui/asset-aliases.test.ts` kiểm tra đủ coverage.
- `MatchClient` đã phân biệt remote, local hot-seat và local bots. `isHotseat` chỉ true với local không có bot; remote không đổi viewer. Xem `src/client/MatchClient.ts:30–120`.
- `TqsGame` hỗ trợ 4–10 người, chờ phòng, chọn chủ công/chọn tướng và trạng thái `ended`. Xem `src/game/TqsGame.ts:28–100`.

### Ràng buộc riêng tư và luật

- `createPlayerView()` che hand đối thủ, role chưa reveal, general trước khi được phép, ứng viên của người khác, processing Guan Xing và **toàn bộ `effectStack`**. Nó hiện trả `...G_rest`, vì vậy bất kỳ raw event buffer mới nào cũng phải được tách rõ khỏi spread và project theo allowlist; không được dựa vào việc “snapshot đã che”. Xem `src/game/player-view.ts:3–61`; test ở `tests/security/player-view.test.ts`.
- `EventBus` hiện đẩy trigger vào `effectStack`. Nó là dữ liệu phân giải authoritative, không phải feed animation client. Xem `src/game/engine/EventBus.ts:14–43`.
- Prompt tồn tại ở nhiều dạng, đặc biệt card-response cho rescue/nullification/AOE. Animation không được suy diễn từ click hay từ một lá bài vừa xuất hiện: phải chờ outcome authoritative.
- `PlayCardInput` có thể là card chuyển hoá (`as`) với material card khác. VFX phải hiển thị identity công khai hợp lệ, không coi `cardID` vật liệu là lá skill đã dùng.

### Chất lượng và lỗi hiện hữu cần triage trước

1. `npm.cmd run lint` và `npm.cmd run typecheck` đã hoàn tất trong lần scan; lint còn 36 warning.
2. Full test run không hoàn tất: trước khi dừng do kéo dài, nó báo `tests/ui/layout.test.ts` và nhiều test kỹ năng/rule. Không dùng con số pass-rate trong tài liệu cũ làm baseline.
3. `layoutActionRow()` mặc định button height 40, trong khi test có kỳ vọng hình học theo 48. `MainScreen.addButton()` còn ép `height === 48` thành 40. Quyết định UX và test phải được thống nhất, không sửa test để che lỗi. Xem `src/app/ui/layout.ts` và `MainScreen.ts:2940–2965`.
4. Chuỗi preload font trong `src/app/ui/typography.ts` cần screenshot browser để xác minh encoding tiếng Việt; output console Windows không đủ tin cậy, nhưng source có dấu hiệu chuỗi mojibake.
5. `PlayerAvatar` có death stamp tiếng Trung; thay bằng copy tiếng Việt hoặc glyph đã được chấp nhận. Xem `src/app/ui/PlayerAvatar.ts`.

## 3. Kiến trúc mục tiêu

Không tách mọi primitive thành module nhỏ. Tạo ba **module sâu** với interface hẹp để giữ logic animation, input và privacy tập trung.

### 3.1 `MatchSessionController` — ownership của phiên

`MainScreen` hiện sở hữu tạo/hủy `MatchClient`, subscription và state UI. Giữ ownership đó trong một module tên rõ ràng thay vì làm thêm client song song.

```ts
interface MatchSessionController {
  connect(config: MatchConfig): void;
  subscribe(listener: (snapshot: MatchSnapshot) => void): () => void;
  switchViewer(playerID: PlayerID): void;
  move(name: string, ...args: unknown[]): void;
  dispose(): void;
}
```

Nó không render, không chứa tween và không tự suy diễn event.

### 3.2 `BattleScene` — scene persistent

`BattleScene` sở hữu container cố định: `backgroundLayer`, `seatLayer`, `boardLayer`, `dashboardLayer`, `promptLayer`, `logLayer`, `overlayLayer`, `vfxLayer`. `SeatView`, `Dashboard`, `PlayerAvatar` và `CardView` phải có `sync/update` explicit; constructor-only object không được giữ snapshot, callback, HP, card selection hay texture của viewer cũ.

```ts
scene.sync(snapshot: MatchSnapshot): void;
scene.play(events: readonly PresentationEvent[]): void;
scene.resize(viewport: Viewport): void;
scene.dispose(): void;
```

`sync()` đồng bộ trạng thái hiện tại ngay cả khi reconnect/skip animation. `play()` chỉ phát event có sequence mới. Không xoá scene khi snapshot thay đổi; update entity theo `playerID`, `cardID` và prompt ID. Card back của đối thủ phải key theo `ownerID + slot`, không key theo literal `"hidden"` lặp lại trong player view.

`MatchSessionController` giữ đúng **một** subscription nền của `MatchClient` rồi fan-out cho scene listeners. `MatchClient.subscribe()` hiện chỉ giữ một listener và `switchViewer()` thay listener; vì vậy cleanup của listener cũ không được vô tình unsubscribe listener mới. `MatchSnapshot` phải chứa `matchID`, session epoch, viewerID, mode, connection/loading state, revision, filtered `G`, stream envelope và cursor.

Scene transition chỉ deactivate/dispose visual resources của scene đi; session chỉ `destroy()` khi rời match. Không gọi navigation path hiện có nếu nó dẫn tới `MainScreen.reset()` và phá `MatchClient`. Hủy Motion handles, timer và callback bất đồng bộ trước khi hủy Pixi targets; không destroy shared `Assets` textures.

### 3.3 `PresentationStream` — event contract riêng tư

Chốt **một bounded JSON-serializable ring buffer trong authoritative `G`** thay vì server-only adapter: Local bots và SocketIO đều đã dùng state path này. Raw server event và projected player event là hai type khác nhau. Mỗi envelope có `matchEpoch`, `retentionFloor`, `highWatermark`, `viewerScope` và event base `sequence`, `turn`, `correlationID`, `parentCorrelationID`; counter khởi tạo cùng state và tăng đơn điệu trong epoch.

```ts
type PresentationBase = {
  sequence: number; matchEpoch: number; turn: number;
  correlationID: string; parentCorrelationID?: string;
};
type PresentationEvent =
  | (PresentationBase & { kind: "card-committed"; actorID: PlayerID; card: PublicCardRef; material?: PublicMaterialRef; targetIDs: PlayerID[] })
  | (PresentationBase & { kind: "response-window-opened"; promptID: number; windowID: string; eligibleActorIDs: PlayerID[]; targetID?: PlayerID; response: ResponseKind })
  | (PresentationBase & { kind: "response-accepted"; promptID: number; windowID: string; actorID: PlayerID; response: ResponseKind; remainingRequired?: number })
  | (PresentationBase & { kind: "target-outcome"; targetID: PlayerID; outcome: "evaded" | "damaged" | "prevented" | "redirected"; amount?: number; nature?: DamageNature })
  | (PresentationBase & { kind: "hp-changed"; targetID: PlayerID; from: number; to: number; cause: "damage" | "loss-of-hp" | "recover" })
  | (PresentationBase & { kind: "skill-invoked"; ownerID: PlayerID; skillID: string; targetIDs: PlayerID[] })
  | (PresentationBase & { kind: "role-revealed"; playerID: PlayerID; role: Role })
  | (PresentationBase & { kind: "player-died"; playerID: PlayerID })
  | (PresentationBase & { kind: "match-ended"; winners: PlayerID[] });
```

Quy tắc bắt buộc:

- Chỉ emit sau khi mutation luật tương ứng đã được xác nhận.
- `createPlayerView()` phải destructure raw buffer trước `...G_rest`, rồi project bằng allowlist. Không copy `PromptAnswer`, skill payload, draw ID, Guan Xing order, Ren De/Yi Ji card ID, private role/candidate hoặc `effectStack` context.
- AOE, rescue và nullification là response window nhiều actor: `responderID` không phải source of truth duy nhất. Emit actor thực, prompt/window ID, eligibility đã lọc và final target outcome; không tuần tự hóa AOE nếu engine authoritative hiện vẫn simultaneous.
- Response accepted không đồng nghĩa target evaded: Vô Song có thể cần thêm Dodge; Bát Quái/Hộ Giá, Quán Thạch Phủ và Lưu Ly có nhánh sau response. VFX impact chỉ chạy khi `target-outcome` đã xác định.
- Reconnect/initial join đặt playback cursor bằng high-watermark snapshot và không replay backlog. Viewer thấy sequence nhảy vì event private đã lọc là hợp lệ; chỉ retention floor/envelope mới xác định gap thực.
- `effectStack` vẫn phải là `[]` ở player view; không mở nó để “tiện làm animation”.

## 4. Cấu trúc màn hình và bố cục

### 4.1 Màn hình

| Trạng thái engine/UI | Màn | Quyết định triển khai |
| --- | --- | --- |
| Boot/preload | `LoadScreen` | Fade từ texture chiến địa, logo/tiêu đề rõ; không chặn reconnect bằng intro dài. |
| Lobby | DOM lobby hiện hữu | Reskin theo tiền sảnh chiến doanh; giữ join/create/network hiện tại. |
| `waiting-room` | `RoomScene` trong Pixi | Ghế trống/đã vào, luật phòng, CTA host bắt đầu. Không có shop/nhiệm vụ ngoài scope. |
| `lord-selection`, `general-selection` | `FormationScene` | Đưa chọn tướng từ overlay mỏng thành board riêng; chỉ owner thấy candidate card theo player view. |
| `playing` | `BattleScene` | Scene persistent, prompt priority và VFX event-driven. |
| `ended` | `ResultScene` | Winner authoritative, reveal hợp lệ, bảng tóm tắt và CTA quay lại sảnh. |

Không tạo route độc lập làm mất `MatchClient`. Scene switch nằm trên session còn sống; chỉ session disposal xảy ra khi rời match, còn visual scene cũ phải cleanup ở mỗi transition. CTA `replay/rematch` chỉ được thêm sau khi backend capability đã được xác minh; mặc định ResultScene chỉ có hành động đang tồn tại.

### 4.2 Bố cục PC/tablet

- Trước M1, xuất board geometry có số đo cho 4–10 ghế, hand 20 lá, inspector, action row và drawer ở 1366×768, 1366×640, 1024×768. Duyệt ảnh idle/target/response/inspector trước khi skin toàn bộ.
- **1366×768:** header 48; đối thủ theo cung trên/trái/phải; chiến địa trung tâm; self dashboard và tay bài dưới; action/prompt ở vùng giữa đáy; log là drawer thu gọn.
- **1024×768 ngang:** giảm ghế có kiểm soát, một hàng hand có scroll thực, log đóng mặc định. Không giảm text dưới mức đọc được để giữ mọi ghế trên màn.
- **4–6 người:** cung ghế thoáng, không kéo portrait lên kích thước cut-in. **7–10 người:** seat anchor phân tầng top-side, khung tướng không chồng dashboard; selection badge không phủ HP/icon.
- Layout phải giải quyết cả `MainScreen.MIN_LAYOUT_HEIGHT`, engine `minHeight` trong `src/main.ts`, `resize.ts` và CSS canvas scaling ở `ResizePlugin`. Định nghĩa hệ tọa độ logical lẫn CSS hit target; test DPR 1/2. Mọi action/card target tối thiểu 44 CSS px, dù visual button cuối cùng là 40 hay 48 logical px.
- Không hard-code toàn bộ trong `MainScreen`; dùng layout function trả `SeatLayout`, `DashboardLayout`, `ActionRowLayout` và test 4/5/6/7/8/9/10 seats ở các viewport trên.

### 4.3 Prompt và log

`PromptLayer` có mức ưu tiên:

1. Dying/rescue và nullification đang đếm thời gian.
2. AOE/duel/card response của actor đủ điều kiện trong response window hiện tại.
3. Chọn mục tiêu/card/zone/option.
4. Thông tin không cần quyết định.

Prompt mới có `G.prompt.id` khác phải preempt animation không quan trọng; prompt cũ không được đứng trên option mới chỉ vì loại priority cao hơn. Animation bị huỷ phải gọi cleanup. Log chuyển thành drawer, vẫn có unread indicator và scroll; khi mở phải reflow có kiểm soát để lá đang chọn không chạy khỏi con trỏ.

## 5. Storyboard hành động

| Sự kiện luật | Trình diễn | Không được làm |
| --- | --- | --- |
| Khai trận | Chiến kỳ mở 0.8–1.2s, ghế tướng hiện theo seat; role chỉ hiện riêng cho viewer | Không phát intro lại sau reconnect. |
| Đánh bài | Lá rời tay/processing 160–240ms, đường đến mục tiêu | Không hiện impact trước response. |
| Né thành công | Vệt lam ngắn và “Đã né”, đường tấn công tắt | Không trừ HP. |
| Damage confirmed | Snapshot HP/trạng thái sống/chết/prompt sync ngay; impact theo nature 200–320ms chạy độc lập và hủy được | Không trì hoãn HP hay suy amount từ animation. |
| Kỹ năng | Badge/text là mặc định; cut-in 0.5–0.8s chỉ cho whitelist active/rare có art đủ nét, tên skill và owner/target | Không dùng portrait 250px phóng nửa màn hay cut-in cho mọi passive/conversion. |
| Vô Giải | Nút thắt trên quan hệ effect và chuỗi người phản hồi | Không dùng shield mang nghĩa chặn damage vĩnh viễn. |
| AOE/Duel | Theo từng responder/outcome | Không nổ đồng thời trước khi result từng người có mặt. |
| Dying/rescue | Badge nguy cấp tại ghế, priority prompt, kết thúc sau queue authoritative | Không coi HP ≤ 0 là chết ngay. |
| Lộ thân phận/tử trận | Thẻ role lật tại ghế, dấu tử trận sau event | Không reveal role ngoài dữ liệu đã được player view cấp. |
| Kết thúc | Freeze combat, `match-ended`, reveal hợp lệ, kết quả theo viewer | Không suy winner từ người ngã cuối. |

Tất cả duration là ngân sách UX, không phải delay luật. Skip chỉ bỏ visual queue, không gửi move và không thay đổi outcome.

## 6. Kế hoạch triển khai theo milestone

### M0 — Baseline và triage

1. Ghi screenshot runtime 1366×768, 1366×640 và 1024×768 ở DPR 1/2: waiting room, chọn tướng, lượt chơi, target, rescue, nullification, AOE, ended. Ghi browser/DPR.
2. Chạy tách test layout, asset aliases, player view, integration MatchClient; chạy từng nhóm skills fail với timeout hữu hạn. Phân loại từng lỗi: luật engine, fixture/test cũ, hoặc hang/async leak.
3. Thống nhất action button 40 hay 48px, sửa implementation và expectation cùng một quyết định. Loại bỏ ép height ngầm.
4. Xác nhận rendering font bằng browser screenshot và sửa source encoding nếu có lỗi thực. Chốt visual geometry 4–10 ghế, 20 hand cards và inspector; duyệt idle/target/response/inspector trước M1.
5. Chốt minimum 44 CSS px và bật reduced-motion/keyboard/touch skeleton trước animation đầu tiên.

**Exit:** baseline artefacts có nhãn; layout/asset/privacy/integration tests pass; lỗi rule còn lại có issue/fixture tái hiện riêng.

### M1 — Persistent shell và layout

1. Tạo `BattleScene` cùng layout types/test. Chuyển dần background, seat, dashboard, prompt, log từ `MainScreen` vào scene nhưng giữ callback move hiện hữu.
2. Thêm explicit `sync/update` cho SeatView/Dashboard/PlayerAvatar/CardView; test identity của seat/card tồn tại qua snapshot không đổi và fields/callback cập nhật khi đổi. Hủy private selection, inspector, role-face, hover/static state, tween và voice trước hot-seat viewer switch.
3. Thay clear-and-recreate khi snapshot đổi bằng `sync()` theo keyed entity. `clearContent()` chỉ còn dùng khi dispose/reset scene; scene cleanup tách khỏi session cleanup.
4. Đưa log thành drawer, reflow dashboard/action row theo drawer state và thực thi hand scroll cho 20 lá.
5. Sửa đầy đủ logical/CSS scaling chain (`main.ts`, resize plugin và MainScreen), sau đó tách Room/Formation/Result thành child scenes của session shell, không qua navigation làm reset match.

**Exit:** resize và receiveState không destroy toàn scene; local hot-seat/bots/remote vẫn tạo match, select general, chơi được một turn và reset sạch.

### M2 — Presentation contract và privacy tests

1. Thiết kế raw ring buffer, projected event union, retention floor/high-watermark/viewer cursor và helper emit trong `src/game/types`; không để transport decision mở sang M3.
2. Lập bảng mutation → event riêng cho lethal damage trước dying/death, damage/non-damage HP loss/recover, rescue, skill, death, role reveal và end. `AfterDamage` không phải nguồn duy nhất vì nó bỏ nhánh lethal.
3. Emit event ở outcome authoritative: card commit, response window/accepted/final target outcome, HP, skill, death/reveal/end. Không emit từ UI click hoặc client countdown.
4. Filter stream bằng allowlist trong `createPlayerView()` và kiểm thử viewer null, private sequence gap, duplicate, retention overflow, reset epoch, hot-seat switch, Guan Xing và reconnect.
5. Thêm `PresentationQueue`: serialise per correlation, preempt theo prompt ID, cancel Motion/timer before dispose/resize/viewer switch, sync snapshot khi backlog không còn hợp lệ.
6. Bộ đếm 15 giây hiện nằm ở client `MainScreen` chỉ là UX. Event timeout chỉ mô tả pass đã authoritative; không biến `Date.now()` client thành deadline luật, không tự gia hạn/quyền trả lời khi resize, skip hay reconnect. Deadline authoritative cần spec server riêng.

**Exit:** test chứng minh đối thủ không nhận private event payload; `effectStack` vẫn hidden; card response có fixture dodge-success và damage-confirmed khác nhau.

### M3 — Combat slice đầu tiên

1. Cài card committed → response window → accepted response → final target outcome → HP cho Slash; tách accepted Dodge khỏi evaded cuối cùng.
2. Cài active-seat flag, target marker, card flight, status badge và log drawer theo event.
3. Cài Vô Giải, AOE, Duel theo window/actor thực của engine; rescue là priority layer. Cover Vô Song, Bát Quái, Hộ Giá, Quán Thạch Phủ và Lưu Ly trước khi coi slice hoàn tất.
4. Cài badge/text kỹ năng trước; cut-in chỉ theo whitelist với fallback text/frame khi art không đủ độ phân giải.

**Exit:** replay fixture cho Slash dodge, Slash hit, nhiều dodge required nếu luật hỗ trợ, AOE, nullification và rescue cho hình ảnh đúng outcome.

### M4 — Reveal, death, result và handoff

1. Role card self-view có flip tương tác, nhưng public reveal chỉ event-authoritative.
2. Thêm `role-revealed`, `player-died`, `match-ended` presentations; lộ thân phận tại seat, không phải giant popup toàn màn.
3. Kết quả dùng `G.winner`/GameWinner authoritative, kể cả thành viên phe thắng đã chết; CTA chỉ là quay lobby trừ khi rematch/replay backend đã được xác minh. Hot-seat handoff phải hủy toàn bộ private texture/tooltip/selection/VFX trước snapshot viewer mới.

**Exit:** test role visibility trước/sau reveal/end; desktop screenshot không che prompt/hud; reconnect vào state ended không phát lại sequence sai.

### M5 — Polish, asset, accessibility, performance

1. Chốt theme tokens, safe zones, seat/card crop và fallback cho asset thiếu.
2. Dùng asset hiện có cho card, avatar, icon và effect nhỏ; chỉ dùng portrait tướng nhỏ ở seat. Tạo/duyệt splash art riêng trước cut-in lớn.
3. Hoàn thiện reduced motion, mute/SFX volume, keyboard focus, 44px hit target và text Việt readable; các yêu cầu tối thiểu đã phải hoạt động từ M0/M1.
4. Profile warm match: p95 frame time, texture memory, ticker/listener count sau 10 lần enter/exit scene.

**Exit:** không listener/ticker leak; 4–10 player screenshots duyệt ở PC/tablet; asset provenance registry có nguồn/quyền/trạng thái cho mọi asset mới.

## 7. File map cho executor

| File | Thay đổi dự kiến |
| --- | --- |
| `src/app/screens/main/MainScreen.ts` | Giảm vai trò xuống scene/session adapter; bỏ render full rebuild theo snapshot sau M1. |
| `src/app/screens/main/BattleScene.ts` *(mới)* | Persistent Pixi layer, sync keyed entities, layout và VFX queue. |
| `src/app/screens/main/RoomScene.ts`, `FormationScene.ts`, `ResultScene.ts` *(mới hoặc equivalent)* | Các bề mặt trạng thái, không sở hữu MatchClient. |
| `src/main.ts`, resize plugin, `src/app/ui/layout.ts` | Đồng bộ logical/CSS scale, DPR hit target và geometry có test; không gắn cứng log 280px. |
| `src/app/ui/Dashboard.ts`, `SeatView.ts`, `PlayerAvatar.ts`, `CardView.ts` | Tái dùng, thêm state token/accessibility/fallback; sửa copy death stamp. |
| `src/client/MatchClient.ts` | Một subscription nền, snapshot fan-out/cursor adapter nếu PresentationStream cần; không tạo viewer local thứ hai. |
| `src/game/types/*`, `src/game/types/state.ts` | Raw/projected presentation union, bounded ring/event envelope/epoch/cursor kiểu chặt. |
| `src/game/engine/*`, `cardEngine.ts`, skill paths | Emit event ở outcome; thay đổi theo từng flow đã impact-analyse. |
| `src/game/player-view.ts` | Filter presentation events và giữ bảo mật hiện có. |
| `tests/security/player-view.test.ts` | Visibility tests cho event stream. |
| `tests/integration/match-client.test.ts` | Hot-seat, bots, viewer switch, stale unsubscribe, lifecycle/reconnect equivalent. |
| `tests/ui/*.test.ts` | Geometry, prompt priority, asset/card fallback. |
| `e2e/game.spec.ts`, `e2e/lobby.spec.ts` | Screenshot/interaction PC cho lobby → room → selection → turn → end. |

Không đưa asset từ `3qs`, `QSanguosha` hoặc `QSanguosha-LangKhach-QuocChien` vào build chỉ vì file tồn tại. Dữ liệu khảo sát cũ ở `docs/plans/ui-upgrade/` chỉ là tham khảo; mỗi asset mới cần nguồn, giấy phép/quyền và kích thước master được xác minh.

## 8. Test matrix bắt buộc

| Nhánh | Scenario |
| --- | --- |
| Privacy | Viewer A không thấy hand/role/candidate/event private của B; cover viewer null, Guan Xing, trao bài kín, general-selection, Local và SocketIO reconnect; end/reveal chỉ mở dữ liệu luật cho phép. |
| Rules → VFX | Slash dodge không mất HP; Vô Song một/đủ Dodge; Bát Quái, Hộ Giá, Quán Thạch Phủ, Lưu Ly; Slash hit, direct HP loss, heal, nullification chain, AOE/Duel simultaneous window, dying/rescue, judgement, conversion card. |
| Session | Local hot-seat handoff dọn private state, local bots không handoff, remote không switch viewer, stale unsubscribe, reset/dispose, duplicate/private sequence gap/retention overflow/epoch reset. Thêm SocketIO two-client reconnect với credentials và same-prompt recovery khi server harness sẵn sàng. |
| Layout | 4/5/6/7/8/9/10 ghế × 1366×768, 1366×640, 1024×768 × DPR 1/2; 20 hand cards; tên dài; đủ equipment/judgement; prompt nhiều button; drawer open/closed. |
| Accessibility | Reduced motion từ animation đầu tiên, keyboard action/target/card, 44 CSS px click target, Vietnamese diacritics, readable contrast. |
| Performance | 10-player busy turn, repeated scene transitions, không tween/ticker/listener growth; timer/callback không chạm Pixi target đã bị dispose. |

Các lệnh đã xác minh trong `package.json`: `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test`, `npm.cmd run build`. Dùng timeout cho Vitest khi triage hang; không tuyên bố full suite pass trước khi process kết thúc.

## 9. Implementation context cho Gemini

```yaml
implementation_context:
  task_summary: "Refactor UI from immediate-mode MainScreen to persistent event-driven match scenes while preserving TQS rules and player-view privacy."
  source_commit: "738579454b39ad22ab7b0dd3608f9aebe5f695e6"
  primary_symbols:
    - { symbol: "MainScreen.render / clearContent", file: "src/app/screens/main/MainScreen.ts", role: "current rendering bottleneck" }
    - { symbol: "createPlayerView", file: "src/game/player-view.ts", role: "privacy seam" }
    - { symbol: "MatchClient", file: "src/client/MatchClient.ts", role: "session and viewer ownership" }
    - { symbol: "emitEvent", file: "src/game/engine/EventBus.ts", role: "authoritative trigger source, not UI feed" }
  first_actions:
    - "Read AGENTS.md and run required impact analysis before each production symbol edit."
    - "Run M0 targeted tests and capture runtime baselines before changing renderer."
    - "Create one persistent BattleScene seam before adding any combat animation."
  hard_constraints:
    - "Do not expose effectStack to player view."
    - "Project raw presentation events through an explicit allowlist; never spread raw G event data to a player view."
    - "Do not infer damage/reveal/winner from client input or visual timing."
    - "Do not replace CardView, SeatView, Dashboard or assetAliases without a concrete defect."
    - "Do not use reference-source art in release output without rights approval."
    - "Do not make a giant always-on seal or a permanent 280px log column."
    - "Cancel private visuals, selection, hover, callbacks and Motion work before every hot-seat viewer switch."
  verification_commands:
    - "npm.cmd run lint"
    - "npm.cmd run typecheck"
    - "npm.cmd run test"
    - "npm.cmd run build"
  open_questions:
    - "Which failing skill tests are genuine rules regressions versus stale fixtures? Resolve in M0."
    - "Where should PresentationStream persist for remote multiplayer: game state ring buffer or server transport adapter? Choose after confirming Boardgame.io serialization and reconnect behavior."
    - "Which newly created splash/cutin assets have approved provenance and adequate master resolution?"
```

## 10. Definition of done

- A full 4–10 player match flows lobby → room → selection → battle → result without a renderer rebuild on every snapshot; scene cleanup never destroys the live session.
- All UI action animations come from allowlisted, authoritative presentation events and remain correct for multi-actor response windows and final target outcomes.
- No security test regresses; opponent private hand/role/candidates/effect context remain unavailable.
- PC 1366×768/1366×640 and tablet 1024×768 screenshots at DPR 1/2 meet the approved geometry, Vietnamese text, 44 CSS px target and interaction criteria.
- Full check completes with an explicit final result; any rule defects discovered in M0 are fixed or tracked separately with reproducing tests.
- New assets are documented and approved; old reference assets are not silently shipped.

## 11. Historical references

The earlier v1/v2/v3 plans, Astra review, art brief, inventory and internet research remain in `docs/plans/ui-upgrade/` for provenance only. They may supply visual references and asset measurements, but their statements about current code, missing alias mappings, renderer status, layout and test pass-rate are not authoritative after commit `7385794`.
