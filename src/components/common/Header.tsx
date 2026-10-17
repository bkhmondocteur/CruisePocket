import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Stethoscope, 
  Building2, 
  LogOut, 
  Download, 
  Wifi, 
  WifiOff, 
  ShieldCheck,
  Database,
  RotateCw
} from 'lucide-react';
import { BackupModal } from './BackupModal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const Header: React.FC = () => {
  const { role, doctorProfile, companyProfile, logout } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert("Pour installer CruisePocket sur votre appareil mobile :\n- Sur iOS : appuyez sur 'Partager' puis 'Sur l'écran d'accueil'\n- Sur Android : ouvrez le menu puis 'Installer l'application'");
      return;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  // État d'actualisation / vidage de cache
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshAndClearCache = async () => {
    setIsRefreshing(true);
    try {
      // 1. Vider tous les caches PWA (CacheStorage)
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // 2. Désenregistrer le Service Worker pour forcer le rechargement immédiat
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }

      // 3. Purger les clés temporaires sans toucher aux licences ni aux candidats
      if (typeof localStorage !== 'undefined') {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('cruisepocket_tmp') || key.startsWith('backup_temp_') || key.startsWith('vite-'))) {
            localStorage.removeItem(key);
          }
        }
      }

      // 4. Recharger la page depuis le réseau
      window.location.reload();
    } catch (e) {
      console.warn("Erreur lors de l'actualisation:", e);
      window.location.reload();
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 px-2.5 py-2 sm:px-6 sm:py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        
        {/* Logo & Titre */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <img 
            src={`${import.meta.env.BASE_URL}logo.png`} 
            alt="CruisePocket Logo" 
            className="w-8 h-8 sm:w-11 sm:h-11 object-contain shrink-0 drop-shadow-md"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-sm sm:text-lg font-bold tracking-tight text-white flex items-center gap-1 leading-tight">
                Cruise<span className="text-transparent bg-clip-text bg-gradient-to-r from-maritime-400 to-cyan-300">Pocket</span>
              </h1>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-maritime-950 text-maritime-300 border border-maritime-800 shrink-0">
                PWA Maritime
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block mt-0.5">
              Santé & Administration des Gens de Mer
            </p>
          </div>
        </div>

        {/* Espace Utilisateur & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 flex-nowrap">
          
          {/* Statut Réseau */}
          <div 
            title={isOnline ? 'En ligne' : 'Mode Hors-ligne activé'} 
            className={`flex items-center gap-1 p-1.5 sm:px-2 sm:py-1 rounded-lg sm:rounded-full text-xs font-medium border ${
              isOnline 
                ? 'bg-emerald-950/60 border-emerald-800/50 text-emerald-400' 
                : 'bg-amber-950/60 border-amber-800/50 text-amber-400'
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{isOnline ? 'Connecté' : 'Hors-ligne'}</span>
          </div>

          {/* Bouton Sauvegardes & Restauration */}
          <button
            onClick={() => setIsBackupModalOpen(true)}
            className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-slate-300 hover:text-white shadow-sm transition-all cursor-pointer"
            title="Sauvegardes automatiques (5 fichiers rotatifs) et Restauration"
          >
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Sauvegardes</span>
          </button>

          {/* Bouton Actualiser & Vider le Cache */}
          <button
            onClick={handleRefreshAndClearCache}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-slate-300 hover:text-white shadow-sm transition-all cursor-pointer group"
            title="Effacer le cache du navigateur / PWA et recharger l'application"
          >
            <RotateCw className={`w-3.5 h-3.5 text-amber-400 group-hover:rotate-180 transition-transform ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRefreshing ? 'Actualisation...' : 'Actualiser'}</span>
          </button>

          {/* Bouton Installer PWA */}
          {!isInstalled && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-cyan-600 to-maritime-600 hover:from-cyan-500 hover:to-maritime-500 text-white shadow-sm transition-all cursor-pointer"
              title="Installer sur l'écran d'accueil"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Installer</span>
            </button>
          )}

          {/* Profil Actif & Déconnexion */}
          {role && (
            <div className="flex items-center gap-1 sm:gap-2 pl-1.5 sm:pl-2 border-l border-slate-800">
              <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/90 border border-slate-800 p-1 sm:px-2.5 sm:py-1.5 rounded-xl">
                {role === 'medecin' ? (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-6 h-6 rounded-lg bg-medical-500/20 text-medical-400 flex items-center justify-center shrink-0">
                      <Stethoscope className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left hidden sm:block">
                      <div className="font-semibold text-slate-200 truncate max-w-[140px]">
                        {doctorProfile?.full_name || 'Médecin'}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-medical-400" />
                        Ordre: {doctorProfile?.order_number || 'Certifié'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-6 h-6 rounded-lg bg-maritime-500/20 text-maritime-400 flex items-center justify-center shrink-0">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left hidden sm:block">
                      <div className="font-semibold text-slate-200 truncate max-w-[140px]">
                        {companyProfile?.name || 'Société'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {companyProfile?.location || 'Maritime'}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={logout}
                  title="Changer de profil / Déconnexion"
                  className="p-1 sm:p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Sauvegardes & Restauration */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />
    </header>
  );
};
