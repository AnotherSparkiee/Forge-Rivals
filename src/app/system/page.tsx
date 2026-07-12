
'use client';

import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Settings, Users, ShieldCheck, Mail, Info, Palette } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function SystemPage() {
  const { language } = useGameState();

  const t = {
    ru: { title: "СИСТЕМА", subtitle: "Параметры и сетевая статистика" },
    en: { title: "SYSTEM", subtitle: "Parameters and network metrics" }
  }[language === 'ru' ? 'ru' : 'en'];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-8 flex items-center gap-4">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full bg-secondary/50 border border-white/5">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-black opacity-50">{t.subtitle}</p>
        </div>
      </header>

      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-accent px-1">Network Status</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card className="glass-card border-white/5 bg-secondary/10">
              <CardContent className="p-4 text-center">
                <Users className="w-5 h-5 text-primary mx-auto mb-2" />
                <p className="text-[8px] font-black text-muted-foreground uppercase">Online Managers</p>
                <p className="text-xl font-headline font-bold text-white italic">402</p>
              </CardContent>
            </Card>
            <Card className="glass-card border-white/5 bg-secondary/10">
              <CardContent className="p-4 text-center">
                <ShieldCheck className="w-5 h-5 text-green-400 mx-auto mb-2" />
                <p className="text-[8px] font-black text-muted-foreground uppercase">Total Registered</p>
                <p className="text-xl font-headline font-bold text-white italic">12,490</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-accent px-1">Global Config</h2>
          <Card className="glass-card border-white/5 bg-secondary/10 cursor-not-allowed opacity-60">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Palette className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-xs font-bold uppercase">Visual Skins</h3>
                  <p className="text-[9px] text-muted-foreground uppercase">Customize UI accents</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[7px]">LOCKED</Badge>
            </CardContent>
          </Card>
          <Card className="glass-card border-white/5 bg-secondary/10">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Mail className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-xs font-bold uppercase">Technical Support</h3>
                  <p className="text-[9px] text-muted-foreground uppercase">Submit help request</p>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180" />
            </CardContent>
          </Card>
        </section>

        <div className="p-6 bg-primary/5 rounded-2xl border border-dashed border-white/10 text-center opacity-30">
          <Info className="w-8 h-8 mx-auto mb-2" />
          <p className="text-[8px] font-black uppercase tracking-widest">Host ID: 2788872209-FMO</p>
        </div>
      </div>
    </div>
  );
}
