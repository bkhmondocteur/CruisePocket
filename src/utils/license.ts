import { 
  LicenseGenerationCompanyInput, 
  LicenseGenerationDoctorInput, 
  Role, 
  ServiceCompany, 
  Doctor 
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

          if (item.role === 'medecin') {
            doctors[keyUpper] = {
              id: `med-${keyUpper.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
              full_name: item.holderName,
              order_number: item.detail1?.replace(/^Ordre:\s*/i, '').replace(/[^0-9/]/g, '') || item.detail1 || 'Certifié',
              practice_location: item.location || 'Cabinet Médical Maritime',
              license_key: item.key,
              created_at: item.createdAt || new Date().toISOString()
            };
          } else if (item.role === 'societe') {
            companies[keyUpper] = {
              id: `soc-${keyUpper.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
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

function saveRegisteredLicense(role: Role, key: string, data: Doctor | ServiceCompany) {
  const registry = getLicenseRegistry();
  const keyUpper = key.trim().toUpperCase();
  if (role === 'medecin') {
    registry.doctors[keyUpper] = data as Doctor;
  } else {
    registry.companies[keyUpper] = data as ServiceCompany;
  }
  try {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));
  } catch (e) {
    console.error('Erreur sauvegarde registre:', e);
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

  const isDoctor = trimmed.startsWith('CP-MED-');
  const isCompany = trimmed.startsWith('CP-SOC-');

  if (!isDoctor && !isCompany) {
    return { 
      isValid: false, 
      role: null, 
      error: 'Format de clé invalide. La clé doit débuter par CP-MED- ou CP-SOC-.' 
    };
  }

  const detectedRole: Role = isDoctor ? 'medecin' : 'societe';

  // Contrôle de licence fictive révoquée / supprimée
  if (FICTIVE_LICENSE_KEYS.includes(trimmed)) {
    return {
      isValid: false,
      role: detectedRole,
      error: 'Cette licence fictive de démonstration a été supprimée. Veuillez utiliser votre licence officielle enregistrée.'
    };
  }

  // Contrôle de révocation administrative
  if (isLicenseRevoked(trimmed)) {
    return {
      isValid: false,
      role: detectedRole,
      error: 'Cette clé de licence a été RÉVOQUÉE par l\'administrateur. L\'accès à CruisePocket est désactivé.'
    };
  }

  if (expectedRole && detectedRole !== expectedRole) {
    return {
      isValid: false,
      role: detectedRole,
      error: expectedRole === 'medecin' 
        ? 'Cette clé appartient à une Société de Service. Choisissez le profil Société.' 
        : 'Cette clé appartient à un Médecin. Choisissez le profil Médecin.'
    };
  }

  // Vérifier la conformité de la structure en 4 parties
  const parts = trimmed.split('-');
  if (parts.length < 4) {
    return { isValid: false, role: detectedRole, error: 'Structure de licence incomplète.' };
  }

  // Rechercher dans le registre des licences locales
  const registry = getLicenseRegistry();
  const profile = detectedRole === 'medecin' 
    ? registry.doctors[trimmed] 
    : registry.companies[trimmed];

  // Règle formelle : Ne garder que les licences et profils déjà enregistrés
  if (!profile) {
    return {
      isValid: false,
      role: detectedRole,
      error: `Cette clé n'est pas encore enregistrée. Veuillez générer et enregistrer votre licence dans le Keygen CruisePocket.`
    };
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
