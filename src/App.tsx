import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Header } from './components/common/Header';
import { HomePortal } from './components/home/HomePortal';
import { CompanyDashboard } from './components/company/CompanyDashboard';
import { DoctorDashboard } from './components/doctor/DoctorDashboard';
import { KeygenPortal } from './components/admin/KeygenPortal';
import { ShieldCheck, KeyRound } from 'lucide-react';

export const App: React.FC = () => {
  const { isAuthenticated, role, loginWithLicense } = useAuth();
  
  // Navigation vers le Keygen indépendant (séparé du flux normal)
  const [isKeygenOpen, setIsKeygenOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.location.hash === '#keygen';
  });

  useEffect(() => {
    const handleHash = () => {
      setIsKeygenOpen(window.location.hash === '#keygen');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const openKeygen = () => {
    window.location.hash = '#keygen';
    setIsKeygenOpen(true);
  };

  const closeKeygen = () => {
    window.location.hash = '';
    setIsKeygenOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-maritime-500 selection:text-white">
      {/* Barre de navigation haute avec nouveau logo */}
      <Header onOpenKeygen={openKeygen} />

      {/* Contenu principal */}
      <main className="flex-1 flex flex-col">
        {isKeygenOpen ? (
          <KeygenPortal 
            onBackToApp={closeKeygen} 
            onLoginWithKey={(key) => {
              closeKeygen();
              loginWithLicense(key);
            }} 
          />
        ) : !isAuthenticated ? (
          <HomePortal onOpenKeygen={openKeygen} />
        ) : role === 'medecin' ? (
          <DoctorDashboard />
        ) : (
          <CompanyDashboard />
        )}
      </main>

      {/* Pied de page officiel avec Logo CruisePocket */}
      <footer className="py-4 px-6 border-t border-slate-900 glass-panel text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="CruisePocket" className="w-5 h-5 object-contain" />
            <span className="font-bold text-slate-300">CruisePocket</span>
            <span>• Plateforme Métier Médicale & Administrative des Gens de Mer</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Conforme STCW & OMI</span>
            </span>
            <button
              onClick={openKeygen}
              className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-medium"
            >
              <KeyRound className="w-3 h-3 text-amber-400" />
              <span>Générateur de Clés (Keygen)</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
