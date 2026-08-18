'use client';

import { usePathname } from 'next/navigation';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import LineBorder from '../components/ui/LineBorder';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  // Home renders its own Navbar inside Hero, layered on top of the hero
  // gradient — avoid double-rendering it here.
  const pathname = usePathname();
  const isHome = pathname === '/';

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <LineBorder>
        {!isHome && <Navbar mainText="OpenScrim" />}
        {children}
        <Footer />
      </LineBorder>
    </div>
  );
}
