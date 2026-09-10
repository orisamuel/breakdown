/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // בעיית ה-HTML הישן שנתקלנו בה הייתה של GitHub Pages. כאן הדפים
  // דינמיים (מאחורי התחברות) ולכן לא נשמרים בקאש, ו-Next מטפל
  // בעצמו בקאשינג של הנכסים – לכן אין override על Cache-Control.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};
export default nextConfig;
