# Built Tools

Auto-generated from the live registry (`bun run scripts/gen-tools-doc.ts`). **281 tools** across 12 categories — 11 use Rust/WASM. All run 100% client-side.

| Category | Count |
|---|---|
| Image | 4 |
| PDF | 4 |
| Data | 30 |
| Converters | 19 |
| Text | 45 |
| Crypto & Hash | 18 |
| Encoding | 24 |
| Generators | 29 |
| Web & Dev | 41 |
| Time & Date | 18 |
| Math & Units | 27 |
| Color | 22 |
| **Total** | **281** |


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

## Data (30)

- **CSV Column Selector** — `/tools/csv-column-selector` — Keep, drop, or reorder CSV columns by header name or index.
- **CSV Deduplicate Rows** — `/tools/csv-dedupe` — Remove duplicate rows from CSV, either fully identical or matching on selected key columns.
- **CSV Delimiter Converter** — `/tools/csv-delimiter-converter` — Re-delimit tabular data between comma, tab, semicolon, or pipe while preserving quoting.
- **CSV Sorter** — `/tools/csv-sort` — Sort CSV rows by a chosen column with numeric/text mode and ascending or descending order.
- **CSV to HTML Table** — `/tools/csv-to-html` — Convert CSV into a clean HTML table element with a header row, ready to paste into a page.
- **CSV to JSON** — `/tools/csv-to-json` — Convert CSV (with header row) into a JSON array of objects.
- **CSV to SQL INSERT** — `/tools/csv-to-sql` — Generate SQL INSERT statements from CSV with a configurable table name and quoting.
- **CSV Viewer** — `/tools/csv-viewer` — Paste CSV and view it as a sortable, searchable table.
- **JSON Diff** — `/tools/json-diff` — Compare two JSON documents (normalized & sorted) and see the changes.
- **JSON Flatten / Unflatten** — `/tools/json-flatten` — Flatten nested JSON into dot-notation keys or rebuild nested objects from flattened keys.
- **JSON Formatter** — `/tools/json-formatter` — Pretty-print, minify, and validate JSON with configurable indentation.
- **JSON Key Extractor** — `/tools/json-extract-keys` — List every unique key path in a JSON document, optionally with the inferred type of each.
- **JSON Merge** — `/tools/json-merge` — Deep-merge two JSON objects, with options for how arrays and conflicting keys are combined.
- **JSON Minify** — `/tools/json-minify` — Strip whitespace from JSON to produce the smallest valid output.
- **JSON Path Extractor** — `/tools/json-path-extractor` — Pull values out of JSON with a dot/bracket path like data.items[0].name.
- **JSON Repair** — `/tools/json-repair` — Fix broken JSON with single quotes, trailing commas, unquoted keys, and comments, then output valid JSON.
- **JSON Schema Generator** — `/tools/json-to-json-schema` — Infer a JSON Schema (draft-07) from a sample JSON document with types and required fields.
- **JSON Sort Keys** — `/tools/json-sort-keys` — Recursively sort all object keys in a JSON document alphabetically.
- **JSON String Escape / Unescape** — `/tools/json-escape` — Escape text into a JSON string literal, or unescape one back to raw text.
- **JSON Stringify / Parse** — `/tools/json-stringify` — Turn raw text into an escaped JSON string literal, or parse a JSON string back to its raw value.
- **JSON to CSV** — `/tools/json-to-csv` — Convert a JSON array of objects into CSV, with a chosen delimiter.
- **JSON to Markdown Table** — `/tools/json-to-markdown-table` — Render an array of JSON objects as a GitHub-flavored Markdown table.
- **JSON to NDJSON / JSON Lines** — `/tools/json-to-ndjson` — Convert between a JSON array and newline-delimited JSON (NDJSON / JSON Lines).
- **JSON to Query String** — `/tools/json-to-query-string` — Convert a flat JSON object into a URL query string, with array and encoding options.
- **JSON to TOML** — `/tools/json-to-toml` — Convert JSON into TOML config format with tables, arrays, and typed scalars.
- **JSON to TypeScript** — `/tools/json-to-typescript` — Infer TypeScript interfaces from a JSON sample.
- **JSON Tree Viewer** — `/tools/json-tree-viewer` — Explore JSON as a collapsible tree with type badges and value counts for large documents.
- **JSON Validator** — `/tools/json-validator` — Validate JSON and pinpoint the exact line, column, and reason for any syntax error.
- **JSONC / JSON5 to JSON** — `/tools/jsonc-to-json` — Strip comments and trailing commas from JSONC or JSON5 to produce strict, valid JSON.
- **SQL Formatter** — `/tools/sql-formatter` — Format and indent SQL queries with keyword casing.

## Converters (19)

