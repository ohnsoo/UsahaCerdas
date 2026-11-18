// Sinkronisasi tampilan antar perangkat lewat Server-Sent Events (SSE).
// Event hanya berisi topik yang berubah, bukan data. Klien mengambil ulang data lewat endpoint biasa,
// sehingga pembatasan per businessId tetap ditegakkan di satu tempat.
// Catatan: daftar koneksi disimpan di memori, jadi hanya berlaku untuk satu instance backend.
import type { Request, Response } from 'express';

export type LiveTopic = 'transactions' | 'accounts' | 'categories' | 'business';

type Client = { res: Response; clientId: string | null };
const channels = new Map<string, Set<Client>>();
const HEARTBEAT_MS = 25_000;
const CLIENT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/** ID tab pengirim, agar tab yang melakukan perubahan tidak memuat ulang dua kali. */
export function clientIdOf(value: unknown): string | null {
  return typeof value === 'string' && CLIENT_ID_RE.test(value) ? value : null;
}

export function openStream(req: Request, res: Response, businessId: string) {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('retry: 3000\nevent: ready\ndata: {}\n\n');

  const client: Client = { res, clientId: clientIdOf(req.query.clientId) };
  const set = channels.get(businessId) ?? new Set<Client>();
  set.add(client);
  channels.set(businessId, set);

  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
  req.on('close', () => {
    clearInterval(heartbeat);
    set.delete(client);
    if (set.size === 0) channels.delete(businessId);
  });
}

export function notify(businessId: string, topic: LiveTopic, originClientId: string | null = null) {
  const set = channels.get(businessId);
  if (!set) return;
  const payload = `event: change\ndata: ${JSON.stringify({ topic })}\n\n`;
  for (const client of set) {
    if (originClientId && client.clientId === originClientId) continue;
    client.res.write(payload);
  }
}
