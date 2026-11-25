import { AUTH_FILE } from "@utils/constants";
import { expect, test } from "@fixtures/fixtures";
import { Header } from "@pages/header";
import { errorOf } from "@utils/tavern-api";

// Entering and leaving the hall. Sail Away (log out) ends the session ON THE SERVER, not only in the browser.
// So this test must never use the shared session that auth.setup.ts saved for all the other tests: if it did, every
// test after it would arrive with a dead cookie and fail as "not logged in". Instead it starts without any session,
// enters the hall by itself (a second session for the same test Viking) and sails away with that one only.

test.describe("Sail Away", () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // no shared session: this test makes its own

  test("Sail Away ends this session: the hall turns back to a guest's, and the old cookie no longer works", async ({ page, playwright, baseURL }) => {
    const header = new Header(page);

    // Its own session, through the API, as the setup does.
    const login = await page.request.post("/api/auth/login", { data: { username: process.env.VIKING_NAME } });
    expect(login.status()).toBe(200);
    const [session] = (await page.context().cookies()).filter((c) => c.httpOnly);
    expect(session, "a session cookie after entering the hall").toBeDefined();

    await page.goto("/");
    await expect(header.username).toHaveText(process.env.VIKING_NAME!);

    await header.logout.click();
    await expect(header.login).toBeVisible();
    await expect(header.signup).toBeVisible();
    await expect(header.username).toHaveCount(0);
    await expect(header.logout).toHaveCount(0);

    // The server forgot the session: the same cookie, sent again, is a guest's.
    const oldCookie = await playwright.request.newContext({ baseURL, storageState: { cookies: [session], origins: [] } });
    const me = await oldCookie.get("/api/me");
    expect(me.status()).toBe(401);
    expect((await errorOf(me)).code).toBe("NOT_LOGGED_IN");
    await oldCookie.dispose();

    // ...while the shared session of all the other tests is still alive.
    const shared = await playwright.request.newContext({ baseURL, storageState: AUTH_FILE });
    expect((await shared.get("/api/me")).status()).toBe(200);
    await shared.dispose();
  });
});
