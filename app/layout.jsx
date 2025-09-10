'use client';

import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({ children }) {
  // Holt den Publishable Key NUR aus NEXT_PUBLIC_...
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <ClerkProvider publishableKey={pk}>
      <html lang="de">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
