# @open-utility-tools/core

Framework-agnostic core logic extracted from [Open Utility Tools](https://github.com/saikiranreddyuppula/open-utility-tools) — the pure, dependency-free building blocks behind the web app. No React, no DOM, **zero runtime dependencies**.

> **Scope.** Every function here is **isomorphic** — it runs identically in the browser, Node ≥ 20, and Bun. Pure-TS tiers (text, math, color, data, time, web, generators, WebCrypto) are plain modules; raster image tools are **WASM-backed** by the bundled `imaging` crate and work the same in all three runtimes. This is being built out tool-by-tool from the app's ~1,000 tools. **Landed:** the pure tiers, the WASM image tools, and the full **time** category (63 tools, each with a golden test suite). The rest are extracted category-by-category via the same pipeline.

## Per-tool subpaths

Every tool is importable on its own subpath — pull in exactly one:

```ts
import { calculateAge }     from '@open-utility-tools/core/time/age-calculator';
import { addBusinessDays }  from '@open-utility-tools/core/time/add-business-days';
import { parseCron }        from '@open-utility-tools/core/time/cron-parser';
import { convert }          from '@open-utility-tools/core/image/convert';
```

## Install

```sh
npm install @open-utility-tools/core
```

Requires **Node ≥ 20** (the `crypto` and `generators` entries use the global WebCrypto API).

## Usage

Import a domain via its subpath (recommended — keeps bundles small):

```ts
import { cases, diffLines } from '@open-utility-tools/core/text';
import { convertUnit, evaluateExpression } from '@open-utility-tools/core/math';
import { parseColor, contrastRatio } from '@open-utility-tools/core/color';
import { csvToJson, jsonToYaml } from '@open-utility-tools/core/data';
import { parseCron, nextRuns } from '@open-utility-tools/core/time';
import { HTTP_STATUSES, MIME_TYPES } from '@open-utility-tools/core/web';
import { uuidV7, generatePassword } from '@open-utility-tools/core/generators';
import { signJwt, hotp } from '@open-utility-tools/core/crypto';
```

Or grab everything as namespaces from the root entry:

```ts
import { text, math, color } from '@open-utility-tools/core';
text.cases.kebab('Hello World'); // "hello-world"
```

## Subpath exports

| Import | Contents |
| --- | --- |
| `…/text` | case conversion, line diff, line ops, markdown→html, morse |
| `…/math` | safe expression eval, gcd/lcm/primes/stats, roman numerals, unit conversion |
| `…/color` | hex/rgb/hsl/hsv/cmyk/oklch conversion, luminance, WCAG contrast |
| `…/data` | CSV ↔ JSON, JSON → TypeScript, YAML ↔ JSON |
| `…/time` | 5-field cron parse / explain / next-runs |
| `…/web` | HTTP status code + MIME type reference tables |
| `…/generators` | lorem ipsum, fake records, .gitignore templates, UUID/ULID/nanoid, passwords |
| `…/crypto` | JWT signing, HOTP, base32 decode, base64url (WebCrypto) |
| `…/image` | WASM-backed raster `convert` + `probe` (browser/Node/Bun) |
| `…/time/*` | 63 date/time tools, each on its own subpath (age, durations, cron, ISO-8601, timezones, …) |

## Notes

- **Randomness.** `generators/lorem`, `fake`, and `gitignore` use `Math.random` (not cryptographically secure). `generators/ids`, `generators/password`, and everything in `crypto` use `globalThis.crypto` and are suitable for secrets.
- **ESM only.** The package ships ES modules with type declarations.

## License

[MIT](./LICENSE) © Sai Kiran Reddy Uppula
