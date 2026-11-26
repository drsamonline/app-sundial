# Sundial

A calendar you schedule by drawing shadows. The day is an arc from sunrise to sunset; an event is a shadow
on it. **Where the shadow falls is when it starts, and how long it is is how long it lasts.**

- **Demo:** https://drsamonline.github.io/app-sundial/play/index.html
- **Landing page:** https://drsamonline.github.io/app-sundial/
- **Release:** https://github.com/drsamonline/app-sundial/releases/tag/app-latest
- **Plan row:** #28 of 37 in `drsamonline/forge` → `QUEUE/PLAN.json`
- **Specs absorbed:** `app-sundial` (lead)
- **Licence:** PolyForm Noncommercial 1.0.0

## Status

| | |
|---|---|
| **Built** | The arc with hour marks; shadows with a start and a length; drag moves the start and never the length; clipping past sunset; export/import; the day survives a reload. |
| **Release** | Windows EXE, Android APK and Linux binary, built from this source by `app-builder` in CI. |
| **Not built** | **Real solar geometry.** The arc is a window between two times you set, not a computed sunrise for your latitude. Said on the page rather than implied by the shape. |
| **Untested** | Whether drawing a day is better than typing it. The arithmetic is exact; the ergonomics are not testable here. |

## The spec's "done means", counted

| The spec says | The test |
|---|---|
| a shadow at a known position back-solves to its time | position 0.25 → 09:00, 0.5 → 12:00, 1 → 18:00, and `positionOf` round-trips |
| a quarter of the arc further is proportionally later | 0.25 → 0.5 is exactly 180 minutes |
| and agrees with the dial's own hour marks | the 12:00 mark sits at 0.5, the 09:00 mark at 0.25, and **every** mark's position round-trips through `timeAt` exactly |
| dragging changes the start and leaves the duration | 09:00 → 12:00, still 30 min, `durationUnchanged: true`; a second drag still 30 min |
| events survive a reload | both events and their lengths come back from `serialize` → `parseState` |

## The bug the test found before the app shipped

I rounded each mark's `position` to three decimals for display. At 07:00 that gives `0.083` instead of
`0.0833…`, which back-solves to 419.76 minutes — **a quarter-minute disagreement between a mark and the
time it claims to be**. The rounding is now only in the UI, and the engine keeps positions exact. The test
that caught it compares every mark against `timeAt`, not just a couple of round numbers.

## What it will not do

- **Stretch a shadow when you move it.**
- **Let a position and an hour disagree.**
- **Run past sunset** — clipped and marked.
- **Grow a second job.**
- **Use the internet.**

## When things go wrong

| Case | Behaviour |
|---|---|
| **Bad input** | No name, no length, zero length, outside the dial, a sun that sets before it rises — each refused with the field named. |
| **No network** | Nothing changes. |
| **Storage full or unavailable** | **NOT SAVED**, dial unchanged. |
| **Corrupt saved state** | Reported and offered for export, never replaced with an empty one — an empty dial looks like a clear day. |

## Tests

```bash
npm test                      # all three suites
node tests/self-tests.js      # engine — 51 assertions
node tests/ui-tests.js        # the page in jsdom — 17 assertions
node tests/page-smoke.js      # every local src/href resolves, nothing off-origin
```

Mutation-tested six ways on 26/11/2026, all red: a drag stretching the duration (4 failures), hour marks
using a different arc (2), a non-proportional arc (12), a broken dial starting empty (5), an event outside
the dial accepted (2), a zero-length event accepted (2).

## Two test mistakes, both mine

1. `S.addEvent(made.state, {...})` — the signature is `(dial, state, input)` and I dropped the dial, so the
   fixture was nonsense.
2. `ok("selecting shows the drag control", $("moveWrap").hidden, false)` — I passed the *value* as the
   condition, so `false` read as a failure. That is the same `ok`/`eq` mix-up that has appeared in earlier
   rows of this project; the engine was fine both times.

## Layout

```
docs/index.html            landing page
docs/play/index.html       the app — the arc, the shadows, the drag, export
docs/play/app.js           DOM wiring: draw, select, drag, export, save guard
docs/play/sundial-core.js  the engine — dial, positions, hour marks, events, storage
docs/play/web-kit.js       vendored kit (unmodified)
docs/play/export-kit.js    vendored kit (unmodified)
tests/self-tests.js        engine suite (51)
tests/ui-tests.js          page suite (17, jsdom)
tests/page-smoke.js        shape on disk
PAGES.json                 landing = docs/index.html, app = docs/play/index.html
```

## Where the spec was silent, and what was chosen

- **One function for both marks and shadows.** `timeAt(dial, position)` is used by the hour marks and by every shadow, which is why they cannot disagree.
- **Positions are exact, display is rounded.** The rounding that broke exactness is now only in the UI.
- **A shadow past sunset is clipped, not extended** — the day ends, and the app should not pretend otherwise.
- **The dial's window is settable** (sunrise and sunset), because a 06:00–18:00 default is wrong for half the year.
- **Duration lives on the event, position is derived** — so a drag cannot accidentally rewrite a length.

## What is not built, and why

**Real solar geometry.** A true sunrise needs a latitude and a date and an ephemeris; this app needs an arc.
What ships is honest about being a window between two times, and exact about the arithmetic that turns a
position into a time.
