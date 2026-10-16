# cafflife — caffeine tracker

Log the coffee and tea you drink. cafflife estimates how much caffeine is in
your system right now from everything you've logged and when you drank it.

- **Now**: the current level in mg, whether it's still rising (and when it
  will peak) or falling, and today's total against the ~400 mg/day guidance
  for healthy adults.
- **Tonight**: a one-line summary under the big number (tap to expand) with
  your estimated level at bedtime and your **last call**, the latest you
  could have your usual drink and still be under your target at bedtime.
- **Chart**: 12 h, 1 day, 3 days or 1 week, with a forecast, a marker for each
  drink and a dashed line at each bedtime.
  Hover or drag along it to read the level at any time (arrow keys work too).
  Use ‹ / › (or scroll sideways on a trackpad, or Page Up / Page Down) to
  look back through earlier days.
- **Log a drink**: green tea, black tea, milk tea, pour-over, AeroPress, instant coffee,
  and single or double espresso. Each has a default dose that you can adjust
  before saving. Coffee has a half-caf toggle, and you can backdate a drink
  ("30 min ago" or any date and time).
- **History**: entries grouped by day, with how much of each drink is still
  in your system. Tap an entry to edit or delete it. Deletes can be undone.
- **Your own drinks**: the "+ Add drink" tile adds one with a name, an icon
  (mug, iced cup, can, bottle, energy drink, bowl, tea cup or small cup), its
  caffeine, an optional serving note and whether it's coffee (for half-caf).
  Edit or delete it from its log sheet or Settings. Deleting one your history
  uses only hides its tile, so past entries keep their name and icon.
- **Your usual amounts**: change the mg when logging and switch on "Make it my
  usual" to pre-fill that amount next time. Leave it off for a one-off.
- **Insights** tab: daily average, busiest day, nights under your bedtime
  target and typical first / last cup, plus charts of caffeine per day, at
  bedtime each night, and by drink, over 7 or 30 days.
- **Settings**: bedtime (default 10:30 PM) and bedtime target (default 50 mg),
  half-life (default 5 h), your drinks and usual amounts, and your data:
  - **Back up** saves everything (log, settings, your drinks) as one JSON
    file. **Restore** reads that file back and replaces everything, after
    asking. On a phone, saving opens the share sheet (e.g. Save to Files).
  - **Export CSV** saves the log for a spreadsheet, one row per drink. It's
    export-only: restore uses the JSON backup.
- **Installable**: on iPhone, Share → Add to Home Screen. On Android or desktop
  Chrome, use Install app. Once installed it also works offline.

## The model

Each drink is a one-compartment dose with first-order absorption and
elimination (the Bateman function):

```
A(t) = D · ka / (ka − ke) · (e^(−ke·t) − e^(−ka·t))
ke = ln 2 / half-life        (default half-life 5 h)
ka = 5 / h                   (absorption, so a drink peaks ~45 min after you drink it)
```

Doses add up. The code is in [src/domain/caffeine.ts](src/domain/caffeine.ts).
Half-life varies a lot between people (roughly 2–10 h): smoking shortens it,
and pregnancy, oral contraceptives and some medications lengthen it. That's
why it's a setting. Treat the numbers as an estimate, not a measurement.

Default doses are in [src/domain/drinks.ts](src/domain/drinks.ts):

| Drink | Default | Typical range | Assumes |
|---|---|---|---|
| Green tea | 30 mg | 20–45 mg | 8 oz cup |
| Black tea | 47 mg | 40–70 mg | 8 oz cup |
| Milk tea | 80 mg | 30–150 mg | 16 oz cup (varies a lot by shop) |
| Pour-over | 145 mg | 100–200 mg | 12 oz cup (~20 g coffee) |
| AeroPress | 110 mg | 80–150 mg | 15 g dose |
| Instant coffee | 60 mg | 30–90 mg | 8 oz cup |
| Espresso | 64 mg | 50–80 mg | single shot |
| Double espresso | 128 mg | 100–160 mg | double shot |

The log sheet shows the range next to the default, e.g. "typically 80 mg
(30–150)".

## Running

```sh
npm install
npm run dev
```

## Hosting & data

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) deploys the app to
GitHub Pages on every push to `main`. The site is static. Entries are stored in
your browser's `localStorage`, so each device keeps its own log and nothing is
sent to a server. A home-screen install on iOS keeps storage separate from
Safari's.

A small service worker ([public/sw.js](public/sw.js)) caches the app shell.
It only registers in production builds. Page loads try the network first, so
a new deploy appears on the next launch.

## License

[MIT](LICENSE)
