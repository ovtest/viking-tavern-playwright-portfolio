import { test as base } from "@playwright/test";
import { FULL_POUCH, TEST_SAGA } from "./constants";
import { GreatHallPage } from "./pages/great-hall-page";
import { HarborPage } from "./pages/harbor-page";
import { LootSackPage, SettlePage } from "./pages/loot-sack-page";
import { TavernApi } from "./tavern-api";

type Fixtures = {
  /** The tavern's API, logged in as VIKING_NAME (shares cookies with the page). */
  api: TavernApi;
  /** Runs before every test (automatically): a fresh night, see below. */
  freshNight: void;
  greatHall: GreatHallPage;
  harbor: HarborPage;
  lootSack: LootSackPage;
  settlePage: SettlePage;
};

export const test = base.extend<Fixtures>({
  api: async ({ page }, use) => use(new TavernApi(page.request)),
  // Every test starts from the same night: saga TEST_SAGA, an ordinary night (the saga number decides who's staying),
  // an empty Loot Sack and a full Coin Pouch. A test that needs another night begins its own saga with api.beginSaga.
  freshNight: [
    async ({ api, page }, use) => {
      // Guest tests (no session) have no night of their own to reset.
      const loggedIn = (await page.request.get("/api/me")).ok();
      if (loggedIn) await api.beginSaga({ seed: TEST_SAGA, silver: FULL_POUCH });
      await use();
    },
    { auto: true },
  ],
  greatHall: async ({ page }, use) => use(new GreatHallPage(page)),
  harbor: async ({ page }, use) => use(new HarborPage(page)),
  lootSack: async ({ page }, use) => use(new LootSackPage(page)),
  settlePage: async ({ page }, use) => use(new SettlePage(page)),
});

export { expect } from "@playwright/test";
