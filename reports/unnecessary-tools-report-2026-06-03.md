# Utility Tools Catalog Audit: Unnecessary / Over-Generated Tools

Generated: 2026-06-03
Repository: `/Users/saikiranreddy/Documents/projects/oss/utility-tools`

## Executive summary

The live registry contains **995 tools**. The repo's original `docs/MASTER-TOOL-LIST.md` describes **227 unique tools**, while `docs/BUILT-TOOLS.md` now lists **995 tools**. That jump is the main signal: a lot of pages appear to be generated long-tail variants, not deliberate core utilities.

I flagged **344 tools** as unnecessary, redundant, or worth removing/merging:

- **83** high-confidence remove candidates (boilerplate generators like `CONTRIBUTING.md Generator`, novelty tools, puzzle ciphers).
- **223** merge candidates where several pages should become one broader tool.
- **38** medium-confidence deprioritize/remove candidates (niche references, locale-specific/test-data generators, lifestyle calculators).

Current category counts:

- color: 72
- convert: 107
- crypto: 59
- data: 98
- encoding: 72
- generators: 95
- image: 43
- math: 114
- pdf: 4
- text: 128
- time: 63
- web: 140

Flagged count by category:

- color: 37
- convert: 21
- crypto: 4
- data: 35
- encoding: 23
- generators: 71
- image: 4
- math: 18
- text: 46
- time: 12
- web: 73

## Review criteria

I treated a tool as unnecessary when it matched at least one of these patterns:

1. **Boilerplate/scaffold generator**: creates static docs/config/project snippets better handled by templates or docs. This includes your example, `CONTRIBUTING.md Generator`.
2. **Near-duplicate split page**: one small operation split from a broader converter/calculator that already exists.
3. **Novelty / entertainment**: puzzles, fake alphabets, zodiac, stardate, cards/dice, glitch text, etc.
4. **Niche or brittle reference data**: region-specific size/currency/test-data/reference lookups that are easy to go stale or are not central to an offline utility suite.
5. **Catalog quality risk**: tool count inflates search/category pages and makes the product feel generated rather than curated.

## Highest-priority removals

These are the clearest “generated bloat” tools to remove first.

