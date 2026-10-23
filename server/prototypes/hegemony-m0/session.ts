/** THROWAWAY: single writer, two seats, local disk; not a provider DB adapter. */
import { open, readFile, rename, unlink } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { Master } from "boardgame.io/master";
import { InitializeGame, Sync } from "boardgame.io/internal";
import type { State, Server } from "boardgame.io";
import {
  copy,
  identity,
  proofGame,
  actorObservation,
  type ProofGame,
  type EngineCommand,
} from "./engine";

export type Auth = {
  room: string;
  actor: string;
  secret: string;
  generation: number;
  tab: string;
  revision: number;
};
export type Command = {
  id: string;
  revision: number;
  generation: number;
} & EngineCommand;
type Member = { secretHash: string; generation: number };
type Receipt = { action: string; intent: EngineCommand; revision: number };
type Room = {
  state: State<ProofGame>;
  metadata: Server.MatchData;
  members: Record<string, Member>;
  receipts: Record<string, Receipt>;
  started: boolean;
};
type Database = {
  schema: typeof identity;
  revision: number;
  rooms: Record<string, Room>;
};
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const nonce = () => randomBytes(24).toString("hex");
class StagedStore extends Sync {
  constructor(readonly room: Room) {
    super();
  }
  connect() {}
  createMatch() {
    throw new Error("No implicit creation in Master");
  }
  setState(_id: string, state: State) {
    this.room.state = copy(state);
  }
  setMetadata(_id: string, metadata: Server.MatchData) {
    this.room.metadata = copy(metadata);
  }
  fetch(_id: string, opts: any): any {
    return Object.fromEntries(
      Object.keys(opts).map((k) => [
        k,
        copy(
          k === "state"
            ? this.room.state
            : k === "metadata"
              ? this.room.metadata
              : k === "log"
                ? []
                : this.room.state,
        ),
      ]),
    );
  }
  wipe() {
    throw new Error("Deletion belongs to session");
  }
  listMatches() {
    return [];
  }
}
export async function createPrototype(
  path: string,
  options: { beforeCommit?: () => Promise<void> } = {},
) {
  const lockPath = path + ".writer",
    owner = { pid: process.pid, nonce: nonce() };
  async function acquire(): Promise<void> {
    try {
      const f = await open(lockPath, "wx", 0o600);
      await f.writeFile(JSON.stringify(owner));
      await f.close();
    } catch (e: any) {
      if (e.code !== "EEXIST") throw e;
      const previous = JSON.parse(await readFile(lockPath, "utf8"));
      try {
        process.kill(previous.pid, 0);
      } catch (err: any) {
        if (err.code !== "ESRCH") throw err;
        await unlink(lockPath);
        return acquire();
      }
      throw new Error("Prototype writer already active");
    }
  }
  await acquire();
  let db: Database;
  try {
    try {
      db = JSON.parse(await readFile(path, "utf8"));
    } catch (e: any) {
      if (e.code !== "ENOENT") throw e;
      db = { schema: identity, revision: 0, rooms: {} };
    }
    if (db.schema !== identity) throw new Error("Incompatible prototype save");
  } catch (e) {
    await unlink(lockPath);
    throw e;
  }
  let closed = false,
    tail: Promise<unknown> = Promise.resolve();
  const connections = new Map<string, Map<string, () => boolean>>(),
    controllers = new Map<string, string>();
  const key = (a: Pick<Auth, "room" | "actor">) => `${a.room}:${a.actor}`;
  const live = (auth: Auth) =>
    connections.get(key(auth))?.get(auth.tab)?.() === true;
  function serial<T>(f: () => Promise<T>): Promise<T> {
    const result = tail.then(() => {
      if (closed) throw new Error("Writer closed");
      return f();
    });
    tail = result.catch(() => {});
    return result;
  }
  async function commit(next: Database) {
    next.revision++;
    const f = await open(path + ".next", "w", 0o600);
    try {
      await f.writeFile(JSON.stringify(next));
      await f.sync();
    } finally {
      await f.close();
    }
    await options.beforeCommit?.();
    await rename(path + ".next", path);
    db = next;
  }
  function authenticate(auth: Auth, data = db) {
    const room = data.rooms[auth.room],
      member = room?.members[auth.actor];
    if (!member || member.secretHash !== hash(auth.secret))
      throw new Error("Unauthorized or deleted room");
    return { room, member };
  }
  function view(auth: Auth) {
    const { room, member } = authenticate(auth),
      e = room.state.G.engine;
    return {
      room: auth.room,
      actor: auth.actor,
      revision: room.state._stateID,
      generation: member.generation,
      ...actorObservation(e, auth.actor),
      controlling: controllers.get(key(auth)) === auth.tab && live(auth),
    };
  }
  async function connect(
    auth: Auth,
    tab: string,
    takeControl = false,
    isConnected = () => true,
  ) {
    authenticate(auth);
    const id = key(auth),
      tabs = connections.get(id) ?? new Map<string, () => boolean>(),
      controller = controllers.get(id),
      claim = takeControl || !controller || tabs.get(controller)?.() !== true,
      next = copy(db);
    if (claim) next.rooms[auth.room].members[auth.actor].generation++;
    await commit(next);
    tabs.set(tab, isConnected);
    connections.set(id, tabs);
    if (claim) controllers.set(id, tab);
    return {
      ...auth,
      tab,
      generation: db.rooms[auth.room].members[auth.actor].generation,
      revision: db.rooms[auth.room].state._stateID,
    };
  }
  async function create(tab = nonce(), isConnected = () => true) {
    if (Object.keys(db.rooms).length >= 5) throw new Error("Room capacity");
    const next = copy(db),
      roomID = nonce(),
      secret = nonce();
    const state = InitializeGame({
      game: proofGame,
      numPlayers: 2,
    }) as State<ProofGame>;
    next.rooms[roomID] = {
      state,
      metadata: {
        gameName: proofGame.name!,
        players: { "0": { id: 0 }, "1": { id: 1 } },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      members: { "0": { secretHash: hash(secret), generation: 1 } },
      receipts: {},
      started: false,
    };
    await commit(next);
    const auth = {
      room: roomID,
      actor: "0",
      secret,
      generation: 1,
      tab,
      revision: 0,
    };
    connections.set(key(auth), new Map([[tab, isConnected]]));
    controllers.set(key(auth), tab);
    return auth;
  }
  async function join(roomID: string, tab = nonce(), isConnected = () => true) {
    const room = db.rooms[roomID];
    if (!room || room.started || room.members["1"])
      throw new Error("Room unavailable");
    const secret = nonce(),
      next = copy(db);
    next.rooms[roomID].members["1"] = {
      secretHash: hash(secret),
      generation: 1,
    };
    await commit(next);
    const auth = {
      room: roomID,
      actor: "1",
      secret,
      generation: 1,
      tab,
      revision: room.state._stateID,
    };
    connections.set(key(auth), new Map([[tab, isConnected]]));
    controllers.set(key(auth), tab);
    return auth;
  }
  async function command(auth: Auth, command: Command) {
    const { room, member } = authenticate(auth);
    if (
      controllers.get(key(auth)) !== auth.tab ||
      command?.generation !== member.generation ||
      !live(auth)
    )
      throw new Error("Stale controller");
    if (
      !command ||
      typeof command.id !== "string" ||
      !/^[\w-]{1,80}$/.test(command.id) ||
      !["draw", "play", "answer"].includes(command.action) ||
      (command.action === "answer" &&
        (!command.answer ||
          typeof command.answer !== "object" ||
          Array.isArray(command.answer) ||
          Object.keys(command.answer).length !== 2 ||
          typeof command.answer.id !== "string" ||
          !(
            command.answer.choice === null ||
            typeof command.answer.choice === "string"
          )))
    )
      throw new Error("Invalid command");
    const intent: EngineCommand =
      command.action === "answer"
        ? {
            action: "answer",
            answer: { id: command.answer.id, choice: command.answer.choice },
          }
        : { action: command.action };
    const receiptKey = `${auth.actor}:${command.id}`,
      previous = room.receipts[receiptKey];
    if (previous) {
      if (JSON.stringify(previous.intent) !== JSON.stringify(intent))
        throw new Error("Intent collision");
      return { receipt: previous, view: view(auth), duplicate: true };
    }
    if (command.revision !== room.state._stateID)
      throw new Error("Stale revision");
    const next = copy(db),
      staged = next.rooms[auth.room],
      pending: unknown[] = [];
    // Stock Master sends BEFORE storage writes: stage output, subscriber and writes.
    const master = new Master(proofGame, new StagedStore(staged), {
      send: (p) => {
        pending.push(p);
      },
      sendAll: (p) => {
        pending.push(p);
      },
    });
    master.subscribe((p) => {
      pending.push(p);
    });
    const error = await master.onUpdate(
      {
        type: "MAKE_MOVE",
        payload: {
          type: "command",
          args: [intent],
          playerID: auth.actor,
          credentials: "PROTOTYPE-server-bound",
        },
      },
      command.revision,
      auth.room,
      auth.actor,
    );
    if (error || staged.state._stateID !== room.state._stateID + 1)
      throw new Error("Engine rejected command");
    staged.started = true;
    staged.receipts[receiptKey] = {
      action: command.action,
      intent,
      revision: staged.state._stateID,
    };
    await commit(next);
    // Never release raw Master packets/subscriber state. Derive a fresh actor view.
    return {
      receipt: staged.receipts[receiptKey],
      view: view(auth),
      duplicate: false,
    };
  }
  async function disconnect(auth: Auth) {
    authenticate(auth);
    const id = key(auth);
    connections.get(id)?.delete(auth.tab);
    if (controllers.get(id) === auth.tab) controllers.delete(id);
  }
  async function leave(auth: Auth) {
    const { member } = authenticate(auth);
    if (
      controllers.get(key(auth)) !== auth.tab ||
      member.generation !== auth.generation ||
      !live(auth)
    )
      throw new Error("Stale controller");
    const next = copy(db),
      room = next.rooms[auth.room],
      otherOnline = Object.keys(room.members).some(
        (p) =>
          p !== auth.actor &&
          [...(connections.get(`${auth.room}:${p}`)?.values() ?? [])].some(
            (isLive) => isLive(),
          ),
      );
    if (!otherOnline) delete next.rooms[auth.room];
    else delete room.members[auth.actor];
    await commit(next);
    for (const id of [...connections.keys()])
      if (
        id === key(auth) ||
        (!next.rooms[auth.room] && id.startsWith(auth.room + ":"))
      ) {
        connections.delete(id);
        controllers.delete(id);
      }
    return { deleted: !next.rooms[auth.room] };
  }
  return {
    create: (tab?: string, isLive?: () => boolean) =>
      serial(() => create(tab, isLive)),
    join: (room: string, tab?: string, isLive?: () => boolean) =>
      serial(() => join(room, tab, isLive)),
    connect: (a: Auth, tab: string, take = false, isLive?: () => boolean) =>
      serial(() => connect(a, tab, take, isLive)),
    command: (a: Auth, c: Command) => serial(() => command(a, c)),
    view: (a: Auth) => serial(async () => view(a)),
    disconnect: (a: Auth) => serial(() => disconnect(a)),
    leave: (a: Auth) => serial(() => leave(a)),
    close: async () => {
      await tail;
      closed = true;
      await unlink(lockPath);
    },
  };
}