- **CSV to Markdown Table** — `/tools/csv-to-markdown` — Convert CSV into a GitHub-flavored Markdown table.
- **CSV to TSV** — `/tools/csv-to-tsv` — Convert between comma-separated and tab-separated values with proper quote handling, in either direction, ready to paste into a spreadsheet.
- **Data Size Converter** — `/tools/data-size-converter` — Convert digital storage between bits, bytes, KB/MB/GB/TB and KiB/MiB/GiB, clearly separating decimal SI and binary IEC units.
- **HTML to Markdown** — `/tools/html-to-markdown` — Convert HTML into clean Markdown, mapping headings, links, images, lists, blockquotes, code, and emphasis back to plain Markdown syntax.
- **JS Object to JSON** — `/tools/js-object-to-json` — Convert a relaxed JavaScript object literal (unquoted keys, single quotes, trailing commas, comments) into strict, valid JSON.
- **JSON to Go Struct** — `/tools/json-to-go` — Infer Go structs (with json tags) from a JSON sample.
- **JSON to XML** — `/tools/json-to-xml` — Convert JSON into XML markup with proper escaping.
- **JSON to YAML** — `/tools/json-to-yaml` — Convert JSON into readable YAML.
- **Length and Distance Converter** — `/tools/length-converter` — Convert between metric and imperial lengths such as mm, cm, m, km, inch, foot, yard, mile, and nautical mile with live multi-unit output.
- **Markdown Table to CSV** — `/tools/markdown-table-to-csv` — Extract a GitHub-style Markdown table and convert its rows into CSV, handling pipe escaping, alignment separators, and trimmed cells.
- **Number to Words** — `/tools/number-to-words` — Spell out numbers as English words including negatives, decimals, and large magnitudes, with an optional currency cents mode.
- **Query String to JSON** — `/tools/query-string-to-json` — Parse a URL query string into structured JSON, decoding values, grouping repeated keys into arrays, and rebuilding bracketed nesting.
- **Temperature Converter** — `/tools/temperature-converter` — Convert temperatures across Celsius, Fahrenheit, Kelvin, and Rankine with live results and adjustable rounding precision.
- **TOML to JSON** — `/tools/toml-to-json` — Turn TOML config files into JSON. Supports tables, arrays of tables, inline tables, datetimes, and typed values, parsed locally without uploads.
- **TSV to JSON** — `/tools/tsv-to-json` — Paste tab-separated data copied from a spreadsheet and convert it to JSON, with header-row detection and numeric or boolean coercion options.
- **Unicode Code Point Converter** — `/tools/unicode-code-point-converter` — Convert text to and from Unicode code points, showing U+ notation, decimal, and hex escapes with surrogate-pair-safe handling.
- **XML to JSON** — `/tools/xml-to-json` — Parse XML into a clean JSON tree with options for attribute prefixes, text-node naming, and array coercion for repeated elements.
- **YAML to JSON** — `/tools/yaml-to-json` — Convert common YAML configuration into JSON.
- **YAML to TOML** — `/tools/yaml-to-toml` — Convert YAML configuration directly into TOML, mapping nested maps and lists into tables and arrays of tables in one step.

## Text (45)

