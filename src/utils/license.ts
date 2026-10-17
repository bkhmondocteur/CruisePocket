import { 
  LicenseGenerationCompanyInput, 
  LicenseGenerationDoctorInput, 
  Role, 
  ServiceCompany, 
  Doctor,
  Candidate
} from '../types';

/**
 * Hash function (Fletcher/DJB2 based) to produce deterministic hexadecimal hashes
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
}

/**
 * Generate a short checksum for license verification
 */
function generateChecksum(prefix: string, seed: string): string {
  const combined = `${prefix}:${seed}:CRUISE_POCKET_SALT_2026`;
  return hashString(combined).substring(0, 4);
}

/**
 * Générateur Société de Service
 * Clé générée à partir de :
 * - Nom de la société
 * - Nom/Prénom du responsable
 * - Téléphone
 * - Localisation
 */
export function generateCompanyLicense(input: LicenseGenerationCompanyInput): {
  licenseKey: string;
  company: ServiceCompany;
} {
  const cleanName = input.name.trim();
  const cleanManager = input.manager_name.trim();
  const cleanPhone = input.phone.trim();
  const cleanLocation = input.location.trim();

  // Slug pour le segment lisible
  const locSlug = (cleanLocation.replace(/[^a-zA-Z]/g, '').substring(0, 4) || 'PORT').toUpperCase().padEnd(4, 'X');
  
  // Hash des données source
  const rawData = `${cleanName.toLowerCase()}|${cleanManager.toLowerCase()}|${cleanPhone}|${cleanLocation.toLowerCase()}`;
  const coreHash = hashString(rawData).substring(0, 6);
  const checksum = generateChecksum('CP-SOC', `${locSlug}-${coreHash}`);

  const licenseKey = `CP-SOC-${locSlug}-${coreHash}-${checksum}`;

  const company: ServiceCompany = {
    id: `soc-${coreHash.toLowerCase()}`,
    name: cleanName,
    manager_name: cleanManager,
    phone: cleanPhone,
    location: cleanLocation,
    license_key: licenseKey,
    created_at: new Date().toISOString()
  };

  saveRegisteredLicense('societe', licenseKey, company);
  return { licenseKey, company };
}

/**
 * Générateur Médecin
 * Clé générée à partir de :
 * - Nom/Prénom du médecin
 * - Numéro d'Ordre
 * - Lieu d'exercice
 */
export function generateDoctorLicense(input: LicenseGenerationDoctorInput): {
  licenseKey: string;
  doctor: Doctor;
} {
  const cleanName = input.full_name.trim();
  const cleanOrder = input.order_number.trim().replace(/[^a-zA-Z0-9]/g, '');
  const cleanLocation = input.practice_location.trim();

  const orderSlug = cleanOrder.substring(0, 5).toUpperCase().padEnd(5, '0');
  const rawData = `${cleanName.toLowerCase()}|${cleanOrder}|${cleanLocation.toLowerCase()}`;
  const coreHash = hashString(rawData).substring(0, 6);
  const checksum = generateChecksum('CP-MED', `${orderSlug}-${coreHash}`);

  const licenseKey = `CP-MED-${orderSlug}-${coreHash}-${checksum}`;

  const doctor: Doctor = {
    id: `med-${coreHash.toLowerCase()}`,
    full_name: cleanName,
    order_number: input.order_number.trim(),
    practice_location: cleanLocation,
    license_key: licenseKey,
    created_at: new Date().toISOString()
  };

  saveRegisteredLicense('medecin', licenseKey, doctor);
  return { licenseKey, doctor };
}

export const FICTIVE_LICENSE_KEYS = [
  'CP-MED-13987-A1B2C3-4E8F',
  'CP-MED-24552-D8E9F1-3A4B',
  'CP-MED-75104-C4B2A1-9F8E',
  'CP-SOC-MARS-D4E5F6-7A9B',
  'med-demo-1',
  'soc-demo-1'
];

