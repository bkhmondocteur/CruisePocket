/**
 * CruisePocket - Gestionnaire des Documents Lourds (Passeports, Bilans)
 * 
 * Règle d'architecture :
 * Les documents lourds (PDF, Scans, Images Haute Résolution) ne sont PAS stockés
 * sur Firestore pour éviter d'alourdir la base et exploser les quotas/coûts.
 * Firestore sert uniquement de PONT éphémère de transmission.
 * Le stockage persistant des documents s'effectue localement via IndexedDB
 * sur l'appareil du médecin et de la société.
 */

const DB_NAME = 'cruisepocket_local_vault';
const DB_VERSION = 1;
const STORE_NAME = 'heavy_documents';

interface HeavyDocRecord {
  id: string;
  fileName: string;
  dataUrl: string;
  sizeBytes: number;
  updatedAt: string;
}

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
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Canal pont de transmission en direct (WebRTC / Broadcast / Firestore Bridge)
let bridgeChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    bridgeChannel = new BroadcastChannel('cruisepocket_document_bridge');
  }
} catch {
  // Ignorer si non supporté
}

export const documentStorage = {
  /**
   * Enregistrer un document lourd localement dans le coffre IndexedDB
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
    } catch {
      // Fallback mémoire / localStorage si IndexedDB échoue
      try {
        localStorage.setItem(`cruisepocket_doc_${docId}`, JSON.stringify({ fileName, dataUrl }));
      } catch (e) {
        console.warn("Échec du stockage local du document lourd:", e);
      }
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
            // Fallback localStorage
            const fallback = localStorage.getItem(`cruisepocket_doc_${docId}`);
            resolve(fallback ? JSON.parse(fallback) : null);
          }
        };
        request.onerror = () => {
          const fallback = localStorage.getItem(`cruisepocket_doc_${docId}`);
          resolve(fallback ? JSON.parse(fallback) : null);
        };
      });
    } catch {
      const fallback = localStorage.getItem(`cruisepocket_doc_${docId}`);
      return fallback ? JSON.parse(fallback) : null;
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
      localStorage.removeItem(`cruisepocket_doc_${docId}`);
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
   * Émettre un document lourd via le pont éphémère (Firestore / Realtime Bridge)
   * Le document transite sans rester stocké sur Firestore.
   */
  transmitViaBridge(docId: string, fileName: string, dataUrl: string) {
    if (bridgeChannel) {
      bridgeChannel.postMessage({
        type: 'HEAVY_DOC_TRANSIT',
        docId,
        fileName,
        dataUrl,
        timestamp: new Date().toISOString()
      });
    }

    // Sauvegarde immédiate dans notre coffre local
    this.saveDocument(docId, fileName, dataUrl).catch(console.error);
  },

  /**
   * Écouteur de réception des documents transitant par le pont
   */
  subscribeToBridge(onReceive: (docId: string, fileName: string, dataUrl: string) => void) {
    if (!bridgeChannel) return () => {};

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'HEAVY_DOC_TRANSIT' && event.data.docId && event.data.dataUrl) {
        const { docId, fileName, dataUrl } = event.data;
        // Sauvegarder automatiquement dans le coffre local dès réception du pont
        this.saveDocument(docId, fileName, dataUrl).then(() => {
          onReceive(docId, fileName, dataUrl);
        });
      }
    };

    bridgeChannel.addEventListener('message', handleMessage);
    return () => {
      bridgeChannel?.removeEventListener('message', handleMessage);
    };
  }
};
