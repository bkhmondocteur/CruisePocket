import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Role } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import { 
  getLicenseRegistry, 
  isLicenseRevoked, 
  checkAndImportURLParams, 
  importLicensesFromJSON 
} from '../../utils/license';
import { 
  Stethoscope, 
  Building2, 
  KeyRound, 
  ArrowRight, 
  ChevronLeft, 
  ShieldCheck, 
  Info,
  Upload,
  ExternalLink,
  CheckCircle2
} from 'lucide-react';

export const HomePortal: React.FC = () => {
  const { targetRole, setTargetRole, loginWithLicense } = useAuth();
  const { t } = useI18n();
  
  // Login State
  const [inputLicense, setInputLicense] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [registryTick, setRegistryTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronisation automatique par URL si ouvert depuis le Keygen & écoute en direct
  useEffect(() => {
    const res = checkAndImportURLParams();
    if (res.imported && res.key && res.role) {
      setTargetRole(res.role);
      setInputLicense(res.key);
      const loginRes = loginWithLicense(res.key, res.role);
      if (loginRes.success) {
        setImportNotice(`✓ Licence synchronisée automatiquement : ${res.key}`);
      } else {
        setLoginError(loginRes.error || null);
      }
    }

    const refreshRegistry = () => {
      setRegistryTick(t => t + 1);
    };

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === 'cruisepocket_registered_licenses' ||
        e.key === 'cruisepocket_license_registry' ||
        e.key === 'cruisepocket_revoked_licenses'
      ) {
        refreshRegistry();
      }
    };

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('cruisepocket_sync_channel');
        bc.addEventListener('message', refreshRegistry);
      }
    } catch {}

    window.addEventListener('storage', handleStorage);
    window.addEventListener('cruisepocket_license_update', refreshRegistry);
    window.addEventListener('focus', refreshRegistry);
    document.addEventListener('visibilitychange', refreshRegistry);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('cruisepocket_license_update', refreshRegistry);
      window.removeEventListener('focus', refreshRegistry);
      document.removeEventListener('visibilitychange', refreshRegistry);
      bc?.removeEventListener('message', refreshRegistry);
      bc?.close();
    };
  }, []);

  const handleSelectRole = (role: Role) => {
    setTargetRole(role);
    setLoginError(null);
    setInputLicense('');
  };

  const handleBackToSelection = () => {
    setTargetRole(null);
    setLoginError(null);
    setInputLicense('');
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRole) return;

    setLoginError(null);
    const result = loginWithLicense(inputLicense, targetRole);
    if (!result.success) {
      setLoginError(result.error || 'Clé de licence invalide');
    }
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importLicensesFromJSON(content);
      if (res.error) {
        setImportNotice(`Erreur : ${res.error}`);
      } else {
        setImportNotice(`✓ ${res.count} licence(s) synchronisée(s) avec succès !`);
        setRegistryTick(t => t + 1);
        setTimeout(() => setImportNotice(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Comptes formellement enregistrés et actifs pour le profil ciblé
  const registeredAccounts = useMemo(() => {
    const registry = getLicenseRegistry();
    return targetRole === 'medecin'
      ? Object.values(registry.doctors).filter(d => !isLicenseRevoked(d.license_key))
      : Object.values(registry.companies).filter(c => !isLicenseRevoked(c.license_key));
  }, [targetRole, registryTick]);

  // ============================================================================
  // VUE 1 : ÉCRAN INITIAL DE SÉLECTION DU PROFIL
  // ============================================================================
  if (!targetRole) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 sm:py-12 max-w-4xl mx-auto w-full animate-fadeIn">
        <input
          type="file"
          ref={fileInputRef}
          accept=".json"
          onChange={handleImportJsonFile}
          className="hidden"
        />

        {importNotice && (
          <div className="w-full max-w-md mb-6 p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs flex items-center justify-center gap-2 animate-fadeIn shadow-lg">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{importNotice}</span>
          </div>
        )}
        
        {/* Logo Officiel CruisePocket */}
        <div className="flex flex-col items-center text-center max-w-2xl mx-auto mb-10">
          <div className="relative group cursor-pointer mb-6">
            <img 
              src={`${import.meta.env.BASE_URL}logo.png`} 
              alt="CruisePocket Official Logo" 
              className="w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-2xl transition-transform transform group-hover:scale-105 duration-300 mx-auto"
            />
          </div>
          
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            {t('home.welcome')}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-maritime-400 via-cyan-300 to-emerald-400">CruisePocket</span>
          </h2>
          
          <p className="text-slate-400 text-xs sm:text-base leading-relaxed max-w-lg">
            {t('home.subtitle')}
          </p>
        </div>

        {/* 2 Choix Principaux : Médecin / Société de Service */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 w-full max-w-3xl">
          
          {/* CARTE MÉDECIN */}
          <div
            onClick={() => handleSelectRole('medecin')}
            className="group relative cursor-pointer rounded-2xl sm:rounded-3xl glass-card-interactive p-5 sm:p-8 flex flex-col justify-between border-2 border-transparent hover:border-emerald-500/40 shadow-xl overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none"></div>

            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/25 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Stethoscope className="w-7 h-7 text-emerald-400 group-hover:scale-110 transition-transform" />
                </div>
              </div>

              <div>
                <span className="inline-block text-[11px] font-bold tracking-wider uppercase text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2.5 py-0.5 rounded-full mb-2">
                  {t('home.doctorBadge')}
                </span>
                <h3 className="text-2xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                  {t('home.doctorTitle')}
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                  {t('home.doctorDesc')}
                </p>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-emerald-400 font-semibold text-sm group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform">
              <span>{t('home.doctorAction')}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </div>
          </div>

          {/* CARTE SOCIÉTÉ DE SERVICE */}
          <div
            onClick={() => handleSelectRole('societe')}
            className="group relative cursor-pointer rounded-2xl sm:rounded-3xl glass-card-interactive p-5 sm:p-8 flex flex-col justify-between border-2 border-transparent hover:border-maritime-500/40 shadow-xl overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-maritime-500/10 rounded-full blur-2xl group-hover:bg-maritime-500/20 transition-all pointer-events-none"></div>

            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-maritime-600 to-cyan-400 p-0.5 shadow-lg shadow-maritime-500/25 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Building2 className="w-7 h-7 text-cyan-400 group-hover:scale-110 transition-transform" />
                </div>
              </div>

              <div>
                <span className="inline-block text-[11px] font-bold tracking-wider uppercase text-cyan-400 bg-maritime-950/70 border border-maritime-800/60 px-2.5 py-0.5 rounded-full mb-2">
                  {t('home.companyBadge')}
                </span>
                <h3 className="text-2xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {t('home.companyTitle')}
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                  {t('home.companyDesc')}
                </p>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-cyan-400 font-semibold text-sm group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform">
              <span>{t('home.companyAction')}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </div>
          </div>

        </div>

        {/* Barre d'outils Keygen & Synchronisation */}
        <div className="mt-8 flex items-center justify-center gap-4 text-xs text-slate-400 flex-wrap">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="hover:text-cyan-400 flex items-center gap-1.5 transition-colors cursor-pointer bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t('home.syncJson')}</span>
          </button>
          <a
            href="./keygen.html"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-emerald-400 flex items-center gap-1.5 transition-colors bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800"
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('home.keygenLink')}</span>
            <ExternalLink className="w-3 h-3 text-slate-500 rtl:rotate-180" />
          </a>
        </div>

        {/* Note de sécurité */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{t('home.securityNote')}</span>
        </div>

      </div>
    );
  }

  // ============================================================================
  // VUE 2 : CONNEXION PAR CLÉ DE LICENCE
  // ============================================================================
  const isMed = targetRole === 'medecin';
  const roleTitle = isMed ? t('home.doctorRoleTitle') : t('home.companyRoleTitle');

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 max-w-md mx-auto w-full animate-fadeIn">
      
      {/* Bouton Retour */}
      <div className="w-full mb-6">
        <button
          onClick={handleBackToSelection}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          <span>{t('home.backToRoles')}</span>
        </button>
      </div>

      {/* Input de fichier caché pour importer le JSON du Keygen */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={handleImportJsonFile}
        className="hidden"
      />

      {/* Notification de synchronisation */}
      {importNotice && (
        <div className="w-full mb-4 p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn shadow-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{importNotice}</span>
        </div>
      )}

      {/* Boîte Principale de Connexion */}
      <div className="w-full glass-panel rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-slate-800 shadow-2xl relative space-y-6">
        
        {/* Logo & Titre */}
        <div className="text-center pb-4 border-b border-slate-800">
          <img 
            src={`${import.meta.env.BASE_URL}logo.png`} 
            alt="CruisePocket Logo" 
            className="w-20 h-20 object-contain mx-auto drop-shadow-lg mb-3"
          />
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
              {isMed ? t('home.loginMedical') : t('home.loginCompany')}
            </span>
            <h2 className="text-xl font-bold text-white mt-0.5">{roleTitle}</h2>
          </div>
        </div>

        {/* Formulaire de Connexion */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              {t('home.licenseLabel')} ({isMed ? t('header.doctor') : t('header.company')}) :
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputLicense}
                onChange={(e) => {
                  setInputLicense(e.target.value.toUpperCase());
                  setLoginError(null);
                }}
                placeholder={isMed ? t('home.licensePlaceholderMed') : t('home.licensePlaceholderSoc')}
                className="w-full bg-slate-950/90 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono tracking-wider text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 uppercase"
                required
                autoFocus
              />
              <KeyRound className="absolute right-3.5 rtl:right-auto rtl:left-3.5 top-3.5 w-4 h-4 text-slate-500" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
              <Info className="w-3 h-3 text-slate-400 shrink-0" />
              <span>Format : {isMed ? 'CP-MED-XXXXX-...' : 'CP-SOC-XXXX-...'}</span>
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
              {loginError}
            </div>
          )}

          <button
            type="submit"
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isMed 
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/20' 
                : 'bg-gradient-to-r from-maritime-600 to-cyan-600 hover:from-maritime-500 hover:to-cyan-500 shadow-cyan-600/20'
            }`}
          >
            <span>{t('home.loginButton')}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </button>

          {/* Section Comptes Enregistrés */}
          <div className="pt-4 border-t border-slate-800/80">
            {registeredAccounts.length > 0 ? (
              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-slate-400 block">
                  {isMed ? t('header.doctor') : t('header.company')} ({registeredAccounts.length}) :
                </label>
                <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1 rtl:pr-0 rtl:pl-1">
                  {registeredAccounts.map((acc: any) => (
                    <button
                      key={acc.license_key}
                      type="button"
                      onClick={() => {
                        setInputLicense(acc.license_key);
                        loginWithLicense(acc.license_key, targetRole);
                      }}
                      className="w-full text-left rtl:text-right p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-200 flex items-center justify-between transition-colors group cursor-pointer"
                    >
                      <div className="truncate pr-2 rtl:pr-0 rtl:pl-2">
                        <div className="font-semibold text-white truncate">
                          {'full_name' in acc ? acc.full_name : acc.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {'practice_location' in acc ? acc.practice_location : acc.location}
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-cyan-400 bg-cyan-950/60 px-2 py-1 rounded border border-cyan-800 group-hover:border-cyan-500">
                        {t('home.doctorAction')} &rarr;
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 text-[11px] leading-relaxed text-center space-y-1">
                <p className="text-white font-medium">💡 Keygen</p>
                <p>{t('home.securityNote')}</p>
              </div>
            )}
          </div>

          {/* Outils de Synchronisation Keygen */}
          <div className="pt-3 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-400">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="hover:text-cyan-400 flex items-center gap-1 transition-colors cursor-pointer"
              title={t('home.syncJson')}
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>{t('home.syncJson')}</span>
            </button>

            <a
              href="./keygen.html"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-400 flex items-center gap-1 transition-colors"
              title={t('home.keygenLink')}
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('home.keygenLink')}</span>
              <ExternalLink className="w-3 h-3 text-slate-500 rtl:rotate-180" />
            </a>
          </div>

        </form>

      </div>
    </div>
  );
};
