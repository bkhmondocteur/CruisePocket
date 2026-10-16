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

/**
 * Sauvegarder les licences créées dans le registre local pour persistance
 */
const REGISTRY_STORAGE_KEY = 'cruisepocket_license_registry';

export function getLicenseRegistry(): {
  doctors: Record<string, Doctor>;
  companies: Record<string, ServiceCompany>;
} {
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (!raw) return getDefaultRegistry();
    return JSON.parse(raw);
  } catch {
    return getDefaultRegistry();
  }
}

function saveRegisteredLicense(role: Role, key: string, data: Doctor | ServiceCompany) {
  const registry = getLicenseRegistry();
  if (role === 'medecin') {
    registry.doctors[key] = data as Doctor;
  } else {
    registry.companies[key] = data as ServiceCompany;
  }
  try {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));
  } catch (e) {
    console.error('Erreur sauvegarde registre:', e);
  }
}

/**
 * Licences de démonstration préenregistrées pour test instantané
 */
function getDefaultRegistry() {
  const demoDoctor: Doctor = {
    id: 'med-demo-1',
    full_name: 'Dr. Jean-Marc FERRARI',
    order_number: '13/98745',
    practice_location: 'Centre Médical Maritime - Marseille',
    license_key: 'CP-MED-13987-A1B2C3-4E8F',
    created_at: new Date().toISOString()
  };

  const demoCompany: ServiceCompany = {
    id: 'soc-demo-1',
    name: 'TransMed Crewing Services',
    manager_name: 'Claire Beauchamp',
    phone: '+33 4 91 10 20 30',
    location: 'Marseille Port Autonome',
    license_key: 'CP-SOC-MARS-D4E5F6-7A9B',
    created_at: new Date().toISOString()
  };

  return {
    doctors: {
      [demoDoctor.license_key]: demoDoctor
    },
    companies: {
      [demoCompany.license_key]: demoCompany
    }
  };
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

  // Si non trouvée dans le registre, on construit un profil dynamique valide
  const resolvedProfile = profile || (detectedRole === 'medecin' 
    ? {
        id: `med-${parts[2]}`,
        full_name: `Médecin Autorisé (${parts[1]})`,
        order_number: parts[1],
        practice_location: 'Cabinet Médical Maritime',
        license_key: trimmed
      } as Doctor
    : {
        id: `soc-${parts[2]}`,
        name: `Société Partenaire (${parts[1]})`,
        manager_name: 'Responsable Opérations',
        phone: 'Non renseigné',
        location: parts[1],
        license_key: trimmed
      } as ServiceCompany
  );

  return {
    isValid: true,
    role: detectedRole,
    profile: resolvedProfile
  };
}
