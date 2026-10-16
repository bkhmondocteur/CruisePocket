import React, { useState, useEffect } from 'react';
import { dataService } from '../../lib/supabase';
import { calculateAge, validateMaritimeAge } from '../../utils/age';
import { generateCompanyLicense, generateDoctorLicense } from '../../utils/license';
import { Candidate } from '../../types';
import { 
  FlaskConical, 
  RotateCcw, 
  Send, 
  CheckCircle2, 
  Clock, 
  Ship, 
  Stethoscope, 
  Building2, 
  KeyRound, 
  Sparkles, 
  Smartphone, 
  ShieldCheck
} from 'lucide-react';

interface TestSandboxProps {
  onClose: () => void;
}

export const TestSandbox: React.FC<TestSandboxProps> = ({ onClose }) => {
  // Onglet de test : 'split' (simulateur double écran) | 'age' | 'licenses' | 'companies'
  const [activeTab, setActiveTab] = useState<'split' | 'age' | 'licenses' | 'companies'>('split');

  // Données en temps réel
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [pulseNewId, setPulseNewId] = useState<string | null>(null);

  // Formulaire test express société
  const [testLastName, setTestLastName] = useState('LECLERC');
  const [testFirstName, setTestFirstName] = useState('Julien');
  const [testBirthDate, setTestBirthDate] = useState('1995-07-12');
  const [testPassport, setTestPassport] = useState('24FR77381');
  const [testCompany, setTestCompany] = useState('MSC Croisières');
  const [testPosition, setTestPosition] = useState('Officier Navigation');

  // Testeur d'âge interactif
  const [demoBirthDate, setDemoBirthDate] = useState('2000-04-15');
  const calculatedDemoAge = calculateAge(demoBirthDate);
  const demoAgeValidation = validateMaritimeAge(calculatedDemoAge);

  // Testeur de génération de licence
  const [licenseType, setLicenseType] = useState<'medecin' | 'societe'>('medecin');
  const [sampleLicense, setSampleLicense] = useState<string>('');

  // Nouvelle compagnie test
  const [newCompanyName, setNewCompanyName] = useState('');

  // Charger les données
  useEffect(() => {
    refreshData();
    const unsub = dataService.subscribeToCandidates((event) => {
      refreshData();
      if (event.payload?.id) {
        setPulseNewId(event.payload.id);
        setTimeout(() => setPulseNewId(null), 3000);
      }
    });
    return () => unsub();
  }, []);

  const refreshData = async () => {
    const cands = await dataService.getCandidates();
    setCandidates(cands);
    const comps = await dataService.getCruiseCompanies();
    setCompanies(comps);
  };

  // Envoi express d'un candidat test (Simulation Société -> Médecin)
  const handleQuickSend = async () => {
    const age = calculateAge(testBirthDate) || 28;
    const newCand = await dataService.addCandidate({
      civility: 'M.',
      last_name: testLastName.toUpperCase(),
      first_name: testFirstName,
      birth_date: testBirthDate,
      age,
      passport_number: testPassport,
      cruise_company: testCompany,
      position: testPosition,
      contract_type: 'Nouveau contrat',
      embarkation_date: '2026-11-20',
      medical_status: 'En instance',
      financial_amount: 190.00,
      financial_status: 'Non payé',
      payer_name: 'La société',
      service_company_name: 'TransMed Crewing (Simulateur)'
    });

    setPulseNewId(newCand.id);
    setTimeout(() => setPulseNewId(null), 3500);
  };

  // Injecter un jeu complet de données de test
  const handleInjectSampleDataset = async () => {
    const samples: Omit<Candidate, 'id' | 'created_at' | 'updated_at'>[] = [
      {
        civility: 'M.',
        last_name: 'BERNARD',
        first_name: 'Romain',
        birth_date: '1988-03-12',
        age: 38,
        passport_number: '20FR91823',
        cruise_company: 'MSC Croisières',
        position: 'Second Capitaine',
        contract_type: 'Renouvellement de contrat',
        embarkation_date: '2026-11-05',
        medical_status: 'En instance',
        financial_amount: 220,
        financial_status: 'Non payé',
        payer_name: 'La société',
        service_company_name: 'Azur Crewing'
      },
      {
        civility: 'Mme',
        last_name: 'ROUX',
        first_name: 'Élodie',
        birth_date: '1996-09-24',
        age: 30,
        passport_number: '22FR49182',
        cruise_company: 'Ponant',
        position: 'Responsable Expéditions',
        contract_type: 'Nouveau contrat',
        embarkation_date: '2026-12-01',
        medical_status: 'Effectué',
        financial_amount: 180,
        financial_status: 'Payé',
        payer_name: 'Le candidat lui-même',
        service_company_name: 'TransMed Crewing'
      },
      {
        civility: 'M.',
        last_name: 'MOREAU',
        first_name: 'Antoine',
        birth_date: '1991-11-04',
        age: 35,
        passport_number: '23FR66219',
        cruise_company: 'Costa Croisières',
        position: 'Chef Électricien',
        contract_type: 'Contrat intermédiaire',
        embarkation_date: '2026-11-18',
        medical_status: 'En instance',
        financial_amount: 195,
        financial_status: 'Non payé',
        payer_name: 'La société',
        service_company_name: 'TransMed Crewing'
      }
    ];

    for (const s of samples) {
      await dataService.addCandidate(s);
    }
    await refreshData();
  };

  // Réinitialiser les données
  const handleResetData = () => {
    localStorage.removeItem('cruisepocket_candidates_data');
    localStorage.removeItem('cruisepocket_cruise_companies_data');
    refreshData();
  };

  // Testeur de génération de clé
  const handleTestGenerateLicense = () => {
    if (licenseType === 'medecin') {
      const { licenseKey } = generateDoctorLicense({
        full_name: 'Dr. Test Exemplaire',
        order_number: '75/12345',
        practice_location: 'Hôpital Maritime de Paris'
      });
      setSampleLicense(licenseKey);
    } else {
      const { licenseKey } = generateCompanyLicense({
        name: 'Maritime Solutions International',
        manager_name: 'Marc Dupont',
        phone: '+33 1 40 50 60 70',
        location: 'Le Havre'
      });
      setSampleLicense(licenseKey);
    }
  };

  // Testeur auto-alimentation compagnie
  const handleAddCustomCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    await dataService.addCruiseCompany(newCompanyName);
    setNewCompanyName('');
    await refreshData();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* En-tête du Banc d'Essai */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-emerald-500 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <FlaskConical className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">
                  Page de Test & Simulateur Intégré CruisePocket
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  Bac à Sable Temps Réel
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Vérification en direct des flux Société ⇄ Médecin, calculs d'âge STCW et règles financières
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleInjectSampleDataset}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
              title="Injecter 3 marins de démonstration"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Injecter 3 Dossiers</span>
            </button>

            <button
              onClick={handleResetData}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/50 hover:text-rose-400 text-slate-400 transition-colors border border-slate-700"
              title="Réinitialiser les données locales"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-maritime-600 hover:bg-maritime-500 text-white text-xs font-bold transition-all shadow-md"
            >
              Fermer le Test
            </button>
          </div>
        </div>

        {/* Navigation des Onglets de Test */}
        <div className="grid grid-cols-4 p-1.5 bg-slate-950 border-b border-slate-800 text-xs font-bold text-center">
          <button
            onClick={() => setActiveTab('split')}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'split' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            <span>1. Simulateur Double-Écran (Société ⇄ Médecin)</span>
          </button>

          <button
            onClick={() => setActiveTab('age')}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'age' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>2. Banc d'Essai Âge STCW</span>
          </button>

          <button
            onClick={() => setActiveTab('licenses')}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'licenses' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
            <span>3. Testeur Clés de Licence</span>
          </button>

          <button
            onClick={() => setActiveTab('companies')}
            className={`py-2 rounded-xl transition-all flex items-center justify-center gap-2 ${
              activeTab === 'companies' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Ship className="w-3.5 h-3.5 text-maritime-400" />
            <span>4. Auto-Complétion Compagnies</span>
          </button>
        </div>

        {/* Corps de l'Onglet Actif */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950/40">
          
          {/* ONGLET 1 : SIMULATEUR DOUBLE-ÉCRAN (SPLIT-SCREEN) */}
          {activeTab === 'split' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 text-xs flex items-center justify-between">
                <span>
                  💡 <strong>Principe du test :</strong> Cliquez sur <em>"Transmettre ce marin au Médecin"</em> à gauche. Observez l'apparition instantanée de la carte à droite dans l'Espace Médecin sans rechargement de page.
                </span>
                <span className="text-[10px] bg-cyan-900/80 px-2 py-0.5 rounded text-white font-mono">
                  Sync BroadcastChannel / Supabase
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                
                {/* VOLET GAUCHE : ESPACE SOCIÉTÉ (ENVOYEUR) */}
                <div className="lg:col-span-5 glass-panel rounded-2xl p-4 border border-cyan-900/60 shadow-xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4" />
                      Écran Société (Transmission)
                    </span>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">Émetteur</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Nom</label>
                        <input
                          type="text"
                          value={testLastName}
                          onChange={(e) => setTestLastName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Prénom</label>
                        <input
                          type="text"
                          value={testFirstName}
                          onChange={(e) => setTestFirstName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Date Naissance (Âge auto)</label>
                        <input
                          type="date"
                          value={testBirthDate}
                          onChange={(e) => setTestBirthDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Passeport</label>
                        <input
                          type="text"
                          value={testPassport}
                          onChange={(e) => setTestPassport(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Compagnie Croisière</label>
                        <input
                          type="text"
                          value={testCompany}
                          onChange={(e) => setTestCompany(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">Poste</label>
                        <input
                          type="text"
                          value={testPosition}
                          onChange={(e) => setTestPosition(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleQuickSend}
                      className="w-full mt-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-600 to-maritime-600 hover:from-cyan-500 hover:to-maritime-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Transmettre ce marin au Médecin</span>
                    </button>
                  </div>
                </div>

                {/* VOLET DROIT : ESPACE MÉDECIN (RÉCEPTEUR EN DIRECT) */}
                <div className="lg:col-span-7 glass-panel rounded-2xl p-4 border border-emerald-900/60 shadow-xl space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Stethoscope className="w-4 h-4" />
                      Écran Médecin (Réception & Actes en Direct)
                    </span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      {candidates.length} Dossiers
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                    {candidates.map((c) => {
                      const isJustAdded = c.id === pulseNewId;
                      return (
                        <div
                          key={c.id}
                          className={`p-3 rounded-xl border text-xs transition-all space-y-2 ${
                            isJustAdded
                              ? 'bg-cyan-950 border-cyan-400 shadow-lg shadow-cyan-500/20 ring-2 ring-cyan-400 animate-pulse'
                              : 'bg-slate-950/80 border-slate-800'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-bold text-white text-sm">
                                {c.civility} {c.last_name} {c.first_name}
                              </div>
                              <div className="text-slate-400 text-[11px]">
                                {c.position} • {c.cruise_company} ({c.age} ans)
                              </div>
                            </div>

                            {/* Bouton Toggle Statut Médical */}
                            <button
                              onClick={() => {
                                const next = c.medical_status === 'En instance' ? 'Effectué' : 'En instance';
                                dataService.updateCandidate(c.id, { medical_status: next });
                              }}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all flex items-center gap-1 ${
                                c.medical_status === 'Effectué'
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                                  : 'bg-amber-950 text-amber-300 border-amber-700'
                              }`}
                            >
                              {c.medical_status === 'Effectué' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              <span>{c.medical_status}</span>
                            </button>
                          </div>

                          {/* Contrôle Financier */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[11px]">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">Montant :</span>
                              <input
                                type="number"
                                value={c.financial_amount}
                                onChange={(e) => dataService.updateCandidate(c.id, { financial_amount: parseFloat(e.target.value) || 0 })}
                                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-white font-mono text-[11px]"
                              />
                              <span className="text-slate-400">€</span>
                            </div>

                            {/* Toggle Payé / Non payé */}
                            <button
                              onClick={() => {
                                const nextPay = c.financial_status === 'Payé' ? 'Non payé' : 'Payé';
                                dataService.updateCandidate(c.id, { financial_status: nextPay });
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                c.financial_status === 'Payé'
                                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                                  : 'bg-rose-950/80 text-rose-400 border-rose-800'
                              }`}
                            >
                              {c.financial_status === 'Payé' ? 'Payé' : 'Non payé'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ONGLET 2 : BANC D'ESSAI CALCUL D'ÂGE STCW */}
          {activeTab === 'age' && (
            <div className="max-w-xl mx-auto space-y-5 py-4">
              <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  Testeur d'Algorithme de Calcul d'Âge Maritime
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Conformément aux normes OMI / STCW, l'âge doit être calculé au jour près avec détection des mineurs et seuils d'aptitude.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Tester une Date de Naissance :
                  </label>
                  <input
                    type="date"
                    value={demoBirthDate}
                    onChange={(e) => setDemoBirthDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Résultat Calculé */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs text-slate-400">Âge exact calculé :</div>
                  <div className="text-3xl font-extrabold text-white flex items-baseline gap-2">
                    <span className="text-amber-400">{calculatedDemoAge ?? '--'}</span>
                    <span className="text-sm text-slate-400">ans révolus</span>
                  </div>

                  <div className="pt-2 border-t border-slate-800 text-xs">
                    <span className="text-slate-500">Statut Réglementaire Maritime : </span>
                    {demoAgeValidation.isValid ? (
                      <span className="text-emerald-400 font-bold">
                        {calculatedDemoAge && calculatedDemoAge >= 18 ? 'Aptitude Majeur STCW Valide' : demoAgeValidation.message}
                      </span>
                    ) : (
                      <span className="text-rose-400 font-bold">{demoAgeValidation.message}</span>
                    )}
                  </div>
                </div>

                {/* Exemples rapides */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    onClick={() => setDemoBirthDate('2008-05-10')}
                    className="text-xs bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded text-slate-300"
                  >
                    Exemple Mineur (17 ans)
                  </button>
                  <button
                    onClick={() => setDemoBirthDate('1998-12-05')}
                    className="text-xs bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded text-slate-300"
                  >
                    Exemple Marin (27 ans)
                  </button>
                  <button
                    onClick={() => setDemoBirthDate('1948-02-14')}
                    className="text-xs bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded text-slate-300"
                  >
                    Exemple Senior (78 ans)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ONGLET 3 : TESTEUR DE CLÉS DE LICENCE */}
          {activeTab === 'licenses' && (
            <div className="max-w-xl mx-auto space-y-5 py-4">
              <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-emerald-400" />
                  Générateur de Clés de Licence (Faisant office de token)
                </h4>

                <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold">
                  <button
                    onClick={() => setLicenseType('medecin')}
                    className={`py-2 rounded-lg transition-all ${licenseType === 'medecin' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
                  >
                    Licence Médecin
                  </button>
                  <button
                    onClick={() => setLicenseType('societe')}
                    className={`py-2 rounded-lg transition-all ${licenseType === 'societe' ? 'bg-cyan-600 text-white' : 'text-slate-400'}`}
                  >
                    Licence Société
                  </button>
                </div>

                <button
                  onClick={handleTestGenerateLicense}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Générer un exemple de clé cryptographique</span>
                </button>

                {sampleLicense && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/50 space-y-2">
                    <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">Clé générée :</span>
                    <div className="font-mono text-sm font-extrabold text-white bg-slate-900 p-2.5 rounded border border-slate-800 text-center select-all">
                      {sampleLicense}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ONGLET 4 : AUTO-COMPLÉTION COMPAGNIES */}
          {activeTab === 'companies' && (
            <div className="max-w-xl mx-auto space-y-5 py-4">
              <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Ship className="w-5 h-5 text-maritime-400" />
                  Auto-Alimentation de la Table Compagnies de Croisière
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Toute nouvelle compagnie saisie lors de la création d'un candidat est immédiatement insérée dans la table en base de données et devient disponible pour l'auto-complétion.
                </p>

                <form onSubmit={handleAddCustomCompany} className="flex gap-2">
                  <input
                    type="text"
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="ex: Virgin Voyages, Oceania Cruises..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-maritime-600 hover:bg-maritime-500 text-white text-xs font-bold shrink-0"
                  >
                    Ajouter
                  </button>
                </form>

                <div className="pt-2">
                  <div className="text-xs font-bold text-slate-400 mb-2">
                    Compagnies Actuelles Disponibles ({companies.length}) :
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                    {companies.map((comp, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300"
                      >
                        {comp}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Pied du Banc d'Essai */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400 px-6">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Environnement de test isolé pour CruisePocket PWA
          </span>
          <button
            onClick={onClose}
            className="text-cyan-400 hover:underline font-semibold"
          >
            Fermer le Bac à Sable
          </button>
        </div>

      </div>
    </div>
  );
};
