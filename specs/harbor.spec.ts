import { FULL_POUCH, TEST_SAGA } from "../src/constants";
import { expect, test } from "../src/fixtures";
import { errorOf, type Berth, type TavernApi } from "../src/tavern-api";

// The Drakkar Harbor: Select Berth, the berths, mooring into the Loot Sack, the Kraken peeking up, one berth per
// saga, "the Kraken has seen your ship", and the ways in and out. See the app's docs/SPEC.md, section 2.2.
// (What the Kraken does to the boat is told at Morning Check Out: that's for the Check Out tests.)

const SPOTS = ["K1", "K2", "K3"] as const;

/** The cheapest free berths tonight. */
async function freeBerths(api: TavernApi): Promise<Berth[]> {
  const free = (await api.berths()).filter((b) => b.state === "available").sort((a, b) => a.price - b.price);
  expect(free.length, "free berths tonight").toBeGreaterThan(1);
  return free;
}

test.describe("Select Berth", () => {
  test("berths stay dark until Select Berth, then show tonight's berths as the API does", async ({ api, harbor }) => {
    await harbor.goto();
    await expect(harbor.scene).toHaveAttribute("data-revealed", "false");
    await expect(harbor.berth(1)).toHaveAttribute("data-state", "unknown");
    for (const spot of SPOTS) await expect(harbor.ripples(spot)).toHaveCount(0);

    await harbor.revealBerths();

    const berths = await api.berths();
    for (const b of berths) await expect(harbor.berth(b.id)).toHaveAttribute("data-state", b.state);
    const free = berths.filter((b) => b.state === "available").length;
    await expect(harbor.toast).toContainText(`${free} berths are free tonight`);
    // A hint: soft rings at all three Kraken spots, but no Kraken yet.
    for (const spot of SPOTS) await expect(harbor.ripples(spot)).toBeVisible();
    await expect(harbor.kraken).toHaveCount(0);
  });

  test("hovering a free berth shows its boat, teaser and price", async ({ api, harbor }) => {
    const [berth] = await freeBerths(api);
    await harbor.goto();
    await harbor.revealBerths();
    await harbor.berth(berth.id).hover();
    await expect(harbor.tip).toContainText(`${berth.name}: ${berth.boatName.toLowerCase()}`);
    await expect(harbor.tip).toContainText(`${berth.price} silver`);
  });

  test("another Viking's berth has their boat moored, says Occupied and can't be chosen", async ({ api, harbor }) => {
    await api.beginSaga({ seed: TEST_SAGA, places: "taken", silver: FULL_POUCH });
    await harbor.goto();
    await harbor.revealBerths();
    await expect(harbor.berth(3)).toHaveAttribute("data-state", "occupied");
    await expect(harbor.berth(3)).toHaveAttribute("aria-disabled", "true");
    await expect(harbor.boat(3)).toHaveAttribute("data-picture", "moored");
    await harbor.berth(3).hover();
    await expect(harbor.tip).toContainText("Occupied");
  });

  test("Select Parking in the Great Hall leads to the harbor and starts the check at once", async ({ greatHall, harbor, page }) => {
    await greatHall.goto();
    await greatHall.selectParking.click();
    await expect(harbor.scene).toHaveAttribute("data-revealed", "true");
    // The ?select=1 is dropped, so a reload starts dark like a direct visit.
    await expect(page).toHaveURL(/\/harbor$/);
  });
});

