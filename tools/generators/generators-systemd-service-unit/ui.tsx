'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const RESTART_POLICIES = [
  'no',
  'on-success',
  'on-failure',
  'on-abnormal',
  'on-abort',
  'on-watchdog',
  'always',
] as const;
type RestartPolicy = (typeof RESTART_POLICIES)[number];

const SERVICE_TYPES = ['simple', 'exec', 'forking', 'oneshot', 'notify', 'dbus'] as const;
type ServiceType = (typeof SERVICE_TYPES)[number];

function isRestart(v: string): v is RestartPolicy {
  return (RESTART_POLICIES as readonly string[]).includes(v);
}
function isServiceType(v: string): v is ServiceType {
  return (SERVICE_TYPES as readonly string[]).includes(v);
}

interface BuildResult {
  text: string;
  error: string | null;
}

function build(opts: {
  description: string;
  execStart: string;
  workingDir: string;
  user: string;
  group: string;
  type: ServiceType;
  restart: RestartPolicy;
  restartSec: string;
  env: string;
  after: string;
  wantedBy: string;
}): BuildResult {
  const exec = opts.execStart.trim();
  if (!exec) return { text: '', error: 'ExecStart command is required.' };
  if (!isRestart(opts.restart)) {
    return { text: '', error: `Invalid restart policy: ${opts.restart}` };
  }

  const unit: string[] = ['[Unit]'];
  unit.push(`Description=${opts.description.trim() || 'My service'}`);
  const after = opts.after.trim();
  if (after) unit.push(`After=${after}`);

  const service: string[] = ['', '[Service]'];
  service.push(`Type=${opts.type}`);
  service.push(`ExecStart=${exec}`);
  const wd = opts.workingDir.trim();
  if (wd) service.push(`WorkingDirectory=${wd}`);
  const user = opts.user.trim();
  if (user) service.push(`User=${user}`);
  const group = opts.group.trim();
  if (group) service.push(`Group=${group}`);

  // Each non-empty env line "KEY=value" becomes an Environment= directive.
  const envLines = opts.env
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  for (const line of envLines) {
    if (!line.includes('=')) {
      return { text: '', error: `Environment entry must be KEY=value: "${line}"` };
    }
    const eq = line.indexOf('=');
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (!key) return { text: '', error: `Environment key is empty in: "${line}"` };
    // Quote the whole assignment if the value contains whitespace.
    const needQuote = /\s/.test(val);
    service.push(needQuote ? `Environment="${key}=${val}"` : `Environment=${key}=${val}`);
  }

  service.push(`Restart=${opts.restart}`);
  const rsec = opts.restartSec.trim();
  if (rsec && opts.restart !== 'no') service.push(`RestartSec=${rsec}`);

  const install: string[] = ['', '[Install]'];
  install.push(`WantedBy=${opts.wantedBy.trim() || 'multi-user.target'}`);

  const text = [...unit, ...service, ...install].join('\n') + '\n';
  return { text, error: null };
}

export default function SystemdServiceUnitTool() {
  const [description, setDescription] = useState('My background worker');
  const [execStart, setExecStart] = useState('/usr/local/bin/myapp --serve');
  const [workingDir, setWorkingDir] = useState('/opt/myapp');
  const [user, setUser] = useState('myapp');
  const [group, setGroup] = useState('');
  const [type, setType] = useState<ServiceType>('simple');
  const [restart, setRestart] = useState<RestartPolicy>('on-failure');
  const [restartSec, setRestartSec] = useState('5');
  const [env, setEnv] = useState('NODE_ENV=production\nPORT=8080');
  const [after, setAfter] = useState('network.target');
  const [wantedBy, setWantedBy] = useState('multi-user.target');

  const result = useMemo(
    () =>
      build({
        description,
        execStart,
        workingDir,
        user,
        group,
        type,
        restart,
        restartSec,
        env,
        after,
        wantedBy,
      }),
    [description, execStart, workingDir, user, group, type, restart, restartSec, env, after, wantedBy],
  );

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Description" className="min-w-[220px] flex-1">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="ExecStart" className="min-w-[260px] flex-1">
          <Input
            value={execStart}
            onChange={(e) => setExecStart(e.target.value)}
            className="font-mono"
            placeholder="/usr/bin/myapp"
          />
        </Field>
        <Field label="Type">
          <Select value={type} onValueChange={(v) => isServiceType(v) && setType(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Working dir">
          <Input
            value={workingDir}
            onChange={(e) => setWorkingDir(e.target.value)}
            className="font-mono"
          />
        </Field>
        <Field label="User">
          <Input value={user} onChange={(e) => setUser(e.target.value)} className="w-32 font-mono" />
        </Field>
        <Field label="Group">
          <Input value={group} onChange={(e) => setGroup(e.target.value)} className="w-32 font-mono" />
        </Field>
        <Field label="Restart">
          <Select value={restart} onValueChange={(v) => isRestart(v) && setRestart(v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESTART_POLICIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="RestartSec">
          <Input
            value={restartSec}
            onChange={(e) => setRestartSec(e.target.value)}
            className="w-24 font-mono"
            inputMode="numeric"
          />
        </Field>
        <Field label="After">
          <Input value={after} onChange={(e) => setAfter(e.target.value)} className="font-mono" />
        </Field>
        <Field label="WantedBy">
          <Input
            value={wantedBy}
            onChange={(e) => setWantedBy(e.target.value)}
            className="font-mono"
          />
        </Field>
        <Field label="Environment (one KEY=value per line)" className="min-w-[260px] flex-1">
          <Textarea
            value={env}
            onChange={(e) => setEnv(e.target.value)}
            spellCheck={false}
            rows={2}
            className="font-mono text-xs"
          />
        </Field>
      </OptionsBar>

      <ErrorBanner error={result.error} />

      {!result.error && (
        <Panel>
          <PanelHeader title="myapp.service">
            <CopyButton value={() => result.text} label="Copy" />
            <DownloadButton data={() => result.text} filename="myapp.service" />
          </PanelHeader>
          <pre className="max-h-[420px] overflow-auto p-3 font-mono text-xs leading-relaxed">
            {result.text}
          </pre>
          <StatBar
            items={[
              `Type=${type}`,
              `Restart=${restart}`,
              `${env.split('\n').filter((l) => l.trim()).length} env vars`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
