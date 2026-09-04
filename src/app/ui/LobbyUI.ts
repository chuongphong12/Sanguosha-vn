/* eslint-disable @typescript-eslint/no-explicit-any */
import { LobbyClient } from "boardgame.io/client";

export class LobbyUI {
  private static container: HTMLElement | null = null;
  private static lobbyClient: LobbyClient;
  private static backendUrl: string;
  private static playerName = "Người Chơi " + Math.floor(Math.random() * 1000);

  public static show(
    onJoinMatch: (
      matchID: string,
      playerID: string,
      credentials?: string,
      serverUrl?: string,
    ) => void,
    onPlayOffline: () => void,
  ) {
    this.backendUrl =
      new URLSearchParams(window.location.search).get("backend") ||
      (import.meta as any).env?.VITE_BACKEND_URL ||
      `https://tqs-server.onrender.com`;
    this.lobbyClient = new LobbyClient({ server: this.backendUrl });
    if (!this.container) {
      this.createDOM(onJoinMatch, onPlayOffline);
    }
    this.container!.classList.remove("hidden");
    this.refreshRooms(onJoinMatch);
  }

  public static hide() {
    if (this.container) {
      this.container.classList.add("hidden");
    }
  }

  private static createDOM(
    onJoinMatch: (
      matchID: string,
      playerID: string,
      credentials?: string,
      serverUrl?: string,
    ) => void,
    onPlayOffline: () => void,
  ) {
    const appDiv = document.body;
    this.container = document.createElement("div");
    this.container.id = "lobby-ui";

    // Inject CSS link if not exists
    if (!document.getElementById("lobby-css")) {
      const link = document.createElement("link");
      link.id = "lobby-css";
      link.rel = "stylesheet";
      link.href = "/lobby.css";
      document.head.appendChild(link);
    }

    this.container.innerHTML = `
      <div class="lobby-header">
        <h1 class="lobby-title">Tụ Yến Đường</h1>
        <div style="margin-top: 10px;">
          Danh xưng: <input type="text" id="lobby-player-name" class="input-ancient" style="width: 200px; display: inline-block; padding: 5px;" value="${this.playerName}" />
        </div>
      </div>
      <div class="lobby-content">
        <div class="room-list" id="lobby-room-list">
          <!-- Rooms will be injected here -->
        </div>
      </div>
      <div class="lobby-actions">
        <button id="btn-create-room" class="btn-ancient">Tạo Quân Lệnh</button>
        <button id="btn-refresh" class="btn-ancient btn-secondary">Làm Mới</button>
        <button id="btn-offline" class="btn-ancient btn-secondary">Chơi Offline</button>
      </div>

      <!-- Create Room Modal -->
      <div id="modal-create" class="modal-overlay hidden">
        <div class="modal-content">
          <h2>Tạo Lệnh Bài</h2>
          <input type="text" id="input-room-name" class="input-ancient" placeholder="Tên phòng..." />
          <div class="modal-checkbox">
            <input type="checkbox" id="chk-private" /> <label for="chk-private">Phòng Bí Mật (Private)</label>
          </div>
          <input type="password" id="input-room-password" class="input-ancient hidden" placeholder="Mật khẩu..." />
          <div class="modal-actions">
            <button id="btn-confirm-create" class="btn-ancient">Khởi Tạo</button>
            <button id="btn-cancel-create" class="btn-ancient btn-secondary">Huỷ</button>
          </div>
        </div>
      </div>

      <!-- Join Password Modal -->
      <div id="modal-join" class="modal-overlay hidden">
        <div class="modal-content">
          <h2>Khẩu Lệnh</h2>
          <input type="password" id="input-join-password" class="input-ancient" placeholder="Nhập khẩu lệnh..." />
          <div class="modal-actions">
            <button id="btn-confirm-join" class="btn-ancient">Tiến Vào</button>
            <button id="btn-cancel-join" class="btn-ancient btn-secondary">Huỷ</button>
          </div>
        </div>
      </div>
    `;

    appDiv.appendChild(this.container);

    // Event Listeners
    document
      .getElementById("lobby-player-name")!
      .addEventListener("change", (e) => {
        this.playerName = (e.target as HTMLInputElement).value || "Vô Danh";
      });

    document
      .getElementById("btn-refresh")!
      .addEventListener("click", () => this.refreshRooms(onJoinMatch));
    document.getElementById("btn-offline")!.addEventListener("click", () => {
      this.hide();
      onPlayOffline();
    });

    // Create Modal
    const modalCreate = document.getElementById("modal-create")!;
    const chkPrivate = document.getElementById(
      "chk-private",
    ) as HTMLInputElement;
    const inputPass = document.getElementById(
      "input-room-password",
    ) as HTMLInputElement;

    document
      .getElementById("btn-create-room")!
      .addEventListener("click", () => {
        modalCreate.classList.remove("hidden");
      });

    document
      .getElementById("btn-cancel-create")!
      .addEventListener("click", () => {
        modalCreate.classList.add("hidden");
      });

    chkPrivate.addEventListener("change", () => {
      if (chkPrivate.checked) inputPass.classList.remove("hidden");
      else inputPass.classList.add("hidden");
    });

    document
      .getElementById("btn-confirm-create")!
      .addEventListener("click", async () => {
        const roomName =
          (document.getElementById("input-room-name") as HTMLInputElement)
            .value || "Phòng Của " + this.playerName;
        const isPrivate = chkPrivate.checked;
        const password = inputPass.value;

        try {
          const created = await this.lobbyClient.createMatch(
            "tam-quoc-sat-standard-2013",
            {
              numPlayers: 4,
              setupData: {
                roomName,
                hasPassword: isPrivate,
                password: isPrivate ? password : null,
              },
              unlisted: false, // We show it but require password
            },
          );

          // Auto join
          modalCreate.classList.add("hidden");
          this.joinMatchProcess(
            created.matchID,
            isPrivate ? password : null,
            onJoinMatch,
          );
        } catch (err) {
          console.error(err);
          alert("Lỗi khi tạo phòng!");
        }
      });

    // Join Modal is handled in refreshRooms dynamically
  }

