import type { Locator, Page } from "@playwright/test";

/**
 * The API guide (/api-guide): every API call with its body, answer and errors, plus the OpenAPI file for Postman.
 * Only visible elements count: arriving by a link, the previous page (e.g. the Master's Table) briefly stays in the
 * page, hidden. See "Previous pages stay in the page, hidden" in the README.
 */
export class ApiGuidePage {
  readonly title: Locator;
  readonly start: Locator;
  readonly openApiLink: Locator;
  /** Every call in the guide (test IDs "api-endpoint-<id>", with data-method and data-path). */
  readonly endpoints: Locator;
  /** The error table's rows (data-code, data-status). */
  readonly errors: Locator;
  readonly backToMaster: Locator;

  constructor(readonly page: Page) {
    this.title = page.getByTestId("page-title").filter({ visible: true });
    this.start = page.getByTestId("api-guide-start");
    this.openApiLink = page.getByTestId("api-guide-openapi");
    this.endpoints = page.locator("[data-testid^=api-endpoint-][data-method]").filter({ visible: true });
    this.errors = page.getByTestId("api-error");
    this.backToMaster = page.getByTestId("api-guide-master");
  }

  async goto() {
    await this.page.goto("/api-guide");
  }

  /** One call, by its id, e.g. endpoint("saga-new"). */
  endpoint(id: string): Locator {
    return this.page.getByTestId(`api-endpoint-${id}`);
  }
}
