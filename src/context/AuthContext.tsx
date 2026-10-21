import React, { createContext, useContext, useState, useEffect } from 'react';
import { Role, Doctor, ServiceCompany } from '../types';
import { validateLicense } from '../utils/license';
import { firebaseSyncService } from '../lib/firebase';

interface AuthSession {
  role: Role;
  licenseKey: string;
  doctorProfile?: Doctor;
  companyProfile?: ServiceCompany;
}

interface AuthContextType {
  role: Role | null;
  licenseKey: string | null;
  doctorProfile: Doctor | null;
  companyProfile: ServiceCompany | null;
  isAuthenticated: boolean;
  loginWithLicense: (key: string, expectedRole?: Role) => { success: boolean; error?: string };
  updateCompanyLogo: (logoUrl: string | null) => Promise<void>;
  logout: () => void;
  selectRole: (role: Role) => void;
  targetRole: Role | null;
  setTargetRole: (role: Role | null) => void;
}

const AUTH_STORAGE_KEY = 'cruisepocket_session_v1';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<Role | null>(null);
  const [targetRole, setTargetRole] = useState<Role | null>(null);
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [doctorProfile, setDoctorProfile] = useState<Doctor | null>(null);
  const [companyProfile, setCompanyProfile] = useState<ServiceCompany | null>(null);
  const [loading, setLoading] = useState(true);

  // Restaurer la session à l'ouverture (Persistance PWA avec isolation multi-onglets)
  useEffect(() => {
    try {
      // 1. Priorité à la session de l'onglet courant (sessionStorage) pour permettre
      // de tester simultanément le profil Médecin et le profil Société dans deux onglets différents
      let saved = sessionStorage.getItem(AUTH_STORAGE_KEY);
      if (!saved) {
        // 2. Si l'onglet démarre vierge, repli sur localStorage (redémarrage PWA)
        saved = localStorage.getItem(AUTH_STORAGE_KEY);
      }

      if (saved) {
        const session: AuthSession = JSON.parse(saved);
        if (session.licenseKey && session.role) {
          const validation = validateLicense(session.licenseKey, session.role);
          if (validation.isValid) {
            setRole(session.role);
            setLicenseKey(session.licenseKey);
            if (session.role === 'medecin') {
              setDoctorProfile((validation.profile as Doctor) || session.doctorProfile || null);
            } else {
              const comp = (validation.profile as ServiceCompany) || session.companyProfile || null;
              if (comp) {
                const savedLogo = localStorage.getItem(`cruisepocket_company_logo_${comp.id}`) || comp.logo_url;
                if (savedLogo) {
                  comp.logo_url = savedLogo;
                }
              }
              setCompanyProfile(comp);
            }
            sessionStorage.setItem(AUTH_STORAGE_KEY, saved);
          }
        }
      }
    } catch (err) {
      console.warn('Session non restaurée:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithLicense = (key: string, expectedRole?: Role): { success: boolean; error?: string } => {
    const validation = validateLicense(key, expectedRole);
    if (!validation.isValid || !validation.role) {
      return { success: false, error: validation.error || 'Clé de licence invalide.' };
    }

    const assignedRole = validation.role;
    setRole(assignedRole);
    setLicenseKey(key.trim().toUpperCase());

    const session: AuthSession = {
      role: assignedRole,
      licenseKey: key.trim().toUpperCase()
    };

    if (assignedRole === 'medecin') {
      const doc = validation.profile as Doctor;
      setDoctorProfile(doc);
      setCompanyProfile(null);
      session.doctorProfile = doc;
    } else {
      const comp = validation.profile as ServiceCompany;
      const savedLogo = localStorage.getItem(`cruisepocket_company_logo_${comp.id}`) || comp.logo_url;
      if (savedLogo) {
        comp.logo_url = savedLogo;
      }
      setCompanyProfile(comp);
      setDoctorProfile(null);
      session.companyProfile = comp;
    }

    try {
      const serialized = JSON.stringify(session);
      sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
      localStorage.setItem(AUTH_STORAGE_KEY, serialized);
    } catch (err) {
      console.error('Erreur sauvegarde session:', err);
    }

    return { success: true };
  };

  const updateCompanyLogo = async (logoUrl: string | null): Promise<void> => {
    if (!companyProfile) return;

    const updatedCompany: ServiceCompany = {
      ...companyProfile,
      logo_url: logoUrl || undefined
    };

    setCompanyProfile(updatedCompany);

    // 1. Sauvegarde dédiée au logo dans localStorage pour persistance immédiate
    const logoStorageKey = `cruisepocket_company_logo_${companyProfile.id}`;
    if (logoUrl) {
      localStorage.setItem(logoStorageKey, logoUrl);
    } else {
      localStorage.removeItem(logoStorageKey);
    }

    // 2. Mettre à jour la session courante
    try {
      const saved = sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        const session: AuthSession = JSON.parse(saved);
        session.companyProfile = updatedCompany;
        const serialized = JSON.stringify(session);
        sessionStorage.setItem(AUTH_STORAGE_KEY, serialized);
        localStorage.setItem(AUTH_STORAGE_KEY, serialized);
      }
    } catch (e) {
      console.warn('Erreur mise à jour session:', e);
    }

    // 3. Mettre à jour le registre local des licences
    try {
      const rawReg = localStorage.getItem('cruisepocket_license_registry');
      if (rawReg) {
        const parsed = JSON.parse(rawReg);
        if (parsed.companies && companyProfile.license_key) {
          const keyUpper = companyProfile.license_key.toUpperCase();
          if (parsed.companies[keyUpper]) {
            parsed.companies[keyUpper].logo_url = logoUrl || undefined;
            localStorage.setItem('cruisepocket_license_registry', JSON.stringify(parsed));
          }
        }
      }

      const rawLicenses = localStorage.getItem('cruisepocket_registered_licenses');
      if (rawLicenses) {
        const list = JSON.parse(rawLicenses);
        if (Array.isArray(list)) {
          const idx = list.findIndex((item: any) => item.key?.toUpperCase() === companyProfile.license_key.toUpperCase());
          if (idx >= 0) {
            list[idx].logo_url = logoUrl || undefined;
            localStorage.setItem('cruisepocket_registered_licenses', JSON.stringify(list));
          }
        }
      }
    } catch (e) {
      console.warn('Erreur mise à jour registre:', e);
    }

    // 4. Synchronisation Cloud Firebase si en ligne
    try {
      if (companyProfile.license_key) {
        await firebaseSyncService.saveLicense({
          key: companyProfile.license_key,
          role: 'societe',
          holderName: companyProfile.name,
          detail1: companyProfile.manager_name,
          detail2: companyProfile.phone,
          location: companyProfile.location,
          profile: updatedCompany
        });
      }
    } catch (err) {
      console.warn('[Firebase] Synchronisation logo ignorée (mode hors-ligne):', err);
    }
  };

  const logout = () => {
    setRole(null);
    setLicenseKey(null);
    setDoctorProfile(null);
    setCompanyProfile(null);
    setTargetRole(null);
    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (err) {
      console.error(err);
    }
  };

  const selectRole = (r: Role) => {
    setTargetRole(r);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-10 h-10 border-4 border-maritime-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">Chargement de CruisePocket...</span>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        role,
        licenseKey,
        doctorProfile,
        companyProfile,
        isAuthenticated: Boolean(role && licenseKey),
        loginWithLicense,
        updateCompanyLogo,
        logout,
        selectRole,
        targetRole,
        setTargetRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
