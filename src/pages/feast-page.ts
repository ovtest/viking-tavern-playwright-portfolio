import { expect, type Locator, type Page } from "@playwright/test";
import { Header } from "./header";

/**
 * Barowl's Mead & Feast (/feast): tonight's five companies at their tables. Tables are in a light dusk until Select
 * Table; then Barowl checks them one by one, and the scene gets data-revealed="true" when he's done. Each table has a
 * data-state: available (a seat for you), full (another Viking sits on the guest chair), mine (you joined it).
 */
export class FeastPage {
  readonly header: Header;
  readonly scene: Locator;
  readonly tables: Locator;
  readonly selectTable: Locator;
  readonly goToMenu: Locator;
  readonly barowl: Locator;
  readonly barowlWink: Locator;
  readonly toast: Locator;
  readonly tip: Locator;
  /** The Mighty Viking (alone, glowing) laid over your own table. */
  readonly you: Locator;
  readonly dialog: TableDialog;
  readonly reveal: TableReveal;

  constructor(private readonly page: Page) {
    this.header = new Header(page);
    this.scene = page.getByTestId("feast-scene");
    this.tables = page.getByTestId("tables").getByRole("button");
    this.selectTable = page.getByTestId("select-table");
    this.goToMenu = page.getByTestId("go-to-menu");
    this.barowl = page.getByTestId("barowl");
    this.barowlWink = page.getByTestId("barowl-wink");
    this.toast = page.getByTestId("feast-toast");
    this.tip = page.getByTestId("tip");
    this.you = page.getByTestId("table-you");
    this.dialog = new TableDialog(page);
    this.reveal = new TableReveal(page);
  }

  async goto(query = "") {
    await this.page.goto(`/feast${query}`);
    await expect(this.scene).toBeVisible();
  }

  /** A company's table, e.g. table("robin-hood"). data-place tells where it sits tonight (1–5). */
  table(company: string): Locator {
    return this.page.getByTestId(`table-${company}`);
  }

  /** The table's picture: data-viking="true" (you sit there), "other" (another Viking: full) or "false". */
  picture(company: string): Locator {
    return this.page.getByTestId(`table-${company}-picture`);
  }

  /** Presses Select Table and waits until Barowl has checked every table. */
  async revealTables() {
    await this.selectTable.click();
    await expect(this.scene).toHaveAttribute("data-revealed", "true");
  }

  async openTable(company: string) {
    await this.table(company).click();
    await expect(this.dialog.root).toBeVisible();
  }
}

/** The table dialog: the same picture large, the company's story, then Join the table. */
export class TableDialog {
  readonly root: Locator;
  readonly picture: Locator;
  readonly you: Locator;
  readonly title: Locator;
  readonly who: Locator;
  readonly story: Locator;
  readonly twist: Locator;
  readonly free: Locator;
  readonly mine: Locator;
  readonly hasTable: Locator;
  readonly needsRoom: Locator;
  readonly closed: Locator;
  readonly loginNote: Locator;
  readonly error: Locator;
  readonly join: Locator;
  readonly cancel: Locator;
  readonly greatHall: Locator;
  readonly login: Locator;
  readonly signup: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("table-dialog");
    this.picture = page.getByTestId("table-dialog-picture");
    this.you = page.getByTestId("table-dialog-you");
    this.title = page.getByTestId("table-dialog-title");
    this.who = page.getByTestId("table-dialog-who");
    this.story = page.getByTestId("table-dialog-story");
    this.twist = page.getByTestId("table-dialog-twist");
    this.free = page.getByTestId("table-dialog-free");
    this.mine = page.getByTestId("table-dialog-mine");
    this.hasTable = page.getByTestId("table-dialog-has-table");
    this.needsRoom = page.getByTestId("table-dialog-needs-room");
    this.closed = page.getByTestId("table-dialog-closed");
    this.loginNote = page.getByTestId("table-dialog-login-note");
    this.error = page.getByTestId("table-dialog-error");
    this.join = page.getByTestId("table-dialog-join");
    this.cancel = page.getByTestId("table-dialog-cancel");
    this.greatHall = page.getByTestId("table-dialog-great-hall");
    this.login = page.getByTestId("table-dialog-login");
    this.signup = page.getByTestId("table-dialog-signup");
  }
}

/** The message after Join the table: "You sit with …", with the twist. */
export class TableReveal {
  readonly root: Locator;
  readonly title: Locator;
  readonly message: Locator;
  readonly twist: Locator;
  readonly menu: Locator;
  readonly close: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("table-reveal");
    this.title = page.getByTestId("table-reveal-title");
    this.message = page.getByTestId("table-reveal-message");
    this.twist = page.getByTestId("table-reveal-twist");
    this.menu = page.getByTestId("table-reveal-menu");
    this.close = page.getByTestId("table-reveal-close");
  }
}
