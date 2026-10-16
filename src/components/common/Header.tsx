import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Anchor, 
  Stethoscope, 
  Building2, 
  LogOut, 
  Download, 
  Wifi, 
  WifiOff, 
  ShieldCheck,
  FlaskConical
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface HeaderProps {
  onOpenTestSandbox?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenTestSandbox }) => {
  const { role, doctorProfile, companyProfile, logout } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        
        {/* Logo & Titre */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-maritime-700 via-maritime-500 to-cyan-400 p-0.5 shadow-lg shadow-maritime-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Anchor className="w-5 h-5 text-cyan-400 stroke-[2.2]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                Cruise<span className="text-transparent bg-clip-text bg-gradient-to-r from-maritime-400 to-cyan-300">Pocket</span>
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-maritime-950 text-maritime-300 border border-maritime-800">
                PWA Maritime
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden xs:block">
              Santé & Administration des Gens de Mer
            </p>
          </div>
        </div>

        {/* Espace Utilisateur & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Statut Réseau */}
          <div 
            title={isOnline ? 'En ligne' : 'Mode Hors-ligne activé'} 
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${
              isOnline 
                ? 'bg-emerald-950/60 border-emerald-800/50 text-emerald-400' 
                : 'bg-amber-950/60 border-amber-800/50 text-amber-400'
            }`}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{isOnline ? 'Connecté' : 'Hors-ligne'}</span>
          </div>

          {/* Bouton Mode Test & Bac à sable */}
          {onOpenTestSandbox && (
            <button
              onClick={onOpenTestSandbox}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 shadow-sm transition-all"
              title="Ouvrir la page de test et simulateur"
            >
              <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />
              <span>Page de Test</span>
            </button>
          )}

          {/* Bouton Installer PWA */}
          {!isInstalled && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-cyan-600 to-maritime-600 hover:from-cyan-500 hover:to-maritime-500 text-white shadow-sm transition-all"
              title="Installer sur l'écran d'accueil"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Installer l'app</span>
            </button>
          )}

          {/* Profil Actif & Déconnexion */}
          {role && (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-2.5 py-1.5 rounded-xl">
                {role === 'medecin' ? (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-6 h-6 rounded-lg bg-medical-500/20 text-medical-400 flex items-center justify-center">
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
                    <div className="w-6 h-6 rounded-lg bg-maritime-500/20 text-maritime-400 flex items-center justify-center">
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
                  className="p-1.5 ml-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </header>
  );
};
