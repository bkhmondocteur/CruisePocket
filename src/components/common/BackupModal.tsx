import React, { useState, useEffect, useRef } from 'react';
import { backupService } from '../../lib/backupService';
import { BackupSlotInfo } from '../../types';
import { useI18n } from '../../i18n/I18nContext';
import { 
  Database, 
  Download, 
  Upload, 
  FolderCheck, 
  FolderPlus, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Clock,
  ShieldCheck
} from 'lucide-react';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const [folderName, setFolderName] = useState<string | null>(null);
  const [slots, setSlots] = useState<BackupSlotInfo[]>([]);
  const [currentSlot, setCurrentSlot] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBackupStatus = () => {
    setFolderName(backupService.getSelectedFolderName());
    setSlots(backupService.getSlotsMetadata());
    setCurrentSlot(backupService.getCurrentSlotIndex());
  };

  useEffect(() => {
    if (isOpen) {
      loadBackupStatus();
      setStatusMessage(null);
    }

    const handleBackupUpdate = () => {
      loadBackupStatus();
    };

    window.addEventListener('cruisepocket_backup_updated', handleBackupUpdate);
    return () => {
      window.removeEventListener('cruisepocket_backup_updated', handleBackupUpdate);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Choisir le dossier local pour la sauvegarde automatique
  const handleSelectFolder = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    const result = await backupService.chooseBackupDirectory();
    setIsProcessing(false);

    if (result.success && result.folderName) {
      setFolderName(result.folderName);
      loadBackupStatus();
      setStatusMessage({
        type: 'success',
        text: `Dossier lié avec succès : "${result.folderName}". Les 5 fichiers rotatifs s'y synchroniseront automatiquement.`
      });
    } else if (result.error) {
      setStatusMessage({ type: 'error', text: result.error });
    }
  };

  // Télécharger une sauvegarde manuelle
  const handleExportManual = async () => {
    setIsProcessing(true);
    try {
      await backupService.manualExportBackup();
      setStatusMessage({
        type: 'success',
        text: "Sauvegarde téléchargée avec succès sur votre appareil."
      });
    } catch {
      setStatusMessage({ type: 'error', text: "Erreur lors de la génération de la sauvegarde." });
    } finally {
      setIsProcessing(false);
    }
  };

  // Restaurer depuis un fichier JSON
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmRestore = window.confirm(
      "Attention : Restaurer une sauvegarde va remplacer les dossiers actuels par ceux du fichier sélectionné.\n\nVoulez-vous continuer ?"
    );
    if (!confirmRestore) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsProcessing(true);
    setStatusMessage(null);
    const res = await backupService.restoreFromFile(file);
    setIsProcessing(false);

    if (fileInputRef.current) fileInputRef.current.value = '';

    if (res.success) {
      setStatusMessage({
        type: 'success',
        text: `Restauration réussie ! ${res.candidatesCount || 0} dossiers marins ont été restaurés.`
      });
      loadBackupStatus();
    } else {
      setStatusMessage({ type: 'error', text: res.error || "Échec de la restauration." });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel w-full max-w-2xl rounded-2xl sm:rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[96vh] sm:max-h-[90vh]">
        
        {/* En-tête */}
        <div className="px-4 py-3.5 sm:px-6 sm:py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-cyan-950/70 text-cyan-400 border border-cyan-800/60 shrink-0">
              <Database className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 truncate">
                <span>{t('backup.title')}</span>
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {t('backup.subtitle')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
          
          {/* Notifications */}
          {statusMessage && (
            <div className={`p-4 rounded-2xl text-xs flex items-start gap-3 animate-fadeIn ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-950/70 border border-emerald-500/50 text-emerald-200' 
                : 'bg-rose-950/70 border border-rose-500/50 text-rose-200'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* SECTION 1 : SAUVEGARDE AUTOMATIQUE ROTATIVE DANS UN DOSSIER CHOISI */}
          <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <RotateCw className="w-4 h-4 text-cyan-400" />
                  <h4 className="font-bold text-white text-sm">{t('backup.autoTitle')}</h4>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('backup.autoDesc')}
                </p>
              </div>

              <button
                type="button"
                onClick={handleSelectFolder}
                disabled={isProcessing}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-maritime-600 hover:from-cyan-500 hover:to-maritime-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all shrink-0 cursor-pointer"
              >
                {folderName ? <FolderCheck className="w-4 h-4 text-emerald-300" /> : <FolderPlus className="w-4 h-4" />}
                <span>{folderName ? t('backup.changeFolder') : t('backup.linkFolder')}</span>
              </button>
            </div>

            {/* Dossier Actif */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">{t('backup.linkFolder')} :</span>
              {folderName ? (
                <span className="font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/60 flex items-center gap-1.5">
                  <FolderCheck className="w-3.5 h-3.5" />
                  📁 {folderName}
                </span>
              ) : (
                <span className="text-amber-400 font-medium">{t('backup.noFolder')}</span>
              )}
            </div>

            {/* Liste des 5 slots tournants */}
            <div className="space-y-2 pt-2 border-t border-slate-900">
              <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span>5 Slots FIFO</span>
                {currentSlot > 0 && (
                  <span className="text-cyan-400 font-mono text-[10px]">
                    Slot {currentSlot}/5
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {slots.map((s) => {
                  const isActive = s.slot === currentSlot;
                  const hasData = Boolean(s.timestamp);

                  return (
                    <div
                      key={s.slot}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        isActive
                          ? 'bg-cyan-950/80 border-cyan-500/80 text-white shadow-lg shadow-cyan-950/50'
                          : hasData
                          ? 'bg-slate-900/60 border-slate-800 text-slate-300'
                          : 'bg-slate-950/40 border-slate-900 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold mb-1">
                        <span>Slot {s.slot}</span>
                        {isActive && (
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-cyan-300 truncate">
                        backup_{s.slot}.json
                      </div>
                      <div className="text-[9px] text-slate-400 mt-1 flex items-center justify-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{s.timestamp ? new Date(s.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* SECTION 2 : BOUTONS MANUELS SAUVEGARDER & RESTAURER */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Bouton Sauvegarder */}
            <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col justify-between space-y-3">
              <div>
                <h5 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>{t('backup.manualTitle')}</span>
                </h5>
                <p className="text-[11px] text-slate-400 mt-1">
                  {t('backup.manualDesc')}
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportManual}
                disabled={isProcessing}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/60 text-emerald-400 hover:text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t('backup.downloadNow')}</span>
              </button>
            </div>

            {/* Bouton Restaurer */}
            <div className="glass-panel rounded-2xl p-4 border border-slate-800 flex flex-col justify-between space-y-3">
              <div>
                <h5 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-amber-400" />
                  <span>{t('backup.restoreTitle')}</span>
                </h5>
                <p className="text-[11px] text-slate-400 mt-1">
                  {t('backup.restoreDesc')}
                </p>
              </div>

              <div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/60 text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{t('backup.restoreBtn')}</span>
                </button>
              </div>
            </div>

          </div>

          {/* Règle de sécurité STCW & Pont Firestore */}
          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {t('backup.bridgeNote')}
            </p>
          </div>

        </div>

        {/* Pied de modal */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end bg-slate-900/30">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
          >
            {t('backup.close')}
          </button>
        </div>

      </div>
    </div>
  );
};
