import { FULL_POUCH, ROOMS, TEST_SAGA } from "../src/constants";
import { expect, test } from "../src/fixtures";
import { errorOf, type Night, type TavernApi } from "../src/tavern-api";

// Morning Check Out: what happened during the night, refunds and charges, the pirates' boat swap, and the saga closing.
// The Master's Table forces each event (rooms / harbor / tables: always or never), so every test knows what to expect.
// See the app's docs/SPEC.md, sections 2.3 and 2.6.

/** Begins a night with every room, berth and table free (so any of them can be booked) and the settings given. */
async function freeNight(api: TavernApi, night: Night = {}) {
  await api.beginSaga({ seed: TEST_SAGA, places: "free", silver: FULL_POUCH, ...night });
}

/** Begins a free night on the first saga number where this company comes to Mead & Feast. */
async function nightWithCompany(api: TavernApi, company: string, night: Night = {}) {
  for (let seed = 1; seed < 200; seed++) {
    await api.beginSaga({ seed, places: "free", silver: FULL_POUCH, ...night });
    if ((await api.tables()).some((t) => t.company === company)) return seed;
  }
  throw new Error(`no saga with ${company}`);
}

const QUIET_ROOM = ROOMS.quiet[0];
const quiet: Night = { rooms: "never", harbor: "quiet", tables: "never" };

test.describe("before Check Out", () => {
  test("with nothing paid there's nothing to check out", async ({ api, morning }) => {
    await morning.goto();
    await expect(morning.nothing).toBeVisible();
    await expect(morning.checkOut).toHaveCount(0);
    const res = await api.checkOutRaw();
    expect(res.status()).toBe(400);
    expect((await errorOf(res)).code).toBe("NOTHING_TO_CHECK_OUT");
  });

  test("something unpaid in the Loot Sack keeps you from checking out", async ({ api }) => {
    await freeNight(api);
    await api.night({ room: QUIET_ROOM });
    const berth = (await api.berths()).find((b) => b.state === "available")!;
    await api.addBerth(berth.id);
    const res = await api.checkOutRaw();
    expect((await errorOf(res)).code).toBe("NOTHING_TO_CHECK_OUT");
  });

  test("a paid room sets the night: the Great Hall's plank becomes Check Out", async ({ api, greatHall, morning }) => {
    await freeNight(api, quiet);
    await api.night({ room: QUIET_ROOM });
    await greatHall.goto();
    await greatHall.checkOut.click();
    await expect(morning.morning).toBeVisible();
    await expect(morning.card.root).toHaveAttribute("data-code", "quiet-night");
  });
});

test.describe("a quiet night", () => {
  test("nothing happened: one card, no refund, and the summary", async ({ api, morning }) => {
    await freeNight(api, quiet);
    const { entry } = await api.night({ room: QUIET_ROOM, berth: true, table: true });
    await morning.goto();
    await expect(morning.ready).toBeVisible();
    await morning.checkOut.click();

    await expect(morning.morning).toHaveAttribute("data-cards", "1");
    await expect(morning.card.root).toHaveAttribute("data-code", "quiet-night");
    await expect(morning.card.refund).toHaveCount(0);
    await morning.next.click();
    await expect(morning.summary).toBeVisible();
    await expect(morning.refundTotal).toHaveAttribute("data-amount", "0");
    await expect(morning.silverAfter).toHaveText(String(entry.silverAfter));
  });
});

test.describe("room events", () => {
  // Who comes home at night, and how much of the room Lady Owner gives back (docs/SPEC.md 2.6).
  const roomEvents = [
    { room: 1, code: "jarl-returns", share: 1 / 2, back: "half the room" },
    { room: 3, code: "mother-in-law-arrives", share: 1 / 4, back: "a quarter of the room" },
    { room: 9, code: "dragon-returns", share: 1, back: "the whole room" },
    { room: 12, code: "knight-knocks", share: 1 / 4, back: "a quarter of the room" },
  ];
  for (const e of roomEvents) {
    test(`room ${e.room}: ${e.code}, ${e.back} back`, async ({ api, morning }) => {
      await freeNight(api, { rooms: "always", harbor: "quiet", tables: "never" });
      const { room, entry } = await api.night({ room: e.room });
      const refund = Math.floor(room.price * e.share);

      await morning.goto();
      await morning.checkOut.click();
      await expect(morning.card.root).toHaveAttribute("data-code", e.code);
      await expect(morning.card.refund).toHaveAttribute("data-amount", String(refund));
      await expect(morning.card.drink).toBeVisible();
      await morning.next.click();
      await expect(morning.silverAfter).toHaveText(String(entry.silverAfter + refund));
      expect((await api.me()).silver).toBe(entry.silverAfter + refund);
    });
  }

  test("a room with no story of its own stays quiet even at 100%", async ({ api }) => {
    await freeNight(api, { rooms: "always", harbor: "quiet", tables: "never" });
    await api.night({ room: QUIET_ROOM });
    expect((await api.checkOut()).events).toEqual([]);
  });
});