- **ASCII Table** — `/tools/ascii-table` — A searchable reference of ASCII codes in decimal, hex, octal and binary.
- **Bold & Italic Unicode Text** — `/tools/unicode-bold-italic` — Convert plain text into Unicode bold, italic, bold-italic, script, monospace, or double-struck styles that work in posts and bios.
- **Caesar Cipher** — `/tools/caesar-cipher` — Encode or decode text with a Caesar cipher of any shift amount, the classic reversible letter rotation, with optional brute-force of all 25 shifts.
- **Case Converter** — `/tools/case-converter` — Convert text between camelCase, snake_case, kebab-case, Title Case and more.
- **Count Occurrences** — `/tools/count-occurrences` — Count how many times a substring or regex pattern appears in text.
- **Delimited Text Converter** — `/tools/delimiter-converter` — Convert delimited text between comma, tab, pipe, semicolon, newline, and custom delimiters, ideal for reshaping CSV-style lists.
- **Extract Emails, URLs & Numbers** — `/tools/extract-data` — Pull all email addresses, URLs, phone numbers, IPs, or numbers out of a blob of text into a clean deduplicated list.
- **Fancy Text Generator** — `/tools/fancy-text` — Turn text into 𝐛𝐨𝐥𝐝, 𝑖𝑡𝑎𝑙𝑖𝑐, 𝚖𝚘𝚗𝚘 and other Unicode styles.
- **Find & Replace** — `/tools/find-replace` — Find and replace text with plain or regular-expression matching.
- **Indent & Dedent Text** — `/tools/indent-text` — Add or remove leading indentation on every line, converting tabs to spaces or spaces to tabs with a configurable width.
- **Leetspeak Converter** — `/tools/leetspeak` — Convert text to and from leetspeak (1337), swapping letters for numbers and symbols at adjustable intensity.
- **Line Operations** — `/tools/line-operations` — Number, prefix, suffix, or wrap each line of text.
- **List Formatter** — `/tools/list-formatter` — Convert a plain list into bulleted, numbered, lettered, or roman-numeral lists with custom markers and indentation.
- **Lorem Ipsum Generator** — `/tools/lorem-ipsum` — Generate placeholder lorem ipsum text by paragraphs, sentences, or words.
- **Morse Code Translator** — `/tools/morse-code` — Translate text to International Morse code and back.
- **NATO Phonetic Alphabet** — `/tools/nato-phonetic` — Spell text using the NATO phonetic alphabet (Alpha, Bravo, Charlie…).
- **Number Each Line** — `/tools/number-lines` — Generate a sequence and prefix lines with auto-incrementing numbers using a start value, step, and zero-padding.
- **Pig Latin Translator** — `/tools/pig-latin` — Translate English text to or from Pig Latin, moving leading consonants and appending the classic -ay ending.
- **Prefix & Suffix Lines** — `/tools/prefix-suffix-lines` — Add a prefix and/or suffix to every line at once, ideal for wrapping list items in quotes, commas, brackets, or markup.
- **Random Line Picker** — `/tools/random-line-picker` — Pick one or more random lines from a list, great for raffles, choosing a winner, or sampling, with optional no-repeat draws.
- **Regex Tester** — `/tools/regex-tester` — Test JavaScript regular expressions live with match highlighting and groups.
- **Remove Accents** — `/tools/remove-accents` — Strip diacritics and accents from text, converting characters like e-acute, n-tilde, and u-umlaut to plain ASCII equivalents.
- **Remove Duplicate Lines** — `/tools/remove-duplicates` — Strip duplicate lines, keeping first occurrence, with optional case-insensitivity.
- **Remove Line Breaks** — `/tools/remove-line-breaks` — Strip or normalize line breaks, joining wrapped lines into one with spaces, collapsing multiple blank lines, or converting paragraphs to single lines.
- **Reverse Text** — `/tools/reverse-text` — Reverse characters, words, or line order in text.
- **ROT13 / Caesar Cipher** — `/tools/rot13` — Apply ROT13 or a Caesar shift cipher to text (reversible).
- **ROT47 Cipher** — `/tools/rot47` — Encode or decode text with ROT47, rotating all visible ASCII characters by 47 positions for a reversible obfuscation.
- **Shuffle Lines** — `/tools/shuffle-lines` — Randomly shuffle the order of lines, with an option to pick a random subset or a single random line.
- **Slugify** — `/tools/slugify` — Turn any text into a clean, URL-safe slug.
- **Smart Quotes Converter** — `/tools/smart-quotes` — Convert straight quotes and apostrophes into typographic curly quotes, or convert curly quotes back to plain ASCII straight quotes.
- **Sort & Dedupe Lines** — `/tools/sort-lines` — Sort lines alphabetically, numerically, by length, reverse or shuffle — and dedupe.
- **Strikethrough & Underline Text** — `/tools/unicode-text-decorate` — Add Unicode combining strikethrough, underline, or slashed-zero style effects to plain text so it stays styled when pasted anywhere.
- **Text Alignment & Padding** — `/tools/text-align-pad` — Pad or align each line to a fixed width, left, right, or centered, with a chosen fill character for tidy fixed-width columns.
- **Text Diff** — `/tools/text-diff` — Compare two texts line-by-line and highlight additions and removals.
- **Text Repeater** — `/tools/text-repeater` — Repeat a piece of text a chosen number of times, separated by newlines, spaces, or a custom delimiter.
- **Text Statistics & Frequency** — `/tools/text-statistics` — Analyze word frequency, character distribution and readability of text.
- **Text Truncator** — `/tools/text-truncator` — Truncate text or each line to a maximum length by characters or words, appending an ellipsis or custom suffix.
- **Text Wrapper** — `/tools/text-wrap` — Hard-wrap text to a fixed column width, breaking on word boundaries, with optional hanging indent and break-long-word handling.
- **Title Case Converter** — `/tools/title-case` — Apply proper headline title case following style rules that keep small words like a, an, and, the lowercase except as the first or last word.
- **Unicode Inspector** — `/tools/unicode-inspector` — Break text into code points with hex, decimal, UTF-8 bytes and names.
- **Vaporwave Aesthetic Text** — `/tools/fullwidth-text` — Convert text to full-width vaporwave letters where each character is spaced out, perfect for aesthetic social media posts.
- **Whitespace Cleaner** — `/tools/whitespace-cleaner` — Trim lines, collapse spaces, strip blank lines, and normalize whitespace.
- **Word & Character Count** — `/tools/word-count` — Live counts of words, characters, sentences, lines, and reading time.
- **Word Frequency Counter** — `/tools/word-frequency` — Count how often each word appears and rank them by frequency, with options to ignore case and skip common stop words.
- **Zalgo Glitch Text** — `/tools/zalgo-text` — Add creepy combining diacritics to text to create the glitchy Zalgo effect with adjustable intensity, or clean the marks back out.

## Crypto & Hash (18)

- **AES Encrypt / Decrypt** — `/tools/aes-encrypt-decrypt` — Encrypt and decrypt text with AES-GCM using a passphrase, producing self-contained Base64 output with embedded salt and IV.
- **Bcrypt Hash & Verify** 🦀 — `/tools/bcrypt` — Hash a password with bcrypt and verify a password against a hash, locally.
- **BIP39 Mnemonic Generator** — `/tools/bip39-mnemonic-generator` — Generate BIP39 seed phrases of 12, 15, 18, 21, or 24 words with a valid checksum for crypto wallet backups.
- **CRC32 Checksum** — `/tools/crc32-checksum` — Compute the CRC-32 checksum of any text, output as hex or unsigned decimal for quick integrity checks.
- **ECDSA Key Pair Generator** — `/tools/ecdsa-keypair-generator` — Generate an elliptic-curve (P-256/P-384/P-521) key pair as PEM for ECDSA signing.
- **File Hash** — `/tools/file-hash` — Hash any local file with MD5, SHA-1, SHA-256, or SHA-512 by dropping it in, with a field to compare against an expected checksum.
- **Hash Text** 🦀 — `/tools/hash-text` — Compute MD5, SHA-1, SHA-256/384/512, SHA-3, BLAKE3 and CRC32 digests of text — live, in your browser.
- **HMAC Generator** 🦀 — `/tools/hmac-generator` — Compute HMAC (SHA-1/256/384/512) of a message with a secret key.
- **JWT Generator** — `/tools/jwt-generator` — Create a signed HS256/384/512 JSON Web Token from a payload and secret.
- **JWT Signature Verifier (HS256)** — `/tools/jwt-verify-hmac` — Verify an HMAC-signed JWT (HS256/384/512) against a secret and report whether the signature and expiry are valid.
- **MD5 Hash Generator** — `/tools/md5-hash` — Generate the MD5 hash of any text, with lowercase or uppercase hex output (the algorithm Web Crypto omits).
- **Password Generator** — `/tools/password-generator` — Generate strong random passwords or diceware passphrases, locally.
- **Random Bytes Generator** — `/tools/random-bytes-generator` — Generate cryptographically secure random bytes as hex, Base64, Base64URL, or a C-style byte array of a chosen length.
- **ROT47 Encoder** — `/tools/rot47-encoder` — Encode or decode text with ROT47, the printable-ASCII rotation cipher (its own inverse).
- **RSA Key Pair Generator** — `/tools/rsa-keypair-generator` — Generate an RSA public/private key pair in PEM format with selectable key size (2048/3072/4096) and hash.
- **TOTP / 2FA Code Generator** — `/tools/totp-generator` — Generate time-based one-time passwords (TOTP) from a Base32 secret.
- **Vigenere Cipher** — `/tools/vigenere-cipher` — Encrypt or decrypt text with the classic Vigenere keyword cipher.
- **XOR Cipher** — `/tools/xor-cipher` — Encrypt or decrypt text with a repeating-key XOR, output as hex or Base64 and back.

