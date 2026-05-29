'use client';

import { useCallback, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Field } from '@/components/tools/panel';
import { GeneratorList } from '@/components/tools/generator-list';
import { nanoid } from '@/lib/generators/ids';

export default function NanoidGeneratorTool() {
  const [size, setSize] = useState(21);
  const generate = useCallback(() => nanoid(size), [size]);

  return (
    <GeneratorList
      generate={generate}
      deps={[size]}
      downloadName="nanoids.txt"
      label="Nano IDs"
      options={
        <Field label={`Length · ${size}`}>
          <Input
            type="number"
            min={2}
            max={64}
            value={size}
            onChange={(e) => setSize(Math.max(2, Math.min(Number(e.target.value) || 21, 64)))}
            className="w-24 font-mono"
          />
        </Field>
      }
    />
  );
}