test.describe("harbor events", () => {
  test("the Kraken eats your boat: the whole berth back", async ({ api }) => {
    await freeNight(api, { rooms: "never", harbor: "kraken-eats", tables: "never" });
    const { berth } = await api.night({ room: QUIET_ROOM, berth: true });
    const [event] = (await api.checkOut()).events;
    expect(event).toMatchObject({ code: "kraken-eats", kind: "berth", id: berth!.id, refund: berth!.price });
  });

  test("the Kraken damages your boat: half the berth back", async ({ api }) => {
    await freeNight(api, { rooms: "never", harbor: "kraken-damages", tables: "never" });
    const { berth } = await api.night({ room: QUIET_ROOM, berth: true });
    const [event] = (await api.checkOut()).events;
    expect(event).toMatchObject({ code: "kraken-damages", refund: Math.floor(berth!.price / 2) });
  });

  test("the pirates take your boat: you choose the refund, and you can't choose again", async ({ api, morning, harbor }) => {
    await freeNight(api, { rooms: "never", harbor: "pirates", tables: "never" });
    const { berth, entry } = await api.night({ room: QUIET_ROOM, berth: true });
    await morning.goto();
    await morning.checkOut.click();

    await expect(morning.card.root).toHaveAttribute("data-code", "pirates-take-boat");
    await expect(morning.card.root).toHaveAttribute("data-choice", "waiting");
    await expect(morning.next).toHaveCount(0); // the morning waits for your choice
    // Their wreck already lies at your berth.
    const harborCheck = await api.berths();
    expect(harborCheck.find((b) => b.id === berth!.id)!.state).toBe("booked");

    await morning.card.takeRefund.click();
    const half = Math.floor(berth!.price / 2);
    await expect(morning.card.root).toHaveAttribute("data-choice", "refund");
    await expect(morning.card.refund).toHaveAttribute("data-amount", String(half));
    expect((await api.me()).silver).toBe(entry.silverAfter + half);

    const again = await api.chooseRaw("boat");
    expect(again.status()).toBe(409);
    expect((await errorOf(again)).code).toBe("CHOICE_ALREADY_MADE");

    await harbor.goto();
    await expect(harbor.boat(berth!.id)).toHaveAttribute("data-picture", "sorry");
    await expect(harbor.boat(berth!.id)).toHaveAttribute("data-choice", "refund");
  });

  test("the pirates take your boat: their wreck, with what's found aboard", async ({ api }) => {
    await freeNight(api, { rooms: "never", harbor: "pirates", tables: "never" });
    const { berth } = await api.night({ room: QUIET_ROOM, berth: true });
    const before = await api.checkOut();
    expect(before.events[0]).toMatchObject({ code: "pirates-take-boat", needsChoice: true, refund: 0 });

    const res = await api.chooseRaw("boat");
    expect(res.status()).toBe(200);
    const after = (await res.json()).checkout;
    const found = after.events[0].refund;
    expect(found).toBeGreaterThanOrEqual(1);
    expect(found).toBeLessThanOrEqual(Math.floor(berth!.price * 1.2));
    expect(after.events[0].choice).toBe("boat");
  });

  test("a choice nobody asked for is refused", async ({ api }) => {
    const notCheckedOut = await api.chooseRaw("refund");
    expect((await errorOf(notCheckedOut)).code).toBe("NOT_CHECKED_OUT");

    await freeNight(api, quiet);
    await api.night({ room: QUIET_ROOM });
    await api.checkOut();
    expect((await errorOf(await api.chooseRaw("refund"))).code).toBe("NOTHING_TO_CHOOSE");
    const goat = await api.chooseRaw("goat");
    expect(goat.status()).toBe(400);
    expect((await errorOf(goat)).code).toBe("INVALID_CHOICE");
  });
});

