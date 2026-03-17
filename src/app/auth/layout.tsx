'use client';

import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { language, setLanguage } = useGameState();

  const labels = {
    en: { subtitle: "COMMAND CENTER ACCESS", langName: "English" },
    ru: { subtitle: "ДОСТУП К КОМАНДНОМУ ЦЕНТРУ", langName: "Русский" }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)] relative overflow-hidden">
      {/* Extreme Top Right Language Switcher */}
      <div className="absolute top-2 right-2 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-10 h-10 p-0 rounded-full text-xl bg-secondary/20 hover:bg-secondary/40 border border-white/5 backdrop-blur-md"
            >
              {language === 'en' ? '🇺🇸' : '🇷🇺'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur-xl border-white/10">
            <DropdownMenuItem 
              onClick={() => setLanguage('en')}
              className={cn("flex items-center justify-between gap-4 cursor-pointer", language === 'en' && "text-primary")}
            >
              <div className="flex items-center gap-2">
                <span>🇺🇸</span> English
              </div>
              {language === 'en' && <Check className="w-4 h-4" />}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setLanguage('ru')}
              className={cn("flex items-center justify-between gap-4 cursor-pointer", language === 'ru' && "text-primary")}
            >
              <div className="flex items-center gap-2">
                <span>🇷🇺</span> Русский
              </div>
              {language === 'ru' && <Check className="w-4 h-4" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="w-full max-w-sm space-y-8 relative z-10">
        <div className="text-center">
          <h1 className="text-4xl font-headline font-bold tracking-tighter text-primary">MOBA TACTICS</h1>
          <p className="text-muted-foreground mt-2 text-xs uppercase tracking-widest">{t.subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
