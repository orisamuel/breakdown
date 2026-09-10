import type { Metadata, Viewport } from 'next';
import { Assistant, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const body = Assistant({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '600', '800'],
  variable: '--font-body',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ברייקדאון',
  description: 'לו״ז הפקה וסימון מהסט',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EEF1F5' },
    { media: '(prefers-color-scheme: dark)', color: '#080C12' },
  ],
};

/** קובע את הערכה לפני הצביעה הראשונה, כדי שלא תהיה הבזקה */
const THEME_BOOT = `(function(){try{
  var t=localStorage.getItem('bd-theme');
  if(t&&t!=='system')document.documentElement.setAttribute('data-theme',t);
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${body.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
