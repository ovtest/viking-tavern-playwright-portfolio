import { FULL_POUCH, ROOMS, TEST_SAGA } from "../src/constants";
import { expect, test } from "../src/fixtures";
import { DishPage } from "../src/pages/menu-page";
import { errorOf, type TavernApi } from "../src/tavern-api";

// Barowl's Menu (/feast/menu and /feast/menu/<dish>): anyone can read it, but you eat where you sit, so ordering
// needs a table. Dishes and drinks go in the Loot Sack, 1–10 of each, and are paid with the room.
// See the app's docs/SPEC.md, section 2.3, "Menu". The dishes come from a file Lady Owner keeps adding to, so the
// tests read the menu from the API instead of knowing its dishes. Each night the saga number takes one dish off the
// menu ("today we only caught a turkey"), so a test that orders picks a dish that's on tonight.

/** A room in the Loot Sack and a seat at the first table with one: what a Viking needs to order. */
async function sitDown(api: TavernApi) {
  const room = (await api.rooms()).find((r) => r.state === "available" && (ROOMS.quiet as readonly number[]).includes(r.id));
  expect(room, "a free quiet room tonight").toBeDefined();
  expect((await api.addRoom(room!.id)).status()).toBe(200);
  const table = (await api.tables()).find((t) => t.state === "available");
  expect((await api.joinTable(table!.company)).status()).toBe(200);
  return room!;
}

test.describe("reading the menu", () => {
  test("drinks and dishes with their prices, the same as the API; never wine", async ({ api, menu }) => {
    const { drinks, dishes } = await api.menu();
    expect(drinks.length).toBeGreaterThan(0);
    expect(dishes.length).toBeGreaterThan(0);
    expect([...drinks, ...dishes].map((x) => x.name).join(" ")).not.toMatch(/wine/i);
    await menu.goto();
    for (const d of drinks) {
      await expect(menu.part("drink", d.id, "name")).toHaveText(d.name);
      await expect(menu.part("drink", d.id, "price")).toHaveText(`${d.price} silver`);
    }
    for (const d of dishes) {
      await expect(menu.part("dish", d.id, "name")).toHaveText(d.name);
      await expect(menu.part("dish", d.id, "price")).toHaveText(`${d.price} silver`);
      await expect(menu.part("dish", d.id, "story-link")).toHaveAttribute("href", `/feast/menu/${d.id}`);
    }
  });

  test("a dish page: Jump to recipe, the story (or Barowl still remembering it), then the recipe", async ({ api, page }) => {
    const [first] = (await api.menu()).dishes;
    const dish = (await (await api.dishRaw(first.id)).json()).dish;
    const dishPage = new DishPage(page);
    await dishPage.goto(dish.id);
    await expect(dishPage.title).toHaveText(dish.name);
    await expect(dishPage.price).toHaveAttribute("data-price", String(dish.price));
    if (dish.hasStory) await expect(dishPage.storyMissing).toHaveCount(0);
    else await expect(dishPage.storyMissing).toBeVisible();
    await expect(dishPage.ingredients).toHaveCount(dish.ingredients.length);
    await expect(dishPage.steps).toHaveCount(dish.steps.length);

    await dishPage.jumpToRecipe.click();
    await expect(page).toHaveURL(/#recipe$/);
    await expect(dishPage.recipe).toBeInViewport();
  });

  test("a dish that doesn't exist is Lost at Sea, on the page and in the API", async ({ api, page }) => {
    await page.goto("/feast/menu/fried-kraken");
    await expect(page.getByTestId("not-found")).toBeVisible();
    const res = await api.dishRaw("fried-kraken");
    expect(res.status()).toBe(404);
    expect((await errorOf(res)).code).toBe("DISH_NOT_FOUND");
  });

  test.describe("as a guest", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("a guest can read everything, but is asked to enter the hall to order", async ({ menu, page }) => {
      await menu.goto();
      await expect(menu.orderNote).toHaveAttribute("data-state", "guest");
      await expect(page.getByTestId("menu-order-login")).toHaveAttribute("href", "/enter?next=/feast/menu");
      await expect(menu.part("drink", "honey-mead", "add")).toBeDisabled();
      const res = await page.request.post("/api/loot-sack/items", { data: { kind: "drink", id: "honey-mead" } });
      expect(res.status()).toBe(401);
    });
  });
});