## Encoding (24)

- **ASCII / Code Point Converter** — `/tools/encoding-ascii-code-point` — Convert text to ASCII/Unicode code point numbers and convert numeric lists back to text.
- **Ascii85 / Base85 Encode** — `/tools/ascii85` — Encode and decode text using Ascii85 (Adobe variant).
- **Atbash Cipher** — `/tools/encoding-atbash-cipher` — Encode or decode text with the Atbash cipher, mirroring each letter to its opposite in the alphabet.
- **Base32 Encode / Decode** 🦀 — `/tools/base32-text` — Encode text to RFC 4648 Base32 and decode it back.
- **Base45 Encode / Decode** — `/tools/encoding-base45` — Encode text to RFC 9285 Base45 or decode Base45 back to text, as used in QR-code data payloads.
- **Base58 Encode / Decode** — `/tools/base58` — Encode bytes/text to Base58 (Bitcoin alphabet) and decode it back.
- **Base64 Encode / Decode** 🦀 — `/tools/base64-text` — Encode text to Base64 (standard or URL-safe) and decode it back — live.
- **Base64 Image / Data URI Builder** — `/tools/encoding-data-uri-builder` — Wrap Base64 content into a data: URI with a chosen MIME type, or extract the MIME and decoded payload from an existing data URI.
- **Base64 to Hex Converter** — `/tools/encoding-base64-to-hex` — Convert between Base64-encoded data and its hexadecimal byte representation in both directions.
- **Base64 URL-Safe Encode / Decode** — `/tools/encoding-base64url` — Encode or decode text using the URL-safe Base64 alphabet with optional padding for tokens and URLs.
- **Caesar Cipher Shift** — `/tools/encoding-caesar-cipher` — Encode or decode text with a configurable Caesar shift, rotating letters by any amount while preserving case and symbols.
- **Gzip Base64 Compress / Decompress** — `/tools/encoding-gzip-base64` — Compress text with gzip and output Base64, or decode Base64 gzip back to the original text.
- **Hex Encode / Decode** 🦀 — `/tools/hex-text` — Convert text to hexadecimal and back, with optional uppercase.
- **HTML Entity Encode / Decode** — `/tools/html-entities` — Escape text to HTML entities and unescape entities back to text.
- **JWT Decoder & Inspector** — `/tools/encoding-jwt-inspector` — Decode a JSON Web Token into its readable header and payload claims, with human-friendly timestamps for exp/iat/nbf.
- **Numeric HTML Character References** — `/tools/encoding-numeric-char-references` — Convert text into numeric HTML character references (decimal or hex) and decode them back to plain text.
- **Octal Encode / Decode** — `/tools/encoding-octal-text` — Encode UTF-8 text to space-separated octal byte values or decode octal numbers back into readable text.
- **Punycode Encode / Decode** — `/tools/encoding-punycode` — Convert internationalized domain names to ASCII Punycode (xn--) and back to their Unicode form.
- **Quoted-Printable Encode / Decode** — `/tools/encoding-quoted-printable` — Encode text to MIME quoted-printable or decode quoted-printable email content back to text.
- **Text to Binary** — `/tools/binary-text` — Convert text to its binary (and back), with a configurable separator.
- **Unicode Escape / Unescape** — `/tools/encoding-unicode-escape` — Convert characters to \uXXXX escape sequences or unescape them back to readable Unicode text.
- **URL Encode / Decode** — `/tools/url-encode` — Percent-encode and decode text or whole-component URL strings.
- **UTF-8 / UTF-16 Code Unit Converter** — `/tools/encoding-utf16-code-units` — Show the UTF-16 code units (and surrogate pairs) for text and convert hex code-unit lists back into characters.
- **XOR Cipher** — `/tools/encoding-xor-cipher` — Encrypt or decrypt text with a repeating-key XOR cipher, outputting or reading hex or Base64.

## Generators (29)

