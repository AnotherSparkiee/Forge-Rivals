'use client';

/**
 * Облегченный загрузчик Next.js.
 * Используется только при холодном старте или тяжелых переходах.
 */
export default function Loading() {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0d14] flex flex-col items-center justify-center p-6 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.1),_transparent_70%)] opacity-50"></div>
      <div className="relative flex flex-col items-center gap-6 z-10">
        <div className="relative">
          <div className="absolute -inset-4 bg-primary/10 rounded-full blur-xl animate-pulse"></div>
          <img 
            src="https://i.postimg.cc/8cpvcNZ9/logo-lote.png" 
            alt="Logo" 
            className="w-24 h-24 object-contain opacity-50 grayscale contrast-125" 
          />
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-[9px] font-headline font-bold text-primary/60 uppercase tracking-[0.4em] animate-pulse">
            Идет передача данных...
          </p>
        </div>
      </div>
    </div>
  );
}
