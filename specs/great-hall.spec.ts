import { FULL_POUCH, REGULAR_ROOMS, ROOMS, TEST_SAGA } from "../src/constants";
import { expect, test } from "../src/fixtures";
import { errorOf, type Room, type TavernApi } from "../src/tavern-api";

// The Great Hall: Select Room, the windows, booking a room into the Loot Sack, one room per saga,
// Lady Owner turning away a thin pouch, and paying. See the app's docs/SPEC.md, sections 2.1 and 2.5.

/** The cheapest free regular room tonight (optionally only among some rooms). */
async function freeRoom(api: TavernApi, among: readonly number[] = REGULAR_ROOMS): Promise<Room> {
  const free = (await api.rooms()).filter((r) => r.state === "available" && among.includes(r.id)).sort((a, b) => a.price - b.price);
  expect(free.length, "a free room tonight").toBeGreaterThan(0);
  return free[0];
}

test.describe("Select Room", () => {
  test("windows stay dark until Select Room, then show tonight's rooms as the API does", async ({ api, greatHall }) => {
    await greatHall.goto();
    await expect(greatHall.scene).toHaveAttribute("data-revealed", "false");
    await expect(greatHall.room(1)).toHaveAttribute("data-state", "unknown");

    await greatHall.revealRooms();

    const rooms = await api.rooms();
    for (const room of rooms) await expect(greatHall.room(room.id)).toHaveAttribute("data-state", room.state);
    const free = rooms.filter((r) => r.state === "available").length;
    await expect(greatHall.toast).toContainText(`${free} rooms are free tonight`);
  });

  test("the same saga number always gives the same night", async ({ api }) => {
    const first = await api.rooms();
    await api.beginSaga({ seed: TEST_SAGA, silver: FULL_POUCH });
    expect(await api.rooms()).toEqual(first);
  });

  test("the Kitchen and the Goat Stable stay closed until Lady Owner offers them", async ({ api, greatHall }) => {
    await greatHall.goto();
    await greatHall.revealRooms();
    for (const id of [ROOMS.kitchen, ROOMS.goatStable]) {
      await expect(greatHall.room(id)).toHaveAttribute("data-state", "closed");
      const res = await api.addRoom(id);
      expect(res.status()).toBe(409);
      expect((await errorOf(res)).code).toBe("ROOM_NOT_OFFERED");
    }
  });

  test("hovering a free room shows its teaser and price", async ({ api, greatHall }) => {
    const room = await freeRoom(api);
    await greatHall.goto();
    await greatHall.revealRooms();
    await greatHall.room(room.id).hover();
    await expect(greatHall.tip).toBeVisible();
    await expect(greatHall.tip).toContainText(room.teaser);
    await expect(greatHall.tip).toContainText(`${room.price} silver`);
  });

  test("another guest's room says Occupied and can't be chosen", async ({ api, greatHall }) => {
    await api.beginSaga({ seed: TEST_SAGA, places: "taken", silver: FULL_POUCH });
    await greatHall.goto();
    await greatHall.revealRooms();
    const room = greatHall.room(5);
    await expect(room).toHaveAttribute("data-state", "occupied");
    await expect(room).toHaveAttribute("aria-disabled", "true");
    await room.hover();
    await expect(greatHall.tip).toContainText("Occupied");
  });
});

