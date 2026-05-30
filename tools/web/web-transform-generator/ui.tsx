'use client';

import { useMemo, useState } from 'react';
import {
  Panel,
  PanelHeader,
  OptionsBar,
  Field,
  StatBar,
} from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Unit = 'px' | '%';

export default function TransformGeneratorTool() {
  const [translateX, setTranslateX] = useState(40);
  const [translateY, setTranslateY] = useState(0);
  const [translateUnit, setTranslateUnit] = useState<Unit>('px');
  const [scaleX, setScaleX] = useState(1);
  const [scaleY, setScaleY] = useState(1);
  const [rotate, setRotate] = useState(15);
  const [skewX, setSkewX] = useState(0);
  const [skewY, setSkewY] = useState(0);
  const [origin, setOrigin] = useState('center');

  const [enable3d, setEnable3d] = useState(false);
  const [perspective, setPerspective] = useState(600);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(20);
  const [rotateZ, setRotateZ] = useState(0);

  const round = (n: number) => Math.round(n * 1000) / 1000;

  const transformValue = useMemo(() => {
    const parts: string[] = [];
    if (enable3d && perspective > 0) parts.push(`perspective(${Math.round(perspective)}px)`);

    if (translateX !== 0 || translateY !== 0) {
      if (translateY === 0) {
        parts.push(`translateX(${round(translateX)}${translateUnit})`);
      } else if (translateX === 0) {
        parts.push(`translateY(${round(translateY)}${translateUnit})`);
      } else {
        parts.push(
          `translate(${round(translateX)}${translateUnit}, ${round(translateY)}${translateUnit})`,
        );
      }
    }

    if (scaleX !== 1 || scaleY !== 1) {
      if (scaleX === scaleY) parts.push(`scale(${round(scaleX)})`);
      else parts.push(`scale(${round(scaleX)}, ${round(scaleY)})`);
    }

    if (rotate !== 0) parts.push(`rotate(${round(rotate)}deg)`);

    if (enable3d) {
      if (rotateX !== 0) parts.push(`rotateX(${round(rotateX)}deg)`);
      if (rotateY !== 0) parts.push(`rotateY(${round(rotateY)}deg)`);
      if (rotateZ !== 0) parts.push(`rotateZ(${round(rotateZ)}deg)`);
    }

    if (skewX !== 0) parts.push(`skewX(${round(skewX)}deg)`);
    if (skewY !== 0) parts.push(`skewY(${round(skewY)}deg)`);

    return parts.length ? parts.join(' ') : 'none';
  }, [
    enable3d,
    perspective,
    translateX,
    translateY,
    translateUnit,
    scaleX,
    scaleY,
    rotate,
    rotateX,
    rotateY,
    rotateZ,
    skewX,
    skewY,
  ]);

  const css = useMemo(
    () => `transform: ${transformValue};\ntransform-origin: ${origin};`,
    [transformValue, origin],
  );

  const sliderRow = (
    label: string,
    value: number,
    set: (n: number) => void,
    min: number,
    max: number,
    step = 1,
  ) => (
    <Field label={`${label}: ${value}`}>
      <div className="flex items-center gap-3">
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={(v) => {
            const next = v[0];
            if (next != null && Number.isFinite(next)) set(next);
          }}
          className="flex-1"
        />
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) set(n);
          }}
          className="w-20 font-mono"
        />
      </div>
    </Field>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel>
        <PanelHeader title="Controls" />
        <div className="flex flex-col gap-3 p-3">
          <OptionsBar className="rounded-md">
            <Field label="Translate unit">
              <Select value={translateUnit} onValueChange={(v) => setTranslateUnit(v as Unit)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="px">px</SelectItem>
                  <SelectItem value="%">%</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="transform-origin">
              <Select value={origin} onValueChange={setOrigin}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    'center',
                    'top left',
                    'top',
                    'top right',
                    'left',
                    'right',
                    'bottom left',
                    'bottom',
                    'bottom right',
                  ].map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="3D transforms">
              <Switch checked={enable3d} onCheckedChange={setEnable3d} />
            </Field>
          </OptionsBar>

          {sliderRow('translateX', translateX, setTranslateX, -300, 300)}
          {sliderRow('translateY', translateY, setTranslateY, -300, 300)}
          {sliderRow('scaleX', scaleX, setScaleX, 0, 3, 0.1)}
          {sliderRow('scaleY', scaleY, setScaleY, 0, 3, 0.1)}
          {sliderRow('rotate', rotate, setRotate, -360, 360)}
          {sliderRow('skewX', skewX, setSkewX, -90, 90)}
          {sliderRow('skewY', skewY, setSkewY, -90, 90)}

          {enable3d && (
            <>
              {sliderRow('perspective', perspective, setPerspective, 0, 2000, 10)}
              {sliderRow('rotateX', rotateX, setRotateX, -360, 360)}
              {sliderRow('rotateY', rotateY, setRotateY, -360, 360)}
              {sliderRow('rotateZ', rotateZ, setRotateZ, -360, 360)}
            </>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Preview">
          <CopyButton value={css} />
        </PanelHeader>
        <div className="flex min-h-[260px] items-center justify-center overflow-hidden rounded-md border bg-muted/40 p-8">
          <div
            className="flex h-28 w-44 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-lg"
            style={{ transform: transformValue, transformOrigin: origin }}
          >
            Box
          </div>
        </div>
        <div className="flex items-center gap-2 p-3">
          <pre className="block flex-1 overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-sm leading-relaxed">
            {css}
          </pre>
          <CopyButton value={css} />
        </div>
        <StatBar
          items={[transformValue === 'none' ? 'identity' : transformValue, `origin: ${origin}`]}
        />
      </Panel>
    </div>
  );
}
