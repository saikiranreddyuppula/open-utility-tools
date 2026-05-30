'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Row {
  code: string;
  meaning: string;
  morse: string;
}

type Group = 'prosigns' | 'qcodes' | 'abbr';

// Prosigns: "·−·−·" denotes letters run together (no inter-letter gap).
const PROSIGNS: Row[] = [
  { code: 'AR', meaning: 'End of message', morse: '·−·−·' },
  { code: 'SK / VA', meaning: 'End of contact / out', morse: '···−·−' },
  { code: 'AS', meaning: 'Wait / stand by', morse: '·−···' },
  { code: 'BT / =', meaning: 'Break / new paragraph', morse: '−···−' },
  { code: 'KN', meaning: 'Invitation to a specific station only', morse: '−·−−·' },
  { code: 'K', meaning: 'Invitation to transmit (go ahead)', morse: '−·−' },
  { code: 'KA / CT', meaning: 'Starting signal / attention', morse: '−·−·−' },
  { code: 'SN / VE', meaning: 'Understood / verified', morse: '···−·' },
  { code: 'SOS', meaning: 'International distress signal', morse: '···−−−···' },
  { code: 'HH', meaning: 'Error / correction (8 dots)', morse: '········' },
  { code: 'BK', meaning: 'Break (invite other station to transmit)', morse: '−···−·−' },
  { code: 'CL', meaning: 'Closing station (going off the air)', morse: '−·−··−··' },
];

const QCODES: Row[] = [
  { code: 'QTH', meaning: 'My location is… / what is your location?', morse: '' },
  { code: 'QRZ', meaning: 'Who is calling me?', morse: '' },
  { code: 'QSL', meaning: 'I acknowledge receipt / confirm', morse: '' },
  { code: 'QRM', meaning: 'Interference from other stations', morse: '' },
  { code: 'QRN', meaning: 'Interference from atmospheric static', morse: '' },
  { code: 'QRP', meaning: 'Low power / decrease power', morse: '' },
  { code: 'QRO', meaning: 'High power / increase power', morse: '' },
  { code: 'QRQ', meaning: 'Send faster', morse: '' },
  { code: 'QRS', meaning: 'Send slower', morse: '' },
  { code: 'QRT', meaning: 'Stop sending / shutting down', morse: '' },
  { code: 'QRV', meaning: 'I am ready', morse: '' },
  { code: 'QRX', meaning: 'Wait / I will call you again', morse: '' },
  { code: 'QSB', meaning: 'Signal is fading', morse: '' },
  { code: 'QSO', meaning: 'A two-way contact / conversation', morse: '' },
  { code: 'QSY', meaning: 'Change frequency', morse: '' },
  { code: 'QST', meaning: 'General call to all amateurs', morse: '' },
];

const ABBR: Row[] = [
  { code: 'CQ', meaning: 'Calling any station', morse: '−·−·  −−·−' },
  { code: 'DE', meaning: 'From (this is)', morse: '−··  ·' },
  { code: 'R', meaning: 'Received / roger', morse: '·−·' },
  { code: 'K', meaning: 'Go ahead / over', morse: '−·−' },
  { code: 'OM', meaning: 'Old man (any male operator)', morse: '−−−  −−' },
  { code: 'YL', meaning: 'Young lady (female operator)', morse: '−·−−  ·−··' },
  { code: 'XYL', meaning: 'Wife', morse: '−··−  −·−−  ·−··' },
  { code: 'ES', meaning: 'And', morse: '·  ···' },
  { code: 'FB', meaning: 'Fine business (excellent)', morse: '··−·  −···' },
  { code: 'HI', meaning: 'Laughter (CW "ha ha")', morse: '····  ··' },
  { code: 'TU', meaning: 'Thank you', morse: '−  ··−' },
  { code: 'GM / GE / GN', meaning: 'Good morning / evening / night', morse: '' },
  { code: 'WX', meaning: 'Weather', morse: '·−−  −··−' },
  { code: 'RST', meaning: 'Signal report (readability, strength, tone)', morse: '' },
  { code: '73', meaning: 'Best regards', morse: '−−···  ···−−' },
  { code: '88', meaning: 'Love and kisses', morse: '−−−··  ···−−' },
  { code: 'CUL', meaning: 'See you later', morse: '' },
  { code: 'PSE', meaning: 'Please', morse: '' },
  { code: 'TNX / TKS', meaning: 'Thanks', morse: '' },
];

function filterRows(rows: Row[], q: string): Row[] {
  const s = q.trim().toLowerCase();
  if (!s) return rows;
  return rows.filter((r) => `${r.code} ${r.meaning} ${r.morse}`.toLowerCase().includes(s));
}

function RowList({ rows }: { rows: Row[] }) {
  return (
    <div className="max-h-[440px] divide-y overflow-auto">
      {rows.map((r) => (
        <div key={r.code} className="flex items-center gap-3 px-3 py-2">
          <code className="w-28 shrink-0 font-mono text-xs font-semibold">{r.code}</code>
          <span className="min-w-0 flex-1 text-sm">{r.meaning}</span>
          {r.morse && (
            <code className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">
              {r.morse}
            </code>
          )}
          <CopyButton value={r.morse ? `${r.code} (${r.morse}): ${r.meaning}` : `${r.code}: ${r.meaning}`} size="icon-sm" />
        </div>
      ))}
      {rows.length === 0 && (
        <div className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</div>
      )}
    </div>
  );
}

export default function MorseProsignsReference() {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Group>('prosigns');

  const pros = useMemo(() => filterRows(PROSIGNS, q), [q]);
  const qc = useMemo(() => filterRows(QCODES, q), [q]);
  const ab = useMemo(() => filterRows(ABBR, q), [q]);

  return (
    <Panel>
      <PanelHeader title="Morse Prosigns & Abbreviations">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter code or meaning…"
          className="h-7 w-56"
        />
      </PanelHeader>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Group)}>
        <div className="border-b px-2 py-2">
          <TabsList>
            <TabsTrigger value="prosigns">Prosigns</TabsTrigger>
            <TabsTrigger value="qcodes">Q-Codes</TabsTrigger>
            <TabsTrigger value="abbr">Abbreviations</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="prosigns">
          <RowList rows={pros} />
        </TabsContent>
        <TabsContent value="qcodes">
          <RowList rows={qc} />
        </TabsContent>
        <TabsContent value="abbr">
          <RowList rows={ab} />
        </TabsContent>
      </Tabs>
      <StatBar
        items={[
          `${pros.length + qc.length + ab.length} matching`,
          `${PROSIGNS.length} prosigns`,
          `${QCODES.length} Q-codes`,
          `${ABBR.length} abbreviations`,
        ]}
      />
    </Panel>
  );
}