test.describe("table events", () => {
  test("the Mighty Boyfriend: Lady Owner charges for the furniture, shown in red", async ({ api, morning, page }) => {
    await nightWithCompany(api, "lady", { rooms: "never", harbor: "quiet", tables: "always" });
    const { entry } = await api.night({ room: QUIET_ROOM, table: "lady" });
    await morning.goto();
    await morning.checkOut.click();

    await expect(morning.card.root).toHaveAttribute("data-code", "boyfriend-returns");
    const charge = Number(await morning.card.charge.getAttribute("data-amount"));
    expect(charge).toBeGreaterThanOrEqual(5);
    expect(charge).toBeLessThanOrEqual(9);
    await expect(morning.card.charge).toHaveText(`Charged: −${charge} silver`);
    await morning.next.click();
    await expect(morning.chargeTotal).toHaveAttribute("data-amount", String(charge));
    await expect(morning.silverAfter).toHaveText(String(entry.silverAfter - charge));

    // The Coin Pouch shows it as Lady Owner's charge.
    await page.goto("/pouch");
    const latest = page.getByTestId("pouch-transaction").first();
    await expect(latest).toHaveAttribute("data-type", "payment");
    await expect(latest).toContainText("Lady Owner's charge");
  });

  test("the Dragon flame: a quarter of the room back for the fright", async ({ api }) => {
    await nightWithCompany(api, "dragons", { rooms: "never", harbor: "quiet", tables: "always" });
    const { room } = await api.night({ room: QUIET_ROOM, table: "dragons" });
    const [event] = (await api.checkOut()).events;
    expect(event).toMatchObject({ code: "dragon-flame", kind: "table", company: "dragons", refund: Math.floor(room.price / 4) });
  });

  test("the kitchen mice: no silver either way, just their cheese", async ({ api }) => {
    await nightWithCompany(api, "mice", { rooms: "never", harbor: "quiet", tables: "always" });
    await api.night({ room: QUIET_ROOM, table: "mice" });
    const [event] = (await api.checkOut()).events;
    expect(event).toMatchObject({ code: "mice-taste-ear", refund: 0 });
  });

  // Robin Hood robs only a Viking who looks rich: 60 silver or more at Check Out.
  for (const silverAtCheckOut of [59, 60]) {
    test(`Robin Hood ${silverAtCheckOut >= 60 ? "robs" : "spares"} a Viking with ${silverAtCheckOut} silver`, async ({ api }) => {
      await nightWithCompany(api, "robin-hood", { rooms: "never", harbor: "quiet", tables: "always" });
      const price = (await api.room(QUIET_ROOM)).price;
      // Set the pouch so that after paying the room exactly `silverAtCheckOut` is left.
      const seed = (await api.me()).sagaSeed;
      await api.beginSaga({ seed, places: "free", rooms: "never", harbor: "quiet", tables: "always", silver: silverAtCheckOut + price });
      await api.night({ room: QUIET_ROOM, table: "robin-hood" });
      expect((await api.me()).silver).toBe(silverAtCheckOut);

      const events = (await api.checkOut()).events;
      if (silverAtCheckOut >= 60) expect(events[0]).toMatchObject({ code: "robin-hood-robs", refund: -Math.max(3, Math.floor(silverAtCheckOut / 10)) });
      else expect(events).toEqual([]);
    });
  }
});

test.describe("one night, every event", () => {
  test("the room's event comes first, then the boat's, then the table's", async ({ api, morning }) => {
    await nightWithCompany(api, "pirates", { rooms: "always", harbor: "pirates", tables: "always" });
    await api.night({ room: 1, berth: true, table: "pirates" });
    await morning.goto();
    await morning.checkOut.click();
    await expect(morning.morning).toHaveAttribute("data-cards", "3");
    await expect(morning.card.root).toHaveAttribute("data-code", "jarl-returns");
    await morning.next.click();
    await expect(morning.card.root).toHaveAttribute("data-code", "pirates-take-boat");
    await morning.card.takeBoat.click();
    await expect(morning.card.root).toHaveAttribute("data-choice", "boat");
    await morning.next.click();
    await expect(morning.card.root).toHaveAttribute("data-code", "crab-in-boot");
    await morning.next.click();
    await expect(morning.summaryEvents).toHaveCount(3);
  });
});

test.describe("after Check Out", () => {
  test("the saga is closed: nothing more can be booked, and checking out again is refused", async ({ api, morning }) => {
    await freeNight(api, quiet);
    await api.night({ room: QUIET_ROOM });
    await api.checkOut();

    const again = await api.checkOutRaw();
    expect(again.status()).toBe(409);
    expect((await errorOf(again)).code).toBe("ALREADY_CHECKED_OUT");
    for (const res of [await api.addRoom(5), await api.addBerth(1)]) {
      expect(res.status()).toBe(409);
      expect((await errorOf(res)).code).toBe("SAGA_CLOSED");
    }
    // The morning can be read again.
    await morning.goto();
    await expect(morning.card.root).toHaveAttribute("data-code", "quiet-night");
  });

  test("the Rune Ledger keeps the night's morning with its entry", async ({ api, page }) => {
    await freeNight(api, { rooms: "always", harbor: "quiet", tables: "never" });
    const { entry } = await api.night({ room: 1 });
    await api.checkOut();
    await page.goto(`/ledger/${entry.id}`);
    const event = page.getByTestId("ledger-morning-event");
    await expect(event).toHaveAttribute("data-code", "jarl-returns");
    await expect(event).toContainText("The Jarl came home");
  });

  test("entering the hall again after Check Out begins a new day (a new saga)", async ({ api, page }) => {
    await freeNight(api, quiet);
    await api.night({ room: QUIET_ROOM });
    await api.checkOut();
    const res = await page.request.post("/api/auth/login", { data: { username: process.env.VIKING_NAME } });
    expect(res.status()).toBe(200);
    expect((await res.json()).newSaga).toBe(true);
    expect((await api.me()).sagaSeed).not.toBe(TEST_SAGA);
    expect((await api.rooms()).some((r) => r.state === "booked")).toBe(false);
  });
});
