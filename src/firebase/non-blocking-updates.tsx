'use client';
    
import {
  setDoc,
  doc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import {FirestorePermissionError} from '@/firebase/errors';

/**
 * Sanitizes data by replacing undefined values with null to prevent Firestore crashes.
 */
function sanitizeData(data: any): any {
  if (data === null || typeof data !== 'object') return data;
  const sanitized = Array.isArray(data) ? [] : {} as any;
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const val = data[key];
      if (val === undefined) sanitized[key] = null;
      else if (typeof val === 'object') sanitized[key] = sanitizeData(val);
      else sanitized[key] = val;
    }
  }
  return sanitized;
}

/**
 * Initiates a setDoc operation for a document reference.
 * Does NOT await the write operation internally.
 * Includes data sanitization to prevent "undefined" field errors.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options?: SetOptions) {
  const cleanData = sanitizeData(data);
  const op = options ? setDoc(docRef, cleanData, options) : setDoc(docRef, cleanData);
  op.catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'write',
        requestResourceData: cleanData,
      })
    )
  })
}


/**
 * Initiates an add operation by generating a document ID and using setDoc.
 * This is more robust in some environments than addDoc.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  const newDocRef = doc(colRef);
  const cleanData = sanitizeData(data);
  const promise = setDoc(newDocRef, { ...cleanData, id: newDocRef.id })
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: colRef.path,
          operation: 'create',
          requestResourceData: cleanData,
        })
      )
    });
  return promise;
}


/**
 * Initiates an update operation for a document reference.
 * Uses setDoc with { merge: true } for better resilience against "Missing Permissions" errors.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  const cleanData = sanitizeData(data);
  setDoc(docRef, cleanData, { merge: true })
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: cleanData,
        })
      )
    });
}


/**
 * Initiates a deleteDoc operation for a document reference.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  deleteDoc(docRef)
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        })
      )
    });
}
