'use client';

import { useCallback } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';

function rot47(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code >= 33 && code <= 126) {
      out += String.fromCharCode(33 + ((code - 33 + 47) % 94));
    } else {
      out += input[i] ?? '';
    }
  }
  return out;
}

export default function Rot47EncoderTool() {
  const transform = useCallback((input: string) => {
    if (!input) return '';
    return rot47(input);
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="Text"
      outputLabel="ROT47"
      inputPlaceholder="Enter text to encode or decode"
      sample="Hello, World!"
      downloadName="rot47.txt"
    />
  );
}