test.describe("mooring", () => {
  test("Moor here: the berth is yours, your boat arrives and the Kraken peeks up", async ({ api, harbor }) => {
    const [berth] = await freeBerths(api);
    await harbor.goto();
    await harbor.revealBerths();
    await harbor.openBerth(berth.id);

    await expect(harbor.dialog.title).toHaveText(`${berth.name}: ${berth.boatName.toLowerCase()} — ${berth.price} silver`);
    await expect(harbor.dialog.pouch).toContainText(`${FULL_POUCH} silver`);
    await harbor.dialog.confirm.click();

    await expect(harbor.reveal.title).toHaveText(`${berth.name} is yours!`);
    await expect(harbor.reveal.kraken).toContainText("took a long look at your ship");
    await expect(harbor.kraken).toHaveAttribute("data-spot", /^K[123]$/);
    await harbor.reveal.close.click();

    await expect(harbor.berth(berth.id)).toHaveAttribute("data-state", "in-sack");
    await expect(harbor.boat(berth.id)).toHaveAttribute("data-picture", "arrived");
    await expect(harbor.header.lootCount).toHaveText("1");
    // With a berth, Select Berth is gone and Go to a Bar is the next step.
    await expect(harbor.selectBerth).toHaveCount(0);
    await expect(harbor.goToBar).toBeVisible();
  });

  test("the Kraken surfaces at the same spot for the same saga number", async ({ api, harbor }) => {
    const [berth] = await freeBerths(api);
    await api.addBerth(berth.id);
    await harbor.goto();
    const spot = await harbor.kraken.getAttribute("data-spot");

    await api.beginSaga({ seed: TEST_SAGA, silver: FULL_POUCH });
    await api.addBerth(berth.id);
    await harbor.goto();
    await expect(harbor.kraken).toHaveAttribute("data-spot", spot!);
  });

  test("one berth per saga: other berths say so up front, and the API refuses a second one", async ({ api, harbor }) => {
    const [first, second] = await freeBerths(api);
    expect((await api.addBerth(first.id)).status()).toBe(200);

    await harbor.goto(); // with a berth already chosen, the berths are lit at once
    await harbor.openBerth(second.id);
    await expect(harbor.dialog.hasBerth).toHaveAttribute("data-state", "in-sack");
    await expect(harbor.dialog.confirm).toHaveCount(0);
    await expect(harbor.dialog.openSack).toBeVisible();

    const res = await api.addBerth(second.id);
    expect(res.status()).toBe(409);
    expect((await errorOf(res)).code).toBe("BERTH_ALREADY_CHOSEN");
  });

  test("the Kraken has seen your ship: after taking it out of the Loot Sack, only the same berth can be moored", async ({ api, harbor }) => {
    const [first, second] = await freeBerths(api);
    await api.addBerth(first.id);
    expect((await api.removeFromSack("berth", first.id)).status()).toBe(200);

    await harbor.goto();
    await harbor.revealBerths();
    await harbor.openBerth(second.id);
    await expect(harbor.dialog.krakenSeen).toContainText(`Berth ${first.id}`);
    await expect(harbor.dialog.confirm).toHaveCount(0);

    const res = await api.addBerth(second.id);
    expect(res.status()).toBe(409);
    expect((await errorOf(res)).code).toBe("BERTH_ALREADY_CHOSEN");
    expect((await api.addBerth(first.id)).status(), "the same berth again is fine").toBe(200);
  });

  test("a new saga starts fresh: the Kraken forgets your ship", async ({ api }) => {
    const [first, second] = await freeBerths(api);
    await api.addBerth(first.id);
    await api.removeFromSack("berth", first.id);
    await api.beginSaga({ seed: TEST_SAGA, silver: FULL_POUCH });
    expect((await api.addBerth(second.id)).status()).toBe(200);
  });

  test("with a berth, the Great Hall's Select Parking says it's yours already", async ({ api, greatHall, page }) => {
    const [berth] = await freeBerths(api);
    await api.addBerth(berth.id);
    await greatHall.goto();
    await greatHall.selectParking.click();
    await expect(page.getByTestId("berth-already-title")).toHaveText(`${berth.name} is yours already`);
    await expect(page.getByTestId("berth-already-state")).toHaveAttribute("data-state", "in-sack");
  });
});

test.describe("around the harbor", () => {
  // Piermaid's badge sways all the time, so Playwright would wait forever for it to hold still before hovering.
  // The tavern honours the "reduce motion" setting, which stops the sway: a real-world way to test moving things.
  test.use({ reducedMotion: "reduce" });

  test("Piermaid greets you on hover", async ({ harbor }) => {
    await harbor.goto();
    await harbor.piermaid.hover();
    await expect(harbor.tip).toContainText("Piermaid");
    await expect(harbor.tip).toContainText("Press Select Berth");
  });

  for (const gate of ["gateNear", "gateFar"] as const) {
    test(`the ${gate === "gateNear" ? "near" : "far"} gate leads back to the Great Hall`, async ({ greatHall, harbor, page }) => {
      await harbor.goto();
      await harbor[gate].click();
      await expect(page).toHaveURL(/\/$/);
      await expect(greatHall.scene).toBeVisible();
    });
  }
});

test.describe("guests", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a guest can look at a berth but is asked to enter the hall to moor", async ({ harbor, page }) => {
    await harbor.goto(`?seed=${TEST_SAGA}`);
    await harbor.revealBerths();
    await page.locator("[data-testid^='berth-'][data-state='available']").first().click();
    await expect(harbor.dialog.loginNote).toBeVisible();
    await expect(harbor.dialog.confirm).toHaveCount(0);
    await expect(harbor.dialog.login).toHaveAttribute("href", "/enter?next=/harbor");
    await expect(harbor.dialog.signup).toHaveAttribute("href", "/oath?next=/harbor");
  });
});
