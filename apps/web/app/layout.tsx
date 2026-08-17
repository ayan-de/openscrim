// For adding custom fonts with other frameworks, see:
// https://tailwindcss.com/docs/font-family
import type { Metadata } from 'next';
import { Inter, Source_Serif_4, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { LoadingProvider } from './context/LoadingContext';
import { AuthProvider } from './context/AuthProvider';
import { ThemeToggle } from './components/ThemeToggle';

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const fontSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'OpenScrim',
  description: 'OpenScrim — Interactive Video Code Editor',
};

// Inline script: applies the user's saved theme before React hydrates so we
// don't flash light -> dark on dark-mode users. Must use `dark` class (matches
// @custom-variant in globals.css); only light/dark are supported here.
const themeScript = `
(function(){try{
  var k='openscrim-theme';
  var v=localStorage.getItem(k);
  if(v==='dark'){document.documentElement.classList.add('dark');}
  else if(v==='light'){document.documentElement.classList.remove('dark');}
  else if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){
    document.documentElement.classList.add('dark');
  }
}catch(e){}})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} antialiased`}
      >
        <LoadingProvider>
          <AuthProvider>
            {children}
            <ThemeToggle />
          </AuthProvider>
        </LoadingProvider>
      </body>
    </html>
  );
}
