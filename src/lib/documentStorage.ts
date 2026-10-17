/**
 * CruisePocket - Gestionnaire des Documents Lourds (Passeports, Bilans)
 * 
 * Architecture Métier :
 * 1. Les documents lourds (PDF, Scans, Images) sont stockés de façon permanente et
 *    sécurisée localement dans le coffre IndexedDB sur l'appareil du médecin et de la société.
 * 2. Pour la transmission inter-profils (Société -> Médecin) via le pont (Firestore / Realtime) :
 *    - Le fichier est découpé localement en fragments (Chunks de 64 Ko).
 *    - Chaque fragment transite individuellement sans saturer les quotas de document (1 Mo Firestore / 256 Ko WS).
 *    - À la réception côté Médecin, les fragments sont réassemblés en direct, sauvegardés
 *      dans son IndexedDB local, et les résidus du pont sont immédiatement libérés.
 */

const DB_NAME = 'cruisepocket_local_vault';
const DB_VERSION = 2;
const STORE_NAME = 'heavy_documents';
const CHUNKS_STORE_NAME = 'ephemeral_chunks';

export const CHUNK_SIZE = 64 * 1024; // 64 Ko par fragment

export interface HeavyDocRecord {
  id: string;
  fileName: string;
  dataUrl: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface DocumentChunkMessage {
  type: 'CHUNK_TRANSIT';
  docId: string;
  fileName: string;
  chunkIndex: number;
  totalChunks: number;
  chunkData: string;
  timestamp: string;
}

// Tampon mémoire pour le réassemblage progressif des fragments entrants
const chunkReassemblyMap = new Map<string, {
  fileName: string;
  totalChunks: number;
  receivedChunks: Map<number, string>;
  lastUpdated: number;
}>();

// Initialisation de la base IndexedDB locale
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error("IndexedDB non supporté"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CHUNKS_STORE_NAME)) {
        db.createObjectStore(CHUNKS_STORE_NAME, { keyPath: 'chunkKey' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Canal pont de transmission en direct (WebRTC / Broadcast / Firestore Realtime Bridge)
let bridgeChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    bridgeChannel = new BroadcastChannel('cruisepocket_document_bridge');
  }
} catch {
  // Ignorer si non supporté
}

// Relais externe optionnel vers un backend Cloud (Firestore / Supabase)
let externalCloudSender: ((chunk: DocumentChunkMessage) => Promise<void>) | null = null;

export const setCloudBridgeSender = (fn: ((chunk: DocumentChunkMessage) => Promise<void>) | null) => {
  externalCloudSender = fn;
};

export const documentStorage = {
  /**
   * Enregistrer un document complet localement dans le coffre IndexedDB
   */
  async saveDocument(docId: string, fileName: string, dataUrl: string): Promise<void> {
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const record: HeavyDocRecord = {
          id: docId,
          fileName,
          dataUrl,
          sizeBytes: dataUrl.length,
          updatedAt: new Date().toISOString()
        };
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.warn("Échec du stockage IndexedDB pour le document lourd:", e);
    }
  },

  /**
   * Récupérer un document lourd depuis le coffre IndexedDB
   */
  async getDocument(docId: string): Promise<{ fileName: string; dataUrl: string } | null> {
    if (!docId) return null;

    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(docId);
        request.onsuccess = () => {
          if (request.result) {
            resolve({
              fileName: request.result.fileName,
              dataUrl: request.result.dataUrl
            });
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  /**
   * Supprimer un document lourd du coffre local
   */
  async deleteDocument(docId: string): Promise<void> {
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(docId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch {
      // Ignorer
    }
  },

  /**
   * Récupérer tous les documents pour la sauvegarde manuelle / restauration
   */
  async getAllDocuments(): Promise<Record<string, { fileName: string; dataUrl: string }>> {
    const result: Record<string, { fileName: string; dataUrl: string }> = {};
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
          const records: HeavyDocRecord[] = request.result || [];
          for (const rec of records) {
            result[rec.id] = { fileName: rec.fileName, dataUrl: rec.dataUrl };
          }
          resolve(result);
        };
        request.onerror = () => resolve(result);
      });
    } catch {
      return result;
    }
  },

  /**
   * FRAGMENTATION & ÉMISSION :
   * Découpe le document lourd localement en fragments de 64 Ko
   * et les transmet via le pont éphémère (Broadcast / Firestore).
   */
  async transmitViaBridge(
    docId: string, 
    fileName: string, 
    dataUrl: string,
    onProgress?: (sentChunks: number, totalChunks: number) => void
  ): Promise<void> {
    // 1. Sauvegarde locale permanente dans le coffre IndexedDB de l'émetteur
    await this.saveDocument(docId, fileName, dataUrl).catch(console.error);

    // 2. Découpage en fragments de 64 Ko
    const totalLength = dataUrl.length;
    const totalChunks = Math.max(1, Math.ceil(totalLength / CHUNK_SIZE));

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalLength);
      const chunkData = dataUrl.substring(start, end);

      const chunkMsg: DocumentChunkMessage = {
        type: 'CHUNK_TRANSIT',
        docId,
        fileName,
        chunkIndex: i,
        totalChunks,
        chunkData,
        timestamp: new Date().toISOString()
      };

      // Transmission sur le canal pont local (multi-onglets / même machine)
      if (bridgeChannel) {
        bridgeChannel.postMessage(chunkMsg);
      }

      // Si un relais cloud (Firestore / Realtime) est configuré
      if (externalCloudSender) {
        externalCloudSender(chunkMsg).catch((err) => {
          console.warn("Échec émission fragment cloud:", err);
        });
      }

      // Événement local pour feedback UI
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cruisepocket_chunk_sent', { detail: chunkMsg }));
      }

      onProgress?.(i + 1, totalChunks);

      // Micro-pause pour laisser respirer le cycle d'exécution
      if (i % 6 === 0) {
        await new Promise((res) => setTimeout(res, 2));
      }
    }
  },

  /**
   * RÉCEPTION & RÉASSEMBLAGE :
   * Reçoit les fragments entrants, les ordonne dans un tampon,
   * puis réassemble le document complet dès que 100% des fragments sont reçus.
   */
  subscribeToBridge(
    onReceive: (docId: string, fileName: string, dataUrl: string) => void,
    onProgress?: (docId: string, received: number, total: number) => void
  ): () => void {
    if (!bridgeChannel) return () => {};

    const handleMessage = async (event: MessageEvent) => {
      // 1. Gestion des fragments (Chunking Protocol)
      if (event.data?.type === 'CHUNK_TRANSIT' && event.data.docId) {
        const chunk = event.data as DocumentChunkMessage;
        const { docId, fileName, chunkIndex, totalChunks, chunkData } = chunk;

        let reassembly = chunkReassemblyMap.get(docId);
        if (!reassembly) {
          reassembly = {
            fileName,
            totalChunks,
            receivedChunks: new Map<number, string>(),
            lastUpdated: Date.now()
          };
          chunkReassemblyMap.set(docId, reassembly);
        }

        reassembly.receivedChunks.set(chunkIndex, chunkData);
        reassembly.lastUpdated = Date.now();

        onProgress?.(docId, reassembly.receivedChunks.size, totalChunks);

        // Dès que tous les fragments sont présents : réassemblage
        if (reassembly.receivedChunks.size === totalChunks) {
          const orderedChunks: string[] = [];
          for (let i = 0; i < totalChunks; i++) {
            orderedChunks.push(reassembly.receivedChunks.get(i) || '');
          }
          const fullDataUrl = orderedChunks.join('');

          // Enregistrement permanent dans le coffre IndexedDB du récepteur (Médecin)
          await this.saveDocument(docId, fileName, fullDataUrl);

          // Libération immédiate du tampon mémoire
          chunkReassemblyMap.delete(docId);

          // Notification
          onReceive(docId, fileName, fullDataUrl);

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cruisepocket_doc_reassembled', {
              detail: { docId, fileName }
            }));
          }
        }
      }

      // 2. Rétrocompatibilité : message direct sans découpage
      else if (event.data?.type === 'HEAVY_DOC_TRANSIT' && event.data.docId && event.data.dataUrl) {
        const { docId, fileName, dataUrl } = event.data;
        await this.saveDocument(docId, fileName, dataUrl);
        onReceive(docId, fileName, dataUrl);
      }
    };

    bridgeChannel.addEventListener('message', handleMessage);
    return () => {
      bridgeChannel?.removeEventListener('message', handleMessage);
    };
  },

  /**
   * Vérifie la progression actuelle du réassemblage d'un document
   */
  getReassemblyProgress(docId: string): { received: number; total: number; percent: number } | null {
    const reassembly = chunkReassemblyMap.get(docId);
    if (!reassembly) return null;
    const received = reassembly.receivedChunks.size;
    const total = reassembly.totalChunks;
    return {
      received,
      total,
      percent: Math.round((received / total) * 100)
    };
  }
};
