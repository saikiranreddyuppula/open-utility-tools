# @open-utility-tools/core

Framework-agnostic core logic extracted from [Open Utility Tools](https://github.com/saikiranreddyuppula/open-utility-tools) — the pure, dependency-free building blocks behind the web app. No React, no DOM, **zero runtime dependencies**.

> **Scope of v1.** This package ships the tool logic that already lives in framework-agnostic modules: text, math, color, data, time, web, generators, and WebCrypto helpers. The bulk of the app's tools compute *inline inside their React components*, and the Rust→WASM tier (hashing, image, PDF) is not included yet — both are tracked as follow-up phases (see the repo PR). This is not "every tool", and does not claim to be.

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

## Notes

- **Randomness.** `generators/lorem`, `fake`, and `gitignore` use `Math.random` (not cryptographically secure). `generators/ids`, `generators/password`, and everything in `crypto` use `globalThis.crypto` and are suitable for secrets.
- **ESM only.** The package ships ES modules with type declarations.

## License

[MIT](./LICENSE) © Sai Kiran Reddy Uppula