| Action | Confidence | Category | Tool | Slug | Why |
|---|---:|---|---|---|---|
| Remove | High | encoding | A1Z26 Letter-Number Cipher | `encoding-a1z26-cipher` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Affine Cipher | `encoding-affine-cipher` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Atbash Cipher | `encoding-atbash-cipher` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Bacon's Cipher | `encoding-bacon-cipher` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Beaufort Cipher | `encoding-beaufort-cipher` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Columnar Transposition Cipher | `encoding-columnar-transposition` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Flag Semaphore Encoder | `encoding-semaphore-text` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Four-Square Cipher | `encoding-four-square-cipher` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Gronsfeld Cipher | `encoding-gronsfeld-cipher` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Morse Code Prosigns & Abbreviations | `encoding-morse-prosigns-reference` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Morse Code Timing & Symbol Variants | `encoding-morse-timing-variants` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Nihilist Cipher | `encoding-nihilist-cipher` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Playfair Cipher | `encoding-playfair-cipher` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Polybius Square Cipher | `encoding-polybius-square` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Rail Fence Cipher | `encoding-rail-fence-cipher` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Spelling Alphabets Reference | `encoding-spell-alphabet-reference` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Tap Code (Knock Cipher) | `encoding-tap-code` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Vigenere Autokey Cipher | `encoding-vigenere-autokey-cipher` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | encoding | Zero-Width Character Encoder | `encoding-zero-width-steganography` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | generators | .editorconfig Generator | `editorconfig-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | CHANGELOG Generator (Keep a Changelog) | `changelog-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | CONTRIBUTING.md Generator | `contributing-guide-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | Conventional Commit Message Builder | `conventional-commit-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | Dice & Coin Roller | `dice-roller` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | generators | docker-compose.yml Generator | `docker-compose-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | Dockerfile Generator | `dockerfile-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | ESLint Flat Config Generator | `eslint-config-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | GitHub Actions Workflow Generator | `github-actions-workflow-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | GitLab CI Pipeline Generator | `generators-gitlab-ci-yaml` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | htpasswd + .htaccess Generator | `generators-htaccess-basic-auth` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | Lottery Number Generator | `lottery-number-generator` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | generators | Makefile Scaffold Generator | `generators-makefile-scaffold` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | Open Source License Generator | `open-source-license-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | package.json Generator | `package-json-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | Playing Card Dealer | `playing-card-dealer` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | generators | Prettier Config Generator | `prettier-config-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | Random Boolean / Yes-No Generator | `random-boolean-generator` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | generators | Random Choice Picker | `random-choice-picker` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | generators | Random Emoji Picker | `random-emoji-picker` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | generators | README.md Scaffold Generator | `readme-scaffold-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | robots.txt Generator | `robots-txt` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | systemd Service Unit Generator | `generators-systemd-service-unit` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | Team / Group Splitter | `team-shuffler` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | generators | tsconfig.json Generator | `tsconfig-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | generators | Weighted Random Picker | `weighted-random-picker` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | A1Z26 Number Cipher | `a1z26-cipher` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Bacon / Binary Cipher Encoder | `binary-ascii-art` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Bold & Italic Unicode Text | `unicode-bold-italic` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Fancy Text Generator | `fancy-text` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Haiku Syllable Checker | `haiku-checker` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Keyboard Shift Cipher | `keyboard-shift-cipher` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Letter & Word Spacing Expander | `wide-spaced-text` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Morse Code Visual Decoder | `morse-to-text-visual` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Pig Latin Translator | `pig-latin` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Regional Indicator & Emoji Letters | `text-to-emoji-letters` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Runic Transliterator | `runic-transliterator` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Strikethrough & Underline Text | `unicode-text-decorate` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Strikethrough, Underline & Overline Combiner | `strikethrough-text-variants` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Syllable Counter | `syllable-counter` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Tap Code Cipher | `tap-code-cipher` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Text Repeater | `text-repeater` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Themed Placeholder Text Generator | `lorem-ipsum-variants` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Upside-Down & Mirror Text | `upside-down-text` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Vaporwave Aesthetic Text | `fullwidth-text` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | text | Zalgo Glitch Text | `zalgo-text` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | time | Age on Other Planets | `age-on-other-planets` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | time | Birthday Milestone Finder | `birthday-milestone-finder` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | time | Chinese Zodiac Animal | `chinese-zodiac-sign` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | time | Decimal (French) Time Converter | `decimal-time-converter` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | time | Star Trek Stardate Converter | `stardate-converter` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | time | Swatch Internet Time (.beats) | `swatch-internet-time` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | time | Western Zodiac Sign Finder | `western-zodiac-sign` | Novelty, puzzle, or entertainment use case; unlikely to be a core privacy-first utility tool and creates long-tail catalog noise. |
| Remove | High | web | .gitattributes Generator | `web-gitattributes-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | web | .htaccess Redirect Builder | `web-htaccess-redirect-builder` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | web | Apache .htaccess Snippet Generator | `web-htaccess-snippet` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | web | HTML Boilerplate Generator | `web-html-boilerplate` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | web | HTML Meta Tags Generator (SEO) | `web-meta-tags-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | web | Markdown Table Generator | `web-markdown-table-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | web | Nginx Config Snippet Generator | `web-nginx-location-snippet` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | web | Open Graph Meta Tag Generator | `web-open-graph-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | web | Twitter Card Meta Generator | `web-twitter-card-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | web | Web App Manifest Generator | `web-manifest-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |
| Remove | High | web | XML Sitemap Generator | `web-sitemap-generator` | Boilerplate/scaffold output is better handled by maintained templates or docs; it bloats the tool catalog and matches the CONTRIBUTING.md Generator example. |

## Merge instead of separate pages

These are not all bad features, but they should be folded into broader canonical tools. Keep the better general-purpose page and delete the thin variants.