  private static async refreshRooms(
    onJoinMatch: (
      matchID: string,
      playerID: string,
      credentials?: string,
      serverUrl?: string,
    ) => void,
  ) {
    const listDiv = document.getElementById("lobby-room-list");
    if (!listDiv) return;
    listDiv.innerHTML = "<p>Đang thám thính...</p>";

    try {
      const result = await this.lobbyClient.listMatches(
        "tam-quoc-sat-standard-2013",
      );
      const matches = result.matches;

      if (matches.length === 0) {
        listDiv.innerHTML = "<p>Chưa có lệnh bài nào được phát ra.</p>";
        return;
      }

      listDiv.innerHTML = "";
      for (const match of matches) {
        // Skip full rooms
        const emptySeats = match.players.filter((p) => !p.name).length;
        if (emptySeats === 0) continue;

        const setupData = match.setupData || {};
        const roomName =
          setupData.roomName ||
          "Tụ Yến Đường - " + match.matchID.substring(0, 4);
        const hasPassword = setupData.hasPassword;

        const card = document.createElement("div");
        card.className = "room-card";
        card.innerHTML = `
          <h3 class="room-title">${roomName}</h3>
          <div class="room-meta">
            <span>Chỗ trống: ${emptySeats}/${match.players.length}</span>
          </div>
          ${hasPassword ? '<div class="room-private-icon">🔒</div>' : ""}
        `;

        card.addEventListener("click", () => {
          if (hasPassword) {
            const modalJoin = document.getElementById("modal-join")!;
            modalJoin.classList.remove("hidden");

            const btnConfirm = document.getElementById("btn-confirm-join")!;
            const btnCancel = document.getElementById("btn-cancel-join")!;

            // Remove old listeners
            const newConfirm = btnConfirm.cloneNode(true);
            const newCancel = btnCancel.cloneNode(true);
            btnConfirm.parentNode!.replaceChild(newConfirm, btnConfirm);
            btnCancel.parentNode!.replaceChild(newCancel, btnCancel);

            newCancel.addEventListener("click", () =>
              modalJoin.classList.add("hidden"),
            );
            newConfirm.addEventListener("click", () => {
              const pass = (
                document.getElementById(
                  "input-join-password",
                ) as HTMLInputElement
              ).value;
              modalJoin.classList.add("hidden");
              this.joinMatchProcess(match.matchID, pass, onJoinMatch);
            });
          } else {
            this.joinMatchProcess(match.matchID, null, onJoinMatch);
          }
        });

        listDiv.appendChild(card);
      }
    } catch (err) {
      console.error(err);
      listDiv.innerHTML = "<p>Lỗi kết nối Sảnh.</p>";
    }
  }

  public static async joinMatchProcess(
    matchID: string,
    password: null | string,
    onJoinMatch: (
      matchID: string,
      playerID: string,
      credentials?: string,
      serverUrl?: string,
    ) => void,
  ) {
    this.backendUrl =
      new URLSearchParams(window.location.search).get("backend") ||
      (import.meta as any).env?.VITE_BACKEND_URL ||
      `https://tqs-server.onrender.com`;
    this.lobbyClient = new LobbyClient({ server: this.backendUrl });
    try {
      const data = password ? { password } : {};
      // Fetch current seats
      const result = await this.lobbyClient.getMatch(
        "tam-quoc-sat-standard-2013",
        matchID,
      );
      const emptySeat = result.players.find((p) => !p.name);
      if (!emptySeat) {
        alert("Phòng đã đầy!");
        return;
      }

      const joined = await this.lobbyClient.joinMatch(
        "tam-quoc-sat-standard-2013",
        matchID,
        {
          playerID: emptySeat.id.toString(),
          playerName: this.playerName,
          data,
        },
      );

      this.hide();
      onJoinMatch(
        matchID,
        emptySeat.id.toString(),
        joined.playerCredentials,
        this.backendUrl,
      );
    } catch (err: unknown) {
      console.error(err);
      if (
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as any).response?.status === 401
      ) {
        alert("Sai khẩu lệnh!");
      } else {
        alert(
          "Không thể tiến vào phòng! " +
            (err instanceof Error ? err.message : String(err)),
        );
      }
    }
  }
}
