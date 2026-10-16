-- ==============================================================================
-- CRUISE POCKET - SCHÉMA COMPLET BASE DE DONNÉES RELATIONNELLE & TEMPS RÉEL (SUPABASE / POSTGRESQL)
-- Application métier PWA pour la gestion médicale et administrative des gens de mer
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLE DES SOCIÉTÉS DE SERVICE (Fournisseurs / Agences maritimes)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.service_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    manager_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    location TEXT NOT NULL,
    license_key TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 3. TABLE DES MÉDECINS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    order_number TEXT NOT NULL,
    practice_location TEXT NOT NULL,
    license_key TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 4. TABLE DES COMPAGNIES DE CROISIÈRE (Auto-alimentée dynamiquement)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.cruise_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Données initiales courantes pour l'auto-complétion
INSERT INTO public.cruise_companies (name) VALUES
    ('MSC Croisières'),
    ('Costa Croisières'),
    ('Royal Caribbean International'),
    ('Carnival Cruise Line'),
    ('Norwegian Cruise Line (NCL)'),
    ('Ponant'),
    ('Celebrity Cruises'),
    ('Princess Cruises'),
    ('Disney Cruise Line'),
    ('Viking Ocean Cruises')
ON CONFLICT (name) DO NOTHING;

-- ==============================================================================
-- 5. TABLE PRINCIPALE : DOSSIERS CANDIDATS (Gens de Mer)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Informations civiles & candidat
    civility TEXT NOT NULL CHECK (civility IN ('M.', 'Mme', 'Autre')),
    last_name TEXT NOT NULL,
    first_name TEXT NOT NULL,
    birth_date DATE NOT NULL,
    age INTEGER NOT NULL,
    passport_number TEXT NOT NULL,
    passport_file_url TEXT,
    
    -- Affectation maritime
    cruise_company TEXT NOT NULL,
    position TEXT NOT NULL,
    contract_type TEXT NOT NULL CHECK (contract_type IN ('Nouveau contrat', 'Contrat intermédiaire', 'Renouvellement de contrat')),
    embarkation_date DATE NOT NULL,
    
    -- Suivi médical & opérationnel
    medical_status TEXT NOT NULL DEFAULT 'En instance' CHECK (medical_status IN ('En instance', 'Effectué')),
    medical_notes TEXT,
    
    -- Volet financier (administré par le Médecin)
    financial_amount NUMERIC(10, 2) DEFAULT 0.00 NOT NULL,
    financial_status TEXT NOT NULL DEFAULT 'Non payé' CHECK (financial_status IN ('Payé', 'Non payé')),
    payer_name TEXT NOT NULL DEFAULT 'Le candidat lui-même' CHECK (payer_name IN ('Le candidat lui-même', 'La société')),
    
    -- Traçabilité & Liaison
    service_company_id UUID REFERENCES public.service_companies(id) ON DELETE SET NULL,
    service_company_name TEXT NOT NULL,
    doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 6. INDEX POUR PERFORMANCES RECHERCHE & TEMPS RÉEL
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_candidates_medical_status ON public.candidates(medical_status);
CREATE INDEX IF NOT EXISTS idx_candidates_financial_status ON public.candidates(financial_status);
CREATE INDEX IF NOT EXISTS idx_candidates_service_company ON public.candidates(service_company_id);
CREATE INDEX IF NOT EXISTS idx_candidates_embarkation ON public.candidates(embarkation_date);
CREATE INDEX IF NOT EXISTS idx_candidates_created_at ON public.candidates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_companies_license ON public.service_companies(license_key);
CREATE INDEX IF NOT EXISTS idx_doctors_license ON public.doctors(license_key);

-- ==============================================================================
-- 7. TRIGGER : AUTO-ALIMENTATION DE LA TABLE DES COMPAGNIES DE CROISIÈRE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_auto_feed_cruise_company()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.cruise_company IS NOT NULL AND trim(NEW.cruise_company) <> '' THEN
        INSERT INTO public.cruise_companies (name)
        VALUES (trim(NEW.cruise_company))
        ON CONFLICT (name) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_feed_cruise_company ON public.candidates;
CREATE TRIGGER trg_auto_feed_cruise_company
BEFORE INSERT OR UPDATE OF cruise_company ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.handle_auto_feed_cruise_company();

-- ==============================================================================
-- 8. TRIGGER : MISE À JOUR AUTOMATIQUE DE updated_at
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_candidates_updated_at ON public.candidates;
CREATE TRIGGER trg_candidates_updated_at
BEFORE UPDATE ON public.candidates
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- 9. CONFIGURATION REALTIME SUPABASE (Écouteurs instantanés pour le Médecin)
-- ==============================================================================
ALTER TABLE public.candidates REPLICA IDENTITY FULL;

-- Activer la publication en temps réel si elle existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.candidates;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.cruise_companies;
    END IF;
END $$;

-- ==============================================================================
-- 10. CONFIGURATION DU BUCKET DE STOCKAGE SÉCURISÉ POUR LES PASSEPORTS
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'passports',
    'passports',
    true, -- Permet la prévisualisation sécurisée par URL signée ou CDN
    10485760, -- 10MB max
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[],
    file_size_limit = 10485760;

-- Politiques RLS Storage
CREATE POLICY "Accès public lecture aux passeports"
ON storage.objects FOR SELECT
USING (bucket_id = 'passports');

CREATE POLICY "Upload passeports autorisé"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'passports');

-- ==============================================================================
-- 11. POLITIQUES DE SÉCURITÉ ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.service_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cruise_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

-- Autoriser la lecture publique des compagnies de croisière pour l'autocomplétion
CREATE POLICY "Lecture ouverte compagnies" ON public.cruise_companies FOR SELECT USING (true);
CREATE POLICY "Insertion compagnies" ON public.cruise_companies FOR INSERT WITH CHECK (true);

-- Politiques pour les candidats
CREATE POLICY "Lecture candidats" ON public.candidates FOR SELECT USING (true);
CREATE POLICY "Insertion candidats société" ON public.candidates FOR INSERT WITH CHECK (true);
CREATE POLICY "Mise à jour statut/finance médecin" ON public.candidates FOR UPDATE USING (true);
CREATE POLICY "Suppression candidats" ON public.candidates FOR DELETE USING (true);

-- Politiques d'authentification par clé
CREATE POLICY "Lecture sociétés" ON public.service_companies FOR ALL USING (true);
CREATE POLICY "Lecture médecins" ON public.doctors FOR ALL USING (true);
