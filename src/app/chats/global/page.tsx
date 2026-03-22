'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { useGameState } from '@/app/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, Send, Loader2, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { collection, query, orderBy, limit, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { LoadingScreen } from '@/components/game/LoadingScreen';
import { cn } from '@/lib/utils';

export default function GlobalChatPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { language, isLoaded } = useGameState();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const userRef = useMemoFirebase(() => user ? doc(db, 'players_v2', user.uid) : null, [db, user]);
  const { data: profile } = useDoc(userRef);

  const chatQuery = useMemoFirebase(() => {
    return query(
      collection(db, 'global_chat'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }, [db]);

  const { data: messages, isLoading: isChatLoading } = useCollection(chatQuery);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !user || !profile || isSending) return;

    setIsSending(true);
    try {
      await addDoc(collection(db, 'global_chat'), {
        userId: user.uid,
        userName: profile.displayName || "Manager",
        text: message.trim(),
        createdAt: serverTimestamp()
      });
      setMessage('');
    } catch (e) {
      console.error("Failed to send message", e);
    } finally {
      setIsSending(false);
    }
  };

  if (isUserLoading || !isLoaded || !user) {
    return <LoadingScreen />;
  }

  const translations = {
    en: {
      title: "GLOBAL CHAT",
      subtitle: "Unencrypted Public Frequency",
      placeholder: "Type message...",
      send: "SEND",
      connecting: "Establishing connection...",
    },
    ru: {
      title: "ОБЩИЙ ЧАТ",
      subtitle: "Незашифрованная открытая частота",
      placeholder: "Введите сообщение...",
      send: "ОТПР",
      connecting: "Установка связи...",
    }
  };

  const t = translations[language as keyof typeof translations] || translations.ru;

  const sortedMessages = messages ? [...messages].sort((a, b) => {
    const timeA = a.createdAt?.toMillis?.() || 0;
    const timeB = b.createdAt?.toMillis?.() || 0;
    return timeA - timeB;
  }) : [];

  return (
    <div className="max-w-md mx-auto h-[calc(100dvh-3.5rem-4rem)] flex flex-col overflow-hidden relative">
      <header className="px-4 py-3 flex items-center gap-4 border-b border-white/5 bg-background/50 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0">
        <Link href="/chats">
          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-headline font-bold uppercase tracking-tighter leading-none">{t.title}</h1>
          <p className="text-muted-foreground text-[8px] uppercase tracking-widest mt-1">{t.subtitle}</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 space-y-4 scrollbar-hide pt-4 pb-20" ref={scrollRef}>
        {isChatLoading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-[10px] uppercase font-bold tracking-widest">{t.connecting}</p>
          </div>
        ) : sortedMessages.length > 0 ? (
          sortedMessages.map((msg) => {
            const isMe = msg.userId === user.uid;
            return (
              <div key={msg.id} className={cn(
                "flex flex-col max-w-[85%]",
                isMe ? "ml-auto items-end" : "mr-auto items-start"
              )}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  {!isMe && <span className="text-[10px] font-black text-primary uppercase">{msg.userName}</span>}
                  <span className="text-[8px] text-muted-foreground font-mono">
                    {msg.createdAt ? new Date(msg.createdAt.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </span>
                  {isMe && <span className="text-[10px] font-black text-accent uppercase">YOU</span>}
                </div>
                <div className={cn(
                  "px-4 py-2 rounded-2xl text-sm leading-relaxed border shadow-sm",
                  isMe 
                    ? "bg-primary/10 border-primary/20 rounded-tr-none text-right" 
                    : "bg-secondary/50 border-white/5 rounded-tl-none text-left"
                )}>
                  {msg.text}
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-20 text-center px-10 py-20">
            <MessageSquare className="w-12 h-12 mb-4 mx-auto" />
            <p className="text-xs uppercase font-bold tracking-widest">No transmissions detected on this frequency.</p>
          </div>
        )}
      </div>

      {/* Fixed Input Bar right above BottomNav */}
      <div className="fixed bottom-16 left-0 right-0 z-30 flex justify-center px-0 pointer-events-none">
        <div className="w-full max-w-md pointer-events-auto bg-background/95 backdrop-blur-xl border-t border-white/10 p-2 pb-1.5 shadow-[0_-10px_20px_rgba(0,0,0,0.4)]">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.placeholder}
              className="bg-secondary/50 border-white/10 h-11 text-sm focus-visible:ring-primary rounded-xl"
              autoComplete="off"
            />
            <Button 
              type="submit" 
              disabled={!message.trim() || isSending}
              className="h-11 w-11 rounded-xl hero-gradient p-0 flex items-center justify-center shrink-0 shadow-lg shadow-primary/20"
            >
              {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
