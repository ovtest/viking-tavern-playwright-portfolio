import { expect, type Locator, type Page } from "@playwright/test";
import { Header } from "./header";

/**
 * The Drakkar Harbor (/harbor): nine berths at the lantern posts on three islands. Berths are dark until Select Berth;
 * then Piermaid checks them one by one, and the scene gets data-revealed="true" when she's done.
 */
export class HarborPage {
  readonly header: Header;
  readonly scene: Locator;
  readonly selectBerth: Locator;
  readonly goToBar: Locator;
  readonly piermaid: Locator;
  readonly gateNear: Locator;
  readonly gateFar: Locator;
  readonly toast: Locator;
  readonly tip: Locator;
  /** The Kraken, peeking up once you've moored (data-spot = K1 / K2 / K3). */
  readonly kraken: Locator;
  readonly dialog: BerthDialog;
  readonly reveal: BerthReveal;

  constructor(private readonly page: Page) {
    this.header = new Header(page);
    this.scene = page.getByTestId("harbor-scene");
    this.selectBerth = page.getByTestId("select-berth");
    this.goToBar = page.getByTestId("go-to-bar");
    this.piermaid = page.getByTestId("piermaid");
    this.gateNear = page.getByTestId("gate-near");
    this.gateFar = page.getByTestId("gate-far");
    this.toast = page.getByTestId("harbor-toast");
    this.tip = page.getByTestId("tip");
    this.kraken = page.getByTestId("kraken");
    this.dialog = new BerthDialog(page);
    this.reveal = new BerthReveal(page);
  }

  async goto(query = "") {
    await this.page.goto(`/harbor${query}`);
    await expect(this.scene).toBeVisible();
  }

  /** A berth, berth-1 … berth-9. Its data-state tells what it shows. */
  berth(id: number): Locator {
    return this.page.getByTestId(`berth-${id}`);
  }

  /** The boat lying at a berth (another Viking's: data-picture="moored"; yours: "arrived"). */
  boat(id: number): Locator {
    return this.page.getByTestId(`berth-${id}-boat`);
  }

  /** The soft rings at a Kraken spot after Select Berth (K1, K2, K3). */
  ripples(spot: "K1" | "K2" | "K3"): Locator {
    return this.page.getByTestId(`kraken-ripples-${spot}`);
  }

  /** Presses Select Berth and waits until Piermaid has checked every berth. */
  async revealBerths() {
    await this.selectBerth.click();
    await expect(this.scene).toHaveAttribute("data-revealed", "true");
  }

  async openBerth(id: number) {
    await this.berth(id).click();
    await expect(this.dialog.root).toBeVisible();
  }
}

/** The berth dialog: the berth, its boat size and price, then Moor here. */
export class BerthDialog {
  readonly root: Locator;
  readonly title: Locator;
  readonly where: Locator;
  readonly teaser: Locator;
  readonly pouch: Locator;
  readonly hasBerth: Locator;
  readonly krakenSeen: Locator;
  readonly loginNote: Locator;
  readonly error: Locator;
  readonly confirm: Locator;
  readonly cancel: Locator;
  readonly openSack: Locator;
  readonly login: Locator;
  readonly signup: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("berth-dialog");
    this.title = page.getByTestId("berth-dialog-title");
    this.where = page.getByTestId("berth-dialog-where");
    this.teaser = page.getByTestId("berth-dialog-teaser");
    this.pouch = page.getByTestId("berth-dialog-pouch");
    this.hasBerth = page.getByTestId("berth-dialog-has-berth");
    this.krakenSeen = page.getByTestId("berth-dialog-kraken-seen");
    this.loginNote = page.getByTestId("berth-dialog-login-note");
    this.error = page.getByTestId("berth-dialog-error");
    this.confirm = page.getByTestId("berth-dialog-confirm");
    this.cancel = page.getByTestId("berth-dialog-cancel");
    this.openSack = page.getByTestId("berth-dialog-sack");
    this.login = page.getByTestId("berth-dialog-login");
    this.signup = page.getByTestId("berth-dialog-signup");
  }
}

/** The message after Moor here: "Berth N is yours!", with the Kraken's suspense line. */
export class BerthReveal {
  readonly root: Locator;
  readonly title: Locator;
  readonly message: Locator;
  readonly kraken: Locator;
  readonly close: Locator;
  readonly openSack: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("berth-reveal");
    this.title = page.getByTestId("berth-reveal-title");
    this.message = page.getByTestId("berth-reveal-message");
    this.kraken = page.getByTestId("berth-reveal-kraken");
    this.close = page.getByTestId("berth-reveal-close");
    this.openSack = page.getByTestId("berth-reveal-sack");
  }
}
