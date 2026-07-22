'use client';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export type Notice = {
  id: string;
  type: 'MANUAL' | 'SALE' | 'CARRYOVER';
  title: string;
  content: string;
  brandName?: string | null;
  itemCount?: number;
  seen: boolean;
  createdAt: string;
  [key: string]: any;
};

const seenKey = (id: string) => `notice_seen_${id}`;

type NoticeContextValue = {
  notices: Notice[];
  unreadCount: number;
  markSeen: (id: string) => void;
  markAllSeen: () => void;
  /** 공지 팝업을 닫을 때 호출 — 계정에 영구 기록되어 다음 접속부터 다시 뜨지 않음 */
  dismissNotice: (id: string) => void;
};

const NoticeContext = createContext<NoticeContextValue | null>(null);

export function NoticeProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (!session) { setNotices([]); return; }
    fetch('/api/notices?active=1')
      .then((r) => r.json())
      .then((all: Notice[]) => setNotices(Array.isArray(all) ? all : []))
      .catch(() => {});
  }, [session]);

  // 알림벨 배지용 "읽음" 표시 (기기 로컬) — 공지 팝업의 영구 dismiss와는 별개
  const markSeen = useCallback((id: string) => {
    if (localStorage.getItem(seenKey(id))) return;
    localStorage.setItem(seenKey(id), '1');
    forceRender((v) => v + 1);
  }, []);

  const markAllSeen = useCallback(() => {
    notices.forEach((n) => localStorage.setItem(seenKey(n.id), '1'));
    forceRender((v) => v + 1);
  }, [notices]);

  const dismissNotice = useCallback((id: string) => {
    setNotices((prev) => prev.map((n) => n.id === id ? { ...n, seen: true } : n));
    fetch(`/api/notices/${id}/seen`, { method: 'POST' }).catch(() => {});
  }, []);

  const unreadCount = notices.filter((n) => !localStorage.getItem(seenKey(n.id))).length;

  return (
    <NoticeContext.Provider value={{ notices, unreadCount, markSeen, markAllSeen, dismissNotice }}>
      {children}
    </NoticeContext.Provider>
  );
}

export function useNotices() {
  const ctx = useContext(NoticeContext);
  if (!ctx) throw new Error('useNotices must be used within NoticeProvider');
  return ctx;
}
