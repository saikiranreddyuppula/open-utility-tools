'use client';

import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, ClipboardPaste, Eraser, Info, Upload } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { cn } from '@/lib/utils';

import {
  composeToDockerRun,
  dockerRunToCompose,
  type ComposeToRunOptions,
  type RunToComposeOptions,
  type Warning,
} from './logic';

type Direction = 'run2compose' | 'compose2run';

const MAX_CHARS = 400_000;

const SAMPLE_RUN = `# A web server, its database and a GPU job
docker run -d --name web \\
  -p 8080:80 \\
  -e APP_ENV=production \\
  -v $(pwd)/html:/usr/share/nginx/html:ro \\
  --restart unless-stopped \\
  --health-cmd="curl -f http://localhost/ || exit 1" --health-interval=30s \\
  nginx:1.25

docker run -d --name db \\
  -e POSTGRES_PASSWORD=example \\
  -v pgdata:/var/lib/postgresql/data \\
  --network backend --network-alias database \\
  -m 512m --cpus 1.5 \\
  postgres:16

docker run --rm -it --gpus all nvidia/cuda:12.2.0-base-ubuntu22.04 nvidia-smi
`;

const SAMPLE_COMPOSE = `services:
  web:
    image: nginx:1.25
    container_name: web
    ports:
      - "8080:80"
    volumes:
      - ./html:/usr/share/nginx/html:ro
    environment:
      APP_ENV: production
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost/ || exit 1"]
      interval: 30s
    depends_on:
      - db
  db:
    image: postgres:16
    container_name: db
    environment:
      POSTGRES_PASSWORD: example
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      backend:
        aliases:
          - database
    deploy:
      resources:
        limits:
          cpus: "1.5"
          memory: 512m
volumes:
  pgdata: {}
networks:
  backend: {}
`;

interface Outcome {
  output: string;
  error: string | null;
  warnings: Warning[];
  unknown: string[];
  stats: string[];
}

const EMPTY: Outcome = { output: '', error: null, warnings: [], unknown: [], stats: [] };

function convert(
  dir: Direction,
  text: string,
  a: RunToComposeOptions,
  b: ComposeToRunOptions
): Outcome {
  if (!text.trim()) return EMPTY;
  if (text.length > MAX_CHARS) {
    return { ...EMPTY, error: `Input is too large (${text.length.toLocaleString()} characters; the limit is ${MAX_CHARS.toLocaleString()}).` };
  }
  try {
    if (dir === 'run2compose') {
      const r = dockerRunToCompose(text, a);
      return {
        output: r.yaml,
        error: null,
        warnings: r.warnings,
        unknown: r.unknown,
        stats: [
          `${r.services.length} service${r.services.length === 1 ? '' : 's'}`,
          r.volumes.length > 0 && `${r.volumes.length} volume${r.volumes.length === 1 ? '' : 's'}`,
          r.networks.length > 0 && `${r.networks.length} network${r.networks.length === 1 ? '' : 's'}`,
        ].filter((x): x is string => !!x),
      };
    }
    const r = composeToDockerRun(text, b);
    return {
      output: r.script,
      error: null,
      warnings: r.warnings,
      unknown: [],
      stats: [`${r.commandCount} docker run command${r.commandCount === 1 ? '' : 's'}`],
    };
  } catch (e) {
    return { ...EMPTY, error: e instanceof Error ? e.message : String(e) };
  }
}

