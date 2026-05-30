'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

type HeadingStyle = 'atx' | 'setext';

function slugAnchor(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function badge(label: string, message: string, color: string): string {
  const enc = (t: string) =>
    encodeURIComponent(t.replace(/-/g, '--').replace(/_/g, '__'));
  const url = `https://img.shields.io/badge/${enc(label)}-${enc(message)}-${color}`;
  return `![${label}](${url})`;
}

export default function ReadmeScaffoldGenerator() {
  const [name, setName] = useState('Awesome Project');
  const [desc, setDesc] = useState('A short, punchy description of what this project does.');
  const [logo, setLogo] = useState('');
  const [installCmd, setInstallCmd] = useState('npm install awesome-project');
  const [usageLang, setUsageLang] = useState('ts');
  const [usage, setUsage] = useState(
    "import { awesome } from 'awesome-project';\n\nawesome();",
  );
  const [features, setFeatures] = useState(
    'Fast and lightweight\nZero dependencies\nFully typed',
  );
  const [version, setVersion] = useState('1.0.0');
  const [license, setLicense] = useState('MIT');
  const [buildStatus, setBuildStatus] = useState('passing');

  const [headingStyle, setHeadingStyle] = useState<HeadingStyle>('atx');
  const [emoji, setEmoji] = useState(true);
  const [toc, setToc] = useState(true);
  const [showBadges, setShowBadges] = useState(true);
  const [showContributing, setShowContributing] = useState(true);
  const [showLicense, setShowLicense] = useState(true);
  const [showAck, setShowAck] = useState(false);

  const markdown = useMemo(() => {
    const e = (sym: string) => (emoji ? `${sym} ` : '');
    const h2 = (title: string) =>
      headingStyle === 'setext'
        ? `${title}\n${'-'.repeat(Math.max(3, title.length))}`
        : `## ${title}`;

    interface Section {
      heading: string;
      body: string;
    }
    const sections: Section[] = [];

    sections.push({
      heading: `${e('🚀')}Installation`,
      body: '```sh\n' + (installCmd.trim() || '# install command') + '\n```',
    });

    sections.push({
      heading: `${e('💡')}Usage`,
      body:
        '```' +
        (usageLang.trim() || 'txt') +
        '\n' +
        (usage.trimEnd() || '// usage example') +
        '\n```',
    });

    const featList = features
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
    if (featList.length > 0) {
      sections.push({
        heading: `${e('✨')}Features`,
        body: featList.map((f) => `- ${f}`).join('\n'),
      });
    }

    if (showContributing) {
      sections.push({
        heading: `${e('🤝')}Contributing`,
        body:
          'Contributions are welcome! Please open an issue first to discuss what you would like to change.\n\n1. Fork the repository\n2. Create your feature branch (`git checkout -b feature/amazing`)\n3. Commit your changes\n4. Open a pull request',
      });
    }

    if (showLicense) {
      sections.push({
        heading: `${e('📄')}License`,
        body: `Distributed under the ${license.trim() || 'MIT'} License. See \`LICENSE\` for more information.`,
      });
    }

    if (showAck) {
      sections.push({
        heading: `${e('🙏')}Acknowledgements`,
        body: '- [Resource or library name](https://example.com)\n- Inspiration, references, etc.',
      });
    }

    const parts: string[] = [];

    // Title + optional logo
    if (logo.trim()) {
      parts.push(`<p align="center">\n  <img src="${logo.trim()}" alt="${name.trim()} logo" width="160" />\n</p>\n`);
    }
    parts.push(`# ${name.trim() || 'Project Name'}`);

    // Badges
    if (showBadges) {
      const badges: string[] = [];
      if (version.trim()) badges.push(badge('version', `v${version.trim()}`, 'blue'));
      if (buildStatus.trim()) badges.push(badge('build', buildStatus.trim(), 'brightgreen'));
      if (license.trim()) badges.push(badge('license', license.trim(), 'green'));
      if (badges.length > 0) parts.push(badges.join(' '));
    }

    if (desc.trim()) parts.push(`> ${desc.trim()}`);

    // Table of contents
    if (toc) {
      const tocLines = sections.map((s) => {
        // strip leading emoji + space for the link text and anchor
        const clean = s.heading.replace(/^[^\w]*\s*/, '').trim() || s.heading.trim();
        return `- [${clean}](#${slugAnchor(s.heading)})`;
      });
      parts.push(`## ${emoji ? '📚 ' : ''}Table of Contents\n\n${tocLines.join('\n')}`);
    }

    for (const s of sections) {
      parts.push(`${h2(s.heading)}\n\n${s.body}`);
    }

    return parts.join('\n\n') + '\n';
  }, [
    name,
    desc,
    logo,
    installCmd,
    usageLang,
    usage,
    features,
    version,
    license,
    buildStatus,
    headingStyle,
    emoji,
    toc,
    showBadges,
    showContributing,
    showLicense,
    showAck,
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <PanelHeader title="Project" />
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
          <Field label="Project name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Logo URL (optional)">
            <Input
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="https://…/logo.png"
            />
          </Field>
          <Field label="Short description" className="sm:col-span-2">
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </Field>
          <Field label="Install command">
            <Input
              value={installCmd}
              onChange={(e) => setInstallCmd(e.target.value)}
              className="font-mono"
            />
          </Field>
          <Field label="Usage language">
            <Input
              value={usageLang}
              onChange={(e) => setUsageLang(e.target.value)}
              placeholder="ts, js, sh, py…"
              className="font-mono"
            />
          </Field>
          <Field label="Usage snippet" className="sm:col-span-2">
            <Textarea
              value={usage}
              onChange={(e) => setUsage(e.target.value)}
              spellCheck={false}
              className="min-h-[96px] font-mono text-xs"
            />
          </Field>
          <Field label="Features (one per line)" className="sm:col-span-2">
            <Textarea
              value={features}
              onChange={(e) => setFeatures(e.target.value)}
              spellCheck={false}
              className="min-h-[80px] text-xs"
            />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Badges & meta" />
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
          <Field label="Version">
            <Input value={version} onChange={(e) => setVersion(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Build status">
            <Input value={buildStatus} onChange={(e) => setBuildStatus(e.target.value)} className="font-mono" />
          </Field>
          <Field label="License">
            <Input value={license} onChange={(e) => setLicense(e.target.value)} className="font-mono" />
          </Field>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Options" />
        <OptionsBar>
          <Field label="Heading style">
            <div className="flex h-9 items-center gap-2">
              <Switch
                id="rm-heading"
                checked={headingStyle === 'atx'}
                onCheckedChange={(c) => setHeadingStyle(c ? 'atx' : 'setext')}
              />
              <Label htmlFor="rm-heading" className="text-xs">
                {headingStyle === 'atx' ? 'ATX (##)' : 'Setext (---)'}
              </Label>
            </div>
          </Field>
          <Field label="Emoji headings">
            <div className="flex h-9 items-center gap-2">
              <Switch id="rm-emoji" checked={emoji} onCheckedChange={setEmoji} />
              <Label htmlFor="rm-emoji" className="text-xs">
                {emoji ? 'On' : 'Off'}
              </Label>
            </div>
          </Field>
          <Field label="Table of contents">
            <div className="flex h-9 items-center gap-2">
              <Switch id="rm-toc" checked={toc} onCheckedChange={setToc} />
              <Label htmlFor="rm-toc" className="text-xs">
                {toc ? 'Include' : 'Skip'}
              </Label>
            </div>
          </Field>
          <Field label="Badges">
            <div className="flex h-9 items-center gap-2">
              <Switch id="rm-badges" checked={showBadges} onCheckedChange={setShowBadges} />
              <Label htmlFor="rm-badges" className="text-xs">
                {showBadges ? 'Show' : 'Hide'}
              </Label>
            </div>
          </Field>
          <Field label="Contributing">
            <div className="flex h-9 items-center gap-2">
              <Switch
                id="rm-contrib"
                checked={showContributing}
                onCheckedChange={setShowContributing}
              />
              <Label htmlFor="rm-contrib" className="text-xs">
                {showContributing ? 'Show' : 'Hide'}
              </Label>
            </div>
          </Field>
          <Field label="License section">
            <div className="flex h-9 items-center gap-2">
              <Switch id="rm-lic" checked={showLicense} onCheckedChange={setShowLicense} />
              <Label htmlFor="rm-lic" className="text-xs">
                {showLicense ? 'Show' : 'Hide'}
              </Label>
            </div>
          </Field>
          <Field label="Acknowledgements">
            <div className="flex h-9 items-center gap-2">
              <Switch id="rm-ack" checked={showAck} onCheckedChange={setShowAck} />
              <Label htmlFor="rm-ack" className="text-xs">
                {showAck ? 'Show' : 'Hide'}
              </Label>
            </div>
          </Field>
        </OptionsBar>
      </Panel>

      <Panel>
        <PanelHeader title="README.md">
          <CopyButton value={() => markdown} label="Copy" />
          <DownloadButton data={() => markdown} filename="README.md" />
        </PanelHeader>
        <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-xs">
          {markdown}
        </pre>
        <StatBar
          items={[`${markdown.length.toLocaleString()} chars`, `${markdown.split('\n').length} lines`]}
        />
      </Panel>
    </div>
  );
}
