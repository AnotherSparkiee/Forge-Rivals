'use client';

import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { language, setLanguage } = useGameState();

  const labels = {
    en: { subtitle: "COMMAND CENTER ACCESS" },
    ru: { subtitle: "ДОСТУП К КОМАНДНОМУ ЦЕНТРУ" }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)] relative">
      {/* Language Switcher in Top Right */}
      <div className="absolute top-6 right-6 flex gap-2 bg-secondary/20 p-1 rounded-full border border-white/5 backdrop-blur-sm">
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn("w-8 h-8 p-0 rounded-full text-lg", language === 'en' && "bg-white/10")}
          onClick={() => setLanguage('en')}
        >
          🇺🇸
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className={cn("w-8 h-8 p-0 rounded-full text-lg", language === 'ru' && "bg-white/10")}
          onClick={() => setLanguage('ru')}
        >
          🇷🇺
        </Button>
      </div>

      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-headline font-bold tracking-tighter text-primary">MOBA TACTICS</h1>
          <p className="text-muted-foreground mt-2 text-xs uppercase tracking-widest">{t.subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