export default function DockerRunComposeConverter() {
  const [dir, setDir] = useState<Direction>('run2compose');
  const [inputA, setInputA] = useState(SAMPLE_RUN);
  const [inputB, setInputB] = useState(SAMPLE_COMPOSE);
  const [envStyle, setEnvStyle] = useState<RunToComposeOptions['envStyle']>('map');
  const [resources, setResources] = useState<RunToComposeOptions['resources']>('deploy');
  const [networks, setNetworks] = useState<RunToComposeOptions['networks']>('external');
  const [detach, setDetach] = useState(true);
  const [multiline, setMultiline] = useState(true);
  const [createResources, setCreateResources] = useState(true);
  const [rm, setRm] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const input = dir === 'run2compose' ? inputA : inputB;
  const setInput = dir === 'run2compose' ? setInputA : setInputB;
  const deferred = useDeferredValue(input);

  const outcome = useMemo(
    () =>
      convert(
        dir,
        deferred,
        { envStyle, resources, networks },
        { detach, multiline, createResources, rm }
      ),
    [dir, deferred, envStyle, resources, networks, detach, multiline, createResources, rm]
  );

  const reverse = () => {
    if (!outcome.output) return;
    if (dir === 'run2compose') {
      setInputB(outcome.output);
      setDir('compose2run');
    } else {
      setInputA(outcome.output);
      setDir('run2compose');
    }
  };

  const onUpload = async (file: File) => {
    setUploadError(null);
    if (file.size > MAX_CHARS * 2) {
      setUploadError('That file is too large.');
      return;
    }
    try {
      setInput(await file.text());
    } catch {
      setUploadError('Could not read that file.');
    }
  };

  const areaClass =
    'h-[28rem] resize-y rounded-none border-0 bg-transparent font-mono text-[13px] leading-5 shadow-none field-sizing-fixed focus-visible:ring-0 dark:bg-transparent';
  const areaStyle = { whiteSpace: 'pre' as const, overflow: 'auto' as const };
  const warns = outcome.warnings.filter((w) => w.level === 'warn');
  const infos = outcome.warnings.filter((w) => w.level === 'info');

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Direction">
          <Tabs value={dir} onValueChange={(v) => setDir(v as Direction)}>
            <TabsList>
              <TabsTrigger value="run2compose" data-testid="dir-run2compose">docker run → Compose</TabsTrigger>
              <TabsTrigger value="compose2run" data-testid="dir-compose2run">Compose → docker run</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        {dir === 'run2compose' ? (
          <>
            <Field label="environment:">
              <Tabs value={envStyle} onValueChange={(v) => setEnvStyle(v as RunToComposeOptions['envStyle'])}>
                <TabsList>
                  <TabsTrigger value="map">Map</TabsTrigger>
                  <TabsTrigger value="list">List</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label="CPU / memory limits">
              <Tabs value={resources} onValueChange={(v) => setResources(v as RunToComposeOptions['resources'])}>
                <TabsList>
                  <TabsTrigger value="deploy">deploy.resources</TabsTrigger>
                  <TabsTrigger value="service">mem_limit / cpus</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
            <Field label="Custom networks">
              <Tabs value={networks} onValueChange={(v) => setNetworks(v as RunToComposeOptions['networks'])}>
                <TabsList>
                  <TabsTrigger value="external">external: true</TabsTrigger>
                  <TabsTrigger value="define">Define in file</TabsTrigger>
                </TabsList>
              </Tabs>
            </Field>
          </>
        ) : (
          <>
            <Field label="Detached (-d)">
              <Switch checked={detach} onCheckedChange={setDetach} aria-label="Detached" />
            </Field>
            <Field label="Add --rm">
              <Switch checked={rm} onCheckedChange={setRm} aria-label="Add --rm" />
            </Field>
            <Field label="One option per line">
              <Switch checked={multiline} onCheckedChange={setMultiline} aria-label="Multi-line output" />
            </Field>
            <Field label="Create networks / volumes">
              <Switch checked={createResources} onCheckedChange={setCreateResources} aria-label="Include network and volume create commands" />
            </Field>
          </>
        )}
      </OptionsBar>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title={dir === 'run2compose' ? 'docker run commands' : 'compose.yaml'}>
            <Button
              variant="ghost"
              size="sm"
              title="Load an example"
              onClick={() => setInput(dir === 'run2compose' ? SAMPLE_RUN : SAMPLE_COMPOSE)}
            >
              Sample
            </Button>
            <Button
              variant="ghost"
              size="sm"
              title="Paste from clipboard"
              onClick={async () => {
                try {
                  setInput(await navigator.clipboard.readText());
                } catch {
                  /* clipboard blocked */
                }
              }}
            >
              <ClipboardPaste className="size-3.5" />
              Paste
            </Button>
            <Button variant="ghost" size="sm" title="Open a file" onClick={() => uploadRef.current?.click()}>
              <Upload className="size-3.5" />
              Upload
            </Button>
            <input
              ref={uploadRef}
              type="file"
              accept=".yaml,.yml,.sh,.txt,text/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onUpload(f);
                e.target.value = '';
              }}
            />
            <Button variant="ghost" size="icon-sm" onClick={() => setInput('')} disabled={!input} title="Clear input">
              <Eraser className="size-3.5" />
            </Button>
          </PanelHeader>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              dir === 'run2compose'
                ? 'Paste one or more "docker run …" commands (multi-line with \\ is fine)…'
                : 'Paste a compose.yaml…'
            }
            spellCheck={false}
            wrap="off"
            aria-label={dir === 'run2compose' ? 'docker run commands' : 'compose.yaml'}
            className={areaClass}
            style={areaStyle}
          />
          <StatBar items={[`${input.length.toLocaleString()} chars`, `${input ? input.split('\n').length : 0} lines`]} />
        </Panel>

        <Panel>
          <PanelHeader title={dir === 'run2compose' ? 'compose.yaml' : 'docker run'}>
            <Button
              variant="ghost"
              size="sm"
              disabled={!outcome.output}
              title="Move the result into the other direction's input and switch"
              onClick={reverse}
            >
              <ArrowLeftRight className="size-3.5" />
              Reverse
            </Button>
            <CopyButton value={() => outcome.output} disabled={!outcome.output} />
            <DownloadButton
              data={() => outcome.output}
              filename={dir === 'run2compose' ? 'compose.yaml' : 'docker-run.sh'}
              mime={dir === 'run2compose' ? 'application/yaml' : 'text/x-shellscript'}
              disabled={!outcome.output}
            />
          </PanelHeader>
          <div className="relative flex-1">
            {outcome.error ? (
              <div className="p-3" data-testid="convert-error">
                <ErrorBanner error={outcome.error} />
              </div>
            ) : (
              <Textarea
                value={outcome.output}
                readOnly
                placeholder="Result appears here…"
                spellCheck={false}
                wrap="off"
                aria-label="Converted output"
                className={cn(areaClass, deferred !== input && 'opacity-60')}
                style={areaStyle}
              />
            )}
          </div>
          <StatBar items={outcome.stats} />
        </Panel>
      </div>

      <ErrorBanner error={uploadError} />

      {outcome.unknown.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm" data-testid="unknown-flags">
          <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="font-medium">Unknown flags (not converted):</span>
          {outcome.unknown.map((u, i) => (
            <Badge key={`${u}-${i}`} variant="outline" className="font-mono">
              {u}
            </Badge>
          ))}
        </div>
      )}

      {(warns.length > 0 || infos.length > 0) && (
        <Panel>
          <PanelHeader title={`Notes (${warns.length + infos.length})`} />
          <ul className="divide-y text-sm" data-testid="notes">
            {warns.map((w, i) => (
              <li key={`w${i}`} className="flex gap-2 px-3 py-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{w.message}</span>
              </li>
            ))}
            {infos.map((w, i) => (
              <li key={`i${i}`} className="flex gap-2 px-3 py-2 text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <p className="text-xs text-muted-foreground">
        Output follows the Compose Specification (no <code className="font-mono">version:</code> key). Flags that have no Compose
        equivalent (<code className="font-mono">--rm</code>, <code className="font-mono">-d</code>, <code className="font-mono">--cidfile</code>, …) are listed
        above instead of being dropped silently. Compose → run covers the common service keys; <code className="font-mono">depends_on</code>,{' '}
        <code className="font-mono">build</code> (emitted as a separate <code className="font-mono">docker build</code>),{' '}
        <code className="font-mono">secrets</code> and Swarm-only <code className="font-mono">deploy</code> settings are noted rather than converted.
        A built-in YAML reader is used (anchors, merge keys and block scalars are supported). Nothing leaves your browser.
      </p>
    </div>
  );
}