- **.gitignore Generator** — `/tools/gitignore-generator` — Assemble a .gitignore from common language and tool templates.
- **Barcode Generator** — `/tools/generate-barcode` — Generate Code 39 and EAN-13 barcodes from input text/digits, rendered to a downloadable SVG/PNG with adjustable bar width and height.
- **Credit Card Number Generator** — `/tools/generate-credit-card` — Generate Luhn-valid fake test card numbers by brand (Visa, Mastercard, Amex, Discover) with optional expiry and CVV, for payment-form testing only.
- **Cron Expression Builder** — `/tools/generate-cron-expression` — Build a cron expression from human-friendly schedule controls (minute, hour, day, month, weekday) and see a plain-English description of when it runs.
- **CSS Gradient Generator** — `/tools/generate-css-gradient` — Build linear or radial CSS gradients with multiple color stops, angle, and type, producing copy-ready background CSS with a live preview.
- **Dice & Coin Roller** — `/tools/dice-roller` — Roll dice (d4–d100, multiple dice) and flip coins with fair randomness.
- **Hex Color Generator** — `/tools/generate-hex-color` — Generate random colors as HEX, RGB, and HSL with options to control hue range, brightness, and saturation for design palettes and placeholders.
- **IBAN Generator** — `/tools/generate-iban` — Generate valid-format test IBANs per country with correct length and ISO 7064 mod-97 check digits, useful for banking and form validation testing.
- **JSON Mock Data Generator** — `/tools/generate-mock-json` — Generate arrays of realistic fake JSON records from a field schema (name, email, uuid, number, date, boolean) with a configurable row count for API mocking.
- **MAC Address Generator** — `/tools/generate-mac-address` — Generate random MAC addresses with selectable separator (colon, hyphen, dot), case, and locally-administered/unicast bit control for network testing.
- **Markdown Table Generator** — `/tools/generate-markdown-table` — Generate clean GitHub-flavored Markdown tables from pasted CSV/TSV or row/column counts, with column alignment and auto-padded columns.
- **Mock Data Generator** — `/tools/mock-data` — Generate an array of realistic fake records (names, emails, dates) as JSON.
- **Nano ID Generator** — `/tools/nanoid-generator` — Generate compact, URL-safe Nano IDs with a configurable length.
- **NanoID Generator** — `/tools/generate-nanoid` — Generate compact, URL-safe NanoIDs with configurable length and alphabet, a popular smaller alternative to UUIDs for keys and short links.
- **Passphrase Generator** — `/tools/passphrase-generator` — Generate memorable multi-word passphrases (diceware-style) locally.
- **PIN Code Generator** — `/tools/generate-pin` — Generate random numeric PIN codes of a chosen length (e.g. 4/6/8 digits) in bulk, with an option to avoid trivial sequences and repeats.
- **Placeholder Image Generator** — `/tools/generate-placeholder-image` — Generate downloadable placeholder images at a chosen size, background/text color, and label text, drawn on a canvas as a data URL for mockups.
- **Random Date Generator** — `/tools/generate-random-date` — Generate random dates and times between a start and end bound, with chosen output format (ISO, locale, Unix timestamp) and quantity for seeding data.
- **Random Number Generator** — `/tools/generate-random-number` — Generate cryptographically random integers or decimals within a min/max range, with options for quantity, uniqueness, and number of decimal places.
- **Random String Generator** — `/tools/generate-random-string` — Generate random strings/tokens with toggleable character sets (lowercase, uppercase, digits, symbols), custom length, and quantity for API keys, secrets, and test data.
- **Random String Generator** — `/tools/random-string` — Generate random strings from a chosen alphabet (hex, alphanumeric, custom).
- **robots.txt Generator** — `/tools/robots-txt` — Build a robots.txt with allow/disallow rules and a sitemap line.
- **Secure Passphrase Generator** — `/tools/generate-passphrase` — Generate memorable Diceware-style passphrases from a built-in wordlist with configurable word count, separator, capitalization, and an appended number.
- **Slug Generator** — `/tools/generate-slug` — Turn each line of text into clean URL slugs with options for separator, lowercasing, accent stripping, and max length, processing many titles at once.
- **SVG Pattern Generator** — `/tools/generate-svg-pattern` — Generate tileable SVG background patterns (dots, grid, stripes, checkerboard) with adjustable colors, size, and spacing, output as ready-to-use SVG markup.
- **ULID Generator** — `/tools/generate-ulid` — Generate ULIDs (Universally Unique Lexicographically Sortable Identifiers): 26-char Crockford base32 IDs with a millisecond timestamp prefix and random suffix, sortable by creation time.
- **ULID Generator** — `/tools/ulid-generator` — Generate lexicographically-sortable ULIDs in bulk, locally.
- **UUID Generator** — `/tools/uuid-generator` — Generate RFC 4122 v4 (random) and v7 (time-ordered) UUIDs in bulk.
- **UUID v5 / v3 Generator** — `/tools/generate-uuid-v5` — Generate deterministic namespace UUIDs (v5 SHA-1 and v3 MD5) from a namespace UUID plus a name, so the same input always yields the same UUID.

## Web & Dev (41)

