'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

type View = 'json' | 'openapi';

/** Naive English pluralizer covering common cases. */
function pluralize(word: string): string {
  const w = word.trim();
  if (!w) return w;
  if (/(s|x|z|ch|sh)$/i.test(w)) return `${w}es`;
  if (/[^aeiou]y$/i.test(w)) return `${w.slice(0, -1)}ies`;
  return `${w}s`;
}

interface Route {
  method: string;
  path: string;
  desc: string;
}

export default function JsonServerRoutesGenerator() {
  const [resources, setResources] = useState('users\nposts\ncomments');
  const [basePath, setBasePath] = useState('/api');
  const [doPluralize, setDoPluralize] = useState(true);
  const [idParam, setIdParam] = useState('id');
  const [nested, setNested] = useState(false);
  const [view, setView] = useState<View>('json');

  const data = useMemo(() => {
    const names = resources
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((n) => n.replace(/[^A-Za-z0-9_-]/g, ''))
      .filter(Boolean);

    const base = basePath.trim().replace(/\/+$/, '');
    const id = (idParam.trim() || 'id').replace(/[^A-Za-z0-9_]/g, '') || 'id';

    const routeMap: Record<string, Route[]> = {};
    const allRoutes: Route[] = [];

    for (const name of names) {
      const collection = doPluralize ? pluralize(name) : name;
      const coll = `${base}/${collection}`;
      const item = `${coll}/{${id}}`;
      const routes: Route[] = [
        { method: 'GET', path: coll, desc: `List all ${collection}` },
        { method: 'POST', path: coll, desc: `Create a ${name}` },
        { method: 'GET', path: item, desc: `Get a single ${name} by ${id}` },
        { method: 'PUT', path: item, desc: `Replace a ${name}` },
        { method: 'PATCH', path: item, desc: `Update a ${name}` },
        { method: 'DELETE', path: item, desc: `Delete a ${name}` },
      ];
      if (nested && names.length > 1) {
        // Add a nested sub-resource list route for illustration.
        const sub = doPluralize ? pluralize(name) : name;
        routes.push({
          method: 'GET',
          path: `${base}/{parent}/{parentId}/${sub}`,
          desc: `List ${sub} nested under a parent`,
        });
      }
      routeMap[collection] = routes;
      for (const r of routes) allRoutes.push(r);
    }

    return { routeMap, allRoutes, names, id };
  }, [resources, basePath, doPluralize, idParam, nested]);

  const jsonOut = useMemo(() => JSON.stringify(data.routeMap, null, 2), [data.routeMap]);

  const openapiOut = useMemo(() => {
    // Group routes by path, then by lowercased method, producing a paths fragment.
    const byPath: Record<string, Route[]> = {};
    for (const r of data.allRoutes) {
      const arr = byPath[r.path];
      if (arr) arr.push(r);
      else byPath[r.path] = [r];
    }
    const lines: string[] = ['paths:'];
    for (const [path, routes] of Object.entries(byPath)) {
      lines.push(`  ${path}:`);
      for (const r of routes) {
        lines.push(`    ${r.method.toLowerCase()}:`);
        lines.push(`      summary: ${r.desc}`);
        if (path.includes(`{${data.id}}`)) {
          lines.push('      parameters:');
          lines.push(`        - name: ${data.id}`);
          lines.push('          in: path');
          lines.push('          required: true');
          lines.push('          schema:');
          lines.push('            type: string');
        }
        lines.push('      responses:');
        const ok = r.method === 'POST' ? '201' : r.method === 'DELETE' ? '204' : '200';
        lines.push(`        '${ok}':`);
        lines.push('          description: Success');
      }
    }
    return lines.join('\n') + '\n';
  }, [data.allRoutes, data.id]);

  const current = view === 'json' ? jsonOut : openapiOut;

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Base path">
          <Input value={basePath} onChange={(e) => setBasePath(e.target.value)} className="w-32 font-mono" />
        </Field>
        <Field label="ID param">
          <Input value={idParam} onChange={(e) => setIdParam(e.target.value)} className="w-24 font-mono" />
        </Field>
        <Field label="Pluralize">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={doPluralize} onCheckedChange={setDoPluralize} id="jr-plural" />
            <Label htmlFor="jr-plural" className="text-xs text-muted-foreground">
              {doPluralize ? 'On' : 'Off'}
            </Label>
          </div>
        </Field>
        <Field label="Nested routes">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={nested} onCheckedChange={setNested} id="jr-nested" />
            <Label htmlFor="jr-nested" className="text-xs text-muted-foreground">
              {nested ? 'On' : 'Off'}
            </Label>
          </div>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Resource names (one per line)" />
        <Textarea
          value={resources}
          onChange={(e) => setResources(e.target.value)}
          spellCheck={false}
          className="min-h-24 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
          placeholder="users"
        />
      </Panel>

      <Panel>
        <PanelHeader title="Routes">
          <CopyButton value={() => current} />
          <DownloadButton
            data={() => current}
            filename={view === 'json' ? 'routes.json' : 'openapi-paths.yaml'}
          />
        </PanelHeader>
        <div className="border-b bg-muted/20 px-3 py-2">
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="json">JSON map</TabsTrigger>
              <TabsTrigger value="openapi">OpenAPI paths</TabsTrigger>
            </TabsList>
            <TabsContent value="json" />
            <TabsContent value="openapi" />
          </Tabs>
        </div>
        <pre className="max-h-[440px] overflow-auto p-3 font-mono text-xs">{current}</pre>
        <StatBar items={[`${data.names.length} resources`, `${data.allRoutes.length} routes`]} />
      </Panel>
    </div>
  );
}
