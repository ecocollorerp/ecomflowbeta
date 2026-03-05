import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  CheckCircle,
  AlertCircle,
  Loader,
  RotateCcw,
  Filter,
  Download,
  Calendar,
  Package,
  ShoppingBag,
  Tag,
  Search,
  Printer,
  ExternalLink,
  Info,
} from 'lucide-react';

// Tipos

interface NFeManagerProps {
  isAuthenticated: boolean;
  blingToken?: string;
  onStatusChange?: (status: string) => void;
  orders?: OrderLocal[];
  orderItems?: OrderItemLocal[];
  origemConfig?: OrigemConfig;
  onSaveOrigemConfig?: (config: OrigemConfig) => void;
  addToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

interface OrderLocal {
  id: string;
  orderId?: string;
  order_id?: string;
  tracking?: string;
  sku?: string;
  canal?: string;
  data?: string;
  status?: string;
  customer_name?: string;
  customer_cpf_cnpj?: string;
  price_gross?: number;
  price_total?: number;
  price_net?: number;
  qty_final?: number;
}

interface OrderItemLocal {
  id: string;
  order_id: string;
  sku: string;
  descricao?: string;
  quantidade?: number;
  valor_unitario?: number;
  subtotal?: number;
  canal?: string;
  status?: string;
}

export interface OrigemConfig {
  fontes: ('ML' | 'SHOPEE' | 'BLING' | 'SITE' | 'ALL')[];
  autoSync: boolean;
}

const DEFAULT_ORIGEM: OrigemConfig = {
  fontes: ['ML', 'SHOPEE', 'SITE'],
  autoSync: true,
};

const today = () => new Date().toISOString().split('T')[0];
const thirtyDaysAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
};

const platformLabel: Record<string, string> = {
  ML: 'Mercado Livre',
  SHOPEE: 'Shopee',
  SITE: 'Site Proprio',
  BLING: 'Bling',
  ALL: 'Todos',
};

