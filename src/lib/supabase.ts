import { createClient } from '@supabase/supabase-js';
import { Candidate } from '../types';

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
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 1).toISOString()
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
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data as Candidate[];
    }

    try {
      const raw = localStorage.getItem(STORAGE_CANDIDATES_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_CANDIDATES_KEY, JSON.stringify(INITIAL_MOCK_CANDIDATES));
        return INITIAL_MOCK_CANDIDATES;
      }
      return JSON.parse(raw);
    } catch {
      return INITIAL_MOCK_CANDIDATES;
    }
  },

  async addCandidate(candidate: Omit<Candidate, 'id' | 'created_at' | 'updated_at'>): Promise<Candidate> {
    const newRecord: Candidate = {
      ...candidate,
      id: 'cand-' + Math.random().toString(36).substring(2, 9),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('candidates')
        .insert([candidate])
        .select()
        .single();
      if (!error && data) {
        return data as Candidate;
      }
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

    return newRecord;
  },

  async updateCandidate(id: string, updates: Partial<Candidate>): Promise<Candidate | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('candidates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (!error && data) return data as Candidate;
    }

    const existing = await this.getCandidates();
    const index = existing.findIndex(c => c.id === id);
    if (index === -1) return null;

    existing[index] = {
      ...existing[index],
      ...updates,
      updated_at: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_CANDIDATES_KEY, JSON.stringify(existing));
    localBroadcast?.postMessage({ type: 'CANDIDATE_UPDATED', candidate: existing[index] });
    window.dispatchEvent(new CustomEvent('cruisepocket_candidate_update', { detail: existing[index] }));

    return existing[index];
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
  subscribeToCandidates(callback: (event: { type: string; payload?: Candidate }) => void) {
    if (isSupabaseConfigured && supabase) {
      const channel = supabase
        .channel('public:candidates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, (payload: any) => {
          callback({ type: payload.eventType, payload: payload.new as Candidate });
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

    const handleCustomEvent = (e: Event) => {
      const custom = e as CustomEvent<Candidate>;
      callback({ type: 'UPDATE', payload: custom.detail });
    };

    const handleBroadcast = (e: MessageEvent) => {
      callback({ type: e.data?.type || 'BROADCAST', payload: e.data?.candidate });
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('cruisepocket_candidate_update', handleCustomEvent);
    localBroadcast?.addEventListener('message', handleBroadcast);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('cruisepocket_candidate_update', handleCustomEvent);
      localBroadcast?.removeEventListener('message', handleBroadcast);
    };
  }
};
