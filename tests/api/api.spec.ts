import { expect, test as plain, type APIResponse } from "@playwright/test";
import { FULL_POUCH, ROOMS, TEST_SAGA } from "@utils/constants";
import { test } from "@fixtures/fixtures";
import { errorOf } from "@utils/tavern-api";

// The tavern's JSON API: the rules and error codes not already checked by the other specs.
// Errors always come as { error: { code, message } }. See the app's docs/SPEC.md, section 2.5.
// The Vikings rules are only tried with names that must be refused, so no account is ever created.

async function expectError(res: APIResponse, status: number, code: string) {
  expect(res.status(), `${code}: ${await res.text()}`).toBe(status);
  const error = await errorOf(res);
  expect(error.code).toBe(code);
  expect(error.message.length, "every error has a message").toBeGreaterThan(0);
}

plain.describe("Vikings (no login needed)", () => {
  plain.use({ storageState: { cookies: [], origins: [] } });

  const badNames = [
    { username: "Ra", code: "USERNAME_INVALID" }, // too short (3–20)
    { username: "R".repeat(21), code: "USERNAME_INVALID" }, // too long
    { username: "Ragnar Lothbrok", code: "USERNAME_INVALID" }, // letters and digits only
    { username: "Ragnar!", code: "USERNAME_INVALID" },
    { username: "TheBarowl", code: "USERNAME_NOT_ALLOWED" }, // names that could confuse other Vikings
    { username: "InnkeeperBob", code: "USERNAME_NOT_ALLOWED" },
  ];
  for (const n of badNames) {
    plain(`Swear the Oath refuses "${n.username}" with ${n.code}`, async ({ request }) => {
      await expectError(await request.post("/api/auth/signup", { data: { username: n.username } }), 400, n.code);
    });
  }

  plain("a name already sworn, in any case, is taken", async ({ request }) => {
    const res = await request.post("/api/auth/signup", { data: { username: process.env.VIKING_NAME!.toUpperCase() } });
    await expectError(res, 409, "USERNAME_TAKEN");
  });

  plain("entering the hall as an unknown Viking says so", async ({ request }) => {
    await expectError(await request.post("/api/auth/login", { data: { username: "NoSuchViking42" } }), 404, "USER_NOT_FOUND");
  });

  plain("a body that isn't JSON is an INVALID_REQUEST", async ({ request }) => {
    const res = await request.post("/api/auth/login", { data: "Ragnar", headers: { "content-type": "text/plain" } });
    await expectError(res, 400, "INVALID_REQUEST");
  });

  plain("a guest can look at any night by its saga number, but not at a nonsense one", async ({ request }) => {
    const a = await (await request.get(`/api/rooms?seed=${TEST_SAGA}`)).json();
    const b = await (await request.get(`/api/rooms?seed=${TEST_SAGA}`)).json();
    expect(a).toEqual(b);
    expect(a.sagaSeed).toBe(TEST_SAGA);
    await expectError(await request.get("/api/rooms?seed=abc"), 400, "INVALID_SEED");
    await expectError(await request.get("/api/berths?seed=0"), 400, "INVALID_SEED");
    await expectError(await request.get("/api/tables?seed=1000000"), 400, "INVALID_SEED");
  });

  plain("everything that belongs to a Viking needs a login", async ({ request }) => {
    for (const res of [
      await request.get("/api/loot-sack"),
      await request.post("/api/loot-sack/items", { data: { kind: "room", id: 5 } }),
      await request.post("/api/settle"),
      await request.get("/api/pouch"),
      await request.post("/api/pouch/refill"),
      await request.get("/api/ledger"),
      await request.post("/api/checkout"),
      await request.post("/api/saga/new"),
      await request.post("/api/tables/join", { data: { company: "mice" } }),
    ]) {
      await expectError(res, 401, "NOT_LOGGED_IN");
    }
  });
});

