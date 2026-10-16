import { createClient } from '@supabase/supabase-js';
import { Candidate, CandidateEvent, DeletionInfo, Role } from '../types';
import { backupService } from './backupService';
import { documentStorage } from './documentStorage';

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

const DEFAULT_COMPANIES: string[] = [
  'MSC Croisières',
  'Costa Croisières',
  'Royal Caribbean International',
  'Carnival Cruise Line',
  'Norwegian Cruise Line (NCL)',
  'Ponant',
  'Celebrity Cruises',
  'Princess Cruises',
  'Disney Cruise Line',
  'Viking Ocean Cruises'
];

const INITIAL_MOCK_CANDIDATES: Candidate[] = [
  {
    id: 'cand-101',
    civility: 'M.',
    last_name: 'DURAND',
    first_name: 'Alexandre',
    birth_date: '1992-05-14',
    age: 34,
    passport_number: '21AB94820',
    cruise_company: 'MSC Croisières',
    position: 'Chef Mécanicien',
    contract_type: 'Renouvellement de contrat',
    embarkation_date: '2026-11-01',
    medical_status: 'En instance',
    financial_amount: 180,
    financial_status: 'Non payé',
    payer_name: 'La société',
    service_company_name: 'TransMed Crewing Services',
    currency: 'DT',
    is_archived: false,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'cand-102',
    civility: 'Mme',
    last_name: 'LEBLANC',
    first_name: 'Camille',
    birth_date: '1998-10-22',
    age: 28,
    passport_number: '19FR83719',
    cruise_company: 'Ponant',
    position: 'Second Capitaine',
    contract_type: 'Nouveau contrat',
    embarkation_date: '2026-11-15',
    medical_status: 'En instance',
    financial_amount: 220,
    financial_status: 'Payé',
    payer_name: 'Le candidat lui-même',
    service_company_name: 'Azur Crewing Agency',
    currency: 'DT',
    is_archived: false,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'cand-103',
    civility: 'M.',
    last_name: 'GARCIA',
    first_name: 'Matteo',
    birth_date: '2001-02-18',
    age: 25,
    passport_number: '23ES74619',
    cruise_company: 'Costa Croisières',
    position: 'Responsable Hôtellerie',
    contract_type: 'Contrat intermédiaire',
    embarkation_date: '2026-10-28',
    medical_status: 'Effectué',
    financial_amount: 150,
    financial_status: 'Payé',
    payer_name: 'La société',
    service_company_name: 'TransMed Crewing Services',
    currency: 'DT',
    is_archived: false,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString()
  },
  {
    id: 'cand-104',
    civility: 'M.',
    last_name: 'BEN SALEM',
    first_name: 'Sofiane',
    birth_date: '1989-07-12',
    age: 37,
    passport_number: 'TN482019',
    cruise_company: 'MSC Croisières',
    position: 'Officier Navigation',
    contract_type: 'Nouveau contrat',
    embarkation_date: '2026-08-15',
    medical_status: 'Effectué',
    financial_amount: 200,
    financial_status: 'Payé',
    payer_name: 'La société',
    service_company_name: 'TransMed Crewing Services',
    currency: 'DT',
    is_archived: true,
    archived_at: new Date(Date.now() - 86400000 * 15).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 45).toISOString(), // Créé il y a 45 jours (> 1 mois)
    updated_at: new Date(Date.now() - 86400000 * 45).toISOString()
  }
];

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
        if (!raw) {
          localStorage.setItem(STORAGE_CANDIDATES_KEY, JSON.stringify(INITIAL_MOCK_CANDIDATES));
          rawList = INITIAL_MOCK_CANDIDATES;
        } else {
          rawList = JSON.parse(raw);
        }
      } catch {
        rawList = INITIAL_MOCK_CANDIDATES;
      }
    }

    // Évaluation automatique de l'archivage (> 1 mois / 30 jours)
    // Règle : les dossiers de plus d'un mois sont archivés, sauf renouvellement de contrat ou contrat intermédiaire
    const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const evaluated = rawList.map((c) => {
      const createdTime = new Date(c.created_at).getTime();
      const isOlderThanMonth = now - createdTime > ONE_MONTH_MS;
      const isRenewalOrIntermediate = 
        c.contract_type === 'Renouvellement de contrat' || 
        c.contract_type === 'Contrat intermédiaire';

      let is_archived = c.is_archived;
      if (is_archived === undefined) {
        is_archived = isOlderThanMonth && !isRenewalOrIntermediate;
      } else if (isRenewalOrIntermediate) {
        // En cas de renouvellement ou contrat intermédiaire, le dossier est actif
        is_archived = false;
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

    // Si le contrat devient Renouvellement ou Contrat Intermédiaire, désarchiver immédiatement
    let is_archived = updates.is_archived !== undefined ? updates.is_archived : existing[index].is_archived;
    const contractType = updates.contract_type || existing[index].contract_type;
    if (contractType === 'Renouvellement de contrat' || contractType === 'Contrat intermédiaire') {
      is_archived = false;
    }

    existing[index] = {
      ...existing[index],
      ...updates,
      is_archived,
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
   * Règle : réarchivé de nouveau sauf en cas de renouvellement de contrat ou visite intermédiaire
   */
  async rearchiveCandidateOnExit(id: string): Promise<Candidate | null> {
    const existing = await this.getCandidates();
    const candidate = existing.find(c => c.id === id);
    if (!candidate) return null;

    const isExempt = 
      candidate.contract_type === 'Renouvellement de contrat' || 
      candidate.contract_type === 'Contrat intermédiaire';

    if (isExempt) {
      // Reste actif de manière permanente !
      return this.updateCandidate(id, { is_archived: false });
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
        localStorage.setItem(STORAGE_COMPANIES_KEY, JSON.stringify(DEFAULT_COMPANIES));
        return DEFAULT_COMPANIES;
      }
      return JSON.parse(raw);
    } catch {
      return DEFAULT_COMPANIES;
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