| Action | Confidence | Category | Tool | Slug | Why |
|---|---:|---|---|---|---|
| Merge into broader tool | High | color | Accessible Contrast Fixer | `color-contrast-suggester` | Duplicate contrast/accessibility tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Accessible Text Color Picker | `accessible-text-color` | Duplicate contrast/accessibility tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Analogous Color Scheme Generator | `analogous-color-scheme` | Duplicate color palette and harmony generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Color Scale Generator | `color-scale-generator` | Duplicate color palette and harmony generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Color Tints Generator | `color-tints-generator` | Duplicate color palette and harmony generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Color Tones Generator | `color-tones-generator` | Duplicate color palette and harmony generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Complementary Color Finder | `complementary-color-finder` | Duplicate color palette and harmony generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Contrast Ratio Grid | `contrast-ratio-grid` | Duplicate contrast/accessibility tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | CSS Box Shadow Generator | `box-shadow-generator` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | CSS Color Function Builder | `css-color-function-builder` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge duplicate | High | color | CSS Gradient Generator | `gradient-generator` | Exact duplicate tool name also exists at generate-css-gradient; consolidate to one canonical page. |
| Merge into broader tool | High | color | HEX to RGBA Converter | `hex-to-rgba` | Duplicate color converters split by pair; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | HSL to HEX Converter | `hsl-to-hex` | Duplicate color converters split by pair; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Monochromatic Scale Generator | `monochrome-scale-generator` | Duplicate color palette and harmony generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Palette from Numbers | `palette-from-numbers` | Duplicate color palette and harmony generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Perceived Lightness & Contrast Pair | `color-wcag-apca-lightness-contrast` | Duplicate contrast/accessibility tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Random Color Generator | `random-color` | Duplicate color palette and harmony generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Random Palette by Mood | `random-palette-by-mood` | Duplicate color palette and harmony generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | RGB to CIE XYZ Converter | `rgb-to-xyz-converter` | Duplicate color converters split by pair; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | RGB to CIELAB Converter | `rgb-to-lab-converter` | Duplicate color converters split by pair; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | RGB to CMYK Converter | `rgb-to-cmyk-converter` | Duplicate color converters split by pair; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | RGB to HEX Converter | `rgb-to-hex` | Duplicate color converters split by pair; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | RGB to HSL Converter | `rgb-to-hsl-converter` | Duplicate color converters split by pair; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | RGB to HSV Converter | `rgb-to-hsv-converter` | Duplicate color converters split by pair; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | RGB to HWB Converter | `rgb-to-hwb-converter` | Duplicate color converters split by pair; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | RGB to LCH Converter | `rgb-to-lch-converter` | Duplicate color converters split by pair; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Split-Complementary Scheme Generator | `split-complementary-scheme` | Duplicate color palette and harmony generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Tetradic Color Scheme Generator | `tetradic-color-scheme` | Duplicate color palette and harmony generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Tints & Shades Generator | `color-shades` | Duplicate color palette and harmony generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Triadic Color Scheme Generator | `triadic-color-scheme` | Duplicate color palette and harmony generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | Universal Color Format Translator | `color-format-allinone` | Duplicate color converters split by pair; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | color | WCAG Contrast Pair Finder | `wcag-contrast-pair-finder` | Duplicate contrast/accessibility tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | convert | Cron Dialect Translator | `convert-cron-to-human-and-quartz` | Duplicate cron/time tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | convert | Crontab File Explainer | `convert-cron-to-human-multi` | Duplicate cron/time tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | convert | CSS Shorthand Expander | `css-shorthand-expander` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | convert | cURL to HTTPie | `curl-to-httpie` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | convert | GraphQL Query to cURL | `convert-graphql-query-to-curl` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | convert | HAR Entry to cURL | `convert-har-to-curl` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | convert | HTTPie to cURL | `httpie-to-curl` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | convert | JSON to Go Struct | `json-to-go` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | convert | Markdown Table to CSV | `markdown-table-to-csv` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | convert | Markdown Table to HTML | `markdown-table-to-html` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | convert | OpenAPI Paths to cURL | `convert-openapi-to-curl` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | convert | Query String to cURL | `querystring-to-curl` | Duplicate URL/query-string tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | convert | Query String to JSON | `query-string-to-json` | Duplicate URL/query-string tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge duplicate | High | convert | XML to JSON | `xml-to-json` | Exact duplicate tool name also exists at web-xml-to-json; consolidate to one canonical page. |
| Merge into broader tool | High | crypto | API Key + Secret Generator | `api-key-pair-generator` | Duplicate random strings/passwords/passphrases; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | crypto | Diceware Passphrase Generator | `diceware-passphrase` | Duplicate random strings/passwords/passphrases; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | crypto | UUID Inspector | `uuid-inspector` | Duplicate UUID/NanoID/ULID variants; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge duplicate | High | crypto | XOR Cipher | `xor-cipher` | Exact duplicate tool name also exists at encoding-xor-cipher; consolidate to one canonical page. |
| Merge into broader tool | High | data | CSV Add Row Numbers | `csv-add-row-numbers` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | CSV Column Math | `csv-column-math` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | CSV Column Selector | `csv-column-selector` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | CSV Column Statistics | `csv-column-stats` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | CSV Column Type Detector | `data-csv-detect-types` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | CSV Deduplicate Rows | `csv-dedupe` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | CSV Group-By Aggregator | `data-csv-group-by-aggregate` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | CSV Header Renamer | `csv-rename-headers` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | CSV Merge Columns | `csv-merge-columns` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | CSV Pivot Table Builder | `csv-pivot-table` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | CSV Row Filter | `csv-filter-rows` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | CSV Row Sampler | `csv-sample-rows` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | CSV Sorter | `csv-sort` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | CSV Split Column | `csv-split-column` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | CSV Transpose | `csv-transpose` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | Delimited Column Reorder | `data-tsv-column-reorder` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON Minify | `json-minify` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON Schema Generator | `json-to-json-schema` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON Schema Sample Generator | `json-schema-sample-generator` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON to C# Class | `json-to-csharp` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON to Dart Class | `json-to-dart` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON to GraphQL Type | `json-to-graphql-sdl` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON to JSDoc Typedef | `json-to-jsdoc-typedef` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON to Kotlin Data Class | `json-to-kotlin` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON to Mongoose Schema | `json-to-mongoose-schema` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON to Protobuf | `json-to-protobuf` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON to Pydantic Model | `json-to-pydantic` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON to Python Dataclass | `json-to-python-dataclass` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON to Query String | `json-to-query-string` | Duplicate URL/query-string tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON to Rust Structs | `json-to-rust-serde` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON to Swift Codable | `json-to-swift-codable` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON to Zod Schema | `json-to-zod` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | JSON Validator | `json-validator` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | Markdown Table to JSON | `markdown-table-to-json` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | data | TSV to Markdown Table | `data-tsv-to-markdown-table` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | encoding | Base64 / Data URI Image Inspector | `encoding-base64-image-inspector` | Duplicate image data-uri/base64/placeholder/gradient tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | encoding | Base64 Image / Data URI Builder | `encoding-data-uri-builder` | Duplicate image data-uri/base64/placeholder/gradient tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | encoding | Regex Special-Character Escaper | `encoding-regex-literal-escape` | Duplicate regex tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | API Key Generator | `api-key-generator` | Duplicate random strings/passwords/passphrases; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | Cron Expression Builder | `generate-cron-expression` | Duplicate cron/time tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | Crontab Recipe Generator | `crontab-recipe-generator` | Duplicate cron/time tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | CSS Gradient Generator | `generate-css-gradient` | Duplicate image data-uri/base64/placeholder/gradient tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | CUID2 Generator | `cuid2-generator` | Duplicate UUID/NanoID/ULID variants; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | Fake Data From JSON Schema | `json-schema-faker` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | KSUID Generator | `ksuid-generator` | Duplicate UUID/NanoID/ULID variants; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | License Key Generator | `license-key-generator` | Duplicate random strings/passwords/passphrases; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | Markdown Table Generator | `generate-markdown-table` | Duplicate CSV/TSV/table operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | Memorable Password Generator | `memorable-password-generator` | Duplicate random strings/passwords/passphrases; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | Mnemonic PIN Generator | `mnemonic-pin-generator` | Duplicate random strings/passwords/passphrases; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | NanoID Custom Alphabet Generator | `nanoid-custom-alphabet` | Duplicate UUID/NanoID/ULID variants; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | NanoID Generator | `generate-nanoid` | Duplicate UUID/NanoID/ULID variants; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | Nil & Max UUID Generator | `uuid-nil-max-generator` | Duplicate UUID/NanoID/ULID variants; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | OTP Secret Generator | `otp-secret-generator` | Duplicate random strings/passwords/passphrases; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | Pattern-Based Password Generator | `pattern-password-generator` | Duplicate random strings/passwords/passphrases; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | PIN Code Generator | `generate-pin` | Duplicate random strings/passwords/passphrases; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | Placeholder Image Generator | `generate-placeholder-image` | Duplicate image data-uri/base64/placeholder/gradient tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | Pronounceable Password Generator | `pronounceable-password-generator` | Duplicate random strings/passwords/passphrases; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | Random Color Palette Generator | `random-hex-color-palette` | Duplicate color palette and harmony generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | Random String Generator | `random-string` | Duplicate random strings/passwords/passphrases; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | Random String Generator | `generate-random-string` | Duplicate random strings/passwords/passphrases; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | Random Token Generator | `bearer-token-generator` | Duplicate random strings/passwords/passphrases; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | Secure Passphrase Generator | `generate-passphrase` | Duplicate random strings/passwords/passphrases; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | Snowflake ID Generator | `snowflake-id-generator` | Duplicate UUID/NanoID/ULID variants; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | ULID Generator | `generate-ulid` | Duplicate UUID/NanoID/ULID variants; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge duplicate | High | generators | ULID Generator | `ulid-generator` | Exact duplicate tool name also exists at generate-ulid; consolidate to one canonical page. |
| Merge into broader tool | High | generators | UUID Namespace Builder | `uuid-namespace-builder` | Duplicate UUID/NanoID/ULID variants; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | UUID v5 / v3 Generator | `generate-uuid-v5` | Duplicate UUID/NanoID/ULID variants; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | generators | UUID v7 Generator | `uuid-v7-generator` | Duplicate UUID/NanoID/ULID variants; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | image | Gradient SVG / PNG Generator | `image-gradient-svg-generator` | Duplicate image data-uri/base64/placeholder/gradient tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | image | Image to Data URI (CSS/HTML/JSX) | `image-to-data-uri-variants` | Duplicate image data-uri/base64/placeholder/gradient tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge duplicate | High | image | Placeholder Image Generator | `placeholder-image` | Exact duplicate tool name also exists at generate-placeholder-image; consolidate to one canonical page. |
| Merge into broader tool | High | image | SVG to Data URI | `svg-to-data-uri` | Duplicate image data-uri/base64/placeholder/gradient tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | math | Bill & Amount Split Calculator | `currency-split-calculator` | Duplicate math/percentage/finance calculators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | math | Break-Even Point Calculator | `break-even-calculator` | Duplicate math/percentage/finance calculators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | math | Discount & Sale Price Calculator | `discount-calculator` | Duplicate math/percentage/finance calculators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | math | Loan Amortization Schedule | `math-loan-amortization-schedule` | Duplicate math/percentage/finance calculators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | math | Markup & Margin Calculator | `markup-margin-calculator` | Duplicate math/percentage/finance calculators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | math | Mortgage Extra Payment Calculator | `mortgage-extra-payment` | Duplicate math/percentage/finance calculators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | math | Percent Change Calculator | `percent-change` | Duplicate math/percentage/finance calculators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | math | Percent Error Calculator | `percent-error` | Duplicate math/percentage/finance calculators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | math | Percent Increase & Decrease | `percent-increase-decrease` | Duplicate math/percentage/finance calculators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge duplicate | High | math | Random Number Generator | `random-number-generator` | Exact duplicate tool name also exists at generate-random-number; consolidate to one canonical page. |
| Merge into broader tool | High | math | Reverse Percentage Calculator | `math-tip-free-percent-of-total` | Duplicate math/percentage/finance calculators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | math | ROI Calculator | `roi-calculator` | Duplicate math/percentage/finance calculators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | math | Savings Goal Calculator | `savings-goal-calculator` | Duplicate math/percentage/finance calculators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | math | Simple Interest Calculator | `simple-interest-calculator` | Duplicate math/percentage/finance calculators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | math | Tip & Bill Splitter | `tip-split-calculator` | Duplicate math/percentage/finance calculators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | math | VAT & Sales Tax Calculator | `vat-sales-tax` | Duplicate math/percentage/finance calculators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Collapse Consecutive Duplicate Lines | `consecutive-duplicate-collapse` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Column / Field Extractor (cut) | `column-extractor` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Column Aligner (Elastic Tabstops) | `column-aligner` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Join Lines | `join-lines` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Line Numbering (Advanced) | `add-line-numbers-advanced` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Longest and Shortest Line Finder | `text-find-longest-shortest-line` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Multi-Key Column Sort | `text-text-column-sort` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Natural / Numeric Sort Lines | `natural-sort-lines` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Number Each Line | `number-lines` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Pad & Align Lines | `pad-lines` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Paragraph Reflow & Justify | `word-wrap-justify` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Paragraph Splitter & Joiner | `paragraph-splitter` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Prefix & Suffix Lines | `prefix-suffix-lines` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Remove Duplicate Lines | `remove-duplicates` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Remove Line Breaks | `remove-line-breaks` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Reverse & Flip Lines | `reverse-lines` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Shuffle Lines | `shuffle-lines` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Sort & Dedupe Lines | `sort-lines` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Sort Lines by Length | `text-text-sort-by-length` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Split Text Into Chunks | `split-text-chunks` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Text Alignment & Padding | `text-align-pad` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Text Wrapper | `text-wrap` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Trim & Strip Lines | `trim-lines` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | text | Whitespace Cleaner | `whitespace-cleaner` | Duplicate line/text operations; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | time | Cron Expression Builder | `cron-builder` | Duplicate cron/time tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | time | Cron Field Expander | `cron-field-expander` | Duplicate cron/time tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | time | Cron Next Runs Preview | `cron-next-runs-preview` | Duplicate cron/time tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Authorization Header Builder | `web-bearer-auth-header-builder` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Basic Auth Generator | `basic-auth-generator` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Cache-Control Header Explainer | `web-http-cache-header-explainer` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Common Regex Patterns Library | `web-regex-pattern-library` | Duplicate regex tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Content-Disposition Builder | `web-content-disposition-builder` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Content-Security-Policy Builder | `web-csp-builder` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Content-Security-Policy Linter | `web-content-security-policy-linter` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CORS Headers Builder | `web-cors-headers-builder` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Cron Expression Explainer | `web-cron-explainer` | Duplicate cron/time tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSP Header Analyzer | `web-content-security-policy-analyzer` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS Border Radius Generator | `web-border-radius-generator` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS Box Shadow Generator | `web-box-shadow-generator` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS Button Generator | `web-css-button-generator` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS Color Format Converter | `web-css-color-format-converter` | Duplicate color converters split by pair; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS Custom Scrollbar Styler | `web-scrollbar-styler` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS Filter Generator | `web-filter-generator` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS Flexbox Generator | `web-flexbox-playground` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS Gradient Text Generator | `web-css-gradient-text` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS Grid Template Generator | `web-grid-template-generator` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS Media Query Builder | `web-media-query-builder` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS Media Query Generator | `web-media-query-generator` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS Multi-Column Layout Generator | `web-multi-column-generator` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS REM / EM / VW / PX Calculator | `web-css-relative-unit-calculator` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS Text Shadow Generator | `web-text-shadow-generator` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS to Tailwind | `web-css-to-tailwind` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS Transform Generator | `web-transform-generator` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | CSS Transition Generator | `web-transition-generator` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Data URI Size Estimator | `web-data-uri-size-estimator` | Duplicate image data-uri/base64/placeholder/gradient tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Data URI to Text | `web-data-uri-decoder` | Duplicate image data-uri/base64/placeholder/gradient tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | HSTS Header Builder | `web-hsts-header-builder` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge duplicate | High | web | JSON Flatten / Unflatten | `web-json-flatten` | Exact duplicate tool name also exists at json-flatten; consolidate to one canonical page. |
| Merge duplicate | High | web | JSON Path Extractor | `web-json-path-extractor` | Exact duplicate tool name also exists at json-path-extractor; consolidate to one canonical page. |
| Merge into broader tool | High | web | JSON to Java Class | `web-json-to-java` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | JSON to JSON Schema | `web-json-to-jsonschema` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | JSON to Pretty / Tree | `web-json-tree-viewer` | Duplicate JSON viewers/formatters/schema/codegen; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | JSON to Query Params | `web-json-to-query-string` | Duplicate URL/query-string tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge duplicate | High | web | JSON to TOML | `web-json-to-toml` | Exact duplicate tool name also exists at json-to-toml; consolidate to one canonical page. |
| Merge into broader tool | High | web | Link Header Builder & Parser | `web-link-header-builder` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Permissions-Policy Builder | `web-permissions-policy-builder` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | PX ↔ REM Converter | `px-rem-converter` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Query String Editor | `web-query-string-editor` | Duplicate URL/query-string tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Query String Parser | `web-query-string-parser` | Duplicate URL/query-string tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Referrer-Policy Reference & Tester | `web-referrer-policy-reference` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Regex Cheatsheet & Builder | `web-regex-cheatsheet` | Duplicate regex tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Regex Escape / Unescape | `web-regex-escape` | Duplicate regex tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Regex Match Against Lines | `web-regex-match-lines` | Duplicate regex tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Regex Named Group Reference Converter | `web-regex-named-group-converter` | Duplicate regex tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Set-Cookie Header Builder | `web-set-cookie-builder` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Set-Cookie String Builder | `web-cookie-string-builder` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Text Data URI Builder | `web-data-uri-builder-text` | Duplicate image data-uri/base64/placeholder/gradient tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | URL Builder | `web-url-builder` | Duplicate URL/query-string tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | URL Inspector | `web-url-inspector` | Duplicate URL/query-string tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | URL Normalizer | `web-url-normalizer` | Duplicate URL/query-string tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | URL Path Joiner & Normalizer | `web-url-path-joiner` | Duplicate URL/query-string tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | URL Query Param Sorter | `web-url-query-sorter` | Duplicate URL/query-string tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | URL Query Params Diff | `web-query-params-diff` | Duplicate URL/query-string tools; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | WWW-Authenticate Parser | `web-www-authenticate-parser` | Duplicate HTTP/header builders; functionality should be merged into one broader tool instead of separate single-purpose pages. |
| Merge into broader tool | High | web | Z-Index Scale Generator | `web-z-index-scale-generator` | Duplicate CSS generators; functionality should be merged into one broader tool instead of separate single-purpose pages. |