test.describe("ordering", () => {
  test("without a table the food is off, and Barowl says to sit down first; drinks are fine anywhere", async ({ api, menu }) => {
    const dish = (await api.menu()).dishes.find((d) => d.state === "available")!;
    await menu.goto();
    await expect(menu.orderNote).toHaveAttribute("data-state", "needs-table");
    await expect(menu.selectTable).toHaveAttribute("href", "/feast?select=1");
    await expect(menu.part("dish", dish.id, "add")).toBeDisabled();
    await expect(menu.part("drink", "honey-mead", "add")).toBeEnabled();
    const res = await api.addMenuItem("dish", dish.id);
    expect(res.status()).toBe(409);
    expect((await errorOf(res)).code).toBe("TABLE_NEEDED");
    expect((await api.addMenuItem("drink", "honey-mead")).status()).toBe(200);
  });

  test("the way back is at the top: to your own table once you sit, to the tables before", async ({ api, menu, page }) => {
    await menu.goto();
    await expect(menu.backTop).toHaveText(/Back to the tables/);
    await expect(menu.backTop).not.toHaveAttribute("data-company");
    await sitDown(api);
    const mine = (await api.tables()).find((t) => t.state === "mine")!;
    await menu.goto();
    await expect(menu.backTop).toHaveText(new RegExp(`Back to your table: ${mine.name}`));
    await expect(menu.backTop).toHaveAttribute("data-company", mine.company);
    await menu.backTop.click();
    await expect(page).toHaveURL(/\/feast$/);
  });

  test("at a table: order with − / +, the Loot Sack counts every mug, and it's paid with the room", async ({ api, menu, lootSack, settlePage, page }) => {
    const room = await sitDown(api);
    const { drinks, dishes } = await api.menu();
    const [drink] = drinks;
    const dish = dishes.find((d) => d.state === "available")!;
    await menu.goto();
    await expect(menu.orderNote).toHaveCount(0);

    await menu.order("drink", drink.id, 3);
    await expect(menu.part("drink", drink.id, "message")).toContainText(`3 × ${drink.name}`);
    await expect(menu.part("drink", drink.id, "qty"), "back to 1 after adding").toHaveText("1");
    await menu.order("dish", dish.id);
    await expect(menu.header.lootCount).toHaveText("5"); // the room, 3 drinks and a dish

    await lootSack.goto();
    await expect(lootSack.line(drink.name).getByTestId("sack-line-qty")).toHaveAttribute("data-qty", "3");
    const total = room.price + 3 * drink.price + dish.price;
    await expect(lootSack.total).toHaveText(`${total} silver`);

    await settlePage.goto();
    await settlePage.pay.click();
    await expect(settlePage.settledBanner).toBeVisible();
    await expect(page.getByTestId("entry-item").filter({ hasText: drink.name })).toContainText("3");
    expect((await api.me()).silver).toBe(FULL_POUCH - total);
  });

  test("ordering the same again raises the line, up to 10", async ({ api }) => {
    await sitDown(api);
    const [drink] = (await api.menu()).drinks;
    expect((await api.addMenuItem("drink", drink.id, 4)).status()).toBe(200);
    const res = await api.addMenuItem("drink", drink.id, 6);
    expect(res.status()).toBe(200);
    expect((await res.json()).added).toMatchObject({ kind: "drink", id: drink.id, quantity: 10, lineTotal: 10 * drink.price });

    const tooMany = await api.addMenuItem("drink", drink.id, 1);
    expect(tooMany.status()).toBe(400);
    expect((await errorOf(tooMany)).code).toBe("QUANTITY_INVALID");
  });

  const refused = [
    { kind: "drink", id: "red-wine", qty: undefined, status: 404, code: "DRINK_NOT_FOUND" }, // no wine, ever
    { kind: "dish", id: "fried-kraken", qty: undefined, status: 404, code: "DISH_NOT_FOUND" },
    { kind: "dish", id: "honey-mead", qty: undefined, status: 404, code: "DISH_NOT_FOUND" }, // a drink isn't a dish
    { kind: "drink", id: "honey-mead", qty: 0, status: 400, code: "QUANTITY_INVALID" },
    { kind: "drink", id: "honey-mead", qty: 11, status: 400, code: "QUANTITY_INVALID" },
    { kind: "drink", id: "honey-mead", qty: 2.5, status: 400, code: "QUANTITY_INVALID" },
    { kind: "drink", id: "honey-mead", qty: "lots", status: 400, code: "QUANTITY_INVALID" },
  ] as const;
  for (const r of refused) {
    test(`${r.kind} "${r.id}" × ${r.qty ?? "(none)"} is refused with ${r.code}`, async ({ api }) => {
      await sitDown(api);
      const res = await api.addMenuItem(r.kind, r.id, r.qty);
      expect(res.status()).toBe(r.status);
      expect((await errorOf(res)).code).toBe(r.code);
    });
  }

  test("a dish taken out of the Loot Sack goes as a whole line", async ({ api }) => {
    await sitDown(api);
    const dish = (await api.menu()).dishes.find((d) => d.state === "available")!;
    await api.addMenuItem("dish", dish.id, 2);
    expect((await api.removeFromSack("dish", dish.id)).status()).toBe(200);
    expect((await api.sack()).lines.map((l) => l.kind)).toEqual(["room"]);
    expect((await api.removeFromSack("dish", dish.id)).status()).toBe(404);
  });

  test("after Check Out the kitchen is closed", async ({ api, menu }) => {
    await api.beginSaga({ seed: TEST_SAGA, places: "free", rooms: "never", tables: "never", harbor: "quiet", silver: FULL_POUCH });
    await sitDown(api);
    await api.settle();
    await api.checkOut();
    await menu.goto();
    await expect(menu.orderNote).toHaveAttribute("data-state", "closed");
    const res = await api.addMenuItem("drink", "honey-mead");
    expect((await errorOf(res)).code).toBe("SAGA_CLOSED");
  });
});

