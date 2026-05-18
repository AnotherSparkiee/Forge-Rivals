'use client';

import { useState, useMemo, useEffect } from 'react';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  ChevronLeft, ChevronRight, Shield, Globe, 
  PlusCircle, History, Users, 
  ShieldCheck, Loader2, UserPlus, Check, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, serverTimestamp, arrayUnion, arrayRemove, setDoc, updateDoc } from 'firebase/firestore';

type AssocTab = 'menu' | 'all' | 'create' | 'my_assoc' | 'requests' | 'history';

export default function AssociationPage() {
  const { language, isLoaded, crystals, addCrystals } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<AssocTab>('menu');
  const [isProcessing, setIsProcessing] = useState(false);

  const [assocName, setAssocName] = useState('');
  const [assocDesc, setAssocDesc] = useState('');

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const allAssocsQuery = useMemoFirebase(() => query(collection(db, 'associations_v1')), [db]);
  const { data: allAssocs, isLoading: isAssocsLoading } = useCollection(allAssocsQuery);

  const myAssoc = useMemo(() => {
    if (!profile?.associationId || !allAssocs) return null;
    return allAssocs.find(a => a.id === profile.associationId) || null;
  }, [profile?.associationId, allAssocs]);

  const isOwner = myAssoc?.ownerId === user?.uid;

  const t = {
    en: {
      title: "CLUB ASSOCIATION",
      subtitle: "Alliance Hub & Strategic Coalitions",
      back: "Back",
      insufficient: "Insufficient crystals",
      createTitle: "Create Association",
      namePlaceholder: "Association Name...",
      descPlaceholder: "Describe your alliance goals...",
      costLabel: "Cost: 500 💎",
      confirmCreate: "ESTABLISH ALLIANCE",
      noAssocs: "No associations found.",
      join: "Send Request",
      pending: "Request Sent",
      members: "Members",
      owner: "Founder",
      requests: "Join Requests",
      tabs: {
        my_assoc: { label: "My Association", desc: "Manage your current alliance", icon: ShieldCheck, color: "text-primary" },
        all: { label: "Global Directory", desc: "Browse all available alliances", icon: Globe, color: "text-blue-400" },
        create: { label: "Create Association", desc: "Found your own alliance network", icon: PlusCircle, color: "text-green-400" },
        requests: { label: "Recruitment", desc: "Pending membership applications", icon: UserPlus, color: "text-orange-400" },
        history: { label: "War Archive", desc: "Tournament history and logs", icon: History, color: "text-accent" }
      }
    },
    ru: {
      title: "АССОЦИАЦИЯ КЛУБОВ",
      subtitle: "Центр альянсов и стратегических союзов",
      back: "Назад",
      insufficient: "Недостаточно кристаллов",
      createTitle: "Создать ассоциацию",
      namePlaceholder: "Название ассоциации...",
      descPlaceholder: "Опишите цели вашего альянса...",
      costLabel: "Стоимость: 500 💎",
      confirmCreate: "ОСНОВАТЬ АЛЬЯНС",
      noAssocs: "Ассоциации не найдены.",
      join: "Вступить",
      pending: "Заявка подана",
      members: "Участники",
      owner: "Основатель",
      requests: "Заявки на вступление",
      tabs: {
        my_assoc: { label: "Моя ассоциация", desc: "Управление вашим альянсом", icon: ShieldCheck, color: "text-primary" },
        all: { label: "Глобальный каталог", desc: "Список всех доступных альянсов", icon: Globe, color: "text-blue-400" },
        create: { label: "Создать ассоциацию", desc: "Основать собственную сеть альянса", icon: PlusCircle, color: "text-green-400" },
        requests: { label: "Вербовка", desc: "Ожидающие заявки на вступление", icon: UserPlus, color: "text-orange-400" },
        history: { label: "Архив войн", desc: "История турниров и логов", icon: History, color: "text-accent" }
      }
    }
  }[language as 'en' | 'ru'] || {
    title: "ASSOCIATION",
    subtitle: "Alliances",
    back: "Back",
    insufficient: "No crystals",
    createTitle: "Create",
    namePlaceholder: "Name",
    descPlaceholder: "Desc",
    costLabel: "500",
    confirmCreate: "CREATE",
    noAssocs: "None",
    join: "Join",
    pending: "Wait",
    members: "Members",
    owner: "Owner",
    requests: "Reqs",
    tabs: {
      my_assoc: { label: "My Assoc", desc: "Manage", icon: ShieldCheck, color: "text-primary" },
      all: { label: "All", desc: "Browse", icon: Globe, color: "text-blue-400" },
      create: { label: "Create", desc: "New", icon: PlusCircle, color: "text-green-400" },
      requests: { label: "Reqs", desc: "Applicants", icon: UserPlus, color: "text-orange-400" },
      history: { label: "History", desc: "Logs", icon: History, color: "text-accent" }
    }
  };

  const handleCreateAssoc = async () => {
    if (!user || !profile || isProcessing) return;
    if (crystals < 500) {
      toast({ title: t.insufficient, variant: "destructive" });
      return;
    }
    if (assocName.trim().length < 3) return;

    setIsProcessing(true);
    try {
      const assocId = `assoc_${Date.now()}`;
      const assocRef = doc(db, 'associations_v1', assocId);
      
      const assocData = {
        id: assocId,
        name: assocName.trim(),
        description: assocDesc.trim(),
        ownerId: user.uid,
        ownerName: profile.displayName || "Manager",
        members: [user.uid],
        memberNames: [profile.displayName || "Manager"],
        requests: [],
        level: 1,
        createdAt: serverTimestamp()
      };

      // Прямая запись через SDK для надежности
      await setDoc(assocRef, assocData);
      await updateDoc(userRef!, { associationId: assocId });
      
      addCrystals(-500);

      toast({ title: language === 'ru' ? "Ассоциация создана!" : "Association Established!" });
      setActiveTab('my_assoc');
    } catch (e: any) {
      console.error("Error creating association:", e);
      toast({ title: "Operation Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleJoinRequest = async (assoc: any) => {
    if (!user || !profile || isProcessing) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'associations_v1', assoc.id), {
        requests: arrayUnion({ uid: user.uid, name: profile.displayName || "Manager" })
      });
      toast({ title: language === 'ru' ? "Заявка отправлена" : "Request Sent" });
    } catch (e: any) {
      console.error(e);
      toast({ title: "Failed to send request", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessRequest = async (applicant: any, accept: boolean) => {
    if (!myAssoc || !isOwner || isProcessing) return;
    setIsProcessing(true);
    try {
      const assocRef = doc(db, 'associations_v1', myAssoc.id);
      if (accept) {
        await updateDoc(assocRef, {
          members: arrayUnion(applicant.uid),
          memberNames: arrayUnion(applicant.name),
          requests: arrayRemove(applicant)
        });
        await updateDoc(doc(db, 'players_v5', applicant.uid), {
          associationId: myAssoc.id
        });
        toast({ title: `${applicant.name} accepted` });
      } else {
        await updateDoc(assocRef, {
          requests: arrayRemove(applicant)
        });
        toast({ title: `${applicant.name} rejected` });
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: "Failed to process request", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isLoaded || isUserLoading) return <LoadingScreen />;

  const renderContent = () => {
    switch (activeTab) {
      case 'all':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            {allAssocs && allAssocs.length > 0 ? allAssocs.map(assoc => {
              const isMember = assoc.members?.includes(user?.uid);
              const isPending = assoc.requests?.some((r: any) => r.uid === user?.uid);
              
              return (
                <Card key={assoc.id} className="glass-card border-white/5 bg-secondary/10 overflow-hidden">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-xl bg-primary/20">
                        <Shield className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold uppercase">{assoc.name}</h3>
                        <p className="text-[10px] text-muted-foreground">{assoc.members?.length || 1} / 20 {t.members}</p>
                      </div>
                    </div>
                    {!myAssoc ? (
                      <Button 
                        size="sm" 
                        variant={isPending ? "outline" : "default"} 
                        className={cn("h-8 text-[8px] font-black uppercase", !isPending && "hero-gradient")}
                        onClick={() => !isPending && handleJoinRequest(assoc)}
                        disabled={isPending || isProcessing}
                      >
                        {isPending ? t.pending : t.join}
                      </Button>
                    ) : isMember && (
                      <Badge className="bg-green-500/20 text-green-400 text-[8px] uppercase">MEMBER</Badge>
                    )}
                  </CardContent>
                </Card>
              );
            }) : (
              <div className="py-20 text-center opacity-30 text-xs font-bold uppercase tracking-widest">{t.noAssocs}</div>
            )}
          </div>
        );

      case 'create':
        if (myAssoc) return (
          <div className="py-20 text-center flex flex-col items-center gap-4">
            <ShieldCheck className="w-12 h-12 text-primary opacity-20" />
            <div className="uppercase text-xs font-bold opacity-40">
              {language === 'ru' ? 'Вы уже состоите в ассоциации.' : 'You are already in an association.'}
            </div>
            <Button variant="outline" size="sm" onClick={() => setActiveTab('my_assoc')} className="text-[10px] uppercase font-bold">
              {language === 'ru' ? 'ПЕРЕЙТИ В МОЙ АЛЬЯНС' : 'GO TO MY ALLIANCE'}
            </Button>
          </div>
        );
        
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <Card className="glass-card border-green-500/20 bg-green-500/5">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground">{language === 'ru' ? 'НАЗВАНИЕ' : 'NAME'}</label>
                  <Input 
                    value={assocName} 
                    onChange={e => setAssocName(e.target.value)} 
                    placeholder={t.namePlaceholder}
                    className="bg-background/50 border-white/10 h-12"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground">{language === 'ru' ? 'ОПИСАНИЕ' : 'DESCRIPTION'}</label>
                  <Textarea 
                    value={assocDesc} 
                    onChange={e => setAssocDesc(e.target.value)} 
                    placeholder={t.descPlaceholder}
                    className="bg-background/50 border-white/10 min-h-[100px]"
                  />
                </div>
                <div className="pt-4 text-center">
                  <p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-4">{t.costLabel}</p>
                  <Button 
                    className="w-full h-14 hero-gradient font-black text-xs tracking-widest shadow-xl active:scale-95 transition-all"
                    onClick={handleCreateAssoc}
                    disabled={isProcessing || assocName.trim().length < 3}
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : t.confirmCreate}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'my_assoc':
        if (!myAssoc) return (
          <div className="py-20 text-center opacity-30 text-xs font-bold uppercase tracking-widest">
            {language === 'ru' ? 'У вас пока нет ассоциации.' : 'You have no association yet.'}
          </div>
        );
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <Card className="glass-card border-primary/30 bg-primary/5 overflow-hidden">
               <CardContent className="p-8 text-center flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-secondary/50 border-2 border-primary flex items-center justify-center mb-4 shadow-xl">
                    <Shield className="w-10 h-10 text-primary" />
                  </div>
                  <h2 className="text-2xl font-headline font-bold text-white uppercase italic">{myAssoc.name}</h2>
                  <Badge className="bg-primary/20 text-primary text-[10px] uppercase font-black tracking-widest mt-2 px-3">Level {myAssoc.level}</Badge>
                  <p className="text-xs text-muted-foreground italic mt-4 px-6">"{myAssoc.description}"</p>
               </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">{t.members} ({myAssoc.members?.length})</h3>
              <div className="grid gap-2">
                {myAssoc.members?.map((mid: string, i: number) => (
                  <div key={mid} className="bg-secondary/20 p-3 rounded-xl border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center border border-white/10">
                        <Users className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <span className="text-xs font-bold uppercase">{myAssoc.memberNames?.[i] || "Manager"}</span>
                    </div>
                    {mid === myAssoc.ownerId && <Badge variant="outline" className="text-[7px] border-yellow-500/50 text-yellow-500 uppercase">{t.owner}</Badge>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'requests':
        if (!isOwner || !myAssoc) return null;
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            {myAssoc.requests && myAssoc.requests.length > 0 ? myAssoc.requests.map((req: any) => (
              <Card key={req.uid} className="glass-card border-orange-500/20 bg-orange-500/5">
                <CardContent className="p-4 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center border border-orange-500/30">
                       <UserPlus className="w-5 h-5 text-orange-400" />
                     </div>
                     <span className="text-sm font-bold uppercase">{req.name}</span>
                   </div>
                   <div className="flex gap-2">
                     <Button size="icon" className="h-8 w-8 bg-green-600 hover:bg-green-700" onClick={() => handleProcessRequest(req, true)} disabled={isProcessing}>
                       <Check className="w-4 h-4" />
                     </Button>
                     <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => handleProcessRequest(req, false)} disabled={isProcessing}>
                       <X className="w-4 h-4" />
                     </Button>
                   </div>
                </CardContent>
              </Card>
            )) : (
              <div className="py-20 text-center opacity-30 text-xs font-bold uppercase tracking-widest">No pending applications.</div>
            )}
          </div>
        );

      case 'history':
        return (
          <div className="py-20 text-center opacity-20 flex flex-col items-center gap-4">
            <History className="w-16 h-16" />
            <p className="text-xs font-black uppercase tracking-[0.2em]">Association Battle History Offline</p>
          </div>
        );

      default: return null;
    }
  };

  if (activeTab === 'menu') {
    const menuItems = [
      ...(myAssoc ? [{ id: 'my_assoc', ...t.tabs.my_assoc }] : [{ id: 'create', ...t.tabs.create }]),
      { id: 'all', ...t.tabs.all },
      ...(isOwner ? [{ id: 'requests', ...t.tabs.requests }] : []),
      { id: 'history', ...t.tabs.history }
    ];

    return (
      <div className="max-w-md mx-auto px-4 pt-8 pb-32">
        <header className="mb-8 flex items-center gap-4">
          <Link href="/"><Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button></Link>
          <div>
            <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" /> {t.title}
            </h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
          </div>
        </header>

        {myAssoc && (
          <Card className="glass-card mb-8 border-primary/20 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground leading-none mb-1">Active Alliance</p>
                  <p className="text-sm font-bold uppercase">{myAssoc.name}</p>
                </div>
              </div>
              <Badge className="bg-primary/20 text-primary uppercase text-[8px] font-black">LVL {myAssoc.level}</Badge>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          {menuItems.map((item) => (
            <Card key={item.id} className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer group" onClick={() => setActiveTab(item.id as AssocTab)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl bg-secondary/50", item.color)}><item.icon className="w-5 h-5" /></div>
                  <div>
                    <h3 className="text-sm font-bold uppercase group-hover:text-white transition-colors">{item.label}</h3>
                    <p className="text-[10px] text-muted-foreground leading-tight">{item.desc}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setActiveTab('menu')}>
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-xl font-headline font-bold uppercase tracking-tight">
            {(t.tabs as any)[activeTab]?.label}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.back}</p>
        </div>
      </header>
      {renderContent()}
    </div>
  );
}