## Deprioritize / remove if trimming further

These are lower-confidence than the above, but they are still likely unnecessary for a focused utility-tools product.

| Action | Confidence | Category | Tool | Slug | Why |
|---|---:|---|---|---|---|
| Deprioritize / remove if trimming | Medium | color | CSS Named Colors | `named-colors` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | color | Material Design Color Palette | `material-colors` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | color | Nearest Pantone-Style Name (Approx) | `nearest-pantone-name` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | color | Nearest Tailwind Color | `nearest-tailwind-color` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | color | Tailwind Color Finder | `tailwind-colors` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | convert | Baking Pan Size Converter | `cooking-pan-size-converter` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | convert | Clothing Size Converter | `clothing-size-converter` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | convert | Currency Subunit & Naming Reference | `currency-unit-naming` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | convert | Ingredient Weight to Volume Converter | `ingredient-weight-volume-converter` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | convert | Oven Temperature Converter | `cooking-temperature-converter` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | convert | Ring Size Converter | `ring-size-converter` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | convert | Shoe Size Converter | `shoe-size-converter` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | encoding | Percent-Encoding Reference Table | `encoding-percent-encoding-table` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | generators | BIC / SWIFT Code Test Generator | `bic-swift-test-generator` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | generators | Credit Card Number Generator | `generate-credit-card` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | generators | Email Alias Generator | `email-alias-generator` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | generators | Fake Address Generator | `fake-address-generator` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | generators | Fake Company Generator | `fake-company-generator` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | generators | Fake User Profile Generator | `fake-user-profile-generator` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | generators | IP / CIDR Test Range Generator | `ip-cidr-list-generator` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | generators | Phone Number Format Generator | `phone-number-format-generator` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | generators | Random Coordinates Generator | `random-coordinates-generator` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | generators | Random Date Generator | `generate-random-date` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | generators | Random Datetime Generator | `random-date-range-generator` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | generators | Random IP Address Generator | `fake-ipv4-ipv6-generator` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | generators | SSN-Format Test Number Generator | `ssn-format-test-generator` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | generators | Test Card Number Set Generator | `generators-fake-credit-card-luhn-set` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | generators | Username Generator | `random-username-generator` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | math | Cooking Measurement Converter | `cooking-converter` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | math | Currency Amount to Words | `currency-amount-to-words` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | text | Random Name & Username Generator | `random-name-generator` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | text | Username Handle Generator | `text-text-to-handle-generator` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | time | Date Format Token Reference | `date-format-token-reference` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | time | Datetime Format Examples Reference | `time-server-format-reference` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | web | Content-Type & Charset Reference | `web-content-type-charset-reference` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | web | HTML Entity Picker | `web-html-entity-picker` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | web | HTTP Headers Reference | `web-http-headers-reference` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |
| Deprioritize / remove if trimming | Medium | web | HTTP Method Reference | `web-http-method-reference` | Niche/reference/test-data generator with limited general demand, high maintenance surface, or region-specific assumptions. |

