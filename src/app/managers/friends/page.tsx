
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { collection, query, where, doc, onSnapshot, limit } from 'firebase/firestore';
import { 
  ChevronLeft, UserCheck, Shield, User,
  Mail, MessageSquare, ChevronRight, Loader2,
  UserMinus, History, Search, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { cn } from '@/lib/utils';
import { getMoscowTime } from '@/app/lib/time-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export default function FriendsListPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { language, isLoaded } = useGameState();
  const [selectedFriend, setSelectedFriend] = useState<{id: string, name: string} | null>(null);

  // Query for accepted requests where current user is a participant
  const outgoingQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(
      collection(db, 'friend_requests_v4'),
      where('fromId', '==', user.uid),
      where('status', '==', 'accepted')
    );
  }, [db, user?.uid]);

  const incomingQuery = useMemoFirebase(() => {
    if (!user?.uid) return null;
    return query(
      collection(db, 'friend_requests_v4'),
      where('toId', '==', user.uid),
      where('status', '==', 'accepted')
    );
  }, [db, user?.uid]);

  const { data: outgoingFriends, isLoading: isOutLoading } = useCollection(outgoingQuery);
  const { data: incomingFriends, isLoading: isInLoading } = useCollection(incomingQuery);

  const friends = useMemo(() => {
    const list: any[] = [];
    if (outgoingFriends) {
      outgoingFriends.forEach(f => list.push({ id: f.toId, name: f.toName }));
    }
    if (incomingFriends) {
      incomingFriends.forEach(f => list.push({ id: f.fromId, name: f.fromName }));
    }
    return list;
  }, [outgoingFriends, incomingFriends]);

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
      title: "MY FRIENDS",
      subtitle: "Trusted Alliance Network",
      noFriends: "No friends in network",
      noFriendsDesc: "Search for managers in the 'All Managers' terminal to establish contact.",
      findFriends: "FIND MANAGERS",
      userMenuDesc: "Direct command options for",
      pm: "Private Messages",
      pmDesc: "Direct encrypted transmission",
      profile: "Manager Profile",
      profileDesc: "Operational statistics",
      close: "CLOSE"
    },
    ru: {
      title: "МОИ ДРУЗЬЯ",
      subtitle: "Доверенная сеть альянса",
      noFriends: "Друзей пока нет",
      noFriendsDesc: "Используйте поиск в терминале «Все менеджеры», чтобы найти союзников.",
      findFriends: "НАЙТИ МЕНЕДЖЕРОВ",
      userMenuDesc: "Команды взаимодействия с",
      pm: "Личные сообщения",
      pmDesc: "Прямая зашифрованная связь",
      profile: "Профиль менеджера",
      profileDesc: "Оперативная статистика",
      close: "ЗАКРЫТЬ"
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handlePrivateMessage = () => {
    if (selectedFriend) {
      router.push(`/chats/private?uid=${selectedFriend.id}&name=${encodeURIComponent(selectedFriend.name)}`);
    }
  };

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

      <div className="space-y-2">
        {(isOutLoading || isInLoading) ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4 opacity-50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[10px] uppercase font-black tracking-widest">Scanning alliance node...</p>
          </div>
        ) : friends.length > 0 ? (
          friends.map((friend) => (
            <Card 
              key={friend.id} 
              className="glass-card border-white/5 hover:bg-white/5 cursor-pointer transition-all active:scale-[0.98]"
              onClick={() => setSelectedFriend({ id: friend.id, name: friend.name })}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center border border-white/10">
                    <User className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase text-white">{friend.name}</h3>
                    <p className="text-[8px] text-muted-foreground font-black uppercase tracking-widest mt-0.5">Confirmed Ally</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[7px] border-green-500/20 text-green-400 uppercase">Friend</Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-center animate-in fade-in duration-700">
            <div className="w-20 h-20 rounded-full bg-secondary/10 border-2 border-dashed border-white/5 flex items-center justify-center mb-6">
              <UserCheck className="w-10 h-10 text-muted-foreground opacity-20" />
            </div>
            <h2 className="text-xl font-headline font-bold uppercase text-white tracking-tight">{t.noFriends}</h2>
            <p className="text-xs text-muted-foreground mt-2 max-w-[250px] leading-relaxed italic">
              {t.noFriendsDesc}
            </p>
            <Link href="/managers/all" className="mt-8">
              <Button className="h-12 px-8 hero-gradient font-black text-[10px] uppercase tracking-widest shadow-xl">
                <Search className="w-4 h-4 mr-2" /> {t.findFriends}
              </Button>
            </Link>
          </div>
        )}
      </div>

      <Dialog open={!!selectedFriend} onOpenChange={() => setSelectedFriend(null)}>
        <DialogContent className="max-w-md bg-background border-white/10 p-0 overflow-hidden shadow-2xl">
          <div className="p-6 bg-gradient-to-br from-primary/10 to-transparent border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-secondary/50 flex items-center justify-center border border-white/10">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-primary">
                  {selectedFriend?.name}
                </DialogTitle>
                <DialogDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                  {t.userMenuDesc} {selectedFriend?.name}
                </DialogDescription>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-2">
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

            <Card className="glass-card border-white/5 opacity-50 cursor-not-allowed">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <Shield className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase">{t.profile}</h3>
                    <p className="text-[9px] text-muted-foreground leading-tight">{t.profileDesc}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-white/5 opacity-30 cursor-not-allowed">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-secondary/50">
                    <UserMinus className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase">Remove Friend</h3>
                    <p className="text-[9px] text-muted-foreground leading-tight">Terminate alliance protocol</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="p-4 bg-secondary/20 border-t border-white/5">
            <Button 
              variant="outline" 
              className="w-full h-10 text-[10px] font-bold uppercase border-white/10"
              onClick={() => setSelectedFriend(null)}
            >
              {t.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
