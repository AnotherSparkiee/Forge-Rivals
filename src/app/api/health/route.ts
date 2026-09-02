import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { getDoc, doc } from 'firebase/firestore';

/**
 * @fileOverview Эндпоинт проверки здоровья системы.
 */

export async function GET() {
  try {
    const { firestore: db } = initializeFirebase();
    // Простейшая проверка связи с БД
    await getDoc(doc(db, 'system_v1', 'global_stats'));
    
    return NextResponse.json({ 
      status: 'UP', 
      services: { firestore: 'connected' },
      timestamp: new Date().toISOString() 
    });
  } catch (error: any) {
    return NextResponse.json({ 
      status: 'DOWN', 
      error: error.message,
      timestamp: new Date().toISOString() 
    }, { status: 503 });
  }
}
