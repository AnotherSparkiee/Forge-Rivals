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
  ShieldCheck, Loader2, UserPlus, Check, X,
  LogOut, Newspaper, Crown, User, Mail, AlertTriangle,
  Clock, Info, ShieldX, UserMinus, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, query, doc, serverTimestamp, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useRouter } from 'next/navigation';

type AssocTab = 'menu' | 'all' | 'create' | 'my_assoc' | 'requests' | 'history' | 'news';

interface AssocMember {
  uid: string;
  name: string;
  joinedAt: string;
  role: 'owner' | 'deputy' | 'member';
}

interface AssocNews {
  type: 'join' | 'leave' | 'appoint_deputy' | 'remove_deputy' | 'kick';
  userName: string;
  timestamp: string;
}

export default function AssociationPage() {
  const { language, isLoaded, crystals, addCrystals } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<AssocTab>('menu');
  const [isProcessing, setIsProcessing] = useState(false);
  const [assocName, setAssocName] = useState('');
  const [assocDesc, setAssocDesc] = useState('');
  const [selectedPlayer, setSelectedUser] = useState<{id: string, name: string} | null>(null);
  const [viewingAssocId, setViewingAssocId] = useState<string | null>(null);
  const [showDisbandDialog, setShowDisbandDialog] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Standardize on v10 as per firestore.rules
  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v10', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  const allAssocsQuery = useMemoFirebase(() => query(collection(db, 'associations_v4')), [db]);
  const { data: allAssocs, isLoading: isAllAssocsLoading } = useCollection(allAssocsQuery);

  const myAssoc = useMemo(() => {
    if (!profile?.associationId || !allAssocs) return null;
    return allAssocs.find(a => a.id === profile.associationId) || null;
  }, [profile?.associationId, allAssocs]);

  const browsedAssoc = useMemo(() => {
    if (!viewingAssocId || !allAssocs) return null;
    return allAssocs.find(a => a.id === viewingAssocId) || null;
  }, [viewingAssocId, allAssocs]);

  const isOwner = myAssoc?.ownerId === user?.uid;
  const isDeputy = myAssoc?.deputyId === user?.uid;
  const canManage = isOwner || isDeputy;

  const getDisplayMembers = (assoc: any): AssocMember[] => {
    if (!assoc) return [];
    let list: AssocMember[] = [];
    
    if (assoc.membersData && Array.isArray(assoc.membersData) && assoc.membersData.length > 0) {
      list = assoc.membersData;
    } else if (assoc.members && Array.isArray(assoc.members)) {
      list = assoc.members.map((uid: string, i: number) => ({
        uid,
        name: assoc.memberNames?.[i] || "Manager",
        joinedAt: assoc.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        role: uid === assoc.ownerId ? 'owner' : (uid === assoc.deputyId ? 'deputy' : 'member')
      }));
    }
    
    const seen = new Set();
    return list.filter(m => {
      if (!m || !m.uid || seen.has(m.uid)) return false;
      seen.add(m.uid);
      return true;
    });
  };

  const myMemberInfo = useMemo(() => {
    if (!myAssoc || !user) return null;
    return getDisplayMembers(myAssoc).find(m => m.uid === user.uid);
  }, [myAssoc, user]);

  const cooldownMs = 14 * 24 * 60 * 60 * 1000;
  
  const joinedAtTime = myMemberInfo ? new Date(myMemberInfo.joinedAt).getTime() : 0;
  const canLeave = now > joinedAtTime + cooldownMs;
  const leaveTimeLeftMs = Math.max(0, (joinedAtTime + cooldownMs) - now);

  const lastJoinTime = profile?.lastJoinedAssocAt ? new Date(profile.lastJoinedAssocAt).getTime() : 0;
  const canJoinNew = now > lastJoinTime + cooldownMs;
  const joinTimeLeftMs = Math.max(0, (lastJoinTime + cooldownMs) - now);

  const formatCountdown = (ms: number) => {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    return `${days}д ${hours}ч ${mins}м`;
  };

  const t = {
    en: {
      title: "CLUB ASSOCIATION", subtitle: "Alliance Hub & Strategic Coalitions", back: "Back", insufficient: "Insufficient crystals",
      createTitle: "Create Association", namePlaceholder: "Association Name...", descPlaceholder: "Describe your alliance goals...", costLabel: "Cost: 500 💎",
      confirmCreate: "ESTABLISH ALLIANCE", noAssocs: "No associations found.", join: "Send Request", pending: "Request Sent", cancelRequest: "Cancel Request",
      members: "Members", owner: "Founder", deputy: "Deputy", requests: "Requests", leave: "Leave Association", cooldown: "Cooldown", joinCooldown: "Join Cooldown",
      newsFeed: "News Feed", userMenuDesc: "Direct command options for", appointDeputy: "Appoint Deputy", appointDeputyDesc: "Grants request management rights",
      removeDeputy: "Remove from Position", removeDeputyDesc: "Demotes deputy back to regular member", kickPlayer: "Kick from Association", kickDesc: "Removes player from alliance immediately",
      disband: "Disband Association", disbandDesc: "Complete alliance liquidation", disbandConfirmTitle: "DESTRUCTIVE PROTOCOL", disbandConfirmDesc: "This action will permanently delete the association and remove all members. This cannot be undone.", disbandBtn: "DISBAND ALLIANCE", alreadyMember: "You are already a member of an association",
      tabs: {
        my_assoc: { label: "My Association", desc: "Manage your current alliance", icon: ShieldCheck, color: "text-primary" },
        news: { label: "News Feed", desc: "Recent alliance events", icon: Newspaper, color: "text-accent" },
        all: { label: "All Associations", desc: "Browse all available alliances", icon: Globe, color: "text-blue-400" },
        create: { label: "Create Association", desc: "Found your own alliance network", icon: PlusCircle, color: "text-green-400" },
        requests: { label: "Requests", desc: "Pending membership applications", icon: UserPlus, color: "text-orange-400" },
        history: { label: "War Archive", desc: "Tournament history and logs", icon: History, color: "text-slate-400" }
      }
    },
    ru: {
      title: "АССОЦИАЦИЯ КЛУБОВ", subtitle: "Центр альянсов и стратегических союзов", back: "Назад", insufficient: "Недостаточно кристаллов",
      createTitle: "Создать ассоциацию", namePlaceholder: "Название ассоциации...", descPlaceholder: "Опишите цели вашего альянса...", costLabel: "Стоимость: 500 💎",
      confirmCreate: "ОСНОВАТЬ АЛЬЯНС", noAssocs: "Ассоциации не найдены.", join: "Вступить", pending: "Заявка подана", cancelRequest: "Отменить заявку",
      members: "Участники", owner: "Основатель", deputy: "Заместитель", requests: "Заявки", leave: "Покинуть ассоциацию", cooldown: "Кулдаун", joinCooldown: "Кулдаун вступления",
      newsFeed: "Лента новостей", userMenuDesc: "Команды взаимодействия с", appointDeputy: "Назначить заместителем", appointDeputyDesc: "Дает права управления заявками",
      removeDeputy: "Снять с должности", removeDeputyDesc: "Понижает заместителя до обычного участника", kickPlayer: "Исключить из ассоциации", kickDesc: "Немедленно удаляет игрока из альянса",
      disband: "Распустить ассоциацию", disbandDesc: "Полное удаление альянса", disbandConfirmTitle: "ПРОТОКОЛ ЛИКВИДАЦИИ", disbandConfirmDesc: "Это действие навсегда удалит ассоциацию и исключит всех участников. Это действие нельзя отменить.", disbandBtn: "ЛИКВИДИРОВАТЬ АЛЬЯНС", alreadyMember: "Вы уже состоите в ассоциации",
      tabs: {
        my_assoc: { label: "Моя ассоциация", desc: "Управление вашим альянсом", icon: ShieldCheck, color: "text-primary" },
        news: { label: "Лента новостей", desc: "Последние события альянса", icon: Newspaper, color: "text-accent" },
        all: { label: "Все ассоциации", desc: "Список всех доступных альянсов", icon: Globe, color: "text-blue-400" },
        create: { label: "Создать ассоциацию", desc: "Основать собственную сеть альянса", icon: PlusCircle, color: "text-green-400" },
        requests: { label: "Заявки", desc: "Ожидающие заявки на вступление", icon: UserPlus, color: "text-orange-400" },
        history: { label: "Архив войн", desc: "История турниров и логов", icon: History, color: "text-slate-400" }
      }
    }
  }[language as 'en' | 'ru'];

  const handleCreateAssoc = async () => {
    if (!user || !profile || isProcessing) return;
    if (profile.associationId) return;
    if (crystals < 500) return;
    if (assocName.trim().length < 3) return;

    setIsProcessing(true);
    try {
      const assocId = `assoc_${Date.now()}`;
      const assocRef = doc(db, 'associations_v4', assocId);
      const nowIso = new Date().toISOString();
      
      const assocData = {
        id: assocId,
        name: assocName.trim(),
        description: assocDesc.trim(),
        ownerId: user.uid,
        ownerName: profile.displayName || "Manager",
        deputyId: null,
        members: [user.uid],
        memberNames: [profile.displayName || "Manager"],
        membersData: [{ uid: user.uid, name: profile.displayName || "Manager", joinedAt: nowIso, role: 'owner' }],
        requests: [],
        news: [{ type: 'join', userName: profile.displayName || "Manager", timestamp: nowIso }],
        level: 1,
        createdAt: serverTimestamp()
      };

      setDocumentNonBlocking(assocRef, assocData);
      updateDocumentNonBlocking(userRef!, { 
        associationId: assocId,
        lastJoinedAssocAt: nowIso 
      });
      addCrystals(-500);

      toast({ title: language === 'ru' ? "Ассоциация создана!" : "Association Established!" });
      setActiveTab('my_assoc');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleJoinRequest = async (assoc: any) => {
    if (!user || !profile || isProcessing) return;
    if (profile.associationId) return;
    if (!canJoinNew) return;

    setIsProcessing(true);
    try {
      updateDocumentNonBlocking(doc(db, 'associations_v4', assoc.id), {
        requests: arrayUnion({ uid: user.uid, name: profile.displayName || "Manager" })
      });
      toast({ title: language === 'ru' ? "Заявка отправлена" : "Request Sent" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelRequest = async (assoc: any) => {
    if (!user || isProcessing) return;
    setIsProcessing(true);
    try {
      const applicant = assoc.requests?.find((r: any) => r.uid === user.uid);
      if (!applicant) return;
      updateDocumentNonBlocking(doc(db, 'associations_v4', assoc.id), {
        requests: arrayRemove(applicant)
      });
      toast({ title: language === 'ru' ? "Заявка отменена" : "Request Cancelled" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessRequest = async (applicant: any, accept: boolean) => {
    if (!myAssoc || !canManage || isProcessing) return;
    setIsProcessing(true);
    try {
      const assocRef = doc(db, 'associations_v4', myAssoc.id);
      const nowIso = new Date().toISOString();
      if (accept) {
        const newMember = { uid: applicant.uid, name: applicant.name, joinedAt: nowIso, role: 'member' };
        updateDocumentNonBlocking(assocRef, {
          members: arrayUnion(applicant.uid),
          memberNames: arrayUnion(applicant.name),
          membersData: arrayUnion(newMember),
          requests: arrayRemove(applicant),
          news: arrayUnion({ type: 'join', userName: applicant.name, timestamp: nowIso })
        });
        updateDocumentNonBlocking(doc(db, 'players_v10', applicant.uid), { 
          associationId: myAssoc.id,
          lastJoinedAssocAt: nowIso
        });
        toast({ title: `${applicant.name} accepted` });
      } else {
        updateDocumentNonBlocking(assocRef, { requests: arrayRemove(applicant) });
        toast({ title: `${applicant.name} rejected` });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLeave = async () => {
    if (!myAssoc || !myMemberInfo || !canLeave || isProcessing) return;
    setIsProcessing(true);
    try {
      const assocRef = doc(db, 'associations_v4', myAssoc.id);
      const nowIso = new Date().toISOString();
      updateDocumentNonBlocking(assocRef, {
        members: arrayRemove(user!.uid),
        memberNames: arrayRemove(profile!.displayName || "Manager"),
        membersData: arrayRemove(myMemberInfo),
        news: arrayUnion({ type: 'leave', userName: profile!.displayName || "Manager", timestamp: nowIso }),
        ...(isDeputy ? { deputyId: null } : {})
      });
      updateDocumentNonBlocking(userRef!, { associationId: null });
      toast({ title: language === 'ru' ? "Вы покинули ассоциацию" : "Left Association" });
      setActiveTab('menu');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKick = async () => {
    if (!myAssoc || !canManage || !selectedPlayer || isProcessing) return;
    setIsProcessing(true);
    try {
      const assocRef = doc(db, 'associations_v4', myAssoc.id);
      const nowIso = new Date().toISOString();
      const targetMember = getDisplayMembers(myAssoc).find(m => m.uid === selectedPlayer.id);
      if (!targetMember) return;
      updateDocumentNonBlocking(assocRef, {
        members: arrayRemove(selectedPlayer.id),
        memberNames: arrayRemove(selectedPlayer.name),
        membersData: arrayRemove(targetMember),
        news: arrayUnion({ type: 'kick', userName: selectedPlayer.name, timestamp: nowIso }),
        ...(myAssoc.deputyId === selectedPlayer.id ? { deputyId: null } : {})
      });
      updateDocumentNonBlocking(doc(db, 'players_v10', selectedPlayer.id), { associationId: null });
      toast({ title: language === 'ru' ? "Игрок исключен" : "Player Kicked" });
      setSelectedUser(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAppointDeputy = async () => {
    if (!myAssoc || !isOwner || !selectedPlayer || isProcessing) return;
    setIsProcessing(true);
    try {
      const assocRef = doc(db, 'associations_v4', myAssoc.id);
      const nowIso = new Date().toISOString();
      const updatedMembersData = getDisplayMembers(myAssoc).map(m => 
        m.uid === selectedPlayer.id ? { ...m, role: 'deputy' } : m
      );
      updateDocumentNonBlocking(assocRef, {
        deputyId: selectedPlayer.id,
        membersData: updatedMembersData,
        news: arrayUnion({ type: 'appoint_deputy', userName: selectedPlayer.name, timestamp: nowIso })
      });
      toast({ title: language === 'ru' ? "Заместитель назначен" : "Deputy Appointed" });
      setSelectedUser(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveDeputy = async () => {
    if (!myAssoc || !isOwner || !selectedPlayer || isProcessing) return;
    setIsProcessing(true);
    try {
      const assocRef = doc(db, 'associations_v4', myAssoc.id);
      const nowIso = new Date().toISOString();
      const updatedMembersData = getDisplayMembers(myAssoc).map(m => 
        m.uid === selectedPlayer.id ? { ...m, role: 'member' } : m
      );
      updateDocumentNonBlocking(assocRef, {
        deputyId: null,
        membersData: updatedMembersData,
        news: arrayUnion({ type: 'remove_deputy', userName: selectedPlayer.name, timestamp: nowIso })
      });
      toast({ title: language === 'ru' ? "Заместитель снят с должности" : "Deputy Removed" });
      setSelectedUser(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisbandAssoc = async () => {
    if (!myAssoc || !isOwner || isProcessing) return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      const members = myAssoc.members || [];
      members.forEach((uid: string) => {
        batch.update(doc(db, 'players_v10', uid), { associationId: null });
      });
      batch.delete(doc(db, 'associations_v4', myAssoc.id));
      await batch.commit();
      toast({ title: language === 'ru' ? "Ассоциация распущена" : "Association Disbanded" });
      setShowDisbandDialog(false);
      setActiveTab('menu');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isLoaded || isUserLoading || isProfileLoading) return <LoadingScreen />;

  const renderAssocDetails = (assoc: any, isCurrentMyAssoc: boolean) => {
    if (!assoc && profile?.associationId) return <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /><p className="text-[10px] uppercase font-bold text-muted-foreground mt-4">Synchronizing Alliance...</p></div>;
    
    const isPending = assoc?.requests?.some((r: any) => r.uid === user?.uid);
    const displayMembers = getDisplayMembers(assoc);
    const userAlreadyInAssoc = !!profile?.associationId;

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
        <Card className={cn( "glass-card border-primary/30 overflow-hidden", isCurrentMyAssoc ? "bg-primary/5" : "bg-secondary/10" )}>
           <CardContent className="p-8 text-center flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center mb-4 shadow-xl">
                <Shield className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-headline font-bold text-white uppercase italic">{assoc?.name}</h2>
              <Badge className="bg-primary/20 text-primary text-[10px] uppercase font-black tracking-widest mt-2 px-3">Level {assoc?.level || 1}</Badge>
              <p className="text-xs text-muted-foreground italic mt-4 px-6">"{assoc?.description}"</p>
              <div className="mt-8 w-full flex flex-col gap-2">
                {isCurrentMyAssoc && !isOwner && (
                  <div className="space-y-2">
                    <Button variant="destructive" className={cn("w-full h-10 text-[10px] font-black uppercase", !canLeave && "opacity-50")} onClick={handleLeave} disabled={!canLeave || isProcessing}>
                      <LogOut className="w-4 h-4 mr-2" /> {t.leave}
                    </Button>
                    {!canLeave && (
                      <div className="flex items-center justify-center gap-1 text-[8px] font-black text-red-400 uppercase tracking-widest">
                        <Clock className="w-3 h-3" /> {t.cooldown}: {formatCountdown(leaveTimeLeftMs)}
                      </div>
                    )}
                  </div>
                )}
                {!isCurrentMyAssoc && !userAlreadyInAssoc && (
                  <div className="space-y-2">
                    {!canJoinNew ? (
                       <div className="flex flex-col items-center gap-2 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                         <div className="flex items-center gap-1 text-[8px] font-black text-orange-400 uppercase tracking-widest"><Clock className="w-3 h-3" /> {t.joinCooldown}</div>
                         <p className="text-lg font-headline font-bold text-orange-400">{formatCountdown(joinTimeLeftMs)}</p>
                       </div>
                    ) : isPending ? (
                      <Button variant="outline" className="w-full h-12 border-orange-500/30 text-orange-400 font-black text-xs uppercase" onClick={() => handleCancelRequest(assoc)} disabled={isProcessing}><X className="w-4 h-4 mr-2" /> {t.cancelRequest}</Button>
                    ) : (
                      <Button className="w-full h-12 hero-gradient font-black text-xs uppercase" onClick={() => handleJoinRequest(assoc)} disabled={isProcessing}>{t.join}</Button>
                    )}
                  </div>
                )}
              </div>
           </CardContent>
        </Card>

        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">{t.members} ({assoc?.members?.length || 0})</h3>
          <div className="grid gap-2">
            {displayMembers.map((m: AssocMember, idx: number) => (
              <div key={`${m.uid}-${idx}`} onClick={() => setSelectedUser({ id: m.uid, name: m.name })} className="bg-secondary/20 p-3 rounded-xl border border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center border border-white/10">
                    {m.uid === assoc?.ownerId ? <Crown className="w-4 h-4 text-yellow-500" /> : <Users className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <span className="text-xs font-bold uppercase">{m.name}</span>
                  {m.uid === user?.uid && <Badge className="text-[7px] bg-primary text-primary-foreground">YOU</Badge>}
                </div>
                <div className="flex gap-1">
                  {m.uid === assoc?.ownerId && <Badge variant="outline" className="text-[7px] border-yellow-500/50 text-yellow-500 uppercase">{t.owner}</Badge>}
                  {m.uid === assoc?.deputyId && <Badge variant="outline" className="text-[7px] border-blue-500/50 text-blue-500 uppercase">{t.deputy}</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'all':
        if (viewingAssocId && browsedAssoc) {
          return (
            <div className="space-y-6">
              <Button variant="ghost" size="sm" onClick={() => setViewingAssocId(null)} className="h-8 text-[10px] font-bold uppercase text-primary">
                <ChevronLeft className="w-4 h-4 mr-1" /> {language === 'ru' ? 'К списку ассоциаций' : 'Back to List'}
              </Button>
              {renderAssocDetails(browsedAssoc, browsedAssoc.id === profile?.associationId)}
            </div>
          );
        }
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            {allAssocs && allAssocs.length > 0 ? allAssocs.map(assoc => {
              const isMember = assoc.members?.includes(user?.uid);
              const isPending = assoc.requests?.some((r: any) => r.uid === user?.uid);
              return (
                <Card key={assoc.id} className="glass-card border-white/5 bg-secondary/10 overflow-hidden cursor-pointer hover:bg-white/5 transition-all" onClick={() => setViewingAssocId(assoc.id)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-xl bg-primary/20"><Shield className="w-5 h-5 text-primary" /></div>
                      <div>
                        <h3 className="text-sm font-bold uppercase">{assoc.name}</h3>
                        <p className="text-[10px] text-muted-foreground">{assoc.members?.length || 1} / 20 {t.members}</p>
                      </div>
                    </div>
                    {isMember ? <Badge className="bg-green-500/20 text-green-400 text-[8px] uppercase">MEMBER</Badge> : isPending ? <Badge variant="outline" className="text-[8px] uppercase border-orange-500/50 text-orange-400">{t.pending}</Badge> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </CardContent>
                </Card>
              );
            }) : <div className="py-20 text-center opacity-30 text-xs font-bold uppercase tracking-widest">{t.noAssocs}</div>}
          </div>
        );

      case 'create':
        if (profile?.associationId) return null;
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {!canJoinNew && (
              <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex gap-3 items-center text-orange-400">
                <Clock className="w-5 h-5" />
                <p className="text-[10px] font-black uppercase tracking-widest">{t.joinCooldown}: {formatCountdown(joinTimeLeftMs)}</p>
              </div>
            )}
            <Card className="glass-card border-green-500/20 bg-green-500/5">
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2"><label className="text-[10px] font-black uppercase text-muted-foreground">{language === 'ru' ? 'НАЗВАНИЕ' : 'NAME'}</label><Input value={assocName} onChange={e => setAssocName(e.target.value)} placeholder={t.namePlaceholder} className="bg-background/50 border-white/10 h-12" disabled={!canJoinNew} /></div>
                <div className="space-y-2"><label className="text-[10px] font-black uppercase text-muted-foreground">{language === 'ru' ? 'ОПИСАНИЕ' : 'DESCRIPTION'}</label><Textarea value={assocDesc} onChange={e => setAssocDesc(e.target.value)} placeholder={t.descPlaceholder} className="bg-background/50 border-white/10 min-h-[100px]" disabled={!canJoinNew} /></div>
                <div className="pt-4 text-center"><p className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-4">{t.costLabel}</p><Button className="w-full h-14 hero-gradient font-black text-xs tracking-widest shadow-xl" onClick={handleCreateAssoc} disabled={isProcessing || assocName.trim().length < 3 || !canJoinNew}>{isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : t.confirmCreate}</Button></div>
              </CardContent>
            </Card>
          </div>
        );

      case 'my_assoc':
        if (profile?.associationId && !myAssoc) {
          return <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /><p className="text-[10px] uppercase font-bold text-muted-foreground mt-4">Retrieving Alliance Intelligence...</p></div>;
        }
        if (!myAssoc) return null;
        return renderAssocDetails(myAssoc, true);

      case 'requests':
        if (!canManage || !myAssoc) return null;
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            {myAssoc.requests && myAssoc.requests.length > 0 ? myAssoc.requests.map((req: any) => (
              <Card key={req.uid} className="glass-card border-orange-500/20 bg-orange-500/5">
                <CardContent className="p-4 flex items-center justify-between">
                   <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-background flex items-center justify-center border border-orange-500/30"><UserPlus className="w-5 h-5 text-orange-400" /></div><span className="text-sm font-bold uppercase">{req.name}</span></div>
                   <div className="flex gap-2">
                     <Button size="icon" className="h-8 w-8 bg-green-600" onClick={() => handleProcessRequest(req, true)} disabled={isProcessing}><Check className="w-4 h-4" /></Button>
                     <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => handleProcessRequest(req, false)} disabled={isProcessing}><X className="w-4 h-4" /></Button>
                   </div>
                </CardContent>
              </Card>
            )) : <div className="py-20 text-center opacity-30 text-xs font-bold uppercase tracking-widest">No pending applications.</div>}
          </div>
        );

      case 'news':
        if (profile?.associationId && !myAssoc) {
          return <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /><p className="text-[10px] uppercase font-bold text-muted-foreground mt-4">Decrypting News Feed...</p></div>;
        }
        return (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {myAssoc?.news && myAssoc.news.length > 0 ? [...myAssoc.news].reverse().map((n: AssocNews, i: number) => {
              const config = {
                join: { icon: UserPlus, color: "text-green-400", text: language === 'ru' ? 'вступил в альянс' : 'joined alliance' },
                leave: { icon: LogOut, color: "text-red-400", text: language === 'ru' ? 'покинул альянс' : 'left alliance' },
                kick: { icon: UserMinus, color: "text-destructive", text: language === 'ru' ? 'исключен из альянса' : 'kicked from alliance' },
                appoint_deputy: { icon: Crown, color: "text-yellow-500", text: language === 'ru' ? 'назначен заместителем' : 'appointed as deputy' },
                remove_deputy: { icon: ShieldX, color: "text-orange-400", text: language === 'ru' ? 'снят с должности заместителя' : 'removed from deputy position' },
              }[n.type] || { icon: Info, color: "text-blue-400", text: 'event' };
              return (
                <Card key={i} className="glass-card border-white/5 bg-secondary/10">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={cn("p-2 rounded-lg bg-secondary/50", config.color)}><config.icon className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0"><p className="text-xs font-bold uppercase truncate"><span className="text-white">{n.userName}</span> {config.text}</p><p className="text-[8px] text-muted-foreground font-mono uppercase mt-1">{new Date(n.timestamp).toLocaleString()}</p></div>
                  </CardContent>
                </Card>
              );
            }) : <div className="py-20 text-center opacity-30 text-xs font-bold uppercase tracking-widest">No history detected.</div>}
          </div>
        );

      default: return null;
    }
  };

  if (activeTab === 'menu') {
    const hasAssoc = !!profile?.associationId;
    const menuItems = [
      ...(hasAssoc ? [
        { id: 'my_assoc', ...t.tabs.my_assoc },
        { id: 'news', ...t.tabs.news }
      ] : [{ id: 'create', ...t.tabs.create }]),
      { id: 'all', ...t.tabs.all },
      ...(canManage ? [{ id: 'requests', ...t.tabs.requests, badge: myAssoc?.requests?.length || 0 }] : []),
      { id: 'history', ...t.tabs.history },
      ...(isOwner ? [{ id: 'disband', label: t.disband, desc: t.disbandDesc, icon: ShieldX, color: "text-red-500" }] : [])
    ];

    return (
      <div className="max-w-md mx-auto px-4 pt-8 pb-32">
        <header className="mb-8 flex items-center gap-4">
          <Link href="/"><Button variant="ghost" size="icon" className="rounded-full"><ChevronLeft className="w-6 h-6" /></Button></Link>
          <div><h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2"><Shield className="w-6 h-6 text-primary" /> {t.title}</h1><p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p></div>
        </header>

        <div className="space-y-2">
          {menuItems.map((item) => (
            <Card key={item.id} className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer group" onClick={() => { if (item.id === 'disband') setShowDisbandDialog(true); else setActiveTab(item.id as AssocTab); }}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl bg-secondary/50", item.color)}><item.icon className="w-5 h-5" /></div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold uppercase group-hover:text-white transition-colors">{item.label}</h3>
                      {item.badge > 0 && <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center animate-pulse"><span className="text-[8px] font-black text-primary-foreground">{item.badge}</span></div>}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{item.desc}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={showDisbandDialog} onOpenChange={setShowDisbandDialog}>
          <DialogContent className="max-w-xs bg-card border-white/10 p-6">
            <DialogHeader><div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 border border-red-500/20"><ShieldX className="w-8 h-8 text-red-500 animate-pulse" /></div><DialogTitle className="text-center font-headline font-bold uppercase text-red-500">{t.disbandConfirmTitle}</DialogTitle><DialogDescription className="text-center text-xs text-muted-foreground mt-2">{t.disbandConfirmDesc}</DialogDescription></DialogHeader>
            <div className="flex flex-col gap-2 mt-6"><Button variant="destructive" className="h-12 font-black uppercase text-[10px]" onClick={handleDisbandAssoc} disabled={isProcessing}>{isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />} {t.disbandBtn}</Button><Button variant="outline" className="h-12 font-bold uppercase text-[10px]" onClick={() => setShowDisbandDialog(false)} disabled={isProcessing}>{language === 'ru' ? 'ОТМЕНА' : 'CANCEL'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const isSelectedUserInMyAssoc = myAssoc?.members?.includes(selectedPlayer?.id);
  const isSelectedUserDeputy = selectedPlayer?.id === myAssoc?.deputyId;

  const dossierActions = [
    { label: t.appointDeputy, desc: t.appointDeputyDesc, icon: Crown, action: handleAppointDeputy, hidden: !isOwner || selectedPlayer?.id === user?.uid || isSelectedUserDeputy || !isSelectedUserInMyAssoc },
    { label: t.removeDeputy, desc: t.removeDeputyDesc, icon: ShieldX, action: handleRemoveDeputy, hidden: !isOwner || !isSelectedUserDeputy, color: 'text-red-400' },
    { label: t.kickPlayer, desc: t.kickDesc, icon: UserMinus, action: handleKick, hidden: !canManage || !isSelectedUserInMyAssoc || selectedPlayer?.id === user?.uid || (isDeputy && selectedPlayer?.id === myAssoc?.ownerId) || (isDeputy && isSelectedUserDeputy), color: 'text-destructive' },
    { label: language === 'ru' ? 'Личные сообщения' : 'Private Messages', desc: 'Direct encrypted transmission', icon: Mail, action: () => router.push(`/chats/private?uid=${selectedPlayer?.id}&name=${encodeURIComponent(selectedPlayer?.name || '')}`) },
    { label: language === 'ru' ? 'Страница игрока' : 'Player Page', desc: 'Detailed statistics', icon: User, disabled: true },
  ];

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => { setViewingAssocId(null); setActiveTab('menu'); }}><ChevronLeft className="w-6 h-6" /></Button>
        <div><h1 className="text-xl font-headline font-bold uppercase">{(t.tabs as any)[activeTab]?.label || 'ALLIANCE'}</h1><p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.back}</p></div>
      </header>
      {renderContent()}
      <Dialog open={!!selectedPlayer} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md bg-background border-white/10 p-0 overflow-hidden">
          <DialogHeader className="p-6 bg-gradient-to-br from-primary/10 to-transparent border-b border-white/5"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center border border-white/10"><User className="w-6 h-6 text-primary" /></div><div><DialogTitle className="text-xl font-headline font-bold uppercase tracking-tight text-primary">{selectedPlayer?.name}</DialogTitle><DialogDescription className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{t.userMenuDesc} {selectedPlayer?.name}</DialogDescription></div></div></DialogHeader>
          <div className="p-4 space-y-2">{dossierActions.map((item, idx) => !item.hidden && (<Card key={idx} className={cn("glass-card border-white/5 transition-all", item.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white/5 cursor-pointer")} onClick={() => !item.disabled && item.action && item.action()}><CardContent className="p-3 flex items-center justify-between"><div className="flex items-center gap-4"><div className="p-2 rounded-lg bg-secondary/50">{isProcessing && (idx < 3) ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <item.icon className={cn("w-5 h-5", item.color || "text-primary")} />}</div><div><h3 className={cn("text-xs font-bold uppercase", item.color)}>{item.label}</h3><p className="text-[9px] text-muted-foreground leading-tight">{item.desc}</p></div></div>{!item.disabled && <ChevronRight className="w-4 h-4 text-muted-foreground" />}</CardContent></Card>))}</div>
          <div className="p-4 bg-secondary/20 border-t border-white/5"><Button variant="outline" className="w-full h-10 text-[10px] font-bold uppercase border-white/10" onClick={() => setSelectedUser(null)}>{language === 'ru' ? 'ЗАКРЫТЬ' : 'CLOSE'}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
