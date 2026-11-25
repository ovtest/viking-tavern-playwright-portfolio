import { FULL_POUCH, TEST_SAGA } from "@utils/constants";
import { expect, test } from "@fixtures/fixtures";
import { errorOf } from "@utils/tavern-api";
import { MasterPage } from "@pages/master.page";

// The Master's Table (/master): the testers' own page for forcing a night. See the app's docs/SPEC.md, section 4.

test.describe("the Master's Table page", () => {
  test("it shows your saga and starts with every room free and the events by chance", async ({ page }) => {
    const master = new MasterPage(page);
    await master.goto();
    await expect(master.currentSeed).toHaveText(`#${TEST_SAGA}`);
    await expect(master.seed, "the saga number starts as yours, to replay the night").toHaveValue(String(TEST_SAGA));
    await expect(master.currentScenario).toHaveText("an ordinary night");
    await expect(master.currentSilver).toHaveText(String(FULL_POUCH));
    await expect(master.option("places", "free")).toBeChecked();
    for (const part of ["rooms", "harbor", "tables"] as const) await expect(master.option(part, "ordinary")).toBeChecked();
    await expect(master.goTo("hall")).toBeChecked();
  });

  test("every part of the night at once: the top menu shows what's forced", async ({ api, feast, page }) => {
    const master = new MasterPage(page);
    await master.goto();
    await master.beginSaga({ seed: 777, places: "free", rooms: "always", harbor: "pirates", tables: "always", silver: 80, goTo: "feast" });

    await expect(page).toHaveURL(/\/feast$/);
    await expect(feast.header.saga).toHaveText("Saga #777 · all free · rooms 100% · pirates · tables 100%");
    await expect(feast.header.saga).toHaveAttribute("data-scenario", "places=free;rooms=always;harbor=pirates;tables=always");
    await expect(feast.header.silver).toHaveText("80 silver");
    // The pirates setting brings the pirates to Mead & Feast tonight.
    expect((await api.tables()).some((t) => t.company === "pirates")).toBe(true);
  });

  test("leaving the saga number as it is replays the same night with new settings", async ({ api, page }) => {
    const master = new MasterPage(page);
    await master.goto();
    await master.beginSaga({ rooms: "always" });
    expect((await api.me()).sagaSeed).toBe(TEST_SAGA);
    await expect(master.header.saga).toHaveText(`Saga #${TEST_SAGA} · all free · rooms 100%`);
  });

  test("an ordinary New Saga ends the settings", async ({ api, page }) => {
    await api.beginSaga({ seed: TEST_SAGA, places: "taken", rooms: "always" });
    await api.beginSaga({});
    const master = new MasterPage(page);
    await master.goto();
    await expect(master.currentScenario).toHaveText("an ordinary night");
  });

  test("a saga number out of range and too much silver are refused on the page", async ({ page }) => {
    const master = new MasterPage(page);
    await master.goto();
    await master.beginSaga({ seed: 1_000_000 });
    await expect(page).toHaveURL(/\/master\?error=INVALID_SEED$/);
    await expect(master.error).toHaveAttribute("data-error-code", "INVALID_SEED");

    await master.beginSaga({ silver: 500 });
    await expect(master.error).toHaveAttribute("data-error-code", "INVALID_SILVER");
  });

  test.describe("guests", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("a guest is asked to enter the hall first", async ({ page }) => {
      await page.goto("/master");
      await expect(page.getByTestId("master-form")).toHaveCount(0);
      await expect(page.getByTestId("login-required").getByRole("link")).toHaveAttribute("href", "/enter?next=/master");
    });
  });
});

test.describe("the same settings from a test (POST /api/saga/new)", () => {
  test("the answer lists the settings; ordinary parts can be left out", async ({ api }) => {
    const { saga, silver } = await api.beginSaga({ seed: 4242, harbor: "kraken-eats", silver: 42 });
    expect(saga).toEqual({ seed: 4242, scenario: { places: "ordinary", rooms: "ordinary", harbor: "kraken-eats", tables: "ordinary" } });
    expect(silver).toBe(42);
    expect((await api.beginSaga({ seed: 4242 })).saga.scenario).toBeNull();
  });

  test("the old single scenario names still work", async ({ api }) => {
    const res = await api.beginSagaRaw({ seed: TEST_SAGA, scenario: "room-events" });
    expect(res.status()).toBe(200);
    expect((await res.json()).saga.scenario).toMatchObject({ places: "free", rooms: "always" });
  });

  const refused = [
    { body: { seed: 0 }, code: "INVALID_SEED" },
    { body: { seed: "Ragnar" }, code: "INVALID_SEED" },
    { body: { rooms: "sometimes" }, code: "INVALID_SCENARIO" },
    { body: { scenario: "dragons-everywhere" }, code: "INVALID_SCENARIO" },
    { body: { silver: 101 }, code: "INVALID_SILVER" },
    { body: { silver: -1 }, code: "INVALID_SILVER" },
    { body: { silver: 2.5 }, code: "INVALID_SILVER" },
  ];
  for (const r of refused) {
    test(`${JSON.stringify(r.body)} is refused with ${r.code}`, async ({ api }) => {
      const res = await api.beginSagaRaw(r.body);
      expect(res.status()).toBe(400);
      expect((await errorOf(res)).code).toBe(r.code);
    });
  }
});
