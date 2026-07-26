'use client';

import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { GameStateProvider, useGameState } from "@/app/lib/store";
import { TopBar } from "@/components/game/TopBar";
import { BottomNav } from "@/components/game/BottomNav";
import { AutoMatchManager } from "@/components/game/AutoMatchManager";
import { DailyRewardManager } from "@/components/game/DailyRewardManager";
import { GiftGenerationManager } from "@/components/game/GiftGenerationManager";
import { AuthGuard } from "@/components/game/AuthGuard";
import { Suspense } from 'react';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Script from 'next/script';

function GameInterface({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoaded, isDataReady } = useGameState();
  
  const isAuthOrSetup = pathname?.startsWith('/auth') || pathname === '/setup';

  // В локальном режиме нам не нужен Firebase User для старта
  const needsWorldSync = isLoaded && !isAuthOrSetup;

  // Показываем прелоадер только во время первичной инициализации стора
  const showPreloader = !isLoaded || (needsWorldSync && !isDataReady);

  return (
    <>
      {needsWorldSync && <AutoMatchManager />}
      
      {showPreloader ? (
        <LoadingScreen />
      ) : (
        <>
          {!isAuthOrSetup && isDataReady && <TopBar />}
          {!isAuthOrSetup && isDataReady && (
            <>
              <DailyRewardManager />
              <GiftGenerationManager />
            </>
          )}
          
          <Suspense fallback={<LoadingScreen />}>
            <main className={cn(!isAuthOrSetup && isDataReady ? "pt-14 pb-20" : "")}>
              {children}
            </main>
          </Suspense>

          {!isAuthOrSetup && isDataReady && <BottomNav />}
        </>
      )}
    </>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="font-body antialiased min-h-screen bg-background text-foreground" suppressHydrationWarning>
        <FirebaseClientProvider>
          <GameStateProvider>
            <AuthGuard>
              <GameInterface>
                {children}
              </GameInterface>
              <Toaster />
            </AuthGuard>
          </GameStateProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
