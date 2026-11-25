import { FULL_POUCH, ROOMS, TEST_SAGA } from "@utils/constants";
import { expect, test } from "@fixtures/fixtures";

// Barowl's Counter (/feast/bar): Go to a Bar (Great Hall, Harbor) and Barowl's badge lead here. Drinks at the counter,
// no seat needed; food is served at the tables. See the app's docs/SPEC.md, section 2.3, "Barowl's Counter".

test.describe("Barowl's Counter", () => {
  test("Go to a Bar in the Great Hall leads to the counter", async ({ api, greatHall, page }) => {
    const room = (await api.rooms()).find((r) => r.state === "available" && (ROOMS.quiet as readonly number[]).includes(r.id))!;
    await api.addRoom(room.id);
    await greatHall.goto();
    await greatHall.goToBar.click();
    await expect(page).toHaveURL(/\/feast\/bar$/);
    await expect(page.getByTestId("bar-greeting")).toBeVisible();
  });

  test("a drink at the counter needs no room and no table, and goes in the Loot Sack", async ({ api, menu, page }) => {
    await page.goto("/feast/bar");
    await expect(page.getByTestId("bar-order-note")).toHaveCount(0);
    await menu.order("drink", "honey-mead", 2);
    await expect(menu.part("drink", "honey-mead", "message")).toContainText("2 × ");
    expect((await api.sack()).lines).toMatchObject([{ kind: "drink", id: "honey-mead", quantity: 2 }]);
    // The way to pay is right under Barowl's answer.
    await expect(menu.part("drink", "honey-mead", "sack")).toHaveAttribute("href", "/loot-sack");
    await menu.part("drink", "honey-mead", "settle").click();
    await expect(page).toHaveURL(/\/settle$/);
    await expect(page.getByTestId("settle-items")).toContainText("Barowl's Honey Mead");
  });

  test("a drink the pouch can't pay for says so plainly, with the way to the Jarl's treasury", async ({ api, menu, page }) => {
    await api.beginSaga({ seed: TEST_SAGA, silver: 1 });
    await page.goto("/feast/bar");
    await menu.order("drink", "honey-mead");
    const error = menu.part("drink", "honey-mead", "error");
    await expect(error).toHaveAttribute("data-error-code", "ORDER_TOO_EXPENSIVE");
    await expect(error).toContainText("your Coin Pouch holds 1. You can't afford it this time.");
    await expect(menu.part("drink", "honey-mead", "treasury")).toHaveAttribute("href", "/pouch");
    expect((await api.sack()).lines, "nothing ordered").toHaveLength(0);

    // Two of something: the price of both counts.
    await api.beginSaga({ seed: TEST_SAGA, silver: 5 });
    const res = await api.addMenuItem("drink", "honey-mead", 2);
    expect(res.status()).toBe(400);
    expect((await res.json()).error.code).toBe("ORDER_TOO_EXPENSIVE");
    expect((await api.addMenuItem("drink", "honey-mead", 1)).status()).toBe(200);
  });

  test("Hungry? Without a table it's Select a table, which starts Barowl's check in the hall", async ({ feast, page }) => {
    await page.goto("/feast/bar");
    await expect(page.getByTestId("bar-hungry")).toHaveAttribute("data-state", "no-table");
    await page.getByTestId("bar-select-table").click();
    await expect(page).toHaveURL(/\/feast$/);
    await expect(feast.scene).toHaveAttribute("data-revealed", "true");
  });

  test("Hungry? At a table it's Go to Menu", async ({ api, page }) => {
    const room = (await api.rooms()).find((r) => r.state === "available" && (ROOMS.quiet as readonly number[]).includes(r.id))!;
    await api.addRoom(room.id);
    const table = (await api.tables()).find((t) => t.state === "available")!;
    await api.joinTable(table.company);
    await page.goto("/feast/bar");
    await expect(page.getByTestId("bar-hungry")).toHaveAttribute("data-state", "at-table");
    await page.getByTestId("bar-go-to-menu").click();
    await expect(page).toHaveURL(/\/feast\/menu$/);
  });

  test("until Sir paints Barowl at his counter, a stand-in says so", async ({ page }) => {
    await page.goto("/feast/bar");
    await expect(page.getByTestId("bar-picture")).toHaveAttribute("data-painted", "false");
    await expect(page.getByTestId("bar-picture")).toContainText("Sir is still painting");
  });

  test("after Check Out the counter is closed", async ({ api, page }) => {
    await api.beginSaga({ seed: TEST_SAGA, places: "free", rooms: "never", tables: "never", harbor: "quiet", silver: FULL_POUCH });
    await api.bookRoom(ROOMS.quiet[0]);
    await api.checkOut();
    await page.goto("/feast/bar");
    await expect(page.getByTestId("bar-order-note")).toHaveAttribute("data-state", "closed");
    await expect(page.getByTestId("drink-honey-mead-add")).toBeDisabled();
  });

  test.describe("guests", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("a guest sees the drinks and is asked to enter the hall to order", async ({ page }) => {
      await page.goto("/feast/bar");
      await expect(page.getByTestId("bar-order-note")).toHaveAttribute("data-state", "guest");
      await expect(page.getByTestId("bar-order-login")).toHaveAttribute("href", "/enter?next=/feast/bar");
      await expect(page.getByTestId("drink-honey-mead-add")).toBeDisabled();
    });
  });
});
