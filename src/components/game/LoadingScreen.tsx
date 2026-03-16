'use client';

import { Loader2, Swords } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * A full-screen tactical loading component for MOBA Tactics.
 * Features a scanner animation and pulsing logo.
 */
export function LoadingScreen() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Background Grid/Effect */}
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.1),_transparent_70%)]"></div>

      {/* Pulsing Logo Container */}
      <div className="relative mb-8">
        <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
        <div className="relative w-24 h-24 rounded-full border-2 border-primary/50 flex items-center justify-center bg-card shadow-[0_0_30px_rgba(var(--primary),0.2)]">
          <Swords className="w-10 h-10 text-primary animate-bounce" />
        </div>
        {/* Scanner Bar Effect */}
        <div className="absolute -left-12 -right-12 h-0.5 bg-accent/40 top-1/2 -translate-y-1/2 shadow-[0_0_15px_hsl(var(--accent))] animate-[scan_2s_ease-in-out_infinite]"></div>
      </div>

      {/* Text Info */}
      <div className="text-center space-y-3 relative">
        <h2 className="text-xl font-headline font-bold tracking-tighter text-primary uppercase">
          MOBA TACTICS
        </h2>
        <div className="flex flex-col items-center gap-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.3em] font-bold">
            Establishing Secure Link{dots}
          </p>
          <div className="w-48 h-1 bg-secondary rounded-full overflow-hidden mt-2">
            <div className="h-full bg-primary animate-[loading-bar_1.5s_infinite_ease-in-out]"></div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes scan {
          0%, 100% { transform: translateY(-40px); opacity: 0; }
          50% { transform: translateY(40px); opacity: 1; }
        }
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
