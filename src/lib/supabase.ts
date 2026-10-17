import { createClient } from '@supabase/supabase-js';
import { Candidate, CandidateEvent, DeletionInfo, Role, Doctor } from '../types';
import { backupService } from './backupService';
import { documentStorage } from './documentStorage';
import { isLicenseRevoked, getLicenseRegistry, FICTIVE_LICENSE_KEYS, FICTIVE_NAMES } from '../utils/license';

export const INITIAL_APPROVED_DOCTORS: Doctor[] = [];
export const FICTIVE_CANDIDATE_IDS = ['cand-101', 'cand-102', 'cand-103', 'cand-104'];

// Variables d'environnement Supabase (optionnelles en local, obligatoires en production)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co'
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ==============================================================================
// GESTIONNAIRE RÉACTIF LOCAL & TEMPS RÉEL (OFFLINE / FALLBACK / BROADCAST)
// ==============================================================================
const STORAGE_CANDIDATES_KEY = 'cruisepocket_candidates_data';
const STORAGE_COMPANIES_KEY = 'cruisepocket_cruise_companies_data';

// BroadcastChannel pour synchronisation multi-onglets en local
let localBroadcast: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    localBroadcast = new BroadcastChannel('cruisepocket_sync_channel');
  }
} catch {
  // Ignorer si non supporté
}

