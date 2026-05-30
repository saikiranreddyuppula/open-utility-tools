'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Field, OptionsBar, Panel, PanelHeader, StatBar } from '@/components/tools/panel';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Invisible zero-width characters used as the hidden-bit alphabet.
const ZW0 = '\u200B'; // zero-width space      => bit 0
const ZW1 = '\u200C'; // zero-width non-joiner  => bit 1
const ZWJ = '\u200D'; // zero-width joiner      => message marker
const ZW_ALL = /[\u200B\u200C\u200D\uFEFF]/g;

type Mode = 'encode' | 'decode' | 'strip';
type Placement = 'append' | 'after-first';

function textToBits(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bits = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bits += (bytes[i] ?? 0).toString(2).padStart(8, '0');
  }
  return bits;
}

function bitsToHidden(bits: string): string {
  let out = ZWJ; // start marker
  for (let i = 0; i < bits.length; i += 1) {
    out += bits[i] === '1' ? ZW1 : ZW0;
  }
  out += ZWJ; // end marker
  return out;
}

function encode(cover: string, secret: string, placement: Placement): string {
  if (!secret) return cover;
  const hidden = bitsToHidden(textToBits(secret));
  if (placement === 'append' || cover.length === 0) {
    return cover + hidden;
  }
  // Insert right after the first visible character.
  const first = Array.from(cover)[0] ?? '';
  const rest = cover.slice(first.length);
  return first + hidden + rest;
}

function decode(text: string): { message: string; bitCount: number } {
  // Collect only the 0/1-carrying zero-width chars, in order.
  let bits = '';
  for (const ch of text) {
    if (ch === ZW0) bits += '0';
    else if (ch === ZW1) bits += '1';
    // ZWJ markers and other chars are ignored.
  }
  if (bits.length === 0) {
    throw new Error('No hidden zero-width data found in this text.');
  }
  const usable = bits.length - (bits.length % 8);
  const bytes = new Uint8Array(usable / 8);
  for (let i = 0; i < usable; i += 8) {
    const byte = bits.slice(i, i + 8);
    bytes[i / 8] = parseInt(byte, 2);
  }
  const message = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  return { message, bitCount: bits.length };
}

function countZeroWidth(text: string): number {
  const m = text.match(ZW_ALL);
  return m ? m.length : 0;
}

export default function ZeroWidthTool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [placement, setPlacement] = useState<Placement>('append');
  const [cover, setCover] = useState('Looks like a perfectly normal sentence.');
  const [secret, setSecret] = useState('meet at noon');
  const [decodeInput, setDecodeInput] = useState('');

  const encResult = useMemo(() => {
    if (mode !== 'encode') return null;
    try {
      const out = encode(cover, secret, placement);
      return { out, hidden: countZeroWidth(out) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Encoding failed.' };
    }
  }, [mode, cover, secret, placement]);

  const decResult = useMemo(() => {
    if (mode === 'encode') return null;
    if (mode === 'strip') {
      const cleaned = decodeInput.replace(ZW_ALL, '');
      return { out: cleaned, removed: countZeroWidth(decodeInput) };
    }
    if (!decodeInput) return { out: '', detected: 0 };
    try {
      const { message, bitCount } = decode(decodeInput);
      return { out: message, detected: countZeroWidth(decodeInput), bits: bitCount };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Decoding failed.' };
    }
  }, [mode, decodeInput]);

  return (
    <div className="space-y-4">
      <OptionsBar>
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="encode">Hide</TabsTrigger>
              <TabsTrigger value="decode">Reveal</TabsTrigger>
              <TabsTrigger value="strip">Strip</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        {mode === 'encode' && (
          <Field label="Placement">
            <Tabs value={placement} onValueChange={(v) => setPlacement(v as Placement)}>
              <TabsList>
                <TabsTrigger value="append">Append at end</TabsTrigger>
                <TabsTrigger value="after-first">After 1st char</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
        )}
      </OptionsBar>

      {mode === 'encode' ? (
        <>
          <Panel>
            <PanelHeader title="Cover text (visible)" />
            <Textarea
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              spellCheck={false}
              className="min-h-[80px] rounded-none border-0 font-mono text-sm"
              placeholder="Visible text that carries the secret…"
            />
          </Panel>
          <Panel>
            <PanelHeader title="Secret message" />
            <Textarea
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              spellCheck={false}
              className="min-h-[60px] rounded-none border-0 font-mono text-sm"
              placeholder="The message to hide…"
            />
          </Panel>
          {encResult && 'error' in encResult ? (
            <ErrorBanner error={encResult.error} />
          ) : (
            encResult && (
              <Panel>
                <PanelHeader title="Output (copy this — it looks like the cover text)">
                  <CopyButton value={() => encResult.out} label="Copy" />
                </PanelHeader>
                <Textarea
                  value={encResult.out}
                  readOnly
                  spellCheck={false}
                  className="min-h-[80px] rounded-none border-0 font-mono text-sm"
                />
                <StatBar
                  items={[
                    `${encResult.hidden} hidden char(s)`,
                    `${secret.length} secret char(s)`,
                    'Obfuscation, not encryption',
                  ]}
                />
              </Panel>
            )
          )}
        </>
      ) : (
        <>
          <Panel>
            <PanelHeader title={mode === 'strip' ? 'Text to clean' : 'Text to scan'} />
            <Textarea
              value={decodeInput}
              onChange={(e) => setDecodeInput(e.target.value)}
              spellCheck={false}
              className="min-h-[100px] rounded-none border-0 font-mono text-sm"
              placeholder="Paste text suspected to contain hidden characters…"
            />
          </Panel>
          {decResult && 'error' in decResult ? (
            <ErrorBanner error={decResult.error} />
          ) : (
            decResult && (
              <Panel>
                <PanelHeader title={mode === 'strip' ? 'Cleaned text' : 'Revealed message'}>
                  <CopyButton value={() => decResult.out} label="Copy" disabled={!decResult.out} />
                </PanelHeader>
                <Textarea
                  value={decResult.out}
                  readOnly
                  spellCheck={false}
                  className="min-h-[60px] rounded-none border-0 font-mono text-sm"
                />
                <StatBar
                  items={[
                    mode === 'strip'
                      ? `${'removed' in decResult ? decResult.removed : 0} zero-width char(s) removed`
                      : `${'detected' in decResult ? decResult.detected : 0} zero-width char(s) detected`,
                  ]}
                />
              </Panel>
            )
          )}
        </>
      )}

      <p className="px-1 text-2xs text-muted-foreground">
        Note: this is obfuscation, not encryption. Anyone who suspects hidden data can strip or
        reveal it. Many platforms also normalize or remove zero-width characters on paste.
      </p>
    </div>
  );
}