test.describe("the Loot Sack", () => {
  test("only rooms and berths go in, and only ones that exist", async ({ api, page }) => {
    await expectError(await page.request.post("/api/loot-sack/items", { data: { kind: "goat", id: 1 } }), 400, "INVALID_REQUEST");
    await expectError(await api.addRoom(18), 404, "ROOM_NOT_FOUND");
    await expectError(await api.addRoom("eleven"), 404, "ROOM_NOT_FOUND");
    await expectError(await api.addBerth(10), 404, "BERTH_NOT_FOUND");
  });

  test("another guest's room or another Viking's berth is taken", async ({ api }) => {
    await api.beginSaga({ seed: TEST_SAGA, places: "taken", silver: FULL_POUCH });
    await expectError(await api.addRoom(5), 409, "ROOM_TAKEN");
    await expectError(await api.addBerth(1), 409, "BERTH_TAKEN");
  });

  test("taking out what isn't in the sack says so", async ({ api }) => {
    await expectError(await api.removeFromSack("room", 5), 404, "NOT_IN_SACK");
  });

  test("the twist of a room you haven't chosen never leaves the tavern", async ({ api }) => {
    for (const room of await api.rooms()) expect(room.twist, `room ${room.id}`).toBeUndefined();
  });
});

test.describe("settling", () => {
  test("an empty sack can't be settled", async ({ api }) => {
    await expectError(await api.settleRaw(), 400, "SACK_EMPTY");
  });

  test("if the sack changed since you looked, you're told before paying", async ({ api }) => {
    await api.beginSaga({ seed: TEST_SAGA, places: "free", silver: FULL_POUCH });
    await api.addRoom(ROOMS.quiet[0]);
    const total = (await api.sack()).total;
    await expectError(await api.settleRaw(total + 1), 409, "SACK_CHANGED");
  });

  test("a room and a berth together can cost more than the pouch holds", async ({ api }) => {
    await api.beginSaga({ seed: TEST_SAGA, places: "free", silver: 30 });
    const room = (await api.rooms()).filter((r) => r.state === "available" && r.id >= 1 && r.id <= 16 && r.price <= 30).sort((a, b) => b.price - a.price)[0];
    expect((await api.addRoom(room.id)).status()).toBe(200);
    const berth = (await api.berths()).sort((a, b) => b.price - a.price)[0];
    expect((await api.addBerth(berth.id)).status()).toBe(200);
    test.skip((await api.sack()).total <= 30, "tonight's room and berth fit in 30 silver");
    await expectError(await api.settleRaw(), 400, "INSUFFICIENT_SILVER");
  });

  test("paying writes a Ledger entry, takes the silver and adds a payment to the Coin Pouch", async ({ api }) => {
    await api.beginSaga({ seed: TEST_SAGA, places: "free", silver: FULL_POUCH });
    const room = await api.room(ROOMS.quiet[0]);
    await api.addRoom(room.id);
    const entry = await api.settle();
    expect(entry).toMatchObject({ total: room.price, silverAfter: FULL_POUCH - room.price });
    expect(await api.ledgerEntry(entry.id)).toMatchObject({ id: entry.id, sagaSeed: TEST_SAGA, total: room.price });
    const [latest] = (await api.pouch()).transactions;
    expect(latest).toMatchObject({ type: "payment", amount: -room.price });
  });
});

test.describe("the Coin Pouch and the Ledger", () => {
  test("the Jarl's treasury tops up to exactly 100, and refuses a full pouch", async ({ api, page }) => {
    await expectError(await page.request.post("/api/pouch/refill"), 400, "POUCH_FULL");
    await api.beginSaga({ seed: TEST_SAGA, silver: 37 });
    const res = await page.request.post("/api/pouch/refill");
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ added: 63, pouch: { silver: FULL_POUCH } });
  });

  test("a Ledger entry that doesn't exist (or isn't yours) is not found", async ({ page }) => {
    await expectError(await page.request.get("/api/ledger/999999999"), 404, "ORDER_NOT_FOUND");
    await expectError(await page.request.get("/api/ledger/abc"), 404, "ORDER_NOT_FOUND");
  });

  test("/api/me tells who you are, your silver, your saga and your Loot Sack", async ({ api }) => {
    await api.addRoom((await api.rooms()).find((r) => r.state === "available" && r.id >= 1 && r.id <= 16)!.id);
    expect(await api.me()).toEqual({ username: expect.stringMatching(new RegExp(`^${process.env.VIKING_NAME}$`, "i")), silver: FULL_POUCH, sagaSeed: TEST_SAGA, sackCount: 1 });
  });
});
