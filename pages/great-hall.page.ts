import { expect, type Locator, type Page } from "@playwright/test";
import { Header } from "./header";

/**
 * The Great Hall (/): the painted tavern with its room windows. Windows are dark until Select Room; then Lady Owner
 * checks them one by one, and the scene gets data-revealed="true" when she's done.
 */
export class GreatHallPage {
  readonly header: Header;
  readonly scene: Locator;
  readonly selectRoom: Locator;
  readonly selectBerth: Locator;
  readonly selectParking: Locator;
  readonly checkOut: Locator;
  readonly goToBar: Locator;
  readonly doorOpen: Locator;
  readonly barowlAwake: Locator;
  readonly ladyOwner: Locator;
  readonly barowl: Locator;
  readonly toast: Locator;
  readonly tip: Locator;
  readonly dialog: RoomDialog;
  readonly reveal: RoomReveal;

  constructor(readonly page: Page) {
    this.header = new Header(page);
    this.scene = page.getByTestId("great-hall-scene");
    this.selectRoom = page.getByTestId("select-room");
    this.selectBerth = page.getByTestId("go-to-harbor");
    this.selectParking = page.getByTestId("select-parking");
    this.checkOut = page.getByTestId("check-out-sign");
    this.goToBar = page.getByTestId("go-to-bar");
    this.doorOpen = page.getByTestId("door-open");
    this.barowlAwake = page.getByTestId("barowl-awake");
    this.ladyOwner = page.getByTestId("lady-owner");
    this.barowl = page.getByTestId("barowl");
    this.toast = page.getByTestId("great-hall-toast");
    this.tip = page.getByTestId("tip");
    this.dialog = new RoomDialog(page);
    this.reveal = new RoomReveal(page);
  }

  async goto(query = "") {
    await this.page.goto(`/${query}`);
    await expect(this.scene).toBeVisible();
  }

  /** A room window, room-0 … room-17. Its data-state tells what it shows. */
  room(id: number): Locator {
    return this.page.getByTestId(`room-${id}`);
  }

  /** Presses Select Room and waits until Lady Owner has checked every window. */
  async revealRooms() {
    await this.selectRoom.click();
    await expect(this.scene).toHaveAttribute("data-revealed", "true");
  }

  /** Opens a free room's dialog. */
  async openRoom(id: number) {
    await this.room(id).click();
    await expect(this.dialog.root).toBeVisible();
  }
}

/** The booking dialog: the room's name, price and teaser, then Put in Loot Sack. */
export class RoomDialog {
  readonly root: Locator;
  readonly title: Locator;
  readonly where: Locator;
  readonly teaser: Locator;
  readonly storyNote: Locator;
  readonly pouch: Locator;
  readonly hasRoom: Locator;
  readonly loginNote: Locator;
  readonly error: Locator;
  readonly confirm: Locator;
  readonly cancel: Locator;
  readonly openSack: Locator;
  readonly login: Locator;
  readonly signup: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("room-dialog");
    this.title = page.getByTestId("room-dialog-title");
    this.where = page.getByTestId("room-dialog-where");
    this.teaser = page.getByTestId("room-dialog-teaser");
    this.storyNote = page.getByTestId("room-dialog-story-note");
    this.pouch = page.getByTestId("room-dialog-pouch");
    this.hasRoom = page.getByTestId("room-dialog-has-room");
    this.loginNote = page.getByTestId("room-dialog-login-note");
    this.error = page.getByTestId("room-dialog-error");
    this.confirm = page.getByTestId("room-dialog-confirm");
    this.cancel = page.getByTestId("room-dialog-cancel");
    this.openSack = page.getByTestId("room-dialog-sack");
    this.login = page.getByTestId("room-dialog-login");
    this.signup = page.getByTestId("room-dialog-signup");
  }
}

/** The message after Put in Loot Sack: "… is yours!", with the twist (the rest of the story). */
export class RoomReveal {
  readonly root: Locator;
  readonly title: Locator;
  readonly message: Locator;
  readonly twist: Locator;
  readonly close: Locator;
  readonly openSack: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId("room-reveal");
    this.title = page.getByTestId("room-reveal-title");
    this.message = page.getByTestId("room-reveal-message");
    this.twist = page.getByTestId("room-reveal-twist");
    this.close = page.getByTestId("room-reveal-close");
    this.openSack = page.getByTestId("room-reveal-sack");
  }
}