const platformColor: Record<string, string> = {
  ML: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  SHOPEE: 'bg-orange-100 text-orange-800 border-orange-200',
  SITE: 'bg-blue-100 text-blue-800 border-blue-200',
  BLING: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const statusColor: Record<string, string> = {
  BIPADO: 'bg-green-100 text-green-800',
  NORMAL: 'bg-blue-100 text-blue-800',
  ERRO: 'bg-red-100 text-red-800',
  DEVOLVIDO: 'bg-gray-200 text-gray-700',
  SOLUCIONADO: 'bg-purple-100 text-purple-800',
};

export const NFeManager: React.FC<NFeManagerProps> = ({
  isAuthenticated,
  blingToken,
  onStatusChange,
  orders = [],
  orderItems = [],
  origemConfig,
  onSaveOrigemConfig,
  addToast,
}) => {
  const [activeTab, setActiveTab] = useState<'pedidos' | 'config' | 'emissao'>('pedidos');
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo());
  const [dateTo, setDateTo] = useState(today());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [showProcessed, setShowProcessed] = useState(true);
  const [config, setConfig] = useState<OrigemConfig>(origemConfig || DEFAULT_ORIGEM);
  const [loading, setLoading] = useState(false);

  const itemsByOrderId = useMemo(() => {
    const map = new Map<string, OrderItemLocal[]>();
    for (const item of orderItems) {
      const key = item.order_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [orderItems]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (filterPlatform !== 'ALL') {
      result = result.filter(o => (o.canal || '').toUpperCase() === filterPlatform);
    }
    if (config.fontes.length > 0 && !config.fontes.includes('ALL')) {
      result = result.filter(o => {
        const canal = (o.canal || '').toUpperCase();
        return config.fontes.includes(canal as any) || !canal;
      });
    }
    if (filterStatus !== 'ALL') {
      result = result.filter(o => (o.status || '') === filterStatus);
    }
    if (dateFrom) {
      result = result.filter(o => {
        const d = o.data || '';
        return d >= dateFrom;
      });
    }
    if (dateTo) {
      result = result.filter(o => {
        const d = o.data || '';
        return d <= dateTo;
      });
    }
    if (!showProcessed) {
      result = result.filter(o => (o.status || '').toUpperCase() !== 'BIPADO');
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter(o =>
        (o.orderId || o.order_id || '').toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.sku || '').toLowerCase().includes(q) ||
        (o.tracking || '').toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [orders, filterPlatform, filterStatus, dateFrom, dateTo, showProcessed, searchTerm, config.fontes]);

  const platformStats = useMemo(() => {
    const stats: Record<string, { total: number; bipados: number; pendentes: number; valor: number }> = {};
    for (const o of filteredOrders) {
      const canal = (o.canal || 'OUTRO').toUpperCase();
      if (!stats[canal]) stats[canal] = { total: 0, bipados: 0, pendentes: 0, valor: 0 };
      stats[canal].total++;
      if ((o.status || '').toUpperCase() === 'BIPADO') stats[canal].bipados++;
      else stats[canal].pendentes++;
      stats[canal].valor += (o.price_net || o.price_total || 0);
    }
    return stats;
  }, [filteredOrders]);

  const handleSaveConfig = () => {
    if (onSaveOrigemConfig) {
      onSaveOrigemConfig(config);
    }
    if (addToast) addToast('Configuracao de origem salva!', 'success');
  };

  const handleToggleFonte = (fonte: 'ML' | 'SHOPEE' | 'BLING' | 'SITE' | 'ALL') => {
    setConfig(prev => {
      if (fonte === 'ALL') return { ...prev, fontes: ['ALL'] };
      const fontes = prev.fontes.filter(f => f !== 'ALL');
      if (fontes.includes(fonte)) {
        return { ...prev, fontes: fontes.filter(f => f !== fonte) };
      }
      return { ...prev, fontes: [...fontes, fonte] };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 uppercase">Pedidos & Documentos Fiscais</h2>
              <p className="text-sm text-gray-500">Visualize pedidos, dados dos produtos, etiquetas de envio e DANFE simplificada</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-bold text-xs border border-blue-200">
              {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b overflow-x-auto bg-white rounded-xl shadow-sm">
        {[
          { id: 'pedidos', label: 'Pedidos' },
          { id: 'config', label: 'Configuracao' },
          { id: 'emissao', label: 'Emissao NFe' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`+"flex items-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all "+`+(
              activeTab === tab.id
                ? 'border-purple-600 text-purple-700 bg-purple-50/50'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Pedidos */}
      {activeTab === 'pedidos' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">De</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-sm outline-none focus:border-purple-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Ate</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-sm outline-none focus:border-purple-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Plataforma</label>
                <select
                  value={filterPlatform}
                  onChange={e => setFilterPlatform(e.target.value)}
                  className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-sm outline-none focus:border-purple-400"
                >
                  <option value="ALL">Todas</option>
                  <option value="ML">Mercado Livre</option>
                  <option value="SHOPEE">Shopee</option>
                  <option value="SITE">Site</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 block">Status</label>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="w-full p-2.5 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-sm outline-none focus:border-purple-400"
                >
                  <option value="ALL">Todos</option>
                  <option value="NORMAL">Pendente</option>
                  <option value="BIPADO">Bipado</option>
                  <option value="ERRO">Erro</option>
                  <option value="DEVOLVIDO">Devolvido</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-600 p-2.5">
                  <input
                    type="checkbox"
                    checked={showProcessed}
                    onChange={e => setShowProcessed(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  Mostrar processados
                </label>
              </div>
              <div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full pl-9 pr-3 p-2.5 border-2 border-slate-100 rounded-xl bg-slate-50 font-bold text-sm outline-none focus:border-purple-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {Object.keys(platformStats).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(platformStats).map(([canal, stats]) => (
                <div
                  key={canal}
                  className={`+"rounded-xl p-4 border "+`+(platformColor[canal] || 'bg-gray-50 text-gray-800 border-gray-200')}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black uppercase">{platformLabel[canal] || canal}</span>
                    <span className="text-lg font-black">{stats.total}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-bold">
                    <span className="text-green-600">{stats.bipados} ok</span>
                    <span className="text-orange-600">{stats.pendentes} pend</span>
                    <span>R$ {stats.valor.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="p-3 text-left text-[10px] font-black text-gray-500 uppercase">Pedido</th>
                    <th className="p-3 text-left text-[10px] font-black text-gray-500 uppercase">Data</th>
                    <th className="p-3 text-left text-[10px] font-black text-gray-500 uppercase">Canal</th>
                    <th className="p-3 text-left text-[10px] font-black text-gray-500 uppercase">Cliente</th>
                    <th className="p-3 text-left text-[10px] font-black text-gray-500 uppercase">Produto / SKU</th>
                    <th className="p-3 text-left text-[10px] font-black text-gray-500 uppercase">Qtd</th>
                    <th className="p-3 text-left text-[10px] font-black text-gray-500 uppercase">Valor</th>
                    <th className="p-3 text-left text-[10px] font-black text-gray-500 uppercase">Status</th>
                    <th className="p-3 text-left text-[10px] font-black text-gray-500 uppercase">Rastreio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-gray-400">
                        <Package size={32} className="mx-auto mb-2 opacity-40" />
                        <p className="font-bold">Nenhum pedido encontrado</p>
                        <p className="text-xs mt-1">Ajuste os filtros ou importe pedidos pelo Importador/Integracoes</p>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.slice(0, 200).map(order => {
                      const orderId = order.orderId || order.order_id || order.id;
                      const items = itemsByOrderId.get(orderId) || [];
                      const canal = (order.canal || '').toUpperCase();
                      const st = (order.status || 'NORMAL').toUpperCase();

                      return (
                        <tr key={order.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="p-3">
                            <span className="font-mono font-bold text-gray-900 text-xs">{orderId}</span>
                          </td>
                          <td className="p-3 text-xs text-gray-600 whitespace-nowrap">
                            {order.data ? new Date(order.data + 'T00:00:00').toLocaleDateString('pt-BR') : '\u2014'}
                          </td>
                          <td className="p-3">
                            <span className={`+"inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase border "+`+(platformColor[canal] || 'bg-gray-100 text-gray-600 border-gray-200')}>
                              {platformLabel[canal] || canal || '\u2014'}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-gray-700 max-w-[150px] truncate" title={order.customer_name || ''}>
                            {order.customer_name || '\u2014'}
                          </td>
                          <td className="p-3">
                            {items.length > 0 ? (
                              <div className="space-y-0.5">
                                {items.slice(0, 3).map((item, i) => (
                                  <div key={i} className="text-[10px]">
                                    <span className="font-mono font-bold text-purple-700">{item.sku}</span>
                                    {item.descricao && <span className="text-gray-500 ml-1 truncate max-w-[120px] inline-block align-bottom">{item.descricao}</span>}
                                    <span className="text-gray-400 ml-1">x{item.quantidade || 1}</span>
                                  </div>
                                ))}
                                {items.length > 3 && <span className="text-[9px] text-gray-400">+{items.length - 3} itens</span>}
                              </div>
                            ) : (
                              <span className="font-mono text-xs text-gray-500">{order.sku || '\u2014'}</span>
                            )}
                          </td>
                          <td className="p-3 text-xs font-bold text-gray-700 text-center">{order.qty_final || 1}</td>
                          <td className="p-3 text-xs font-bold text-green-700">
                            {(order.price_net || order.price_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className="p-3">
                            <span className={`+"inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase "+`+(statusColor[st] || 'bg-gray-100 text-gray-700')}>
                              {st}
                            </span>
                          </td>
                          <td className="p-3 text-[10px] font-mono text-gray-500 max-w-[120px] truncate" title={order.tracking || ''}>
                            {order.tracking || '\u2014'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {filteredOrders.length > 200 && (
              <div className="p-3 text-center text-xs text-gray-400 border-t bg-gray-50">
                Mostrando 200 de {filteredOrders.length} pedidos. Use os filtros para refinar.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Configuracao */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-4">Origem dos Pedidos</h3>
            <p className="text-sm text-gray-500 mb-4">Selecione de onde os pedidos devem ser importados automaticamente.</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {(['ML', 'SHOPEE', 'SITE', 'ALL'] as const).map(fonte => {
                const isActive = config.fontes.includes(fonte) || config.fontes.includes('ALL');
                return (
                  <button
                    key={fonte}
                    onClick={() => handleToggleFonte(fonte)}
                    className={`+"p-4 rounded-xl border-2 text-center transition-all "+`+(
                      isActive
                        ? 'border-purple-500 bg-purple-50 text-purple-800'
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    )}
                  >
                    <span className="text-lg block mb-1">
                      {fonte === 'ML' ? '\uD83D\uDFE1' : fonte === 'SHOPEE' ? '\uD83D\uDFE0' : fonte === 'SITE' ? '\uD83D\uDD35' : '\uD83C\uDF10'}
                    </span>
                    <span className="text-xs font-black uppercase">{platformLabel[fonte] || fonte}</span>
                    {isActive && <CheckCircle size={14} className="text-purple-600 mx-auto mt-1" />}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <p className="font-bold text-sm text-gray-800">Sincronizacao Automatica</p>
                <p className="text-xs text-gray-500">Buscar pedidos automaticamente ao abrir a pagina</p>
              </div>
              <button
                onClick={() => setConfig(prev => ({ ...prev, autoSync: !prev.autoSync }))}
                className={`+"w-12 h-6 rounded-full transition-colors relative "+`+(
                  config.autoSync ? 'bg-purple-500' : 'bg-gray-300'
                )}
              >
                <span className={`+"absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all "+`+(
                  config.autoSync ? 'left-6' : 'left-0.5'
                )} />
              </button>
            </div>

            <button
              onClick={handleSaveConfig}
              className="w-full mt-4 px-6 py-3 bg-purple-600 text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-purple-700 transition-all"
            >
              Salvar Configuracao
            </button>
          </div>

          <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl">
            <div className="flex items-start gap-3">
              <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-bold mb-1">Como funciona a importacao de pedidos?</p>
                <ul className="space-y-1 text-xs">
                  <li>Mercado Livre / Shopee: Configure na aba Integracoes do menu lateral</li>
                  <li>Bling: Configure na aba de Sincronizacao desta pagina</li>
                  <li>Planilha: Use a aba Importacao para CSV/XLS</li>
                  <li>Os pedidos importados aparecem aqui automaticamente com dados do produto</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Emissao NFe */}
      {activeTab === 'emissao' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle size={24} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-black text-amber-900 text-lg">Emissao de NFe - Em Desenvolvimento</h3>
                <p className="text-sm text-amber-800 mt-2">
                  A emissao direta de Nota Fiscal Eletronica requer um servidor backend com certificado digital A1
                  e conexao com a SEFAZ. Esta funcionalidade esta reservada para implementacao futura.
                </p>
                <div className="mt-4 space-y-2 text-xs text-amber-700">
                  <p className="font-bold">Alternativas disponiveis agora:</p>
                  <ul className="space-y-1 ml-2">
                    <li>Use o Bling para emitir NFe diretamente na plataforma</li>
                    <li>Gere etiquetas de envio pelo Bling (aba Emissao/ZPL)</li>
                    <li>A DANFE simplificada e gerada automaticamente nas etiquetas</li>
                    <li>Pedidos importados ja recebem dados dos produtos vinculados</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-200">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <ExternalLink size={18} className="text-blue-600" />
              Links Uteis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <a
                href="https://www.bling.com.br/notas-fiscais"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all"
              >
                <FileText size={20} className="text-emerald-600" />
                <div>
                  <p className="font-bold text-sm text-emerald-900">Emitir NFe via Bling</p>
                  <p className="text-xs text-emerald-700">Acesse o painel do Bling para emitir notas</p>
                </div>
              </a>
              <a
                href="https://www.nfe.fazenda.gov.br/portal/principal.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all"
              >
                <FileText size={20} className="text-blue-600" />
                <div>
                  <p className="font-bold text-sm text-blue-900">Portal NFe SEFAZ</p>
                  <p className="text-xs text-blue-700">Consultar notas no portal da Fazenda</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