- **.env to JSON** — `/tools/web-dotenv-to-json` — Parse a .env / dotenv file into a JSON object and convert JSON back into .env format, handling quotes, comments, and export prefixes.
- **Basic Auth Generator** — `/tools/basic-auth-generator` — Build an HTTP Basic Authorization header from a username and password.
- **Chmod Calculator** — `/tools/chmod-calculator` — Toggle Unix permission bits and get the octal + symbolic chmod value.
- **Cookie Parser** — `/tools/cookie-parser` — Parse a Cookie or Set-Cookie header into a readable table of attributes.
- **Cron Expression Explainer** — `/tools/web-cron-explainer` — Translate a cron expression into plain English and list the next several run times, supporting ranges, steps, and lists across all five fields.
- **CSS Box Shadow Generator** — `/tools/web-box-shadow-generator` — Visually craft a CSS box-shadow with offset, blur, spread, color, opacity, and inset controls, with a live preview and copyable code.
- **CSS Cubic Bezier Generator** — `/tools/web-cubic-bezier` — Design CSS cubic-bezier easing curves with draggable control points and a live animation preview, outputting the transition-timing-function value.
- **CSS Minify / Beautify** — `/tools/css-minify` — Minify CSS to one line or beautify it with consistent indentation.
- **CSS Specificity Calculator** — `/tools/web-css-specificity` — Compute the specificity of any CSS selector as an (a,b,c) triple and rank multiple selectors to predict which rule wins.
- **CSS to Tailwind** — `/tools/web-css-to-tailwind` — Translate common CSS declarations into equivalent Tailwind utility classes, mapping spacing, colors, flex, font, and border properties.
- **cURL to Code** — `/tools/web-curl-to-fetch` — Convert a curl command into a browser fetch() call, parsing method, URL, headers, and body into ready-to-paste JavaScript.
- **Data URI to Text** — `/tools/web-data-uri-decoder` — Decode a data: URI back into its underlying text, revealing the MIME type, encoding, and the original content from base64 or percent-encoding.
- **Email Obfuscator** — `/tools/email-obfuscator` — Obfuscate an email address (entities / JS) to deter scrapers.
- **HTML Boilerplate Generator** — `/tools/web-html-boilerplate` — Generate a clean HTML5 starter document with configurable title, language, viewport, charset, and optional meta/Open Graph tags.
- **HTML to JSX** — `/tools/web-html-to-jsx` — Convert raw HTML into React JSX, renaming class to className, fixing self-closing tags, camelCasing attributes, and converting inline styles to objects.
- **HTML to Text** — `/tools/html-to-text` — Strip HTML tags and decode entities to get clean plain text.
- **HTTP Headers Reference** — `/tools/web-http-headers-reference` — Look up any HTTP request or response header to see its purpose, direction, example values, and whether it is standard or deprecated.
- **HTTP Status Codes** — `/tools/http-status-codes` — Searchable reference of HTTP status codes and their meanings.
- **IPv4 Subnet Calculator** — `/tools/ip-subnet-calculator` — Compute network, broadcast, mask, host range and count from CIDR.
- **JSON Flatten / Unflatten** — `/tools/web-json-flatten` — Flatten a deeply nested JSON object into single-level dot-notation keys, or rebuild nested structure from flattened keys.
- **JSON Path Extractor** — `/tools/web-json-path-extractor` — Query a JSON document with a dot/bracket path expression (e.g. data.items[0].name) and extract matching values, with wildcard support for arrays.
- **JSON to Java Class** — `/tools/web-json-to-java` — Convert a JSON payload into POJO Java class definitions with typed fields and getters/setters, inferring nested classes and collection generics.
- **JSON to JSON Schema** — `/tools/web-json-to-jsonschema` — Generate a draft JSON Schema from an example JSON document, inferring types, required keys, array item shapes, and nested object definitions.
- **JSON to Pretty / Tree** — `/tools/web-json-tree-viewer` — Visualize JSON as a collapsible, indented tree with type annotations and node counts, making large nested payloads easy to navigate.
- **JSON to Query Params** — `/tools/web-json-to-query-string` — Turn a flat or nested JSON object into a properly encoded URL query string, with bracket notation for nested keys and arrays.
- **JSON to TOML** — `/tools/web-json-to-toml` — Convert JSON configuration into TOML format and back, handling tables, arrays of tables, nested keys, strings, and numeric/boolean scalars.
- **JWT Decoder** — `/tools/jwt-decoder` — Decode and inspect JSON Web Token header & payload (no verification).
- **Markdown Table Generator** — `/tools/web-markdown-table-generator` — Build a Markdown table from typed rows and columns or from pasted CSV/TSV, with column alignment controls and live preview.
- **Markdown to HTML** — `/tools/markdown-to-html` — Render Markdown to HTML with a live preview and copyable output.
- **MIME Type Lookup** — `/tools/mime-types` — Look up the MIME/content type for a file extension and vice versa.
- **Open Graph Meta Tag Generator** — `/tools/web-open-graph-generator` — Produce Open Graph and Twitter Card meta tags from title, description, URL, image, and type fields for rich social link previews.
- **PX ↔ REM Converter** — `/tools/px-rem-converter` — Convert between px, rem and em given a configurable root font size.
- **Query String ↔ JSON** — `/tools/query-params` — Convert a URL query string to JSON and back, handling repeated keys.
- **Query String Parser** — `/tools/web-query-string-parser` — Parse a raw query string into a readable key/value table or pretty JSON, expanding repeated keys and bracket notation into arrays.
- **Regex Cheatsheet & Builder** — `/tools/web-regex-cheatsheet` — Browse a searchable regex syntax reference and snippet library for common patterns like email, URL, IP, and date, with copyable expressions.
- **Semantic Version Comparator** — `/tools/web-semver-compare` — Compare two semantic versions to see which is greater, parse a version into major/minor/patch/prerelease, and test it against a range.
- **URL Inspector** — `/tools/web-url-inspector` — Break a URL into protocol, host, port, path segments, query parameters, and hash, displayed as a clear labeled component breakdown.
- **URL Parser** — `/tools/url-parser` — Break a URL into protocol, host, path, query parameters and hash.
- **User-Agent Parser** — `/tools/user-agent-parser` — Parse a User-Agent string into browser, engine, OS and device.
- **XML Formatter** — `/tools/web-xml-formatter` — Pretty-print and indent minified XML, or minify verbose XML by stripping whitespace between tags, with self-closing tag handling.
- **XML to JSON** — `/tools/web-xml-to-json` — Convert an XML document into a structured JSON object, mapping elements, attributes, and text content with a predictable convention.

