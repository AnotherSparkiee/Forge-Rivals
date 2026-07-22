
'use client';

import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Search, Zap, Shield, Sparkles, Sword, Info, User } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { PlaceHolderImages } from '@/app/lib/placeholder-images';

type Attribute = 'Strength' | 'Agility' | 'Intelligence';

interface HeroBase {
  name: string;
  attr: Attribute;
  type: 'Melee' | 'Ranged';
  role: string;
}

const HEROES_LIST: HeroBase[] = [
  // Strength
  { name: "Abaddon", attr: "Strength", type: "Melee", role: "Support/Tank" },
  { name: "Alchemist", attr: "Strength", type: "Melee", role: "Carry" },
  { name: "Axe", attr: "Strength", type: "Melee", role: "Tank" },
  { name: "Beastmaster", attr: "Strength", type: "Melee", role: "Utility" },
  { name: "Brewmaster", attr: "Strength", type: "Melee", role: "Utility" },
  { name: "Bristleback", attr: "Strength", type: "Melee", role: "Tank" },
  { name: "Centaur Warrunner", attr: "Strength", type: "Melee", role: "Tank" },
  { name: "Chaos Knight", attr: "Strength", type: "Melee", role: "Carry" },
  { name: "Clockwerk", attr: "Strength", type: "Melee", role: "Utility" },
  { name: "Dawnbreaker", attr: "Strength", type: "Melee", role: "Carry/Tank" },
  { name: "Doom", attr: "Strength", type: "Melee", role: "Utility" },
  { name: "Dragon Knight", attr: "Strength", type: "Melee", role: "Carry/Tank" },
  { name: "Earth Spirit", attr: "Strength", type: "Melee", role: "Support" },
  { name: "Earthshaker", attr: "Strength", type: "Melee", role: "Support" },
  { name: "Elder Titan", attr: "Strength", type: "Melee", role: "Support" },
  { name: "Huskar", attr: "Strength", type: "Ranged", role: "Carry" },
  { name: "Io", attr: "Strength", type: "Ranged", role: "Support" },
  { name: "Kunkka", attr: "Strength", type: "Melee", role: "Utility" },
  { name: "Legion Commander", attr: "Strength", type: "Melee", role: "Carry" },
  { name: "Lifestealer", attr: "Strength", type: "Melee", role: "Carry" },
  { name: "Lycan", attr: "Strength", type: "Melee", role: "Carry" },
  { name: "Magnus", attr: "Strength", type: "Melee", role: "Utility" },
  { name: "Marci", attr: "Strength", type: "Melee", role: "Support/Carry" },
  { name: "Mars", attr: "Strength", type: "Melee", role: "Tank" },
  { name: "Night Stalker", attr: "Strength", type: "Melee", role: "Utility" },
  { name: "Omniknight", attr: "Strength", type: "Melee", role: "Support" },
  { name: "Phoenix", attr: "Strength", type: "Ranged", role: "Support" },
  { name: "Primal Beast", attr: "Strength", type: "Melee", role: "Tank" },
  { name: "Pudge", attr: "Strength", type: "Melee", role: "Utility" },
  { name: "Sand King", attr: "Strength", type: "Melee", role: "Utility" },
  { name: "Slardar", attr: "Strength", type: "Melee", role: "Utility" },
  { name: "Snapfire", attr: "Strength", type: "Ranged", role: "Support" },
  { name: "Spirit Breaker", attr: "Strength", type: "Melee", role: "Utility" },
  { name: "Sven", attr: "Strength", type: "Melee", role: "Carry" },
  { name: "Tidehunter", attr: "Strength", type: "Melee", role: "Tank" },
  { name: "Timbersaw", attr: "Strength", type: "Melee", role: "Tank" },
  { name: "Tiny", attr: "Strength", type: "Melee", role: "Carry/Utility" },
  { name: "Treant Protector", attr: "Strength", type: "Melee", role: "Support" },
  { name: "Tusk", attr: "Strength", type: "Melee", role: "Support" },
  { name: "Underlord", attr: "Strength", type: "Melee", role: "Tank" },
  { name: "Undying", attr: "Strength", type: "Melee", role: "Support" },
  { name: "Wraith King", attr: "Strength", type: "Melee", role: "Carry" },
  // Agility
  { name: "Anti-Mage", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Arc Warden", attr: "Agility", type: "Ranged", role: "Carry" },
  { name: "Bloodseeker", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Bounty Hunter", attr: "Agility", type: "Melee", role: "Support" },
  { name: "Broodmother", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Clinkz", attr: "Agility", type: "Ranged", role: "Carry" },
  { name: "Drow Ranger", attr: "Agility", type: "Ranged", role: "Carry" },
  { name: "Ember Spirit", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Faceless Void", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Gyrocopter", attr: "Agility", type: "Ranged", role: "Carry" },
  { name: "Hoodwink", attr: "Agility", type: "Ranged", role: "Support" },
  { name: "Juggernaut", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Lone Druid", attr: "Agility", type: "Ranged", role: "Carry" },
  { name: "Luna", attr: "Agility", type: "Ranged", role: "Carry" },
  { name: "Medusa", attr: "Agility", type: "Ranged", role: "Carry" },
  { name: "Meepo", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Mirana", attr: "Agility", type: "Ranged", role: "Support" },
  { name: "Monkey King", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Morphling", attr: "Agility", type: "Ranged", role: "Carry" },
  { name: "Naga Siren", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Nyx Assassin", attr: "Agility", type: "Melee", role: "Support" },
  { name: "Pangolier", attr: "Agility", type: "Melee", role: "Utility" },
  { name: "Phantom Assassin", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Phantom Lancer", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Razor", attr: "Agility", type: "Ranged", role: "Carry" },
  { name: "Riki", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Shadow Fiend", attr: "Agility", type: "Ranged", role: "Carry" },
  { name: "Slark", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Sniper", attr: "Agility", type: "Ranged", role: "Carry" },
  { name: "Spectre", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Templar Assassin", attr: "Agility", type: "Ranged", role: "Carry" },
  { name: "Terrorblade", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Troll Warlord", attr: "Agility", type: "Ranged", role: "Carry" },
  { name: "Ursa", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Vengeful Spirit", attr: "Agility", type: "Ranged", role: "Support" },
  { name: "Venomancer", attr: "Agility", type: "Ranged", role: "Support" },
  { name: "Viper", attr: "Agility", type: "Ranged", role: "Carry" },
  { name: "Weaver", attr: "Agility", type: "Ranged", role: "Carry" },
  // Intelligence
  { name: "Ancient Apparition", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Bane", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Batrider", attr: "Intelligence", type: "Ranged", role: "Utility" },
  { name: "Chen", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Crystal Maiden", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Dark Seer", attr: "Intelligence", type: "Melee", role: "Utility" },
  { name: "Dark Willow", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Dazzle", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Death Prophet", attr: "Intelligence", type: "Ranged", role: "Carry" },
  { name: "Disruptor", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Enchantress", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Enigma", attr: "Intelligence", type: "Ranged", role: "Utility" },
  { name: "Grimstroke", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Invoker", attr: "Intelligence", type: "Ranged", role: "Carry/Utility" },
  { name: "Jakiro", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Keeper of the Light", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Leshrac", attr: "Intelligence", type: "Ranged", role: "Carry" },
  { name: "Lich", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Lina", attr: "Intelligence", type: "Ranged", role: "Carry" },
  { name: "Lion", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Nature's Prophet", attr: "Intelligence", type: "Ranged", role: "Carry" },
  { name: "Necrophos", attr: "Intelligence", type: "Ranged", role: "Carry" },
  { name: "Oracle", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Outworld Destroyer", attr: "Intelligence", type: "Ranged", role: "Carry" },
  { name: "Puck", attr: "Intelligence", type: "Ranged", role: "Carry" },
  { name: "Pugna", attr: "Intelligence", type: "Ranged", role: "Utility" },
  { name: "Queen of Pain", attr: "Intelligence", type: "Ranged", role: "Carry" },
  { name: "Rubick", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Shadow Demon", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Shadow Shaman", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Silencer", attr: "Intelligence", type: "Ranged", role: "Support/Carry" },
  { name: "Skywrath Mage", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Storm Spirit", attr: "Intelligence", type: "Ranged", role: "Carry" },
  { name: "Techies", attr: "Intelligence", type: "Ranged", role: "Utility" },
  { name: "Tinker", attr: "Intelligence", type: "Ranged", role: "Carry" },
  { name: "Visage", attr: "Intelligence", type: "Ranged", role: "Utility" },
  { name: "Void Spirit", attr: "Intelligence", type: "Melee", role: "Carry" },
  { name: "Warlock", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Windranger", attr: "Intelligence", type: "Ranged", role: "Carry" },
  { name: "Witch Doctor", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Zeus", attr: "Intelligence", type: "Ranged", role: "Carry" },
  // Universal / More Fillers to reach ~128
  { name: "Muerta", attr: "Intelligence", type: "Ranged", role: "Carry" },
  { name: "Abyssal Horror", attr: "Strength", type: "Melee", role: "Tank" },
  { name: "Void Wanderer", attr: "Intelligence", type: "Ranged", role: "Utility" },
  { name: "Crimson Guard", attr: "Strength", type: "Melee", role: "Tank" },
  { name: "Cyber Wraith", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Solar Saint", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Lunar Assassin", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Frost Golem", attr: "Strength", type: "Melee", role: "Tank" },
  { name: "Mystic Weaver", attr: "Intelligence", type: "Ranged", role: "Utility" },
  { name: "Rogue Unit", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Iron Titan", attr: "Strength", type: "Melee", role: "Tank" },
  { name: "Phantom Seraph", attr: "Intelligence", type: "Ranged", role: "Support" },
  { name: "Blade Master", attr: "Agility", type: "Melee", role: "Carry" },
  { name: "Storm Raven", attr: "Intelligence", type: "Ranged", role: "Utility" },
  { name: "Grave Warden", attr: "Strength", type: "Melee", role: "Support" }
];

export default function HeroesKnowledgePage() {
  const { language } = useGameState();
  const [search, setSearch] = useState('');

  const filteredHeroes = useMemo(() => {
    if (!search) return HEROES_LIST;
    return HEROES_LIST.filter(h => h.name.toLowerCase().includes(search.toLowerCase()));
  }, [search]);

  const t = {
    ru: {
      title: "РЕЕСТР ГЕРОЕВ",
      subtitle: "Список из 128 легендарных юнитов",
      searchPlaceholder: "Поиск героя...",
      attr: { Strength: "Сила", Agility: "Ловкость", Intelligence: "Интеллект" },
      type: { Melee: "Ближний", Ranged: "Дальний" }
    },
    en: {
      title: "HERO REGISTRY",
      subtitle: "List of 128 legendary units",
      searchPlaceholder: "Find a hero...",
      attr: { Strength: "Strength", Agility: "Agility", Intelligence: "Intelligence" },
      type: { Melee: "Melee", Ranged: "Ranged" }
    }
  }[language === 'ru' ? 'ru' : 'en'];

  const getAttrColor = (attr: Attribute) => {
    switch (attr) {
      case 'Strength': return 'text-red-400';
      case 'Agility': return 'text-green-400';
      case 'Intelligence': return 'text-blue-400';
      default: return 'text-white';
    }
  };

  const getAttrIcon = (attr: Attribute) => {
    switch (attr) {
      case 'Strength': return <Shield className="w-3 h-3" />;
      case 'Agility': return <Zap className="w-3 h-3" />;
      case 'Intelligence': return <Sparkles className="w-3 h-3" />;
    }
  };

  const getHeroIconUrl = (attr: Attribute) => {
    const key = attr === 'Strength' ? 'hero-str' : (attr === 'Agility' ? 'hero-agi' : 'hero-int');
    return PlaceHolderImages.find(img => img.id === key)?.imageUrl || "";
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-8 pb-32">
      <header className="mb-8 flex items-center gap-4">
        <Link href="/system">
          <Button variant="ghost" size="icon" className="rounded-full bg-secondary/50 border border-white/5">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-headline font-bold uppercase tracking-tighter text-white leading-none">{t.title}</h1>
          <p className="text-muted-foreground text-[10px] uppercase tracking-widest font-black opacity-50 mt-1">{t.subtitle}</p>
        </div>
      </header>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="pl-10 bg-secondary/30 border-white/10 h-12 rounded-xl text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {filteredHeroes.map((hero, i) => (
          <Card key={i} className="glass-card border-white/5 bg-secondary/10 overflow-hidden group hover:border-primary/30 transition-all">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-background shrink-0 shadow-lg">
                   <img 
                    src={getHeroIconUrl(hero.attr)} 
                    alt={hero.name} 
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" 
                    data-ai-hint="hero portrait"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-bold uppercase text-white truncate leading-none">{hero.name}</h3>
                    <div className={cn("shrink-0", getAttrColor(hero.attr))}>
                      {getAttrIcon(hero.attr)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[6px] px-1 border-white/10 opacity-50 h-3 leading-none">{t.type[hero.type]}</Badge>
                    <Badge variant="secondary" className="text-[6px] px-1 bg-primary/10 text-primary border-none h-3 leading-none truncate max-w-[50px]">{hero.role}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

