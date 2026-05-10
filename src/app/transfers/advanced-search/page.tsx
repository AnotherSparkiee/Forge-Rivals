
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, Search, SlidersHorizontal, 
  Clock, Loader2, Gavel, 
  TrendingUp, AlertTriangle, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { COUNTRIES } from '@/app/lib/countries-data';
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, useDoc } from '@/firebase';
import { collection, query, where, doc, arrayUnion } from 'firebase/firestore';
import { getMoscowDateString } from '@/app/lib/time-utils';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from '@/components/ui/slider';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function AdvancedSearchPage() {
  const { language, isLoaded, credits } = useGameState();
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isBidding, setIsBidding] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Filter States
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [minOvr, setMinOvr] = useState([20]);
  const [ageRange, setAgeRange] = useState([17, 30]);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v5', user.uid) : null, [db, user]);
  const { data: profile, isLoading: isProfileLoading } = useDoc(userRef);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const today = getMoscowDateString();
  
  const marketQuery = useMemoFirebase(() => {
    // CRITICAL: Block query until fully authorized and profile loaded
    if (!isLoaded || isUserLoading || isProfileLoading || !user?.uid || !profile) return null;
    return query(collection(db, 'market_v1'), where('dropDate', '==', today));
  }, [db, today, user?.uid, isUserLoading, isProfileLoading, isLoaded, !!profile]);

  const { data: agents, isLoading: isMarketLoading } = useCollection(marketQuery);

  const filteredAgents = useMemo(() => {
    if (!agents) return [];
    return agents.filter(agent => {
      const player = agent.heroData;
      const isDropped = new Date(agent.dropTime).getTime() <= now;
      
      if (!isDropped) return false;

      const matchesRole = roleFilter === 'all' || player.role === roleFilter;
      const matchesCountry = countryFilter === 'all' || player.country.name === countryFilter;
      const matchesOvr = player.overallRating >= minOvr[0];
      const matchesAge = player.age >= ageRange[0] && player.age <= ageRange[1];

      return matchesRole && matchesCountry && matchesOvr && matchesAge;
    });
  }, [agents, roleFilter, countryFilter, minOvr, ageRange, now]);

  const handleBid = async (agent: any) => {
    if (!user || !profile || isBidding) return;

    if (agent.highestBidderId === user.uid) {
      toast({ title: language === 'ru' ? "Вы уже лидер" : "You are leading", variant: "destructive" });
      return;
    }

    if (agent.sellerId === user.uid) {
      toast({ title: language === 'ru' ? "Это ваш игрок" : "You are the seller", variant: "destructive" });
      return;
    }

    const minNextBid = Math.ceil(agent.currentBid * 1.03);
    if (credits < minNextBid) {
      toast({ title: language === 'ru' ? "Недостаточно средств" : "Insufficient funds", variant: "destructive" });
      return;
    }

    setIsBidding(agent.id);
    try {
      updateDocumentNonBlocking(doc(db, 'market_v1', agent.id), {
        currentBid: minNextBid,
        highestBidderId: user.uid,
        highestBidderName: profile.displayName || "Manager",
        bidders: arrayUnion(user.uid)
      });
      toast({ title: language === 'ru' ? "Ставка принята!" : "Bid Placed!" });
    } finally {
      setIsBidding(null);
    }
  };

  const formatCountdown = (expiryIso: string) => {
    const diff = new Date(expiryIso).getTime() - now;
    if (diff <= 0) return "CLOSED";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const resetFilters = () => {
    setRoleFilter('all');
    setCountryFilter('all');
    setMinOvr([20]);
    setAgeRange([17, 30]);
  };

  if (!isLoaded || isUserLoading || isProfileLoading) return <LoadingScreen />;

  const t = {
    title: language === 'ru' ? "РАСШИРЕННЫЙ ПОИСК" : "ADVANCED SCOUTING",
    subtitle: language === 'ru' ? "Детальные фильтры рынка" : "Detailed market filters",
    filters: language === 'ru' ? "ПАРАМЕТРЫ ПОИСКА" : "SCOUTING PARAMETERS",
    reset: language === 'ru' ? "СБРОСИТЬ" : "RESET",
    found: language === 'ru' ? "Найдено игроков" : "Agents found",
    role: language === 'ru' ? "Позиция" : "Position",
    country: language === 'ru' ? "Национальность" : "Nationality",
    minRating: language === 'ru' ? "Мин. рейтинг" : "Min OVR",
    age: language === 'ru' ? "Возраст" : "Age Range",
    all: language === 'ru' ? "Все" : "All",
    bid: language === 'ru' ? "СТАВКА" : "BID",
    overall: language === 'ru' ? "ОБЩ" : "OVR",
    noResults: language === 'ru' ? "Игроки не найдены" : "No agents found",
    roles: [
      { id: 'Carry', label: language === 'ru' ? "Керри" : "Carry" },
      { id: 'Midlaner', label: language === 'ru' ? "Мидер" : "Midlaner" },
      { id: 'Tank', label: language === 'ru' ? "Оффлейнер" : "Offlaner" },
      { id: 'Jungler', label: language === 'ru' ? "Поддержка (4)" : "Support" },
      { id: 'Support', label: language === 'ru' ? "Поддержка (5)" : "Full Support" },
    ]
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-6 flex items-center gap-4">
        <Link href="/transfers">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-primary" />
            {t.title}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
        </div>
      </header>

      <div className="mb-6">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="filters" className="border-white/10 glass-card rounded-xl px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-accent">
                <Search className="w-4 h-4" /> {t.filters}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-6 pt-2 pb-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground">{t.role}</label>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="bg-secondary/50 border-white/5 h-10 text-xs">
                      <SelectValue placeholder={t.all} />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-white/10">
                      <SelectItem value="all" className="text-xs uppercase">{t.all}</SelectItem>
                      {t.roles.map(r => (
                        <SelectItem key={r.id} value={r.id} className="text-xs uppercase">{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-muted-foreground">{t.country}</label>
                  <Select value={countryFilter} onValueChange={setCountryFilter}>
                    <SelectTrigger className="bg-secondary/50 border-white/5 h-10 text-xs">
                      <SelectValue placeholder={t.all} />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-white/10">
                      <SelectItem value="all" className="text-xs uppercase">{t.all}</SelectItem>
                      {COUNTRIES.map(c => (
                        <SelectItem key={c.code} value={c.name} className="text-xs uppercase">{c.flag} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4 px-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase text-muted-foreground">{t.minRating}</label>
                    <Badge variant="outline" className="text-accent border-accent/20">{minOvr[0]}+</Badge>
                  </div>
                  <Slider value={minOvr} onValueChange={setMinOvr} max={99} min={20} step={1} />
                </div>

                <div className="space-y-4 px-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase text-muted-foreground">{t.age}</label>
                    <Badge variant="outline" className="text-primary border-primary/20">{ageRange[0]} - {ageRange[1]}</Badge>
                  </div>
                  <Slider value={ageRange} onValueChange={setAgeRange} max={30} min={17} step={1} />
                </div>
              </div>

              <Button variant="outline" className="w-full h-10 text-[10px] font-black border-white/10 uppercase" onClick={resetFilters}>
                <RefreshCw className="w-3 h-3 mr-2" /> {t.reset}
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="flex items-center justify-between px-1 mb-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          {t.found}: <span className="text-primary">{filteredAgents.length}</span>
        </p>
      </div>

      <div className="space-y-3">
        {isMarketLoading ? (
          <div className="py-20 text-center opacity-50">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          </div>
        ) : filteredAgents.length > 0 ? (
          filteredAgents.map((agent) => {
            const player = agent.heroData;
            const isLeading = agent.highestBidderId === user?.uid;
            const isSeller = agent.sellerId === user?.uid;
            const minNext = Math.ceil(agent.currentBid * 1.03);
            const isClosed = now >= new Date(agent.expiresAt).getTime();

            return (
              <Card key={agent.id} className={cn(
                "glass-card border-white/5 overflow-hidden transition-all",
                isLeading && "border-green-500/30 bg-green-500/5",
                isClosed && "opacity-50 grayscale"
              )}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative shrink-0">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary/50 border border-white/10 shadow-lg">
                        <img src={player.image} alt={player.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-background rounded-md px-1 border border-white/10 text-[10px]">
                        {player.country.flag}
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold uppercase truncate">{player.name}</h3>
                        {isLeading && <Badge className="bg-green-500 text-white text-[7px] h-3 px-1 uppercase font-black">LEADER</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[7px] h-3 py-0 border-white/10 opacity-60 uppercase">{player.role}</Badge>
                        <div className="flex items-center gap-1 text-[8px] font-mono text-accent">
                          <Clock className="w-2.5 h-2.5" />
                          {formatCountdown(agent.expiresAt)}
                        </div>
                      </div>
                    </div>

                    <div className="text-right border-l border-white/5 pl-4">
                      <p className="text-[7px] font-black text-primary uppercase tracking-tighter mb-0.5">{t.overall}</p>
                      <p className="text-2xl font-headline font-bold text-primary italic leading-none">{player.overallRating}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-secondary/40 p-2.5 rounded-xl border border-white/5">
                      <p className="text-[7px] uppercase font-black text-muted-foreground flex items-center gap-1 mb-1">
                        <Gavel className="w-2.5 h-2.5" /> {t.bid}
                      </p>
                      <p className="text-sm font-headline font-bold text-white">€{agent.currentBid.toLocaleString()}</p>
                    </div>
                    <div className="bg-secondary/40 p-2.5 rounded-xl border border-white/5">
                      <p className="text-[7px] uppercase font-black text-muted-foreground flex items-center gap-1 mb-1">
                        <TrendingUp className="w-2.5 h-2.5" /> Next Min
                      </p>
                      <p className="text-sm font-headline font-bold text-primary">€{minNext.toLocaleString()}</p>
                    </div>
                  </div>

                  <Button 
                    className={cn(
                      "w-full h-11 font-black text-[10px] tracking-widest uppercase shadow-lg transition-all active:scale-95",
                      isLeading ? "bg-green-600 hover:bg-green-700" : "hero-gradient"
                    )}
                    onClick={() => handleBid(agent)}
                    disabled={!!isBidding || isClosed || isLeading || isSeller}
                  >
                    {isBidding === agent.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4 mr-2" />}
                    {isClosed ? "CLOSED" : (isLeading ? "HIGHEST BIDDER" : (isSeller ? "YOUR PLAYER" : "PLACE BID"))}
                  </Button>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
            <AlertTriangle className="w-16 h-16" />
            <p className="text-xs font-bold uppercase tracking-widest">{t.noResults}</p>
            <Button variant="link" className="text-primary uppercase text-[8px] font-black" onClick={resetFilters}>
              CLEAR FILTERS
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
