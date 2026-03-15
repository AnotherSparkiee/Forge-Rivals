'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useMemoFirebase } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Languages, Check } from 'lucide-react';
import { useGameState } from '@/app/lib/store';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { language, setLanguage, isLoaded } = useGameState();

  const translations = {
    en: {
      title: "Sync Credentials",
      emailLabel: "Neural Link (Email)",
      passLabel: "Access Key (Password)",
      submitBtn: "ESTABLISH LINK",
      newManager: "New manager?",
      registerLink: "Initialize new profile",
      successTitle: "Access Granted",
      successDesc: "Welcome back to the Command Center.",
      errorTitle: "Access Denied"
    },
    ru: {
      title: "Синхронизация данных",
      emailLabel: "Нейролинк (Email)",
      passLabel: "Ключ доступа (Пароль)",
      submitBtn: "УСТАНОВИТЬ СВЯЗЬ",
      newManager: "Новый менеджер?",
      registerLink: "Создать новый профиль",
      successTitle: "Доступ разрешен",
      successDesc: "Добро пожаловать в Командный Центр.",
      errorTitle: "Доступ запрещен"
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: t.successTitle,
        description: t.successDesc,
      });
      router.push('/');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t.errorTitle,
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoaded) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-2 mb-4 bg-secondary/20 p-1 rounded-lg border border-white/5">
        <Button 
          variant="ghost" 
          size="sm"
          className={cn("flex-1 text-[10px] gap-1 h-7", language === 'en' && "bg-white/10 text-primary")}
          onClick={() => setLanguage('en')}
        >
          EN {language === 'en' && <Check className="w-3 h-3" />}
        </Button>
        <Button 
          variant="ghost" 
          size="sm"
          className={cn("flex-1 text-[10px] gap-1 h-7", language === 'ru' && "bg-white/10 text-primary")}
          onClick={() => setLanguage('ru')}
        >
          RU {language === 'ru' && <Check className="w-3 h-3" />}
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="font-headline text-center uppercase tracking-widest text-accent text-lg">{t.title}</CardTitle>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t.emailLabel}</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="name@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t.passLabel}</Label>
              <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="bg-secondary/50"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full hero-gradient font-bold" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : t.submitBtn}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              {t.newManager} <Link href="/auth/register" className="text-primary hover:underline">{t.registerLink}</Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
