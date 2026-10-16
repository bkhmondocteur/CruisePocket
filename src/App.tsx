import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Header } from './components/common/Header';
import { HomePortal } from './components/home/HomePortal';
import { CompanyDashboard } from './components/company/CompanyDashboard';
import { DoctorDashboard } from './components/doctor/DoctorDashboard';
import { TestSandbox } from './components/test/TestSandbox';
import { ShieldCheck, Anchor } from 'lucide-react';

export const App: React.FC = () => {
  const { isAuthenticated, role } = useAuth();
  const [isTestSandboxOpen, setIsTestSandboxOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-maritime-500 selection:text-white">
      {/* Barre de navigation haute */}
      <Header onOpenTestSandbox={() => setIsTestSandboxOpen(true)} />

      {/* Contenu principal dynamique */}
      <main className="flex-1 flex flex-col">
        {!isAuthenticated ? (
          <HomePortal />
        ) : role === 'medecin' ? (
          <DoctorDashboard />
        ) : (
          <CompanyDashboard />
        )}
      </main>

      {/* Pied de page PWA */}
      <footer className="py-4 px-6 border-t border-slate-900 glass-panel text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <Anchor className="w-3.5 h-3.5 text-cyan-500" />
          <span className="font-semibold text-slate-400">CruisePocket v1.0.0</span>
          <span>• Conforme STCW & Médecine des Gens de Mer</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Données médicales chiffrées & PWA Offline-ready</span>
        </div>
      </footer>
      {/* Modal Page de Test & Simulateur */}
      {isTestSandboxOpen && (
        <TestSandbox onClose={() => setIsTestSandboxOpen(false)} />
      )}
    </div>
  );
};

export default App;
