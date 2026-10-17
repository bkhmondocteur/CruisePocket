import React, { createContext, useContext, useState, useEffect } from 'react';
import { Role, Doctor, ServiceCompany } from '../types';
import { validateLicense } from '../utils/license';

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
              setCompanyProfile((validation.profile as ServiceCompany) || session.companyProfile || null);
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
