import React, { useState, useEffect } from 'react';
import { 
  generateCompanyLicense, 
  generateDoctorLicense, 
  getLicenseRegistry 
} from '../../utils/license';
import { Doctor, ServiceCompany } from '../../types';
import { 
  KeyRound, 
  Sparkles, 
  Copy, 
  Check, 
  Building2, 
  Stethoscope, 
  ShieldCheck, 
  ArrowLeft, 
  Trash2, 
  Download, 
  CheckCircle2, 
  LogIn
} from 'lucide-react';

interface KeygenPortalProps {
  onBackToApp: () => void;
  onLoginWithKey?: (key: string) => void;
}

export const KeygenPortal: React.FC<KeygenPortalProps> = ({ onBackToApp, onLoginWithKey }) => {
  // Onglet générateur : 'societe' | 'medecin' | 'registry'
  const [activeTab, setActiveTab] = useState<'societe' | 'medecin' | 'registry'>('societe');

  // État formulaire Société
  const [compName, setCompName] = useState('');
  const [compManager, setCompManager] = useState('');
  const [compPhone, setCompPhone] = useState('');
  const [compLocation, setCompLocation] = useState('');

  // État formulaire Médecin
  const [docName, setDocName] = useState('');
  const [docOrder, setDocOrder] = useState('');
  const [docLocation, setDocLocation] = useState('');

  // Clé générée & état de copie
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generatedType, setGeneratedType] = useState<'societe' | 'medecin' | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Registre local
  const [registry, setRegistry] = useState<{
    doctors: Record<string, Doctor>;
    companies: Record<string, ServiceCompany>;
  }>({ doctors: {}, companies: {} });

  useEffect(() => {
    loadRegistry();
  }, []);

  const loadRegistry = () => {
    const reg = getLicenseRegistry();
    setRegistry(reg);
  };

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleGenerateCompany = (e: React.FormEvent) => {
    e.preventDefault();
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
    setGeneratedType('societe');
    loadRegistry();
  };

  const handleGenerateDoctor = (e: React.FormEvent) => {
    e.preventDefault();
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
    setGeneratedType('medecin');
    loadRegistry();
  };

  const handleDeleteLicense = (type: 'doc' | 'comp', key: string) => {
    if (!confirm(`Supprimer définitivement la clé ${key} du registre ?`)) return;
    try {
      const reg = getLicenseRegistry();
      if (type === 'doc') {
        delete reg.doctors[key];
      } else {
        delete reg.companies[key];
      }
      localStorage.setItem('cruisepocket_license_registry', JSON.stringify(reg));
      loadRegistry();
      if (generatedKey === key) setGeneratedKey(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportRegistry = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(registry, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `cruisepocket_licences_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const doctorList = Object.values(registry.doctors);
  const companyList = Object.values(registry.companies);
  const totalLicenses = doctorList.length + companyList.length;

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8 animate-fadeIn">
      
      {/* En-tête Keygen */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <img 
            src="/logo.png" 
            alt="CruisePocket Official Logo" 
            className="w-16 h-16 object-contain drop-shadow-xl"
          />
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-950/80 text-amber-300 border border-amber-800/60 mb-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              Générateur & Registre de Clés (Keygen Dédié)
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Générateur de Licences CruisePocket
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm">
              Module autonome pour délivrer les clés de connexion sécurisées aux Médecins et Sociétés de Service
            </p>
          </div>
        </div>

        <button
          onClick={onBackToApp}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-md border border-slate-700 transition-all self-start sm:self-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l'Application</span>
        </button>
      </div>

      {/* Onglets Générateur : Société / Médecin / Registre */}
      <div className="grid grid-cols-3 p-1.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-bold text-center">
        <button
          onClick={() => { setActiveTab('societe'); setGeneratedKey(null); }}
          className={`py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'societe' 
              ? 'bg-gradient-to-r from-maritime-600 to-cyan-600 text-white shadow-lg' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Générateur Société</span>
        </button>

        <button
          onClick={() => { setActiveTab('medecin'); setGeneratedKey(null); }}
          className={`py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'medecin' 
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          <span>Générateur Médecin</span>
        </button>

        <button
          onClick={() => setActiveTab('registry')}
          className={`py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
            activeTab === 'registry' 
              ? 'bg-slate-800 text-white shadow-lg border border-slate-700' 
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-amber-400" />
          <span>Registre des Clés ({totalLicenses})</span>
        </button>
      </div>

      {/* CONTENU ONGLET 1 : GÉNÉRATEUR SOCIÉTÉ */}
      {activeTab === 'societe' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 glass-panel rounded-2xl p-6 sm:p-7 border border-cyan-900/40 shadow-xl space-y-5">
            <div className="pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                Émission d'une Clé Société de Service Maritime
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                La clé est calculée de manière déterministe à partir des 4 paramètres requis :
              </p>
            </div>

            <form onSubmit={handleGenerateCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  1. Nom de la Société *
                </label>
                <input
                  type="text"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  placeholder="ex: TransMed Crewing Services"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-maritime-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  2. Nom et Prénom du Responsable *
                </label>
                <input
                  type="text"
                  value={compManager}
                  onChange={(e) => setCompManager(e.target.value)}
                  placeholder="ex: Claire Beauchamp"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-maritime-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    3. Téléphone *
                  </label>
                  <input
                    type="tel"
                    value={compPhone}
                    onChange={(e) => setCompPhone(e.target.value)}
                    placeholder="ex: +33 4 91 10 20 30"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-maritime-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    4. Localisation *
                  </label>
                  <input
                    type="text"
                    value={compLocation}
                    onChange={(e) => setCompLocation(e.target.value)}
                    placeholder="ex: Marseille Port Autonome"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-maritime-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-maritime-600 to-cyan-600 hover:from-maritime-500 hover:to-cyan-500 shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Générer la Clé de Licence Société</span>
              </button>
            </form>
          </div>

          {/* RÉSULTAT SOCIÉTÉ */}
          <div className="lg:col-span-5 space-y-4">
            {generatedKey && generatedType === 'societe' ? (
              <div className="glass-panel rounded-2xl p-6 border border-cyan-500/60 shadow-2xl space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold text-cyan-400">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Clé Société Émise avec Succès
                  </span>
                  <span className="text-[10px] bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded">
                    Token Vérifié
                  </span>
                </div>

                <div className="font-mono text-sm tracking-wider font-extrabold text-white bg-slate-950 p-3 rounded-xl border border-slate-800 text-center select-all break-all">
                  {generatedKey}
                </div>

                <div className="text-xs text-slate-400 space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <div><strong>Société :</strong> {compName}</div>
                  <div><strong>Responsable :</strong> {compManager}</div>
                  <div><strong>Localisation :</strong> {compLocation}</div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(generatedKey)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all"
                  >
                    {copiedKey === generatedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === generatedKey ? 'Clé Copiée !' : 'Copier la Clé'}</span>
                  </button>

                  {onLoginWithKey && (
                    <button
                      onClick={() => onLoginWithKey(generatedKey)}
                      className="py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                      title="Se connecter avec cette clé immédiatement"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Connexion</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass-panel rounded-2xl p-8 border border-dashed border-slate-800 text-center space-y-3">
                <KeyRound className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-300">En attente de génération</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Remplissez le formulaire de gauche pour délivrer une clé officielle de fournisseur crewing.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENU ONGLET 2 : GÉNÉRATEUR MÉDECIN */}
      {activeTab === 'medecin' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 glass-panel rounded-2xl p-6 sm:p-7 border border-emerald-900/40 shadow-xl space-y-5">
            <div className="pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-emerald-400" />
                Émission d'une Clé Médecin Agréé Gens de Mer
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                La clé est calculée de manière déterministe à partir des 3 paramètres requis :
              </p>
            </div>

            <form onSubmit={handleGenerateDoctor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  1. Nom et Prénom du Médecin *
                </label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="ex: Dr. Jean-Marc FERRARI"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    2. Numéro d'Ordre *
                  </label>
                  <input
                    type="text"
                    value={docOrder}
                    onChange={(e) => setDocOrder(e.target.value)}
                    placeholder="ex: 13/98745"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    3. Lieu d'exercice *
                  </label>
                  <input
                    type="text"
                    value={docLocation}
                    onChange={(e) => setDocLocation(e.target.value)}
                    placeholder="ex: Centre Médical Maritime - Marseille"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>Générer la Clé de Licence Médecin</span>
              </button>
            </form>
          </div>

          {/* RÉSULTAT MÉDECIN */}
          <div className="lg:col-span-5 space-y-4">
            {generatedKey && generatedType === 'medecin' ? (
              <div className="glass-panel rounded-2xl p-6 border border-emerald-500/60 shadow-2xl space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Clé Médecin Émise avec Succès
                  </span>
                  <span className="text-[10px] bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded">
                    Token Vérifié
                  </span>
                </div>

                <div className="font-mono text-sm tracking-wider font-extrabold text-white bg-slate-950 p-3 rounded-xl border border-slate-800 text-center select-all break-all">
                  {generatedKey}
                </div>

                <div className="text-xs text-slate-400 space-y-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <div><strong>Praticien :</strong> {docName}</div>
                  <div><strong>N° d'Ordre :</strong> {docOrder}</div>
                  <div><strong>Lieu :</strong> {docLocation}</div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(generatedKey)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all"
                  >
                    {copiedKey === generatedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === generatedKey ? 'Clé Copiée !' : 'Copier la Clé'}</span>
                  </button>

                  {onLoginWithKey && (
                    <button
                      onClick={() => onLoginWithKey(generatedKey)}
                      className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                      title="Se connecter avec cette clé immédiatement"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Connexion</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass-panel rounded-2xl p-8 border border-dashed border-slate-800 text-center space-y-3">
                <KeyRound className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-sm font-bold text-slate-300">En attente de génération</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Remplissez le formulaire de gauche pour délivrer une clé médicale certifiée.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENU ONGLET 3 : REGISTRE DES LICENCES ÉMISES */}
      {activeTab === 'registry' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                Registre des Clés de Licence Délivrées
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Toutes les clés créées sont stockées et prêtes à être utilisées pour l'authentification
              </p>
            </div>

            <button
              onClick={handleExportRegistry}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Exporter le Registre (JSON)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Colonne Médecins */}
            <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4" />
                  Médecins Agréés ({doctorList.length})
                </span>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {doctorList.map((doc) => (
                  <div key={doc.license_key} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-white">{doc.full_name}</div>
                        <div className="text-[11px] text-slate-400">Ordre : {doc.order_number} • {doc.practice_location}</div>
                      </div>
                      <button
                        onClick={() => handleDeleteLicense('doc', doc.license_key)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Révoquer la licence"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-slate-900 p-2 rounded-lg font-mono text-[11px] text-slate-300 select-all border border-slate-800">
                      <span className="truncate max-w-[240px]">{doc.license_key}</span>
                      <button
                        onClick={() => handleCopy(doc.license_key)}
                        className="text-cyan-400 hover:text-cyan-300 ml-2"
                        title="Copier"
                      >
                        {copiedKey === doc.license_key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Colonne Sociétés */}
            <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  Sociétés de Service ({companyList.length})
                </span>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {companyList.map((comp) => (
                  <div key={comp.license_key} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-white">{comp.name}</div>
                        <div className="text-[11px] text-slate-400">Resp: {comp.manager_name} • {comp.location}</div>
                      </div>
                      <button
                        onClick={() => handleDeleteLicense('comp', comp.license_key)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Révoquer la licence"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-slate-900 p-2 rounded-lg font-mono text-[11px] text-slate-300 select-all border border-slate-800">
                      <span className="truncate max-w-[240px]">{comp.license_key}</span>
                      <button
                        onClick={() => handleCopy(comp.license_key)}
                        className="text-cyan-400 hover:text-cyan-300 ml-2"
                        title="Copier"
                      >
                        {copiedKey === comp.license_key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
