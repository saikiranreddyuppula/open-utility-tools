# Built Tools

Auto-generated from the live registry (`bun run scripts/gen-tools-doc.ts`). **103 tools** across 12 categories — 11 use Rust/WASM. All run 100% client-side.

| Category | Count |
|---|---|
| Image | 4 |
| PDF | 4 |
| Data | 10 |
| Converters | 5 |
| Text | 20 |
| Crypto & Hash | 6 |
| Encoding | 8 |
| Generators | 9 |
| Web & Dev | 15 |
| Time & Date | 5 |
| Math & Units | 9 |
| Color | 8 |
| **Total** | **103** |


## Image (4)

- **Image Converter** 🦀 — `/tools/image-converter` — Convert images between PNG, JPEG, WebP, GIF, BMP, TIFF and ICO — resize, set quality, batch & zip. All in your browser.
- **Image to Base64** — `/tools/image-to-base64` — Encode an image to a Base64 data-URI for inline use in CSS/HTML/JSON.
- **Placeholder Image Generator** — `/tools/placeholder-image` — Generate a sized SVG/data-URI placeholder with custom colors and label.
- **SVG to Data URI** — `/tools/svg-to-data-uri` — Convert raw SVG markup into an optimized data-URI for CSS/HTML.

## PDF (4)

- **Merge PDF** 🦀 — `/tools/merge-pdf` — Combine multiple PDFs into one, reorder by drag — entirely in your browser.
- **PDF Info & Metadata** 🦀 — `/tools/pdf-metadata` — Inspect a PDF’s page count, version, and document metadata.
- **Rotate PDF** 🦀 — `/tools/rotate-pdf` — Rotate all or selected pages of a PDF by 90, 180 or 270 degrees.
- **Split / Extract PDF Pages** 🦀 — `/tools/split-pdf` — Extract or delete a selection of pages from a PDF (e.g. 1,3,5-8).

## Data (10)

- **CSV to JSON** — `/tools/csv-to-json` — Convert CSV (with header row) into a JSON array of objects.
- **CSV Viewer** — `/tools/csv-viewer` — Paste CSV and view it as a sortable, searchable table.
- **JSON Diff** — `/tools/json-diff` — Compare two JSON documents (normalized & sorted) and see the changes.
- **JSON Formatter** — `/tools/json-formatter` — Pretty-print, minify, and validate JSON with configurable indentation.
- **JSON Minify** — `/tools/json-minify` — Strip whitespace from JSON to produce the smallest valid output.
- **JSON Sort Keys** — `/tools/json-sort-keys` — Recursively sort all object keys in a JSON document alphabetically.
- **JSON String Escape / Unescape** — `/tools/json-escape` — Escape text into a JSON string literal, or unescape one back to raw text.
- **JSON to CSV** — `/tools/json-to-csv` — Convert a JSON array of objects into CSV, with a chosen delimiter.
- **JSON to TypeScript** — `/tools/json-to-typescript` — Infer TypeScript interfaces from a JSON sample.
- **SQL Formatter** — `/tools/sql-formatter` — Format and indent SQL queries with keyword casing.

## Converters (5)

- **CSV to Markdown Table** — `/tools/csv-to-markdown` — Convert CSV into a GitHub-flavored Markdown table.
- **JSON to Go Struct** — `/tools/json-to-go` — Infer Go structs (with json tags) from a JSON sample.
- **JSON to XML** — `/tools/json-to-xml` — Convert JSON into XML markup with proper escaping.
- **JSON to YAML** — `/tools/json-to-yaml` — Convert JSON into readable YAML.
- **YAML to JSON** — `/tools/yaml-to-json` — Convert common YAML configuration into JSON.

## Text (20)

