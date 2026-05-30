'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';

interface HostBlock {
  alias: string;
  hostName: string;
  user: string;
  port: string;
  identityFile: string;
  proxyJump: string;
  forwardAgent: boolean;
  strictDisable: boolean;
}

function emptyBlock(): HostBlock {
  return {
    alias: '',
    hostName: '',
    user: '',
    port: '',
    identityFile: '',
    proxyJump: '',
    forwardAgent: false,
    strictDisable: false,
  };
}

function buildBlock(b: HostBlock): { text: string; portError: boolean } {
  const lines: string[] = [];
  const alias = b.alias.trim() || 'myhost';
  lines.push(`Host ${alias}`);
  if (b.hostName.trim()) lines.push(`  HostName ${b.hostName.trim()}`);
  if (b.user.trim()) lines.push(`  User ${b.user.trim()}`);

  let portError = false;
  if (b.port.trim()) {
    const p = Number(b.port.trim());
    if (Number.isInteger(p) && p >= 1 && p <= 65535) {
      lines.push(`  Port ${p}`);
    } else {
      portError = true;
      lines.push(`  # Port ${b.port.trim()}  (invalid: must be 1-65535)`);
    }
  }
  if (b.identityFile.trim()) {
    lines.push(`  IdentityFile ${b.identityFile.trim()}`);
    lines.push('  IdentitiesOnly yes');
  }
  if (b.proxyJump.trim()) lines.push(`  ProxyJump ${b.proxyJump.trim()}`);
  if (b.forwardAgent) lines.push('  ForwardAgent yes');
  if (b.strictDisable) {
    lines.push('  # Disables host-key verification — convenient but insecure');
    lines.push('  StrictHostKeyChecking no');
    lines.push('  UserKnownHostsFile /dev/null');
  }
  return { text: lines.join('\n'), portError };
}

export default function SshConfigBuilder() {
  const [blocks, setBlocks] = useState<HostBlock[]>([
    {
      alias: 'prod',
      hostName: '203.0.113.10',
      user: 'deploy',
      port: '22',
      identityFile: '~/.ssh/id_ed25519',
      proxyJump: '',
      forwardAgent: false,
      strictDisable: false,
    },
  ]);

  const update = (i: number, patch: Partial<HostBlock>) =>
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const add = () => setBlocks((prev) => [...prev, emptyBlock()]);
  const remove = (i: number) => setBlocks((prev) => prev.filter((_, idx) => idx !== i));

  const result = useMemo(() => {
    const built = blocks.map(buildBlock);
    const text = built.map((b) => b.text).join('\n\n') + '\n';

    const warnings: string[] = [];
    if (built.some((b) => b.portError)) {
      warnings.push('One or more ports are out of range (1-65535) and were commented out.');
    }
    // Duplicate alias detection.
    const seen = new Map<string, number>();
    for (const b of blocks) {
      const a = (b.alias.trim() || 'myhost').toLowerCase();
      seen.set(a, (seen.get(a) ?? 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, c]) => c > 1).map(([a]) => a);
    if (dupes.length > 0) {
      warnings.push(`Duplicate Host alias: ${dupes.join(', ')}. SSH only honors the first match.`);
    }
    return { text, warning: warnings.length ? warnings.join(' ') : null };
  }, [blocks]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Button variant="secondary" size="sm" onClick={add}>
          <Plus className="size-3.5" /> Add Host block
        </Button>
        <span className="text-xs text-muted-foreground">
          Only populated directives are emitted. Output goes in ~/.ssh/config.
        </span>
      </OptionsBar>

      <div className="grid gap-3">
        {blocks.map((b, i) => (
          <Panel key={i}>
            <PanelHeader title={`Host: ${b.alias.trim() || 'myhost'}`}>
              {blocks.length > 1 && (
                <Button variant="ghost" size="icon-sm" onClick={() => remove(i)}>
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </PanelHeader>
            <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
              <Field label="Host alias">
                <Input value={b.alias} onChange={(e) => update(i, { alias: e.target.value })} className="font-mono" placeholder="myhost" />
              </Field>
              <Field label="HostName (IP or domain)">
                <Input value={b.hostName} onChange={(e) => update(i, { hostName: e.target.value })} className="font-mono" />
              </Field>
              <Field label="User">
                <Input value={b.user} onChange={(e) => update(i, { user: e.target.value })} className="font-mono" />
              </Field>
              <Field label="Port">
                <Input value={b.port} onChange={(e) => update(i, { port: e.target.value })} className="font-mono" inputMode="numeric" placeholder="22" />
              </Field>
              <Field label="IdentityFile">
                <Input value={b.identityFile} onChange={(e) => update(i, { identityFile: e.target.value })} className="font-mono" placeholder="~/.ssh/id_ed25519" />
              </Field>
              <Field label="ProxyJump (bastion)">
                <Input value={b.proxyJump} onChange={(e) => update(i, { proxyJump: e.target.value })} className="font-mono" placeholder="user@bastion" />
              </Field>
              <Field label="ForwardAgent">
                <div className="flex h-8 items-center gap-2">
                  <Switch checked={b.forwardAgent} onCheckedChange={(c) => update(i, { forwardAgent: c })} id={`fa-${i}`} />
                  <Label htmlFor={`fa-${i}`} className="text-xs text-muted-foreground">
                    {b.forwardAgent ? 'yes' : 'no'}
                  </Label>
                </div>
              </Field>
              <Field label="Disable StrictHostKeyChecking">
                <div className="flex h-8 items-center gap-2">
                  <Switch checked={b.strictDisable} onCheckedChange={(c) => update(i, { strictDisable: c })} id={`shk-${i}`} />
                  <Label htmlFor={`shk-${i}`} className="text-xs text-muted-foreground">
                    {b.strictDisable ? 'no (insecure)' : 'default'}
                  </Label>
                </div>
              </Field>
            </div>
          </Panel>
        ))}
      </div>

      <ErrorBanner error={result.warning} />

      <Panel>
        <PanelHeader title="~/.ssh/config">
          <CopyButton value={() => result.text} />
          <DownloadButton data={() => result.text} filename="ssh-config" />
        </PanelHeader>
        <pre className="max-h-[420px] overflow-auto p-3 font-mono text-xs">{result.text}</pre>
        <StatBar items={[`${blocks.length} host block${blocks.length === 1 ? '' : 's'}`]} />
      </Panel>
    </div>
  );
}
