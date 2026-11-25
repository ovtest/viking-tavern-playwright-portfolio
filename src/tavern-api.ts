import { expect, type APIRequestContext, type APIResponse } from "@playwright/test";

// Thin wrapper around the tavern's JSON API (the app's docs/SPEC.md, section 2.5 "API").
// Used to prepare a night quickly (begin a saga, book, pay); the UI tests then check what a Viking sees.

export type ApiError = { code: string; message: string; offeredRoomId?: number };

export type RoomState = "available" | "occupied" | "in-sack" | "booked" | "closed";
export type Room = { id: number; name: string; where: string; teaser: string; price: number; state: RoomState; twist?: string };
export type Berth = { id: number; name: string; where: string; island: string; boat: string; boatName: string; teaser: string; price: number; state: "available" | "occupied" | "in-sack" | "booked" };
export type Table = { company: string; place: number; name: string; who: string; teaser: string; story: string; state: "available" | "full" | "mine"; twist?: string };
/** id: a room or berth number, or a dish or drink id ("roast-bird"). */
export type SackLine = { kind: "room" | "berth" | "dish" | "drink"; id: number | string; name: string; price: number; quantity: number; lineTotal: number };
export type MenuKind = "dish" | "drink";
export type Drink = { kind: "drink"; id: string; name: string; line: string; price: number; state: "available" };
/** state: "sold-out" when the saga number took the dish off the menu tonight; soldOutReason is Barowl's excuse. */
export type Dish = { kind: "dish"; id: string; name: string; line: string; price: number; picture: string | null; hasStory: boolean; state: "available" | "sold-out"; soldOutReason?: string };
export type DishDetails = Dish & { story: string; ingredients: string[]; steps: string[] };
export type Sack = { sagaSeed: number; lines: SackLine[]; itemCount: number; total: number };
export type MorningEvent = { code: string; kind: "room" | "berth" | "table"; id: number; company?: string; paid: number; refund: number; needsChoice: boolean; choice: string | null; title: string };
export type Checkout = { sagaSeed: number; events: MorningEvent[]; refundTotal: number; chargeTotal: number; silverAfter: number; epithet: string | null };

/**
 * Master's Table settings (the app's docs/SPEC.md, section 4). Leave out what should be ordinary.
 * places: who else is staying; rooms / tables: the night's event at your room / table; harbor: what happens to your boat.
 */
export type Night = {
  seed?: number;
  places?: "ordinary" | "free" | "taken";
  rooms?: "ordinary" | "always" | "never";
  harbor?: "ordinary" | "kraken-eats" | "kraken-damages" | "pirates" | "quiet";
  tables?: "ordinary" | "always" | "never";
  /** Sets the Coin Pouch (0–100). */
  silver?: number;
};

export class TavernApi {
  constructor(private readonly request: APIRequestContext) {}

  private async json<T>(res: APIResponse, what: string, status = 200): Promise<T> {
    expect(res.status(), `${what}: ${res.status()} ${res.ok() ? "" : await res.text()}`).toBe(status);
    return res.json() as Promise<T>;
  }

  async me() {
    return (await this.json<{ user: { username: string; silver: number; sagaSeed: number; sackCount: number } }>(await this.request.get("/api/me"), "GET /api/me (are you logged in?)")).user;
  }

  /** Begins a new night with the Master's Table settings. Empties the Loot Sack. */
  async beginSaga(night: Night = {}) {
    return this.json<{ saga: { seed: number; scenario: unknown }; silver: number }>(await this.request.post("/api/saga/new", { data: night }), "POST /api/saga/new");
  }

  /** Raw call, so tests can check error responses too. */
  async beginSagaRaw(body: Record<string, unknown>) {
    return this.request.post("/api/saga/new", { data: body });
  }

  async rooms(): Promise<Room[]> {
    return (await this.json<{ rooms: Room[] }>(await this.request.get("/api/rooms"), "GET /api/rooms")).rooms;
  }

  async room(id: number): Promise<Room> {
    const room = (await this.rooms()).find((r) => r.id === id);
    expect(room, `room ${id}`).toBeDefined();
    return room!;
  }

  async berths(): Promise<Berth[]> {
    return (await this.json<{ berths: Berth[] }>(await this.request.get("/api/berths"), "GET /api/berths")).berths;
  }

  async tables(): Promise<Table[]> {
    return (await this.json<{ tables: Table[] }>(await this.request.get("/api/tables"), "GET /api/tables")).tables;
  }

