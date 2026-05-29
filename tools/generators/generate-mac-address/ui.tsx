'use client';

import { useState } from 'react';
import { GeneratorList } from '@/components/tools/generator-list';
import { Field, OptionsBar } from '@/components/tools/panel';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const webcrypto = (
  globalThis as unknown as {
    crypto: {
      getRandomValues<T extends ArrayBufferView>(a: T): T;
      randomUUID(): string;
    };
  }
).crypto;

type Separator = 'colon' | 'hyphen' | 'dot';
type Casing = 'lower' | 'upper';

export default function MacAddressTool() {
  const [separator, setSeparator] = useState<Separator>('colon');
  const [casing, setCasing] = useState<Casing>('lower');
  const [localAdmin, setLocalAdmin] = useState(true);
  const [unicast, setUnicast] = useState(true);

  const gen = (): string => {
    const bytes = new Uint8Array(6);
    webcrypto.getRandomValues(bytes);

    // First octet carries the unicast/multicast (bit 0) and U/L (bit 1) flags.
    let first = bytes[0] ?? 0;
    // Unicast = clear bit 0; multicast = set bit 0.
    first = unicast ? first & 0xfe : first | 0x01;
    // Locally administered = set bit 1; universally administered (OUI) = clear bit 1.
    first = localAdmin ? first | 0x02 : first & 0xfd;
    bytes[0] = first;

    const hexParts = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
    const cased = casing === 'upper' ? hexParts.map((p) => p.toUpperCase()) : hexParts;

    if (separator === 'dot') {
      // Cisco-style dotted notation: three groups of four hex digits.
      const joined = cased.join('');
      const groups: string[] = [];
      for (let i = 0; i < joined.length; i += 4) {
        groups.push(joined.slice(i, i + 4));
      }
      return groups.join('.');
    }

    const sep = separator === 'hyphen' ? '-' : ':';
    return cased.join(sep);
  };

  return (
    <GeneratorList
      generate={gen}
      deps={[separator, casing, localAdmin, unicast]}
      downloadName="mac-addresses.txt"
      label="MAC addresses"
      options={
        <OptionsBar>
          <Field label="Separator">
            <Select value={separator} onValueChange={(v) => setSeparator(v as Separator)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="colon">Colon (00:11:..)</SelectItem>
                <SelectItem value="hyphen">Hyphen (00-11-..)</SelectItem>
                <SelectItem value="dot">Dot (0011.22..)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Case">
            <Select value={casing} onValueChange={(v) => setCasing(v as Casing)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lower">lowercase</SelectItem>
                <SelectItem value="upper">UPPERCASE</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Address bits">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={localAdmin}
                  onCheckedChange={(v) => setLocalAdmin(v === true)}
                />
                <span>Locally administered</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={unicast} onCheckedChange={(v) => setUnicast(v === true)} />
                <span>Unicast</span>
              </label>
            </div>
          </Field>
        </OptionsBar>
      }
    />
  );
}
