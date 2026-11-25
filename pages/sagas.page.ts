import type { Locator, Page } from "@playwright/test";

/** Sagas (/sagas): Lady Owner's tales of nights at the tavern, read-only. Each saga is a card with a title, the story and who tells it. */
export class SagasPage {
  readonly title: Locator;
  readonly intro: Locator;
  readonly list: Locator;
  readonly empty: Locator;
  /** Every saga card (test IDs "saga-<id>"). */
  readonly sagas: Locator;

  constructor(readonly page: Page) {
    this.title = page.getByTestId("page-title");
    this.intro = page.getByTestId("sagas-intro");
    this.list = page.getByTestId("sagas-list");
    this.empty = page.getByTestId("sagas-empty");
    this.sagas = this.list.locator(":scope > li");
  }

  async goto() {
    await this.page.goto("/sagas");
  }

  /** Part of a saga card: "title", "text" or "teller". */
  part(saga: Locator, part: "title" | "text" | "teller"): Locator {
    return saga.locator(`[data-testid$="-${part}"]`);
  }
}
