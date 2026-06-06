
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc, setDocumentNonBlocking } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { collection, query, orderBy, limit, where, doc, onSnapshot } from 'firebase/firestore';
import { 
  ChevronLeft, Users, Search, Shield, Calendar,
  Loader2, UserPlus, User, Mail, ChevronRight, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';

export default function AllManagersPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const { language, isLoaded } = useGameState();
  const [search, setSearch] = useState('');
  const [isActionProcessing, setIsActionProcessing] = useState(false);
  const [selectedManager, setSelectedManager] = useState<{id: string, name: string} | null>(null);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  // Ограничиваем запрос 100 менеджерами
  const managersQuery = useMemoFirebase(() => {
    return query(
      collection(db, 'players_v10'),
      orderBy('displayName', 'asc'),
      limit(100)
    );
  }, [db]);

  const { data: managers, isLoading: isManagersLoading } = useCollection(managersQuery);

  // Загружаем ассоциации для отображения названий
  const assocsQuery = useMemoFirebase(() => query(collection(db, 'associations_v4')), [db]);
  const { data: allAssocs } = useCollection(assocsQuery);

  const assocMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (allAssocs) {
      allAssocs.forEach(a => {
        map[a.id] = a.name;
      });
    }
    return map;
  }, [allAssocs]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  const handleAddFriend = async () => {
    if (!selectedManager || !user || !profile || isActionProcessing) return;
    
    setIsActionProcessing(true);
    try {
      const requestId = `req_${user.uid}_${selectedManager.id}`;
      const requestRef = doc(db, 'friend_requests_v4', requestId);
      const now = new Date().toISOString();

      const requestData = {
        fromId: String(user.uid),
        fromName: String(profile.displayName || "Manager"),
        toId: String(selectedManager.id),
        toName: String(selectedManager.name),
        status: 'pending',
        createdAt: now,
        updatedAt: now
      };

      await setDocumentNonBlocking(requestRef, requestData);

      toast({ 
        title: language === 'ru' ? "Заявка отправлена!" : "Request Sent!",
        description: language === 'ru' ? `Вы предложили дружбу ${selectedManager.name}` : `Friendship proposed to ${selectedManager.name}`
      });
      setSelectedManager(null);
    } catch (e: any) {
      console.error("Failed to add friend:", e);
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsActionProcessing(false);
    }
  };

  const handlePrivateMessage = () => {
    if (selectedManager) {
      router.push(`/chats/private?uid=${selectedManager.id}&name=${encodeURIComponent(selectedManager.name)}`);
    }
  };

  if (isUserLoading || !isLoaded || !user) {
    return <LoadingScreen />;
  }

  const translations = {
    en: {
      title: "ALL MANAGERS",
      subtitle: "Global Personnel Database",
      search: "Search manager name...",
      noAssoc: "Not in association",
      noResults: "No managers found matching search.",
      userMenuDesc: "Direct command options for",
      addFriend: "Add Friend",
      addFriendDesc: "Send friendship request",
      pm: "Private Messages",
      pmDesc: "Direct encrypted transmission",
      close: "CLOSE",
      lvl: "LVL"
    },
    ru: {
      title: "ВСЕ МЕНЕДЖЕРЫ",
      subtitle: "Глобальная база данных персонала",
      search: "Поиск по названию...",
      noAssoc: "Не сост. в ассоциации",
      noResults: "Менеджеры не найдены.",
      userMenuDesc: "Команды взаимодействия с",
      addFriend: "Добавить в друзья",
      addFriendDesc: "Отправить запрос на дружбу",
      pm: "Личные сообщения",
      pmDesc: "Прямая зашифрованная связь",
      close: "ЗАКРЫТЬ",
      lvl: "Ур"
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const filteredManagers = managers?.filter(m => 
    m.displayName?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
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
          filteredManagers.map((manager) => {
            const assocName = manager.associationId ? assocMap[manager.associationId] : null;
            
            return (
              <div 
                key={manager.id} 
                onClick={() => setSelectedManager({ id: manager.id, name: manager.displayName })}
                className="bg-secondary/20 p-3 rounded-xl border border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center border border-white/10">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase">{manager.displayName}</span>
                      {manager.id === user.uid && <Badge className="text-[7px] bg-primary text-primary-foreground">YOU</Badge>}
                    </div>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-tight",
                      assocName ? "text-primary" : "text-muted-foreground/40"
                    )}>
                      {assocName || t.noAssoc}
                    </span>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="text-[10px] font-black text-primary uppercase whitespace-nowrap">
                    {manager.managerLevel || 1} {t.lvl}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-20 text-center opacity-30">
            <Users className="w-12 h-12 mx-auto mb-4" />
            <p className="text-xs uppercase font-bold tracking-widest">{t.noResults}</p>
          </div>
        )}
      </div>

      {/* Диалог взаимодействия с менеджером */}
      <Dialog open={!!selectedManager} onOpenChange={() => setSelectedManager(null)}>
        <DialogContent className="max-w-md bg-background border-white/10 p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-gradient-to-br from-primary/10 to-transparent border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center border border-white/10">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-primary">
                  {selectedManager?.name}
                </DialogTitle>
                <DialogDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                  {t.userMenuDesc} {selectedManager?.name}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-4 space-y-2">
            {/* Добавить в друзья */}
            {selectedManager?.id !== user.uid && (
              <Card 
                className="glass-card border-white/5 hover:bg-white/5 cursor-pointer transition-all active:scale-[0.98]"
                onClick={handleAddFriend}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-secondary/50">
                      {isActionProcessing ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      ) : (
                        <UserPlus className="w-5 h-5 text-green-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase text-green-400">{t.addFriend}</h3>
                      <p className="text-[9px] text-muted-foreground leading-tight">{t.addFriendDesc}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </CardContent>
              </Card>
            )}

            {/* Личные сообщения */}
            <Card 
              className="glass-card border-white/5 hover:bg-white/5 cursor-pointer transition-all active:scale-[0.98]"
              onClick={handlePrivateMessage}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase text-white">{t.pm}</h3>
                    <p className="text-[9px] text-muted-foreground leading-tight">{t.pmDesc}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </CardContent>
            </Card>

            {/* Заглушки для других действий (как в оригинале) */}
            <Card className="glass-card border-white/5 opacity-50 cursor-not-allowed">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <Shield className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase">Club Page</h3>
                    <p className="text-[9px] text-muted-foreground leading-tight">Restricted clearance</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="p-4 bg-secondary/20 border-t border-white/5">
            <Button 
              variant="outline" 
              className="w-full h-10 text-[10px] font-bold uppercase border-white/10"
              onClick={() => setSelectedManager(null)}
            >
              {t.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
