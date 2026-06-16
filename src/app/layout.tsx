'use client';

import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { GameStateProvider, useGameState } from "@/app/lib/store";
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
import { useUser } from '@/firebase';

function GameInterface({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const { isLoaded } = useGameState();
  
  const isAuthOrSetup = pathname?.startsWith('/auth') || pathname === '/setup';

  // ВАЖНО: Если идет загрузка пользователя — показываем экран загрузки
  if (isUserLoading) return <LoadingScreen />;

  // Рендерим TopBar и BottomNav ТОЛЬКО если пользователь авторизован, данные загружены и это не служебные страницы
  const shouldRenderBars = !!user && isLoaded && !isAuthOrSetup;

  return (
    <>
      {shouldRenderBars && <TopBar />}
      {shouldRenderBars && (
        <>
          <AutoMatchManager />
          <FriendlyMatchListener />
          <CWBasketListener />
          <DailyRewardManager />
          <TransferResolver />
        </>
      )}
      
      <Suspense fallback={<LoadingScreen />}>
        <main className={cn(shouldRenderBars ? "pt-14 pb-20" : "")}>
          {children}
        </main>
      </Suspense>

      {shouldRenderBars && <BottomNav />}
    </>
  );
}

// Utility to merge classes safely in layout
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
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
