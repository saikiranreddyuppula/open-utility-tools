'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Preset = 'app' | 'postgres' | 'mysql' | 'redis' | 'mongo' | 'nginx' | 'mailhog';

interface Service {
  id: number;
  preset: Preset;
  name: string;
  image: string;
  ports: string; // one "host:container" per line
  env: string; // one KEY=value per line
  volumes: string; // one "named:/path" or "./host:/path" per line
  dependsOn: string; // one service name per line
}

interface PresetDef {
  image: string;
  ports: string;
  env: string;
  volumes: string;
  volumeName: string; // top-level named volume, '' if none
  healthcheck: string[]; // body lines (without the "healthcheck:" key), indented relative to service
}

const PRESETS: Record<Preset, PresetDef> = {
  app: {
    image: 'node:20-alpine',
    ports: '3000:3000',
    env: 'NODE_ENV=production',
    volumes: './:/app',
    volumeName: '',
    healthcheck: [
      'test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]',
      'interval: 30s',
      'timeout: 5s',
      'retries: 3',
    ],
  },
  postgres: {
    image: 'postgres:16-alpine',
    ports: '5432:5432',
    env: 'POSTGRES_USER=postgres\nPOSTGRES_PASSWORD=changeme\nPOSTGRES_DB=app',
    volumes: 'pgdata:/var/lib/postgresql/data',
    volumeName: 'pgdata',
    healthcheck: [
      'test: ["CMD-SHELL", "pg_isready -U postgres"]',
      'interval: 10s',
      'timeout: 5s',
      'retries: 5',
    ],
  },
  mysql: {
    image: 'mysql:8',
    ports: '3306:3306',
    env: 'MYSQL_ROOT_PASSWORD=changeme\nMYSQL_DATABASE=app\nMYSQL_USER=app\nMYSQL_PASSWORD=changeme',
    volumes: 'mysqldata:/var/lib/mysql',
    volumeName: 'mysqldata',
    healthcheck: [
      'test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]',
      'interval: 10s',
      'timeout: 5s',
      'retries: 5',
    ],
  },
  redis: {
    image: 'redis:7-alpine',
    ports: '6379:6379',
    env: '',
    volumes: 'redisdata:/data',
    volumeName: 'redisdata',
    healthcheck: [
      'test: ["CMD", "redis-cli", "ping"]',
      'interval: 10s',
      'timeout: 3s',
      'retries: 5',
    ],
  },
  mongo: {
    image: 'mongo:7',
    ports: '27017:27017',
    env: 'MONGO_INITDB_ROOT_USERNAME=root\nMONGO_INITDB_ROOT_PASSWORD=changeme',
    volumes: 'mongodata:/data/db',
    volumeName: 'mongodata',
    healthcheck: [
      'test: ["CMD", "mongosh", "--eval", "db.adminCommand(\'ping\')"]',
      'interval: 10s',
      'timeout: 5s',
      'retries: 5',
    ],
  },
  nginx: {
    image: 'nginx:alpine',
    ports: '80:80',
    env: '',
    volumes: './nginx.conf:/etc/nginx/nginx.conf:ro',
    volumeName: '',
    healthcheck: [
      'test: ["CMD", "wget", "-qO-", "http://localhost/"]',
      'interval: 30s',
      'timeout: 5s',
      'retries: 3',
    ],
  },
  mailhog: {
    image: 'mailhog/mailhog:latest',
    ports: '1025:1025\n8025:8025',
    env: '',
    volumes: '',
    volumeName: '',
    healthcheck: [],
  },
};

let nextId = 3;

function makeService(preset: Preset, name: string): Service {
  const def = PRESETS[preset];
  return {
    id: nextId++,
    preset,
    name,
    image: def.image,
    ports: def.ports,
    env: def.env,
    volumes: def.volumes,
    dependsOn: '',
  };
}

function lines(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean);
}

