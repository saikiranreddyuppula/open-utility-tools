'use client';

import { useCallback } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';

// ROT47 operates on the 94 visible ASCII characters, codes 33 ('!') to 126 ('~').
// Each is shifted by 47 within that range. Because 47 is exactly half of 94,
// applying ROT47 twice restores the original text, so encode and decode are
// the same operation.
const RANGE_START = 33;
const RANGE_SIZE = 94;
const SHIFT = 47;

function rot47(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= RANGE_START && code <= RANGE_START + RANGE_SIZE - 1) {
      const rotated = ((code - RANGE_START + SHIFT) % RANGE_SIZE) + RANGE_START;
      out += String.fromCharCode(rotated);
    } else {
      out += input[i] ?? '';
    }
  }
  return out;
}

export default function Rot47Tool() {
  const transform = useCallback((input: string) => {
    if (!input) return '';
    return rot47(input);
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="Text"
      outputLabel="ROT47"
      inputPlaceholder="Encode or decode — ROT47 is symmetric"
      sample="Hello, World! ROT47 is reversible."
      downloadName="rot47.txt"
    />
  );
}
