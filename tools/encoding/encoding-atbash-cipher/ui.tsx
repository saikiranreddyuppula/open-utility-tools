'use client';

import { useCallback } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';

const A = 'a'.charCodeAt(0);
const Z = 'z'.charCodeAt(0);
const UA = 'A'.charCodeAt(0);
const UZ = 'Z'.charCodeAt(0);

function atbash(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= A && code <= Z) {
      // a(0)<->z(25): mirror = z - (c - a)
      out += String.fromCharCode(Z - (code - A));
    } else if (code >= UA && code <= UZ) {
      out += String.fromCharCode(UZ - (code - UA));
    } else {
      out += input[i] ?? '';
    }
  }
  return out;
}

export default function AtbashCipherTool() {
  // Atbash is its own inverse, so encode and decode are identical.
  const transform = useCallback((input: string) => atbash(input), []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="Text"
      outputLabel="Atbash"
      inputPlaceholder="Type text to transform…"
      sample="The quick brown fox jumps over the lazy dog."
      downloadName="atbash.txt"
    />
  );
}
