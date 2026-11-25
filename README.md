# Lords of Fjords — sample Playwright tests

A starter test suite for **Lords of Fjords**, a pretend Viking tavern built for practising manual and automated testing:
book a room in the Great Hall, moor your boat at the Drakkar Harbor, join a company in Barowl's Mead & Feast, pay, and
hear at Morning Check Out what happened during the night. Copy it, run it, add your own tests and try to break the
tavern.

## What's inside
The usual Playwright layout: tests in `tests/`, page objects in `pages/`, fixtures in `fixtures/`, helpers in `utils/`.
Imports use short aliases (`@pages/…`, `@fixtures/…`, `@utils/…`, set in `tsconfig.json`).

```
tests/
  setup/   auth.setup.ts: runs first, enters the hall once
  ui/      tests in the browser (the API only prepares the night)
  api/     tests of the JSON API alone, no browser
pages/     page objects (great-hall.page.ts, menu.page.ts, …) and the top menu (header.ts)
fixtures/  fixtures.ts: what every test is given
utils/     tavern-api.ts (the API client) and constants.ts
```

| Folder / file | Contents |
|---|---|
| `tests/ui/smoke.spec.ts` | Is the tavern alive? Health, the Great Hall, the top menu, 404, guests (tagged `@smoke`) |
| `tests/ui/great-hall.spec.ts` | Select Room, the windows, booking a room into the Loot Sack, the twist kept secret until the room is yours, one room per saga, Lady Owner turning away a thin pouch, paying |
| `tests/ui/feast.spec.ts` | Tonight's five companies (same saga, same companies), Select Table, full tables with another Viking on the guest chair, a room needed to dine, Join the table with the twist and the Mighty Viking in his seat, one table per saga, Go to Menu, Barowl's wink, guests |
| `tests/ui/bar.spec.ts` | Barowl's Counter: Go to Bar leads there, drinks without a room or table, Hungry? (Select a table or Go to Menu), the stand-in for Sir's picture, closed after Check Out, guests |
| `tests/ui/menu.spec.ts` | Barowl's Menu: drinks and dishes as the API lists them (never wine), a dish page with Jump to recipe, the story and the recipe, Lost at Sea for an unknown dish, ordering only at a table (guests, no table, after Check Out), − / + and the Loot Sack counting every mug, paying with the room, 1–10 of the same, refused ids and quantities |
| `tests/ui/check-out.spec.ts` | Morning Check Out with every event forced by the Master's Table: room events and their refunds, the Kraken eating or damaging your boat, the pirates' boat swap (refund or their wreck), table events with Lady Owner's charges shown in red, Robin Hood's 59 / 60 silver rule, the order of the cards, the saga closing, the Ledger, a new day at the next login |
| `tests/ui/master-table.spec.ts` | The Master's Table page (forcing every part of the night, the top menu showing it, refused values, guests) and the same from `POST /api/saga/new`, old scenario names included |
| `tests/api/api.spec.ts` | The JSON API's rules and error codes: Viking names (only names that must be refused, so no account is created), guests looking at any saga, login needed, the Loot Sack, settling (changed sack, not enough silver), the Coin Pouch, the Ledger, `/api/me`. Together with the other specs, every error code except `TAVERN_FULL` is checked |
| `tests/ui/auth.spec.ts` | Sail Away (log out): the hall turns back to a guest's and the server forgets the session. It logs in with its **own** session, never the shared one from `auth.setup.ts`, because logging out the shared session would make every later test fail |
| `tests/ui/report-bug.spec.ts` | Report a bug: the footer link opens this repository's bug form with the saga number and page filled in (it only reads the link, never opens GitHub) |
| `tests/ui/sagas.spec.ts` | The Sagas page: every saga has a title, a story and a teller, unique IDs, and no room numbers (Lady Owner's rule). The words aren't checked: she keeps adding sagas |
| `tests/ui/harbor.spec.ts` | Select Berth, the berths, Moor here, the Kraken peeking up (same spot for the same saga), one berth per saga, "the Kraken has seen your ship", Select Parking from the Great Hall, Piermaid, the gates |
| `pages/` | Page objects, one class per page (`*.page.ts`) (Great Hall, Drakkar Harbor, Mead & Feast, Morning Check Out, Master's Table, Loot Sack, Settle, the top menu) |
| `utils/tavern-api.ts` | The API client: one method per API call (`api.addRoom(7)`, `api.settle()`), with the answers' types. Used to prepare a night quickly and by the API tests |
| `fixtures/fixtures.ts` | Gives every test the page objects, and begins a fresh night first |
| `tests/setup/auth.setup.ts` | A setup project: enters the hall once and saves the session for all tests |

**146 tests** in all. Not covered yet: `TAVERN_FULL` (it needs 50 Vikings), phones and keyboard-only use (see the ideas below).

## The tavern's secret weapon for testers: sagas and the Master's Table
Everything random in the tavern comes from the **saga number** (shown in the top menu as `Saga #4217`). The same number
always gives the same night: the same free rooms, prices, Kraken and companies. The tests begin every night with a
known number, so they are repeatable.

The **Master's Table** (`/master`, or `POST /api/saga/new`) can also force what happens: every room free or taken, the
night's events at 100% or never, the Kraken eating your boat, the pirates sailing off in it, the Coin Pouch set to any
amount. `api.beginSaga({ seed, places, rooms, harbor, tables, silver })` in `utils/tavern-api.ts` uses it.

## Set up
Needs Node.js 20 or newer.

1. **Swear the Oath once by hand** on the tavern's Swear the Oath page and pick a Viking name. The tests never swear the
   oath themselves: the tavern has room for 50 Vikings.
2. Copy `.env.example` to `.env` and fill in the tavern's address and your Viking's name:
   ```
   BASE_URL=http://localhost:3100
   VIKING_NAME=YourName
   ```
3. Install and run:
   ```bash
   npm install
   npx playwright install chromium
   npm test
   ```

Other commands:

| Command | What it does |
|---|---|
| `npm run test:smoke` | Only the quick `@smoke` checks |
| `npm run test:ui` | Playwright's UI mode: pick tests, watch them run, time-travel through steps |
| `npm run test:headed` | Run with a visible browser |
| `npm run report` | Open the HTML report of the last run |
| `npm run typecheck` | Check TypeScript types |

## Good to know
- **One Viking, one night.** All tests use your Viking, so they run one at a time (`workers: 1`). Before each test the
  fixture begins a fresh saga (saga 4217, an ordinary night, an empty Loot Sack, a full Coin Pouch). Don't play with
  the same Viking while the tests run.
- **The scenes animate.** After Select Room (or Select Berth, Select Table) the keeper checks the windows one by one.
  Don't sleep: wait for the scene's `data-revealed="true"` (see `GreatHallPage.revealRooms`).
- **Some things never stop moving.** Piermaid sways, Barowl's lantern flickers. Playwright waits for an element to hold
  still before hovering or clicking it, so it would wait forever. The tavern honours the "reduce motion" setting, which
  stops them: `test.use({ reducedMotion: "reduce" })` (see `tests/ui/harbor.spec.ts`).
- **Previous pages stay in the page, hidden.** When you move between pages inside the tavern, the page you came from
  is kept hidden in the HTML. A locator such as `getByTestId("page-title")` can then match two elements; prefer role
  locators or add `.filter({ visible: true })`.
- **Money is whole silver coins.** A new Viking has 100 silver; the Jarl's treasury tops the pouch up to 100.
- **The weekly cleanup sends all Vikings home** (Sunday 00:00 UTC). If the setup says it can't enter the hall, swear
  the oath again.
- **Please keep runs gentle** when the tavern is shared: run the suite now and then, not in a tight loop.

## Report a bug
Found a bug in the tavern? Use **Report a bug** at the bottom of any page: it opens this repository's bug form
with the saga number and the page filled in. Or open it directly: **Issues → New issue → Report a bug in the tavern**.
Reports are public, so no real names, please.

## Bugs found so far
- ~~The Great Hall's browser tab said only "Great Hall"; every other page says "… | Lords of Fjords".~~ Fixed in the
  tavern on 2026-11-23.
- ~~Mead & Feast: Barowl's greeting and the table dialog still promised a seat at every table, but one or two tables
  are full each night.~~ Fixed in the tavern on 2026-11-23.
- ~~Settle with the Innkeeper named a berth "Room 4: …" instead of "Berth 4: …".~~ Found while building the menu;
  fixed in the tavern on 2026-11-23. (No test had looked at a berth's name on the Settle page.)
- ~~After Lady Owner offered the Kitchen, its Put in Loot Sack said "Booking…" and stayed off.~~ Found by Lady Owner
  by hand; asking her and booking shared one busy flag. Fixed on 2026-11-24, with a test for the whole path.
- ~~The goat by the Goat Stable looked bald.~~ Sir painted a woolly one, and it took the bald goat's place in the Great
  Hall on 2026-11-24 (a known issue for about an hour).

## Known issues (found, and left as they are for now)
Real bugs, but not worth fixing yet. A test that runs into one should know it's expected.
- **Settle for the free Kitchen says "Pay from the Coin Pouch"** (2026-11-24): with only the Kitchen Fellowship in the
  Loot Sack the bill is 0 silver, yet the button still talks about paying from the pouch. Paying works; only the words
  are odd. (`settle-pay` on `/settle`.)

## Open observations (need more testing before a fix is suggested)
- **Readability, laptop vs phone (2026-11-23):** a tester with poor vision reads the tavern more easily on a phone
  than on a laptop; the phone's brightness seems to help a lot. Is that a real concern for the laptop fonts? To check
  with more testers and screens: font sizes, contrast of the painted signs and story text, and the page at 200% browser
  zoom (nothing important cut off or hidden).
- **Phone, held sideways (2026-11-23):** Mead & Feast works well; the companies' stories open with a tap on the table,
  which is fine on a phone. Held upright the hall is small, but people scroll or turn the phone by themselves, so no
  "turn your phone" message for now.

## Ideas for your own tests
- Lady Owner's offer is kept for the rest of the saga: begin with 5 silver, get the Goat Stable offered, reload, is it
  still lit?
- A room and a berth together can cost more than the pouch holds: what does Settle say?
- Keyboard only: can you book a room with Tab and Enter?
- Mobile: run the suite with `devices["Pixel 7"]`.
