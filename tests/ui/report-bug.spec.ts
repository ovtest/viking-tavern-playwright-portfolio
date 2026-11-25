import { expect, test } from "@playwright/test";
import { Header } from "@pages/header";

// Report a bug (the footer, on every page): opens the bug form on GitHub with the saga number and the page filled in,
// so a report can be replayed. The tests only read the link; they never open GitHub or create an issue.
// They change no data, so they use plain Playwright (no fresh night).

/** The footer link's address, taken apart. */
async function reportLink(page: import("@playwright/test").Page) {
  // The saga streams in: for a moment the link is there without it (the placeholder), then the finished link replaces
  // it. Wait for the finished one, the link that carries a saga.
  const link = page.locator("[data-testid=footer-report-bug][data-saga]");
  await expect(link).toHaveAttribute("data-saga", /^\d+$/);
  return { link, url: new URL((await link.getAttribute("href"))!) };
}

test.describe("Report a bug", () => {
  test("opens the GitHub bug form in a new tab, with this saga and this page filled in @smoke", async ({ page }) => {
    const header = new Header(page);
    await page.goto("/feast/menu");
    const { link, url } = await reportLink(page);
    expect(url.origin).toBe("https://github.com");
    expect(url.pathname).toMatch(/^\/[\w.-]+\/[\w.-]+\/issues\/new$/);
    expect(url.searchParams.get("template")).toBe("bug.yml");
    expect(url.searchParams.get("page")).toBe("/feast/menu");
    expect(url.searchParams.get("saga")).toBe(await header.saga.getAttribute("data-seed"));
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });

  test("the page follows you around the tavern", async ({ page }) => {
    for (const path of ["/", "/harbor", "/sagas"]) {
      await page.goto(path);
      const { url } = await reportLink(page);
      expect(url.searchParams.get("page"), `on ${path}`).toBe(path);
    }
  });

  test.describe("as a guest", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("a guest's link carries tonight's saga, the one in the top menu", async ({ page }) => {
      const header = new Header(page);
      await page.goto("/lore");
      const { url } = await reportLink(page);
      expect(url.searchParams.get("saga")).toBe(await header.saga.getAttribute("data-seed"));
    });
  });
});
