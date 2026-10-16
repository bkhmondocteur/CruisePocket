import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../lib/supabase';
import { calculateAge, validateMaritimeAge } from '../../utils/age';
import { Civility, ContractType, Candidate } from '../../types';
import { PassportViewerModal } from '../common/PassportViewerModal';
import { 
  Building2, 
  Send, 
  UploadCloud, 
  FileCheck, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Calendar, 
  Ship, 
  Briefcase, 
  Clock,
  FileText,
  Trash2,
  Bell,
  Archive,
  ArchiveRestore,
  X
} from 'lucide-react';
import { CandidateFicheModal } from '../common/CandidateFicheModal';

export const CompanyDashboard: React.FC = () => {
  const { companyProfile } = useAuth();
  
  // Form State
  const [civility, setCivility] = useState<Civility>('M.');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [cruiseCompany, setCruiseCompany] = useState('');
  const [position, setPosition] = useState('');
  const [contractType, setContractType] = useState<ContractType>('Nouveau contrat');
  const [embarkationDate, setEmbarkationDate] = useState('');
  const [passportFile, setPassportFile] = useState<File | null>(null);

  // Auto-completion list
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Status & Feedback
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Notification mutuelle de suppression reçue du médecin
  const [deletionNotice, setDeletionNotice] = useState<{
    candidateName: string;
    author: string;
    role: string;
    time: string;
  } | null>(null);

  // History list & Tabs (Actifs vs Archivés)
  const [recentTransfers, setRecentTransfers] = useState<Candidate[]>([]);
  const [transferTab, setTransferTab] = useState<'actifs' | 'archives'>('actifs');

  // Modal fiche candidat & Passeport
  const [selectedFicheCandidate, setSelectedFicheCandidate] = useState<Candidate | null>(null);
  const [selectedPassportCandidate, setSelectedPassportCandidate] = useState<Candidate | null>(null);

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Calcul automatique de l'âge
  const calculatedAge = calculateAge(birthDate);
  const ageValidation = validateMaritimeAge(calculatedAge);

  // Charger les compagnies pour l'autocomplétion & l'historique
  useEffect(() => {
    loadCruiseCompanies();
    loadTransfers();

    // Écouter les mises à jour réactives (y compris suppressions mutuelles)
    const unsubscribe = dataService.subscribeToCandidates((event) => {
      loadTransfers();
      loadCruiseCompanies();

      if (event.type === 'CANDIDATE_DELETED' && event.deletion) {
        // Notification mutuelle si l'action vient du médecin
        if (event.deletion.deletedBy.role === 'medecin') {
          setDeletionNotice({
            candidateName: event.deletion.candidateName,
            author: event.deletion.deletedBy.name,
            role: 'le Médecin',
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteCandidate = async (candidate: Candidate) => {
    const confirmDelete = window.confirm(
      `Êtes-vous sûr de vouloir supprimer définitivement le dossier de ${candidate.civility} ${candidate.last_name} ${candidate.first_name} ?\n\nLe Médecin en sera immédiatement notifié en temps réel.`
    );
    if (!confirmDelete) return;

    try {
      await dataService.deleteCandidate(candidate.id, {
        role: 'societe',
        name: companyProfile?.name || 'Société de Service'
      });
      await loadTransfers();
      setSuccessMessage(`Le dossier de ${candidate.civility} ${candidate.last_name} a été supprimé. Le médecin a été notifié en direct.`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch {
      setErrorMessage("Erreur lors de la suppression du dossier.");
    }
  };

  const loadCruiseCompanies = async () => {
    const list = await dataService.getCruiseCompanies();
    setCompanySuggestions(list);
  };

  const loadTransfers = async () => {
    const all = await dataService.getCandidates();
    setRecentTransfers(all);
  };

  const handleCruiseCompanyChange = (val: string) => {
    setCruiseCompany(val);
    if (val.trim().length > 0) {
      const matches = companySuggestions.filter(c => 
        c.toLowerCase().includes(val.toLowerCase())
      );
      setFilteredSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (name: string) => {
    setCruiseCompany(name);
    setShowSuggestions(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPassportFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (calculatedAge === null) {
      setErrorMessage("Veuillez renseigner une date de naissance valide pour calculer l'âge.");
      return;
    }

    if (!passportNumber.trim()) {
      setErrorMessage("Le numéro de passeport est obligatoire.");
      return;
    }

    if (!cruiseCompany.trim()) {
      setErrorMessage("La compagnie de croisière est obligatoire.");
      return;
    }

    setLoading(true);

    try {
      let passportUrl: string | undefined = undefined;
      if (passportFile) {
        try {
          passportUrl = await fileToDataUrl(passportFile);
        } catch {
          passportUrl = URL.createObjectURL(passportFile);
        }
      }

      const candidatePayload = {
        civility,
        last_name: lastName.trim().toUpperCase(),
        first_name: firstName.trim(),
        birth_date: birthDate,
        age: calculatedAge,
        passport_number: passportNumber.trim().toUpperCase(),
        passport_file_name: passportFile ? passportFile.name : undefined,
        passport_file_url: passportUrl,
        cruise_company: cruiseCompany.trim(),
        position: position.trim(),
        contract_type: contractType,
        embarkation_date: embarkationDate,
        medical_status: 'En instance' as const,
        financial_amount: 180.00,
        financial_status: 'Non payé' as const,
        payer_name: 'La société' as const,
        service_company_id: companyProfile?.id,
        service_company_name: companyProfile?.name || 'Société de Service Maritime'
      };

      await dataService.addCandidate(candidatePayload);

      // Notification de succès
      setSuccessMessage(
        `Le dossier de ${civility} ${lastName.toUpperCase()} ${firstName} a été transmis en temps réel au Médecin avec succès !`
      );

      // Vider le formulaire comme demandé dans les specs
      setLastName('');
      setFirstName('');
      setBirthDate('');
      setPassportNumber('');
      setCruiseCompany('');
      setPosition('');
      setContractType('Nouveau contrat');
      setEmbarkationDate('');
      setPassportFile(null);

      // Recharger l'historique et les compagnies
      await loadTransfers();
      await loadCruiseCompanies();

      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de l'envoi du dossier au médecin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-8">
      
      {/* Bannière d'accueil Espace Société */}
      <div className="glass-panel rounded-2xl p-6 border-l-4 border-maritime-500 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-maritime-950 text-maritime-300 border border-maritime-800 mb-2">
            <Building2 className="w-3.5 h-3.5" />
            Fournisseur Agréé Maritime
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Espace Société : {companyProfile?.name || 'Gestion Crewing'}
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Responsable : {companyProfile?.manager_name} | Localisation : {companyProfile?.location}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-xl text-center">
            <div className="text-xs text-slate-400">Dossiers transmis</div>
            <div className="text-xl font-bold text-cyan-400">{recentTransfers.length}</div>
          </div>
        </div>
      </div>

      {/* Notification Mutuelle en Direct si le Médecin supprime un dossier */}
      {deletionNotice && (
        <div className="p-4 rounded-2xl bg-amber-950/80 border border-amber-500/70 text-amber-200 text-xs shadow-xl flex items-start justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-900/60 text-amber-300 mt-0.5">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <div className="font-bold text-white text-sm flex items-center gap-2">
                <span>Notification Mutuelle : Dossier Supprimé</span>
                <span className="text-[10px] bg-amber-900/80 px-2 py-0.5 rounded text-amber-300 font-mono">
                  {deletionNotice.time}
                </span>
              </div>
              <p className="mt-1 text-amber-200/90 leading-relaxed">
                Le dossier du marin <strong>{deletionNotice.candidateName}</strong> a été retiré par {deletionNotice.role} (<strong>{deletionNotice.author}</strong>). Votre liste a été synchronisée en temps réel.
              </p>
            </div>
          </div>
          <button
            onClick={() => setDeletionNotice(null)}
            className="p-1.5 text-amber-400 hover:text-white rounded-lg hover:bg-amber-900/60 transition-colors"
            title="Fermer la notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Grille principale : Formulaire d'ajout + Historique rapide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* COLONNE GAUCHE (7 cols) : FORMULAIRE CANDIDAT */}
        <div className="lg:col-span-7 glass-panel rounded-2xl p-6 sm:p-7 border border-slate-800 shadow-xl">
          
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-400" />
                Nouveau Dossier Marin / Candidat
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Remplissez les informations administratives du marin à transmettre au médecin
              </p>
            </div>
            <span className="text-[11px] font-medium text-slate-500 bg-slate-900 px-2 py-1 rounded-md border border-slate-800">
              STCW / Maritime
            </span>
          </div>

          {/* Alertes Success / Error */}
          {successMessage && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-sm flex items-start gap-3 animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Transmission réussie !</p>
                <p className="text-xs mt-0.5 text-emerald-200">{successMessage}</p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 p-4 rounded-xl bg-rose-950/80 border border-rose-500/50 text-rose-300 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Erreur de saisie</p>
                <p className="text-xs mt-0.5 text-rose-200">{errorMessage}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* LIGNE 1 : Civilité, Nom, Prénom */}
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Civilité *</label>
                <select
                  value={civility}
                  onChange={(e) => setCivility(e.target.value as Civility)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-maritime-500"
                >
                  <option value="M.">M.</option>
                  <option value="Mme">Mme</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>

              <div className="col-span-12 sm:col-span-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Nom de famille *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="ex: DUPONT"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white uppercase placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-maritime-500"
                />
              </div>

              <div className="col-span-12 sm:col-span-5">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Prénom *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="ex: Thomas"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-maritime-500"
                />
              </div>
            </div>

            {/* LIGNE 2 : Date de naissance + CALCUL AUTOMATIQUE DE L'ÂGE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  Date de naissance *
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-maritime-500"
                />
              </div>

              {/* CHAMP DYNAMIQUE CALCULÉ & AFFICHÉ */}
              <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Âge calculé automatiquement :
                  </div>
                  <div className="text-xl font-extrabold text-white flex items-baseline gap-1 mt-0.5">
                    {calculatedAge !== null ? (
                      <>
                        <span className="text-cyan-300">{calculatedAge}</span>
                        <span className="text-xs text-slate-400 font-normal">ans</span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 font-normal italic">En attente de date...</span>
                    )}
                  </div>
                </div>

                {calculatedAge !== null && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    calculatedAge >= 18 
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                      : 'bg-amber-950 text-amber-400 border border-amber-800'
                  }`}>
                    {calculatedAge >= 18 ? 'Majeur STCW' : 'Mineur'}
                  </span>
                )}
              </div>

              {ageValidation.message && (
                <div className="sm:col-span-2 text-xs text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {ageValidation.message}
                </div>
              )}
            </div>

            {/* LIGNE 3 : Numéro de passeport & Upload copie */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Numéro de passeport *
                </label>
                <input
                  type="text"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value.toUpperCase())}
                  placeholder="ex: 24FR98745"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-maritime-500 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <UploadCloud className="w-3.5 h-3.5 text-cyan-400" />
                  Copie du passeport (PDF / Image)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    id="passport-upload"
                    accept=".pdf,image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="passport-upload"
                    className="w-full cursor-pointer bg-slate-950 hover:bg-slate-900 border border-dashed border-slate-700 hover:border-maritime-500 rounded-xl px-3.5 py-2 text-xs text-slate-300 flex items-center justify-between transition-all"
                  >
                    <span className="truncate max-w-[180px]">
                      {passportFile ? passportFile.name : 'Sélectionner un fichier...'}
                    </span>
                    <span className="bg-slate-800 text-[10px] text-cyan-400 font-bold px-2 py-1 rounded">
                      Parcourir
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* LIGNE 4 : Compagnie de Croisière (AUTO-COMPLÉTION DYNAMIQUE) */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Ship className="w-3.5 h-3.5 text-cyan-400" />
                  Compagnie de croisière (Auto-complétion) *
                </span>
                <span className="text-[10px] text-slate-500 italic">S'auto-alimente si nouvelle</span>
              </label>
              
              <input
                type="text"
                value={cruiseCompany}
                onChange={(e) => handleCruiseCompanyChange(e.target.value)}
                onFocus={() => {
                  if (cruiseCompany.trim().length > 0 && filteredSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                placeholder="ex: MSC Croisières, Ponant, Royal Caribbean..."
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-maritime-500"
              />

              {/* Liste déroulante des suggestions */}
              {showSuggestions && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                  {filteredSuggestions.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => selectSuggestion(item)}
                      className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-maritime-600 hover:text-white transition-colors flex items-center justify-between"
                    >
                      <span>{item}</span>
                      <Ship className="w-3 h-3 opacity-60" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* LIGNE 5 : Poste & Type de Contrat */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-cyan-400" />
                  Poste / Fonction à bord *
                </label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="ex: Chef Mécanicien, Barman, Matelot..."
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-maritime-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Type de contrat *
                </label>
                <select
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value as ContractType)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-maritime-500"
                >
                  <option value="Nouveau contrat">Nouveau contrat</option>
                  <option value="Contrat intermédiaire">Contrat intermédiaire</option>
                  <option value="Renouvellement de contrat">Renouvellement de contrat</option>
                </select>
              </div>
            </div>

            {/* LIGNE 6 : Date prévue d'embarquement */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Date prévue d'embarquement *
              </label>
              <input
                type="date"
                value={embarkationDate}
                onChange={(e) => setEmbarkationDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-maritime-500"
              />
            </div>

            {/* ACTION FINALE : ENVOYER POUR LE MÉDECIN */}
            <div className="pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-maritime-600 via-cyan-600 to-emerald-600 hover:from-maritime-500 hover:to-emerald-500 shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2.5 transition-all transform active:scale-[0.99] disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Envoyer pour le Médecin</span>
                  </>
                )}
              </button>
            </div>

          </form>

        </div>

        {/* COLONNE DROITE (5 cols) : SUIVI DES ENVOIS EN TEMPS RÉEL */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl">
            
            {/* En-tête avec onglets Actifs vs Archivés (> 1 mois) */}
            <div className="flex flex-col gap-3 pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  Dossiers Transmis
                </h3>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                  {recentTransfers.length} total
                </span>
              </div>

              {/* Onglets Actifs / Archivés */}
              <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setTransferTab('actifs')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                    transferTab === 'actifs'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Dossiers Actifs</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 text-slate-300">
                    {recentTransfers.filter(c => !c.is_archived).length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTransferTab('archives')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                    transferTab === 'archives'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Archive className="w-3 h-3 text-purple-400" />
                  <span>Archivés (&gt; 1 mois)</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-950 text-purple-300 border border-purple-800">
                    {recentTransfers.filter(c => Boolean(c.is_archived)).length}
                  </span>
                </button>
              </div>
            </div>

            {recentTransfers.filter(c => transferTab === 'actifs' ? !c.is_archived : Boolean(c.is_archived)).length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                {transferTab === 'actifs' 
                  ? "Aucun dossier actif pour le moment." 
                  : "Aucun dossier de plus d'un mois archivé."}
              </div>
            ) : (
              <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                {recentTransfers
                  .filter(c => transferTab === 'actifs' ? !c.is_archived : Boolean(c.is_archived))
                  .map((cand) => (
                  <div
                    key={cand.id}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition-all text-xs space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-white text-sm">
                          {cand.civility} {cand.last_name} {cand.first_name}
                        </div>
                        <div className="text-slate-400 text-[11px] flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span>{cand.position} • {cand.cruise_company}</span>
                          <span>•</span>
                          <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                            cand.contract_type === 'Renouvellement de contrat' || cand.contract_type === 'Contrat intermédiaire'
                              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                              : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}>
                            {cand.contract_type}
                          </span>
                        </div>
                      </div>

                      {/* Badge Statut Médical */}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        cand.medical_status === 'Effectué'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse'
                      }`}>
                        {cand.medical_status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900 text-[11px] text-slate-400">
                      <div>
                        <span className="text-slate-500">Passeport: </span>
                        <span className="font-mono text-cyan-400 font-semibold">{cand.passport_number}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Âge: </span>
                        <span className="text-slate-300 font-semibold">{cand.age} ans</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Embarquement: </span>
                        <span className="text-slate-300">{cand.embarkation_date}</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Paiement: </span>
                        <span className={cand.financial_status === 'Payé' ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                          {cand.financial_status} ({cand.financial_amount} DT)
                        </span>
                      </div>
                    </div>

                    {/* Actions : Supprimer dossier + Fiche Candidat + Consulter passeport */}
                    <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleDeleteCandidate(cand)}
                        className="text-[10px] text-slate-500 hover:text-rose-400 flex items-center gap-1 font-semibold transition-colors group"
                        title="Supprimer ce dossier et notifier le médecin"
                      >
                        <Trash2 className="w-3 h-3 group-hover:scale-110 transition-transform" />
                        <span>Supprimer</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedFicheCandidate(cand)}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-semibold"
                          title={cand.is_archived ? "Ouvrir la fiche archivée (récupération instantanée)" : "Ouvrir la fiche complète"}
                        >
                          {cand.is_archived ? <ArchiveRestore className="w-3 h-3 text-amber-400" /> : <FileText className="w-3 h-3" />}
                          <span>{cand.is_archived ? 'Ouvrir (Archive)' : 'Fiche Candidat'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedPassportCandidate(cand)}
                          className="text-[10px] text-slate-400 hover:text-slate-200 hover:underline flex items-center gap-1"
                        >
                          <span>Passeport</span>
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Modal Visualiseur de Passeport */}
      <PassportViewerModal
        isOpen={Boolean(selectedPassportCandidate)}
        onClose={() => setSelectedPassportCandidate(null)}
        fileName={selectedPassportCandidate?.passport_file_name}
        fileUrl={selectedPassportCandidate?.passport_file_url}
        candidateName={selectedPassportCandidate ? `${selectedPassportCandidate.civility} ${selectedPassportCandidate.last_name} ${selectedPassportCandidate.first_name}` : undefined}
        passportNumber={selectedPassportCandidate?.passport_number}
      />

      {/* Modal Fiche Candidat avec Récupération Instantanée & Réarchivage à la Sortie */}
      <CandidateFicheModal
        isOpen={Boolean(selectedFicheCandidate)}
        candidate={selectedFicheCandidate}
        onClose={() => setSelectedFicheCandidate(null)}
        onUpdate={loadTransfers}
        userRole="societe"
      />

    </div>
  );
};
