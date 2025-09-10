// app/layout.jsx
import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';

export const metadata = {
  title: 'REPPIFY HIGHQUALITY REPS',
  description: 'Dein Shop',
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="de">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
