import { expect, test } from "@playwright/test";

// The API guide (/api-guide) and its OpenAPI file (/api/openapi.json) must tell the truth: every call they list exists
// and answers with a status they document. If someone changes a route and forgets the guide, this fails.
// It runs as a guest and sends empty bodies, so nothing changes: calls that need a Viking answer 401, the others
// answer what a guest gets, and no Viking is ever created (an empty name is refused).

type Operation = { operationId: string; responses: Record<string, unknown> };
type OpenApi = { paths: Record<string, Record<string, Operation>> };

// Sample values for the {parts} of an address.
const SAMPLE: Record<string, string> = { id: "honey-mead", kind: "drink" };
const SAMPLE_BY_PATH: Record<string, Record<string, string>> = {
  "/api/menu/{id}": { id: "roast-bird" },
  "/api/ledger/{id}": { id: "1" },
};

function fill(path: string) {
  return path.replace(/\{(\w+)\}/g, (_, name: string) => SAMPLE_BY_PATH[path]?.[name] ?? SAMPLE[name]);
}

test.describe("the API guide tells the truth", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("every call in the OpenAPI file answers with a status it documents", async ({ request }) => {
    const doc = (await (await request.get("/api/openapi.json")).json()) as OpenApi;
    const calls = Object.entries(doc.paths).flatMap(([path, ops]) => Object.entries(ops).map(([method, op]) => ({ path, method, op })));
    expect(calls.length, "the guide lists the tavern's calls").toBeGreaterThan(20);

    for (const { path, method, op } of calls) {
      const url = fill(path);
      const res = await request.fetch(url, { method: method.toUpperCase(), ...(method === "get" || method === "delete" ? {} : { data: {} }) });
      const documented = Object.keys(op.responses);
      expect(documented, `${method.toUpperCase()} ${url} (${op.operationId}) answered ${res.status()}: ${await res.text()}`).toContain(
        String(res.status()),
      );
    }
  });

  test("the guide page shows the same calls as the OpenAPI file", async ({ page, request }) => {
    const doc = (await (await request.get("/api/openapi.json")).json()) as OpenApi;
    const fromFile = Object.entries(doc.paths)
      .flatMap(([path, ops]) => Object.keys(ops).map((m) => `${m.toUpperCase()} ${path}`))
      .sort();

    await page.goto("/api-guide");
    const cards = page.locator("[data-testid^=api-endpoint-][data-method]");
    await expect(cards.first()).toBeVisible();
    const onPage = (await cards.evaluateAll((els) => els.map((e) => `${e.getAttribute("data-method")} ${e.getAttribute("data-path")}`))).sort();
    expect(onPage).toEqual(fromFile);
  });

  test("every error code a call may give is explained in the error table", async ({ page }) => {
    await page.goto("/api-guide");
    const table = await page.getByTestId("api-error").evaluateAll((rows) => rows.map((r) => r.getAttribute("data-code")));
    const used = await page.locator("[data-testid$=-error][data-code]").evaluateAll((els) => els.map((e) => e.getAttribute("data-code")));
    expect(used.length).toBeGreaterThan(0);
    for (const code of new Set(used)) expect(table, `${code} is in the table`).toContain(code);
  });
});