export const FICTIVE_NAMES = [
  'Dr. Jean-Marc FERRARI',
  'Dr. Leila BEN SALAH',
  'Dr. Philippe TARDIEU',
  'TransMed Crewing Services',
  'Azur Crewing Agency'
];

/**
 * Sauvegarder les licences créées dans le registre local pour persistance
 */
const REGISTRY_STORAGE_KEY = 'cruisepocket_license_registry';
export const STORAGE_KEY_LICENSES = 'cruisepocket_registered_licenses';

export function getLicenseRegistry(): {
  doctors: Record<string, Doctor>;
  companies: Record<string, ServiceCompany>;
} {
  const doctors: Record<string, Doctor> = {};
  const companies: Record<string, ServiceCompany> = {};

  // 1. Lire le registre local interne (cruisepocket_license_registry)
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.doctors) {
        Object.entries(parsed.doctors).forEach(([k, doc]: [string, any]) => {
          const keyUpper = k.toUpperCase();
          if (!FICTIVE_LICENSE_KEYS.includes(keyUpper) && !FICTIVE_NAMES.includes(doc?.full_name)) {
            doctors[keyUpper] = doc;
          }
        });
      }
      if (parsed.companies) {
        Object.entries(parsed.companies).forEach(([k, comp]: [string, any]) => {
          const keyUpper = k.toUpperCase();
          if (!FICTIVE_LICENSE_KEYS.includes(keyUpper) && !FICTIVE_NAMES.includes(comp?.name)) {
            companies[keyUpper] = comp;
          }
        });
      }
    }
  } catch (e) {
    console.warn('Erreur lecture REGISTRY_STORAGE_KEY:', e);
  }

  // 2. Synchroniser avec le registre officiel du Keygen (cruisepocket_registered_licenses)
  try {
    const rawLicenses = localStorage.getItem(STORAGE_KEY_LICENSES);
    if (rawLicenses) {
      const list = JSON.parse(rawLicenses);
      if (Array.isArray(list)) {
        list.forEach((item: any) => {
          const keyUpper = item.key?.trim().toUpperCase();
          if (!keyUpper || FICTIVE_LICENSE_KEYS.includes(keyUpper) || FICTIVE_NAMES.includes(item.holderName)) {
            return;
          }

          const sig = verifyLicenseSignature(keyUpper);

          if (item.role === 'medecin') {
            const coreId = (sig.isValid && sig.hash)
              ? `med-${sig.hash.toLowerCase()}`
              : `med-${keyUpper.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

            doctors[keyUpper] = {
              id: coreId,
              full_name: item.holderName,
              order_number: item.detail1?.replace(/^Ordre:\s*/i, '').replace(/[^0-9/]/g, '') || item.detail1 || 'Certifié',
              practice_location: item.location || 'Cabinet Médical Maritime',
              license_key: item.key,
              created_at: item.createdAt || new Date().toISOString()
            };
          } else if (item.role === 'societe') {
            const coreId = (sig.isValid && sig.hash)
              ? `soc-${sig.hash.toLowerCase()}`
              : `soc-${keyUpper.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

            companies[keyUpper] = {
              id: coreId,
              name: item.holderName,
              manager_name: item.detail1?.replace(/^Resp:\s*/i, '') || 'Responsable',
              phone: item.detail2?.replace(/^Tél:\s*/i, '') || '',
              location: item.location || 'Port Maritime',
              license_key: item.key,
              created_at: item.createdAt || new Date().toISOString()
            };
          }
        });
      }
    }
  } catch (e) {
    console.warn('Erreur lecture STORAGE_KEY_LICENSES:', e);
  }

  return { doctors, companies };
}