- **ASCII Table** — `/tools/ascii-table` — A searchable reference of ASCII codes in decimal, hex, octal and binary.
- **Case Converter** — `/tools/case-converter` — Convert text between camelCase, snake_case, kebab-case, Title Case and more.
- **Count Occurrences** — `/tools/count-occurrences` — Count how many times a substring or regex pattern appears in text.
- **Fancy Text Generator** — `/tools/fancy-text` — Turn text into 𝐛𝐨𝐥𝐝, 𝑖𝑡𝑎𝑙𝑖𝑐, 𝚖𝚘𝚗𝚘 and other Unicode styles.
- **Find & Replace** — `/tools/find-replace` — Find and replace text with plain or regular-expression matching.
- **Line Operations** — `/tools/line-operations` — Number, prefix, suffix, or wrap each line of text.
- **Lorem Ipsum Generator** — `/tools/lorem-ipsum` — Generate placeholder lorem ipsum text by paragraphs, sentences, or words.
- **Morse Code Translator** — `/tools/morse-code` — Translate text to International Morse code and back.
- **NATO Phonetic Alphabet** — `/tools/nato-phonetic` — Spell text using the NATO phonetic alphabet (Alpha, Bravo, Charlie…).
- **Regex Tester** — `/tools/regex-tester` — Test JavaScript regular expressions live with match highlighting and groups.
- **Remove Duplicate Lines** — `/tools/remove-duplicates` — Strip duplicate lines, keeping first occurrence, with optional case-insensitivity.
- **Reverse Text** — `/tools/reverse-text` — Reverse characters, words, or line order in text.
- **ROT13 / Caesar Cipher** — `/tools/rot13` — Apply ROT13 or a Caesar shift cipher to text (reversible).
- **Slugify** — `/tools/slugify` — Turn any text into a clean, URL-safe slug.
- **Sort & Dedupe Lines** — `/tools/sort-lines` — Sort lines alphabetically, numerically, by length, reverse or shuffle — and dedupe.
- **Text Diff** — `/tools/text-diff` — Compare two texts line-by-line and highlight additions and removals.
- **Text Statistics & Frequency** — `/tools/text-statistics` — Analyze word frequency, character distribution and readability of text.
- **Unicode Inspector** — `/tools/unicode-inspector` — Break text into code points with hex, decimal, UTF-8 bytes and names.
- **Whitespace Cleaner** — `/tools/whitespace-cleaner` — Trim lines, collapse spaces, strip blank lines, and normalize whitespace.
- **Word & Character Count** — `/tools/word-count` — Live counts of words, characters, sentences, lines, and reading time.

## Crypto & Hash (6)

- **Bcrypt Hash & Verify** 🦀 — `/tools/bcrypt` — Hash a password with bcrypt and verify a password against a hash, locally.
- **Hash Text** 🦀 — `/tools/hash-text` — Compute MD5, SHA-1, SHA-256/384/512, SHA-3, BLAKE3 and CRC32 digests of text — live, in your browser.
- **HMAC Generator** 🦀 — `/tools/hmac-generator` — Compute HMAC (SHA-1/256/384/512) of a message with a secret key.
- **JWT Generator** — `/tools/jwt-generator` — Create a signed HS256/384/512 JSON Web Token from a payload and secret.
- **Password Generator** — `/tools/password-generator` — Generate strong random passwords or diceware passphrases, locally.
- **TOTP / 2FA Code Generator** — `/tools/totp-generator` — Generate time-based one-time passwords (TOTP) from a Base32 secret.

## Encoding (8)

- **Ascii85 / Base85 Encode** — `/tools/ascii85` — Encode and decode text using Ascii85 (Adobe variant).
- **Base32 Encode / Decode** 🦀 — `/tools/base32-text` — Encode text to RFC 4648 Base32 and decode it back.
- **Base58 Encode / Decode** — `/tools/base58` — Encode bytes/text to Base58 (Bitcoin alphabet) and decode it back.
- **Base64 Encode / Decode** 🦀 — `/tools/base64-text` — Encode text to Base64 (standard or URL-safe) and decode it back — live.
- **Hex Encode / Decode** 🦀 — `/tools/hex-text` — Convert text to hexadecimal and back, with optional uppercase.
- **HTML Entity Encode / Decode** — `/tools/html-entities` — Escape text to HTML entities and unescape entities back to text.
- **Text to Binary** — `/tools/binary-text` — Convert text to its binary (and back), with a configurable separator.
- **URL Encode / Decode** — `/tools/url-encode` — Percent-encode and decode text or whole-component URL strings.

## Generators (9)

- **.gitignore Generator** — `/tools/gitignore-generator` — Assemble a .gitignore from common language and tool templates.
- **Dice & Coin Roller** — `/tools/dice-roller` — Roll dice (d4–d100, multiple dice) and flip coins with fair randomness.
- **Mock Data Generator** — `/tools/mock-data` — Generate an array of realistic fake records (names, emails, dates) as JSON.
- **Nano ID Generator** — `/tools/nanoid-generator` — Generate compact, URL-safe Nano IDs with a configurable length.
- **Passphrase Generator** — `/tools/passphrase-generator` — Generate memorable multi-word passphrases (diceware-style) locally.
- **Random String Generator** — `/tools/random-string` — Generate random strings from a chosen alphabet (hex, alphanumeric, custom).
- **robots.txt Generator** — `/tools/robots-txt` — Build a robots.txt with allow/disallow rules and a sitemap line.
- **ULID Generator** — `/tools/ulid-generator` — Generate lexicographically-sortable ULIDs in bulk, locally.
- **UUID Generator** — `/tools/uuid-generator` — Generate RFC 4122 v4 (random) and v7 (time-ordered) UUIDs in bulk.

## Web & Dev (15)

