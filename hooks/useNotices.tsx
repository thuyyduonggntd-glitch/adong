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

type NoticeContextValue = {
  notices: Notice[];
  unreadCount: number;
  /** 알림벨에서 개별 공지를 읽음 처리 — 계정(서버)에 영구 기록됨 */
  markSeen: (id: string) => void;
  /** 알림벨을 열 때 현재 안 읽은 공지 전체를 읽음 처리 — 계정(서버)에 영구 기록됨 */
  markAllSeen: () => void;
  /** 공지 팝업을 닫을 때 호출 — 계정에 영구 기록되어 다음 접속부터 다시 뜨지 않음 */
  dismissNotice: (id: string) => void;
};

const NoticeContext = createContext<NoticeContextValue | null>(null);

export function NoticeProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    if (!session) { setNotices([]); return; }
    fetch('/api/notices?active=1')
      .then((r) => r.json())
      .then((all: Notice[]) => setNotices(Array.isArray(all) ? all : []))
      .catch(() => {});
  }, [session]);

  // 읽음 처리는 항상 계정 기준(서버 NoticeSeen)으로 남긴다 — 브라우저를 바꿔도 상태가 유지된다.
  const markSeen = useCallback((id: string) => {
    setNotices((prev) => prev.map((n) => n.id === id ? { ...n, seen: true } : n));
    fetch(`/api/notices/${id}/seen`, { method: 'POST' }).catch(() => {});
  }, []);

  const markAllSeen = useCallback(() => {
    setNotices((prev) => {
      const unseenIds = prev.filter((n) => !n.seen).map((n) => n.id);
      unseenIds.forEach((id) => {
        fetch(`/api/notices/${id}/seen`, { method: 'POST' }).catch(() => {});
      });
      return prev.map((n) => n.seen ? n : { ...n, seen: true });
    });
  }, []);

  const dismissNotice = useCallback((id: string) => {
    setNotices((prev) => prev.map((n) => n.id === id ? { ...n, seen: true } : n));
    fetch(`/api/notices/${id}/seen`, { method: 'POST' }).catch(() => {});
  }, []);

  const unreadCount = notices.filter((n) => !n.seen).length;

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
