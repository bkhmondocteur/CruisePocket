/**
 * CruisePocket - Module de Sauvegarde et Restauration
 * 
 * Exigences Utilisateur :
 * 1. Bouton de Sauvegarde manuelle & Bouton de Restauration.
 * 2. Sauvegarde automatique réalisée à chaque modification.
 * 3. Dossier de sauvegarde choisi par l'utilisateur (via File System Access API).
 * 4. 5 fichiers de sauvegarde rotatifs (le 6ème écrase le premier : slots 1 à 5 en boucle FIFO).
 */

import { Candidate, BackupPayload, BackupSlotInfo } from '../types';
import { documentStorage } from './documentStorage';

const STORAGE_FOLDER_NAME_KEY = 'cruisepocket_backup_folder_name';
const STORAGE_SLOT_INDEX_KEY = 'cruisepocket_backup_slot_index';
const STORAGE_SLOTS_METADATA_KEY = 'cruisepocket_backup_slots_meta';

// Stockage du FileSystemDirectoryHandle dans IndexedDB pour persistance
const DB_NAME = 'cruisepocket_handles_vault';
const STORE_NAME = 'directory_handles';

function openHandleDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error("IndexedDB non supporté"));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    const db = await openHandleDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(handle, 'auto_backup_folder');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Si échec IndexedDB
  }
}

