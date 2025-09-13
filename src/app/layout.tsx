import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Franchise Communications Platform',
  description: 'Multi-tenant franchise communications and management platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