export const dataService = {
  // --- Candidats ---
  async getCandidates(): Promise<Candidate[]> {
    let rawList: Candidate[] = [];
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) rawList = data as Candidate[];
    } else {
      try {
        const raw = localStorage.getItem(STORAGE_CANDIDATES_KEY);
        if (raw) {
          rawList = JSON.parse(raw);
        } else {
          rawList = [];
        }
      } catch {
        rawList = [];
      }
    }

    // Purge formelle de tous les anciens candidats fictifs de démonstration
    const hadFictive = rawList.some(c => 
      FICTIVE_CANDIDATE_IDS.includes(c.id) || 
      FICTIVE_NAMES.includes(c.doctor_name || '') ||
      FICTIVE_NAMES.includes(c.service_company_name || '')
    );
    if (hadFictive) {
      rawList = rawList.filter(c => 
        !FICTIVE_CANDIDATE_IDS.includes(c.id) && 
        !FICTIVE_NAMES.includes(c.doctor_name || '') &&
        !FICTIVE_NAMES.includes(c.service_company_name || '')
      );
      try {
        localStorage.setItem(STORAGE_CANDIDATES_KEY, JSON.stringify(rawList));
      } catch (e) {
        console.warn('Erreur purge candidats fictifs:', e);
      }
    }

    // Évaluation automatique de l'archivage (> 1 mois / 30 jours)
    // Règle générale : les dossiers de plus d'un mois sont archivés.
    // Exception règle métier : Si le type de contrat est (ou est passé en) « Renouvellement de contrat » 
    // ou « Contrat intermédiaire » (Visite intermédiaire), le dossier n'est PAS réarchivé et reste 
    // définitivement réactivé dans les dossiers opérationnels en cours jusqu'à ce que la date dépasse de nouveau les 30 jours.
    const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const evaluated = rawList.map((c) => {
      const isRenewalOrIntermediate = 
        c.contract_type === 'Renouvellement de contrat' || 
        c.contract_type === 'Contrat intermédiaire';

      // Date de référence pour le cycle de 30 jours : 
      // Si reactivated_at existe (suite à réactivation pour renouvellement/visite intermédiaire), on s'y réfère, sinon created_at.
      const referenceDateStr = c.reactivated_at || c.created_at;
      const referenceTime = new Date(referenceDateStr).getTime();
      const isOlderThan30Days = (now - referenceTime) > ONE_MONTH_MS;

      let is_archived = c.is_archived;

      if (isRenewalOrIntermediate) {
        // Règle métier : Reste réactivé dans les dossiers opérationnels jusqu'à ce que la date dépasse de nouveau les 30 jours
        if (isOlderThan30Days) {
          is_archived = true;
        } else {
          is_archived = false;
        }
      } else {
        // Dossier standard (ex: Nouveau contrat) : archivé dès qu'il dépasse 30 jours
        if (isOlderThan30Days) {
          is_archived = true;
        } else if (is_archived === undefined) {
          is_archived = false;
        }
      }

      return {
        ...c,
        currency: (c.currency || 'DT') as 'DT',
        is_archived
      };
    });

    return evaluated;
  },

  async addCandidate(candidate: Omit<Candidate, 'id' | 'created_at' | 'updated_at'>): Promise<Candidate> {
    const docId = candidate.passport_file_url 
      ? 'doc-' + Math.random().toString(36).substring(2, 9)
      : undefined;

    // Règle documents lourds : les documents ne sont pas enregistrés sur Firestore,
    // Firestore/Bridge sert seulement de pont éphémère. Sauvegarde dans IndexedDB local.
    if (docId && candidate.passport_file_url) {
      documentStorage.transmitViaBridge(
        docId, 
        candidate.passport_file_name || 'copie-passeport.pdf', 
        candidate.passport_file_url
      );
    }

    const newRecord: Candidate = {
      ...candidate,
      id: 'cand-' + Math.random().toString(36).substring(2, 9),
      currency: 'DT',
      is_archived: false,
      passport_file_id: docId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      // Sur le backend distant, on n'enregistre PAS le document lourd directement
      const lightweightCopy = { ...newRecord };
      delete lightweightCopy.passport_file_url;
      await supabase.from('candidates').insert([lightweightCopy]);
    }

    // Sauvegarde locale
    const existing = await this.getCandidates();
    const updated = [newRecord, ...existing];
    localStorage.setItem(STORAGE_CANDIDATES_KEY, JSON.stringify(updated));

    // Auto-alimentation de la compagnie de croisière
    await this.addCruiseCompany(candidate.cruise_company);

    // Notification broadcast
    localBroadcast?.postMessage({ type: 'CANDIDATE_ADDED', candidate: newRecord });
    window.dispatchEvent(new CustomEvent('cruisepocket_candidate_update', { detail: newRecord }));

    // Sauvegarde automatique rotative (5 fichiers tournants)
    backupService.triggerAutoBackup().catch(console.error);

    return newRecord;
  },

  async updateCandidate(id: string, updates: Partial<Candidate>): Promise<Candidate | null> {
    if (isSupabaseConfigured && supabase) {
      const lightweight = { ...updates, updated_at: new Date().toISOString() };
      delete lightweight.passport_file_url;
      await supabase.from('candidates').update(lightweight).eq('id', id);
    }

    const existing = await this.getCandidates();
    const index = existing.findIndex(c => c.id === id);
    if (index === -1) return null;

    // Si le contrat devient Renouvellement ou Contrat Intermédiaire, ou en cas de réactivation
    let is_archived = updates.is_archived !== undefined ? updates.is_archived : existing[index].is_archived;
    let reactivated_at = updates.reactivated_at !== undefined ? updates.reactivated_at : existing[index].reactivated_at;
    let archived_at = updates.archived_at !== undefined ? updates.archived_at : existing[index].archived_at;
    const contractType = updates.contract_type || existing[index].contract_type;
    const isRenewalOrIntermediate = 
      contractType === 'Renouvellement de contrat' || 
      contractType === 'Contrat intermédiaire';

    if (isRenewalOrIntermediate) {
      // Si le dossier passe en renouvellement ou contrat intermédiaire, ou s'il est réactivé :
      // On initialise son nouveau cycle opérationnel de 30 jours
      if (existing[index].is_archived || updates.is_archived === false || updates.contract_type !== existing[index].contract_type) {
        is_archived = false;
        reactivated_at = updates.reactivated_at || new Date().toISOString();
        archived_at = undefined;
      }
    }

    existing[index] = {
      ...existing[index],
      ...updates,
      is_archived,
      reactivated_at,
      archived_at,
      updated_at: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_CANDIDATES_KEY, JSON.stringify(existing));
    localBroadcast?.postMessage({ type: 'CANDIDATE_UPDATED', candidate: existing[index] });
    window.dispatchEvent(new CustomEvent('cruisepocket_candidate_update', { detail: existing[index] }));

    // Sauvegarde automatique rotative (5 fichiers tournants)
    backupService.triggerAutoBackup().catch(console.error);

    return existing[index];
  },

  async deleteCandidate(
    id: string, 
    deletedBy: { role: Role; name: string }
  ): Promise<Candidate | null> {
    const existing = await this.getCandidates();
    const candidateToDelete = existing.find(c => c.id === id);
    if (!candidateToDelete) return null;

    if (isSupabaseConfigured && supabase) {
      await supabase.from('candidates').delete().eq('id', id);
    }

    if (candidateToDelete.passport_file_id) {
      await documentStorage.deleteDocument(candidateToDelete.passport_file_id);
    }

    const updated = existing.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_CANDIDATES_KEY, JSON.stringify(updated));

    const deletionInfo: DeletionInfo = {
      candidateId: id,
      candidateName: `${candidateToDelete.civility} ${candidateToDelete.last_name} ${candidateToDelete.first_name}`,
      deletedBy,
      timestamp: new Date().toISOString()
    };

    localBroadcast?.postMessage({ 
      type: 'CANDIDATE_DELETED', 
      candidate: candidateToDelete,
      deletion: deletionInfo 
    });

    window.dispatchEvent(new CustomEvent('cruisepocket_candidate_deleted', { 
      detail: deletionInfo 
    }));

    // Sauvegarde automatique rotative (5 fichiers tournants)
    backupService.triggerAutoBackup().catch(console.error);

    return candidateToDelete;
  },

  /**
   * Réarchivage à la sortie de consultation de la fiche candidat
   * Règle générale : réarchivé de nouveau sauf en cas de renouvellement de contrat ou visite intermédiaire.
   * Exception règle métier : Si le type de contrat est (ou est passé en) « Renouvellement de contrat »
   * ou « Contrat intermédiaire » (Visite intermédiaire), le dossier n'est PAS réarchivé et reste
   * définitivement réactivé dans vos dossiers opérationnels en cours jusqu'à ce que la date dépasse de nouveau les 30 jours.
   */
  async rearchiveCandidateOnExit(id: string): Promise<Candidate | null> {
    const existing = await this.getCandidates();
    const candidate = existing.find(c => c.id === id);
    if (!candidate) return null;

    const isRenewalOrIntermediate = 
      candidate.contract_type === 'Renouvellement de contrat' || 
      candidate.contract_type === 'Contrat intermédiaire';

    const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
    const referenceDateStr = candidate.reactivated_at || candidate.created_at;
    const referenceTime = new Date(referenceDateStr).getTime();
    const isOlderThan30Days = (Date.now() - referenceTime) > ONE_MONTH_MS;

    if (isRenewalOrIntermediate && !isOlderThan30Days) {
      // Reste réactivé dans les dossiers opérationnels (cycle de 30 jours en cours)
      return this.updateCandidate(id, { 
        is_archived: false,
        archived_at: undefined
      });
    } else {
      // Réarchivé automatiquement à la sortie
      return this.updateCandidate(id, { 
        is_archived: true, 
        archived_at: new Date().toISOString() 
      });
    }
  },

  /**
   * Charger le document lourd d'un candidat à la demande depuis le coffre IndexedDB
   */
  async loadCandidateDocument(candidate: Candidate): Promise<string | undefined> {
    if (candidate.passport_file_url) return candidate.passport_file_url;
    if (!candidate.passport_file_id) return undefined;

    const doc = await documentStorage.getDocument(candidate.passport_file_id);
    return doc?.dataUrl;
  },

  /**
   * Récupérer la liste des médecins agréés actifs (non révoqués)
   * Uniquement les médecins formellement enregistrés (Keygen / Registre)
   */
  async getAvailableDoctors(): Promise<Doctor[]> {
    const registry = getLicenseRegistry();
    const doctors = Object.values(registry.doctors);

    // Filtrer formellement les médecins révoqués et les résidus fictifs
    return doctors.filter(doc => 
      !isLicenseRevoked(doc.license_key) &&
      !FICTIVE_LICENSE_KEYS.includes(doc.license_key.toUpperCase()) &&
      !FICTIVE_NAMES.includes(doc.full_name)
    );
  },

  // --- Compagnies de Croisière (Auto-alimentation) ---
  async getCruiseCompanies(): Promise<string[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('cruise_companies')
        .select('name')
        .order('name');
      if (!error && data) return data.map((c: { name: string }) => c.name);
    }

    try {
      const raw = localStorage.getItem(STORAGE_COMPANIES_KEY);
      if (!raw) {
        return [];
      }
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  async addCruiseCompany(companyName: string): Promise<void> {
    const trimmed = companyName.trim();
    if (!trimmed) return;

    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('cruise_companies')
        .insert([{ name: trimmed }])
        .select();
    }

    const existing = await this.getCruiseCompanies();
    if (!existing.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...existing, trimmed].sort();
      localStorage.setItem(STORAGE_COMPANIES_KEY, JSON.stringify(updated));
    }
  },

  // --- Écouteur en temps réel (Supabase + Broadcast local) ---
  subscribeToCandidates(callback: (event: CandidateEvent) => void) {
    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('public:candidates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, (payload: any) => {
          if (payload.eventType === 'DELETE') {
            callback({ 
              type: 'CANDIDATE_DELETED', 
              payload: payload.old as Candidate,
              deletion: {
                candidateId: payload.old?.id,
                candidateName: payload.old?.last_name ? `${payload.old.last_name} ${payload.old.first_name}` : 'Marin',
                deletedBy: { role: 'medecin', name: 'Partenaire distant' },
                timestamp: new Date().toISOString()
              }
            });
          } else {
            callback({ type: payload.eventType, payload: payload.new as Candidate });
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }

    // Écouteur local
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_CANDIDATES_KEY) {
        callback({ type: 'LOCAL_STORAGE_CHANGE' });
      }
    };

    const handleCustomUpdate = (e: Event) => {
      const custom = e as CustomEvent<Candidate>;
      callback({ type: 'UPDATE', payload: custom.detail });
    };

    const handleCustomDeletion = (e: Event) => {
      const custom = e as CustomEvent<DeletionInfo>;
      callback({ type: 'CANDIDATE_DELETED', deletion: custom.detail });
    };

    const handleBroadcast = (e: MessageEvent) => {
      callback({ 
        type: e.data?.type || 'BROADCAST', 
        payload: e.data?.candidate,
        deletion: e.data?.deletion
      });
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('cruisepocket_candidate_update', handleCustomUpdate);
    window.addEventListener('cruisepocket_candidate_deleted', handleCustomDeletion);
    localBroadcast?.addEventListener('message', handleBroadcast);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('cruisepocket_candidate_update', handleCustomUpdate);
      window.removeEventListener('cruisepocket_candidate_deleted', handleCustomDeletion);
      localBroadcast?.removeEventListener('message', handleBroadcast);
    };
  }
};
