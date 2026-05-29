'use client';

import { useState } from 'react';

import { GeneratorList } from '@/components/tools/generator-list';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const webcrypto = (
  globalThis as unknown as {
    crypto: { getRandomValues<T extends ArrayBufferView>(a: T): T; randomUUID(): string };
  }
).crypto;

// Crockford Base32 (no I, L, O, U).
const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function encodeTime(now: number): string {
  let t = now;
  let str = '';
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    const mod = t % 32;
    str = (ENCODING[mod] ?? '0') + str;
    t = (t - mod) / 32;
  }
  return str;
}

function encodeRandom(): string {
  // 80 random bits -> 16 Crockford base32 chars (5 bits each).
  const bytes = new Uint8Array(RANDOM_LEN);
  webcrypto.getRandomValues(bytes);
  let str = '';
  for (let i = 0; i < RANDOM_LEN; i++) {
    str += ENCODING[(bytes[i] ?? 0) % 32] ?? '0';
  }
  return str;
}

export default function UlidGeneratorTool() {
  const [caseMode, setCaseMode] = useState<'upper' | 'lower'>('upper');

  const gen = () => {
    const ulid = encodeTime(Date.now()) + encodeRandom();
    return caseMode === 'lower' ? ulid.toLowerCase() : ulid;
  };

  return (
    <GeneratorList
      generate={gen}
      deps={[caseMode]}
      downloadName="ulids.txt"
      label="ULIDs"
      options={
        <Field label="Case" hint="The ULID spec uses uppercase; lowercase is also valid.">
          <Tabs value={caseMode} onValueChange={(v) => setCaseMode(v as 'upper' | 'lower')}>
            <TabsList>
              <TabsTrigger value="upper">Uppercase</TabsTrigger>
              <TabsTrigger value="lower">Lowercase</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
      }
    />
  );
}
