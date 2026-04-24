import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, FileDown, Save, Package, Box, Truck, ClipboardCheck, Plus, Trash2, MapPin, AlertCircle } from 'lucide-react';
import InfoCard from '../components/InfoCard';
import Collapsible from '../components/Collapsible';
import ProductionReportModal from '../components/ProductionReportModal';
import DateRangePicker from '../components/DateRangePicker';
import { exportProductionSummary } from '../lib/export';
import { StockItem, StockMovement, OrderItem, WeighingBatch, GrindingBatch, ScanLogItem, User, ProdutoCombinado, SkuLink, GeneralSettings, ColetaItem, ColetaAdicional } from '../types';

interface ResumoProducaoProps {
  stockItems: StockItem[];
  stockMovements: StockMovement[];
  orders: OrderItem[];
  weighingBatches: WeighingBatch[];
  grindingBatches: GrindingBatch[];
  scanHistory: ScanLogItem[];
  users: User[];
  produtosCombinados: ProdutoCombinado[];
  skuLinks: SkuLink[];
  generalSettings: GeneralSettings;
  addToast?: (msg: string, type: string) => void;
}


const ResumoProducaoPage: React.FC<ResumoProducaoProps> = ({ stockItems, stockMovements, orders, weighingBatches, grindingBatches, scanHistory, users, produtosCombinados, skuLinks, generalSettings, addToast }) => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const [dateRangeStart, setDateRangeStart] = useState<string>(yesterdayStr);
  const [dateRangeEnd, setDateRangeEnd] = useState<string>(yesterdayStr);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [operatorFilter, setOperatorFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [dateSource, setDateSource] = useState<'imported'|'original'>('imported');
  const [vista, setVista] = useState<'dia' | 'geral'>('dia');

  const [loading, setLoading] = useState(true);
  const [prodSummary, setProdSummary] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportInitialData, setReportInitialData] = useState<any>(null);
  const [details, setDetails] = useState<any>(null);
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [manualBipagens, setManualBipagens] = useState<any[]>([]);
  const [newBip, setNewBip] = useState<{ product_sku: string; quantity: number; platform: string }>({ product_sku: '', quantity: 1, platform: 'SITE' });
  const [observations, setObservations] = useState<string[]>([]);
  const [obsInput, setObsInput] = useState<string>('');
  const [savedDates, setSavedDates] = useState<Set<string>>(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('ecomflow_saved_dates') : null;
    return new Set(stored ? JSON.parse(stored) : []);
  });
  const [showLoadBanner, setShowLoadBanner] = useState(false);

  // Estado para Coleta
  const [coletas, setColetas] = useState<ColetaItem[]>([]);
  const [newColeta, setNewColeta] = useState<Partial<ColetaItem>>({
    plataforma: 'ML',
    status: 'pendente'
  });
  const [coletasAdicionais, setColetasAdicionais] = useState<ColetaAdicional[]>([]);
  const [newColetaAdicional, setNewColetaAdicional] = useState<Partial<ColetaAdicional>>({
    tipo: 'manual'
  });

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
  }, []);

  const ordersForPeriod = useMemo(() => {
    const baseOrders = orders.filter(o => {
      const dStr = String(o.data || '').split('/').reverse().join('-');
      return vista === 'dia' ? (dStr >= dateRangeStart && dStr <= dateRangeEnd) : true;
    }).filter(o => platformFilter === 'ALL' || (o.canal === platformFilter));
    return baseOrders;
  }, [orders, dateRangeStart, dateRangeEnd, vista, platformFilter]);

  const totalItems = useMemo(() => {
    return orders.reduce((s, o) => s + (o.qty_final || 0), 0);
  }, [orders]);

  // Check if there's saved data for the current date and show banner
  useEffect(() => {
    setShowLoadBanner(savedDates.has(dateRangeEnd));
  }, [dateRangeEnd, savedDates]);

  useEffect(() => {
    let mounted = true;
    const fetchSummary = async () => {
      setLoadingSummary(true);
      try {
        const res = await fetch(`/api/production/summary?date=${dateRangeEnd}`);
        const json = await res.json();
        if (!mounted) return;
        if (json && json.success) setProdSummary(json);
        else setProdSummary(null);
      } catch (e) {
        console.error('Erro ao carregar resumo de produção:', e);
        setProdSummary(null);
      } finally {
        if (mounted) setLoadingSummary(false);
      }
    };
    fetchSummary();
    const fetchDetails = async () => {
      try {
        const res = await fetch(`/api/production/details?date=${dateRangeEnd}&period=daily`);
        const json = await res.json();
        if (!mounted) return;
        if (json && json.success) setDetails(json);
        else setDetails(null);
      } catch (e) {
        console.warn('Erro ao carregar detalhes de produção:', e);
        setDetails(null);
      }
    };
    fetchDetails();
    return () => { mounted = false; };
  }, [dateRangeEnd]);

  // Compute derived views to replace placeholders
  const pacotesStats = useMemo(() => {
    const registered = details?.packages || details?.production_packages || [];
    const suggested = details?.importedPackages || [];
    const lotes = registered.length + suggested.length;
    const unidades = registered.reduce((s: number, p: any) => s + (p.quantity || p.qty || p.quantidade_disponivel || 0), 0) +
                     suggested.reduce((s: number, p: any) => s + (p.quantity || p.qty || p.quantidade_disponivel || 0), 0);
    return { lotes, unidades };
  }, [details]);

  const estoqueProntoStats = useMemo(() => {
    const pronto = details?.estoquePronto || details?.estoque_pronto || [];
    return {
      lotes: pronto.length,
      unidades: pronto.reduce((s: number, p: any) => s + (p.quantidade_disponivel || p.quantidade_total || 0), 0)
    };
  }, [details]);

  const mixes = useMemo(() => {
    const arr: any[] = [];
    const weighingsArr = details?.weighings || details?.weighing_batches || [];
    const grindingsArr = details?.grindings || details?.grinding_batches || [];
    (weighingsArr || []).forEach((w: any) => {
      if (w.com_cor) arr.push({ id: w.id, type: 'Pesagem', product: w.stock_item_name || w.stock_item_code || '', qty: w.qty_produced || w.qty_produced || w.initial_qty || 0, operator: w.operador_batedor || w.operador_maquina || w.created_by_name || w.created_by || '', createdAt: w.created_at });
    });
    (grindingsArr || []).forEach((g: any) => {
      arr.push({ id: g.id, type: 'Moagem', product: g.output_insumo_name || g.output_insumo_code || '', qty: g.output_qty_produced || g.output_qty || 0, operator: g.user_name || g.user || '', createdAt: g.created_at });
    });
    return arr;
  }, [details]);

  const productionByPerson = useMemo(() => {
    const map = new Map<string, any>();
    const add = (key: string, name: string, field: string, qty: number) => {
      const e = map.get(key) || { userId: key, name: name || '', bipagens: 0, weighings: 0, grindings: 0 };
      e[field] = (e[field] || 0) + (Number(qty) || 0);
      map.set(key, e);
    };

    (details?.bipagens || []).forEach((b: any) => add(String(b.user_id || b.user || 'unknown'), b.user_name || b.user || '', 'bipagens', b.quantity || b.qty || 1));
    (details?.weighings || []).forEach((w: any) => add(String(w.created_by_id || w.user_id || w.created_by || w.operador_maquina || 'unknown'), w.created_by_name || w.user_name || w.operador_maquina || '', 'weighings', w.qty_produced || w.used_qty || w.initial_qty || 0));
    (details?.grindings || []).forEach((g: any) => add(String(g.user_id || g.user || 'unknown'), g.user_name || g.user || '', 'grindings', g.output_qty_produced || g.output_qty || 0));

    return Array.from(map.values()).sort((a, b) => ((b.bipagens || 0) + (b.weighings || 0) + (b.grindings || 0)) - ((a.bipagens || 0) + (a.weighings || 0) + (a.grindings || 0)));
  }, [details]);

  const packagesList = useMemo(() => ({ registered: details?.packages || details?.production_packages || [], suggestions: details?.importedPackages || [] }), [details]);

  const estoquePronto = details?.estoquePronto || details?.estoque_pronto || [];
  const stockSnapshot = details?.stockItemsSnapshot || [];

  return (
    <div className="h-full space-y-6">
      <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 dark:from-slate-950 dark:via-blue-950 dark:to-slate-900 p-6 rounded-2xl border border-blue-700/50 shadow-lg">
        <div className="flex flex-wrap items-end gap-3 justify-between mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black text-blue-200 uppercase tracking-wider">Período</label>
              <DateRangePicker
                startDate={dateRangeStart}
                endDate={dateRangeEnd}
                onChange={(start, end) => {
                  setDateRangeStart(start);
                  setDateRangeEnd(end);
                }}
                isOpen={isDatePickerOpen}
                onOpenChange={setIsDatePickerOpen}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black text-blue-200 uppercase tracking-wider">Vista</label>
              <div className="flex gap-1 p-1 bg-slate-700/50 border border-blue-500/30 rounded-lg">
                <button
                  onClick={() => setVista('dia')}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                    vista === 'dia'
                      ? 'bg-blue-600 text-white'
                      : 'bg-transparent text-blue-200 hover:bg-blue-600/30'
                  }`}
                >
                  Dia
                </button>
                <button
                  onClick={() => setVista('geral')}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                    vista === 'geral'
                      ? 'bg-blue-600 text-white'
                      : 'bg-transparent text-blue-200 hover:bg-blue-600/30'
                  }`}
                >
                  Geral
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-black text-blue-200 uppercase tracking-wider">Exportar Por</label>
              <select value={dateSource} onChange={e => setDateSource(e.target.value as any)} className="px-3 py-2.5 border border-blue-500/30 rounded-lg bg-slate-800 text-white text-sm focus:ring-2 focus:ring-blue-400">
                <option value="imported">Data de Importação</option>
                <option value="original">Data de Envio</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/production/report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: dateRangeEnd, summary: prodSummary, details })
                  });
                  if (res.ok) {
                    const newSet = new Set([...savedDates, dateRangeEnd]);
                    setSavedDates(newSet);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('ecomflow_saved_dates', JSON.stringify([...newSet]));
                    }
                    if (addToast) addToast('Dia salvo com sucesso!', 'success');
                  }
                } catch (e) {
                  console.error('Erro ao salvar dia:', e);
                  if (addToast) addToast('Erro ao salvar dia', 'error');
                }
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white px-4 py-2.5 rounded-lg shadow-lg hover:shadow-xl hover:from-violet-600 hover:to-purple-700 transition-all font-bold text-sm"
            >
              <Save size={16} /> Salvar Dia
            </button>
            <button className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-4 py-2.5 rounded-lg shadow-lg hover:shadow-xl hover:from-emerald-600 hover:to-green-700 transition-all font-bold text-sm" onClick={() => {
                if (!prodSummary) { if (addToast) addToast('Sem dados para exportar', 'warning'); return; }
                try {
                  exportProductionSummary(dateRangeEnd, prodSummary, details, stockSnapshot, dateSource);
                  if (addToast) addToast('Exportação iniciada (arquivo salvo no navegador)', 'success');
                } catch (e) {
                  console.error('Erro ao exportar resumo:', e);
                  if (addToast) addToast('Erro ao exportar resumo', 'error');
                }
            }}>
              <FileDown size={16} /> Exportar
            </button>
            <button className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white px-4 py-2.5 rounded-lg shadow-lg hover:shadow-xl hover:from-sky-600 hover:to-blue-700 transition-all font-bold text-sm" onClick={async () => {
              try {
                const res = await fetch(`/api/production/report?date=${dateRangeEnd}`);
                const json = await res.json();
                if (json && json.success && json.report) {
                  setReportInitialData(json.report);
                  setIsReportModalOpen(true);
                } else {
                  if (addToast) addToast('Nenhum relatório salvo encontrado para essa data', 'info');
                }
              } catch (e) {
                console.error('Erro ao buscar relatório salvo:', e);
                if (addToast) addToast('Erro ao carregar relatório salvo', 'error');
              }
            }}>
              <Save size={16} /> Carregar
            </button>
          </div>
        </div>

        {showLoadBanner && (
          <div className="bg-amber-50/10 border border-amber-400/50 rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-amber-100">
              <AlertCircle size={16} />
              <span className="text-sm font-bold">📅 Existe dado salvo para {new Date(dateRangeEnd).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}. Carregar?</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/production/report?date=${dateRangeEnd}`);
                    const json = await res.json();
                    if (json && json.success && json.report) {
                      setReportInitialData(json.report);
                      setIsReportModalOpen(true);
                      setShowLoadBanner(false);
                    }
                  } catch (e) {
                    console.error('Erro ao carregar relatório:', e);
                  }
                }}
                className="px-3 py-1 bg-amber-400 text-amber-900 rounded text-xs font-bold hover:bg-amber-500 transition-colors"
              >
                Carregar
              </button>
              <button
                onClick={() => setShowLoadBanner(false)}
                className="px-3 py-1 bg-amber-700/50 text-amber-100 rounded text-xs font-bold hover:bg-amber-700 transition-colors"
              >
                Ignorar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-wide">Pedidos Importados</p>
              <p className="text-3xl font-black text-indigo-800 dark:text-indigo-200 mt-1">{loading ? '—' : ordersForPeriod.length}</p>
            </div>
            <div className="p-2.5 bg-indigo-200 dark:bg-indigo-700 rounded-lg"><ClipboardCheck size={20} className="text-indigo-600 dark:text-indigo-300" /></div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 border border-emerald-200 dark:border-emerald-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-300 uppercase tracking-wide">Itens Produção</p>
              <p className="text-3xl font-black text-emerald-800 dark:text-emerald-200 mt-1">{loading ? '—' : (totalItems - ordersForPeriod.reduce((s, o) => s + (o.qty_final || 0), 0))}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">(sem importação)</p>
            </div>
            <div className="p-2.5 bg-emerald-200 dark:bg-emerald-700 rounded-lg"><Box size={20} className="text-emerald-600 dark:text-emerald-300" /></div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 border border-amber-200 dark:border-amber-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-amber-600 dark:text-amber-300 uppercase tracking-wide">Matéria-Prima</p>
              <p className="text-3xl font-black text-amber-800 dark:text-amber-200 mt-1">{loading || loadingSummary ? '—' : (prodSummary ? (prodSummary.materials?.length || 0) : '—')}</p>
            </div>
            <div className="p-2.5 bg-amber-200 dark:bg-amber-700 rounded-lg"><Package size={20} className="text-amber-600 dark:text-amber-300" /></div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-900/30 dark:to-sky-800/30 border border-sky-200 dark:border-sky-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-sky-600 dark:text-sky-300 uppercase tracking-wide">Pacotes Prontos</p>
              <p className="text-3xl font-black text-sky-800 dark:text-sky-200 mt-1">{loading ? '—' : pacotesStats.lotes}</p>
              <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">{pacotesStats.unidades} unidades</p>
            </div>
            <div className="p-2.5 bg-sky-200 dark:bg-sky-700 rounded-lg"><Truck size={20} className="text-sky-600 dark:text-sky-300" /></div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-black text-slate-600 dark:text-slate-300 block uppercase tracking-wider mb-1.5">Plataforma</label>
            <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-400">
              <option value="ALL">Todas</option>
              <option value="ML">MercadoLibre</option>
              <option value="SHOPEE">Shopee</option>
              <option value="SITE">Site</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-black text-slate-600 dark:text-slate-300 block uppercase tracking-wider mb-1.5">Operador</label>
            <select value={operatorFilter} onChange={e => setOperatorFilter(e.target.value)} className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-400">
              <option value="ALL">Todos</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="text-xs font-black text-slate-600 dark:text-slate-300 block uppercase tracking-wider mb-1.5">Busca (SKU / Pedido)</label>
            <input value={search} onChange={e => setSearch(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-400" placeholder="Pesquisar..." />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <Collapsible title={`Pedidos Importados ${dateRangeStart === dateRangeEnd ? '' : `(${dateRangeStart} a ${dateRangeEnd})`}`} defaultOpen>
            {loadingSummary ? (
              <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                <div className="animate-spin mr-2">⏳</div> Carregando pedidos...
              </div>
            ) : ordersForPeriod.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <div className="text-3xl font-black text-blue-600 dark:text-blue-400">{ordersForPeriod.length}</div>
                  <div>
                    <p className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-wide">Total de Pedidos</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      {dateRange === 'today' ? 'importados nesta data' : `no período de ${getDateRange.start} a ${getDateRange.end}`}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(ordersForPeriod.reduce((acc: Record<string, number>, o) => {
                    const canal = o.canal || 'Outros';
                    acc[canal] = (acc[canal] || 0) + 1;
                    return acc;
                  }, {})).map(([plat, cnt]) => (
                    <div key={plat} className="p-3 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-center hover:shadow-md transition-shadow">
                      <div className="text-xs text-slate-600 dark:text-slate-300 font-bold uppercase truncate">{plat}</div>
                      <div className="font-black text-xl text-slate-900 dark:text-white mt-1">{cnt}</div>
                    </div>
                  ))}
                </div>

                {ordersForPeriod.length > 0 && (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700">
                        <tr className="text-white font-bold">
                          <th className="px-4 py-3 text-left">Pedido</th>
                          <th className="px-4 py-3 text-left">Cliente</th>
                          <th className="px-4 py-3 text-right">Qtd</th>
                          <th className="px-4 py-3 text-left">Canal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {ordersForPeriod.slice(0, 10).map((o: any, idx: number) => (
                          <tr key={o.orderId || idx} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-700/50'}>
                            <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{o.orderId || o.numero || '—'}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300 truncate max-w-[150px]">{o.cliente || '—'}</td>
                            <td className="px-4 py-3 text-right font-black text-blue-600 dark:text-blue-400">{o.qty_final || 0}</td>
                            <td className="px-4 py-3 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded font-bold inline-block">{o.canal || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {ordersForPeriod.length > 10 && (
                      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 text-xs text-slate-500 dark:text-slate-400 font-bold">
                        ... e mais {ordersForPeriod.length - 10} pedido(s)
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                <span className="text-3xl mr-2">📭</span> Nenhum pedido disponível para o período selecionado.
              </div>
            )}
          </Collapsible>

          <Collapsible title="Matéria-Prima Necessária">
            {loadingSummary ? (
              <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                <div className="animate-spin mr-2">⏳</div> Calculando necessidade de insumos...
              </div>
            ) : prodSummary && (prodSummary.materials || []).length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                  <thead className="bg-gradient-to-r from-amber-600 to-yellow-600 dark:from-amber-700 dark:to-yellow-700">
                    <tr className="text-white font-bold">
                      <th className="px-4 py-3 text-left">Insumo</th>
                      <th className="px-4 py-3 text-right">Necessidade</th>
                      <th className="px-4 py-3 text-right">Saldo Anterior</th>
                      <th className="px-4 py-3 text-right">Estoque Atual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {(prodSummary.materials || []).map((m: any, idx: number) => {
                      const stock = stockItems.find(s => String(s.code || '').toUpperCase() === String(m.code || '').toUpperCase());
                      const previousQty = stock ? Number(stock.previous_qty || stock.current_qty || 0) : 0;
                      const currentQty = stock ? Number(stock.current_qty || 0) : 0;
                      return (
                        <tr key={m.code} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-700/50'}>
                          <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{m.name} <span className="text-xs text-slate-400 font-normal">({m.code})</span></td>
                          <td className="px-4 py-3 text-right font-black text-amber-600 dark:text-amber-400">{Number(m.quantity || 0).toFixed(3)} {m.unit}</td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{previousQty.toFixed(3)}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{stock ? currentQty.toFixed(3) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                <span className="text-3xl mr-2">📦</span> Nenhum insumo calculado.
              </div>
            )}
          </Collapsible>

          <ProductionReportModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            initialData={reportInitialData}
            period={period === 'daily' ? 'daily' : 'monthly'}
            onSave={async (payload: any) => {
              const enriched = {
                ...payload,
                // Backend espera arrays com esses nomes: bipagens, personnel, processes, etc.
                personnel: (selectedEmployees || []).map((id: string) => ({ user_id: id })),
                bipagens: (manualBipagens || []).map(b => ({ product_sku: b.product_sku, quantity: b.quantity, platform: b.platform })),
                notes: [payload?.notes || '', ...(observations || [])].filter(Boolean).join('\n')
              };
              try {
                const res = await fetch('/api/production/reports', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(enriched)
                });
                const json = await res.json();
                if (json && json.success) {
                  if (addToast) addToast('Relatório salvo com sucesso', 'success');
                  try {
                    const s = await fetch(`/api/production/summary?date=${enriched.report_date}`);
                    const js = await s.json();
                    if (js && js.success) setProdSummary(js);
                  } catch (e) { console.warn('Falha ao recarregar summary:', e); }
                  setIsReportModalOpen(false);
                  return { success: true, report: json.report };
                }
                alert('Falha ao salvar: ' + (json?.error || JSON.stringify(json)));
                return { success: false };
              } catch (e) {
                console.error('Erro ao salvar relatório:', e);
                alert('Erro ao salvar relatório: ' + e.message);
                return { success: false };
              }
            }}
            stockItems={stockItems}
          />

          <Collapsible title="Funcionários do dia">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <label className="text-sm text-gray-500">Filtrar por setor</label>
                <select value={selectedSector} onChange={e => setSelectedSector(e.target.value)} className="px-2 py-1 border rounded">
                  <option value="ALL">Todos</option>
                  {(details?.sectors || details?.setores || []).map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-auto">
                {(details?.users || users || []).filter((u: any) => selectedSector === 'ALL' || (Array.isArray(u.setor) && u.setor.includes(selectedSector))).map((u: any) => (
                  <label key={u.id} className="flex items-center gap-2 p-2 border rounded">
                    <input type="checkbox" checked={selectedEmployees.includes(u.id)} onChange={() => {
                      setSelectedEmployees(prev => prev.includes(u.id) ? prev.filter(x => x !== u.id) : [...prev, u.id]);
                    }} />
                    <div>
                      <div className="font-bold">{u.name}</div>
                      <div className="text-xs text-gray-400">{(u.setor || []).join(', ')}</div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="mt-3">
                <button onClick={() => { if (addToast) addToast('Funcionários selecionados (serão salvos junto ao relatório)', 'info'); }} className="px-3 py-2 bg-blue-600 text-white rounded">Marcar</button>
              </div>
            </div>
          </Collapsible>

          <Collapsible title="Produção de moagem">
            <div>
              {((details?.grindings || details?.grinding_batches) || []).length === 0 ? (
                <div className="text-sm text-gray-500">Nenhuma moagem registrada no período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50"><tr className="text-slate-500 font-bold"><th className="px-3 py-2 text-left">Batch</th><th className="px-3 py-2 text-left">Origem</th><th className="px-3 py-2 text-right">Qtd</th><th className="px-3 py-2 text-left">Operador</th></tr></thead>
                    <tbody>{(details?.grindings || details?.grinding_batches || []).map((g: any) => (<tr key={g.id} className="border-t"><td className="px-3 py-2">{g.batch_name || g.id}</td><td className="px-3 py-2">{g.source_insumo_name || g.source_insumo_code}</td><td className="px-3 py-2 text-right">{g.output_qty_produced || g.output_qty || 0}</td><td className="px-3 py-2">{g.user_name || g.user || ''}</td></tr>))}</tbody>
                  </table>
                </div>
              )}
            </div>
          </Collapsible>

          <Collapsible title="Ensacamento">
            <div>
              {((details?.weighings || details?.weighing_batches) || []).length === 0 ? (
                <div className="text-sm text-gray-500">Nenhum lote de pesagem no período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50"><tr className="text-slate-500 font-bold"><th className="px-3 py-2 text-left">Lote</th><th className="px-3 py-2 text-left">Produto</th><th className="px-3 py-2 text-right">Qtd Produzida</th><th className="px-3 py-2 text-left">Operador</th><th className="px-3 py-2 text-left">Pigmento</th></tr></thead>
                    <tbody>{(details?.weighings || details?.weighing_batches || []).map((w: any) => (<tr key={w.id} className="border-t"><td className="px-3 py-2">{w.batch_name || w.id}</td><td className="px-3 py-2">{w.stock_item_name || w.stock_item_code}</td><td className="px-3 py-2 text-right">{w.qty_produced || 0}</td><td className="px-3 py-2">{w.operador_batedor || w.operador_maquina || w.created_by_name || ''}</td><td className="px-3 py-2">{w.com_cor ? 'Sim' : 'Não'}</td></tr>))}</tbody>
                  </table>
                </div>
              )}
            </div>
          </Collapsible>
        </div>

        <aside className="space-y-6">
          <Collapsible title="Mistura de cor">
            <div>
              {mixes.length === 0 ? (
                <div className="text-sm text-gray-500">Nenhuma mistura registrada no período.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50"><tr className="text-slate-500 font-bold"><th className="px-3 py-2 text-left">Tipo</th><th className="px-3 py-2 text-left">Produto</th><th className="px-3 py-2 text-right">Qtd</th><th className="px-3 py-2 text-left">Operador</th><th className="px-3 py-2 text-left">Data</th></tr></thead>
                    <tbody>
                      {mixes.map((m: any) => (
                        <tr key={m.id} className="border-t"><td className="px-3 py-2">{m.type}</td><td className="px-3 py-2">{m.product}</td><td className="px-3 py-2 text-right">{Number(m.qty || 0).toFixed(3)}</td><td className="px-3 py-2">{m.operator}</td><td className="px-3 py-2">{m.createdAt ? new Date(m.createdAt).toLocaleString() : '—'}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Collapsible>

          <Collapsible title="Produção por Pessoa">
            <div>
              {productionByPerson.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                  <span className="text-3xl mr-2">👥</span> Nenhuma produção por pessoa registrada.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {productionByPerson.map((p: any) => (
                    <div key={p.userId} className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{p.name || p.userId}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">ID: {p.userId}</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-600 dark:text-slate-300">Bipagens</span>
                          <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded font-bold text-sm">{p.bipagens || 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-600 dark:text-slate-300">Pesagem</span>
                          <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded font-bold text-sm">{p.weighings || 0}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-600 dark:text-slate-300">Moagem</span>
                          <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded font-bold text-sm">{p.grindings || 0}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Collapsible>

          <Collapsible title="Pacotes Feitos à Parte">
            <div>
              {(packagesList.registered || []).length === 0 && (packagesList.suggestions || []).length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                  <span className="text-3xl mr-2">📦</span> Nenhum pacote registrado ou sugerido para o período.
                </div>
              ) : (
                <div className="space-y-4">
                  {(packagesList.registered || []).length > 0 && (
                    <div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-xs font-black">✓ REGISTRADOS</span>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-700 dark:to-emerald-700">
                            <tr className="text-white font-bold">
                              <th className="px-4 py-3 text-left">Descrição</th>
                              <th className="px-4 py-3 text-right">Qtd</th>
                              <th className="px-4 py-3 text-left">Destino</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {(packagesList.registered || []).map((p: any, idx: number) => (
                              <tr key={p.id} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-700/50'}>
                                <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{p.description || p.product_sku || '—'}</td>
                                <td className="px-4 py-3 text-right font-bold text-green-600 dark:text-green-400">{p.quantity || p.qty || 0}</td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.destination || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {(packagesList.suggestions || []).length > 0 && (
                    <div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs font-black">💡 SUGESTÕES</span>
                      </div>
                      <ul className="space-y-2">
                        {(packagesList.suggestions || []).map((s: any, i: number) => (
                          <li key={i} className="flex items-center justify-between p-3 border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:shadow-md transition-shadow">
                            <div className="text-sm">
                              <span className="font-bold text-slate-900 dark:text-white">{s.sku}</span>
                              <span className="mx-2 text-slate-400">×</span>
                              <span className="font-black text-blue-600 dark:text-blue-400">{s.qty_final}</span>
                              {s.canal && <span className="ml-3 text-xs bg-blue-200 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold">{s.canal}</span>}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Collapsible>

          <Collapsible title="Estoque">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Estoque Geral (Snapshot)</div>
                {(stockSnapshot || []).length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                    <span className="text-3xl mr-2">📭</span> Nenhum item de estoque disponível.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-700 dark:to-blue-700">
                        <tr className="text-white font-bold">
                          <th className="px-4 py-3 text-left">Código</th>
                          <th className="px-4 py-3 text-left">Nome</th>
                          <th className="px-4 py-3 text-right">Estoque</th>
                          <th className="px-4 py-3 text-right">Prontos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {(stockSnapshot || []).map((s: any, idx: number) => (
                          <tr key={s.code} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-700/50'}>
                            <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{s.code}</td>
                            <td className="px-4 py-3 text-slate-900 dark:text-white">{s.name}</td>
                            <td className="px-4 py-3 text-right font-bold text-cyan-600 dark:text-cyan-400">{Number(s.current_qty || 0).toFixed(3)}</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{Number(s.ready_qty || 0).toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">
                  Pacotes Prontos {estoqueProntoStats.lotes > 0 && `(${estoqueProntoStats.lotes} lotes • ${estoqueProntoStats.unidades} un.)`}
                </div>
                {(estoquePronto || []).length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                    <span className="text-3xl mr-2">📦</span> Nenhum pacote pronto registrado.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gradient-to-r from-emerald-600 to-green-600 dark:from-emerald-700 dark:to-green-700">
                        <tr className="text-white font-bold">
                          <th className="px-4 py-3 text-left">Batch</th>
                          <th className="px-4 py-3 text-left">SKU</th>
                          <th className="px-4 py-3 text-right">Total</th>
                          <th className="px-4 py-3 text-right">Disponível</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {(estoquePronto || []).map((p: any, idx: number) => (
                          <tr key={p.id || p.batch_id} className={idx % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-700/50'}>
                            <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{p.batch_id || p.id}</td>
                            <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{p.stock_item_code || (p.produtos && p.produtos[0] && p.produtos[0].code) || '—'}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">{Number(p.quantidade_total || p.quantidade_disponivel || 0)}</td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{Number(p.quantidade_disponivel || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-600">
                        <tr className="font-bold">
                          <td colSpan={2} className="px-4 py-3 text-slate-900 dark:text-white text-right">TOTAL:</td>
                          <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                            {(estoquePronto || []).reduce((s: number, p: any) => s + (p.quantidade_total || p.quantidade_disponivel || 0), 0)}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">
                            {(estoquePronto || []).reduce((s: number, p: any) => s + (p.quantidade_disponível || 0), 0)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </Collapsible>

          <Collapsible title="Pedidos Coletados / Complementares">
            <div className="space-y-3">

              {/* Bipagem dos Pedidos Importados */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="text-sm font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                    <Package size={16} /> Pedidos em Aberto ({ordersForPeriod.length})
                  </div>
                  {ordersForPeriod.length > 0 && (
                    <button
                      onClick={() => {
                        const totalQty = ordersForPeriod.reduce((s, o) => s + (o.qty_final || 0), 0);
                        setManualBipagens([{
                          product_sku: `TODOS-${ordersForPeriod.length}-PEDIDOS`,
                          quantity: totalQty,
                          platform: 'TODOS'
                        }]);
                        if (addToast) addToast(`${ordersForPeriod.length} pedidos selecionados (${totalQty} itens)`, 'success');
                      }}
                      className="px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition-all"
                    >
                      + Selecionar Todos
                    </button>
                  )}
                </div>
                {ordersForPeriod.length === 0 ? (
                  <div className="text-xs text-gray-500">Nenhum pedido no período.</div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {[1, 2, 3].map((catIdx) => {
                      const pedidosNesta = ordersForPeriod.filter((_, pIdx) => pIdx % 3 === catIdx - 1);
                      if (pedidosNesta.length === 0) return null;
                      const totalQty = pedidosNesta.reduce((sum, p) => sum + (p.qty_final || 0), 0);
                      return (
                        <button
                          key={catIdx}
                          onClick={() => {
                            setManualBipagens([{
                              product_sku: `CAT-${catIdx}-${pedidosNesta.length}-PED`,
                              quantity: totalQty,
                              platform: 'IMPORTADO'
                            }]);
                            if (addToast) addToast(`Categoria ${catIdx}: ${pedidosNesta.length} pedidos (${totalQty} itens)`, 'success');
                          }}
                          className="bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded p-2 text-center hover:bg-blue-100 dark:hover:bg-blue-900 transition-all"
                        >
                          <div className="font-bold text-xs text-slate-800 dark:text-slate-200">Cat {catIdx}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">{pedidosNesta.length}p</div>
                          <div className="font-bold text-xs text-blue-600 dark:text-blue-400">{totalQty}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Registro de Coleta */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                <label className="text-sm font-bold text-amber-900 dark:text-amber-200 block mb-3 flex items-center gap-2">
                  <MapPin size={16} /> Registrar Coleta
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs font-black text-amber-700 dark:text-amber-300 block mb-1.5">ID Coleta</label>
                    <input
                      type="text"
                      value={newColeta.coletaId || ''}
                      onChange={e => setNewColeta({...newColeta, coletaId: e.target.value})}
                      placeholder="ex: COLETA-001"
                      className="w-full px-3 py-2 border border-amber-300 dark:border-amber-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-amber-700 dark:text-amber-300 block mb-1.5">Plataforma</label>
                    <select
                      value={newColeta.plataforma || 'ML'}
                      onChange={e => setNewColeta({...newColeta, plataforma: e.target.value})}
                      className="w-full px-3 py-2 border border-amber-300 dark:border-amber-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="ML">Mercado Livre</option>
                      <option value="SHOPEE">Shopee</option>
                      <option value="SITE">Site</option>
                      <option value="TIKTOK">TikTok</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-black text-amber-700 dark:text-amber-300 block mb-1.5">Motorista</label>
                    <input
                      type="text"
                      value={newColeta.motorista || ''}
                      onChange={e => setNewColeta({...newColeta, motorista: e.target.value})}
                      placeholder="Nome do motorista"
                      className="w-full px-3 py-2 border border-amber-300 dark:border-amber-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-amber-700 dark:text-amber-300 block mb-1.5">Placa do Caminhão</label>
                    <input
                      type="text"
                      value={newColeta.placaCaminhao || ''}
                      onChange={e => setNewColeta({...newColeta, placaCaminhao: e.target.value})}
                      placeholder="ex: ABC-1234"
                      className="w-full px-3 py-2 border border-amber-300 dark:border-amber-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-amber-700 dark:text-amber-300 block mb-1.5">Data</label>
                    <input
                      type="date"
                      value={newColeta.dataColeta || date}
                      onChange={e => setNewColeta({...newColeta, dataColeta: e.target.value})}
                      className="w-full px-3 py-2 border border-amber-300 dark:border-amber-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-amber-700 dark:text-amber-300 block mb-1.5">Horário</label>
                    <input
                      type="time"
                      value={newColeta.horarioColeta || new Date().toTimeString().slice(0,5)}
                      onChange={e => setNewColeta({...newColeta, horarioColeta: e.target.value})}
                      className="w-full px-3 py-2 border border-amber-300 dark:border-amber-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!newColeta.coletaId || !newColeta.motorista || !newColeta.placaCaminhao) {
                      if (addToast) addToast('Preencha todos os campos obrigatórios', 'warning');
                      return;
                    }
                    const coleta: ColetaItem = {
                      id: `COLETA-${Date.now()}`,
                      coletaId: newColeta.coletaId!,
                      plataforma: newColeta.plataforma as any,
                      motorista: newColeta.motorista!,
                      placaCaminhao: newColeta.placaCaminhao!,
                      dataColeta: newColeta.dataColeta || date,
                      horarioColeta: newColeta.horarioColeta || new Date().toTimeString().slice(0,5),
                      lotes: manualBipagens.map(b => b.product_sku),
                      pedidos: [],
                      totalItens: manualBipagens.reduce((s, b) => s + b.quantity, 0),
                      totalPedidos: ordersForPeriod.length,
                      observacoes: '',
                      status: 'pendente',
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    };
                    setColetas([...coletas, coleta]);
                    setNewColeta({ plataforma: 'ML', status: 'pendente' });
                    setManualBipagens([]);
                    if (addToast) addToast('Coleta registrada com sucesso', 'success');
                  }}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:from-amber-600 hover:to-orange-700 transition-all font-bold text-sm flex items-center justify-center gap-2"
                >
                  <Plus size={16} /> Registrar Coleta
                </button>
              </div>

              {/* Adicionar manualmente */}
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg p-4">
                <label className="text-sm font-bold text-emerald-900 dark:text-emerald-200 block mb-3">Adicionar Bipagem Manual</label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input value={newBip.product_sku} onChange={e => setNewBip({...newBip, product_sku: e.target.value})} placeholder="SKU do produto" className="px-3 py-2 border border-emerald-300 dark:border-emerald-600 rounded-lg flex-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-400" />
                    <input type="number" value={newBip.quantity} onChange={e => setNewBip({...newBip, quantity: Number(e.target.value)})} placeholder="Qtd" className="px-3 py-2 border border-emerald-300 dark:border-emerald-600 rounded-lg w-24 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-400" />
                  </div>
                  <div className="flex gap-2">
                    <select value={newBip.platform} onChange={e => setNewBip({...newBip, platform: e.target.value})} className="px-3 py-2 border border-emerald-300 dark:border-emerald-600 rounded-lg flex-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-400">
                      <option value="SITE">Site</option>
                      <option value="ML">MercadoLibre</option>
                      <option value="SHOPEE">Shopee</option>
                    </select>
                    <button className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg hover:from-emerald-600 hover:to-green-700 transition-all font-bold text-sm" onClick={() => {
                      if (!newBip.product_sku) { if (addToast) addToast('Informe um SKU', 'warning'); return; }
                      setManualBipagens(prev => [...prev, {...newBip}]);
                      setNewBip({ product_sku: '', quantity: 1, platform: 'SITE' });
                    }}>Adicionar</button>
                  </div>
                </div>
              </div>

              {/* Lista de bipagens adicionadas */}
              {(manualBipagens || []).length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Itens Adicionados ({manualBipagens.length})</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {manualBipagens.map((b, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg">
                        <div className="text-sm">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{b.product_sku}</span>
                          <span className="mx-2 text-gray-400">×</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{b.quantity}</span>
                          <span className="ml-3 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">{b.platform}</span>
                        </div>
                        <button className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-bold" onClick={() => setManualBipagens(prev => prev.filter((_, idx) => idx !== i))}>✕ Remover</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista de coletas registradas */}
              {coletas.length > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                  <p className="text-sm font-bold text-green-900 dark:text-green-200 mb-3">Coletas Registradas ({coletas.length})</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {coletas.map((c, i) => (
                      <div key={c.id} className="flex items-start justify-between p-3 bg-white dark:bg-slate-800 border border-green-200 dark:border-green-700 rounded-lg">
                        <div className="text-sm flex-1">
                          <div className="font-bold text-slate-900 dark:text-white">{c.coletaId}</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            <div>👤 {c.motorista} | 🚚 {c.placaCaminhao}</div>
                            <div>📦 {c.plataforma} | ⏰ {c.horarioColeta}</div>
                            <div>📊 {c.totalItens} itens | {c.totalPedidos} pedidos</div>
                          </div>
                        </div>
                        <button
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-bold p-2"
                          onClick={() => setColetas(prev => prev.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Collapsible>

          <Collapsible title="Observações">
            <div>
              <div className="mb-2">
                <input value={obsInput} onChange={e => setObsInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { if (obsInput.trim()) { setObservations(prev => [obsInput.trim(), ...prev]); setObsInput(''); } e.preventDefault(); } }} placeholder="Digite e pressione Enter" className="w-full px-2 py-2 border rounded" />
              </div>
              <div className="space-y-2">
                {(observations || []).map((o, i) => (
                  <div key={i} className="flex items-start justify-between p-2 border rounded">
                    <div className="text-sm">{o}</div>
                    <button className="text-sm text-red-600" onClick={() => setObservations(prev => prev.filter((_, idx) => idx !== i))}>Remover</button>
                  </div>
                ))}
                {(observations || []).length === 0 && <div className="text-sm text-gray-500">Nenhuma observação.</div>}
              </div>
            </div>
          </Collapsible>
        </aside>
      </div>
    </div>
  );
};

export default ResumoProducaoPage;
