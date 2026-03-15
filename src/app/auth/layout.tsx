'use client';

import { useGameState } from '@/app/lib/store';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { language } = useGameState();

  const labels = {
    en: { subtitle: "COMMAND CENTER ACCESS" },
    ru: { subtitle: "ДОСТУП К КОМАНДНОМУ ЦЕНТРУ" }
  };

  const t = labels[language as keyof typeof labels] || labels.ru;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(circle_at_50%_50%,_hsl(var(--primary)/0.15),_transparent_70%)]">
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
