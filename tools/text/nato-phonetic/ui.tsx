'use client';

import { useCallback } from 'react';

import { TextToolLayout } from '@/components/tools/text-tool';

const NATO: Record<string, string> = {
  a: 'Alpha', b: 'Bravo', c: 'Charlie', d: 'Delta', e: 'Echo', f: 'Foxtrot',
  g: 'Golf', h: 'Hotel', i: 'India', j: 'Juliett', k: 'Kilo', l: 'Lima',
  m: 'Mike', n: 'November', o: 'Oscar', p: 'Papa', q: 'Quebec', r: 'Romeo',
  s: 'Sierra', t: 'Tango', u: 'Uniform', v: 'Victor', w: 'Whiskey', x: 'X-ray',
  y: 'Yankee', z: 'Zulu',
  '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
  '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine',
};

export default function NatoPhoneticTool() {
  const transform = useCallback((input: string) => {
    return input
      .split('\n')
      .map((line) =>
        Array.from(line)
          .map((ch) => {
            const lower = ch.toLowerCase();
            if (NATO[lower]) return NATO[lower];
            if (ch === ' ') return '(space)';
            return ch;
          })
          .join(' ')
      )
      .join('\n');
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="Text"
      outputLabel="Phonetic"
      sample="SOS 2024"
      downloadName="phonetic.txt"
    />
  );
}
