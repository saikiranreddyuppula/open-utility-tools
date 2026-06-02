// Root entry. Domains are exposed as namespaces to avoid cross-domain name
// collisions; prefer the subpath imports (e.g. `@open-utility-tools/core/text`)
// for smaller bundles.
export * as text from './text';
export * as math from './math';
export * as color from './color';
export * as data from './data';
export * as time from './time';
export * as web from './web';
export * as generators from './generators';
export * as crypto from './crypto';
