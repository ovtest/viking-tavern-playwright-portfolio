import { COMPANIES, FULL_POUCH, PLACES, ROOMS, TEST_SAGA } from "@utils/constants";
import { expect, test } from "@fixtures/fixtures";
import { FeastTabs } from "@pages/feast-tabs";
import { errorOf, type Table, type TavernApi } from "@utils/tavern-api";

// Barowl's Mead & Feast: tonight's companies, Select Table, full tables, joining a company (free, one per saga, a
// room needed), the Mighty Viking at your table, Go to Menu, Barowl. See the app's docs/SPEC.md, section 2.3.
// (What happens at your table is told at Morning Check Out: that's for the Check Out tests.)

/** Gives the Viking a room tonight (in the Loot Sack), the ticket to dinner. */
async function takeARoom(api: TavernApi) {
  const room = (await api.rooms()).find((r) => r.state === "available" && (ROOMS.quiet as readonly number[]).includes(r.id));
  expect(room, "a free quiet room tonight").toBeDefined();
  expect((await api.addRoom(room!.id)).status()).toBe(200);
}

async function freeTables(api: TavernApi): Promise<Table[]> {
  const free = (await api.tables()).filter((t) => t.state === "available");
  expect(free.length, "tables with a seat tonight").toBeGreaterThan(1);
  return free;
}

test.describe("tonight's companies", () => {
  test("five of the seven companies come, and the same saga number brings the same ones to the same places", async ({ api }) => {
    const tonight = await api.tables();
    expect(tonight).toHaveLength(PLACES);
    expect(new Set(tonight.map((t) => t.place))).toEqual(new Set([1, 2, 3, 4, 5]));
    for (const t of tonight) expect(COMPANIES).toContain(t.company);

    await api.beginSaga({ seed: TEST_SAGA, silver: FULL_POUCH });
    expect(await api.tables()).toEqual(tonight);
  });

  test("on an ordinary night one or two tables are full", async ({ api }) => {
    for (const seed of [TEST_SAGA, 1, 2, 3, 300]) {
      await api.beginSaga({ seed, silver: FULL_POUCH });
      const full = (await api.tables()).filter((t) => t.state === "full").length;
      expect(full, `saga ${seed}`).toBeGreaterThanOrEqual(1);
      expect(full, `saga ${seed}`).toBeLessThanOrEqual(2);
    }
  });

  test("the twist is not told before you sit at a table", async ({ api }) => {
    for (const t of await api.tables()) expect(t.twist, t.company).toBeUndefined();
  });
});

test.describe("Select Table", () => {
  test("tables wait in the dusk until Select Table, then show what the API says", async ({ api, feast }) => {
    await feast.goto();
    await expect(feast.scene).toHaveAttribute("data-revealed", "false");
    const tables = await api.tables();
    for (const t of tables) {
      await expect(feast.table(t.company)).toHaveAttribute("data-state", "unknown");
      await expect(feast.table(t.company)).toBeDisabled();
    }

    await feast.revealTables();

    for (const t of tables) {
      await expect(feast.table(t.company)).toHaveAttribute("data-state", t.state);
      await expect(feast.table(t.company)).toHaveAttribute("data-place", String(t.place));
    }
    const free = tables.filter((t) => t.state === "available").length;
    await expect(feast.toast).toContainText(`there's a seat for you at ${free} of them`);
  });

  test("a full table has another Viking on its guest chair, says No seat left and can't be chosen", async ({ api, feast }) => {
    const full = (await api.tables()).find((t) => t.state === "full")!;
    await feast.goto();
    // Before the check you can't tell which tables are full.
    await expect(feast.picture(full.company)).toHaveAttribute("data-viking", "false");
    await feast.revealTables();

    await expect(feast.picture(full.company)).toHaveAttribute("data-viking", "other");
    await expect(feast.table(full.company)).toHaveAttribute("aria-disabled", "true");
    await feast.table(full.company).hover();
    await expect(feast.tip).toContainText("No seat left");
    await feast.table(full.company).click({ force: true });
    await expect(feast.dialog.root).toBeHidden();

    await takeARoom(api);
    const res = await api.joinTable(full.company);
    expect(res.status()).toBe(409);
    expect((await errorOf(res)).code).toBe("TABLE_FULL");
  });

  test("the Master's Table: all free means no table is full, all taken means every one is", async ({ api, feast }) => {
    await api.beginSaga({ seed: TEST_SAGA, places: "free", silver: FULL_POUCH });
    expect((await api.tables()).every((t) => t.state === "available")).toBe(true);

    await api.beginSaga({ seed: TEST_SAGA, places: "taken", silver: FULL_POUCH });
    expect((await api.tables()).every((t) => t.state === "full")).toBe(true);
    await feast.goto();
    await feast.revealTables();
    await expect(feast.toast).toContainText("Every seat in the hall is taken tonight");
  });

  test("arriving with ?select=1 (the counter's Select a table) starts the check at once", async ({ feast, page }) => {
    await feast.goto("?select=1");
    await expect(feast.scene).toHaveAttribute("data-revealed", "true");
    await expect(page, "the ?select=1 is dropped").toHaveURL(/\/feast$/);
  });
});