## Time & Date (18)

- **Add or Subtract Days** — `/tools/date-add-subtract` — Add or subtract days, weeks, months, or years from a date and get the resulting date in multiple formats.
- **Age Calculator** — `/tools/age-calculator` — Calculate exact age from a birth date in years, months, days, plus total days, hours, and the next birthday countdown.
- **Business Days Calculator** — `/tools/business-days-calculator` — Count working days between two dates, excluding weekends, or add a number of business days to a start date.
- **Cron Expression Builder** — `/tools/cron-builder` — Build a standard cron expression from dropdowns for minute, hour, day, month, and weekday with a human-readable preview.
- **Cron Expression Explainer** — `/tools/cron-parser` — Explain a cron expression in plain English and preview the next run times.
- **Date Difference** — `/tools/date-difference` — Calculate the duration between two dates in years, days, hours and more.
- **Date Format Converter** — `/tools/date-format-converter` — Parse any date string and reformat it into common patterns (ISO 8601, RFC 2822, US, EU, locale strings) all at once.
- **Day of Year Calculator** — `/tools/day-of-year` — Find the ordinal day-of-year for any date, days remaining in the year, and convert an ordinal day back to a date.
- **Days Until Date** — `/tools/days-until` — Count the exact days, weeks, hours, and minutes between today and a target future or past date.
- **ISO 8601 Duration Parser** — `/tools/iso-duration-parser` — Parse ISO 8601 duration strings like P1Y2M10DT2H30M into total seconds and a human-readable breakdown.
- **ISO 8601 Parser** — `/tools/iso-8601-parser` — Break down an ISO 8601 date-time string into its components (year, month, day, hour, offset, week) and validate it.
- **ISO Week Number** — `/tools/week-number` — Find the ISO 8601 week number for any date (and day-of-year).
- **Relative Time Formatter** — `/tools/relative-time-formatter` — Turn a timestamp or date into human-friendly relative phrasing like '3 hours ago' or 'in 2 days' across locales.
- **Time Unit Converter** — `/tools/time-unit-converter` — Convert a value between nanoseconds, microseconds, milliseconds, seconds, minutes, hours, and days.
- **Timezone Converter** — `/tools/timezone-converter` — Convert a date/time across timezones using the browser’s IANA database.
- **Unix Timestamp Converter** — `/tools/timestamp-converter` — Convert between Unix timestamps and human-readable dates (local & UTC).
- **Unix Timestamp Now** — `/tools/unix-time-now` — Live ticking display of the current Unix timestamp in seconds, milliseconds, and microseconds, with a one-click copy and pause toggle.
- **Week Number to Date** — `/tools/week-to-date` — Convert an ISO week number and year into the start and end dates of that week, and vice versa.

## Math & Units (27)

- **Angle Converter** — `/tools/angle-converter` — Convert angles between degrees, radians, gradians, turns, and arcminutes/arcseconds.
- **Aspect Ratio Calculator** — `/tools/aspect-ratio-calculator` — Find a missing width or height for a target aspect ratio and reduce any resolution to its simplest ratio.
- **Bitwise Calculator** — `/tools/bitwise-calculator` — Perform AND, OR, XOR, NOT and shifts on two integers, shown in all bases.
- **BMI Calculator** — `/tools/bmi-calculator` — Calculate Body Mass Index from height and weight in metric or imperial units with a category label.
- **Compound Interest Calculator** — `/tools/compound-interest-calculator` — Project savings growth with compound interest, optional regular contributions, and a yearly breakdown.
- **Cooking Measurement Converter** — `/tools/cooking-converter` — Convert kitchen measurements between cups, tablespoons, teaspoons, milliliters, ounces, and grams.
- **Data Transfer Rate Converter** — `/tools/data-rate-converter` — Convert data transfer rates between bps, Kbps, Mbps, Gbps, and bytes-per-second equivalents.
- **Fraction & Decimal Converter** — `/tools/fraction-decimal-converter` — Convert fractions to decimals and decimals to simplified fractions, detecting repeating decimals.
- **Fuel Economy Converter** — `/tools/fuel-economy-converter` — Convert fuel efficiency between MPG (US/UK), km/L, and liters per 100 km.
- **GCD & LCM Calculator** — `/tools/gcd-lcm` — Find the greatest common divisor and least common multiple of numbers.
- **Loan & EMI Calculator** — `/tools/loan-emi-calculator` — Calculate monthly loan payment, total interest, and total repayment from principal, rate, and term.
- **Matrix Calculator** — `/tools/matrix-calculator` — Add, subtract, multiply, transpose, and find the determinant and inverse of small matrices.
- **Modular Arithmetic Calculator** — `/tools/modulo-calculator` — Compute true modulo, modular addition, multiplication, and exponentiation with non-negative results.
- **Number Base Converter** — `/tools/number-base-converter` — Convert numbers between binary, octal, decimal, hex and arbitrary bases.
- **Pace & Speed Calculator** — `/tools/pace-calculator` — Convert between running pace, speed, distance, and time for runs, walks, and cycling.
- **Percentage Calculator** — `/tools/percentage-calculator` — Work out percentages, percentage change, and what-percent-of calculations.
- **Prime Checker & Factorizer** — `/tools/prime-checker` — Check whether a number is prime and view its prime factorization.
- **Quadratic Equation Solver** — `/tools/quadratic-equation-solver` — Solve quadratic equations for real or complex roots from coefficients a, b, and c.
- **Random Number Generator** — `/tools/random-number-generator` — Generate cryptographically secure random integers within a custom range, with optional uniqueness.
- **Ratio & Proportion Solver** — `/tools/ratio-proportion-solver` — Simplify ratios and solve for the missing fourth term in a proportion via cross-multiplication.
- **Roman Numeral Converter** — `/tools/roman-numerals` — Convert between Roman numerals and integers (1–3999).
- **Scientific Calculator** — `/tools/expression-calculator` — Evaluate math expressions with functions, constants and operators.
- **Scientific Notation Converter** — `/tools/scientific-notation-converter` — Convert numbers between plain decimal, scientific E-notation, and engineering notation.
- **Statistics Calculator** — `/tools/statistics` — Compute mean, median, range, variance and standard deviation of a data set.
- **Time Duration Converter** — `/tools/duration-converter` — Convert durations between milliseconds, seconds, minutes, hours, days, and weeks.
- **Tip & Bill Splitter** — `/tools/tip-split-calculator` — Calculate tip amount, grand total, and per-person share when splitting a bill among people.
- **Unit Converter** — `/tools/unit-converter` — Convert length, mass, temperature, area, volume, speed and data sizes.

