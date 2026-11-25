import { type Locator, type Page } from "@playwright/test";
import { Header } from "./header";
import type { Night } from "@utils/tavern-api";

/**
 * The Master's Table (/master): a testing aid, reached only by typing the address. Begins a saga with a chosen number
 * and one setting per part of the night (places, rooms, harbor, tables) plus the Coin Pouch.
 */
export class MasterPage {
  readonly header: Header;
  readonly current: Locator;
  readonly currentSeed: Locator;
  readonly currentScenario: Locator;
  readonly currentSilver: Locator;
  readonly seed: Locator;
  readonly silver: Locator;
  readonly begin: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    this.header = new Header(page);
    this.current = page.getByTestId("master-current");
    this.currentSeed = page.getByTestId("master-current-seed");
    this.currentScenario = page.getByTestId("master-current-scenario");
    this.currentSilver = page.getByTestId("master-current-silver");
    this.seed = page.getByTestId("master-seed");
    this.silver = page.getByTestId("master-silver");
    this.begin = page.getByTestId("master-begin");
    this.error = page.getByTestId("master-error");
  }

  async goto() {
    await this.page.goto("/master");
  }

  /** A setting's radio button, e.g. option("rooms", "always"). */
  option(part: "places" | "rooms" | "harbor" | "tables", value: string): Locator {
    return this.page.getByTestId(`master-${part}-${value}`);
  }

  /** Where to go after: "hall", "harbor" or "feast". */
  goTo(where: "hall" | "harbor" | "feast"): Locator {
    return this.page.getByTestId(`master-go-${where}`);
  }

  /** Fills the form and presses Begin this saga. */
  async beginSaga(night: Night & { goTo?: "hall" | "harbor" | "feast" }) {
    if (night.seed !== undefined) await this.seed.fill(String(night.seed));
    for (const part of ["places", "rooms", "harbor", "tables"] as const) {
      const value = night[part];
      if (value) await this.option(part, value).check();
    }
    if (night.silver !== undefined) await this.silver.fill(String(night.silver));
    if (night.goTo) await this.goTo(night.goTo).check();
    await this.begin.click();
  }
}