export function saveRegisteredLicense(role: Role, key: string, data: Doctor | ServiceCompany) {
  const registry = getLicenseRegistry();
  const keyUpper = key.trim().toUpperCase();
  if (role === 'medecin') {
    registry.doctors[keyUpper] = data as Doctor;
  } else {
    registry.companies[keyUpper] = data as ServiceCompany;
  }
  try {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));

    // Mettre à jour également cruisepocket_registered_licenses pour compatibilité totale avec le Keygen
    const rawList = localStorage.getItem(STORAGE_KEY_LICENSES);
    const list: any[] = rawList ? JSON.parse(rawList) : [];
    const existingIdx = list.findIndex((item: any) => item.key?.toUpperCase() === keyUpper);
    const newEntry = {
      key: keyUpper,
      role,
      holderName: role === 'medecin' ? (data as Doctor).full_name : (data as ServiceCompany).name,
      detail1: role === 'medecin' ? (data as Doctor).order_number : (data as ServiceCompany).manager_name,
      detail2: role === 'medecin' ? 'Devise: DT' : (data as ServiceCompany).phone,
      location: role === 'medecin' ? (data as Doctor).practice_location : (data as ServiceCompany).location,
      createdAt: data.created_at || new Date().toISOString(),
      status: 'active'
    };

    if (existingIdx >= 0) {
      list[existingIdx] = newEntry;
    } else {
      list.unshift(newEntry);
    }
    localStorage.setItem(STORAGE_KEY_LICENSES, JSON.stringify(list));

    // Diffuser immédiatement en temps réel multi-onglets et événements locaux
    if (typeof window !== 'undefined') {
      try {
        const bc = new BroadcastChannel('cruisepocket_sync_channel');
        bc.postMessage({
          type: 'LICENSE_REGISTERED',
          role,
          key: keyUpper,
          profile: data
        });
      } catch {}
      window.dispatchEvent(new CustomEvent('cruisepocket_license_update', {
        detail: { role, key: keyUpper, profile: data }
      }));
    }
  } catch (e) {
    console.error('Erreur sauvegarde registre:', e);
  }
}

/**
 * Vérifie mathématiquement la signature cryptographique d'une clé produite par le Keygen
 */
export function verifyLicenseSignature(key: string): {
  isValid: boolean;
  role: Role | null;
  slug?: string;
  hash?: string;
  checksum?: string;
  error?: string;
} {
  const trimmed = key.trim().toUpperCase();
  const parts = trimmed.split('-');

  // Format standard généré par le Keygen : CP-MED-XXXXX-XXXXXX-XXXX (5 segments) ou CP-SOC-XXXX-XXXXXX-XXXX
  if (parts.length >= 5 && parts[0] === 'CP') {
    const rolePrefix = `${parts[0]}-${parts[1]}`; // 'CP-MED' ou 'CP-SOC'
    const detectedRole: Role | null = parts[1] === 'MED' ? 'medecin' : parts[1] === 'SOC' ? 'societe' : null;

    if (!detectedRole) {
      return { isValid: false, role: null, error: 'Type de licence non reconnu.' };
    }

    const slug = parts[2];
    const coreHash = parts[3];
    const providedChecksum = parts[4];
    const expectedChecksum = generateChecksum(rolePrefix, `${slug}-${coreHash}`);

    if (expectedChecksum === providedChecksum) {
      return { isValid: true, role: detectedRole, slug, hash: coreHash, checksum: providedChecksum };
    } else {
      return { isValid: false, role: detectedRole, error: 'Signature de licence invalide ou clé altérée.' };
    }
  }

  return { isValid: false, role: null, error: 'Format de licence incomplet.' };
}

/**
 * Importation en masse de licences depuis un export JSON du Keygen
 */
