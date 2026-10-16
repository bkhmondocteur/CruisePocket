import React, { useState } from 'react';
import { Role } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { 
  generateCompanyLicense, 
  generateDoctorLicense, 
  getLicenseRegistry 
} from '../../utils/license';
import { 
  Stethoscope, 
  Building2, 
  KeyRound, 
  Sparkles, 
  Copy, 
  Check, 
  ArrowRight, 
  ChevronLeft, 
  ShieldCheck, 
  Ship, 
  Info
} from 'lucide-react';

export const HomePortal: React.FC = () => {
  const { targetRole, setTargetRole, loginWithLicense } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'generate'>('login');
  
  // Login State
  const [inputLicense, setInputLicense] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Doctor Generation State
  const [docName, setDocName] = useState('');
  const [docOrder, setDocOrder] = useState('');
  const [docLocation, setDocLocation] = useState('');

  // Company Generation State
  const [compName, setCompName] = useState('');
  const [compManager, setCompManager] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compLocation, setCompLocation] = useState('');

  // Generated License Result
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Switch role view
  const handleSelectRole = (role: Role) => {
    setTargetRole(role);
    setLoginError(null);
    setGeneratedKey(null);
    setInputLicense('');
    setActiveTab('login');
  };

  const handleBackToSelection = () => {
    setTargetRole(null);
    setLoginError(null);
    setGeneratedKey(null);
    setInputLicense('');
  };

  // Submit Login
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRole) return;

    setLoginError(null);
    const result = loginWithLicense(inputLicense, targetRole);
    if (!result.success) {
      setLoginError(result.error || 'Clé de licence invalide');
    }
  };

  // Use Demo License
  const handleUseDemoLicense = () => {
    if (!targetRole) return;
    const registry = getLicenseRegistry();
    let demoKey = '';

    if (targetRole === 'medecin') {
      const firstDoc = Object.values(registry.doctors)[0];
      if (firstDoc) demoKey = firstDoc.license_key;
    } else {
      const firstComp = Object.values(registry.companies)[0];
      if (firstComp) demoKey = firstComp.license_key;
    }

    if (demoKey) {
      setInputLicense(demoKey);
      loginWithLicense(demoKey, targetRole);
    }
  };

  // Submit Generation
  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratedKey(null);

    if (targetRole === 'medecin') {
      if (!docName.trim() || !docOrder.trim() || !docLocation.trim()) {
        alert('Veuillez remplir tous les champs du médecin.');
        return;
      }
      const { licenseKey } = generateDoctorLicense({
        full_name: docName,
        order_number: docOrder,
        practice_location: docLocation
      });
      setGeneratedKey(licenseKey);
      setInputLicense(licenseKey);
    } else {
      if (!compName.trim() || !compManager.trim() || !compPhone.trim() || !compLocation.trim()) {
        alert('Veuillez remplir tous les champs de la société.');
        return;
      }
      const { licenseKey } = generateCompanyLicense({
        name: compName,
        manager_name: compManager,
        phone: compPhone,
        location: compLocation
      });
      setGeneratedKey(licenseKey);
      setInputLicense(licenseKey);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ============================================================================
  // VUE 1 : ÉCRAN INITIAL DE SÉLECTION DU PROFIL
  // ============================================================================
  if (!targetRole) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 sm:py-12 max-w-4xl mx-auto w-full">
        
        {/* En-tête Hero */}
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-maritime-900/80 text-maritime-300 border border-maritime-700/60 shadow-inner">
            <Ship className="w-3.5 h-3.5 text-cyan-400" />
            Portail PWA Maritime Professionnel
          </div>
          
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Bienvenue sur <span className="text-transparent bg-clip-text bg-gradient-to-r from-maritime-400 via-cyan-300 to-emerald-400">CruisePocket</span>
          </h2>
          
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Plateforme sécurisée pour la gestion administrative et médicale des gens de mer. Choisissez votre espace pour commencer :
          </p>
        </div>

        {/* 2 Choix Principaux : Médecin / Société de Service */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
          
          {/* CARTE MÉDECIN */}
          <div
            onClick={() => handleSelectRole('medecin')}
            className="group relative cursor-pointer rounded-2xl glass-card-interactive p-6 sm:p-8 flex flex-col justify-between border-2 border-transparent hover:border-emerald-500/40 shadow-xl overflow-hidden"
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
                  Visites d'Aptitude & Suivi
                </span>
                <h3 className="text-2xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                  Je suis Médecin
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                  Réception en temps réel des dossiers de marins transmis par les sociétés, validation du statut médical et suivi de la facturation.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-emerald-400 font-semibold text-sm group-hover:translate-x-1 transition-transform">
              <span>Accéder à l'Espace Médical</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

          {/* CARTE SOCIÉTÉ DE SERVICE */}
          <div
            onClick={() => handleSelectRole('societe')}
            className="group relative cursor-pointer rounded-2xl glass-card-interactive p-6 sm:p-8 flex flex-col justify-between border-2 border-transparent hover:border-maritime-500/40 shadow-xl overflow-hidden"
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
                  Fournisseur / Agence Crewing
                </span>
                <h3 className="text-2xl font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Je suis Société de Service
                </h3>
                <p className="text-slate-400 text-xs sm:text-sm mt-2 leading-relaxed">
                  Enregistrement des candidats marins, auto-complétion des compagnies de croisière, upload du passeport et envoi direct au médecin.
                </p>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-cyan-400 font-semibold text-sm group-hover:translate-x-1 transition-transform">
              <span>Accéder à l'Espace Société</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>

        </div>

        {/* Note de bas de page informative */}
        <div className="mt-12 flex items-center gap-2 text-xs text-slate-500 max-w-md text-center">
          <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
          <span>Authentification sécurisée par Clé de Licence cryptographique conforme à la réglementation maritime.</span>
        </div>

      </div>
    );
  }

  // ============================================================================
  // VUE 2 : AUTHENTIFICATION & GÉNÉRATEUR PAR CLÉ DE LICENCE
  // ============================================================================
  const isMed = targetRole === 'medecin';
  const roleTitle = isMed ? 'Médecin Agréé Gens de Mer' : 'Société de Service Maritime';

  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 py-8 max-w-xl mx-auto w-full">
      
      {/* Bouton Retour */}
      <div className="w-full mb-6">
        <button
          onClick={handleBackToSelection}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors py-1 px-2.5 rounded-lg bg-slate-900 border border-slate-800"
        >
          <ChevronLeft className="w-4 h-4" />
          Changer de profil
        </button>
      </div>

      {/* Boîte Principale */}
      <div className="w-full glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-2xl relative">
        
        {/* Titre & Icône */}
        <div className="flex items-center gap-4 mb-6 pb-5 border-b border-slate-800/80">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            isMed 
              ? 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-400' 
              : 'bg-maritime-950/80 border border-maritime-700/60 text-cyan-400'
          }`}>
            {isMed ? <Stethoscope className="w-6 h-6" /> : <Building2 className="w-6 h-6" />}
          </div>
          <div>
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400">
              Espace {isMed ? 'Médical' : 'Société'}
            </span>
            <h2 className="text-xl font-bold text-white">{roleTitle}</h2>
          </div>
        </div>

        {/* Onglets : Connexion vs Générateur */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-950 border border-slate-800 mb-6">
          <button
            onClick={() => setActiveTab('login')}
            className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'login'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Connexion Clé
          </button>
          
          <button
            onClick={() => setActiveTab('generate')}
            className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'generate'
                ? isMed ? 'bg-emerald-600 text-white' : 'bg-maritime-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Générer Clé
          </button>
        </div>

        {/* CONTENU ONGLET 1 : CONNEXION PAR CLÉ */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Votre Clé de Licence {isMed ? 'Médecin' : 'Société'} :
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={inputLicense}
                  onChange={(e) => {
                    setInputLicense(e.target.value.toUpperCase());
                    setLoginError(null);
                  }}
                  placeholder={isMed ? 'CP-MED-13987-A1B2C3-4E8F' : 'CP-SOC-MARS-D4E5F6-7A9B'}
                  className="w-full bg-slate-950/80 border border-slate-700 rounded-xl px-4 py-3 text-sm font-mono tracking-wider text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-maritime-500 transition-all uppercase"
                  required
                />
                <KeyRound className="absolute right-3.5 top-3.5 w-4 h-4 text-slate-500" />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Format requis : {isMed ? 'CP-MED-XXXXX-...' : 'CP-SOC-XXXX-...'}
              </p>
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                isMed 
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/20' 
                  : 'bg-gradient-to-r from-maritime-600 to-cyan-600 hover:from-maritime-500 hover:to-cyan-500 shadow-maritime-600/20'
              }`}
            >
              <span>Se Connecter</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Accès Démo Rapide */}
            <div className="pt-4 border-t border-slate-800/80 flex flex-col items-center">
              <button
                type="button"
                onClick={handleUseDemoLicense}
                className="text-xs text-slate-400 hover:text-cyan-400 font-medium transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Tester instantanément avec la clé démo pré-configurée</span>
              </button>
            </div>

          </form>
        )}

        {/* CONTENU ONGLET 2 : GÉNÉRATEUR DE LICENCE (Conforme CDC) */}
        {activeTab === 'generate' && (
          <form onSubmit={handleGenerateSubmit} className="space-y-4">
            
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 mb-4">
              {isMed ? (
                <span>
                  Génération sécurisée de la clé médecin à partir du <strong>Nom/Prénom</strong>, <strong>Numéro d'Ordre</strong> et <strong>Lieu d'exercice</strong>.
                </span>
              ) : (
                <span>
                  Génération sécurisée de la clé société à partir du <strong>Nom de la société</strong>, <strong>Responsable</strong>, <strong>Téléphone</strong> et <strong>Localisation</strong>.
                </span>
              )}
            </div>

            {/* Formulaire Médecin */}
            {isMed ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nom et Prénom du Médecin *
                  </label>
                  <input
                    type="text"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="ex: Dr. Sophie Laurent"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Numéro d'Ordre *
                    </label>
                    <input
                      type="text"
                      value={docOrder}
                      onChange={(e) => setDocOrder(e.target.value)}
                      placeholder="ex: 13/45892"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Lieu d'exercice *
                    </label>
                    <input
                      type="text"
                      value={docLocation}
                      onChange={(e) => setDocLocation(e.target.value)}
                      placeholder="ex: Marseille Port"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              /* Formulaire Société */
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nom de la Société *
                  </label>
                  <input
                    type="text"
                    value={compName}
                    onChange={(e) => setCompName(e.target.value)}
                    placeholder="ex: Maritime Crewing Agency"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-maritime-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nom et Prénom du Responsable *
                  </label>
                  <input
                    type="text"
                    value={compManager}
                    onChange={(e) => setCompManager(e.target.value)}
                    placeholder="ex: Marc Delatour"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-maritime-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Téléphone *
                    </label>
                    <input
                      type="tel"
                      value={compPhone}
                      onChange={(e) => setCompPhone(e.target.value)}
                      placeholder="ex: +33 4 91 00 22 33"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-maritime-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Localisation *
                    </label>
                    <input
                      type="text"
                      value={compLocation}
                      onChange={(e) => setCompLocation(e.target.value)}
                      placeholder="ex: Le Havre / Marseille"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-maritime-500"
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
                isMed 
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500' 
                  : 'bg-gradient-to-r from-maritime-600 to-cyan-600 hover:from-maritime-500 hover:to-cyan-500'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Générer ma Clé de Licence</span>
            </button>

            {/* RÉSULTAT CLÉ GÉNÉRÉE */}
            {generatedKey && (
              <div className="mt-5 p-4 rounded-xl bg-slate-950 border border-emerald-500/50 shadow-inner space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Clé de Licence Générée avec Succès !
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedKey)}
                    className="flex items-center gap-1 text-slate-300 hover:text-white bg-slate-800 px-2 py-1 rounded"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copié !' : 'Copier'}</span>
                  </button>
                </div>

                <div className="font-mono text-sm tracking-wider font-bold text-white bg-slate-900 p-2.5 rounded-lg border border-slate-800 select-all break-all text-center">
                  {generatedKey}
                </div>

                <p className="text-[11px] text-slate-400 leading-tight">
                  Conservez cette clé précieusement. Elle fait office de token d'authentification pour cet appareil.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    loginWithLicense(generatedKey, targetRole);
                  }}
                  className="w-full py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  <span>Connexion Immédiate avec cette Clé</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

          </form>
        )}

      </div>
    </div>
  );
};
