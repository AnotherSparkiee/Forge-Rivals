'use client';

/**
 * Упрощенный тактический экран загрузки Lines of the Enmity.
 * Отображает только логотип и статус передачи данных.
 */
export function LoadingScreen() {
  return (
    <div 
      className="fixed inset-0 z-[9999] bg-[#0a0d14] flex flex-col items-center justify-center p-6 overflow-hidden" 
      suppressHydrationWarning
    >
      {/* Мягкое фоновое свечение */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.1),_transparent_70%)]"></div>

      <div className="relative flex flex-col items-center gap-8 z-10">
        {/* Пульсирующий логотип */}
        <div className="relative">
          <div className="absolute -inset-12 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
          <img 
            src="https://i.postimg.cc/8cpvcNZ9/logo-lote.png" 
            alt="Lines of the Enmity Logo" 
            className="w-40 h-40 md:w-56 md:h-56 object-contain animate-pulse transition-all"
            suppressHydrationWarning
          />
        </div>

        {/* Текст статуса */}
        <div className="text-center">
          <p className="text-xs md:text-sm font-headline font-bold text-primary uppercase tracking-[0.3em] animate-pulse opacity-80">
            Идет передача данных...
          </p>
        </div>
      </div>

      {/* Копирайт в футере */}
      <div className="absolute bottom-12 text-center opacity-20">
        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          &copy; 2024 ENMITY LEAGUE OPERATIONS
        </p>
      </div>
    </div>
  );
}
