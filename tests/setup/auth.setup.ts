import { expect, test as setup } from "@playwright/test";
import { AUTH_FILE } from "@utils/constants";

// Runs once before the tests: enters the hall as VIKING_NAME through the API and saves the session cookie,
// so every test starts logged in without going through the Enter the Hall page.
setup("enter the hall as the test Viking", async ({ request }) => {
  const username = process.env.VIKING_NAME?.trim();
  if (!username) {
    throw new Error(
      "VIKING_NAME is not set. Swear the Oath once on the tavern's Swear the Oath page, then put the name in .env " +
        "(see .env.example).",
    );
  }

  const res = await request.post("/api/auth/login", { data: { username } });
  expect(
    res.status(),
    `Entering the hall as "${username}" failed. Does this Viking exist? (The weekly cleanup sends all Vikings home; swear the oath again.)`,
  ).toBe(200);

  await request.storageState({ path: AUTH_FILE });
});
