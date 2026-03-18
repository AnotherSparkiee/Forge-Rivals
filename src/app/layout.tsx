import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from "@/firebase/client-provider";
import { GameStateProvider } from "@/app/lib/store";
import { TopBar } from "@/components/game/TopBar";
import { AutoMatchManager } from "@/components/game/AutoMatchManager";
import { AuthGuard } from "@/components/game/AuthGuard";
import { Suspense } from 'react';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export const metadata: Metadata = {
  title: 'Moba Tactics Online',
  description: 'The ultimate MOBA manager game',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen bg-background text-foreground pt-14 pb-8">
        <FirebaseClientProvider>
          <GameStateProvider>
            <AuthGuard>
              <TopBar />
              <AutoMatchManager />
              <Suspense fallback={<LoadingScreen />}>
                {children}
              </Suspense>
              <Toaster />
            </AuthGuard>
          </GameStateProvider>
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