test.describe("booking a room", () => {
  test("Put in Loot Sack: the dialog keeps the twist secret, the message after it tells it", async ({ api, greatHall, page }) => {
    const room = await freeRoom(api);
    await greatHall.goto();
    await greatHall.revealRooms();
    await greatHall.openRoom(room.id);

    const dialog = greatHall.dialog;
    await expect(dialog.title).toHaveText(`${room.name} — ${room.price} silver`);
    await expect(dialog.where).toHaveText(room.where);
    await expect(dialog.teaser).toHaveText(room.teaser);
    await expect(dialog.storyNote).toContainText("I'll tell you once the room is yours");
    await expect(dialog.pouch).toContainText(`${FULL_POUCH} silver`);
    // The twist is not in the page before the room is yours.
    expect(room.twist).toBeUndefined();

    await dialog.confirm.click();

    await expect(greatHall.reveal.root).toBeVisible();
    await expect(greatHall.reveal.title).toContainText(room.name);
    const twist = (await api.room(room.id)).twist;
    expect(twist, "the API tells the twist once the room is yours").toBeTruthy();
    await expect(greatHall.reveal.twist).toHaveText(twist!);
    await greatHall.reveal.close.click();

    await expect(greatHall.room(room.id)).toHaveAttribute("data-state", "in-sack");
    await expect(greatHall.header.lootCount).toHaveText("1");
    // The tavern opens up for a guest of the house.
    await expect(greatHall.doorOpen).toBeVisible();
    await expect(greatHall.barowlAwake).toBeVisible();
    await expect(greatHall.goToBar).toBeVisible();
    await expect(greatHall.selectRoom).toHaveCount(0);
    await expect(greatHall.selectBerth).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test("one room per saga: once a room is in the Loot Sack the free windows go quiet, and the API refuses a second one", async ({ api, greatHall }) => {
    const [first, second] = (await api.rooms()).filter((r) => r.state === "available" && r.id >= 1 && r.id <= 16);
    expect((await api.addRoom(first.id)).status()).toBe(200);

    await greatHall.goto();
    await expect(greatHall.room(first.id)).toHaveAttribute("data-look", "mine");
    // The other free rooms are plain painted windows now: still free (data-state), but not lit and not clickable.
    await expect(greatHall.room(second.id)).toHaveAttribute("data-look", "rest");
    await expect(greatHall.room(second.id)).toHaveAttribute("data-state", "available");
    await expect(greatHall.room(second.id)).toBeDisabled();
    await expect(greatHall.selectRoom).toHaveCount(0);

    const res = await api.addRoom(second.id);
    expect(res.status()).toBe(409);
    expect((await errorOf(res)).code).toBe("ROOM_ALREADY_CHOSEN");
  });

  test("taking the room out of the Loot Sack frees it again, and Select Room comes back", async ({ api, greatHall, lootSack }) => {
    const room = await freeRoom(api);
    await api.addRoom(room.id);

    await lootSack.goto();
    await expect(lootSack.line(room.name)).toHaveCount(1);
    await lootSack.remove(room.name);
    await expect(lootSack.empty).toBeVisible();

    await greatHall.goto();
    await expect(greatHall.selectRoom).toBeVisible();
    await greatHall.revealRooms();
    await expect(greatHall.room(room.id)).toHaveAttribute("data-state", "available");
    await expect(greatHall.room(room.id)).toHaveAttribute("data-look", "available");
  });

  test("settling pays the room: the window turns booked and the left plank becomes Check Out", async ({ api, greatHall, lootSack, settlePage, page }) => {
    const room = await freeRoom(api, ROOMS.quiet);
    await api.addRoom(room.id);

    await lootSack.goto();
    await expect(lootSack.total).toContainText(String(room.price));
    await lootSack.settle.click();
    await expect(page).toHaveURL(/\/settle$/);
    await expect(settlePage.total).toContainText(String(room.price));
    await settlePage.pay.click();

    await expect(settlePage.settledBanner).toBeVisible();
    await expect(settlePage.header.silver).toHaveText(`${FULL_POUCH - room.price} silver`);
    await expect(settlePage.header.lootCount).toHaveText("0");

    await greatHall.goto();
    await expect(greatHall.room(room.id)).toHaveAttribute("data-state", "booked");
    await expect(greatHall.checkOut).toBeVisible();
  });
});

test.describe("turned away at the door", () => {
  // With every regular room free, a pouch of 5 silver can't pay for any of them (they cost 8 or more).
  test("a room the pouch can't pay for says so plainly, and Lady Owner offers the Goat Stable", async ({ api, greatHall, page }) => {
    await api.beginSaga({ seed: TEST_SAGA, places: "free", silver: 5 });
    await greatHall.goto();
    await greatHall.revealRooms();
    await greatHall.openRoom(ROOMS.jarl);

    // No room story and no Put in Loot Sack: just the plain fact, and Lady Owner's answer at once.
    await expect(page.getByTestId("room-dialog-cant-afford")).toHaveAttribute("data-room-id", String(ROOMS.jarl));
    await expect(page.getByTestId("room-dialog-cant-afford-text")).toContainText("your Coin Pouch holds 5. You can't afford it this time.");
    await expect(page.getByTestId("room-dialog-teaser")).toHaveCount(0);
    await expect(greatHall.dialog.confirm).toHaveCount(0);
    await expect(greatHall.dialog.error).toHaveAttribute("data-error-code", "ROOM_TOO_EXPENSIVE");
    await expect(greatHall.dialog.error).toHaveAttribute("data-offered-room-id", String(ROOMS.goatStable));
    // She shows the window to look for, and its window lights up in the hall behind the dialog.
    await expect(page.getByTestId("room-dialog-offer")).toHaveAttribute("data-room-id", String(ROOMS.goatStable));
    await expect(page.getByTestId("room-dialog-offer-text")).toContainText("Goat Stable, number 17");
    await expect(greatHall.room(ROOMS.goatStable)).toHaveAttribute("data-state", "available");

    // Show me the Goat Stable: its own dialog, ready to book.
    await page.getByTestId("room-dialog-offer-open").click();
    await expect(greatHall.dialog.title).toContainText("Goat Stable");
    await expect(greatHall.dialog.confirm).toBeEnabled();
  });

  test("Show me the Kitchen Fellowship, then Put in Loot Sack: booked at once, for free", async ({ api, greatHall, page }) => {
    // Bug found by Lady Owner (2026-11-24): the Kitchen's button said "Booking…" and stayed off.
    await api.beginSaga({ seed: TEST_SAGA, places: "free", silver: 1 });
    await greatHall.goto();
    await greatHall.revealRooms();
    await greatHall.openRoom(ROOMS.jarl);
    await page.getByTestId("room-dialog-offer-open").click();
    await expect(greatHall.dialog.title).toContainText("Kitchen Fellowship — free");
    await expect(greatHall.dialog.confirm).toHaveText("Put in Loot Sack");
    await expect(greatHall.dialog.confirm).toBeEnabled();
    await greatHall.dialog.confirm.click();
    await expect(page.getByTestId("room-reveal")).toBeVisible();
    expect((await api.sack()).lines).toMatchObject([{ kind: "room", id: ROOMS.kitchen, price: 0 }]);
  });

  test("a pouch with enough for a cheaper room only hears that there are cheaper rooms", async ({ api, greatHall, page }) => {
    await api.beginSaga({ seed: TEST_SAGA, places: "free", silver: 30 });
    await greatHall.goto();
    await greatHall.revealRooms();
    await greatHall.openRoom(ROOMS.jarl);
    await expect(greatHall.dialog.error).toContainText("cheaper rooms tonight");
    await expect(greatHall.dialog.error).not.toHaveAttribute("data-offered-room-id");
    await expect(page.getByTestId("room-dialog-offer-open")).toHaveCount(0);
  });

  test("a pouch too thin even for the Goat Stable is offered the Kitchen Fellowship, for free", async ({ api }) => {
    await api.beginSaga({ seed: TEST_SAGA, places: "free", silver: 1 });
    const res = await api.addRoom(ROOMS.jarl);
    expect(res.status()).toBe(400);
    const error = await errorOf(res);
    expect(error.code).toBe("ROOM_TOO_EXPENSIVE");
    expect(error.offeredRoomId).toBe(ROOMS.kitchen);
    expect((await api.room(ROOMS.kitchen))).toMatchObject({ state: "available", price: 0 });
    expect((await api.addRoom(ROOMS.kitchen)).status()).toBe(200);
  });
});

test.describe("guests", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a guest can look at a room but is asked to enter the hall to book it", async ({ greatHall, page }) => {
    await greatHall.goto(`?seed=${TEST_SAGA}`);
    await greatHall.revealRooms();
    const free = page.locator("[data-testid^='room-'][data-state='available']").first();
    await free.click();
    await expect(greatHall.dialog.loginNote).toBeVisible();
    await expect(greatHall.dialog.confirm).toHaveCount(0);
    await expect(greatHall.dialog.login).toHaveAttribute("href", "/enter?next=/");
    await expect(greatHall.dialog.signup).toHaveAttribute("href", "/oath?next=/");
  });
});
