'use client';

/**
 * Минималистичный экран загрузки.
 * Срабатывает мгновенно при навигации или используется как сплэш-экран.
 */
export function LoadingScreen() {
  return (
    <div 
      className="fixed inset-0 z-[9999] bg-[#0a0d14] flex flex-col items-center justify-center p-6 overflow-hidden" 
      suppressHydrationWarning
    >
      {/* Фоновое свечение для глубины */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)]"></div>

      <div className="relative flex flex-col items-center gap-8 z-10">
        {/* Логотип */}
        <div className="relative">
          <div className="absolute -inset-8 bg-primary/10 rounded-full blur-2xl animate-pulse"></div>
          <img 
            src="https://i.postimg.cc/8cpvcNZ9/logo-lote.png" 
            alt="Lines of the Enmity Logo" 
            className="w-48 h-48 md:w-64 md:h-64 object-contain animate-pulse"
            suppressHydrationWarning
          />
        </div>

        {/* Текст статуса */}
        <div className="text-center space-y-2">
          <p className="text-sm md:text-base font-headline font-bold text-primary uppercase tracking-[0.4em] animate-pulse opacity-90">
            Идет передача данных...
          </p>
          <div className="w-32 h-0.5 bg-primary/20 mx-auto overflow-hidden rounded-full">
            <div className="w-full h-full bg-primary animate-[shimmer_1.5s_infinite] origin-left"></div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      {/* Копирайт */}
      <div className="absolute bottom-12 text-center opacity-30">
        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          ENMITY LEAGUE OPERATIONS &copy; 2024
        </p>
      </div>
    </div>
  );
}