test.describe("sold out tonight", () => {
  test("on an ordinary night one dish is off, the same one for the same saga, with Barowl's excuse", async ({ api, menu }) => {
    const tonight = await api.menu();
    const off = tonight.dishes.filter((d) => d.state === "sold-out");
    expect(off).toHaveLength(1);
    expect(off[0].soldOutReason?.length).toBeGreaterThan(0);
    expect(tonight.drinks.every((d) => d.state === "available"), "the mead never runs out").toBe(true);

    await api.beginSaga({ seed: TEST_SAGA, silver: FULL_POUCH });
    expect((await api.menu()).dishes).toEqual(tonight.dishes);

    await sitDown(api);
    await menu.goto();
    await expect(menu.item("dish", off[0].id)).toHaveAttribute("data-state", "sold-out");
    await expect(menu.part("dish", off[0].id, "sold-out")).toContainText(off[0].soldOutReason!);
    await expect(menu.part("dish", off[0].id, "add"), "even at a table").toBeDisabled();
    const res = await api.addMenuItem("dish", off[0].id);
    expect(res.status()).toBe(409);
    expect((await errorOf(res)).code).toBe("DISH_SOLD_OUT");
  });

  test("other saga numbers take other dishes off", async ({ api }) => {
    const off = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      await api.beginSaga({ seed, silver: FULL_POUCH });
      off.add((await api.menu()).dishes.find((d) => d.state === "sold-out")!.id);
    }
    expect(off.size, "eight sagas, more than one dish sold out").toBeGreaterThan(1);
  });

  test("the dish page says so too, and still tells the story and the recipe", async ({ api, page }) => {
    const off = (await api.menu()).dishes.find((d) => d.state === "sold-out")!;
    const dishPage = new DishPage(page);
    await dishPage.goto(off.id);
    await expect(page.getByTestId("dish-sold-out")).toContainText(off.soldOutReason!);
    await expect(dishPage.recipe).toBeVisible();
    await expect(dishPage.add).toBeDisabled();
  });

  test("the Master's Table: all free means a full kitchen, all taken means an empty one", async ({ api, menu }) => {
    await api.beginSaga({ seed: TEST_SAGA, places: "free", silver: FULL_POUCH });
    expect((await api.menu()).dishes.every((d) => d.state === "available")).toBe(true);
    await api.beginSaga({ seed: TEST_SAGA, places: "taken", silver: FULL_POUCH });
    expect((await api.menu()).dishes.every((d) => d.state === "sold-out")).toBe(true);
    await menu.goto();
    await expect(menu.page.getByTestId("menu-all-sold-out")).toContainText("never runs out");
  });
});
