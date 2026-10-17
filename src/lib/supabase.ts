import { createClient } from '@supabase/supabase-js';
import { Candidate, CandidateEvent, DeletionInfo, Role, Doctor } from '../types';
import { backupService } from './backupService';
import { documentStorage } from './documentStorage';
import { isLicenseRevoked } from '../utils/license';

export const INITIAL_APPROVED_DOCTORS: Doctor[] = [
  {
    id: 'med-ferrari',
    full_name: 'Dr. Jean-Marc FERRARI',
    order_number: '13/98745',
    practice_location: 'Centre Médical Maritime - Marseille Port',
    license_key: 'CP-MED-13987-A1B2C3-4E8F'
  },
  {
    id: 'med-bensalah',
    full_name: 'Dr. Leila BEN SALAH',
    order_number: '24/55210',
    practice_location: 'Centre de Santé Portuaire - Tunis La Goulette',
    license_key: 'CP-MED-24552-D8E9F1-3A4B'
  },
  {
    id: 'med-tardieu',
    full_name: 'Dr. Philippe TARDIEU',
    order_number: '75/10492',
    practice_location: 'Pôle Médical Gens de Mer - Le Havre Port',
    license_key: 'CP-MED-75104-C4B2A1-9F8E'
  }
];

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
    doctor_id: 'med-ferrari',
    doctor_name: 'Dr. Jean-Marc FERRARI',
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
    doctor_id: 'med-bensalah',
    doctor_name: 'Dr. Leila BEN SALAH',
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
    doctor_id: 'med-ferrari',
    doctor_name: 'Dr. Jean-Marc FERRARI',
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
    doctor_id: 'med-bensalah',
    doctor_name: 'Dr. Leila BEN SALAH',
    currency: 'DT',
    is_archived: true,
    archived_at: new Date(Date.now() - 86400000 * 15).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 45).toISOString(),
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
   * Combine les médecins par défaut et ceux enregistrés via le Keygen
   */
  async getAvailableDoctors(): Promise<Doctor[]> {
    const doctorsMap = new Map<string, Doctor>();

    // 1. Médecins agréés officiels par défaut
    INITIAL_APPROVED_DOCTORS.forEach(doc => {
      doctorsMap.set(doc.license_key.toUpperCase(), doc);
    });

    // 2. Médecins enregistrés via le Keygen ou le registre local
    try {
      const rawRegistered = localStorage.getItem('cruisepocket_registered_licenses');
      if (rawRegistered) {
        const list = JSON.parse(rawRegistered);
        if (Array.isArray(list)) {
          list.filter((item: any) => item.role === 'medecin').forEach((item: any) => {
            const keyUpper = item.key.toUpperCase();
            doctorsMap.set(keyUpper, {
              id: `med-${item.key.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
              full_name: item.holderName,
              order_number: item.detail1?.replace(/[^0-9/]/g, '') || 'Certifié',
              practice_location: item.location || 'Cabinet Médical Agréé',
              license_key: item.key
            });
          });
        }
      }
    } catch (e) {
      console.warn("Erreur lecture médecins enregistrés:", e);
    }

    // 3. Filtrer formellement les médecins révoqués
    return Array.from(doctorsMap.values()).filter(doc => !isLicenseRevoked(doc.license_key));
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
