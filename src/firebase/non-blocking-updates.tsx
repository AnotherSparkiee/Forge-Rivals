
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
 * Initiates a setDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options?: SetOptions) {
  const op = options ? setDoc(docRef, data, options) : setDoc(docRef, data);
  op.catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'write',
        requestResourceData: data,
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
  const promise = setDoc(newDocRef, { ...data, id: newDocRef.id })
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: colRef.path,
          operation: 'create',
          requestResourceData: data,
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
  setDoc(docRef, data, { merge: true })
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: data,
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
