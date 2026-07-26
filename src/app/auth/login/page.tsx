'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight, ShieldCheck, LogOut } from 'lucide-react';
import { useGameState } from '@/app/lib/store';
import { cn } from '@/lib/utils';
import { LoadingScreen } from '@/components/game/LoadingScreen';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();
  const { language, isLoaded: storeIsLoaded, id, resetProfile } = useGameState();

  const translations = {
    en: {
      title: "Local Access",
      navLogin: "Login",
      navRegister: "Register",
      emailLabel: "Username or Email",
      passLabel: "Access Key",
      submitBtn: "ESTABLISH LINK",
      welcomeBack: "Local Session Active",
      enterHub: "ENTER COMMAND CENTER",
      signOut: "CLEAR LOCAL CACHE"
    },
    ru: {
      title: "Локальный доступ",
      navLogin: "Вход",
      navRegister: "Регистрация",
      emailLabel: "Почта или Имя",
      passLabel: "Ключ доступа",
      submitBtn: "УСТАНОВИТЬ СВЯЗЬ",
      welcomeBack: "Локальная сессия активна",
      enterHub: "ВОЙТИ В КОМАНДНЫЙ ЦЕНТР",
      signOut: "ОЧИСТИТЬ КЭШ"
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleEnter = () => {
    router.push('/');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // SIMULATED LOGIN
      // Since it's local, we just pretend it worked if fields are filled
      if (identifier && password.length >= 6) {
        handleEnter();
      } else {
        throw new Error("Invalid credentials format");
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Denied", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (!storeIsLoaded) return <LoadingScreen />;

  // If already "logged in" locally
  if (id && id !== 'local-manager') {
    return (
      <div className="space-y-4 animate-in fade-in zoom-in duration-500">
        <Card className="glass-card border-primary/20 bg-primary/5">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border-2 border-primary shadow-[0_0_20px_rgba(var(--primary),0.3)]">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="font-headline uppercase tracking-widest text-white text-lg">{t.welcomeBack}</CardTitle>
            <p className="text-[10px] text-muted-foreground uppercase font-bold mt-2">LOCAL_NODE_ID: {id.slice(0, 12)}...</p>
          </CardHeader>
          <CardFooter>
            <Button onClick={handleEnter} className="w-full h-14 hero-gradient font-black text-xs tracking-widest">
              {t.enterHub} <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </CardFooter>
        </Card>
        <p className="text-center">
          <button onClick={() => resetProfile()} className="text-[10px] font-black text-red-400 uppercase tracking-widest hover:underline flex items-center justify-center gap-2 mx-auto">
            <LogOut className="w-3.5 h-3.5" /> {t.signOut}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2 mb-4 bg-secondary/20 p-1 rounded-lg border border-white/5">
        <Button variant="ghost" size="sm" className={cn("flex-1 text-xs font-bold h-8 uppercase tracking-widest", "bg-white/10 text-primary")} onClick={() => router.push('/auth/login')}>
          {t.navLogin}
        </Button>
        <Button variant="ghost" size="sm" className={cn("flex-1 text-xs font-bold h-8 uppercase tracking-widest text-muted-foreground")} onClick={() => router.push('/auth/register')}>
          {t.navRegister}
        </Button>
      </div>

      <Card className="glass-card">
        <form onSubmit={handleLogin}>
          <CardHeader>
            <CardTitle className="font-headline text-center uppercase tracking-widest text-accent text-lg">{t.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">{t.emailLabel}</Label>
              <Input id="identifier" placeholder="Name or Email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required className="bg-secondary/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.passLabel}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-secondary/50" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full hero-gradient font-bold" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t.submitBtn}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              New manager? <Link href="/auth/register" className="text-primary hover:underline">Initialize local node</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}