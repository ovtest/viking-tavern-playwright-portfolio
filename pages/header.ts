import type { Locator, Page } from "@playwright/test";

/** The top menu shown on every page. */
export class Header {
  readonly greatHall: Locator;
  readonly harbor: Locator;
  readonly feast: Locator;
  readonly saga: Locator;
  readonly newSaga: Locator;
  readonly lootSack: Locator;
  readonly lootCount: Locator;
  readonly silver: Locator;
  readonly ledger: Locator;
  readonly username: Locator;
  readonly logout: Locator;
  readonly login: Locator;
  readonly signup: Locator;

  constructor(page: Page) {
    this.greatHall = page.getByTestId("nav-great-hall");
    this.harbor = page.getByTestId("nav-harbor");
    this.feast = page.getByTestId("nav-feast");
    this.saga = page.getByTestId("header-saga");
    this.newSaga = page.getByTestId("header-new-saga");
    this.lootSack = page.getByTestId("header-loot-sack");
    this.lootCount = page.getByTestId("header-loot-count");
    this.silver = page.getByTestId("header-silver");
    this.ledger = page.getByTestId("header-ledger");
    this.username = page.getByTestId("header-username");
    this.logout = page.getByTestId("header-logout");
    this.login = page.getByTestId("header-login");
    this.signup = page.getByTestId("header-signup");
  }
}
