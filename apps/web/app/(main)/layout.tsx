'use client';

import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import LineBorder from '../components/ui/LineBorder';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <LineBorder>
        <Navbar mainText="OpenScrim" />
        {children}
        <Footer />
      </LineBorder>
    </div>
  );
}
