
'use client';

import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { GameStateProvider } from "@/app/lib/store";
import { TopBar } from "@/components/game/TopBar";
import { BottomNav } from "@/components/game/BottomNav";
import { AutoMatchManager } from "@/components/game/AutoMatchManager";
import { FriendlyMatchListener } from "@/components/game/FriendlyMatchListener";
import { CWBasketListener } from "@/components/game/CWBasketListener";
import { DailyRewardManager } from "@/components/game/DailyRewardManager";
import { TransferResolver } from "@/components/game/TransferResolver";
import { AuthGuard } from "@/components/game/AuthGuard";
import { Suspense } from 'react';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { usePathname } from 'next/navigation';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isAuthOrSetup = pathname?.startsWith('/auth') || pathname === '/setup';

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen bg-background text-foreground pt-14 pb-24" suppressHydrationWarning>
        <FirebaseClientProvider>
          <GameStateProvider>
            <AuthGuard>
              {/* Only render game-wide UI components if we're NOT on auth/setup pages */}
              {!isAuthOrSetup && (
                <>
                  <TopBar />
                  <AutoMatchManager />
                  <FriendlyMatchListener />
                  <CWBasketListener />
                  <DailyRewardManager />
                  <TransferResolver />
                </>
              )}
              
              <Suspense fallback={<LoadingScreen />}>
                <main>
                  {children}
                </main>
              </Suspense>

              {!isAuthOrSetup && <BottomNav />}
              <Toaster />
            </AuthGuard>
          </GameStateProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