export function importLicensesFromJSON(jsonString: string): { count: number; error?: string } {
  try {
    const data = JSON.parse(jsonString);
    const list = Array.isArray(data) ? data : (data.licenses || []);
    if (!Array.isArray(list) || list.length === 0) {
      return { count: 0, error: 'Aucune licence trouvée dans le fichier.' };
    }

    let count = 0;
    list.forEach((item: any) => {
      const keyUpper = item.key?.trim().toUpperCase();
      if (!keyUpper || FICTIVE_LICENSE_KEYS.includes(keyUpper) || FICTIVE_NAMES.includes(item.holderName)) {
        return;
      }

      const sig = verifyLicenseSignature(keyUpper);
      if (!sig.isValid || !sig.role) return;

      if (sig.role === 'medecin') {
        const doc: Doctor = {
          id: `med-${sig.hash?.toLowerCase() || Math.random().toString(36).slice(2, 8)}`,
          full_name: item.holderName || `Dr. Médecin (${sig.slug})`,
          order_number: item.detail1?.replace(/^Ordre:\s*/i, '') || sig.slug || 'Agréé',
          practice_location: item.location || 'Cabinet Médical Agréé',
          license_key: keyUpper,
          created_at: item.createdAt || new Date().toISOString()
        };
        saveRegisteredLicense('medecin', keyUpper, doc);
        count++;
      } else {
        const comp: ServiceCompany = {
          id: `soc-${sig.hash?.toLowerCase() || Math.random().toString(36).slice(2, 8)}`,
          name: item.holderName || `Société Maritime (${sig.slug})`,
          manager_name: item.detail1?.replace(/^Resp:\s*/i, '') || 'Responsable Opérations',
          phone: item.detail2?.replace(/^Tél:\s*/i, '') || '',
          location: item.location || sig.slug || 'Port Maritime',
          license_key: keyUpper,
          created_at: item.createdAt || new Date().toISOString()
        };
        saveRegisteredLicense('societe', keyUpper, comp);
        count++;
      }
    });

    return { count };
  } catch (e: any) {
    return { count: 0, error: e.message || 'Format JSON invalide.' };
  }
}

/**
 * Capture et synchronise automatiquement une licence transmise par paramètre d'URL
 */
export function checkAndImportURLParams(): { imported: boolean; key?: string; role?: Role; profile?: Doctor | ServiceCompany } {
  if (typeof window === 'undefined') return { imported: false };
  try {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('license') || params.get('import_license') || params.get('key');
    if (!key) return { imported: false };

    const keyUpper = key.trim().toUpperCase();
    const sig = verifyLicenseSignature(keyUpper);
    if (!sig.isValid || !sig.role) return { imported: false };

    const role = sig.role;
    const name = params.get('name') || params.get('holderName') || '';
    const detail1 = params.get('detail1') || params.get('order') || params.get('manager') || '';
    const detail2 = params.get('detail2') || params.get('phone') || '';
    const location = params.get('location') || sig.slug || '';

    let profile: Doctor | ServiceCompany;

    if (role === 'medecin') {
      profile = {
        id: `med-${sig.hash?.toLowerCase() || 'usr'}`,
        full_name: name || `Dr. Médecin Agréé (${sig.slug})`,
        order_number: detail1 || sig.slug || 'Agréé',
        practice_location: location || 'Cabinet Médical Agréé',
        license_key: keyUpper,
        created_at: new Date().toISOString()
      };
      saveRegisteredLicense('medecin', keyUpper, profile);
    } else {
      profile = {
        id: `soc-${sig.hash?.toLowerCase() || 'usr'}`,
        name: name || `Société Maritime (${sig.slug})`,
        manager_name: detail1 || 'Responsable Opérations',
        phone: detail2 || '',
        location: location || sig.slug || 'Port Maritime',
        license_key: keyUpper,
        created_at: new Date().toISOString()
      };
      saveRegisteredLicense('societe', keyUpper, profile);
    }

    // Nettoyer les paramètres de l'URL pour une expérience propre
    try {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    } catch {}

    return { imported: true, key: keyUpper, role, profile };
  } catch {
    return { imported: false };
  }
}

export const REVOKED_LICENSES_KEY = 'cruisepocket_revoked_licenses';

/**
 * Vérifier si une clé de licence a été révoquée par l'administrateur
 */