test.describe("joining a table", () => {
  test("without a room Barowl sends you to the Great Hall first", async ({ api, feast }) => {
    const [table] = await freeTables(api);
    await feast.goto();
    await feast.revealTables();
    await feast.openTable(table.company);
    await expect(feast.dialog.needsRoom).toContainText("Take a room in the Great Hall first");
    await expect(feast.dialog.join).toHaveCount(0);
    await expect(feast.dialog.greatHall).toHaveAttribute("href", "/");

    const res = await api.joinTable(table.company);
    expect(res.status()).toBe(409);
    expect((await errorOf(res)).code).toBe("TABLE_NEEDS_ROOM");
  });

  test("Join the table: the story, the twist, and the Mighty Viking in his seat", async ({ api, feast }) => {
    await takeARoom(api);
    const [table] = await freeTables(api);
    await feast.goto();
    await feast.revealTables();
    await feast.openTable(table.company);

    await expect(feast.dialog.title).toHaveText(table.name);
    await expect(feast.dialog.who).toHaveText(table.who);
    await expect(feast.dialog.story).toHaveText(table.story);
    await expect(feast.dialog.free).toContainText("Joining is free");
    await expect(feast.dialog.picture).toHaveAttribute("src", `/images/feast/table-${table.company}.webp`);
    await feast.dialog.join.click();

    await expect(feast.reveal.title).toHaveText(`You sit with ${table.name}`);
    const twist = (await api.tables()).find((t) => t.company === table.company)!.twist;
    expect(twist, "the API tells the twist once you sit there").toBeTruthy();
    await expect(feast.reveal.twist).toHaveText(twist!);
    await feast.reveal.close.click();

    await expect(feast.table(table.company)).toHaveAttribute("data-state", "mine");
    await expect(feast.picture(table.company)).toHaveAttribute("data-viking", "true");
    await expect(feast.you).toBeVisible();
    // Joining is free: the Coin Pouch doesn't change.
    await expect(feast.header.silver).toHaveText(`${FULL_POUCH} silver`);
    await expect(feast.selectTable).toHaveCount(0);
    await expect(feast.goToMenu).toBeVisible();
  });

  test("one table per saga: the others say so, the API refuses, and the same table again is fine", async ({ api, feast }) => {
    await takeARoom(api);
    const [first, second] = await freeTables(api);
    expect((await api.joinTable(first.company)).status()).toBe(200);

    await feast.goto(); // seated: the tables are lit at once
    await expect(feast.scene).toHaveAttribute("data-revealed", "true");
    await feast.openTable(second.company);
    await expect(feast.dialog.hasTable).toContainText(first.name);
    await expect(feast.dialog.join).toHaveCount(0);

    const res = await api.joinTable(second.company);
    expect(res.status()).toBe(409);
    expect((await errorOf(res)).code).toBe("TABLE_ALREADY_CHOSEN");
    expect((await api.joinTable(first.company)).status()).toBe(200);
  });

  test("your own table shows its twist when you open it again", async ({ api, feast }) => {
    await takeARoom(api);
    const [table] = await freeTables(api);
    await api.joinTable(table.company);
    await feast.goto();
    await feast.openTable(table.company);
    await expect(feast.dialog.twist).toBeVisible();
    await expect(feast.dialog.you).toBeVisible();
    await expect(feast.dialog.picture).toHaveAttribute("src", `/images/feast/table-${table.company}-viking.webp`);
  });

  test("a company that isn't here tonight, or doesn't exist, can't be joined", async ({ api }) => {
    await takeARoom(api);
    const tonight = (await api.tables()).map((t) => t.company);
    const absent = COMPANIES.find((c) => !tonight.includes(c))!;
    const notTonight = await api.joinTable(absent);
    expect(notTonight.status()).toBe(404);
    expect((await errorOf(notTonight)).code).toBe("TABLE_NOT_TONIGHT");
    const unknown = await api.joinTable("vikings-from-mars");
    expect(unknown.status()).toBe(404);
    expect((await errorOf(unknown)).code).toBe("TABLE_NOT_FOUND");
  });

  test("Go to Menu leads to Barowl's menu", async ({ api, feast, page }) => {
    await takeARoom(api);
    const [table] = await freeTables(api);
    await api.joinTable(table.company);
    await feast.goto();
    await feast.goToMenu.click();
    await expect(page).toHaveURL(/\/feast\/menu$/);
    await expect(page.getByRole("heading", { name: "Barowl's Menu" })).toBeVisible();
    await expect(page.getByTestId("menu-intro")).toContainText("no wine, ever");
    await expect(page.getByTestId("menu-order-note"), "sitting at a table, so the Viking may order").toHaveCount(0);
  });
});

