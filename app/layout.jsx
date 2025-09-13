// app/layout.jsx (SERVER component, KEIN "use client")

export const metadata = {
  title: 'Reppify',
  description: 'Reppify Shop',
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
