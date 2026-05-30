'use client';

import { useCallback, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Mode = 'draw' | 'hands';
type CardFmt = 'glyph' | 'text' | 'short';

interface Card {
  rank: string; // '2'..'10','J','Q','K','A' or 'JOKER'
  suit: string; // 'S','H','D','C' or '' for joker
  red: boolean;
  joker: boolean;
}

const SUITS: { code: string; glyph: string; name: string; red: boolean }[] = [
  { code: 'S', glyph: '♠', name: 'Spades', red: false },
  { code: 'H', glyph: '♥', name: 'Hearts', red: true },
  { code: 'D', glyph: '♦', name: 'Diamonds', red: true },
  { code: 'C', glyph: '♣', name: 'Clubs', red: false },
];

const RANKS: { code: string; name: string }[] = [
  { code: 'A', name: 'Ace' },
  { code: '2', name: '2' },
  { code: '3', name: '3' },
  { code: '4', name: '4' },
  { code: '5', name: '5' },
  { code: '6', name: '6' },
  { code: '7', name: '7' },
  { code: '8', name: '8' },
  { code: '9', name: '9' },
  { code: '10', name: '10' },
  { code: 'J', name: 'Jack' },
  { code: 'Q', name: 'Queen' },
  { code: 'K', name: 'King' },
];

const SUIT_NAME: Record<string, string> = Object.fromEntries(
  SUITS.map((s) => [s.code, s.name])
);
const SUIT_GLYPH: Record<string, string> = Object.fromEntries(
  SUITS.map((s) => [s.code, s.glyph])
);
const RANK_NAME: Record<string, string> = Object.fromEntries(
  RANKS.map((r) => [r.code, r.name])
);

function buildDeck(decks: number, jokers: boolean): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const s of SUITS) {
      for (const r of RANKS) {
        cards.push({ rank: r.code, suit: s.code, red: s.red, joker: false });
      }
    }
    if (jokers) {
      cards.push({ rank: 'JOKER', suit: '', red: true, joker: false });
      cards.push({ rank: 'JOKER', suit: '', red: false, joker: true });
    }
  }
  return cards;
}

/** Unbiased index in [0, n). */
function randIndex(n: number): number {
  if (n <= 0) return 0;
  const limit = Math.floor(0xffffffff / n) * n;
  const buf = new Uint32Array(1);
  let v = 0;
  do {
    wc.getRandomValues(buf);
    v = buf[0] ?? 0;
  } while (v >= limit);
  return v % n;
}

function shuffle(cards: Card[]): Card[] {
  const a = cards.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randIndex(i + 1);
    const tmp = a[i];
    const aj = a[j];
    if (tmp !== undefined && aj !== undefined) {
      a[i] = aj;
      a[j] = tmp;
    }
  }
  return a;
}

function fmtCard(c: Card, fmt: CardFmt): string {
  if (c.joker || c.rank === 'JOKER') {
    return fmt === 'short' ? 'JK' : 'Joker';
  }
  switch (fmt) {
    case 'glyph':
      return `${c.rank}${SUIT_GLYPH[c.suit] ?? '?'}`;
    case 'text':
      return `${RANK_NAME[c.rank] ?? c.rank} of ${SUIT_NAME[c.suit] ?? c.suit}`;
    case 'short':
      return `${c.rank}${c.suit}`;
    default:
      return `${c.rank}${c.suit}`;
  }
}