export function isLicenseRevoked(key: string): boolean {
  try {
    const raw = localStorage.getItem(REVOKED_LICENSES_KEY);
    if (!raw) return false;
    const list = JSON.parse(raw);
    if (Array.isArray(list)) {
      return list.includes(key.trim().toUpperCase());
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Révoquer une clé de licence
 */
export function revokeLicense(key: string): void {
  try {
    const trimmed = key.trim().toUpperCase();
    const raw = localStorage.getItem(REVOKED_LICENSES_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(trimmed)) {
      list.push(trimmed);
      localStorage.setItem(REVOKED_LICENSES_KEY, JSON.stringify(list));

      if (typeof window !== 'undefined') {
        try {
          const bc = new BroadcastChannel('cruisepocket_sync_channel');
          bc.postMessage({ type: 'LICENSE_REVOKED', key: trimmed });
        } catch {}
        window.dispatchEvent(new CustomEvent('cruisepocket_license_update', { detail: { key: trimmed, status: 'revoked' } }));
      }
    }
  } catch (e) {
    console.error('Erreur révocation licence:', e);
  }
}

/**
 * Rétablir / annuler la révocation d'une licence
 */
export function unrevokeLicense(key: string): void {
  try {
    const trimmed = key.trim().toUpperCase();
    const raw = localStorage.getItem(REVOKED_LICENSES_KEY);
    if (!raw) return;
    const list: string[] = JSON.parse(raw);
    const updated = list.filter(k => k !== trimmed);
    localStorage.setItem(REVOKED_LICENSES_KEY, JSON.stringify(updated));

    if (typeof window !== 'undefined') {
      try {
        const bc = new BroadcastChannel('cruisepocket_sync_channel');
        bc.postMessage({ type: 'LICENSES_UPDATED', key: trimmed });
      } catch {}
      window.dispatchEvent(new CustomEvent('cruisepocket_license_update', { detail: { key: trimmed, status: 'restored' } }));
    }
  } catch (e) {
    console.error('Erreur rétablissement licence:', e);
  }
}

/**
 * Valider une clé de licence et identifier son rôle
 */
export function validateLicense(key: string, expectedRole?: Role): {
  isValid: boolean;
  role: Role | null;
  error?: string;
  profile?: Doctor | ServiceCompany;
} {
  const trimmed = key.trim().toUpperCase();

  if (!trimmed) {
    return { isValid: false, role: null, error: 'Veuillez saisir votre clé de licence.' };
  }

  // Contrôle de licence fictive révoquée / supprimée
  if (FICTIVE_LICENSE_KEYS.includes(trimmed)) {
    return {
      isValid: false,
      role: null,
      error: 'Cette licence fictive de démonstration a été supprimée. Veuillez utiliser votre licence officielle enregistrée.'
    };
  }

  // Contrôle de révocation administrative
  if (isLicenseRevoked(trimmed)) {
    return {
      isValid: false,
      role: null,
      error: 'Cette clé de licence a été RÉVOQUÉE par l\'administrateur. L\'accès à CruisePocket est désactivé.'
    };
  }

  // 1. Contrôle de conformité et de signature cryptographique issue du Keygen
  const sig = verifyLicenseSignature(trimmed);
  if (!sig.isValid || !sig.role) {
    return {
      isValid: false,
      role: null,
      error: sig.error || 'Format de clé invalide ou signature altérée. Veuillez vérifier votre clé.'
    };
  }

  const detectedRole = sig.role;

  if (expectedRole && detectedRole !== expectedRole) {
    return {
      isValid: false,
      role: detectedRole,
      error: expectedRole === 'medecin' 
        ? 'Cette clé appartient à une Société de Service. Choisissez le profil Société.' 
        : 'Cette clé appartient à un Médecin. Choisissez le profil Médecin.'
    };
  }

  // 2. Rechercher dans le registre des licences locales
  const registry = getLicenseRegistry();
  let profile = detectedRole === 'medecin' 
    ? registry.doctors[trimmed] 
    : registry.companies[trimmed];

  // 3. Synchronisation automatique :
  // Si la clé possède une signature mathématique valide issue du Keygen mais n'est pas encore présente
  // dans le stockage local de ce domaine (ex: générée sur le bureau ou exportée), on l'enregistre formellement !
  if (!profile) {
    if (detectedRole === 'medecin') {
      profile = {
        id: `med-${sig.hash?.toLowerCase() || 'usr'}`,
        full_name: `Dr. Médecin Agréé (${sig.slug})`,
        order_number: sig.slug || 'Agréé',
        practice_location: 'Cabinet Médical Agréé',
        license_key: trimmed,
        created_at: new Date().toISOString()
      } as Doctor;
      saveRegisteredLicense('medecin', trimmed, profile);
    } else {
      profile = {
        id: `soc-${sig.hash?.toLowerCase() || 'usr'}`,
        name: `Société de Service Maritime (${sig.slug})`,
        manager_name: 'Responsable Opérations',
        phone: '',
        location: sig.slug || 'Port Maritime',
        license_key: trimmed,
        created_at: new Date().toISOString()
      } as ServiceCompany;
      saveRegisteredLicense('societe', trimmed, profile);
    }
  }

  const profileName = detectedRole === 'medecin' ? (profile as Doctor).full_name : (profile as ServiceCompany).name;
  if (FICTIVE_NAMES.includes(profileName)) {
    return {
      isValid: false,
      role: detectedRole,
      error: 'Ce compte fictif a été supprimé. Veuillez utiliser un compte officiel enregistré.'
    };
  }

  return {
    isValid: true,
    role: detectedRole,
    profile
  };
}

/**
 * Détermine avec certitude si un dossier candidat est assigné au médecin connecté.
 * Vérifie de façon multi-critères : clé de licence, ID médecin, hash cryptographique,
 * nom complet normalisé (insensible à la casse, espaces et préfixe Dr.) et n° d'ordre.
 */
export function isCandidateAssignedToDoctor(candidate: Candidate, doctor: Doctor | null): boolean {
  if (!doctor) return false;

  // 1. Clé de licence exacte (la plus robuste et univoque)
  if (candidate.doctor_license_key && doctor.license_key) {
    if (candidate.doctor_license_key.trim().toUpperCase() === doctor.license_key.trim().toUpperCase()) {
      return true;
    }
  }

  // 2. ID exact
  if (candidate.doctor_id && doctor.id) {
    if (candidate.doctor_id === doctor.id) return true;
  }

  // 3. Correspondance de hash (segment cryptographique central)
  const docHash = doctor.license_key ? doctor.license_key.split('-')[3]?.toLowerCase() : null;
  if (docHash) {
    if (candidate.doctor_id && candidate.doctor_id.toLowerCase().includes(docHash)) {
      return true;
    }
    if (candidate.doctor_license_key && candidate.doctor_license_key.toLowerCase().includes(docHash)) {
      return true;
    }
  }

  // 4. Correspondance souple de nom
  if (candidate.doctor_name && doctor.full_name) {
    const cleanCandName = candidate.doctor_name.toLowerCase().replace(/^dr\.?\s*/i, '').trim();
    const cleanDocName = doctor.full_name.toLowerCase().replace(/^dr\.?\s*/i, '').trim();
    if (cleanCandName === cleanDocName) return true;
    if (cleanCandName.length >= 3 && cleanDocName.length >= 3) {
      if (cleanCandName.includes(cleanDocName) || cleanDocName.includes(cleanCandName)) {
        return true;
      }
    }
  }

  // 5. Numéro d'Ordre
  if (doctor.order_number && doctor.order_number.length >= 3) {
    const cleanOrder = doctor.order_number.replace(/[^0-9]/g, '');
    if (cleanOrder.length >= 3) {
      if (candidate.doctor_name?.includes(cleanOrder) || candidate.doctor_id?.includes(cleanOrder)) {
        return true;
      }
    }
  }

  // Si aucun médecin spécifique n'a été assigné lors de la création, le dossier est partagé
  if (!candidate.doctor_id && !candidate.doctor_name && !candidate.doctor_license_key) {
    return true;
  }

  return false;
}
