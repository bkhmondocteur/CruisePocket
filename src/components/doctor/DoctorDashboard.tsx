import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../lib/supabase';
import { Candidate, MedicalStatus, FinancialStatus, PayerName } from '../../types';
import { FinancialStats } from './FinancialStats';
import { PassportViewerModal } from '../common/PassportViewerModal';
import { 
  Stethoscope, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Ship, 
  Search, 
  Sparkles,
  BarChart3,
  Calendar,
  CreditCard,
  Trash2,
  Bell,
  Archive,
  ArchiveRestore,
  X
} from 'lucide-react';
import { CandidateFicheModal } from '../common/CandidateFicheModal';

export const DoctorDashboard: React.FC = () => {
  const { doctorProfile } = useAuth();
  
  // Data state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Active view: 'dashboard' vs 'stats'
  const [currentView, setCurrentView] = useState<'dashboard' | 'stats'>('dashboard');

  // Medical status tab: 'En instance' (par défaut) vs 'Effectué' vs 'Archivés'
  const [statusTab, setStatusTab] = useState<'En instance' | 'Effectué' | 'Archivés'>('En instance');

  // Modal fiche complète / récupération instantanée
  const [selectedFicheCandidate, setSelectedFicheCandidate] = useState<Candidate | null>(null);

  // New incoming notification pulse
  const [hasNewAlert, setHasNewAlert] = useState(false);

  // Notification mutuelle de suppression reçue de la société
  const [deletionNotice, setDeletionNotice] = useState<{
    candidateName: string;
    author: string;
    role: string;
    time: string;
  } | null>(null);

  // Passport preview modal
  const [selectedPassportCandidate, setSelectedPassportCandidate] = useState<Candidate | null>(null);
  const [filterMyDossiersOnly, setFilterMyDossiersOnly] = useState<boolean>(false);

  // Charger les dossiers & écouter en temps réel
  useEffect(() => {
    fetchCandidates();

    // Écouteur en temps réel (Supabase Realtime ou BroadcastChannel multi-onglets)
    const unsubscribe = dataService.subscribeToCandidates((event) => {
      fetchCandidates();
      if (event.type === 'CANDIDATE_ADDED') {
        setHasNewAlert(true);
        setTimeout(() => setHasNewAlert(false), 5000);
      } else if (event.type === 'CANDIDATE_DELETED' && event.deletion) {
        // Notification mutuelle si l'action vient d'une société
        if (event.deletion.deletedBy.role === 'societe') {
          setDeletionNotice({
            candidateName: event.deletion.candidateName,
            author: event.deletion.deletedBy.name,
            role: 'la Société de Service',
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
          });
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteCandidate = async (candidate: Candidate) => {
    const confirmDelete = window.confirm(
      `Êtes-vous sûr de vouloir supprimer définitivement le dossier de ${candidate.civility} ${candidate.last_name} ${candidate.first_name} ?\n\nLa Société de Service (${candidate.service_company_name}) sera immédiatement notifiée en temps réel.`
    );
    if (!confirmDelete) return;

    try {
      await dataService.deleteCandidate(candidate.id, {
        role: 'medecin',
        name: doctorProfile?.full_name || 'Dr. Médecin Agréé'
      });
      await fetchCandidates();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la suppression du dossier.");
    }
  };

  const fetchCandidates = async () => {
    try {
      const data = await dataService.getCandidates();
      setCandidates(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle du statut médical : "En instance" <-> "Effectué"
  const handleToggleMedicalStatus = async (candidate: Candidate) => {
    const nextStatus: MedicalStatus = candidate.medical_status === 'En instance' ? 'Effectué' : 'En instance';
    
    // Optimistic update
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidate.id ? { ...c, medical_status: nextStatus } : c))
    );

    await dataService.updateCandidate(candidate.id, {
      medical_status: nextStatus,
      doctor_id: doctorProfile?.id,
      doctor_name: doctorProfile?.full_name
    });
  };

  // Mise à jour du montant financier
  const handleAmountChange = async (candidateId: string, amount: number) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, financial_amount: amount } : c))
    );
    await dataService.updateCandidate(candidateId, { financial_amount: amount });
  };

  // Toggle du statut financier : "Payé" <-> "Non payé"
  const handleToggleFinancialStatus = async (candidate: Candidate) => {
    const nextStatus: FinancialStatus = candidate.financial_status === 'Payé' ? 'Non payé' : 'Payé';
    
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidate.id ? { ...c, financial_status: nextStatus } : c))
    );

    await dataService.updateCandidate(candidate.id, { financial_status: nextStatus });
  };

  // Mise à jour du payeur : "Le candidat lui-même" <-> "La société"
  const handlePayerChange = async (candidateId: string, payer: PayerName) => {
    setCandidates((prev) =>
      prev.map((c) => (c.id === candidateId ? { ...c, payer_name: payer } : c))
    );
    await dataService.updateCandidate(candidateId, { payer_name: payer });
  };

  // Séparation Actifs vs Archivés (> 1 mois)
  const activeCandidates = candidates.filter((c) => !c.is_archived);
  const pendingCandidates = activeCandidates.filter((c) => c.medical_status === 'En instance');
  const completedCandidates = activeCandidates.filter((c) => c.medical_status === 'Effectué');
  const archivedCandidates = candidates.filter((c) => Boolean(c.is_archived));

  let currentTabList: Candidate[] = [];
  if (statusTab === 'En instance') {
    currentTabList = pendingCandidates;
  } else if (statusTab === 'Effectué') {
    currentTabList = completedCandidates;
  } else {
    currentTabList = archivedCandidates;
  }

  const displayedList = currentTabList.filter((c) => {
    // Filtre médecin destinataire
    if (filterMyDossiersOnly && doctorProfile?.full_name) {
      const isAssignedToMe = c.doctor_name === doctorProfile.full_name || c.doctor_id === doctorProfile.id;
      if (!isAssignedToMe) return false;
    }

    const q = searchTerm.toLowerCase();
    return (
      c.last_name.toLowerCase().includes(q) ||
      c.first_name.toLowerCase().includes(q) ||
      c.passport_number.toLowerCase().includes(q) ||
      c.cruise_company.toLowerCase().includes(q) ||
      c.service_company_name.toLowerCase().includes(q) ||
      (c.doctor_name && c.doctor_name.toLowerCase().includes(q))
    );
  });

  // Si l'utilisateur consulte le Bilan Financier
  if (currentView === 'stats') {
    return (
      <FinancialStats
        candidates={candidates}
        onBack={() => setCurrentView('dashboard')}
      />
    );
  }

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
      
      {/* En-tête Espace Médecin */}
      <div className="glass-panel rounded-2xl p-6 border-l-4 border-emerald-500 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 mb-2">
            <Stethoscope className="w-3.5 h-3.5" />
            Médecin Agréé Maritime
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {doctorProfile?.full_name || 'Cabinet Médical Maritime'}
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            N° d'Ordre : <strong className="text-slate-300">{doctorProfile?.order_number}</strong> | Lieu d'exercice : <strong className="text-slate-300">{doctorProfile?.practice_location}</strong>
          </p>
        </div>

        {/* Bouton vers Module Bilan Financier & Alerte Réception */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentView('stats')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs shadow-md transition-all group"
          >
            <BarChart3 className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span>Bilan Financier & Paramètres</span>
          </button>
        </div>
      </div>

      {/* Alerte Temps Réel quand un nouveau marin arrive */}
      {hasNewAlert && (
        <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950 to-maritime-950 border border-cyan-500/60 text-cyan-200 text-xs font-semibold flex items-center justify-between shadow-lg animate-bounce">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Nouveau dossier candidat reçu en direct d'une société partenaire !</span>
          </div>
          <span className="bg-cyan-800 text-white px-2 py-0.5 rounded text-[10px]">Temps Réel</span>
        </div>
      )}

      {/* Alerte Temps Réel quand un dossier est supprimé par une société de service */}
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
            title="Fermer cette notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Barre de Filtre & Recherche & Onglets En instance / Effectué */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Onglets de Statut Médical (En instance par défaut vs Effectué) */}
        <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 w-full sm:w-auto">
          <button
            onClick={() => setStatusTab('En instance')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              statusTab === 'En instance'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>En instance</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-950 text-amber-300 border border-amber-800">
              {pendingCandidates.length}
            </span>
          </button>

          <button
            onClick={() => setStatusTab('Effectué')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              statusTab === 'Effectué'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Effectué</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800">
              {completedCandidates.length}
            </span>
          </button>

          <button
            onClick={() => setStatusTab('Archivés')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              statusTab === 'Archivés'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Archive className="w-3.5 h-3.5 text-purple-400" />
            <span>Archivés (&gt; 1 mois)</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-950 text-purple-300 border border-purple-800">
              {archivedCandidates.length}
            </span>
          </button>
        </div>

        {/* Barre de Recherche & Filtre Médecin */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
          {doctorProfile?.full_name && (
            <button
              type="button"
              onClick={() => setFilterMyDossiersOnly(!filterMyDossiersOnly)}
              className={`w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                filterMyDossiersOnly
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-500 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
              title="Filtrer uniquement les dossiers affectés à votre cabinet"
            >
              <Stethoscope className="w-3.5 h-3.5 text-emerald-400" />
              <span>{filterMyDossiersOnly ? 'Mes dossiers uniquement' : 'Tous les dossiers'}</span>
            </button>
          )}

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher marin, passeport, médecin..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          </div>
        </div>

      </div>

      {/* LISTE DES DOSSIERS SOUS FORME DE CARTES */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          Chargement des dossiers médicaux...
        </div>
      ) : displayedList.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center text-slate-500">
            {statusTab === 'En instance' ? <Clock className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
          </div>
          <h4 className="text-base font-bold text-white">
            Aucun dossier "{statusTab}" pour le moment
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {statusTab === 'En instance' 
              ? 'Dès qu’une société de service transmet un nouveau marin, il apparaîtra ici en temps réel.'
              : 'Les visites d’aptitude terminées seront archivées sous cet onglet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedList.map((cand) => (
            <div
              key={cand.id}
              className={`glass-panel rounded-2xl p-5 border transition-all shadow-xl flex flex-col justify-between space-y-4 ${
                cand.medical_status === 'Effectué'
                  ? 'border-emerald-900/60 hover:border-emerald-600/50'
                  : 'border-slate-800 hover:border-amber-500/40'
              }`}
            >
              
              {/* EN-TÊTE CARTE : NOM DU CANDIDAT & STATUT */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">
                      {cand.passport_number}
                    </span>
                    <h3 className="text-lg font-bold text-white">
                      {cand.civility} {cand.last_name} {cand.first_name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* BOUTON TOGGLE STATUT MÉDICAL (En instance <-> Effectué) */}
                    <button
                      onClick={() => handleToggleMedicalStatus(cand)}
                      title="Cliquer pour basculer le statut médical"
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${
                        cand.medical_status === 'Effectué'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800 hover:bg-emerald-900'
                          : 'bg-amber-950 text-amber-400 border-amber-800 hover:bg-amber-900'
                      }`}
                    >
                      {cand.medical_status === 'Effectué' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                      <span>{cand.medical_status}</span>
                    </button>

                    {/* BOUTON SUPPRIMER LE DOSSIER AVEC NOTIFICATION MUTUELLE */}
                    <button
                      type="button"
                      onClick={() => handleDeleteCandidate(cand)}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                      title="Supprimer ce dossier et notifier la société"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Métadonnées du Marin */}
                <div className="mt-2.5 space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Ship className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="font-semibold text-white">{cand.cruise_company}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400">{cand.position}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Âge : <strong className="text-slate-200">{cand.age} ans</strong> ({cand.birth_date})</span>
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                      cand.contract_type === 'Renouvellement de contrat' || cand.contract_type === 'Contrat intermédiaire'
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}>
                      {cand.contract_type}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-0.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      Embarquement : {cand.embarkation_date}
                    </span>
                    <span className="text-slate-500 truncate max-w-[120px]" title={cand.service_company_name}>
                      Via: {cand.service_company_name}
                    </span>
                  </div>

                  {/* Médecin Destinataire */}
                  <div className="text-[11px] pt-1.5 border-t border-slate-900/80 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Stethoscope className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Destinataire : <strong className="text-emerald-300">{cand.doctor_name || 'Dr. Jean-Marc FERRARI'}</strong></span>
                    </span>
                    {doctorProfile?.full_name && (cand.doctor_name === doctorProfile.full_name || cand.doctor_id === doctorProfile.id) && (
                      <span className="text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded">
                        Affecté à vous
                      </span>
                    )}
                  </div>
                </div>

                {/* Pièce jointe passeport */}
                <div 
                  onClick={() => setSelectedPassportCandidate(cand)}
                  className="mt-2.5 p-2 rounded-lg bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-between text-[11px] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-slate-300 truncate">
                    <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate">{cand.passport_file_name || `Passeport N° ${cand.passport_number}`}</span>
                  </div>
                  <span className="text-cyan-400 font-semibold hover:underline">Consulter</span>
                </div>
              </div>

              {/* SECTION GESTION FINANCIÈRE (Sur chaque carte dossier) */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2.5 bg-slate-950/40 p-3 rounded-xl border border-slate-800/40">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-emerald-400" />
                    Gestion Financière
                  </span>
                  
                  {/* TOGGLE PAYÉ / NON PAYÉ */}
                  <button
                    onClick={() => handleToggleFinancialStatus(cand)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                      cand.financial_status === 'Payé'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        : 'bg-rose-950 text-rose-300 border-rose-700'
                    }`}
                  >
                    {cand.financial_status === 'Payé' ? '✓ Payé' : '✕ Non payé'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Champ Montant en Dinars Tunisiens (DT) */}
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Montant (DT)</label>
                    <input
                      type="number"
                      step="5"
                      min="0"
                      value={cand.financial_amount}
                      onChange={(e) => handleAmountChange(cand.id, parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Sélecteur Nom du Payeur */}
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Payeur</label>
                    <select
                      value={cand.payer_name}
                      onChange={(e) => handlePayerChange(cand.id, e.target.value as PayerName)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-1.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Le candidat lui-même">Candidat</option>
                      <option value="La société">Société</option>
                    </select>
                  </div>
                </div>

                {/* BOUTON OUVRIR FICHE CANDIDAT / RÉCUPÉRATION ARCHIVE INSTANTANÉE */}
                <button
                  type="button"
                  onClick={() => setSelectedFicheCandidate(cand)}
                  className="w-full mt-2 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-cyan-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm group"
                >
                  {cand.is_archived ? (
                    <>
                      <ArchiveRestore className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
                      <span>Ouvrir Fiche (Récupération Instantanée)</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                      <span>Consulter Fiche Complète</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* MODAL DE PRÉVISUALISATION DU PASSEPORT */}
      <PassportViewerModal
        isOpen={Boolean(selectedPassportCandidate)}
        onClose={() => setSelectedPassportCandidate(null)}
        fileName={selectedPassportCandidate?.passport_file_name}
        fileUrl={selectedPassportCandidate?.passport_file_url}
        candidateName={selectedPassportCandidate ? `${selectedPassportCandidate.civility} ${selectedPassportCandidate.last_name} ${selectedPassportCandidate.first_name}` : undefined}
        passportNumber={selectedPassportCandidate?.passport_number}
      />

      {/* MODAL FICHE CANDIDAT AVEC GESTION DE SORTIE & RÉARCHIVAGE CONDITIONNEL */}
      <CandidateFicheModal
        isOpen={Boolean(selectedFicheCandidate)}
        candidate={selectedFicheCandidate}
        onClose={() => setSelectedFicheCandidate(null)}
        onUpdate={fetchCandidates}
        userRole="medecin"
      />

    </div>
  );
};
