import { expect, test } from "@playwright/test";
import { SagasPage } from "@pages/sagas.page";

// Sagas (/sagas): Lady Owner's tales of nights at the tavern, read-only, like the café's reviews. She adds new sagas
// from time to time, so the tests never check the words: only that each saga is complete and the page is honest.
// They change no data, so they use plain Playwright (no fresh night), and work for guests and Vikings alike.

test.describe("Sagas", () => {
  test("every saga has a title, a story and someone who tells it", async ({ page }) => {
    const sagas = new SagasPage(page);
    await sagas.goto();
    await expect(page).toHaveTitle("Sagas | Lords of Fjords");
    await expect(sagas.intro).not.toBeEmpty();
    const count = await sagas.sagas.count();
    expect(count, "at least one saga").toBeGreaterThan(0);
    await expect(sagas.list).toHaveAttribute("data-count", String(count));
    for (const saga of await sagas.sagas.all()) {
      await expect(sagas.part(saga, "title")).not.toBeEmpty();
      await expect(sagas.part(saga, "text").locator("p").first()).not.toBeEmpty();
      await expect(sagas.part(saga, "teller")).toHaveText(/^— \S/);
    }
  });

  test("each saga has its own test ID", async ({ page }) => {
    const sagas = new SagasPage(page);
    await sagas.goto();
    const ids = await sagas.sagas.evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
    expect(ids.every((id) => /^saga-[a-z0-9-]+$/.test(id ?? "")), `ids: ${ids.join(", ")}`).toBe(true);
    expect(new Set(ids).size, "no two sagas share an id").toBe(ids.length);
  });

  test("sagas don't give away how a night works: no room numbers", async ({ page }) => {
    // Lady Owner's rule (2026-11-25): no room numbers and no Kraken details in the sagas.
    const sagas = new SagasPage(page);
    await sagas.goto();
    await expect(sagas.list).not.toContainText(/\broom\s*(no\.?|number|#)?\s*\d+/i);
    await expect(sagas.list).not.toContainText(/\bberth\s*\d+/i);
  });
});
