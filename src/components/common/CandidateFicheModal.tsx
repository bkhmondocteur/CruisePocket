import React, { useState, useEffect } from 'react';
import { Candidate, ContractType, MedicalStatus, FinancialStatus, PayerName } from '../../types';
import { dataService } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
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
  Stethoscope
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

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
  onUpdate,
  userRole: propRole
}) => {
  const { role: authRole } = useAuth();
  const { t } = useI18n();
  const effectiveRole = propRole || authRole;

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

    const handleDocReassembled = (e: Event) => {
      const custom = e as CustomEvent<{ docId: string }>;
      if (candidate && custom.detail?.docId === candidate.passport_file_id) {
        dataService.loadCandidateDocument(candidate).then((docUrl) => {
          if (docUrl) setPassportDataUrl(docUrl);
        });
      }
    };

    window.addEventListener('cruisepocket_doc_reassembled', handleDocReassembled);
    return () => {
      window.removeEventListener('cruisepocket_doc_reassembled', handleDocReassembled);
    };
  }, [candidate, isOpen]);

  if (!isOpen || !formData) return null;

  const isInitiallyArchived = Boolean(candidate?.is_archived);
  const isRenewalOrIntermediate = 
    formData.contract_type === 'Renouvellement de contrat' || 
    formData.contract_type === 'Contrat intermédiaire';

  // Sortie et fermeture de la fiche avec réarchivage conditionnel
  const handleExitFiche = async () => {
    if (!formData) {
      onClose();
      return;
    }

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      let updates = { ...formData, updated_at: nowIso };

      // Si le dossier était archivé
      if (isInitiallyArchived) {
        if (isRenewalOrIntermediate) {
          // EXCEPTION RÈGLE MÉTIER : 
          // Si le type de contrat est (ou est passé en) « Renouvellement de contrat » ou « Contrat intermédiaire » (Visite intermédiaire),
          // le dossier n'est PAS réarchivé et reste définitivement réactivé dans vos dossiers opérationnels en cours :
          // jusqu'à ce que la date dépasse de nouveau les 30 jours.
          updates.is_archived = false;
          updates.reactivated_at = nowIso;
          updates.archived_at = undefined;
          await dataService.updateCandidate(formData.id, updates);
          alert(
            `✅ Exception règle métier appliquée !\n\nLe dossier de ${formData.civility} ${formData.last_name} (${formData.contract_type}) est réactivé dans vos dossiers opérationnels en cours.\n\nIl ne sera PAS réarchivé à la fermeture et restera actif jusqu'à ce que sa date dépasse de nouveau les 30 jours.`
          );
        } else {
          // RÈGLE : à la sortie, il est réarchivé de nouveau (Nouveau contrat > 30 jours) tout en préservant toutes les modifications apportées
          await dataService.updateCandidate(formData.id, {
            ...updates,
            is_archived: true,
            archived_at: nowIso
          });
          alert(
            `Consultation terminée pour ${formData.civility} ${formData.last_name}.\n\nCe dossier de plus d'un mois a été réarchivé automatiquement.`
          );
        }
      } else {
        // Dossier opérationnel actif :
        if (isRenewalOrIntermediate && formData.contract_type !== candidate?.contract_type) {
          // Nouveau cycle de 30 jours déclenché par passage en renouvellement / visite intermédiaire
          updates.reactivated_at = nowIso;
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

  // Toggle du statut médical avec enregistrement immédiat en base et Firebase
  const handleMedicalStatusToggle = async () => {
    if (!formData) return;
    const nextStatus: MedicalStatus = formData.medical_status === 'En instance' ? 'Effectué' : 'En instance';
    const updated = { ...formData, medical_status: nextStatus, updated_at: new Date().toISOString() };
    setFormData(updated);

    try {
      await dataService.updateCandidate(formData.id, {
        medical_status: nextStatus,
        updated_at: new Date().toISOString()
      });
      onUpdate?.();
    } catch (e) {
      console.warn("Erreur mise à jour statut médical immédiat:", e);
    }
  };

  // Toggle du statut financier avec enregistrement immédiat
  const handleFinancialStatusToggle = async () => {
    if (!formData) return;
    const nextStatus: FinancialStatus = formData.financial_status === 'Payé' ? 'Non payé' : 'Payé';
    const updated = { ...formData, financial_status: nextStatus, updated_at: new Date().toISOString() };
    setFormData(updated);

    try {
      await dataService.updateCandidate(formData.id, {
        financial_status: nextStatus,
        updated_at: new Date().toISOString()
      });
      onUpdate?.();
    } catch (e) {
      console.warn("Erreur mise à jour statut financier immédiat:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel w-full max-w-3xl rounded-2xl sm:rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[92vh]">
        
        {/* En-tête de la fiche candidat */}
        <div className="px-4 py-3 sm:px-6 sm:py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border shrink-0 ${
              isInitiallyArchived 
                ? 'bg-amber-950/70 border-amber-800/80 text-amber-400' 
                : 'bg-cyan-950/70 border-cyan-800/80 text-cyan-400'
            }`}>
              {isInitiallyArchived ? <Archive className="w-4 h-4 sm:w-5 sm:h-5" /> : <User className="w-4 h-4 sm:w-5 sm:h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-cyan-400 font-bold">
                  {formData.passport_number}
                </span>
                {isInitiallyArchived && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                    {t('fiche.archivedCycle')}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-xl font-bold text-white tracking-tight truncate">
                {formData.civility} {formData.last_name} {formData.first_name}
              </h3>
            </div>
          </div>

          <button
            onClick={handleExitFiche}
            disabled={isSaving}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title={t('fiche.closeAndSave')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps déroulant */}
        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1 text-xs">
          
          {/* BANNIÈRE D'ARCHIVAGE DÉTAILLÉE */}
          {isInitiallyArchived && (
            <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-500/60 text-amber-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-white">
                <ArchiveRestore className="w-4 h-4 text-amber-400" />
                <span>{t('company.openArchive')}</span>
              </div>
              <p className="leading-relaxed">
                {t('fiche.archivedCycle')}
              </p>
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
              {t('fiche.identity')}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
              <div>
                <span className="text-slate-500 block text-[10px]">{t('company.lastName')}</span>
                <span className="font-semibold text-white">{formData.civility} {formData.last_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">{t('company.firstName')}</span>
                <span className="font-semibold text-white">{formData.first_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">{t('company.birthDate')}</span>
                <span>{formData.birth_date} (<strong>{formData.age} {t('company.years')}</strong>)</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">{t('company.passportNumber')}</span>
                <span className="font-mono text-cyan-400 font-bold">{formData.passport_number}</span>
              </div>
            </div>

            {/* Document Passeport (depuis coffre IndexedDB) */}
            <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>{t('company.passportUpload')} : <strong>{formData.passport_file_name || t('passport.docFallback')}</strong></span>
              </div>

              <button
                type="button"
                onClick={() => setIsPassportModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{t('doctor.consultPassport')}</span>
              </button>
            </div>
          </div>

          {/* SECTION 2 : AFFECTATION MARITIME & TYPE DE CONTRAT */}
          <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider text-slate-400">
                {t('fiche.contract')}
              </h4>
              <div className="flex items-center gap-3 text-slate-500 text-[11px] flex-wrap">
                <span>{t('header.company')} : <strong className="text-slate-300">{formData.service_company_name}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>{t('header.doctor')} : <strong className="text-white">{formData.doctor_name || '-'}</strong></span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-slate-500 block text-[10px] mb-1">{t('company.cruiseCompany')}</label>
                <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-semibold">
                  <Ship className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{formData.cruise_company}</span>
                </div>
              </div>

              <div>
                <label className="text-slate-500 block text-[10px] mb-1">{t('company.position')}</label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-500 block text-[10px] mb-1">{t('company.embarkationDate')}</label>
                <input
                  type="date"
                  value={formData.embarkation_date}
                  onChange={(e) => setFormData({ ...formData, embarkation_date: e.target.value })}
                  className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* SÉLECTEUR DE TYPE DE CONTRAT */}
            <div className="pt-2 border-t border-slate-900">
              <label className="text-slate-400 block text-[11px] font-bold mb-1.5 flex items-center justify-between">
                <span>{t('company.contractType')} :</span>
                {isRenewalOrIntermediate && (
                  <span className="text-emerald-400 font-normal text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    {t('fiche.activeCycle')}
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
                      className={`p-2.5 rounded-xl border text-left rtl:text-right font-semibold transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? isExemptType
                            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200 shadow-md'
                            : 'bg-cyan-950/80 border-cyan-500 text-cyan-200 shadow-md'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900'
                      }`}
                    >
                      <span>{t(`contract.${type}`) || type}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 3 : STATUT MÉDICAL & GESTION FINANCIÈRE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Statut Médical */}
            <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-emerald-400" />
                  <span>{t('fiche.medical')}</span>
                </h4>
                <button
                  type="button"
                  onClick={handleMedicalStatusToggle}
                  className={`px-3 py-1 rounded-full font-bold text-xs border flex items-center gap-1.5 transition-all cursor-pointer ${
                    formData.medical_status === 'Effectué'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      : 'bg-amber-950 text-amber-400 border-amber-800'
                  }`}
                >
                  {formData.medical_status === 'Effectué' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                  <span>{t(`status.${formData.medical_status}`) || formData.medical_status}</span>
                </button>
              </div>

              <div>
                <label className="text-slate-500 block text-[10px] mb-1">{t('fiche.medicalNotes')}</label>
                <textarea
                  value={formData.medical_notes || ''}
                  onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
                  placeholder={t('fiche.medicalNotesPlaceholder')}
                  rows={2}
                  className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Bouton d'action directe pour valider la visite médicale */}
              {effectiveRole === 'medecin' && (
                <div className="pt-1">
                  {formData.medical_status === 'En instance' ? (
                    <button
                      type="button"
                      onClick={handleMedicalStatusToggle}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t('fiche.validateMedical')}</span>
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{t('fiche.medicalValidated')}</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleMedicalStatusToggle}
                        className="text-[10px] text-slate-400 hover:text-amber-300 underline cursor-pointer shrink-0"
                      >
                        {t('fiche.resetPending')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Gestion Financière (Dinars Tunisiens - DT) */}
            <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-cyan-400" />
                  <span>{t('fiche.financial')}</span>
                </h4>
                <button
                  type="button"
                  onClick={handleFinancialStatusToggle}
                  className={`px-3 py-1 rounded-full font-bold text-xs border transition-all cursor-pointer ${
                    formData.financial_status === 'Payé'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      : 'bg-rose-950 text-rose-400 border-rose-800'
                  }`}
                >
                  {formData.financial_status === 'Payé' ? `✓ ${t('status.Payé')}` : `✕ ${t('status.Non payé')}`}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-500 block text-[10px] mb-1">{t('doctor.amount')}</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={formData.financial_amount}
                      onChange={(e) => setFormData({ ...formData, financial_amount: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 pr-10 rtl:pr-2 rtl:pl-10 rounded-xl bg-slate-900 border border-slate-800 text-white font-bold text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                    <span className="absolute right-3 rtl:right-auto rtl:left-3 top-2.5 text-xs font-bold text-cyan-400">DT</span>
                  </div>
                </div>

                <div>
                  <label className="text-slate-500 block text-[10px] mb-1">{t('doctor.payer')}</label>
                  <select
                    value={formData.payer_name}
                    onChange={(e) => setFormData({ ...formData, payer_name: e.target.value as PayerName })}
                    className="w-full p-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="La société">{t('payer.La société')}</option>
                    <option value="Le candidat lui-même">{t('payer.Le candidat lui-même')}</option>
                  </select>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Pied de modal avec bouton de fermeture et application de la règle d'archivage */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/40">
          <div className="text-[11px] text-slate-400">
            {isInitiallyArchived ? (
              <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                <Archive className="w-4 h-4 shrink-0" />
                <span>{t('fiche.archivedCycle')}</span>
              </span>
            ) : (
              <span className="text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span>{t('fiche.activeCycle')}</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleExitFiche}
            disabled={isSaving}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-maritime-600 hover:from-cyan-500 hover:to-maritime-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{t('fiche.closeAndSave')}</span>
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
