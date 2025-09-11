// app/layout.jsx  (SERVER component, KEIN "use client")
import { ClerkProvider } from '@clerk/nextjs';

export const metadata = {
  title: 'Reppify',
  description: 'Reppify Shop',
};

// WICHTIG: ClerkProvider bekommt den Publishable Key aus der ENV.
// SignIn/Up URLs können (müssen aber nicht) gesetzt werden.
// afterSignIn/Up zurück auf Startseite.
export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/"
      afterSignUpUrl="/"
    >
      <html lang="de">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