  /** Raw call, so tests can check error responses too. */
  async addRoom(id: number | string) {
    return this.request.post("/api/loot-sack/items", { data: { kind: "room", id } });
  }

  /** Raw call. */
  async addBerth(id: number | string) {
    return this.request.post("/api/loot-sack/items", { data: { kind: "berth", id } });
  }

  /** Raw call: a dish or a drink from Barowl's Menu; qty left out = 1. */
  async addMenuItem(kind: MenuKind, id: string, qty?: number | string) {
    return this.request.post("/api/loot-sack/items", { data: qty === undefined ? { kind, id } : { kind, id, qty } });
  }

  /** Barowl's Menu, no stories (anyone can read it). */
  async menu() {
    return this.json<{ sagaSeed: number; drinks: Drink[]; dishes: Dish[] }>(await this.request.get("/api/menu"), "GET /api/menu");
  }

  /** Raw call: one dish with its story and recipe. */
  async dishRaw(id: string) {
    return this.request.get(`/api/menu/${id}`);
  }

  async removeFromSack(kind: SackLine["kind"], id: number | string) {
    return this.request.delete(`/api/loot-sack/items/${kind}/${id}`);
  }

  async sack(): Promise<Sack> {
    return (await this.json<{ sack: Sack }>(await this.request.get("/api/loot-sack"), "GET /api/loot-sack")).sack;
  }

  /** Raw call. */
  async settleRaw(expectedTotal?: number) {
    return this.request.post("/api/settle", { data: expectedTotal === undefined ? {} : { expectedTotal } });
  }

  /** Pays the whole Loot Sack. */
  async settle() {
    const sack = await this.sack();
    return (await this.json<{ entry: { id: number; total: number; silverAfter: number } }>(await this.settleRaw(sack.total), "POST /api/settle", 201)).entry;
  }

  /** Raw call. */
  async joinTable(company: string) {
    return this.request.post("/api/tables/join", { data: { company } });
  }

  /** Raw call. */
  async checkOutRaw() {
    return this.request.post("/api/checkout");
  }

  async checkOut(): Promise<Checkout> {
    return (await this.json<{ checkout: Checkout }>(await this.checkOutRaw(), "POST /api/checkout", 201)).checkout;
  }

  async pouch() {
    return (await this.json<{ pouch: { silver: number; transactions: { type: string; amount: number }[] } }>(await this.request.get("/api/pouch"), "GET /api/pouch")).pouch;
  }

  /** Raw call: the pirates took your boat, "refund" or "boat" (their wreck). */
  async chooseRaw(choice: string) {
    return this.request.post("/api/checkout/choice", { data: { choice } });
  }

  async ledgerEntry(id: number) {
    return (await this.json<{ entry: { id: number; sagaSeed: number; sagaRun: number; total: number } }>(await this.request.get(`/api/ledger/${id}`), `GET /api/ledger/${id}`)).entry;
  }

  /**
   * Sets up a whole night and pays it: a room, and if asked a berth (the cheapest free one) and a table (the first
   * company with a seat, or the one named). Returns what was booked, with the prices paid.
   */
  async night(plan: { room: number; berth?: boolean; table?: boolean | string }) {
    const room = await this.room(plan.room);
    expect(room.state, `room ${plan.room} is free tonight`).toBe("available");
    expect((await this.addRoom(room.id)).status(), `room ${room.id}`).toBe(200);
    let berth: Berth | undefined;
    if (plan.berth) {
      berth = (await this.berths()).filter((b) => b.state === "available").sort((a, b) => a.price - b.price)[0];
      expect((await this.addBerth(berth.id)).status(), `berth ${berth.id}`).toBe(200);
    }
    let table: Table | undefined;
    if (plan.table) {
      const tables = await this.tables();
      table = typeof plan.table === "string" ? tables.find((t) => t.company === plan.table) : tables.find((t) => t.state === "available");
      expect(table, `table ${plan.table} tonight`).toBeDefined();
      expect((await this.joinTable(table!.company)).status(), `join ${table!.company}`).toBe(200);
    }
    const entry = await this.settle();
    return { room, berth, table, entry };
  }

  /** Books a room (and pays it): the shortest way to a Viking with a room tonight. */
  async bookRoom(id: number) {
    const res = await this.addRoom(id);
    expect(res.status(), `put room ${id} in the Loot Sack: ${await res.text()}`).toBe(200);
    return this.settle();
  }
}

/** Reads `{ error: { code, message } }` from a failed API response. */
export async function errorOf(res: APIResponse): Promise<ApiError> {
  return (await res.json()).error;
}
