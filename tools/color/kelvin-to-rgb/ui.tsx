'use client';

import { useCallback } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';

/**
 * Tanner Helland's black-body Kelvin -> RGB approximation.
 * Valid roughly for 1000K - 40000K.
 */
function kelvinToRgb(kelvin: number): [number, number, number] {
  const temp = Math.min(40000, Math.max(1000, kelvin)) / 100;

  let r: number;
  let g: number;
  let b: number;

  // Red
  if (temp <= 66) {
    r = 255;
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
  }

  // Green
  if (temp <= 66) {
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
  } else {
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
  }

  // Blue
  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
  }

  const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  return [clamp(r), clamp(g), clamp(b)];
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function describe(k: number): string {
  if (k < 2000) return 'very warm (candle / match flame)';
  if (k < 3000) return 'warm (incandescent / sunset)';
  if (k < 4000) return 'warm white (soft white bulb)';
  if (k < 5000) return 'neutral white';
  if (k < 5500) return 'cool white';
  if (k < 6500) return 'daylight';
  if (k < 8000) return 'overcast / shade';
  return 'very cool (blue sky)';
}

export default function KelvinToRgbTool() {
  const transform = useCallback((input: string) => {
    const lines = input
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return '';

    const out: string[] = [];
    for (const line of lines) {
      const cleaned = line.replace(/k$/i, '').trim();
      const k = Number(cleaned);
      if (!Number.isFinite(k)) {
        throw new Error(
          `"${line}" is not a valid temperature. Enter a number of Kelvin, e.g. 6500.`,
        );
      }
      if (k <= 0) {
        throw new Error('Color temperature must be a positive number of Kelvin.');
      }
      const rgb = kelvinToRgb(k);
      const note = k < 1000 || k > 40000 ? ' (clamped to 1000-40000K range)' : '';
      out.push(`${k}K  →  ${toHex(rgb)}  rgb(${rgb.join(', ')})  — ${describe(k)}${note}`);
    }
    return out.join('\n');
  }, []);

  return (
    <TextToolLayout
      transform={transform}
      inputLabel="Temperature (Kelvin)"
      outputLabel="RGB / HEX color"
      inputPlaceholder="Enter Kelvin values, one per line, e.g. 6500"
      sample={'1900\n2700\n3500\n5000\n6500\n9000'}
      downloadName="kelvin-colors.txt"
    />
  );
}
