'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, ArrowRight } from 'lucide-react';
import { useGameState } from '@/app/lib/store';
import { useAuth, useUser, initiateEmailSignUp } from '@/firebase';
import { LoadingScreen } from '@/components/game/LoadingScreen';

const EMAIL_DOMAIN = 'players.mobamanageronline.app';

function slugify(teamName: string) {
  return teamName.trim().toLowerCase().replace(/\s+/g, '');
}

export default function RegisterPage() {
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();
  const { language, isLoaded } = useGameState();
  const { user } = useUser();
  const auth = useAuth();

  const t = {
    en: {
      title: "Initialize Profile", 
      subtitle: "Establish command link via team name and key", 
      callsign: "Team Name", 
      passLabel: "Access Key (min 6 symbols)",
      submitBtn: "INITIALIZE PROFILE", 
      alreadyRegistered: "Already registered?", 
      loginLink: "Login",
      errorShort: "Team name too short",
      errorPass: "Password too simple",
      errorExists: "This team name is already taken",
      success: "Auth sequence initiated"
    },
    ru: {
      title: "Инициация профиля", 
      subtitle: "Установите связь через название команды и пароль", 
      callsign: "Название команды", 
      passLabel: "Ключ доступа (от 6 символов)",
      submitBtn: "СОЗДАТЬ ПРОФИЛЬ", 
      alreadyRegistered: "Уже зарегистрированы?", 
      loginLink: "Войти",
      errorShort: "Название команды слишком короткое",
      errorPass: "Пароль слишком простой",
      errorExists: "Команда с таким названием уже существует",
      success: "Протокол авторизации запущен"
    }
  }[language as 'en' | 'ru'] || { title: "Register", subtitle: "Join", callsign: "Team", passLabel: "Pass", submitBtn: "Join", alreadyRegistered: "Have account?", loginLink: "Login" };

  // If user appears (sign up success), redirect to setup
  useEffect(() => {
    if (user) {
      router.push('/setup');
    }
  }, [user, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      toast({ variant: "destructive", title: t.errorShort });
      return;
    }
    if (password.length < 6) {
      toast({ variant: "destructive", title: t.errorPass });
      return;
    }

    setIsProcessing(true);
    try {
      const slug = slugify(trimmedUsername);
      const technicalEmail = `${slug}@${EMAIL_DOMAIN}`;
      
      // We initiate sign up. The FirebaseProvider will pick up the user state.
      initiateEmailSignUp(auth, technicalEmail, password);
      
      toast({ title: t.success });
      // Redirect happens in useEffect
    } catch (error: any) {
      setIsProcessing(false);
      toast({ 
        variant: "destructive", 
        title: "Registration Failed", 
        description: error.message === 'auth/email-already-exists' ? t.errorExists : error.message 
      });
    }
  };

  if (!isLoaded) return <LoadingScreen />;

  return (
    <Card className="glass-card w-full max-w-sm">
      <CardHeader>
        <CardTitle className="font-headline text-center uppercase tracking-widest text-accent text-lg">{t.title}</CardTitle>
        <p className="text-[10px] text-center text-muted-foreground uppercase font-bold px-4 leading-relaxed">{t.subtitle}</p>
      </CardHeader>
      <form onSubmit={handleRegister}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t.callsign}</Label>
            <Input 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
              className="bg-secondary/50" 
              placeholder="MyTeamName"
            />
          </div>
          <div className="space-y-2">
            <Label>{t.passLabel}</Label>
            <Input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              className="bg-secondary/50" 
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full hero-gradient font-bold h-12" disabled={isProcessing}>
            {isProcessing ? <Loader2 className="animate-spin" /> : <><UserPlus className="w-4 h-4 mr-2" /> {t.submitBtn}</>}
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-2">
            {t.alreadyRegistered} <Link href="/auth/login" className="text-primary hover:underline">{t.loginLink}</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
