import type { Locator, Page } from "@playwright/test";

/**
 * The tabs on every Mead & Feast page: Feast Hall, Menu, Bar. The current one has aria-current="page".
 * Only the visible tabs count: while a page streams in, the production build briefly keeps a hidden second copy at the
 * end of the page (a test on 3101 found two, 2026-11-25). See "Previous pages stay in the page, hidden" in the README.
 */
export class FeastTabs {
  readonly nav: Locator;
  readonly tables: Locator;
  readonly menu: Locator;
  readonly counter: Locator;

  constructor(page: Page) {
    this.nav = page.getByTestId("feast-tabs").filter({ visible: true });
    this.tables = page.getByTestId("feast-tab-tables").filter({ visible: true });
    this.menu = page.getByTestId("feast-tab-menu").filter({ visible: true });
    this.counter = page.getByTestId("feast-tab-counter").filter({ visible: true });
  }
}
