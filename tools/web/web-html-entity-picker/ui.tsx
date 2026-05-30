'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';

interface Entity {
  name: string;
  cp: number;
  desc: string;
}

// [named reference (without &/;), code point, description]
const RAW: [string, number, string][] = [
  ['quot', 34, 'Double quotation mark'],
  ['amp', 38, 'Ampersand'],
  ['apos', 39, 'Apostrophe / single quote'],
  ['lt', 60, 'Less-than sign'],
  ['gt', 62, 'Greater-than sign'],
  ['nbsp', 160, 'Non-breaking space'],
  ['iexcl', 161, 'Inverted exclamation mark'],
  ['cent', 162, 'Cent sign'],
  ['pound', 163, 'Pound sterling sign'],
  ['curren', 164, 'Currency sign'],
  ['yen', 165, 'Yen sign'],
  ['brvbar', 166, 'Broken bar'],
  ['sect', 167, 'Section sign'],
  ['uml', 168, 'Diaeresis'],
  ['copy', 169, 'Copyright sign'],
  ['ordf', 170, 'Feminine ordinal indicator'],
  ['laquo', 171, 'Left-pointing double angle quotation'],
  ['not', 172, 'Not sign'],
  ['shy', 173, 'Soft hyphen'],
  ['reg', 174, 'Registered trademark sign'],
  ['macr', 175, 'Macron'],
  ['deg', 176, 'Degree sign'],
  ['plusmn', 177, 'Plus-minus sign'],
  ['sup2', 178, 'Superscript two'],
  ['sup3', 179, 'Superscript three'],
  ['acute', 180, 'Acute accent'],
  ['micro', 181, 'Micro sign'],
  ['para', 182, 'Pilcrow (paragraph) sign'],
  ['middot', 183, 'Middle dot'],
  ['cedil', 184, 'Cedilla'],
  ['sup1', 185, 'Superscript one'],
  ['ordm', 186, 'Masculine ordinal indicator'],
  ['raquo', 187, 'Right-pointing double angle quotation'],
  ['frac14', 188, 'Vulgar fraction one quarter'],
  ['frac12', 189, 'Vulgar fraction one half'],
  ['frac34', 190, 'Vulgar fraction three quarters'],
  ['iquest', 191, 'Inverted question mark'],
  ['Agrave', 192, 'Latin capital A with grave'],
  ['Aacute', 193, 'Latin capital A with acute'],
  ['Acirc', 194, 'Latin capital A with circumflex'],
  ['Atilde', 195, 'Latin capital A with tilde'],
  ['Auml', 196, 'Latin capital A with diaeresis'],
  ['Aring', 197, 'Latin capital A with ring above'],
  ['AElig', 198, 'Latin capital AE'],
  ['Ccedil', 199, 'Latin capital C with cedilla'],
  ['Egrave', 200, 'Latin capital E with grave'],
  ['Eacute', 201, 'Latin capital E with acute'],
  ['Ntilde', 209, 'Latin capital N with tilde'],
  ['Ouml', 214, 'Latin capital O with diaeresis'],
  ['times', 215, 'Multiplication sign'],
  ['Oslash', 216, 'Latin capital O with stroke'],
  ['Uuml', 220, 'Latin capital U with diaeresis'],
  ['szlig', 223, 'Latin small sharp s (eszett)'],
  ['agrave', 224, 'Latin small a with grave'],
  ['aacute', 225, 'Latin small a with acute'],
  ['acirc', 226, 'Latin small a with circumflex'],
  ['atilde', 227, 'Latin small a with tilde'],
  ['auml', 228, 'Latin small a with diaeresis'],
  ['aring', 229, 'Latin small a with ring above'],
  ['aelig', 230, 'Latin small ae'],
  ['ccedil', 231, 'Latin small c with cedilla'],
  ['egrave', 232, 'Latin small e with grave'],
  ['eacute', 233, 'Latin small e with acute'],
  ['ntilde', 241, 'Latin small n with tilde'],
  ['ouml', 246, 'Latin small o with diaeresis'],
  ['divide', 247, 'Division sign'],
  ['oslash', 248, 'Latin small o with stroke'],
  ['uuml', 252, 'Latin small u with diaeresis'],
  // Greek
  ['Alpha', 913, 'Greek capital Alpha'],
  ['Beta', 914, 'Greek capital Beta'],
  ['Gamma', 915, 'Greek capital Gamma'],
  ['Delta', 916, 'Greek capital Delta'],
  ['Epsilon', 917, 'Greek capital Epsilon'],
  ['Theta', 920, 'Greek capital Theta'],
  ['Lambda', 923, 'Greek capital Lambda'],
  ['Mu', 924, 'Greek capital Mu'],
  ['Pi', 928, 'Greek capital Pi'],
  ['Sigma', 931, 'Greek capital Sigma'],
  ['Phi', 934, 'Greek capital Phi'],
  ['Psi', 936, 'Greek capital Psi'],
  ['Omega', 937, 'Greek capital Omega'],
  ['alpha', 945, 'Greek small alpha'],
  ['beta', 946, 'Greek small beta'],
  ['gamma', 947, 'Greek small gamma'],
  ['delta', 948, 'Greek small delta'],
  ['epsilon', 949, 'Greek small epsilon'],
  ['theta', 952, 'Greek small theta'],
  ['lambda', 955, 'Greek small lambda'],
  ['mu', 956, 'Greek small mu'],
  ['pi', 960, 'Greek small pi'],
  ['sigma', 963, 'Greek small sigma'],
  ['phi', 966, 'Greek small phi'],
  ['omega', 969, 'Greek small omega'],
  // Punctuation
  ['ndash', 8211, 'En dash'],
  ['mdash', 8212, 'Em dash'],
  ['lsquo', 8216, 'Left single quotation mark'],
  ['rsquo', 8217, 'Right single quotation mark'],
  ['sbquo', 8218, 'Single low-9 quotation mark'],
  ['ldquo', 8220, 'Left double quotation mark'],
  ['rdquo', 8221, 'Right double quotation mark'],
  ['bdquo', 8222, 'Double low-9 quotation mark'],
  ['dagger', 8224, 'Dagger'],
  ['Dagger', 8225, 'Double dagger'],
  ['bull', 8226, 'Bullet'],
  ['hellip', 8230, 'Horizontal ellipsis'],
  ['permil', 8240, 'Per mille sign'],
  ['prime', 8242, 'Prime (minutes / feet)'],
  ['Prime', 8243, 'Double prime (seconds / inches)'],
  ['lsaquo', 8249, 'Single left angle quotation'],
  ['rsaquo', 8250, 'Single right angle quotation'],
  ['oline', 8254, 'Overline'],
  ['frasl', 8260, 'Fraction slash'],
  // Currency & symbols
  ['euro', 8364, 'Euro sign'],
  ['trade', 8482, 'Trademark sign'],
  // Arrows
  ['larr', 8592, 'Leftwards arrow'],
  ['uarr', 8593, 'Upwards arrow'],
  ['rarr', 8594, 'Rightwards arrow'],
  ['darr', 8595, 'Downwards arrow'],
  ['harr', 8596, 'Left-right arrow'],
  ['crarr', 8629, 'Carriage return arrow'],
  ['lArr', 8656, 'Leftwards double arrow'],
  ['uArr', 8657, 'Upwards double arrow'],
  ['rArr', 8658, 'Rightwards double arrow'],
  ['dArr', 8659, 'Downwards double arrow'],
  ['hArr', 8660, 'Left-right double arrow'],
  // Math
  ['forall', 8704, 'For all'],
  ['part', 8706, 'Partial differential'],
  ['exist', 8707, 'There exists'],
  ['empty', 8709, 'Empty set'],
  ['nabla', 8711, 'Nabla'],
  ['isin', 8712, 'Element of'],
  ['notin', 8713, 'Not an element of'],
  ['ni', 8715, 'Contains as member'],
  ['prod', 8719, 'N-ary product'],
  ['sum', 8721, 'N-ary summation'],
  ['minus', 8722, 'Minus sign'],
  ['lowast', 8727, 'Asterisk operator'],
  ['radic', 8730, 'Square root'],
  ['prop', 8733, 'Proportional to'],
  ['infin', 8734, 'Infinity'],
  ['ang', 8736, 'Angle'],
  ['and', 8743, 'Logical and'],
  ['or', 8744, 'Logical or'],
  ['cap', 8745, 'Intersection'],
  ['cup', 8746, 'Union'],
  ['int', 8747, 'Integral'],
  ['there4', 8756, 'Therefore'],
  ['sim', 8764, 'Tilde operator'],
  ['cong', 8773, 'Approximately equal to'],
  ['asymp', 8776, 'Almost equal to'],
  ['ne', 8800, 'Not equal to'],
  ['equiv', 8801, 'Identical to'],
  ['le', 8804, 'Less-than or equal to'],
  ['ge', 8805, 'Greater-than or equal to'],
  ['sub', 8834, 'Subset of'],
  ['sup', 8835, 'Superset of'],
  ['nsub', 8836, 'Not a subset of'],
  ['sube', 8838, 'Subset of or equal to'],
  ['supe', 8839, 'Superset of or equal to'],
  ['oplus', 8853, 'Circled plus'],
  ['otimes', 8855, 'Circled times'],
  ['perp', 8869, 'Perpendicular'],
  ['sdot', 8901, 'Dot operator'],
  // Misc symbols
  ['loz', 9674, 'Lozenge'],
  ['spades', 9824, 'Black spade suit'],
  ['clubs', 9827, 'Black club suit'],
  ['hearts', 9829, 'Black heart suit'],
  ['diams', 9830, 'Black diamond suit'],
  ['star', 9733, 'Black star'],
  ['check', 10003, 'Check mark'],
  ['cross', 10007, 'Ballot X'],
];

