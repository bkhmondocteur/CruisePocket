import React, { useState, useEffect } from 'react';
import { Candidate, ContractType, MedicalStatus, FinancialStatus, PayerName } from '../../types';
import { dataService } from '../../lib/supabase';
import { PassportViewerModal } from './PassportViewerModal';
import { 
  User, 
  Ship, 
  FileText, 
  CreditCard, 
  Archive, 
  ArchiveRestore, 
  CheckCircle2, 
  Clock, 
  X, 
  AlertTriangle,
  Stethoscope
} from 'lucide-react';

interface CandidateFicheModalProps {
  candidate: Candidate | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
  userRole?: 'medecin' | 'societe';
}

export const CandidateFicheModal: React.FC<CandidateFicheModalProps> = ({
  candidate,
  isOpen,
  onClose,
  onUpdate
}) => {
  const [formData, setFormData] = useState<Candidate | null>(null);
  const [passportDataUrl, setPassportDataUrl] = useState<string | null>(null);
  const [isPassportModalOpen, setIsPassportModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (candidate && isOpen) {
      setFormData({ ...candidate });
      setNotice(null);

      // Charger le document lourd depuis le coffre local IndexedDB
      dataService.loadCandidateDocument(candidate).then((docUrl) => {
        setPassportDataUrl(docUrl || candidate.passport_file_url || null);
      });
    }
  }, [candidate, isOpen]);

  if (!isOpen || !formData) return null;

  const isInitiallyArchived = Boolean(candidate?.is_archived);
  const isRenewalOrIntermediate = 
    formData.contract_type === 'Renouvellement de contrat' || 
    formData.contract_type === 'Contrat intermédiaire';

  // Calcul du cycle d'activité (30 jours)
  const referenceDateStr = formData.reactivated_at || formData.created_at;
  const elapsedDays = Math.floor((Date.now() - new Date(referenceDateStr).getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.max(0, 30 - elapsedDays);

  // Sortie et fermeture de la fiche avec réarchivage conditionnel
  const handleExitFiche = async () => {
    if (!formData) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      // Si le dossier était archivé
      if (isInitiallyArchived) {
        if (isRenewalOrIntermediate) {
          // EXCEPTION RÈGLE MÉTIER : 
          // Si le type de contrat est (ou est passé en) « Renouvellement de contrat » ou « Contrat intermédiaire » (Visite intermédiaire),
          // le dossier n'est PAS réarchivé et reste définitivement réactivé dans vos dossiers opérationnels en cours :
          // jusqu'à ce que la date dépasse de nouveau les 30 jours.
          const nowIso = new Date().toISOString();
          await dataService.updateCandidate(formData.id, {
            ...formData,
            is_archived: false,
            reactivated_at: nowIso,
            archived_at: undefined
          });
          alert(
            `✅ Exception règle métier appliquée !\n\nLe dossier de ${formData.civility} ${formData.last_name} (${formData.contract_type}) est réactivé dans vos dossiers opérationnels en cours.\n\nIl ne sera PAS réarchivé à la fermeture et restera actif jusqu'à ce que sa date dépasse de nouveau les 30 jours.`
          );
        } else {
          // RÈGLE : à la sortie, il est réarchivé de nouveau (Nouveau contrat > 30 jours)
          await dataService.rearchiveCandidateOnExit(formData.id);
          alert(
            `Consultation terminée pour ${formData.civility} ${formData.last_name}.\n\nCe dossier de plus d'un mois a été réarchivé automatiquement.`
          );
        }
      } else {
        // Dossier opérationnel actif :
        let updates = { ...formData };
        if (isRenewalOrIntermediate && formData.contract_type !== candidate?.contract_type) {
          // Nouveau cycle de 30 jours déclenché par passage en renouvellement / visite intermédiaire
          updates.reactivated_at = new Date().toISOString();
          updates.is_archived = false;
          updates.archived_at = undefined;
        }
        await dataService.updateCandidate(formData.id, updates);
      }

      onUpdate?.();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
      onClose();
    }
  };

  const handleContractTypeChange = (newType: ContractType) => {
    setFormData(prev => prev ? { ...prev, contract_type: newType } : null);
    if (newType === 'Renouvellement de contrat' || newType === 'Contrat intermédiaire') {
      setNotice(`✅ Exception règle métier : En « ${newType} », ce dossier n'est PAS réarchivé et reste réactivé dans vos dossiers opérationnels en cours jusqu'à ce que la date dépasse de nouveau les 30 jours.`);
    } else {
      setNotice(null);
    }
  };

  const handleMedicalStatusToggle = () => {
    const nextStatus: MedicalStatus = formData.medical_status === 'En instance' ? 'Effectué' : 'En instance';
    setFormData(prev => prev ? { ...prev, medical_status: nextStatus } : null);
  };

  const handleFinancialStatusToggle = () => {
    const nextStatus: FinancialStatus = formData.financial_status === 'Payé' ? 'Non payé' : 'Payé';
    setFormData(prev => prev ? { ...prev, financial_status: nextStatus } : null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel w-full max-w-3xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* En-tête de la fiche candidat */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl border ${
              isInitiallyArchived 
                ? 'bg-amber-950/70 border-amber-800/80 text-amber-400' 
                : 'bg-cyan-950/70 border-cyan-800/80 text-cyan-400'
            }`}>
              {isInitiallyArchived ? <Archive className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-cyan-400 font-bold">
                  {formData.passport_number}
                </span>
                {isInitiallyArchived && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                    Dossier Archivé (&gt; 1 mois)
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">
                {formData.civility} {formData.last_name} {formData.first_name}
              </h3>
            </div>
          </div>

          <button
            onClick={handleExitFiche}
            disabled={isSaving}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            title="Fermer la fiche candidat et appliquer la règle d'archivage"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps déroulant */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          
          {/* BANNIÈRE D'ARCHIVAGE DÉTAILLÉE */}
          {isInitiallyArchived && (
            <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-500/60 text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-white">
                <ArchiveRestore className="w-4 h-4 text-amber-400" />
                <span>Récupération Instantanée du Dossier Archivé</span>
              </div>
              <p className="leading-relaxed">
                Ce dossier marin a plus d'un mois. Il a été récupéré instantanément depuis l'archive pour votre consultation.
              </p>
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-amber-500/30 text-[11px] text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Exception règle métier :</strong> Si le type de contrat est (ou est passé en) <strong>« Renouvellement de contrat »</strong> ou <strong>« Contrat intermédiaire »</strong> (Visite intermédiaire), le dossier <u>n'est PAS réarchivé</u> et reste <strong>définitivement réactivé dans vos dossiers opérationnels en cours</strong> jusqu'à ce que la date dépasse de nouveau les 30 jours.
                </span>
              </div>
            </div>
          )}

          {notice && (
            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 text-xs font-semibold animate-fadeIn">
              {notice}
            </div>
          )}

          {/* SECTION 1 : INFORMATIONS PERSONNELLES & PASSEPORT */}
          <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider text-slate-400">
              Identité & Passeport Maritime
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
              <div>
                <span className="text-slate-500 block text-[10px]">Civilité / Nom :</span>
                <span className="font-semibold text-white">{formData.civility} {formData.last_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Prénom :</span>
                <span className="font-semibold text-white">{formData.first_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Date de naissance :</span>
                <span>{formData.birth_date} (<strong>{formData.age} ans</strong>)</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">N° Passeport :</span>
                <span className="font-mono text-cyan-400 font-bold">{formData.passport_number}</span>
              </div>
            </div>

            {/* Document Passeport (depuis coffre IndexedDB) */}
            <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Copie Passeport : <strong>{formData.passport_file_name || 'Document officiel'}</strong></span>
              </div>

              <button
                type="button"
                onClick={() => setIsPassportModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Visualiser le Passeport</span>
              </button>
            </div>
          </div>

          {/* SECTION 2 : AFFECTATION MARITIME & TYPE DE CONTRAT */}
          <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider text-slate-400">
                Mission & Contrat d'Embarquement
              </h4>
              <div className="flex items-center gap-3 text-slate-500 text-[11px] flex-wrap">
                <span>Société : <strong className="text-slate-300">{formData.service_company_name}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>Médecin destinataire : <strong className="text-white">{formData.doctor_name || 'Non assigné'}</strong></span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-slate-500 block text-[10px] mb-1">Compagnie de Croisière</label>
                <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-semibold">
                  <Ship className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{formData.cruise_company}</span>
                </div>
              </div>

              <div>
                <label className="text-slate-500 block text-[10px] mb-1">Poste Maritime</label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-500 block text-[10px] mb-1">Date d'Embarquement</label>
                <input
                  type="date"
                  value={formData.embarkation_date}
                  onChange={(e) => setFormData({ ...formData, embarkation_date: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* SÉLECTEUR DE TYPE DE CONTRAT (Clé pour désarchivage permanent) */}
            <div className="pt-2 border-t border-slate-900">
              <label className="text-slate-400 block text-[11px] font-bold mb-1.5 flex items-center justify-between">
                <span>Type de Contrat :</span>
                {isRenewalOrIntermediate && (
                  <span className="text-emerald-400 font-normal text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Réactivé dans les dossiers opérationnels (cycle 30j)
                  </span>
                )}
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['Nouveau contrat', 'Contrat intermédiaire', 'Renouvellement de contrat'] as ContractType[]).map((type) => {
                  const isSelected = formData.contract_type === type;
                  const isExemptType = type === 'Renouvellement de contrat' || type === 'Contrat intermédiaire';

                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleContractTypeChange(type)}
                      className={`p-2.5 rounded-xl border text-left font-semibold transition-all flex flex-col justify-between ${
                        isSelected
                          ? isExemptType
                            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-md'
                            : 'bg-cyan-950/80 border-cyan-500 text-cyan-200 shadow-md'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <span>{type}</span>
                      {isExemptType && (
                        <span className="text-[9px] text-emerald-400 mt-1">Actif 30 jours</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 3 : STATUT MÉDICAL & GESTION FINANCIÈRE EN DINARS TUNISIENS (DT) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Statut Médical */}
            <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-emerald-400" />
                  <span>Aptitude Médicale Gens de Mer</span>
                </h4>
                <button
                  type="button"
                  onClick={handleMedicalStatusToggle}
                  className={`px-3 py-1 rounded-full font-bold text-xs border flex items-center gap-1.5 transition-all ${
                    formData.medical_status === 'Effectué'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      : 'bg-amber-950 text-amber-400 border-amber-800'
                  }`}
                >
                  {formData.medical_status === 'Effectué' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>{formData.medical_status}</span>
                </button>
              </div>

              <div>
                <label className="text-slate-500 block text-[10px] mb-1">Notes Médicales d'Aptitude</label>
                <textarea
                  value={formData.medical_notes || ''}
                  onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
                  placeholder="Observations médicales, vaccins fièvre jaune, audiogramme..."
                  rows={2}
                  className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Gestion Financière (Dinars Tunisiens - DT) */}
            <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-cyan-400" />
                  <span>Règlement Visite (Dinars Tunisiens - DT)</span>
                </h4>
                <button
                  type="button"
                  onClick={handleFinancialStatusToggle}
                  className={`px-3 py-1 rounded-full font-bold text-xs border transition-all ${
                    formData.financial_status === 'Payé'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      : 'bg-rose-950 text-rose-400 border-rose-800'
                  }`}
                >
                  {formData.financial_status}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-500 block text-[10px] mb-1">Montant (DT)</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={formData.financial_amount}
                      onChange={(e) => setFormData({ ...formData, financial_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 pr-10 rounded-xl bg-slate-900 border border-slate-800 text-white font-bold text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-cyan-400">DT</span>
                  </div>
                </div>

                <div>
                  <label className="text-slate-500 block text-[10px] mb-1">Payeur</label>
                  <select
                    value={formData.payer_name}
                    onChange={(e) => setFormData({ ...formData, payer_name: e.target.value as PayerName })}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="La société">La société</option>
                    <option value="Le candidat lui-même">Le candidat</option>
                  </select>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Pied de modal avec bouton de fermeture et application de la règle d'archivage */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/40">
          <div className="text-[11px] text-slate-400">
            {isInitiallyArchived ? (
              isRenewalOrIntermediate ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  À la sortie : Réactivé dans les dossiers opérationnels (cycle 30 jours)
                </span>
              ) : (
                <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                  <Archive className="w-4 h-4" />
                  À la sortie : Réarchivé automatiquement (Nouveau contrat &gt; 30j)
                </span>
              )
            ) : (
              <span className="text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Dossier opérationnel actif {isRenewalOrIntermediate ? `(Cycle 30j : ${remainingDays}j restants)` : ''}</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleExitFiche}
            disabled={isSaving}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-maritime-600 hover:from-cyan-500 hover:to-maritime-500 text-white font-bold text-xs shadow-lg transition-all flex items-center gap-2"
          >
            <span>Fermer & Enregistrer</span>
          </button>
        </div>

      </div>

      {/* Modal Visualiseur de Passeport */}
      <PassportViewerModal
        isOpen={isPassportModalOpen}
        onClose={() => setIsPassportModalOpen(false)}
        fileName={formData.passport_file_name}
        fileUrl={passportDataUrl || undefined}
        candidateName={`${formData.civility} ${formData.last_name} ${formData.first_name}`}
        passportNumber={formData.passport_number}
      />
    </div>
  );
};
