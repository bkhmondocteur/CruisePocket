import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { Candidate, Doctor, ServiceCompany, Role } from '../types';
import { documentStorage, DocumentChunkMessage, setCloudBridgeSender } from './documentStorage';

// Configuration Firebase pour CruisePocket (Projet application-eft)
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC3hnxxG_9XUWJFITH8pPL_XpSPhEBdcRc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "application-eft.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "application-eft",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "application-eft.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "546654014540",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:546654014540:web:3665b2e8b686bcc5eaf8e9"
};

// Initialisation idempotente de l'application Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialisation de Firestore
export const db = getFirestore(app);

// Indicateur d'état de connexion Firestore
let isFirestoreAvailable = true;

/**
 * Service de Synchronisation Firebase Temps Réel
 */
export const firebaseSyncService = {
  // ============================================================================
  // 1. CANDIDATS (Acheminement Dossiers Société -> Médecin)
  // ============================================================================

  /**
   * Enregistrer ou mettre à jour un dossier candidat sur Firestore
   */
  async saveCandidate(candidate: Candidate): Promise<void> {
    try {
      // Les données lourdes (base64) ne doivent jamais résider directement dans le document candidat
      const lightweight = { ...candidate };
      delete lightweight.passport_file_url;

      const docRef = doc(db, 'candidates', candidate.id);
      await setDoc(docRef, lightweight, { merge: true });
      isFirestoreAvailable = true;
    } catch (error) {
      console.warn('[Firebase] Impossible d\'enregistrer le candidat sur Firestore (mode hors-ligne actif):', error);
      isFirestoreAvailable = false;
    }
  },

  /**
   * Supprimer un candidat sur Firestore
   */
  async deleteCandidate(candidateId: string): Promise<void> {
    try {
      const docRef = doc(db, 'candidates', candidateId);
      await deleteDoc(docRef);
      isFirestoreAvailable = true;
    } catch (error) {
      console.warn('[Firebase] Erreur suppression candidat sur Firestore:', error);
    }
  },

  /**
   * Mettre à jour des champs précis (accusés de réception, consultation, etc.)
   */
  async updateCandidateFields(candidateId: string, fields: Partial<Candidate>): Promise<void> {
    try {
      const lightweight = { ...fields };
      delete lightweight.passport_file_url;

      const docRef = doc(db, 'candidates', candidateId);
      await updateDoc(docRef, lightweight);
      isFirestoreAvailable = true;
    } catch (error) {
      console.warn('[Firebase] Erreur mise à jour champs candidat:', error);
    }
  },

  /**
   * Écoute en temps réel de tous les dossiers candidats
   */
  subscribeToCandidates(
    onCandidatesUpdate: (candidates: Candidate[]) => void,
    onError?: (error: any) => void
  ): () => void {
    try {
      const candidatesCol = collection(db, 'candidates');
      const unsubscribe = onSnapshot(
        candidatesCol,
        (snapshot) => {
          isFirestoreAvailable = true;
          const list: Candidate[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as Candidate);
          });
          onCandidatesUpdate(list);
        },
        (err) => {
          console.warn('[Firebase] Erreur écoute candidates Firestore:', err);
          isFirestoreAvailable = false;
          onError?.(err);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.warn('[Firebase] Échec initialisation écouteur Firestore:', e);
      return () => {};
    }
  },

  // ============================================================================
  // 2. DOCUMENTS LOURDS & FRAGMENTATION (Chunks Transit)
  // ============================================================================

  /**
   * Envoyer un fragment individuel vers Firestore (collection document_chunks)
   */
  async sendDocumentChunk(chunk: DocumentChunkMessage): Promise<void> {
    try {
      const chunkDocId = `${chunk.docId}_chunk_${chunk.chunkIndex}`;
      const chunkRef = doc(db, 'document_chunks', chunkDocId);
      await setDoc(chunkRef, {
        docId: chunk.docId,
        fileName: chunk.fileName,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        chunkData: chunk.chunkData,
        timestamp: chunk.timestamp || new Date().toISOString()
      });
      isFirestoreAvailable = true;
    } catch (err) {
      console.warn('[Firebase] Erreur transmission fragment vers Firestore:', err);
    }
  },

  /**
   * Télécharger et réassembler tous les fragments d'un document depuis Firestore
   */
  async downloadAndReassembleDocument(docId: string): Promise<string | null> {
    try {
      const chunksCol = collection(db, 'document_chunks');
      const q = query(chunksCol, where('docId', '==', docId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      const chunksMap = new Map<number, string>();
      let totalExpected = 0;
      let detectedFileName = 'document.pdf';

      querySnapshot.forEach((snap) => {
        const data = snap.data();
        if (data.chunkIndex !== undefined && data.chunkData) {
          chunksMap.set(data.chunkIndex, data.chunkData);
          if (data.totalChunks) totalExpected = data.totalChunks;
          if (data.fileName) detectedFileName = data.fileName;
        }
      });

      if (totalExpected === 0 || chunksMap.size < totalExpected) {
        console.warn(`[Firebase] Fragments incomplets pour ${docId}: reçus ${chunksMap.size}/${totalExpected}`);
        return null;
      }

      // Réassemblage dans l'ordre strict des indices
      const ordered: string[] = [];
      for (let i = 0; i < totalExpected; i++) {
        const part = chunksMap.get(i);
        if (part === undefined) {
          console.warn(`[Firebase] Fragment manquant #${i} pour ${docId}`);
          return null;
        }
        ordered.push(part);
      }

      const fullDataUrl = ordered.join('');

      // Sauvegarde immédiate dans le coffre local IndexedDB
      await documentStorage.saveDocument(docId, detectedFileName, fullDataUrl);

      return fullDataUrl;
    } catch (error) {
      console.warn('[Firebase] Erreur téléchargement fragments document:', error);
      return null;
    }
  },

  /**
   * Nettoyer les fragments temporaires d'un document une fois traité
   */
  async cleanupDocumentChunks(docId: string): Promise<void> {
    try {
      const chunksCol = collection(db, 'document_chunks');
      const q = query(chunksCol, where('docId', '==', docId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) return;

      const batch = writeBatch(db);
      querySnapshot.forEach((snap) => {
        batch.delete(snap.ref);
      });
      await batch.commit();
    } catch (e) {
      console.warn('[Firebase] Nettoyage fragments ignoré:', e);
    }
  },

  // ============================================================================
  // 3. REGISTRE DES LICENCES OFFICIELLES (Médecins & Sociétés)
  // ============================================================================

  /**
   * Enregistrer une licence officielle dans la collection 'licenses'
   */
  async saveLicense(licenseData: {
    key: string;
    role: Role;
    holderName: string;
    detail1?: string;
    detail2?: string;
    location?: string;
    profile?: Doctor | ServiceCompany;
    createdAt?: string;
    status?: string;
  }): Promise<void> {
    try {
      const safeKey = licenseData.key.trim().toUpperCase().replace(/[^A-Za-z0-9_-]/g, '_');
      const docRef = doc(db, 'licenses', safeKey);
      await setDoc(docRef, {
        ...licenseData,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      isFirestoreAvailable = true;
    } catch (err) {
      console.warn('[Firebase] Erreur enregistrement licence sur Firestore:', err);
    }
  },

  /**
   * Écoute en temps réel de toutes les licences enregistrées
   */
  subscribeToLicenses(
    onLicensesUpdate: (licenses: any[]) => void,
    onError?: (error: any) => void
  ): () => void {
    try {
      const licensesCol = collection(db, 'licenses');
      const unsubscribe = onSnapshot(
        licensesCol,
        (snapshot) => {
          isFirestoreAvailable = true;
          const list: any[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data());
          });
          onLicensesUpdate(list);
        },
        (err) => {
          console.warn('[Firebase] Erreur écoute licenses Firestore:', err);
          isFirestoreAvailable = false;
          onError?.(err);
        }
      );
      return unsubscribe;
    } catch (e) {
      console.warn('[Firebase] Échec initialisation écouteur licences Firestore:', e);
      return () => {};
    }
  },

  /**
   * Statut de disponibilité
   */
  isAvailable(): boolean {
    return isFirestoreAvailable;
  }
};

// Brancher le relais des fragments de documentStorage vers Firestore
setCloudBridgeSender(async (chunk: DocumentChunkMessage) => {
  await firebaseSyncService.sendDocumentChunk(chunk);
});