## Color (22)

- **Color Blindness Simulator** — `/tools/color-blindness` — Preview how a color appears under common color-vision deficiencies.
- **Color Converter** — `/tools/color-converter` — Convert colors between HEX, RGB, HSL, HSV, CMYK and OKLCH, with a live preview.
- **Color Harmony / Palette Builder** — `/tools/color-harmony` — Build harmonious palettes from a base color using complementary, analogous, triadic, tetradic, split-complementary, and monochromatic schemes.
- **Color Mixer / Blender** — `/tools/color-mixer` — Blend two colors at any ratio to find the resulting mix, with adjustable percentage and live HEX/RGB output of the blended color.
- **Color Name Finder** — `/tools/color-name-finder` — Find the closest human-readable color name (like 'cornflower blue') for any HEX or RGB value using the CSS named color set.
- **Color Picker** — `/tools/color-picker` — Pick a color visually and read its HEX, RGB, HSL and OKLCH values.
- **Color Scale Generator** — `/tools/color-scale-generator` — Generate an evenly stepped color scale between two colors, choosing the number of steps and interpolation space.
- **Color Temperature (Kelvin) Converter** — `/tools/kelvin-to-rgb` — Convert a color temperature in Kelvin to its approximate RGB/HEX color, useful for lighting, white balance, and warm/cool tone work.
- **Contrast Checker** — `/tools/contrast-checker` — Check WCAG contrast ratio between two colors and AA/AAA pass/fail.
- **CSS Box Shadow Generator** — `/tools/box-shadow-generator` — Visually design CSS box-shadows by adjusting offset, blur, spread, color, and inset, then copy the ready-to-use box-shadow rule.
- **CSS Gradient Generator** — `/tools/gradient-generator` — Build linear, radial and conic CSS gradients with a live preview.
- **CSS Named Colors** — `/tools/named-colors` — Browse and search all CSS named colors with their HEX/RGB values.
- **Grayscale Converter** — `/tools/grayscale-converter` — Convert any color to its grayscale equivalent using luminance, average, or desaturation methods, with side-by-side preview.
- **HEX to RGBA Converter** — `/tools/hex-to-rgba` — Convert HEX color codes (including 8-digit HEX with alpha) to rgba() and back, controlling opacity with a percentage value.
- **HSL to HEX Converter** — `/tools/hsl-to-hex` — Convert HSL color values to HEX and RGB, accepting standard hsl() notation and outputting clean web-ready codes.
- **Image Color Extractor** — `/tools/image-color-extractor` — Upload an image and extract its dominant colors and an automatic palette, ready to copy as HEX swatches.
- **Lighten / Darken Color** — `/tools/lighten-darken-color` — Lighten or darken any color by a chosen percentage and get the adjusted color in HEX and RGB, with a before/after preview.
- **Material Design Color Palette** — `/tools/material-colors` — Browse and copy the full Material Design color palette with all hues and shades (50-900, plus accents) as HEX swatches.
- **Random Color Generator** — `/tools/random-color` — Generate random colors with copyable HEX/RGB/HSL values.
- **RGB to HEX Converter** — `/tools/rgb-to-hex` — Convert rgb()/rgba() color values to HEX (and 8-digit HEX when alpha is present), accepting comma or space separated channels.
- **Tailwind Color Finder** — `/tools/tailwind-colors` — Find the closest Tailwind CSS color name and shade for any HEX/RGB color, and look up the exact HEX of any Tailwind color token.
- **Tints & Shades Generator** — `/tools/color-shades` — Generate a tint/shade ramp from a base color, with copyable values.


🦀 = uses Rust→WASM (runs in a Web Worker).