test.describe("Barowl", () => {
  test.use({ reducedMotion: "reduce" });

  test("he greets you and winks only while you hover him", async ({ feast }) => {
    await feast.goto();
    await expect(feast.barowlWink).toHaveCSS("opacity", "0");
    await feast.barowl.hover();
    await expect(feast.tip).toContainText("Barowl");
    await expect(feast.barowlWink).toHaveCSS("opacity", "1"); // with reduced motion he winks and holds it
    await expect(feast.tip).toContainText("my counter");
  });

  test("a click on Barowl takes you to his counter", async ({ feast, page }) => {
    await feast.goto();
    await feast.barowl.click();
    await expect(page).toHaveURL(/\/feast\/bar$/);
  });
});

test.describe("the Mead & Feast tabs", () => {
  // Before 2026-11-25 the top menu only opened the tables; the Counter was behind Barowl's badge and the Menu appeared
  // only once you had a table. Now every Mead & Feast page has the three tabs, the current one marked.
  const places = [
    { url: "/feast", current: "tables" },
    { url: "/feast/menu", current: "menu" },
    { url: "/feast/menu/roast-bird", current: "menu" }, // a dish page belongs to the Menu
    { url: "/feast/bar", current: "counter" },
  ] as const;
  for (const p of places) {
    test(`on ${p.url} all three tabs are there and "${p.current}" is the current one`, async ({ page }) => {
      const tabs = new FeastTabs(page);
      await page.goto(p.url);
      for (const name of ["tables", "menu", "counter"] as const) {
        await expect(tabs[name]).toBeVisible();
        if (name === p.current) await expect(tabs[name]).toHaveAttribute("aria-current", "page");
        else await expect(tabs[name]).not.toHaveAttribute("aria-current");
      }
    });
  }

  test("without a table the Menu is one click away, before Go to Menu appears in the hall", async ({ feast, page }) => {
    const tabs = new FeastTabs(page);
    await feast.goto();
    await expect(page.getByTestId("go-to-menu")).toHaveCount(0);
    await tabs.menu.click();
    await expect(page).toHaveURL(/\/feast\/menu$/);
    await expect(page.getByTestId("menu-order-note")).toHaveAttribute("data-state", "needs-table");
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("the three short names fit on one row", async ({ page }) => {
      const tabs = new FeastTabs(page);
      await page.goto("/feast");
      // Renamed on 2026-11-25 from "The Tables · Barowl's Menu · Barowl's Counter"; the test IDs stayed the same.
      await expect(tabs.tables).toHaveText("Feast Hall");
      await expect(tabs.menu).toHaveText("Menu");
      await expect(tabs.counter).toHaveText("Bar");
      const tops = await Promise.all([tabs.tables, tabs.menu, tabs.counter].map(async (t) => (await t.boundingBox())!.y));
      expect(new Set(tops).size, "all three tabs on the same row").toBe(1);
    });
  });
});

test.describe("guests", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a guest can look at a company but is asked to enter the hall to join", async ({ feast, page }) => {
    await feast.goto(`?seed=${TEST_SAGA}`);
    await feast.revealTables();
    await page.locator("[data-testid='tables'] button[data-state='available']").first().click();
    await expect(feast.dialog.loginNote).toBeVisible();
    await expect(feast.dialog.join).toHaveCount(0);
    await expect(feast.dialog.login).toHaveAttribute("href", "/enter?next=/feast");
  });
});
