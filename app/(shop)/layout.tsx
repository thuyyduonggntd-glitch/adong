import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import NoticePopup from '@/components/NoticePopup';
import { NoticeProvider } from '@/hooks/useNotices';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <NoticeProvider>
      <div className="flex flex-col min-h-screen">
        <NoticePopup />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </NoticeProvider>
  );
}