export default function PlayingCardDealerTool() {
  const [mode, setMode] = useState<Mode>('draw');
  const [decks, setDecks] = useState(1);
  const [jokers, setJokers] = useState(false);
  const [fmt, setFmt] = useState<CardFmt>('glyph');
  const [drawN, setDrawN] = useState(5);
  const [hands, setHands] = useState(4);
  const [perHand, setPerHand] = useState(5);
  const [nonce, setNonce] = useState(0);

  const deckSize = useMemo(
    () => buildDeck(decks, jokers).length,
    [decks, jokers]
  );

  const dealt = useMemo(() => {
    void nonce;
    const full = shuffle(buildDeck(decks, jokers));
    if (mode === 'draw') {
      const n = Math.max(1, drawN);
      if (n > full.length) {
        return { error: `Cannot draw ${n} cards from a deck of ${full.length}.` };
      }
      return { hands: [full.slice(0, n)], remaining: full.length - n };
    }
    const h = Math.max(1, hands);
    const c = Math.max(1, perHand);
    const needed = h * c;
    if (needed > full.length) {
      return {
        error: `Cannot deal ${h} hands of ${c} (${needed} cards) from a deck of ${full.length}.`,
      };
    }
    const out: Card[][] = [];
    // Deal round-robin like a real dealer.
    for (let i = 0; i < h; i++) out.push([]);
    let idx = 0;
    for (let round = 0; round < c; round++) {
      for (let i = 0; i < h; i++) {
        const card = full[idx];
        const hand = out[i];
        if (card && hand) hand.push(card);
        idx++;
      }
    }
    return { hands: out, remaining: full.length - needed };
  }, [mode, decks, jokers, drawN, hands, perHand, nonce]);

  const reshuffle = useCallback(() => setNonce((x) => x + 1), []);

  const copyText = useMemo(() => {
    if ('error' in dealt) return '';
    return dealt.hands
      .map((hand, i) =>
        (dealt.hands.length > 1 ? `Hand ${i + 1}: ` : '') +
        hand.map((c) => fmtCard(c, fmt)).join(' ')
      )
      .join('\n');
  }, [dealt, fmt]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Mode">
          <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draw">Draw N cards</SelectItem>
              <SelectItem value="hands">Deal hands</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {mode === 'draw' ? (
          <Field label="Cards to draw">
            <Input
              type="number"
              min={1}
              value={drawN}
              onChange={(e) => setDrawN(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 font-mono"
            />
          </Field>
        ) : (
          <>
            <Field label="Hands">
              <Input
                type="number"
                min={1}
                value={hands}
                onChange={(e) => setHands(Math.max(1, Number(e.target.value) || 1))}
                className="w-20 font-mono"
              />
            </Field>
            <Field label="Cards / hand">
              <Input
                type="number"
                min={1}
                value={perHand}
                onChange={(e) => setPerHand(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 font-mono"
              />
            </Field>
          </>
        )}
        <Field label="Decks (shoe)">
          <Input
            type="number"
            min={1}
            max={8}
            value={decks}
            onChange={(e) => setDecks(Math.max(1, Math.min(Number(e.target.value) || 1, 8)))}
            className="w-20 font-mono"
          />
        </Field>
        <Field label="Format">
          <Select value={fmt} onValueChange={(v) => setFmt(v as CardFmt)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="glyph">Glyphs (A♠)</SelectItem>
              <SelectItem value="text">Text (Ace of Spades)</SelectItem>
              <SelectItem value="short">Short (AS)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Jokers">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={jokers} onCheckedChange={setJokers} id="jk" />
            <Label htmlFor="jk" className="text-xs text-muted-foreground">
              +2 per deck
            </Label>
          </div>
        </Field>
        <div className="ml-auto flex items-end">
          <Button variant="secondary" size="sm" onClick={reshuffle}>
            <RefreshCw className="size-3.5" /> Shuffle &amp; deal
          </Button>
        </div>
      </OptionsBar>

      {'error' in dealt ? (
        <ErrorBanner error={dealt.error} />
      ) : (
        <Panel>
          <PanelHeader title={mode === 'draw' ? 'Drawn cards' : 'Dealt hands'}>
            <CopyButton value={() => copyText} disabled={!copyText} />
          </PanelHeader>
          <div className="flex flex-col gap-3 p-3">
            {dealt.hands.map((hand, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                {dealt.hands.length > 1 && (
                  <span className="w-16 shrink-0 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Hand {i + 1}
                  </span>
                )}
                {hand.map((c, j) => (
                  <span
                    key={j}
                    className={
                      'inline-flex h-9 min-w-[2.75rem] items-center justify-center rounded-md border bg-card px-2 font-mono text-sm ' +
                      (c.red ? 'text-red-500' : 'text-foreground')
                    }
                  >
                    {fmtCard(c, fmt)}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `deck size: ${deckSize}`,
              `remaining: ${dealt.remaining}`,
              `${decks} deck${decks > 1 ? 's' : ''}${jokers ? ' + jokers' : ''}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
