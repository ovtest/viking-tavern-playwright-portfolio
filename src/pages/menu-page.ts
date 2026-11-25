import { type Locator, type Page } from "@playwright/test";
import { Header } from "./header";

/**
 * Barowl's Menu (/feast/menu): drinks as a list, food as cards. Each dish or drink has − / + and Add to Loot Sack,
 * disabled unless the Viking sits at a table (the note above the menu says why).
 */
export class MenuPage {
  readonly header: Header;
  readonly intro: Locator;
  readonly drinks: Locator;
  readonly food: Locator;
  /** Why ordering is off: data-state "guest", "needs-table" or "closed". */
  readonly orderNote: Locator;
  readonly selectTable: Locator;
  /** The way back, at the top: "Back to your table: <company>" (data-company) when seated, else "Back to the tables". */
  readonly backTop: Locator;

  constructor(readonly page: Page) {
    this.header = new Header(page);
    this.intro = page.getByTestId("menu-intro");
    this.drinks = page.getByTestId("menu-drinks");
    this.food = page.getByTestId("menu-food");
    this.orderNote = page.getByTestId("menu-order-note");
    this.selectTable = page.getByTestId("menu-order-select-table");
    this.backTop = page.getByTestId("menu-back-top");
  }

  async goto() {
    await this.page.goto("/feast/menu");
  }

  /** A drink's line or a dish's card, e.g. item("drink", "honey-mead"). */
  item(kind: "dish" | "drink", id: string): Locator {
    return this.page.getByTestId(`${kind}-${id}`);
  }

  /** Part of an item: "name", "price", "minus", "qty", "plus", "add", "message", "error", "story-link", "picture",
   * "sold-out" (a dish off the menu tonight, with Barowl's excuse). */
  part(kind: "dish" | "drink", id: string, part: string): Locator {
    return this.page.getByTestId(`${kind}-${id}-${part}`);
  }

  /** Sets the quantity with + and presses Add to Loot Sack, then waits for Barowl's answer. */
  async order(kind: "dish" | "drink", id: string, qty = 1) {
    for (let i = 1; i < qty; i++) await this.part(kind, id, "plus").click();
    await this.part(kind, id, "add").click();
    await this.part(kind, id, "message").or(this.part(kind, id, "error")).waitFor();
  }
}

/** A dish page (/feast/menu/<id>): picture, Jump to recipe, the story, the recipe, Add to Loot Sack. */
export class DishPage {
  readonly title: Locator;
  readonly picture: Locator;
  readonly jumpToRecipe: Locator;
  readonly story: Locator;
  readonly storyMissing: Locator;
  readonly recipe: Locator;
  readonly ingredients: Locator;
  readonly steps: Locator;
  readonly price: Locator;
  readonly qty: Locator;
  readonly plus: Locator;
  readonly add: Locator;
  readonly message: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByTestId("page-title");
    this.picture = page.getByTestId("dish-picture");
    this.jumpToRecipe = page.getByTestId("jump-to-recipe");
    this.story = page.getByTestId("dish-story");
    this.storyMissing = page.getByTestId("dish-story-missing");
    this.recipe = page.getByTestId("dish-recipe");
    this.ingredients = page.getByTestId("recipe-ingredients").getByRole("listitem");
    this.steps = page.getByTestId("recipe-steps").getByRole("listitem");
    this.price = page.getByTestId("dish-price");
    this.qty = page.getByTestId("dish-qty");
    this.plus = page.getByTestId("dish-plus");
    this.add = page.getByTestId("dish-add");
    this.message = page.getByTestId("dish-message");
  }

  async goto(id: string) {
    await this.page.goto(`/feast/menu/${id}`);
  }
}
