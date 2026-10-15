# cafflife — caffeine tracker

Log the coffee and tea you drink. cafflife estimates how much caffeine is in
your system right now from everything you've logged and when you drank it.

- **Now**: the current level in mg, whether it's still rising (and when it
  will peak) or falling, and today's total against the ~400 mg/day guidance
  for healthy adults.
- **Chart**: the last 24 h plus a 12 h forecast, with a marker for each drink.
  Hover or drag along it to read the level at any time (arrow keys work too).
- **Log a drink**: green tea, black tea, pour-over, AeroPress, and single or
  double espresso. Each has a default dose that you can adjust before saving.
  Coffee has a half-caf toggle, and you can backdate a drink ("30 min ago" or
  any date and time).
- **History**: entries grouped by day, with how much of each drink is still
  in your system. Tap an entry to edit or delete it. Deletes can be undone.
- **Settings**: your half-life (default 5 h).
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

| Drink | Default | Assumes |
|---|---|---|
| Green tea | 30 mg | 8 oz cup |
| Black tea | 47 mg | 8 oz cup |
| Pour-over | 145 mg | 12 oz cup (~20 g coffee) |
| AeroPress | 110 mg | 15 g dose |
| Espresso | 64 mg | single shot |
| Double espresso | 128 mg | double shot |

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