## Suggested consolidation targets

- **Generators**: keep password/passphrase, UUID/ULID/NanoID, QR payload, lorem, barcode, fake data, and maybe `.gitignore`; remove documentation/config scaffolds.
- **Color**: keep one universal converter, one contrast checker, one palette/harmony generator, one image color extractor; remove pairwise RGB/HSL/LAB/etc. pages and novelty palette variants.
- **Data**: keep JSON formatter/validator, JSON diff, JSON query, CSV viewer/cleaner, JSON↔CSV/NDJSON/YAML; merge language-specific JSON model generators into one "JSON to code model" tool.
- **Web**: keep URL parser/builder, JWT decoder, cookie parser, HTTP status/MIME lookup, cURL builder/converter, CSS minify/specificity; remove most one-off header/config generators.
- **Text/Encoding**: keep core case, regex, diff, word count, markdown, Base64/hex/URL/Unicode/Morse; remove puzzle ciphers and novelty Unicode styling.
- **Time/Math**: keep timestamp, timezone, date difference/business days, cron parser, unit converter, percentage, finance basics; remove entertainment calendars and split duplicate percent/finance pages.

## Notes

- This report is based on registry metadata and the generated docs, not a judgment of implementation correctness. `docs/TOOL-TEST-REPORT.md` says the 995 pages mount successfully, but successful mounting does not mean the tool belongs in the product.
- No files were deleted. This is a removal/merge shortlist for product curation.

## Implementation follow-up

Applied on 2026-06-03:

- Removed the 83 high-confidence `Remove` candidates from `tools/**`.
- Regenerated the live registry and generated docs at 912 tools.
- Removed matching package catalog subpaths from `@open-utility-tools/core`.
- Removed the seven direct core time APIs for removed novelty time tools.
- Left merge/consolidation and medium-confidence candidates for explicit consolidation work.
