import { expect, type Locator, type Page } from "@playwright/test";
import { Header } from "./header";

/** The Loot Sack (/loot-sack): what's chosen for tonight, not paid yet. */
export class LootSackPage {
  readonly header: Header;
  readonly lines: Locator;
  readonly total: Locator;
  readonly itemCount: Locator;
  readonly settle: Locator;
  readonly empty: Locator;

  constructor(private readonly page: Page) {
    this.header = new Header(page);
    this.lines = page.getByTestId("sack-line");
    this.total = page.getByTestId("sack-total");
    this.itemCount = page.getByTestId("sack-item-count");
    this.settle = page.getByTestId("sack-settle");
    this.empty = page.getByTestId("sack-empty");
  }

  async goto() {
    await this.page.goto("/loot-sack");
  }

  line(name: string | RegExp): Locator {
    return this.lines.filter({ has: this.page.getByTestId("sack-line-name").filter({ hasText: name }) });
  }

  async remove(name: string | RegExp) {
    await this.line(name).getByTestId("sack-line-remove").click();
    await expect(this.line(name)).toHaveCount(0);
  }
}

/** Settle with the Innkeeper (/settle): pay the Loot Sack. */
export class SettlePage {
  readonly header: Header;
  readonly items: Locator;
  readonly total: Locator;
  readonly pouch: Locator;
  readonly after: Locator;
  readonly short: Locator;
  readonly pay: Locator;
  readonly error: Locator;
  readonly settledBanner: Locator;

  constructor(private readonly page: Page) {
    this.header = new Header(page);
    this.items = page.getByTestId("settle-item");
    this.total = page.getByTestId("settle-total");
    this.pouch = page.getByTestId("settle-pouch");
    this.after = page.getByTestId("settle-after");
    this.short = page.getByTestId("settle-short");
    this.pay = page.getByTestId("settle-pay");
    this.error = page.getByTestId("settle-error");
    this.settledBanner = page.getByTestId("settled-banner");
  }

  async goto() {
    await this.page.goto("/settle");
  }
}
