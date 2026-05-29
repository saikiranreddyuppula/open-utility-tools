/** Tiny client-side fake-data generator (names, emails, etc.) for test fixtures. */

const FIRST = ['Ada', 'Linus', 'Grace', 'Alan', 'Ada', 'Katherine', 'Dennis', 'Barbara', 'Tim', 'Margaret', 'Edsger', 'Hedy', 'Donald', 'Radia', 'Ken', 'Anita'];
const LAST = ['Lovelace', 'Torvalds', 'Hopper', 'Turing', 'Johnson', 'Ritchie', 'Liskov', 'Berners-Lee', 'Hamilton', 'Dijkstra', 'Lamarr', 'Knuth', 'Perlman', 'Thompson', 'Borg'];
const DOMAINS = ['example.com', 'test.dev', 'mail.org', 'demo.io', 'inbox.net'];
const CITIES = ['London', 'Berlin', 'Tokyo', 'Austin', 'Toronto', 'Oslo', 'Lisbon', 'Nairobi'];
const ROLES = ['admin', 'user', 'editor', 'viewer', 'owner'];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export interface FakeOptions {
  count: number;
  fields: Record<string, boolean>;
}

export const FAKE_FIELDS = ['id', 'name', 'email', 'age', 'city', 'role', 'active', 'createdAt'];

export function generateFake(opts: FakeOptions): unknown[] {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < opts.count; i++) {
    const first = rand(FIRST);
    const last = rand(LAST);
    const rec: Record<string, unknown> = {};
    if (opts.fields.id) rec.id = i + 1;
    if (opts.fields.name) rec.name = `${first} ${last}`;
    if (opts.fields.email)
      rec.email = `${first.toLowerCase()}.${last.toLowerCase().replace(/[^a-z]/g, '')}@${rand(DOMAINS)}`;
    if (opts.fields.age) rec.age = randInt(18, 75);
    if (opts.fields.city) rec.city = rand(CITIES);
    if (opts.fields.role) rec.role = rand(ROLES);
    if (opts.fields.active) rec.active = Math.random() > 0.3;
    if (opts.fields.createdAt) {
      const daysAgo = randInt(0, 1000);
      rec.createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
    }
    out.push(rec);
  }
  return out;
}