// Quote a YAML scalar only when it contains characters that need it.
function yamlScalar(s: string): string {
  if (s === '') return '""';
  if (/^[A-Za-z0-9._/:@+-]+$/.test(s) && !/^(true|false|null|yes|no|on|off)$/i.test(s) && !/^\d+$/.test(s)) {
    return s;
  }
  if (/^\d+$/.test(s)) return `"${s}"`;
  if (/[:#{}[\],&*!|>'"%@`]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

export default function DockerComposeGeneratorTool() {
  const [version, setVersion] = useState('3.9');
  const [restart, setRestart] = useState('unless-stopped');
  const [healthchecks, setHealthchecks] = useState(false);
  const [services, setServices] = useState<Service[]>([
    (() => { const s = makeService('app', 'web'); s.dependsOn = 'db'; return s; })(),
    makeService('postgres', 'db'),
  ]);
  const [addPreset, setAddPreset] = useState<Preset>('redis');

  const addService = () => {
    const base = addPreset === 'app' ? 'app' : addPreset;
    let name = base;
    let n = 2;
    const existing = new Set(services.map((s) => s.name));
    while (existing.has(name)) name = `${base}${n++}`;
    setServices((p) => [...p, makeService(addPreset, name)]);
  };
  const removeService = (id: number) => setServices((p) => p.filter((s) => s.id !== id));
  const update = (id: number, patch: Partial<Service>) =>
    setServices((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const output = useMemo(() => {
    const out: string[] = [];
    if (version.trim()) out.push(`version: "${version.trim()}"`);
    out.push('');
    out.push('services:');

    const namedVolumes = new Set<string>();

    for (const s of services) {
      const name = s.name.trim() || 'service';
      out.push(`  ${name}:`);
      out.push(`    image: ${yamlScalar(s.image.trim() || 'alpine:latest')}`);
      if (restart.trim() && restart !== 'no') out.push(`    restart: ${restart}`);

      const ports = lines(s.ports);
      if (ports.length) {
        out.push('    ports:');
        for (const p of ports) out.push(`      - ${yamlScalar(p)}`);
      }

      const env = lines(s.env);
      if (env.length) {
        out.push('    environment:');
        for (const e of env) {
          const eq = e.indexOf('=');
          if (eq === -1) {
            out.push(`      ${yamlScalar(e)}: ""`);
          } else {
            const key = e.slice(0, eq).trim();
            const val = e.slice(eq + 1).trim();
            out.push(`      ${key}: ${yamlScalar(val)}`);
          }
        }
      }

      const vols = lines(s.volumes);
      if (vols.length) {
        out.push('    volumes:');
        for (const v of vols) {
          out.push(`      - ${yamlScalar(v)}`);
          // A named volume (no leading ./ or /) needs a top-level declaration.
          const left = (v.split(':')[0] ?? '').trim();
          if (left && !left.startsWith('.') && !left.startsWith('/')) namedVolumes.add(left);
        }
      }

      const deps = lines(s.dependsOn);
      if (deps.length) {
        out.push('    depends_on:');
        for (const d of deps) out.push(`      - ${d}`);
      }

      if (healthchecks) {
        const hc = PRESETS[s.preset].healthcheck;
        if (hc.length) {
          out.push('    healthcheck:');
          for (const line of hc) out.push(`      ${line}`);
        }
      }

      out.push('    networks:');
      out.push('      - appnet');
      out.push('');
    }

    if (namedVolumes.size > 0) {
      out.push('volumes:');
      for (const v of Array.from(namedVolumes).sort()) out.push(`  ${v}:`);
      out.push('');
    }

    out.push('networks:');
    out.push('  appnet:');
    out.push('    driver: bridge');
    out.push('');

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
  }, [version, restart, healthchecks, services]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Compose version">
          <Select value={version} onValueChange={setVersion}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3.9">3.9</SelectItem>
              <SelectItem value="3.8">3.8</SelectItem>
              <SelectItem value="3">3</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Restart policy">
          <Select value={restart} onValueChange={setRestart}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="no">no</SelectItem>
              <SelectItem value="on-failure">on-failure</SelectItem>
              <SelectItem value="always">always</SelectItem>
              <SelectItem value="unless-stopped">unless-stopped</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Healthchecks">
          <div className="flex h-9 items-center gap-2">
            <Switch checked={healthchecks} onCheckedChange={setHealthchecks} id="hc" />
            <Label htmlFor="hc" className="text-xs text-muted-foreground">include</Label>
          </div>
        </Field>
        <Field label="Add service">
          <div className="flex items-end gap-2">
            <Select value={addPreset} onValueChange={(v) => setAddPreset(v as Preset)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="app">app (custom)</SelectItem>
                <SelectItem value="postgres">postgres</SelectItem>
                <SelectItem value="mysql">mysql</SelectItem>
                <SelectItem value="redis">redis</SelectItem>
                <SelectItem value="mongo">mongo</SelectItem>
                <SelectItem value="nginx">nginx</SelectItem>
                <SelectItem value="mailhog">mailhog</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="secondary" size="sm" onClick={addService}>
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>
        </Field>
      </OptionsBar>

      {services.map((s) => (
        <Panel key={s.id}>
          <PanelHeader title={`${s.name || 'service'} · ${s.preset}`}>
            <Button variant="ghost" size="icon-sm" onClick={() => removeService(s.id)} aria-label="Remove service">
              <Trash2 className="size-3.5" />
            </Button>
          </PanelHeader>
          <div className="flex flex-col gap-3 p-3">
            <div className="flex flex-wrap gap-3">
              <Field label="Service name">
                <Input value={s.name} onChange={(e) => update(s.id, { name: e.target.value.replace(/\s+/g, '') })} className="w-40 font-mono" />
              </Field>
              <Field label="Image" className="min-w-[200px] flex-1">
                <Input value={s.image} onChange={(e) => update(s.id, { image: e.target.value })} className="font-mono" />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Ports (host:container, one per line)">
                <Textarea value={s.ports} onChange={(e) => update(s.id, { ports: e.target.value })} spellCheck={false} className="min-h-16 resize-y font-mono text-xs" placeholder="8080:80" />
              </Field>
              <Field label="Environment (KEY=value, one per line)">
                <Textarea value={s.env} onChange={(e) => update(s.id, { env: e.target.value })} spellCheck={false} className="min-h-16 resize-y font-mono text-xs" placeholder="KEY=value" />
              </Field>
              <Field label="Volumes (one per line)">
                <Textarea value={s.volumes} onChange={(e) => update(s.id, { volumes: e.target.value })} spellCheck={false} className="min-h-16 resize-y font-mono text-xs" placeholder="data:/var/lib" />
              </Field>
              <Field label="depends_on (service names, one per line)">
                <Textarea value={s.dependsOn} onChange={(e) => update(s.id, { dependsOn: e.target.value })} spellCheck={false} className="min-h-16 resize-y font-mono text-xs" placeholder="db" />
              </Field>
            </div>
          </div>
        </Panel>
      ))}

      <Panel>
        <PanelHeader title="docker-compose.yml">
          <CopyButton value={() => output} />
          <DownloadButton data={() => output} filename="docker-compose.yml" />
        </PanelHeader>
        <pre className="max-h-[480px] overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">{output}</pre>
        <StatBar items={[`${services.length} services`, `compose ${version}`]} />
      </Panel>
    </div>
  );
}
