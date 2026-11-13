/** THROWAWAY: single writer and two fixture seats, outside production. */
import { randomBytes, createHash } from "node:crypto";
import { Master } from "boardgame.io/master";
import { InitializeGame, Sync } from "boardgame.io/internal";
import type { State, Server } from "boardgame.io";
import { chooseBot, policyVersion, type Memory } from "./bot";
import { openFileStore, type SessionStore } from "./storage";
import {
  systemClock,
  initialDeadlines,
  synchronizeDeadlines,
  graceMs,
  type ServiceClock,
  type Deadlines,
} from "./deadlines";
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
type Member = {
  secretHash: string | null;
  generation: number;
  control: "human" | "bot";
};
type Receipt = { action: string; intent: EngineCommand; revision: number };
type Room = {
  state: State<ProofGame>;
  metadata: Server.MatchData;
  members: Record<string, Member>;
  receipts: Record<string, Receipt>;
  started: boolean;
  deadlines: Deadlines;
  botMemory: Record<string, Memory>;
};
type Database = {
  schema: typeof identity;
  revision: number;
  elapsed: number;
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
  options: {
    beforeCommit?: () => Promise<void>;
    clock?: ServiceClock;
    onChange?: () => void;
    openStore?: () => Promise<SessionStore>;
  } = {},
) {
  const store = options.openStore
    ? await options.openStore()
    : await openFileStore(path, options.beforeCommit);
  let db: Database;
  try {
    const saved = await store.read();
    db =
      saved === null
        ? { schema: identity, revision: 0, elapsed: 0, rooms: {} }
        : JSON.parse(saved);
    if (
      db.schema !== identity ||
      !Number.isFinite(db.elapsed) ||
      db.elapsed < 0
    )
      throw new Error("Incompatible prototype save");
  } catch (e) {
    await store.close();
    throw e;
  }
  let closed = false,
    tail: Promise<unknown> = Promise.resolve();
  const clock = options.clock ?? systemClock;
  let mark = clock.now(),
    booting = true,
    stopping = false;
  function serviceTime(now = clock.now()) {
    if (!Number.isFinite(now) || now < mark)
      throw new Error("Invalid service clock");
    return db.elapsed + (booting ? 0 : now - mark);
  }
  const connections = new Map<string, Map<string, () => boolean>>(),
    controllers = new Map<string, string>();
  const key = (a: Pick<Auth, "room" | "actor">) => `${a.room}:${a.actor}`;
  const live = (auth: Auth) =>
    connections.get(key(auth))?.get(auth.tab)?.() === true;
  function serial<T>(f: () => Promise<T>): Promise<T> {
    const result = tail.then(() => {
      if (closed) throw new Error("Writer closed");
      store.assertActive();
      return f();
    });
    tail = result.catch(() => {});
    return result;
  }
  async function commit(next: Database) {
    const sampled = clock.now();
    next.elapsed = serviceTime(sampled);
    next.revision++;
    await store.write(JSON.stringify(next));
    db = next;
    mark = sampled;
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
      controlling:
        member.control === "human" &&
        controllers.get(key(auth)) === auth.tab &&
        live(auth),
      timing: {
        control: member.control,
        remainingMs:
          room.deadlines.prompt?.actor === auth.actor
            ? Math.max(0, room.deadlines.prompt.until - db.elapsed)
            : null,
      },
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
    if (claim) {
      next.rooms[auth.room].members[auth.actor].generation++;
      next.rooms[auth.room].members[auth.actor].control = "human";
    }
    synchronize(
      auth.room,
      next.rooms[auth.room],
      serviceTime(),
      isConnected() ? [auth.actor] : [],
    );
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
      members: {
        "0": { secretHash: hash(secret), generation: 1, control: "human" },
      },
      receipts: {},
      started: false,
      deadlines: initialDeadlines(),
      botMemory: {},
    };
    synchronize(
      roomID,
      next.rooms[roomID],
      serviceTime(),
      isConnected() ? ["0"] : [],
    );
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
      control: "human",
    };
    synchronize(
      roomID,
      next.rooms[roomID],
      serviceTime(),
      isConnected() ? ["1"] : [],
    );
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
      member.control !== "human" ||
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
      staged = next.rooms[auth.room];
    await execute(staged, auth.room, auth.actor, intent);
    synchronize(auth.room, staged, serviceTime());
    staged.receipts[receiptKey] = {
      action: command.action,
      intent,
      revision: staged.state._stateID,
    };
    await commit(next);
    return {
      receipt: staged.receipts[receiptKey],
      view: view(auth),
      duplicate: false,
    };
  }
  async function execute(
    staged: Room,
    roomID: string,
    actor: string,
    intent: EngineCommand,
  ) {
    const revision = staged.state._stateID,
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
          playerID: actor,
          credentials: "PROTOTYPE-server-bound",
        },
      },
      revision,
      roomID,
      actor,
    );
    if (error || staged.state._stateID !== revision + 1)
      throw new Error("Engine rejected command");
    staged.started = true;
  }
  async function disconnect(auth: Auth) {
    authenticate(auth);
    const id = key(auth);
    connections.get(id)?.delete(auth.tab);
    if (controllers.get(id) === auth.tab) controllers.delete(id);
    const next = copy(db);
    synchronize(auth.room, next.rooms[auth.room], serviceTime());
    await commit(next);
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
          room.members[p].secretHash !== null &&
          [...(connections.get(`${auth.room}:${p}`)?.values() ?? [])].some(
            (isLive) => isLive(),
          ),
      );
    if (!otherOnline) delete next.rooms[auth.room];
    else {
      if (room.started) {
        // Keep the game character and bot memory; revoke the human's return right.
        room.members[auth.actor].secretHash = null;
        room.members[auth.actor].control = "bot";
        room.members[auth.actor].generation++;
      } else delete room.members[auth.actor];
      synchronize(auth.room, room, serviceTime());
    }
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
  function synchronize(
    roomID: string,
    room: Room,
    now: number,
    arriving: string[] = [],
  ) {
    const humans = Object.keys(room.members).filter(
      (actor) => room.members[actor].secretHash !== null,
    );
    const online = humans.filter(
      (actor) =>
        arriving.includes(actor) ||
        [...(connections.get(`${roomID}:${actor}`)?.values() ?? [])].some(
          (isLive) => isLive(),
        ),
    );
    synchronizeDeadlines(
      room.deadlines,
      humans,
      online,
      room.state.G.engine.scheduler.prompt,
      now,
    );
  }
  async function pulse(checkpoint = false) {
    if (!Object.keys(db.rooms).length) return false;
    const now = serviceTime(),
      next = copy(db);
    if (
      !checkpoint &&
      !Object.values(next.rooms).some(
        (room) =>
          (room.deadlines.emptyUntil !== null &&
            room.deadlines.emptyUntil <= now) ||
          Object.entries(room.deadlines.offline).some(
            ([actor, until]) =>
              until <= now && room.members[actor]?.control === "human",
          ) ||
          (room.deadlines.prompt &&
            (room.deadlines.prompt.until <= now ||
              room.members[room.deadlines.prompt.actor]?.control === "bot")),
      )
    )
      return false;
    for (const [roomID, room] of Object.entries(next.rooms)) {
      synchronize(roomID, room, now);
      if (
        room.deadlines.emptyUntil !== null &&
        now >= room.deadlines.emptyUntil
      ) {
        delete next.rooms[roomID];
        continue;
      }
      for (const [actor, until] of Object.entries(room.deadlines.offline)) {
        const member = room.members[actor];
        if (now >= until && member.control === "human") {
          member.control = "bot";
          member.generation++;
        }
      }
      const deadline = room.deadlines.prompt;
      if (!deadline) continue;
      const member = room.members[deadline.actor];
      if (!member || (now < deadline.until && member.control !== "bot"))
        continue;
      const observation = actorObservation(room.state.G.engine, deadline.actor);
      if (observation.prompt?.id !== deadline.id) continue;
      const result = chooseBot(
        observation.decision,
        room.botMemory[deadline.actor] ?? {
          version: policyVersion,
          actor: deadline.actor,
          seed: 17 + Number(deadline.actor),
          decisions: 0,
        },
      );
      const choice = observation.prompt.choices.some(
        (c) => c.id === result.choice,
      )
        ? result.choice
        : null;
      if (choice === null && !observation.prompt.canCancel) continue;
      const intent: EngineCommand = {
        action: "answer",
        answer: { id: deadline.id, choice },
      };
      await execute(room, roomID, deadline.actor, intent);
      room.botMemory[deadline.actor] = result.memory;
      room.receipts[
        `system:${deadline.actor}:${deadline.id}:${member.generation}`
      ] = {
        action: "answer",
        intent,
        revision: room.state._stateID,
      };
      synchronize(roomID, room, now);
    }
    await commit(next);
    for (const id of [...connections.keys()]) {
      if (!db.rooms[id.slice(0, id.indexOf(":"))]) {
        connections.delete(id);
        controllers.delete(id);
      }
    }
    return true;
  }
  // Persist recovery grace before exposing a ready session. Downtime is never a wall-time delta.
  try {
    if (Object.keys(db.rooms).length) {
      const next = copy(db);
      for (const [roomID, room] of Object.entries(next.rooms)) {
        room.deadlines.emptyUntil = db.elapsed + graceMs;
        synchronize(roomID, room, db.elapsed);
      }
      await commit(next);
    }
  } catch (error) {
    await store.close();
    throw error;
  }
  booting = false;
  mark = clock.now();
  let cancel = () => {};
  function arm() {
    if (stopping) return;
    cancel = clock.schedule(async () => {
      try {
        if (await serial(() => pulse(true))) options.onChange?.();
      } catch {
        if (!stopping) console.error("Prototype clock checkpoint failed");
      } finally {
        arm();
      }
    }, 1000);
  }
  arm();
  function update<T>(action: () => Promise<T>) {
    let changed = false;
    return serial(async () => {
      changed = await pulse();
      return action();
    }).finally(() => {
      if (changed) options.onChange?.();
    });
  }
  return {
    create: (tab?: string, isLive?: () => boolean) =>
      update(() => create(tab, isLive)),
    join: (room: string, tab?: string, isLive?: () => boolean) =>
      update(() => join(room, tab, isLive)),
    connect: (a: Auth, tab: string, take = false, isLive?: () => boolean) =>
      update(() => connect(a, tab, take, isLive)),
    command: (a: Auth, c: Command) => update(() => command(a, c)),
    view: (a: Auth) => serial(async () => view(a)),
    disconnect: (a: Auth) => update(() => disconnect(a)),
    leave: (a: Auth) => update(() => leave(a)),
    close: async () => {
      stopping = true;
      cancel();
      await tail;
      closed = true;
      await store.close();
    },
  };
}