- **Basic Auth Generator** — `/tools/basic-auth-generator` — Build an HTTP Basic Authorization header from a username and password.
- **Chmod Calculator** — `/tools/chmod-calculator` — Toggle Unix permission bits and get the octal + symbolic chmod value.
- **Cookie Parser** — `/tools/cookie-parser` — Parse a Cookie or Set-Cookie header into a readable table of attributes.
- **CSS Minify / Beautify** — `/tools/css-minify` — Minify CSS to one line or beautify it with consistent indentation.
- **Email Obfuscator** — `/tools/email-obfuscator` — Obfuscate an email address (entities / JS) to deter scrapers.
- **HTML to Text** — `/tools/html-to-text` — Strip HTML tags and decode entities to get clean plain text.
- **HTTP Status Codes** — `/tools/http-status-codes` — Searchable reference of HTTP status codes and their meanings.
- **IPv4 Subnet Calculator** — `/tools/ip-subnet-calculator` — Compute network, broadcast, mask, host range and count from CIDR.
- **JWT Decoder** — `/tools/jwt-decoder` — Decode and inspect JSON Web Token header & payload (no verification).
- **Markdown to HTML** — `/tools/markdown-to-html` — Render Markdown to HTML with a live preview and copyable output.
- **MIME Type Lookup** — `/tools/mime-types` — Look up the MIME/content type for a file extension and vice versa.
- **PX ↔ REM Converter** — `/tools/px-rem-converter` — Convert between px, rem and em given a configurable root font size.
- **Query String ↔ JSON** — `/tools/query-params` — Convert a URL query string to JSON and back, handling repeated keys.
- **URL Parser** — `/tools/url-parser` — Break a URL into protocol, host, path, query parameters and hash.
- **User-Agent Parser** — `/tools/user-agent-parser` — Parse a User-Agent string into browser, engine, OS and device.

## Time & Date (5)

- **Cron Expression Explainer** — `/tools/cron-parser` — Explain a cron expression in plain English and preview the next run times.
- **Date Difference** — `/tools/date-difference` — Calculate the duration between two dates in years, days, hours and more.
- **ISO Week Number** — `/tools/week-number` — Find the ISO 8601 week number for any date (and day-of-year).
- **Timezone Converter** — `/tools/timezone-converter` — Convert a date/time across timezones using the browser’s IANA database.
- **Unix Timestamp Converter** — `/tools/timestamp-converter` — Convert between Unix timestamps and human-readable dates (local & UTC).

## Math & Units (9)

- **Bitwise Calculator** — `/tools/bitwise-calculator` — Perform AND, OR, XOR, NOT and shifts on two integers, shown in all bases.
- **GCD & LCM Calculator** — `/tools/gcd-lcm` — Find the greatest common divisor and least common multiple of numbers.
- **Number Base Converter** — `/tools/number-base-converter` — Convert numbers between binary, octal, decimal, hex and arbitrary bases.
- **Percentage Calculator** — `/tools/percentage-calculator` — Work out percentages, percentage change, and what-percent-of calculations.
- **Prime Checker & Factorizer** — `/tools/prime-checker` — Check whether a number is prime and view its prime factorization.
- **Roman Numeral Converter** — `/tools/roman-numerals` — Convert between Roman numerals and integers (1–3999).
- **Scientific Calculator** — `/tools/expression-calculator` — Evaluate math expressions with functions, constants and operators.
- **Statistics Calculator** — `/tools/statistics` — Compute mean, median, range, variance and standard deviation of a data set.
- **Unit Converter** — `/tools/unit-converter` — Convert length, mass, temperature, area, volume, speed and data sizes.

## Color (8)

- **Color Blindness Simulator** — `/tools/color-blindness` — Preview how a color appears under common color-vision deficiencies.
- **Color Converter** — `/tools/color-converter` — Convert colors between HEX, RGB, HSL, HSV, CMYK and OKLCH, with a live preview.
- **Color Picker** — `/tools/color-picker` — Pick a color visually and read its HEX, RGB, HSL and OKLCH values.
- **Contrast Checker** — `/tools/contrast-checker` — Check WCAG contrast ratio between two colors and AA/AAA pass/fail.
- **CSS Gradient Generator** — `/tools/gradient-generator` — Build linear, radial and conic CSS gradients with a live preview.
- **CSS Named Colors** — `/tools/named-colors` — Browse and search all CSS named colors with their HEX/RGB values.
- **Random Color Generator** — `/tools/random-color` — Generate random colors with copyable HEX/RGB/HSL values.
- **Tints & Shades Generator** — `/tools/color-shades` — Generate a tint/shade ramp from a base color, with copyable values.


🦀 = uses Rust→WASM (runs in a Web Worker).
