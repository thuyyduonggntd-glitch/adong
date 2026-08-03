import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import NoticePopup from '@/components/NoticePopup';
import { NoticeProvider } from '@/hooks/useNotices';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <NoticeProvider>
      <div className="flex flex-col min-h-screen">
        <NoticePopup />
        <Header />
        {/* md:pb-0: 모바일 하단 탭바(h-16=64px) 높이만큼 콘텐츠가 가려지지 않도록 여백 추가 */}
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <Footer />
        <MobileBottomNav />
      </div>
    </NoticeProvider>
  );
}
