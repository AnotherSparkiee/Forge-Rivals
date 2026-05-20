'use client';

import { useState, useMemo } from 'react';
import { useGameState } from '../lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, ChevronRight, Gem, UserPlus, 
  Edit3, Flag, Coins, Star,
  Loader2, Info, Sparkles, ShoppingCart,
  ArrowRightLeft, Target, Calendar, User
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { useToast } from '@/hooks/use-toast';
import { COUNTRIES } from '../lib/countries-data';
import { Hero, Role } from '../lib/moba-data';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ShopTab = 
  | 'menu'
  | 'diamonds' 
  | 'create_player' 
  | 'exchange' 
  | 'change_name' 
  | 'change_country';

export default function ShopPage() {
  const { 
    language, isLoaded, credits, crystals, 
    addCrystals, addCredits, addYouthHeroDirectly, 
    updateProfileName, updateProfileCountry, country: currentCountry 
  } = useGameState();
  const [activeTab, setActiveTab] = useState<ShopTab>('menu');
  const [newName, setNewName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Custom Hero Creator States
  const [heroNickname, setHeroNickname] = useState('');
  const [heroRole, setHeroRole] = useState<Role>('Carry');
  const [heroTalent, setHeroTalent] = useState('4.0');
  const [heroAge, setHeroAge] = useState('16');
  const [heroCountryCode, setHeroCountryCode] = useState('US');

  const creationCost = useMemo(() => {
    let cost = 200; // Base
    
    // Talent weight
    const t = parseFloat(heroTalent);
    if (t === 3.5) cost += 150;
    if (t === 4.0) cost += 300;
    if (t === 4.5) cost += 600;
    if (t === 5.0) cost += 1200;

    // Age weight (Youth is premium)
    const a = parseInt(heroAge);
    if (a < 18) cost += 200;
    else if (a < 22) cost += 100;

    return cost;
  }, [heroTalent, heroAge]);

  if (!isLoaded) return <LoadingScreen />;

  const translations = {
    en: {
      title: "GLOBAL TRADING HUB",
      subtitle: "Secure Resource Acquisition Node",
      back: "Back to Menu",
      insufficient: "Insufficient resources",
      tabs: {
        diamonds: { label: "Buy Diamonds", desc: "Purchase premium operational currency", icon: Gem, color: "text-blue-400" },
        create_player: { label: "Create Player", desc: "Generate a custom high-tier elite hero", icon: UserPlus, color: "text-primary" },
        exchange: { label: "Exchange 💎 to €", desc: "Convert crystals to operational funds", icon: ArrowRightLeft, color: "text-yellow-400" },
        change_name: { label: "Change Name", desc: "Update your club's global callsign", icon: Edit3, color: "text-accent" },
        change_country: { label: "Change Country", desc: "Relocate your club's operational sector", icon: Flag, color: "text-orange-400" }
      },
      creator: {
        nickname: "Nickname",
        role: "Specialization",
        talent: "Potential Talent",
        age: "Biological Age",
        country: "Regional Flag",
        summary: "Custom Unit Specs",
        summaryDesc: "Unit will be deployed to Youth Academy.",
        placeholderNick: "Enter unit callsign..."
      },
      diamondPacks: [
        { label: "Scout Pack", amount: 250, price: "$4.99" },
        { label: "Elite Pack", amount: 1200, price: "$19.99" },
        { label: "General Pack", amount: 3500, price: "$49.99" }
      ],
      exchangeRate: "1 💎 = 10,000 €",
      confirm: "CONFIRM TRANSACTION",
      rebrandSuccess: "Rebranding synchronized",
      exchangeSuccess: "Assets converted successfully"
    },
    ru: {
      title: "ТОРГОВЫЙ УЗЕЛ",
      subtitle: "Безопасное получение ресурсов",
      back: "В меню терминала",
      insufficient: "Недостаточно ресурсов",
      tabs: {
        diamonds: { label: "Купить алмазы", desc: "Приобрести премиальную валюту", icon: Gem, color: "text-blue-400" },
        create_player: { label: "Создать игрока", desc: "Генерация элитного героя высокого уровня", icon: UserPlus, color: "text-primary" },
        exchange: { label: "Обмен Алмазы на €", desc: "Конвертация кристаллов в бюджет клуба", icon: ArrowRightLeft, color: "text-yellow-400" },
        change_name: { label: "Сменить название", desc: "Обновить позывной вашего клуба", icon: Edit3, color: "text-accent" },
        change_country: { label: "Сменить страну", desc: "Изменить регион базирования клуба", icon: Flag, color: "text-orange-400" }
      },
      creator: {
        nickname: "Никнейм героя",
        role: "Специализация",
        talent: "Уровень таланта",
        age: "Возраст",
        country: "Страна",
        summary: "Характеристики юнита",
        summaryDesc: "Игрок будет направлен в Академию.",
        placeholderNick: "Введите позывной юнита..."
      },
      diamondPacks: [
        { label: "Пакет Разведчика", amount: 250, price: "449 ₽" },
        { label: "Элитный Пакет", amount: 1200, price: "1790 ₽" },
        { label: "Пакет Генерала", amount: 3500, price: "4490 ₽" }
      ],
      exchangeRate: "1 💎 = 10,000 €",
      confirm: "ПОДТВЕРДИТЬ ТРАНЗАКЦИЮ",
      rebrandSuccess: "Данные синхронизированы",
      exchangeSuccess: "Обмен валюты завершен"
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleBuyDiamonds = (amount: number) => {
    addCrystals(amount);
    toast({ title: language === 'ru' ? "Алмазы зачислены!" : "Diamonds added!" });
  };

  const handleCreatePlayer = () => {
    if (crystals < creationCost) {
      toast({ title: t.insufficient, variant: "destructive" });
      return;
    }
    if (!heroNickname.trim()) {
      toast({ title: language === 'ru' ? "Введите никнейм" : "Enter nickname", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    
    try {
      const talentVal = parseFloat(heroTalent);
      const ageVal = parseInt(heroAge);
      const country = COUNTRIES.find(c => c.code === heroCountryCode) || COUNTRIES[0];

      const proStatAvg = Math.round(talentVal * 18);

      const newHero: Hero = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        name: heroNickname.trim(),
        role: heroRole,
        baseStats: {
          attack: 50, defense: 50, health: 1000, abilityPower: 50, speed: 320
        },
        overallRating: Math.round(proStatAvg * 0.8),
        abilitiesFocus: 'Balanced',
        image: `https://i.postimg.cc/PPS3QFFM/de-1.jpg`, 
        description: `Custom elite unit from ${country.name}.`,
        price: 0,
        baseAge: ageVal,
        hiredAt: new Date().toISOString(),
        age: ageVal,
        salary: Math.round(talentVal * 1500),
        form: 95,
        fatigue: 0,
        country: { code: country.code, name: country.name, flag: country.flag },
        isInjured: false,
        trainingFocus: null,
        dailyTrainingFocus: null,
        dailyTrainingFinishTime: null,
        onTransferUntil: null,
        transferMarketId: null,
        proStats: {
          lastHitting: proStatAvg, mapAwareness: proStatAvg, positioning: proStatAvg, reflexes: proStatAvg,
          manaManagement: proStatAvg, objectiveControl: proStatAvg, communication: proStatAvg,
          tiltResistance: proStatAvg, versatility: proStatAvg, ganking: proStatAvg,
        },
        proTalents: {
          lastHitting: talentVal, mapAwareness: talentVal, positioning: talentVal, reflexes: talentVal,
          manaManagement: talentVal, objectiveControl: talentVal, communication: talentVal,
          tiltResistance: talentVal, versatility: talentVal, ganking: talentVal,
        }
      };

      addCrystals(-creationCost);
      addYouthHeroDirectly(newHero);
      
      toast({ 
        title: language === 'ru' ? "Элитный юнит создан!" : "Elite Unit Created!",
        description: language === 'ru' ? `${newHero.name} направлен в Академию.` : `${newHero.name} deployed to Academy.`
      });
      setActiveTab('menu');
      setHeroNickname('');
    } catch (e) {
      console.error(e);
      toast({ title: "Creation failed", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExchange = (amount: number) => {
    if (crystals < amount) {
      toast({ title: t.insufficient, variant: "destructive" });
      return;
    }
    addCrystals(-amount);
    addCredits(amount * 10000);
    toast({ title: t.exchangeSuccess });
  };

  const handleChangeName = () => {
    if (crystals < 100) {
      toast({ title: t.insufficient, variant: "destructive" });
      return;
    }
    if (!newName.trim() || newName.length < 3) return;
    
    addCrystals(-100);
    updateProfileName(newName.trim());
    toast({ title: t.rebrandSuccess });
    setNewName('');
    setActiveTab('menu');
  };

  const handleChangeCountry = (countryName: string) => {
    if (crystals < 100) {
      toast({ title: t.insufficient, variant: "destructive" });
      return;
    }
    addCrystals(-100);
    updateProfileCountry(countryName);
    toast({ title: t.rebrandSuccess });
    setActiveTab('menu');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'diamonds':
        return (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {t.diamondPacks.map((pack, idx) => (
              <Card key={idx} className="glass-card border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-all cursor-pointer group" onClick={() => handleBuyDiamonds(pack.amount)}>
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/30 group-hover:scale-110 transition-transform">
                       <Gem className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase text-white">{pack.label}</h3>
                      <p className="text-lg font-headline font-bold text-blue-400">+{pack.amount} 💎</p>
                    </div>
                  </div>
                  <Button className="h-10 px-6 hero-gradient font-black text-[10px] uppercase shadow-lg shadow-blue-500/20">
                    {pack.price}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 'create_player':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Card className="glass-card border-primary/20 bg-primary/5 p-4 space-y-4">
               <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{t.creator.nickname}</label>
                 <div className="relative">
                   <Edit3 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
                   <Input 
                    value={heroNickname} 
                    onChange={e => setHeroNickname(e.target.value)} 
                    placeholder={t.creator.placeholderNick}
                    className="pl-10 h-11 bg-background/50 border-white/10"
                   />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{t.creator.role}</label>
                   <Select value={heroRole} onValueChange={(v) => setHeroRole(v as Role)}>
                     <SelectTrigger className="h-11 bg-background/50 border-white/10 text-xs font-bold uppercase">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="bg-card border-white/10">
                       <SelectItem value="Carry" className="text-xs uppercase font-bold">Carry</SelectItem>
                       <SelectItem value="Midlaner" className="text-xs uppercase font-bold">Midlaner</SelectItem>
                       <SelectItem value="Tank" className="text-xs uppercase font-bold">Tank</SelectItem>
                       <SelectItem value="Jungler" className="text-xs uppercase font-bold">Jungler</SelectItem>
                       <SelectItem value="Support" className="text-xs uppercase font-bold">Support</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{t.creator.talent}</label>
                   <Select value={heroTalent} onValueChange={setHeroTalent}>
                     <SelectTrigger className="h-11 bg-background/50 border-white/10 text-xs font-bold uppercase">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="bg-card border-white/10">
                       <SelectItem value="3.5" className="text-xs uppercase font-bold text-slate-400">Average (3.5★)</SelectItem>
                       <SelectItem value="4.0" className="text-xs uppercase font-bold text-primary">Elite (4.0★)</SelectItem>
                       <SelectItem value="4.5" className="text-xs uppercase font-bold text-accent">World Class (4.5★)</SelectItem>
                       <SelectItem value="5.0" className="text-xs uppercase font-bold text-yellow-500">Legendary (5.0★)</SelectItem>
                     </SelectContent>
                   </Select>
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{t.creator.age}</label>
                   <Select value={heroAge} onValueChange={setHeroAge}>
                     <SelectTrigger className="h-11 bg-background/50 border-white/10 text-xs font-bold uppercase">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="bg-card border-white/10">
                       {[14, 15, 16, 17, 18, 19, 20, 21, 22, 25, 28].map(age => (
                         <SelectItem key={age} value={age.toString()} className="text-xs uppercase font-bold">{age} {language === 'ru' ? 'лет' : 'years'}</SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">{t.creator.country}</label>
                   <Select value={heroCountryCode} onValueChange={setHeroCountryCode}>
                     <SelectTrigger className="h-11 bg-background/50 border-white/10 text-xs font-bold uppercase">
                       <SelectValue />
                     </SelectTrigger>
                     <SelectContent className="bg-card border-white/10 h-64">
                       {COUNTRIES.map(c => (
                         <SelectItem key={c.code} value={c.code} className="text-xs uppercase font-bold">
                           {c.flag} {c.name}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
               </div>

               <div className="pt-4 border-t border-white/5">
                 <div className="bg-background/50 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-primary tracking-widest">{t.creator.summary}</h4>
                      <p className="text-[8px] text-muted-foreground italic mt-0.5">{t.creator.summaryDesc}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-muted-foreground uppercase">Price</p>
                      <p className="text-xl font-headline font-bold text-primary flex items-center justify-end gap-1">
                        <Gem className="w-4 h-4" /> {creationCost}
                      </p>
                    </div>
                 </div>
                 <Button 
                   className="w-full h-14 hero-gradient font-black text-xs uppercase tracking-widest mt-4 shadow-xl active:scale-95 transition-all" 
                   onClick={handleCreatePlayer}
                   disabled={isProcessing || !heroNickname.trim()}
                 >
                   {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : t.confirm}
                 </Button>
               </div>
            </Card>
          </div>
        );

      case 'exchange':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
             <div className="grid grid-cols-1 gap-3">
               {[100, 500, 1000].map(amount => (
                 <Card key={amount} className="glass-card border-yellow-500/20 hover:bg-yellow-500/5 transition-all cursor-pointer" onClick={() => handleExchange(amount)}>
                   <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Gem className="w-5 h-5 text-blue-400" />
                        <span className="text-lg font-headline font-bold">{amount}</span>
                        <ArrowRightLeft className="w-4 h-4 text-muted-foreground mx-2" />
                        <Coins className="w-5 h-5 text-yellow-500" />
                        <span className="text-lg font-headline font-bold text-yellow-500">{(amount * 10000).toLocaleString()} €</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                   </CardContent>
                 </Card>
               ))}
             </div>
             <p className="text-[8px] text-center text-muted-foreground uppercase font-black tracking-widest">{t.exchangeRate}</p>
          </div>
        );

      case 'change_name':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Card className="glass-card border-accent/20 bg-accent/5 p-6">
              <h3 className="text-sm font-bold uppercase text-accent mb-4">New Operational Callsign</h3>
              <Input 
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={currentCountry || "Enter name..."}
                className="h-12 bg-background/50 border-white/10 text-white focus-visible:ring-accent"
                maxLength={20}
              />
              <div className="mt-6 flex items-center justify-between p-3 bg-background/50 rounded-lg border border-white/5">
                <span className="text-[10px] font-black uppercase text-muted-foreground">Fee</span>
                <span className="text-sm font-bold text-accent">100 💎</span>
              </div>
              <Button 
                className="w-full h-12 hero-gradient font-black text-[10px] uppercase mt-4" 
                onClick={handleChangeName}
                disabled={newName.length < 3}
              >
                {t.confirm}
              </Button>
            </Card>
          </div>
        );

      case 'change_country':
        return (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <p className="text-[8px] text-center text-muted-foreground uppercase font-black tracking-widest mb-4">Relocation Fee: 100 💎</p>
            <div className="grid grid-cols-2 gap-2">
              {COUNTRIES.map((country) => (
                <Card 
                  key={country.code} 
                  className={cn(
                    "glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer",
                    currentCountry === country.name && "border-primary/40 bg-primary/5"
                  )}
                  onClick={() => handleChangeCountry(country.name)}
                >
                  <CardContent className="p-4 flex flex-col items-center gap-2">
                    <span className="text-3xl">{country.flag}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-center">{country.name}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );

      default: return null;
    }
  };

  if (activeTab === 'menu') {
    return (
      <div className="max-w-md mx-auto px-4 pt-8 pb-32">
        <header className="mb-8 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter flex items-center gap-2 text-primary">
              <ShoppingCart className="w-6 h-6" />
              {language === 'ru' ? 'МАГАЗИН' : 'TRADING HUB'}
            </h1>
            <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.subtitle}</p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 mb-8">
           <Card className="glass-card bg-blue-500/5 border-blue-500/20">
             <CardContent className="p-4 text-center">
                <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Crystals</p>
                <div className="flex items-center justify-center gap-2">
                  <Gem className="w-4 h-4 text-blue-400" />
                  <p className="text-xl font-headline font-black italic text-blue-400">{crystals || 0}</p>
                </div>
             </CardContent>
           </Card>
           <Card className="glass-card bg-yellow-500/5 border-yellow-500/20">
             <CardContent className="p-4 text-center">
                <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Credits</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-yellow-500 font-black">€</span>
                  <p className="text-xl font-headline font-black italic text-yellow-500">{formatCurrency(credits)}</p>
                </div>
             </CardContent>
           </Card>
        </div>

        <div className="space-y-2">
          {(Object.entries(t.tabs) as [ShopTab, any][]).map(([id, data]) => (
            <Card 
              key={id}
              className="glass-card border-white/5 hover:bg-white/5 transition-all cursor-pointer overflow-hidden group"
              onClick={() => setActiveTab(id)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("p-2.5 rounded-xl bg-secondary/50", data.color)}>
                    <data.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase group-hover:text-white transition-colors">{data.label}</h3>
                    <p className="text-[10px] text-muted-foreground leading-tight">{data.desc}</p>
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
            {t.tabs[activeTab as keyof typeof t.tabs].label}
          </h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest">{t.back}</p>
        </div>
      </header>
      {renderContent()}
    </div>
  );
}