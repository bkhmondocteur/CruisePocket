import React, { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useI18n } from './i18n/I18nContext';
import { Header } from './components/common/Header';
import { HomePortal } from './components/home/HomePortal';
import { CompanyDashboard } from './components/company/CompanyDashboard';
import { DoctorDashboard } from './components/doctor/DoctorDashboard';
import { documentStorage } from './lib/documentStorage';
import { ShieldCheck } from 'lucide-react';

export const App: React.FC = () => {
  const { isAuthenticated, role } = useAuth();
  const { t } = useI18n();

  // Écoute automatique des documents lourds transitant par le pont
  useEffect(() => {
    const unsub = documentStorage.subscribeToBridge(() => {
      // Document automatiquement stocké dans le coffre IndexedDB
    });
    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-maritime-500 selection:text-white">
      {/* Barre de navigation haute */}
      <Header />

      {/* Contenu principal */}
      <main className="flex-1 flex flex-col">
        {!isAuthenticated ? (
          <HomePortal />
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
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="CruisePocket" className="w-[26px] h-[26px] object-contain" />
            <span className="font-bold text-slate-300">CruisePocket</span>
            <span>• {t('footer.official')}</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('footer.stcw')}</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
