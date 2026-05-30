'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Scale = 'std4' | 'plus4' | 'scale43' | 'weighted5';

interface Course {
  id: number;
  name: string;
  credits: string;
  grade: string;
}

const SCALES: Record<Scale, { label: string; map: Record<string, number> }> = {
  std4: {
    label: '4.0 standard',
    map: { A: 4, B: 3, C: 2, D: 1, F: 0 },
  },
  plus4: {
    label: '4.0 with +/-',
    map: {
      'A+': 4.0,
      A: 4.0,
      'A-': 3.7,
      'B+': 3.3,
      B: 3.0,
      'B-': 2.7,
      'C+': 2.3,
      C: 2.0,
      'C-': 1.7,
      'D+': 1.3,
      D: 1.0,
      'D-': 0.7,
      F: 0.0,
    },
  },
  scale43: {
    label: '4.3 scale',
    map: {
      'A+': 4.3,
      A: 4.0,
      'A-': 3.7,
      'B+': 3.3,
      B: 3.0,
      'B-': 2.7,
      'C+': 2.3,
      C: 2.0,
      'C-': 1.7,
      'D+': 1.3,
      D: 1.0,
      'D-': 0.7,
      F: 0.0,
    },
  },
  weighted5: {
    label: '5.0 weighted (honors)',
    map: { A: 5, B: 4, C: 3, D: 2, F: 0 },
  },
};

type Result =
  | { error: string }
  | {
      gpa: number;
      totalCredits: number;
      totalPoints: number;
      rows: { name: string; credits: number; grade: string; gp: number; points: number }[];
    };

let nextId = 4;

export default function GpaCalculator() {
  const [scale, setScale] = useState<Scale>('plus4');
  const [courses, setCourses] = useState<Course[]>([
    { id: 0, name: 'Calculus I', credits: '4', grade: 'A' },
    { id: 1, name: 'English', credits: '3', grade: 'B+' },
    { id: 2, name: 'Physics', credits: '4', grade: 'A-' },
    { id: 3, name: 'History', credits: '3', grade: 'B' },
  ]);

  const update = (id: number, patch: Partial<Course>) => {
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const add = () => {
    setCourses((prev) => [...prev, { id: nextId++, name: '', credits: '3', grade: 'A' }]);
  };
  const remove = (id: number) => {
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const result = useMemo<Result>(() => {
    const scaleDef = SCALES[scale];
    const map = scaleDef.map;
    const rows: { name: string; credits: number; grade: string; gp: number; points: number }[] = [];
    let totalCredits = 0;
    let totalPoints = 0;

    const usable = courses.filter((c) => c.credits.trim() !== '' || c.grade.trim() !== '');
    if (usable.length === 0) return { error: 'Add at least one course with credits and a grade.' };

    for (const c of usable) {
      const credits = Number(c.credits);
      if (!Number.isFinite(credits) || credits <= 0) {
        return { error: `Credits for "${c.name || 'a course'}" must be a positive number.` };
      }
      const g = c.grade.trim().toUpperCase();
      const gp = map[g];
      if (gp === undefined) {
        return {
          error: `Grade "${c.grade}" is not valid for the ${scaleDef.label} scale.`,
        };
      }
      const points = credits * gp;
      totalCredits += credits;
      totalPoints += points;
      rows.push({ name: c.name || '(untitled)', credits, grade: g, gp, points });
    }

    if (totalCredits === 0) return { error: 'Total credits cannot be zero.' };
    return { gpa: totalPoints / totalCredits, totalCredits, totalPoints, rows };
  }, [courses, scale]);

  const validGrades = Object.keys(SCALES[scale].map).join(', ');

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Grade scale">
            <Select value={scale} onValueChange={(v) => setScale(v as Scale)}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SCALES) as Scale[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SCALES[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Valid grades">
            <span className="font-mono text-xs text-muted-foreground">{validGrades}</span>
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="Courses">
          <Button variant="secondary" size="sm" onClick={add}>
            <Plus className="size-3.5" /> Add course
          </Button>
        </PanelHeader>
        <div className="divide-y">
          {courses.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <Input
                value={c.name}
                onChange={(e) => update(c.id, { name: e.target.value })}
                placeholder="Course name"
                className="min-w-[160px] flex-1"
              />
              <Input
                value={c.credits}
                onChange={(e) => update(c.id, { credits: e.target.value })}
                placeholder="Credits"
                inputMode="decimal"
                className="w-24"
              />
              <Input
                value={c.grade}
                onChange={(e) => update(c.id, { grade: e.target.value })}
                placeholder="Grade"
                className="w-24 font-mono uppercase"
              />
              <Button variant="ghost" size="icon-sm" onClick={() => remove(c.id)} aria-label="Remove course">
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="GPA">
              <CopyButton value={() => result.gpa.toFixed(3)} />
            </PanelHeader>
            <div className="p-4">
              <p className="text-3xl font-semibold tabular-nums">{result.gpa.toFixed(3)}</p>
            </div>
            <StatBar
              items={[
                `Total credits: ${result.totalCredits}`,
                `Total quality points: ${result.totalPoints.toFixed(2)}`,
                `Scale: ${SCALES[scale].label}`,
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Per-course quality points" />
            <div className="divide-y font-mono text-xs">
              {result.rows.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className="w-16 text-right text-muted-foreground">{r.credits} cr</span>
                  <span className="w-12 text-right">{r.grade}</span>
                  <span className="w-12 text-right text-muted-foreground">{r.gp.toFixed(1)}</span>
                  <span className="w-16 text-right">{r.points.toFixed(2)} pts</span>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
