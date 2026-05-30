'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Runtime = 'node' | 'python' | 'go' | 'nginx' | 'generic';

interface Preset {
  label: string;
  baseImage: string;
  slimImage: string;
  workdir: string;
  install: string;
  copyBuild: string;
  build: string;
  port: string;
  start: string;
}

const PRESETS: Record<Runtime, Preset> = {
  node: {
    label: 'Node.js',
    baseImage: 'node:20',
    slimImage: 'node:20-slim',
    workdir: '/app',
    install: 'npm ci',
    copyBuild: 'COPY . .',
    build: 'npm run build',
    port: '3000',
    start: 'node dist/index.js',
  },
  python: {
    label: 'Python',
    baseImage: 'python:3.12',
    slimImage: 'python:3.12-slim',
    workdir: '/app',
    install: 'pip install --no-cache-dir -r requirements.txt',
    copyBuild: 'COPY . .',
    build: '',
    port: '8000',
    start: 'python -m app',
  },
  go: {
    label: 'Go',
    baseImage: 'golang:1.22',
    slimImage: 'gcr.io/distroless/static-debian12',
    workdir: '/src',
    install: 'go mod download',
    copyBuild: 'COPY . .',
    build: 'CGO_ENABLED=0 go build -o /app ./...',
    port: '8080',
    start: '/app',
  },
  nginx: {
    label: 'Nginx (static site)',
    baseImage: 'node:20',
    slimImage: 'nginx:1.27-alpine',
    workdir: '/app',
    install: 'npm ci',
    copyBuild: 'COPY . .',
    build: 'npm run build',
    port: '80',
    start: 'nginx -g "daemon off;"',
  },
  generic: {
    label: 'Generic',
    baseImage: 'debian:bookworm-slim',
    slimImage: 'debian:bookworm-slim',
    workdir: '/app',
    install: '',
    copyBuild: 'COPY . .',
    build: '',
    port: '8080',
    start: './start.sh',
  },
};

const DOCKERIGNORE: Record<Runtime, string[]> = {
  node: ['node_modules', 'npm-debug.log', 'dist', '.git', '.env', 'Dockerfile', '.dockerignore'],
  python: ['__pycache__', '*.pyc', '.venv', 'env', '.git', '.env', 'Dockerfile', '.dockerignore'],
  go: ['*.test', '*.out', '.git', '.env', 'Dockerfile', '.dockerignore'],
  nginx: ['node_modules', 'dist', '.git', '.env', 'Dockerfile', '.dockerignore'],
  generic: ['.git', '.env', 'Dockerfile', '.dockerignore', '*.log'],
};

