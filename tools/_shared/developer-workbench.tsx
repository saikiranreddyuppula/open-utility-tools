'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eraser, RotateCw } from 'lucide-react';

import {
  getDefaultDeveloperToolValues,
  getDeveloperToolDefinition,
  runDeveloperTool,
  type DeveloperToolDefinition,
  type DeveloperToolField,
  type DeveloperToolResult,
} from '@/lib/developer-tools/core';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Field, OptionsBar, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export function DeveloperToolPage({ slug }: { slug: string }) {
  const definition = getDeveloperToolDefinition(slug);
  if (!definition) {
    return <ErrorBanner error={`Unknown developer tool: ${slug}`} />;
  }
  return <DeveloperToolWorkbench definition={definition} />;
}

function DeveloperToolWorkbench({ definition }: { definition: DeveloperToolDefinition }) {
  const defaults = useMemo(() => getDefaultDeveloperToolValues(definition), [definition]);
  const [values, setValues] = useState<Record<string, string>>(defaults);
  const [result, setResult] = useState<DeveloperToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    setValues(defaults);
  }, [defaults]);

  const update = useCallback((field: string, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();
    void runDeveloperTool(definition.slug, values)
      .then((next) => {
        if (cancelled) return;
        setResult(next);
        setError(null);
        setElapsed(performance.now() - started);
      })
      .catch((err) => {
        if (cancelled) return;
        setResult(null);
        setError(err instanceof Error ? err.message : String(err));
        setElapsed(performance.now() - started);
      });
    return () => {
      cancelled = true;
    };
  }, [definition.slug, values]);

  const output = result?.output ?? '';

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        {definition.fields.map((field) => (
          <WorkbenchField
            key={field.id}
            field={field}
            value={values[field.id] ?? field.defaultValue}
            onChange={(next) => update(field.id, next)}
          />
        ))}
      </OptionsBar>

      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={() => setValues(defaults)}>
          <RotateCw className="size-3.5" />
          Reset
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setValues(Object.fromEntries(definition.fields.map((field) => [field.id, ''])))
          }
        >
          <Eraser className="size-3.5" />
          Clear
        </Button>
      </div>

      <ErrorBanner error={error} />

      <Panel>
        <PanelHeader title={result?.title ?? definition.name}>
          <CopyButton value={output} disabled={!output} />
          <DownloadButton
            data={output}
            filename={`${definition.slug}.txt`}
            mime="text/plain"
            disabled={!output}
            label="Download"
          />
        </PanelHeader>
        <Textarea
          readOnly
          value={output}
          spellCheck={false}
          placeholder="Result appears here..."
          className={cn(
            'min-h-[220px] resize-y rounded-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0 dark:bg-transparent',
            result?.outputLanguage === 'text' && 'whitespace-pre-wrap',
          )}
        />
        <StatBar
          items={[
            result?.stats.join(' | '),
            elapsed != null && `${elapsed < 1 ? '<1' : Math.round(elapsed)}ms`,
          ]}
        />
      </Panel>

      {result?.warnings.length ? (
        <Panel>
          <PanelHeader title="Warnings" />
          <div className="space-y-1 p-3 font-mono text-xs text-muted-foreground">
            {result.warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </div>
        </Panel>
      ) : null}

      {result?.sections.map((section) => (
        <Panel key={section.title}>
          <PanelHeader title={section.title}>
            <CopyButton value={section.body} disabled={!section.body} />
          </PanelHeader>
          <Textarea
            readOnly
            value={section.body}
            spellCheck={false}
            className="min-h-[160px] resize-y rounded-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
      ))}
    </div>
  );
}

function WorkbenchField({
  field,
  value,
  onChange,
}: {
  field: DeveloperToolField;
  value: string;
  onChange: (value: string) => void;
}) {
  const wide = field.type === 'textarea';
  return (
    <Field label={field.label} className={wide ? 'min-w-full flex-1' : 'min-w-[180px]'}>
      {field.type === 'textarea' ? (
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          spellCheck={false}
          rows={field.rows ?? 10}
          className="font-mono text-sm"
        />
      ) : field.type === 'select' ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === 'checkbox' ? (
        <div className="flex h-9 items-center">
          <Switch checked={value === 'true'} onCheckedChange={(checked) => onChange(String(checked))} />
        </div>
      ) : (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          spellCheck={false}
          className="font-mono"
        />
      )}
    </Field>
  );
}
