import React, { useState, useMemo } from 'react';
import { Candidate } from '../../types';
import { useI18n } from '../../i18n/I18nContext';
import { 
  DollarSign, 
  TrendingUp, 
  Calendar, 
  Building2, 
  CheckCircle, 
  Clock, 
  PieChart, 
  FileSpreadsheet, 
  ChevronLeft 
} from 'lucide-react';

interface FinancialStatsProps {
  candidates: Candidate[];
  onBack: () => void;
}

export const FinancialStats: React.FC<FinancialStatsProps> = ({ candidates, onBack }) => {
  const { t } = useI18n();
  // Filtres de date par défaut : début de l'année en cours jusqu'à aujourd'hui
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Filtrer les dossiers selon la période sélectionnée
  const filteredRecords = useMemo(() => {
    return candidates.filter((item) => {
      const itemDate = (item.created_at || '').split('T')[0];
      if (startDate && itemDate < startDate) return false;
      if (endDate && itemDate > endDate) return false;
      return true;
    });
  }, [candidates, startDate, endDate]);

  // Calculs financiers
  const totalAmount = useMemo(() => {
    return filteredRecords.reduce((acc, curr) => acc + (Number(curr.financial_amount) || 0), 0);
  }, [filteredRecords]);

  const paidAmount = useMemo(() => {
    return filteredRecords
      .filter((c) => c.financial_status === 'Payé')
      .reduce((acc, curr) => acc + (Number(curr.financial_amount) || 0), 0);
  }, [filteredRecords]);

  const unpaidAmount = useMemo(() => {
    return filteredRecords
      .filter((c) => c.financial_status === 'Non payé')
      .reduce((acc, curr) => acc + (Number(curr.financial_amount) || 0), 0);
  }, [filteredRecords]);

  // Répartition par société
  const companyBreakdown = useMemo(() => {
    const map: Record<string, { total: number; paid: number; unpaid: number; count: number }> = {};
    
    filteredRecords.forEach((item) => {
      const comp = item.service_company_name || 'Autre Société';
      if (!map[comp]) {
        map[comp] = { total: 0, paid: 0, unpaid: 0, count: 0 };
      }
      const amt = Number(item.financial_amount) || 0;
      map[comp].total += amt;
      map[comp].count += 1;
      if (item.financial_status === 'Payé') {
        map[comp].paid += amt;
      } else {
        map[comp].unpaid += amt;
      }
    });

    return Object.entries(map).map(([name, stats]) => ({
      name,
      ...stats
    }));
  }, [filteredRecords]);

  // Répartition par payeur (Le candidat lui-même vs La société)
  const payerBreakdown = useMemo(() => {
    let candidatePaid = 0;
    let companyPaid = 0;

    filteredRecords.forEach((item) => {
      const amt = Number(item.financial_amount) || 0;
      if (item.payer_name === 'Le candidat lui-même') {
        candidatePaid += amt;
      } else {
        companyPaid += amt;
      }
    });

    return { candidatePaid, companyPaid };
  }, [filteredRecords]);

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 space-y-8 animate-fadeIn">
      
      {/* En-tête & Bouton Retour */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-800 mb-3 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
            <span>{t('stats.back')}</span>
          </button>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-2.5">
            <DollarSign className="w-7 h-7 text-emerald-400" />
            <span>{t('stats.title')}</span>
          </h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            {t('stats.subtitle')}
          </p>
        </div>

        {/* Export / Synthèse badge */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{filteredRecords.length} STCW</span>
          </div>
        </div>
      </div>

      {/* FILTRES DE DATES : DU [Date de début] AU [Date de fin] */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span>{t('stats.period')} :</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-medium">{t('stats.from')}</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-medium">{t('stats.to')}</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={() => {
              setStartDate(`${currentYear}-01-01`);
              setEndDate(new Date().toISOString().split('T')[0]);
            }}
            className="text-xs text-slate-400 hover:text-cyan-400 underline underline-offset-4 ml-2 cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* CARTES STATISTIQUES FINANCIÈRES : TOTAL / PAYÉ / NON PAYÉ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        
        {/* TOTAL FINANCIER */}
        <div className="glass-panel rounded-2xl p-6 border-l-4 rtl:border-l-0 rtl:border-r-4 border-cyan-500 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">{t('stats.total')}</span>
            <div className="p-2 rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-white">
              {totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DT
            </span>
            <p className="text-[11px] text-slate-400 mt-1">
              {filteredRecords.length} dossiers
            </p>
          </div>
        </div>

        {/* PAYÉ */}
        <div className="glass-panel rounded-2xl p-6 border-l-4 rtl:border-l-0 rtl:border-r-4 border-emerald-500 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">{t('stats.paid')}</span>
            <div className="p-2 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-emerald-400">
              {paidAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DT
            </span>
            <p className="text-[11px] text-emerald-500/80 mt-1">
              {totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0}%
            </p>
          </div>
        </div>

        {/* NON PAYÉ */}
        <div className="glass-panel rounded-2xl p-6 border-l-4 rtl:border-l-0 rtl:border-r-4 border-rose-500 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">{t('stats.unpaid')}</span>
            <div className="p-2 rounded-xl bg-rose-950 text-rose-400 border border-rose-800">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-rose-400">
              {unpaidAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DT
            </span>
            <p className="text-[11px] text-rose-400/80 mt-1">
              {totalAmount > 0 ? Math.round((unpaidAmount / totalAmount) * 100) : 0}%
            </p>
          </div>
        </div>

      </div>

      {/* JAUGE GRAPHIQUE COMPARATIF : PAYÉ VS NON PAYÉ & TYPE DE PAYEUR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Recouvrement bar chart */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-400" />
            <span>{t('stats.byPayer')}</span>
          </h3>

          <div className="space-y-3 pt-2">
            {/* Barre de progression */}
            <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
              <div 
                style={{ width: `${totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0}%` }} 
                className="bg-emerald-500 h-full transition-all duration-500"
                title={`${t('stats.paid')}: ${paidAmount} DT`}
              />
              <div 
                style={{ width: `${totalAmount > 0 ? (unpaidAmount / totalAmount) * 100 : 0}%` }} 
                className="bg-rose-500 h-full transition-all duration-500"
                title={`${t('stats.unpaid')}: ${unpaidAmount} DT`}
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-slate-300">{t('stats.paid')} : {paidAmount} DT</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                <span className="text-slate-300">{t('stats.unpaid')} : {unpaidAmount} DT</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 grid grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-500 block">{t('payer.Le candidat lui-même')}</span>
              <span className="font-bold text-white text-base mt-0.5 block">{payerBreakdown.candidatePaid} DT</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-500 block">{t('payer.La société')}</span>
              <span className="font-bold text-white text-base mt-0.5 block">{payerBreakdown.companyPaid} DT</span>
            </div>
          </div>
        </div>

        {/* RÉPARTITION PAR SOCIÉTÉ (TABLEAU & MONTANTS) */}
        <div className="lg:col-span-6 glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-400" />
            <span>{t('stats.byCompany')}</span>
          </h3>

          {companyBreakdown.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              -
            </div>
          ) : (
            <div className="space-y-3 pt-1 max-h-56 overflow-y-auto pr-1">
              {companyBreakdown.map((item, idx) => {
                const percent = totalAmount > 0 ? Math.round((item.total / totalAmount) * 100) : 0;
                return (
                  <div key={idx} className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-200">{item.name}</span>
                      <span className="text-cyan-300 font-mono">{item.total.toLocaleString('fr-FR')} DT ({percent}%)</span>
                    </div>

                    {/* Petite jauge */}
                    <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                      <div style={{ width: `${percent}%` }} className="bg-cyan-500 h-full rounded-full" />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                      <span>{item.count}</span>
                      <span>{t('stats.paid')}: <strong className="text-emerald-400">{item.paid} DT</strong> | {t('stats.unpaid')}: <strong className="text-rose-400">{item.unpaid} DT</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
