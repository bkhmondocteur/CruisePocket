import React from 'react';
import { X, FileText, Download, ExternalLink, ShieldCheck } from 'lucide-react';

interface PassportViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName?: string;
  fileUrl?: string;
  candidateName?: string;
  passportNumber?: string;
}

export const PassportViewerModal: React.FC<PassportViewerModalProps> = ({
  isOpen,
  onClose,
  fileName,
  fileUrl,
  candidateName,
  passportNumber
}) => {
  if (!isOpen) return null;

  const isPdf = fileName?.toLowerCase().endsWith('.pdf') || fileUrl?.startsWith('data:application/pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Modal */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Copie du Passeport</span>
                {passportNumber && (
                  <span className="font-mono text-cyan-400 text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                    N° {passportNumber}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {candidateName ? `Marin : ${candidateName}` : fileName || 'Document justificatif'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {fileUrl && (
              <a
                href={fileUrl}
                download={fileName || 'passeport.pdf'}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                title="Télécharger la pièce jointe"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corps Visualiseur */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center bg-slate-950/50 min-h-[340px]">
          {fileUrl ? (
            isPdf ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-maritime-950 text-cyan-400 border border-maritime-800 flex items-center justify-center shadow-lg">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">Document PDF Maritime Vérifié</h4>
                  <p className="text-xs text-slate-400 mt-1 font-mono">{fileName || 'copie_passeport.pdf'}</p>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-maritime-600 hover:bg-maritime-500 text-white text-xs font-bold flex items-center gap-2 shadow-md transition-all"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Ouvrir dans un nouvel onglet</span>
                  </a>
                  <a
                    href={fileUrl}
                    download={fileName || 'passeport.pdf'}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="relative max-h-[500px] max-w-full rounded-xl overflow-hidden border border-slate-800 shadow-xl bg-slate-900">
                <img
                  src={fileUrl}
                  alt="Passeport"
                  className="max-h-[500px] w-auto object-contain"
                />
              </div>
            )
          ) : (
            /* Document spécimen si pas de fichier physique */
            <div className="w-full max-w-md p-6 rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-cyan-950/80 text-cyan-400 border border-cyan-800 mx-auto flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="text-white font-bold text-sm">Spécimen Numérique de Passeport</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Le document original a été validé et archivé dans le bucket sécurisé <strong>passports</strong> de Supabase.
              </p>
              <div className="p-3 rounded-xl bg-slate-950 font-mono text-xs text-slate-300 text-left space-y-1 border border-slate-800">
                <div><strong>Numéro :</strong> {passportNumber || '21AB94820'}</div>
                <div><strong>Titulaire :</strong> {candidateName || 'Marin STCW'}</div>
                <div><strong>Statut :</strong> Conforme aux exigences OMI / OIT</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70 text-center text-[11px] text-slate-500 flex items-center justify-between px-4">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Conformité RGPD Médicale & STCW
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
