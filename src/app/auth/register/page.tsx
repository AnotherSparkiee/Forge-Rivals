'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, useFirestore } from '@/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create UserProfile in Firestore
      const userProfileRef = doc(db, 'users', user.uid);
      const profileData = {
        id: user.uid,
        displayName: username,
        inGameCurrency: 500,
        experiencePoints: 0,
        lastLoginDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        ownedHeroIds: ['h1', 'h2', 'h3', 'h4', 'h5'],
        leagueRankingId: 'none'
      };

      await setDoc(userProfileRef, profileData);

      toast({
        title: "Profile Initialized",
        description: "Welcome to the league, Commander. Now, choose your operational sector.",
      });
      router.push('/setup');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="font-headline text-center uppercase tracking-widest text-accent">Initiate Profile</CardTitle>
      </CardHeader>
      <form onSubmit={handleRegister}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Tactical Callsign</Label>
            <Input 
              id="username" 
              placeholder="CommanderX" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
              className="bg-secondary/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Neural Link (Email)</Label>
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
            <Label htmlFor="password">Access Key (Password)</Label>
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
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'CREATE PROFILE'}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Already registered? <Link href="/auth/login" className="text-primary hover:underline">Synchronize Link</Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
