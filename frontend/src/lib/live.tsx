import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CLIENT_ID } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/** Topik yang dikirim backend lewat GET /api/events (lihat backend/src/live.ts). */
export type LiveTopic = 'transactions' | 'accounts' | 'categories' | 'business';
export type LiveStatus = 'connecting' | 'live' | 'offline';

type Listener = { topics: LiveTopic[]; onChange: () => void };
type LiveContextValue = { status: LiveStatus; subscribe: (l: Listener) => () => void };

const LiveContext = createContext<LiveContextValue | null>(null);
const RECONNECT_MS = 5000;

/**
 * Satu koneksi SSE per tab selama pengguna login. Event hanya berisi topik; halaman yang berlangganan
 * memuat ulang datanya sendiri lewat API biasa. Setelah koneksi pulih, semua halaman dimuat ulang
 * karena event selama terputus tidak dikirim ulang.
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const { refresh } = useAuth();
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const listeners = useRef(new Set<Listener>());
  const [status, setStatus] = useState<LiveStatus>('connecting');

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let connectedBefore = false;
    let stopped = false;

    const emit = (topic: LiveTopic | null) => {
      for (const l of listeners.current) if (topic === null || l.topics.includes(topic)) l.onChange();
    };
    const connect = () => {
      source = new EventSource(`/api/events?clientId=${CLIENT_ID}`, { withCredentials: true });
      source.addEventListener('ready', () => {
        setStatus('live');
        if (connectedBefore) { emit(null); void refreshRef.current(); }
        connectedBefore = true;
      });
      source.addEventListener('change', e => {
        const { topic } = JSON.parse((e as MessageEvent<string>).data) as { topic: LiveTopic };
        if (topic === 'business') void refreshRef.current();
        emit(topic);
      });
      source.onerror = () => {
        // EventSource menyambung ulang sendiri untuk putus jaringan biasa (CONNECTING).
        // Status CLOSED (mis. backend mati saat sambungan dibuka) perlu disambung ulang manual.
        if (source?.readyState === EventSource.CLOSED) {
          setStatus('offline');
          if (!stopped) retry = setTimeout(connect, RECONNECT_MS);
        } else {
          setStatus('connecting');
        }
      };
    };
    connect();
    return () => { stopped = true; clearTimeout(retry); source?.close(); };
  }, []);

  const value = useMemo<LiveContextValue>(() => ({
    status,
    subscribe: l => { listeners.current.add(l); return () => { listeners.current.delete(l); }; },
  }), [status]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

/**
 * Angka yang bertambah setiap ada perubahan pada salah satu topik dari perangkat/tab lain.
 * Pakai sebagai dependensi useEffect untuk memuat ulang data. Event beruntun digabung (debounce).
 */
export function useLiveTick(topics: LiveTopic[]) {
  const subscribe = useContext(LiveContext)?.subscribe;
  const [tick, setTick] = useState(0);
  const key = topics.join(',');
  useEffect(() => {
    if (!subscribe) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribe({
      topics: key.split(',') as LiveTopic[],
      onChange: () => { clearTimeout(timer); timer = setTimeout(() => setTick(n => n + 1), 250); },
    });
    return () => { unsubscribe(); clearTimeout(timer); };
  }, [subscribe, key]);
  return tick;
}

export const useLiveStatus = (): LiveStatus => useContext(LiveContext)?.status ?? 'connecting';