async function getDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openHandleDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get('auto_backup_folder');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export const backupService = {
  /**
   * Vérifier si l'API File System Access est disponible dans le navigateur
   */
  isFileSystemAccessSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  },

  /**
   * Nom du dossier actuellement sélectionné
   */
  getSelectedFolderName(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_FOLDER_NAME_KEY);
  },

  /**
   * Permet à l'utilisateur de choisir le dossier de destination pour la sauvegarde automatique
   */
  async chooseBackupDirectory(): Promise<{ success: boolean; folderName?: string; error?: string }> {
    if (!this.isFileSystemAccessSupported()) {
      return { 
        success: false, 
        error: "Votre navigateur ne supporte pas le sélecteur de dossier local (supporté sur Chrome, Edge, Safari récent). Les sauvegardes restent assurées localement." 
      };
    }

    try {
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });

      if (!dirHandle) {
        return { success: false, error: "Aucun dossier sélectionné." };
      }

      // Sauvegarder le handle et le nom
      await saveDirHandle(dirHandle);
      localStorage.setItem(STORAGE_FOLDER_NAME_KEY, dirHandle.name);

      // Effectuer immédiatement un premier jeu de sauvegarde
      await this.triggerAutoBackup();

      return { success: true, folderName: dirHandle.name };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, error: "Sélection annulée par l'utilisateur." };
      }
      return { success: false, error: err.message || "Erreur lors de la sélection du dossier." };
    }
  },

  /**
   * Construire le payload complet de sauvegarde (Candidats, Compagnies, Licences, Documents lourds)
   */
  async buildBackupPayload(): Promise<BackupPayload> {
    let candidates: Candidate[] = [];
    let cruise_companies: string[] = [];
    let license_registry: any = null;

    try {
      const rawCands = localStorage.getItem('cruisepocket_candidates_data');
      if (rawCands) candidates = JSON.parse(rawCands);
    } catch {}

    try {
      const rawComps = localStorage.getItem('cruisepocket_cruise_companies_data');
      if (rawComps) cruise_companies = JSON.parse(rawComps);
    } catch {}

    try {
      const rawReg = localStorage.getItem('cruisepocket_license_registry');
      if (rawReg) license_registry = JSON.parse(rawReg);
    } catch {}

    // Récupération des documents lourds du coffre local
    const heavy_documents = await documentStorage.getAllDocuments();

    return {
      version: '1.2.0',
      generated_at: new Date().toISOString(),
      currency: 'DT',
      candidates,
      cruise_companies,
      license_registry,
      heavy_documents
    };
  },

  /**
   * Sauvegarde Automatique Rotative (5 fichiers : le 6ème écrase le 1er)
   * Appelé à chaque modification (ajout, mise à jour, suppression, changement statut).
   */
  async triggerAutoBackup(): Promise<{ slot: number; fileName: string }> {
    const rawIndex = localStorage.getItem(STORAGE_SLOT_INDEX_KEY);
    const currentIndex = rawIndex ? parseInt(rawIndex, 10) : 0;
    
    // Rotation modulo 5 : 1, 2, 3, 4, 5 puis 1 écrase 1, etc.
    const nextSlot = (currentIndex % 5) + 1;
    const fileName = `cruisepocket_backup_${nextSlot}.json`;

    const payload = await this.buildBackupPayload();
    const jsonString = JSON.stringify(payload, null, 2);

    // 1. Sauvegarde dans le dossier physique choisi par l'utilisateur si disponible
    try {
      const dirHandle = await getDirHandle();
      if (dirHandle) {
        // Demande de permission si nécessaire
        const permission = await (dirHandle as any).queryPermission({ mode: 'readwrite' });
        if (permission === 'granted' || (await (dirHandle as any).requestPermission({ mode: 'readwrite' })) === 'granted') {
          const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(jsonString);
          await writable.close();
        }
      }
    } catch (e) {
      console.warn("Écriture sur disque local ignorée ou permission requise:", e);
    }

    // 2. Sauvegarde de secours dans le cache tournant local (5 slots)
    try {
      localStorage.setItem(`cruisepocket_rolling_slot_${nextSlot}`, jsonString);
    } catch {}

    // Mise à jour de l'index de slot
    localStorage.setItem(STORAGE_SLOT_INDEX_KEY, nextSlot.toString());

    // Mise à jour des métadonnées des 5 slots
    const metaList = this.getSlotsMetadata();
    const slotIdx = metaList.findIndex(s => s.slot === nextSlot);
    const slotInfo: BackupSlotInfo = {
      slot: nextSlot,
      fileName,
      timestamp: new Date().toISOString(),
      candidatesCount: payload.candidates.length,
      sizeBytes: jsonString.length
    };

    if (slotIdx >= 0) {
      metaList[slotIdx] = slotInfo;
    } else {
      metaList.push(slotInfo);
    }
    metaList.sort((a, b) => a.slot - b.slot);

    localStorage.setItem(STORAGE_SLOTS_METADATA_KEY, JSON.stringify(metaList));

    // Notification broadcast pour mettre à jour les indicateurs visuels
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cruisepocket_backup_updated', {
        detail: { slot: nextSlot, fileName, timestamp: slotInfo.timestamp }
      }));
    }

    return { slot: nextSlot, fileName };
  },

  /**
   * Récupère la liste des 5 slots rotatifs avec leurs métadonnées
   */
  getSlotsMetadata(): BackupSlotInfo[] {
    try {
      const raw = localStorage.getItem(STORAGE_SLOTS_METADATA_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    
    // Par défaut slots vides
    return Array.from({ length: 5 }, (_, i) => ({
      slot: i + 1,
      fileName: `cruisepocket_backup_${i + 1}.json`,
      timestamp: '',
      candidatesCount: 0
    }));
  },

  getCurrentSlotIndex(): number {
    const raw = localStorage.getItem(STORAGE_SLOT_INDEX_KEY);
    return raw ? parseInt(raw, 10) : 0;
  },

  /**
   * Sauvegarde Manuelle Déclenchée par l'utilisateur (Export fichier immédiat)
   */
  async manualExportBackup(): Promise<void> {
    const payload = await this.buildBackupPayload();
    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${now.getHours()}h${now.getMinutes()}`;
    const filename = `cruisepocket_sauvegarde_${dateStr}_${timeStr}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Restauration Manuelle à partir d'un fichier de sauvegarde choisi par l'utilisateur
   */
  async restoreFromFile(file: File): Promise<{
    success: boolean;
    candidatesCount?: number;
    error?: string;
  }> {
    try {
      const text = await file.text();
      const payload: BackupPayload = JSON.parse(text);

      if (!payload.candidates || !Array.isArray(payload.candidates)) {
        return { success: false, error: "Format de fichier invalide : aucun dossier candidat trouvé." };
      }

      // Restauration des candidats
      localStorage.setItem('cruisepocket_candidates_data', JSON.stringify(payload.candidates));

      // Restauration des compagnies de croisière
      if (payload.cruise_companies && Array.isArray(payload.cruise_companies)) {
        localStorage.setItem('cruisepocket_cruise_companies_data', JSON.stringify(payload.cruise_companies));
      }

      // Restauration du registre des licences si présent
      if (payload.license_registry) {
        localStorage.setItem('cruisepocket_license_registry', JSON.stringify(payload.license_registry));
      }

      // Restauration des documents lourds dans le coffre local IndexedDB
      if (payload.heavy_documents) {
        for (const [docId, doc] of Object.entries(payload.heavy_documents)) {
          if (doc?.dataUrl) {
            await documentStorage.saveDocument(docId, doc.fileName, doc.dataUrl);
          }
        }
      }

      // Déclencher les événements de mise à jour pour rafraîchir l'interface
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('cruisepocket_candidate_update'));
      }

      return {
        success: true,
        candidatesCount: payload.candidates.length
      };
    } catch (err: any) {
      return { success: false, error: err.message || "Erreur lors de la lecture du fichier de sauvegarde." };
    }
  }
};
