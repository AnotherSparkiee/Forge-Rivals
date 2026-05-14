'use client';

/**
 * A safe, passive error class that does NOT call Firebase SDK methods in its constructor.
 * This prevents "INTERNAL ASSERTION FAILED" errors caused by accessing getAuth() 
 * inside Firestore snapshot handlers.
 */
export class FirestorePermissionError extends Error {
  public readonly context: any;

  constructor(context: { path: string; operation: string; data?: any }) {
    const message = `Access Denied: ${context.operation} operation failed on path [${context.path}]. Check security rules and authentication state.`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
  }
}
