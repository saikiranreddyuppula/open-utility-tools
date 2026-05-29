#!/usr/bin/env bun
/** Lightweight correctness checks for pure-TS tool libraries.
 * Writes a JSON result to scripts/_selftest-result.json and exits non-zero on failure. */
import { parseColor, toHex, rgbToHsl, rgbToOklch, contrastRatio } from '../lib/color/convert';
import { parseCsv, jsonToCsv, csvToJson } from '../lib/data/csv';
import { diffLines, diffStats } from '../lib/text/diff';
import { cases } from '../lib/text/case';
import { uuidV4, ulid, nanoid } from '../lib/generators/ids';
import { toRoman, fromRoman } from '../lib/math/roman';
import { convertUnit, UNIT_CATEGORIES } from '../lib/math/units';
import { textToMorse, morseToText } from '../lib/text/morse';
import { gcd, lcm, isPrime, primeFactors } from '../lib/math/numbers';
import { yamlToJson, jsonToYaml } from '../lib/data/yaml';
import { markdownToHtml } from '../lib/text/markdown';
import { jsonToTypeScript } from '../lib/data/json-to-ts';
import { explainCron, parseCron, nextRuns } from '../lib/time/cron';
import { evaluateExpression } from '../lib/math/expr';

const failures: string[] = [];
let pass = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else failures.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};
const ok = (name: string, cond: boolean) => {
  if (cond) pass++;
  else failures.push(name);
};

// color
const red = parseColor('#ff0000');
eq('parse #ff0000', red, { r: 255, g: 0, b: 0, a: 1 });
eq('toHex red', red ? toHex(red) : null, '#ff0000');
eq('hsl red', red ? rgbToHsl(red) : null, { h: 0, s: 100, l: 50 });
eq('parse rgb()', parseColor('rgb(91, 91, 214)'), { r: 91, g: 91, b: 214, a: 1 });
eq('contrast b/w', contrastRatio({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 }), 21);
ok('oklch white L~1', rgbToOklch({ r: 255, g: 255, b: 255, a: 1 }).l >= 0.99);

// data
eq('parseCsv quoted', parseCsv('a,"b,c",d'), [['a', 'b,c', 'd']]);
const csv = jsonToCsv([{ x: 1, y: 'hi, there' }, { x: 2, z: true }]);
eq('jsonToCsv header', csv.split('\n')[0], 'x,y,z');
ok('jsonToCsv quote comma', csv.includes('"hi, there"'));
eq('csvToJson roundtrip', csvToJson('a,b\n1,2'), [{ a: '1', b: '2' }]);
eq('yaml roundtrip', yamlToJson(jsonToYaml({ a: 1, b: [2, 3] } as never)), { a: 1, b: [2, 3] });

// text
eq('diff stats', diffStats(diffLines('a\nb\nc', 'a\nx\nc')), { added: 1, removed: 1, unchanged: 2 });
eq('camel', cases.camel('hello world foo'), 'helloWorldFoo');
eq('snake', cases.snake('helloWorld'), 'hello_world');
eq('kebab', cases.kebab('Hello World'), 'hello-world');
eq('constant', cases.constant('fooBar'), 'FOO_BAR');
eq('morse SOS', textToMorse('SOS'), '... --- ...');
eq('morse roundtrip', morseToText(textToMorse('HELLO WORLD')), 'HELLO WORLD');
ok('md heading', markdownToHtml('# Hi').includes('<h1>Hi</h1>'));
ok('md xss-safe', markdownToHtml('<script>x</script>').includes('&lt;script&gt;'));

// generators
ok('uuidV4 format', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuidV4()));
ok('ulid length', ulid().length === 26);
ok('nanoid length', nanoid(21).length === 21);

// math
eq('toRoman 2024', toRoman(2024), 'MMXXIV');
eq('fromRoman MCMXCIV', fromRoman('MCMXCIV'), 1994);
eq('gcd(12,18)', gcd(12, 18), 6);
eq('lcm(4,6)', lcm(4, 6), 12);
ok('isPrime 97', isPrime(97));
ok('isPrime 100 false', !isPrime(100));
eq('factors 360', primeFactors(360), [2, 2, 2, 3, 3, 5]);
const len = UNIT_CATEGORIES.find((c) => c.id === 'length')!;
const m = len.units.find((u) => u.id === 'm')!;
const ft = len.units.find((u) => u.id === 'ft')!;
ok('1m to ft ~3.28', Math.abs(convertUnit(1, m, ft) - 3.28084) < 0.001);
const temp = UNIT_CATEGORIES.find((c) => c.id === 'temperature')!;
const C = temp.units.find((u) => u.id === 'C')!;
const F = temp.units.find((u) => u.id === 'F')!;
ok('100C to F = 212', Math.abs(convertUnit(100, C, F) - 212) < 0.01);
ok('0C to F = 32', Math.abs(convertUnit(0, C, F) - 32) < 0.01);

// codegen + cron
ok('json-to-ts interface', jsonToTypeScript({ id: 1, name: 'x' }, 'Root').includes('export interface Root'));
ok('json-to-ts number', jsonToTypeScript({ n: 5 }, 'Root').includes('n: number'));
eq('cron fields', parseCron('*/15 9-17 * * 1-5').length, 5);
eq('cron @daily', explainCron('@daily'), 'at 00:00');
eq('cron weekday', explainCron('30 14 * * *'), 'at 14:30');
ok('cron next runs', nextRuns('0 9 * * 1-5', 3, new Date('2024-01-01T00:00:00Z')).length === 3);
eq('expr precedence', evaluateExpression('2 + 3 * 4'), 14);
eq('expr variadic max', evaluateExpression('max(3, 7, 2)'), 7);
eq('expr power', evaluateExpression('2 ^ 10'), 1024);
ok('expr trig', Math.abs(evaluateExpression('sin(pi/6)') - 0.5) < 1e-9);

await Bun.write(
  new URL('./_selftest-result.json', import.meta.url),
  JSON.stringify({ pass, fail: failures.length, failures }, null, 2)
);
process.exit(Math.min(failures.length, 120));
