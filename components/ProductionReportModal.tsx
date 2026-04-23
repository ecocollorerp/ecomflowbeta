import React, { useEffect, useState } from 'react';
import { X, Save, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { StockItem } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  onSave: (payload: any) => Promise<any>;
  stockItems?: StockItem[];
  period?: 'daily' | 'monthly';
}

const ProductionReportModal: React.FC<Props> = ({ isOpen, onClose, initialData, onSave, stockItems = [], period = 'daily' }) => {
  const [reportDate, setReportDate] = useState<string>('');
  const [isMonthly, setIsMonthly] = useState<boolean>(period === 'monthly');
  const [notes, setNotes] = useState<string>('');
  const [employeesCount, setEmployeesCount] = useState<number>(0);
  const [totalOrdersImported, setTotalOrdersImported] = useState<number>(0);
  const [totalOrdersCollected, setTotalOrdersCollected] = useState<number>(0);
  const [totalSiteComplements, setTotalSiteComplements] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const init = initialData || {};
    setIsMonthly(period === 'monthly' || !!init.is_monthly);
    // initial date: prefer ISO yyyy-mm-dd
    if (init.report_date) {
      const d = String(init.report_date);
      // if date in DD/MM/YYYY, convert
      if (d.includes('/')) {
        const [dd, mm, yyyy] = d.split('/');
        setReportDate(`${yyyy}-${mm}-${dd}`);
      } else {
        setReportDate(d.slice(0,10));
      }
    } else {
      const dt = new Date();
      setReportDate(dt.toISOString().slice(0,10));
    }
    setNotes(init.notes || '');
    setEmployeesCount(Number(init.employees_count || 0));
    setTotalOrdersImported(Number(init.total_orders_imported || init.ordersCount || 0));
    setTotalOrdersCollected(Number(init.total_orders_collected || 0));
    setTotalSiteComplements(Number(init.total_site_complements || 0));
  }, [isOpen, initialData, period]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const payload: any = {
        report_date: reportDate,
        is_monthly: isMonthly,
        notes,
        employees_count: Number(employeesCount || 0),
        total_orders_imported: Number(totalOrdersImported || 0),
        total_orders_collected: Number(totalOrdersCollected || 0),
        total_site_complements: Number(totalSiteComplements || 0),
        indicators: {}
      };
      const result = await onSave(payload);
      setIsSaving(false);
      return result;
    } catch (err) {
      setIsSaving(false);
      throw err;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSave} className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><CalendarIcon /> Salvar Relatório de Produção</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Data do Relatório</label>
            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="mt-1 p-2 w-full border rounded-md" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Escopo</label>
            <select value={isMonthly ? 'monthly' : 'daily'} onChange={e => setIsMonthly(e.target.value === 'monthly')} className="mt-1 p-2 w-full border rounded-md">
              <option value="daily">Diário</option>
              <option value="monthly">Mensal</option>
            </select>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-600">Funcionários (contagem)</label>
            <input type="number" value={employeesCount} onChange={e => setEmployeesCount(Number(e.target.value || 0))} className="mt-1 p-2 w-full border rounded-md" />
          </div>
          <div>
            <label className="text-sm text-gray-600">Pedidos importados</label>
            <input type="number" value={totalOrdersImported} onChange={e => setTotalOrdersImported(Number(e.target.value || 0))} className="mt-1 p-2 w-full border rounded-md" />
          </div>
          <div>
            <label className="text-sm text-gray-600">Pedidos coletados</label>
            <input type="number" value={totalOrdersCollected} onChange={e => setTotalOrdersCollected(Number(e.target.value || 0))} className="mt-1 p-2 w-full border rounded-md" />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm text-gray-600">Complementos do site</label>
          <input type="number" value={totalSiteComplements} onChange={e => setTotalSiteComplements(Number(e.target.value || 0))} className="mt-1 p-2 w-full border rounded-md" />
        </div>

        <div className="mt-4">
          <label className="text-sm text-gray-600">Notas</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} className="mt-1 p-2 w-full border rounded-md h-24" />
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md">Cancelar</button>
          <button type="submit" disabled={isSaving} className="px-4 py-2 bg-emerald-600 text-white rounded-md flex items-center gap-2">
            {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save />}
            {isSaving ? 'Salvando...' : 'Salvar Relatório'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProductionReportModal;
