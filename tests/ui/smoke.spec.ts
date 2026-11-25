import { expect, test } from "@playwright/test";
import { Header } from "@pages/header";

// Quick "is the tavern alive?" checks. They don't change any data, so they use plain Playwright (no fresh night).

test("health endpoint reports ok @smoke", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: "ok" });
});

test("the Great Hall opens with its painted scene and the demo notice @smoke", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Great Hall | Lords of Fjords"); // was only "Great Hall" until 2026-11-23
  await expect(page.getByTestId("great-hall-scene")).toBeVisible();
  await expect(page.getByTestId("demo-banner")).toContainText("Nothing is real");
  // The left plank depends on the Viking's night (Select Room / Select Berth / Check Out); the portraits are always there.
  await expect(page.getByTestId("lady-owner")).toBeVisible();
  await expect(page.getByTestId("barowl")).toBeVisible();
});

test("the test Viking is shown in the top menu with a saga number and a Coin Pouch @smoke", async ({ page }) => {
  const header = new Header(page);
  await page.goto("/");
  await expect(header.username).toHaveText(new RegExp(`^${process.env.VIKING_NAME}$`, "i"));
  await expect(header.saga).toHaveAttribute("data-seed", /^\d+$/);
  await expect(header.silver).toHaveText(/^\d+ silver$/);
});

const pages = [
  { nav: "nav-harbor", url: /\/harbor$/, scene: "harbor-scene" },
  { nav: "nav-feast", url: /\/feast$/, scene: "feast-scene" },
  { nav: "nav-great-hall", url: /\/$/, scene: "great-hall-scene" },
];
test("the top menu leads to the Harbor, Mead & Feast and back to the Great Hall @smoke", async ({ page }) => {
  await page.goto("/lore");
  for (const p of pages) {
    await page.getByTestId(p.nav).click();
    await expect(page).toHaveURL(p.url);
    await expect(page.getByTestId(p.scene)).toBeVisible();
  }
});

test("Barowl's Menu opens with its drinks and food, and a dish page with its recipe @smoke", async ({ page }) => {
  await page.goto("/feast/menu");
  await expect(page.getByTestId("menu-drinks")).toBeVisible();
  await expect(page.getByTestId("menu-food")).toBeVisible();
  await page.getByTestId("menu-food").getByRole("link", { name: "Read the story" }).first().click();
  await expect(page.getByTestId("dish-recipe")).toBeVisible();
});

test("Barowl's Counter opens with Barowl's greeting and the drinks @smoke", async ({ page }) => {
  await page.goto("/feast/bar");
  await expect(page.getByTestId("bar-greeting")).toBeVisible();
  await expect(page.getByTestId("bar-drinks")).toBeVisible();
});

test("unknown pages answer 404 with the Lost at Sea page @smoke", async ({ page }) => {
  const res = await page.goto("/no-such-fjord");
  expect(res?.status()).toBe(404);
  await expect(page.getByTestId("not-found")).toBeVisible();
});

test.describe("guests", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a guest sees Enter the Hall and Swear the Oath, and tonight's saga @smoke", async ({ page }) => {
    const header = new Header(page);
    await page.goto("/");
    await expect(header.login).toBeVisible();
    await expect(header.signup).toBeVisible();
    await expect(header.saga).toHaveAttribute("data-seed", /^\d{4}$/); // tonight's saga for guests: 1000–9999
  });

  test("the API answers NOT_LOGGED_IN to a guest @smoke", async ({ request }) => {
    const res = await request.get("/api/me");
    expect(res.status()).toBe(401);
    expect((await res.json()).error.code).toBe("NOT_LOGGED_IN");
  });
});