const DATA: Entity[] = RAW.map(([name, cp, desc]) => ({ name, cp, desc }));

function glyph(cp: number): string {
  return String.fromCodePoint(cp);
}

function hexRef(cp: number): string {
  return `&#x${cp.toString(16).toUpperCase()};`;
}

function decRef(cp: number): string {
  return `&#${cp};`;
}

function codePoint(cp: number): string {
  return `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;
}

export default function HtmlEntityPickerTool() {
  const [q, setQ] = useState('');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return DATA;
    return DATA.filter((d) =>
      `${d.name} ${d.desc} ${glyph(d.cp)} ${d.cp} ${codePoint(d.cp)}`
        .toLowerCase()
        .includes(s),
    );
  }, [q]);

  return (
    <Panel>
      <PanelHeader title="HTML Entities">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by name, glyph or description…"
          className="h-7 w-72"
          spellCheck={false}
        />
      </PanelHeader>
      <div className="max-h-[560px] divide-y overflow-auto">
        {rows.map((r) => {
          const named = `&${r.name};`;
          const dec = decRef(r.cp);
          const hex = hexRef(r.cp);
          return (
            <div
              key={`${r.name}-${r.cp}`}
              className="flex items-center gap-3 px-3 py-2"
            >
              <span className="flex w-10 shrink-0 items-center justify-center rounded-md border bg-muted/30 py-1 text-lg leading-none">
                {glyph(r.cp)}
              </span>
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-4">
                <span className="flex items-center gap-1 font-mono text-xs">
                  <span className="truncate">{named}</span>
                  <CopyButton value={named} size="icon-sm" />
                </span>
                <span className="flex items-center gap-1 font-mono text-xs">
                  <span className="truncate">{dec}</span>
                  <CopyButton value={dec} size="icon-sm" />
                </span>
                <span className="flex items-center gap-1 font-mono text-xs">
                  <span className="truncate">{hex}</span>
                  <CopyButton value={hex} size="icon-sm" />
                </span>
                <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                  <span className="truncate">{codePoint(r.cp)}</span>
                  <CopyButton value={glyph(r.cp)} size="icon-sm" />
                </span>
              </div>
              <span className="hidden min-w-0 max-w-[40%] flex-1 truncate text-xs text-muted-foreground md:block">
                {r.desc}
              </span>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No entities match “{q}”.
          </div>
        )}
      </div>
      <StatBar items={[`${rows.length} of ${DATA.length} entities`]} />
    </Panel>
  );
}
