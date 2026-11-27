// npm run test:prod                 the whole suite against the live tavern (prod)
// npm run test:prod -- --grep @smoke  any Playwright options after --
//
// The live tavern is http://fjords.oldbeaver.com:3102. Settings in .env (all optional):
//   PROD_URL          another address for it, e.g. its home-network address when the public name doesn't work
//                     from inside the same network
//   PROD_VIKING_NAME  a Viking sworn in on the live tavern, when it isn't the same as VIKING_NAME
import { spawnSync } from "node:child_process";

const LIVE_TAVERN = "http://fjords.oldbeaver.com:3102";

try {
  process.loadEnvFile(".env");
} catch {
  // no .env file: environment variables / defaults
}

const env = {
  ...process.env,
  BASE_URL: process.env.PROD_URL || LIVE_TAVERN,
  VIKING_NAME: process.env.PROD_VIKING_NAME || process.env.VIKING_NAME,
};
console.log(`Running the tests against ${env.BASE_URL} as ${env.VIKING_NAME || "(no VIKING_NAME set)"}\n`);

const args = process.argv.slice(2).map((a) => (/\s/.test(a) ? `"${a}"` : a));
const res = spawnSync(`npx playwright test ${args.join(" ")}`, { stdio: "inherit", env, shell: true });
process.exit(res.status ?? 1);