export default function DockerfileGeneratorTool() {
  const [runtime, setRuntime] = useState<Runtime>('node');
  const [baseImage, setBaseImage] = useState(PRESETS.node.baseImage);
  const [workdir, setWorkdir] = useState(PRESETS.node.workdir);
  const [installCmd, setInstallCmd] = useState(PRESETS.node.install);
  const [buildCmd, setBuildCmd] = useState(PRESETS.node.build);
  const [port, setPort] = useState(PRESETS.node.port);
  const [startCmd, setStartCmd] = useState(PRESETS.node.start);
  const [multiStage, setMultiStage] = useState(true);
  const [nonRoot, setNonRoot] = useState(true);
  const [healthcheck, setHealthcheck] = useState(false);
  const [withIgnore, setWithIgnore] = useState(true);

  const applyPreset = (rt: Runtime) => {
    const p = PRESETS[rt];
    setRuntime(rt);
    setBaseImage(p.baseImage);
    setWorkdir(p.workdir);
    setInstallCmd(p.install);
    setBuildCmd(p.build);
    setPort(p.port);
    setStartCmd(p.start);
  };

  /** Build a CMD/ENTRYPOINT exec-array from a shell-ish command string. */
  const toExecArray = (cmd: string): string => {
    const parts = cmd.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '["sh"]';
    return `[${parts.map((p) => JSON.stringify(p)).join(', ')}]`;
  };

  const dockerfile = useMemo(() => {
    const preset = PRESETS[runtime];
    const lines: string[] = [];
    const wd = workdir.trim() || '/app';
    const base = baseImage.trim() || preset.baseImage;
    const slim = preset.slimImage;

    if (multiStage) {
      lines.push(`# syntax=docker/dockerfile:1`);
      lines.push(`# ---- build stage ----`);
      lines.push(`FROM ${base} AS builder`);
      lines.push(`WORKDIR ${wd}`);
      if (runtime === 'node' || runtime === 'nginx') {
        lines.push('COPY package*.json ./');
        if (installCmd.trim()) lines.push(`RUN ${installCmd.trim()}`);
      } else if (runtime === 'python') {
        lines.push('COPY requirements.txt ./');
        if (installCmd.trim()) lines.push(`RUN ${installCmd.trim()}`);
      } else if (runtime === 'go') {
        lines.push('COPY go.mod go.sum ./');
        if (installCmd.trim()) lines.push(`RUN ${installCmd.trim()}`);
      } else if (installCmd.trim()) {
        lines.push(`RUN ${installCmd.trim()}`);
      }
      lines.push(preset.copyBuild);
      if (buildCmd.trim()) lines.push(`RUN ${buildCmd.trim()}`);
      lines.push('');
      lines.push(`# ---- runtime stage ----`);
      lines.push(`FROM ${slim}`);
      lines.push(`WORKDIR ${wd}`);
      if (runtime === 'go') {
        lines.push('COPY --from=builder /app /app');
      } else if (runtime === 'nginx') {
        lines.push(`COPY --from=builder ${wd}/dist /usr/share/nginx/html`);
      } else {
        lines.push(`COPY --from=builder ${wd} ${wd}`);
      }
    } else {
      lines.push(`# syntax=docker/dockerfile:1`);
      lines.push(`FROM ${base}`);
      lines.push(`WORKDIR ${wd}`);
      if (runtime === 'node' || runtime === 'nginx') {
        lines.push('COPY package*.json ./');
        if (installCmd.trim()) lines.push(`RUN ${installCmd.trim()}`);
      } else if (runtime === 'python') {
        lines.push('COPY requirements.txt ./');
        if (installCmd.trim()) lines.push(`RUN ${installCmd.trim()}`);
      } else if (runtime === 'go') {
        lines.push('COPY go.mod go.sum ./');
        if (installCmd.trim()) lines.push(`RUN ${installCmd.trim()}`);
      } else if (installCmd.trim()) {
        lines.push(`RUN ${installCmd.trim()}`);
      }
      lines.push(preset.copyBuild);
      if (buildCmd.trim()) lines.push(`RUN ${buildCmd.trim()}`);
    }

    if (nonRoot && runtime !== 'nginx') {
      lines.push('');
      lines.push('# run as an unprivileged user');
      lines.push('RUN useradd --uid 10001 --create-home appuser || adduser -D -u 10001 appuser');
      lines.push('USER appuser');
    }

    const p = port.trim();
    if (p) {
      lines.push('');
      lines.push(`EXPOSE ${p}`);
    }

    if (healthcheck && p) {
      lines.push('');
      lines.push(
        `HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\`
      );
      lines.push(`  CMD wget -qO- http://localhost:${p}/ || exit 1`);
    }

    lines.push('');
    if (runtime === 'nginx') {
      lines.push(`CMD ["nginx", "-g", "daemon off;"]`);
    } else {
      lines.push(`CMD ${toExecArray(startCmd)}`);
    }

    return lines.join('\n') + '\n';
  }, [
    runtime,
    baseImage,
    workdir,
    installCmd,
    buildCmd,
    port,
    startCmd,
    multiStage,
    nonRoot,
    healthcheck,
  ]);

  const ignoreText = useMemo(() => {
    return (DOCKERIGNORE[runtime] ?? []).join('\n') + '\n';
  }, [runtime]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Runtime">
          <Select value={runtime} onValueChange={(v) => applyPreset(v as Runtime)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRESETS) as Runtime[]).map((rt) => (
                <SelectItem key={rt} value={rt}>
                  {PRESETS[rt].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Base image">
          <Input
            value={baseImage}
            onChange={(e) => setBaseImage(e.target.value)}
            className="w-44 font-mono"
          />
        </Field>
        <Field label="Workdir">
          <Input
            value={workdir}
            onChange={(e) => setWorkdir(e.target.value)}
            className="w-32 font-mono"
          />
        </Field>
        <Field label="Port">
          <Input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className="w-20 font-mono"
            inputMode="numeric"
          />
        </Field>
      </OptionsBar>

      <OptionsBar>
        <Field label="Install command" className="min-w-[220px] flex-1">
          <Input
            value={installCmd}
            onChange={(e) => setInstallCmd(e.target.value)}
            className="font-mono"
            placeholder="(none)"
          />
        </Field>
        <Field label="Build command" className="min-w-[200px] flex-1">
          <Input
            value={buildCmd}
            onChange={(e) => setBuildCmd(e.target.value)}
            className="font-mono"
            placeholder="(none)"
          />
        </Field>
        <Field label="Start command" className="min-w-[200px] flex-1">
          <Input
            value={startCmd}
            onChange={(e) => setStartCmd(e.target.value)}
            className="font-mono"
            placeholder="(none)"
          />
        </Field>
      </OptionsBar>

      <OptionsBar>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={multiStage} onCheckedChange={setMultiStage} id="ms" />
          <Label htmlFor="ms" className="text-xs text-muted-foreground">
            Multi-stage build
          </Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={nonRoot} onCheckedChange={setNonRoot} id="nr" />
          <Label htmlFor="nr" className="text-xs text-muted-foreground">
            Non-root USER
          </Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={healthcheck} onCheckedChange={setHealthcheck} id="hc" />
          <Label htmlFor="hc" className="text-xs text-muted-foreground">
            HEALTHCHECK
          </Label>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={withIgnore} onCheckedChange={setWithIgnore} id="di" />
          <Label htmlFor="di" className="text-xs text-muted-foreground">
            .dockerignore
          </Label>
        </label>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Dockerfile">
          <CopyButton value={() => dockerfile} />
          <DownloadButton data={() => dockerfile} filename="Dockerfile" />
        </PanelHeader>
        <pre className="overflow-auto p-3 font-mono text-xs">{dockerfile}</pre>
      </Panel>

      {withIgnore && (
        <Panel>
          <PanelHeader title=".dockerignore">
            <CopyButton value={() => ignoreText} />
            <DownloadButton data={() => ignoreText} filename=".dockerignore" />
          </PanelHeader>
          <pre className="overflow-auto p-3 font-mono text-xs">{ignoreText}</pre>
        </Panel>
      )}
    </div>
  );
}
