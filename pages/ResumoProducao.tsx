import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, FileDown, Save, Package, Box, Truck, ClipboardCheck } from 'lucide-react';
import InfoCard from '../components/InfoCard';
import Collapsible from '../components/Collapsible';
import ProductionReportModal from '../components/ProductionReportModal';
import { exportProductionSummary } from '../lib/export';
import { StockItem, StockMovement, OrderItem, WeighingBatch, GrindingBatch, ScanLogItem, User, ProdutoCombinado, SkuLink, GeneralSettings } from '../types';

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
  const [date, setDate] = useState<string>(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0,10); });
  const [period, setPeriod] = useState<'daily'|'weekly'|'monthly'>('daily');
  const [platformFilter, setPlatformFilter] = useState<string>('ALL');
  const [operatorFilter, setOperatorFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

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

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 350);
    return () => clearTimeout(t);
  }, []);

  const ordersForPeriod = useMemo(() => {
    return orders.filter(o => {
      const dStr = String(o.data || '').split('/').reverse().join('-');
      if (period === 'daily') return dStr === date;
      return true;
    }).filter(o => platformFilter === 'ALL' || (o.canal === platformFilter));
  }, [orders, date, period, platformFilter]);

  const totalItems = ordersForPeriod.reduce((s, o) => s + (o.qty_final || 0), 0);

  useEffect(() => {
    let mounted = true;
    const fetchSummary = async () => {
      setLoadingSummary(true);
      try {
        const res = await fetch(`/api/production/summary?date=${date}`);
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
        const res = await fetch(`/api/production/details?date=${date}&period=${period}`);
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
  }, [date, period]);

  // Compute derived views to replace placeholders
  const pacotesRegistradosCount = useMemo(() => {
    const registered = (details?.packages || details?.production_packages || []).length || 0;
    const suggested = (details?.importedPackages || []).length || 0;
    return registered + suggested;
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
      <div className="bg-gradient-to-r from-slate-50 to-white dark:from-gray-900 dark:to-gray-800 p-4 rounded-xl border">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="text-slate-500" />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 border rounded-md bg-white/60" />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">Período</label>
            <select value={period} onChange={e => setPeriod(e.target.value as any)} className="px-2 py-2 border rounded-md bg-white/60">
              <option value="daily">Diário</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
            </select>
          </div>

            <div className="ml-auto flex items-center gap-2">
            <button className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white px-3 py-2 rounded shadow" onClick={() => {
                if (!prodSummary) { if (addToast) addToast('Sem dados para exportar', 'warning'); return; }
                try {
                  exportProductionSummary(date, prodSummary, details, stockSnapshot);
                  if (addToast) addToast('Exportação iniciada (arquivo salvo no navegador)', 'success');
                } catch (e) {
                  console.error('Erro ao exportar resumo:', e);
                  if (addToast) addToast('Erro ao exportar resumo', 'error');
                }
            }}>
              <FileDown /> Exportar
            </button>
            <button className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white px-3 py-2 rounded shadow" onClick={async () => {
              try {
                const res = await fetch(`/api/production/report?date=${date}`);
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
              <Save /> Carregar
            </button>
            <button className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-2 rounded shadow" onClick={() => { setReportInitialData(null); setIsReportModalOpen(true); }}>
              <Save /> Salvar
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard title="Pedidos Importados" value={ordersForPeriod.length} icon={<ClipboardCheck size={18} />} accent="bg-indigo-500" loading={loading} />
        <InfoCard title="Itens Totais" value={totalItems} icon={<Box size={18} />} accent="bg-emerald-500" loading={loading} />
        <InfoCard title="Matéria-prima estimada" value={prodSummary ? (prodSummary.materials?.length || 0) : '—'} icon={<Package size={18} />} accent="bg-yellow-400" loading={loading || loadingSummary} />
        <InfoCard title="Pacotes (registrados)" value={pacotesRegistradosCount} icon={<Truck size={18} />} accent="bg-sky-500" loading={loading} />
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="text-sm text-gray-500 block">Plataforma</label>
            <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)} className="px-3 py-2 border rounded-md">
              <option value="ALL">Todas</option>
              <option value="ML">MercadoLibre</option>
              <option value="SHOPEE">Shopee</option>
              <option value="SITE">Site</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-500 block">Operador</label>
            <select value={operatorFilter} onChange={e => setOperatorFilter(e.target.value)} className="px-3 py-2 border rounded-md">
              <option value="ALL">Todos</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-sm text-gray-500 block">Busca (SKU / Pedido)</label>
            <input value={search} onChange={e => setSearch(e.target.value)} className="w-full px-3 py-2 border rounded-md" placeholder="Pesquisar..." />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Collapsible title="Pedidos importados do dia" defaultOpen>
            {loadingSummary ? (
              <div className="text-sm text-gray-500">Carregando pedidos...</div>
            ) : prodSummary ? (
              <div>
                <div className="text-sm text-gray-600 mb-3">Total de pedidos: <strong>{prodSummary.ordersCount}</strong></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(prodSummary.ordersByPlatform || {}).map(([plat, cnt]) => (
                    <div key={plat} className="p-3 bg-slate-50 rounded">
                      <div className="text-xs text-gray-500 uppercase">{plat}</div>
                      <div className="font-black text-lg">{cnt}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50"><tr className="text-slate-500 font-bold"><th className="px-3 py-2 text-left">SKU</th><th className="px-3 py-2 text-right">Qtd</th></tr></thead>
                    <tbody>
                      {(prodSummary.products || []).map((p: any) => (
                        <tr key={p.sku} className="border-t"><td className="px-3 py-2 font-bold">{p.sku}</td><td className="px-3 py-2 text-right font-black">{p.quantity}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Nenhum dado disponível para a data selecionada.</div>
            )}
          </Collapsible>

          <Collapsible title="Matéria-prima necessária">
            {loadingSummary ? (
              <div className="text-sm text-gray-500">Calculando necessidade de insumos...</div>
            ) : prodSummary ? (
              <div className="overflow-x-auto rounded-xl border">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50"><tr className="text-slate-500 font-bold"><th className="px-4 py-2 text-left">Insumo</th><th className="px-4 py-2 text-right">Necessidade</th><th className="px-4 py-2 text-right">Estoque</th></tr></thead>
                  <tbody>
                    {(prodSummary.materials || []).map((m: any) => {
                      const stock = stockItems.find(s => String(s.code || '').toUpperCase() === String(m.code || '').toUpperCase());
                      return (
                        <tr key={m.code} className="border-t"><td className="px-4 py-2 font-bold">{m.name} <span className="text-xs text-gray-400">({m.code})</span></td><td className="px-4 py-2 text-right font-black">{Number(m.quantity || 0).toFixed(3)} {m.unit}</td><td className="px-4 py-2 text-right">{stock ? Number(stock.current_qty || 0).toFixed(3) : '—'}</td></tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Nenhum insumo calculado.</div>
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

          <Collapsible title="Produção por pessoa">
            <div>
              {productionByPerson.length === 0 ? (
                <div className="text-sm text-gray-500">Nenhuma produção por pessoa registrada.</div>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {productionByPerson.map((p: any) => (
                    <div key={p.userId} className="p-3 border rounded flex justify-between items-center">
                      <div>
                        <div className="font-bold">{p.name || p.userId}</div>
                        <div className="text-xs text-gray-400">ID: {p.userId}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">Bipagens: <strong>{p.bipagens || 0}</strong></div>
                        <div className="text-sm">Pesagem: <strong>{p.weighings || 0}</strong></div>
                        <div className="text-sm">Moagem: <strong>{p.grindings || 0}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Collapsible>

          <Collapsible title="Pacotes feitos à parte">
            <div>
              {(packagesList.registered || []).length === 0 && (packagesList.suggestions || []).length === 0 ? (
                <div className="text-sm text-gray-500">Nenhum pacote registrado ou sugerido para o período.</div>
              ) : (
                <div className="space-y-4">
                  {(packagesList.registered || []).length > 0 && (
                    <div>
                      <div className="font-bold mb-2">Pacotes registrados</div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50"><tr className="text-slate-500 font-bold"><th className="px-3 py-2 text-left">Descrição</th><th className="px-3 py-2 text-right">Qtd</th><th className="px-3 py-2 text-left">Destino</th></tr></thead>
                          <tbody>
                            {(packagesList.registered || []).map((p: any) => (<tr key={p.id} className="border-t"><td className="px-3 py-2">{p.description || p.product_sku || '—'}</td><td className="px-3 py-2 text-right">{p.quantity || p.qty || 0}</td><td className="px-3 py-2">{p.destination || '—'}</td></tr>))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {(packagesList.suggestions || []).length > 0 && (
                    <div>
                      <div className="font-bold mb-2">Sugestões (importação)</div>
                      <ul className="space-y-1">
                        {(packagesList.suggestions || []).map((s: any, i: number) => (
                          <li key={i} className="flex items-center justify-between p-2 border rounded">
                            <div className="text-sm">{s.sku} — <strong>{s.qty_final}</strong> — <span className="text-xs text-gray-500">{s.canal || ''}</span></div>
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
            <div>
              <div className="mb-3">
                <div className="font-bold">Estoque geral (snapshot)</div>
                {(stockSnapshot || []).length === 0 ? (
                  <div className="text-sm text-gray-500">Nenhum item de estoque disponível.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50"><tr className="text-slate-500 font-bold"><th className="px-3 py-2 text-left">Código</th><th className="px-3 py-2 text-left">Nome</th><th className="px-3 py-2 text-right">Estoque</th><th className="px-3 py-2 text-right">Prontos</th></tr></thead>
                      <tbody>
                        {(stockSnapshot || []).map((s: any) => (<tr key={s.code} className="border-t"><td className="px-3 py-2">{s.code}</td><td className="px-3 py-2">{s.name}</td><td className="px-3 py-2 text-right">{Number(s.current_qty || 0).toFixed(3)}</td><td className="px-3 py-2 text-right">{Number(s.ready_qty || 0).toFixed(3)}</td></tr>))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <div className="font-bold">Pacotes prontos</div>
                {(estoquePronto || []).length === 0 ? (
                  <div className="text-sm text-gray-500">Nenhum pacote pronto registrado.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50"><tr className="text-slate-500 font-bold"><th className="px-3 py-2 text-left">Batch</th><th className="px-3 py-2 text-left">SKU</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Disponível</th></tr></thead>
                      <tbody>
                        {(estoquePronto || []).map((p: any) => (<tr key={p.id || p.batch_id} className="border-t"><td className="px-3 py-2">{p.batch_id || p.id}</td><td className="px-3 py-2">{p.stock_item_code || (p.produtos && p.produtos[0] && p.produtos[0].code) || '—'}</td><td className="px-3 py-2 text-right">{Number(p.quantidade_total || p.quantidade_disponivel || 0)}</td><td className="px-3 py-2 text-right">{Number(p.quantidade_disponivel || 0)}</td></tr>))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </Collapsible>

          <Collapsible title="Pedidos coletados / complementares">
            <div>
              <div className="text-sm text-gray-500 mb-2">Marcar pedidos coletados ou adicionar complementares manualmente.</div>
              <div className="mb-3">
                <label className="text-sm text-gray-500 block">Adicionar bipagem/manual</label>
                <div className="flex gap-2 mt-2">
                  <input value={newBip.product_sku} onChange={e => setNewBip({...newBip, product_sku: e.target.value})} placeholder="SKU" className="px-2 py-1 border rounded flex-1" />
                  <input type="number" value={newBip.quantity} onChange={e => setNewBip({...newBip, quantity: Number(e.target.value)})} className="w-20 px-2 py-1 border rounded" />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <select value={newBip.platform} onChange={e => setNewBip({...newBip, platform: e.target.value})} className="px-2 py-1 border rounded">
                    <option value="SITE">Site</option>
                    <option value="ML">MercadoLibre</option>
                    <option value="SHOPEE">Shopee</option>
                  </select>
                  <button className="px-3 py-1 bg-emerald-500 text-white rounded" onClick={() => {
                    if (!newBip.product_sku) { if (addToast) addToast('Informe um SKU', 'warning'); return; }
                    setManualBipagens(prev => [...prev, {...newBip}]);
                    setNewBip({ product_sku: '', quantity: 1, platform: 'SITE' });
                  }}>Adicionar</button>
                </div>
              </div>
              <div>
                {(manualBipagens || []).length === 0 ? <div className="text-sm text-gray-500">Nenhuma bipagem manual</div> : (
                  <ul className="space-y-1">
                    {manualBipagens.map((b, i) => (
                      <li key={i} className="flex items-center justify-between p-2 border rounded">
                        <div className="text-sm">{b.product_sku} — <strong>{b.quantity}</strong> — <span className="text-xs text-gray-500">{b.platform}</span></div>
                        <div>
                          <button className="text-sm text-red-600" onClick={() => setManualBipagens(prev => prev.filter((_, idx) => idx !== i))}>Remover</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
