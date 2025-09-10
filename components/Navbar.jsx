// components/Navbar.jsx
"use client";

import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

export default function Navbar({ cartCount = 0, onCartOpen }) {
  const neon =
    "bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 ring-1 ring-cyan-400/60 shadow-[0_0_20px_#22d3ee] transition rounded-lg px-3 py-2";

  return (
    <nav className="sticky top-0 z-40 w-full backdrop-blur bg-black/60 border-b border-white/10">
      <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-cyan-200 font-semibold tracking-wider">
          REPPIFY
        </Link>

        <div className="flex items-center gap-2">
          <button onClick={onCartOpen} className={neon}>
            Warenkorb {cartCount > 0 ? `(${cartCount})` : ""}
          </button>

          {/* NICHT eingeloggt → Login/Registrieren (als Modal, von Clerk gesteuert) */}
          <SignedOut>
            <SignInButton mode="modal">
              <button className={neon}>Login</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className={neon}>Registrieren</button>
            </SignUpButton>
          </SignedOut>

          {/* Eingeloggt → User-Menü (Logout/Profil etc. sind im Avatar) */}
          <SignedIn>
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox:
                    "ring-1 ring-cyan-400/60 shadow-[0_0_20px_#22d3ee]",
                },
              }}
              afterSignOutUrl="/"
            />
          </SignedIn>
        </div>
      </div>
    </nav>
  );
}
