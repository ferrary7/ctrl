'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '/', label: 'Map' },
    { href: '/community', label: 'Community' },
    { href: '/leaderboard', label: 'Leaderboard' },
    { href: '/activities', label: 'Activities' },
    { href: '/profile', label: 'Profile' },
  ];

  const isActive = (href) => pathname === href;

  if (!session) return null;

  return (
    <header className="bg-black/40 backdrop-blur-2xl border-b border-white/10 z-50 sticky top-0 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <Image src="/ctrl.svg" alt="CTRL" width={20} height={20} className="h-5" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-[13px] font-normal px-3 py-1.5 rounded-full transition-all duration-200 ${
                  isActive(link.href)
                    ? 'text-white bg-white/10'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center gap-3">
            {session.user.image && (
              <Image
                src={session.user.image}
                alt={session.user.name}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full ring-1 ring-white/20"
              />
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-[13px] text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-full hover:bg-white/5"
            >
              Sign Out
            </button>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-white/70 hover:text-white p-2 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pt-2 pb-4 border-t border-white/10 mt-2 animate-in slide-in-from-top-2 duration-200">
            <nav className="flex flex-col space-y-0.5">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-[15px] font-normal px-4 py-2.5 rounded-xl transition-all duration-200 ${
                    isActive(link.href)
                      ? 'text-white bg-white/10'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Mobile User Info */}
            <div className="mt-3 pt-3 border-t border-white/10 px-4">
              <div className="flex items-center gap-3 mb-2">
                {session.user.image && (
                  <Image
                    src={session.user.image}
                    alt={session.user.name}
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full ring-1 ring-white/20"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-white truncate">{session.user.name}</p>
                  <p className="text-[11px] text-white/50 truncate">{session.user.email}</p>
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="w-full text-[13px] text-white/70 hover:text-white transition-colors px-4 py-2 rounded-xl hover:bg-white/5 text-left mt-2"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
