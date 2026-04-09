'use client';

import { useEffect, useState } from 'react';

/**
 * A full-screen tactical splash screen for Lines of the Enmity.
 * Features a 5-second progress bar, pulsing logo, and scanner effects.
 */
export function LoadingScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Fill progress bar over 5 seconds
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 50); // 100 increments * 50ms = 5000ms

    return () => clearInterval(interval);
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-[#0a0d14] flex flex-col items-center justify-center p-6 overflow-hidden" 
      suppressHydrationWarning
    >
      {/* Background Grid & Ambient Glow */}
      <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:32px_32px]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)]"></div>

      {/* Decorative Corners */}
      <div className="absolute top-8 left-8 w-12 h-12 border-t-2 border-l-2 border-primary/30"></div>
      <div className="absolute top-8 right-8 w-12 h-12 border-t-2 border-r-2 border-primary/30"></div>
      <div className="absolute bottom-8 left-8 w-12 h-12 border-b-2 border-l-2 border-primary/30"></div>
      <div className="absolute bottom-8 right-8 w-12 h-12 border-b-2 border-r-2 border-primary/30"></div>

      {/* Central Content */}
      <div className="relative flex flex-col items-center gap-8 z-10 scale-110 md:scale-125">
        {/* Pulsing Logo Container */}
        <div className="relative">
          <div className="absolute -inset-8 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="relative w-32 h-32 rounded-full border-2 border-primary/40 flex items-center justify-center bg-card/50 backdrop-blur-xl shadow-[0_0_50px_rgba(var(--primary),0.2)] overflow-hidden group">
            <img 
              src="https://i.postimg.cc/8cpvcNZ9/logo-lote.png" 
              alt="Lines of the Enmity Logo" 
              className="w-24 h-24 object-contain animate-pulse"
              suppressHydrationWarning
            />
            {/* Scanner Bar Effect */}
            <div className="absolute inset-x-0 h-0.5 bg-accent/60 top-0 shadow-[0_0_15px_hsl(var(--accent))] animate-[scan_2.5s_ease-in-out_infinite]"></div>
          </div>
        </div>

        {/* Text Identity */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-headline font-bold tracking-[-0.05em] text-white uppercase flex flex-col">
            <span className="text-primary leading-none">LINES OF THE</span>
            <span className="text-accent leading-none">ENMITY</span>
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.4em] font-black opacity-60">
            Command Center Booting
          </p>
        </div>

        {/* Tactical Progress Section */}
        <div className="w-64 space-y-2 mt-4">
          <div className="flex justify-between items-end px-1">
            <span className="text-[8px] font-mono font-bold text-primary/70 uppercase">Establishing Link...</span>
            <span className="text-[10px] font-mono font-bold text-accent">{progress}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden p-[1px] border border-white/10">
            <div 
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-75 ease-linear shadow-[0_0_10px_rgba(var(--primary),0.5)]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-[6px] text-muted-foreground font-mono uppercase tracking-tighter opacity-40">
            <span>SECURE_SHELL_v4.2</span>
            <span>FREQ_SYNCHRONIZED</span>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-12 text-center opacity-30">
        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          &copy; 2024 ENMITY LEAGUE OPERATIONS
        </p>
      </div>

      <style jsx global>{`
        @keyframes scan {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(128px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
