import type { Locator, Page } from "@playwright/test";
import { Header } from "./header";

/**
 * Morning Check Out (/morning): Lady Owner tells the night, one card at a time (Next), then a summary with the
 * refunds and charges. Each card has data-code (the event, e.g. "jarl-returns", "kraken-eats", "quiet-night").
 */
export class MorningPage {
  readonly header: Header;
  /** Before Check Out: "ready" (the night is set) or "nothing" (nothing to check out yet). */
  readonly ready: Locator;
  readonly nothing: Locator;
  readonly checkOut: Locator;
  readonly error: Locator;
  /** The cards: data-step (1, 2, … or "summary") and data-cards (how many). */
  readonly morning: Locator;
  readonly card: MorningCard;
  readonly next: Locator;
  readonly summary: Locator;
  readonly summaryEvents: Locator;
  readonly refundTotal: Locator;
  readonly chargeTotal: Locator;
  readonly silverAfter: Locator;
  readonly closed: Locator;
  readonly newSaga: Locator;

  constructor(private readonly page: Page) {
    this.header = new Header(page);
    this.ready = page.getByTestId("morning-ready");
    this.nothing = page.getByTestId("morning-nothing");
    this.checkOut = page.getByTestId("morning-check-out");
    this.error = page.getByTestId("morning-error");
    this.morning = page.getByTestId("morning");
    this.card = new MorningCard(page);
    this.next = page.getByTestId("morning-next");
    this.summary = page.getByTestId("morning-summary");
    this.summaryEvents = page.getByTestId("morning-summary-event");
    this.refundTotal = page.getByTestId("morning-refund-total");
    this.chargeTotal = page.getByTestId("morning-charge-total");
    this.silverAfter = page.getByTestId("morning-silver-after");
    this.closed = page.getByTestId("morning-closed");
    this.newSaga = page.getByTestId("morning-new-saga");
  }

  async goto(query = "") {
    await this.page.goto(`/morning${query}`);
  }
}

/** The card on show. A refund is green (+N), a charge red (−N); the pirates' card waits for a choice. */
export class MorningCard {
  readonly root: Locator;
  readonly count: Locator;
  readonly title: Locator;
  readonly tale: Locator;
  readonly apology: Locator;
  readonly picture: Locator;
  /** data-amount = the silver given back. */
  readonly refund: Locator;
  /** data-amount = the silver it cost. */
  readonly charge: Locator;
  readonly drink: Locator;
  readonly choice: Locator;
  readonly takeRefund: Locator;
  readonly takeBoat: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("morning-card");
    this.count = page.getByTestId("morning-card-count");
    this.title = page.getByTestId("morning-card-title");
    this.tale = page.getByTestId("morning-card-tale");
    this.apology = page.getByTestId("morning-card-apology");
    this.picture = page.getByTestId("morning-card-picture");
    this.refund = page.getByTestId("morning-card-refund");
    this.charge = page.getByTestId("morning-card-charge");
    this.drink = page.getByTestId("morning-card-drink");
    this.choice = page.getByTestId("morning-choice");
    this.takeRefund = page.getByTestId("morning-choice-refund");
    this.takeBoat = page.getByTestId("morning-choice-boat");
  }
}
