
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { 
  ChevronLeft, Users, Globe, Search, 
  ChevronRight, User, Shield, Calendar,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { cn } from '@/lib/utils';

export default function AllManagersPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { language, isLoaded } = useGameState();
  const [search, setSearch] = useState('');

  // Сортировка по возрастанию даты: от старых к новым
  const managersQuery = useMemoFirebase(() => {
    return query(
      collection(db, 'players_v5'),
      orderBy('createdAt', 'asc'),
      limit(200)
    );
  }, [db]);

  const { data: managers, isLoading: isManagersLoading } = useCollection(managersQuery);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !isLoaded || !user) {
    return <LoadingScreen />;
  }

  const translations = {
    en: {
      title: "ALL MANAGERS",
      subtitle: "Global Personnel Database",
      search: "Search manager name...",
      registered: "Joined",
      div: "Div",
      noResults: "No managers found matching search.",
      viewDossier: "View Comms"
    },
    ru: {
      title: "ВСЕ МЕНЕДЖЕРЫ",
      subtitle: "Глобальная база данных персонала",
      search: "Поиск по названию...",
      registered: "В лиге с",
      div: "Див",
      noResults: "Менеджеры не найдены.",
      viewDossier: "Связаться"
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const filteredManagers = managers?.filter(m => 
    m.displayName?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-20">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/managers">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={t.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-secondary/50 border-white/10 h-11 text-sm focus-visible:ring-primary"
          />
        </div>
      </div>

      <div className="space-y-2">
        {isManagersLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[10px] uppercase font-bold tracking-widest">Accessing frequency...</p>
          </div>
        ) : filteredManagers.length > 0 ? (
          filteredManagers.map((manager) => (
            <Card key={manager.id} className="glass-card border-white/5 hover:bg-white/5 transition-all">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center border border-white/10 shrink-0">
                    <User className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="text-sm font-bold uppercase tracking-tight truncate">{manager.displayName}</h3>
                      {manager.id === user.uid && <Badge className="bg-primary text-primary-foreground text-[7px] h-3 px-1 uppercase">YOU</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground font-bold uppercase">
                      <span className="flex items-center gap-1"><Shield className="w-2.5 h-2.5" /> {t.div} {manager.leagueLevel}.{manager.divisionSubId || 1}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> {manager.createdAt ? new Date(manager.createdAt).toLocaleDateString() : '??.??.????'}</span>
                    </div>
                  </div>
                </div>
                <Link href={`/chats/private?uid=${manager.id}&name=${encodeURIComponent(manager.displayName || 'Manager')}`}>
                  <Button variant="outline" size="sm" className="h-8 text-[8px] font-black uppercase border-white/10 shrink-0 px-3">
                    {t.viewDossier}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-20 text-center opacity-30">
            <Users className="w-12 h-12 mx-auto mb-4" />
            <p className="text-xs uppercase font-bold tracking-widest">{t.noResults}</p>
          </div>
        )}
      </div>
    </div>
  );
}
