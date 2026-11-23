# Lords of Fjords — sample Playwright tests

A starter test suite for **Lords of Fjords**, a pretend Viking tavern built for practising manual and automated testing:
book a room in the Great Hall, moor your boat at the Drakkar Harbor, join a company in Barowl's Mead & Feast, pay, and
hear at Morning Check Out what happened during the night. Copy it, run it, add your own tests and try to break the
tavern.

## What's inside
| Folder / file | Contents |
|---|---|
| `specs/smoke.spec.ts` | Is the tavern alive? Health, the Great Hall, the top menu, 404, guests (tagged `@smoke`) |
| `specs/great-hall.spec.ts` | Select Room, the windows, booking a room into the Loot Sack, the twist kept secret until the room is yours, one room per saga, Lady Owner turning away a thin pouch, paying |
| `specs/feast.spec.ts` | Tonight's five companies (same saga, same companies), Select Table, full tables with another Viking on the guest chair, a room needed to dine, Join the table with the twist and the Mighty Viking in his seat, one table per saga, Go to Menu, Barowl's wink, guests |
| `specs/check-out.spec.ts` | Morning Check Out with every event forced by the Master's Table: room events and their refunds, the Kraken eating or damaging your boat, the pirates' boat swap (refund or their wreck), table events with Lady Owner's charges shown in red, Robin Hood's 59 / 60 silver rule, the order of the cards, the saga closing, the Ledger, a new day at the next login |
| `specs/master-table.spec.ts` | The Master's Table page (forcing every part of the night, the top menu showing it, refused values, guests) and the same from `POST /api/saga/new`, old scenario names included |
| `specs/api.spec.ts` | The JSON API's rules and error codes: Viking names (only names that must be refused, so no account is created), guests looking at any saga, login needed, the Loot Sack, settling (changed sack, not enough silver), the Coin Pouch, the Ledger, `/api/me`. Together with the other specs, every error code except `TAVERN_FULL` is checked |
| `specs/harbor.spec.ts` | Select Berth, the berths, Moor here, the Kraken peeking up (same spot for the same saga), one berth per saga, "the Kraken has seen your ship", Select Parking from the Great Hall, Piermaid, the gates |
| `src/pages/` | Page objects, one class per page (Great Hall, Drakkar Harbor, Mead & Feast, Morning Check Out, Master's Table, Loot Sack, Settle, the top menu) |
| `src/tavern-api.ts` | Helper for the tavern's JSON API, used to prepare a night quickly |
| `src/fixtures.ts` | Gives every test the page objects, and begins a fresh night first |
| `src/auth.setup.ts` | Enters the hall once and saves the session for all tests |

**108 tests** in all. Not covered yet: the menu (not built), `TAVERN_FULL` (it needs 50 Vikings), phones and keyboard-only use (see the ideas below).

## The tavern's secret weapon for testers: sagas and the Master's Table
Everything random in the tavern comes from the **saga number** (shown in the top menu as `Saga #4217`). The same number
always gives the same night: the same free rooms, prices, Kraken and companies. The tests begin every night with a
known number, so they are repeatable.

The **Master's Table** (`/master`, or `POST /api/saga/new`) can also force what happens: every room free or taken, the
night's events at 100% or never, the Kraken eating your boat, the pirates sailing off in it, the Coin Pouch set to any
amount. `api.beginSaga({ seed, places, rooms, harbor, tables, silver })` in `src/tavern-api.ts` uses it.

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
  stops them: `test.use({ reducedMotion: "reduce" })` (see `specs/harbor.spec.ts`).
- **Previous pages stay in the page, hidden.** When you move between pages inside the tavern, the page you came from
  is kept hidden in the HTML. A locator such as `getByTestId("page-title")` can then match two elements; prefer role
  locators or add `.filter({ visible: true })`.
- **Money is whole silver coins.** A new Viking has 100 silver; the Jarl's treasury tops the pouch up to 100.
- **The weekly cleanup sends all Vikings home** (Sunday 00:00 UTC). If the setup says it can't enter the hall, swear
  the oath again.
- **Please keep runs gentle** when the tavern is shared: run the suite now and then, not in a tight loop.

## Bugs found so far
- ~~The Great Hall's browser tab said only "Great Hall"; every other page says "… | Lords of Fjords".~~ Fixed in the
  tavern on 2026-11-23.
- ~~Mead & Feast: Barowl's greeting and the table dialog still promised a seat at every table, but one or two tables
  are full each night.~~ Fixed in the tavern on 2026-11-23.

## Ideas for your own tests
- Lady Owner's offer is kept for the rest of the saga: begin with 5 silver, get the Goat Stable offered, reload, is it
  still lit?
- A room and a berth together can cost more than the pouch holds: what does Settle say?
- Keyboard only: can you book a room with Tab and Enter?
- Mobile: run the suite with `devices["Pixel 7"]`.
