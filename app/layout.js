import './globals.css';
import Providers from '@/components/Providers';

export const metadata = {
  title: 'CTRL - Claim Territory in Real Life',
  description: 'Turn your runs and rides into a competitive territory control game',
  themeColor: '#000000'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-black text-white antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
