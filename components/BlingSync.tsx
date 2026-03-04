import React, { useState, useEffect } from 'react';
import {
  syncBlingOrders,
  syncBlingInvoices,
  syncBlingProducts,
  syncBlingStock,
  getSyncStatus,
  searchAndFilter,
  bulkChangeStatus,
  bulkAssignLote,
  bulkDelete,
  exportToCsv,
  getLotes
} from '../lib/blingApi';
import { AdvancedFilterPanel } from './AdvancedFilterPanel';
import { BulkOperationPanel } from './BulkOperationPanel';
import { AdvancedFilter } from '../types';
import {
  Download,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader,
  RefreshCw,
  Filter,
} from 'lucide-react';

interface SyncLog {
  id: string;
  type: 'PEDIDOS' | 'NOTAS_FISCAIS' | 'PRODUTOS';
  status: 'SUCCESS' | 'ERROR' | 'SYNCING' | 'PENDING' | 'PARTIAL';
  startedAt: number;
  completedAt?: number;
  recordsProcessed: number;
  recordsFailed: number;
  errorMessage?: string;
  details?: {
    newRecords?: number;
    updatedRecords?: number;
    skippedRecords?: number;
  };
}

interface BlingSyncProps {
  token: string;
  isAuthenticated: boolean;
  onSyncStateChange?: (isSyncing: boolean) => void;
  onOrdersSynced?: (orders: any[]) => Promise<void> | void;
  onInvoicesSynced?: (invoices: any[]) => void;
  onProductsSynced?: (products: any[]) => void;
  onStockSynced?: (stockItems: any[]) => void;
}

export const BlingSync: React.FC<BlingSyncProps> = ({
  token,
  isAuthenticated,
  onSyncStateChange,
  onOrdersSynced,
  onInvoicesSynced,
  onProductsSynced,
  onStockSynced,
}) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingType, setSyncingType] = useState<'PEDIDOS' | 'NOTAS_FISCAIS' | 'PRODUTOS' | null>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingSyncType, setPendingSyncType] = useState<'PEDIDOS' | 'NOTAS_FISCAIS' | 'PRODUTOS' | null>(null);
  
  // PHASE 2: Advanced Filtering
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [filterResults, setFilterResults] = useState<number>(0);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set<string>());
  const [currentDataType, setCurrentDataType] = useState<'orders' | 'invoices' | 'products'>('orders');
  const [syncParams, setSyncParams] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    orderStatus: 'TODOS' as 'EM ABERTO' | 'EM ANDAMENTO' | 'ATENDIDO' | 'TODOS',
    orderChannel: 'ALL' as 'ML' | 'SHOPEE' | 'SITE' | 'ALL',
    invoiceStatus: 'TODOS' as 'PENDENTES' | 'EMITIDAS' | 'TODOS'
  });

  useEffect(() => {
    loadSyncStatus();
    const interval = setInterval(loadSyncStatus, 10000); // Atualiza a cada 10s
    return () => clearInterval(interval);
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await getSyncStatus();
      setSyncStatus(status);
    } catch (err: any) {
      console.error('Erro ao carregar status:', err);
    }
  };

  const handleFilterChange = async (filters: AdvancedFilter) => {
    try {
      console.log('Aplicando filtros:', filters);
      const result = await searchAndFilter(currentDataType, filters);
      setFilteredData(result.items || []);
      setFilterResults(result.displayCount || 0);
    } catch (err: any) {
      setError(err.message || 'Erro ao filtrar dados');
    }
  };

  const handleClearFilters = () => {
    setFilteredData([]);
    setFilterResults(0);
    setSelectedItems(new Set<string>());
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set<string>(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const selectAllItems = () => {
    const allIds = new Set<string>(filteredData.map(item => String(item.id)));
    setSelectedItems(allIds);
  };

  const deselectAllItems = () => {
    setSelectedItems(new Set<string>());
  };

  const handleBulkChangeStatus = async (status: string) => {
    const itemIds: string[] = [...selectedItems];
    if (itemIds.length === 0) return;
    
    try {
      await bulkChangeStatus(itemIds, status);
      setSelectedItems(new Set<string>());
      await handleFilterChange({});
    } catch (err: any) {
      throw err;
    }
  };

  const handleBulkAssignLote = async (lote: string) => {
    const itemIds: string[] = [...selectedItems];
    if (itemIds.length === 0) return;
    
    try {
      await bulkAssignLote(itemIds, `lote-${Date.now()}`, lote);
      setSelectedItems(new Set<string>());
      await handleFilterChange({});
    } catch (err: any) {
      throw err;
    }
  };

  const handleBulkDelete = async () => {
    const itemIds: string[] = [...selectedItems];
    if (itemIds.length === 0) return;
    
    try {
      await bulkDelete(itemIds);
      setSelectedItems(new Set<string>());
      await handleFilterChange({});
    } catch (err: any) {
      throw err;
    }
  };

  const handleBulkExport = async () => {
    try {
      const itemIds: string[] | undefined = selectedItems.size > 0 ? [...selectedItems] : undefined;
      const blob = await exportToCsv(currentDataType, itemIds);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export-${currentDataType}-${Date.now()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Erro ao exportar dados');
    }
  };

  const confirmSync = (type: 'PEDIDOS' | 'NOTAS_FISCAIS' | 'PRODUTOS') => {
    setPendingSyncType(type);
    setShowConfirm(true);
  };

  const handleSyncAll = async () => {
    if (!token || isSyncing) return;
    setIsSyncing(true);
    onSyncStateChange?.(true);
    const types: Array<'PEDIDOS' | 'NOTAS_FISCAIS' | 'PRODUTOS'> = ['PEDIDOS', 'NOTAS_FISCAIS', 'PRODUTOS'];
    for (const type of types) {
      setSyncingType(type);
      try {
        let result: any;
        if (type === 'PEDIDOS') {
          result = await syncBlingOrders(token, syncParams.startDate, syncParams.endDate, syncParams.orderStatus, syncParams.orderChannel);
          if (result.success && onOrdersSynced) await onOrdersSynced(result.orders || []);
        } else if (type === 'NOTAS_FISCAIS') {
          result = await syncBlingInvoices(token, syncParams.startDate, syncParams.endDate, syncParams.invoiceStatus);
          if (result.success && onInvoicesSynced) onInvoicesSynced(result.invoices || []);
        } else {
          result = await syncBlingProducts(token);
          if (result.success && onProductsSynced) onProductsSynced(result.products || []);
        }
      } catch (err: any) {
        setError(`Erro ao sincronizar ${type}: ${err.message}`);
      }
    }
    // Also sync stock
    try {
      setSyncingType('PRODUTOS' as any);
      const stockResult = await syncBlingStock(token);
      if (stockResult.success && onStockSynced) onStockSynced(stockResult.stockItems || []);
    } catch (err: any) {
      setError(`Erro ao sincronizar estoque: ${err.message}`);
    }
    await loadSyncStatus();
    setIsSyncing(false);
    setSyncingType(null);
    onSyncStateChange?.(false);
  };

  const executeSync = async () => {
    if (!pendingSyncType || !token) return;

    setShowConfirm(false);
    setIsSyncing(true);
    setSyncingType(pendingSyncType);
    setError(null);
    onSyncStateChange?.(true);

    try {
      const dateRangeStart = syncParams.startDate;
      const dateRangeEnd = syncParams.endDate;

      let result;

      switch (pendingSyncType) {
        case 'PEDIDOS':
          result = await syncBlingOrders(token, dateRangeStart, dateRangeEnd, syncParams.orderStatus, syncParams.orderChannel);
          break;
        case 'NOTAS_FISCAIS':
          result = await syncBlingInvoices(token, dateRangeStart, dateRangeEnd, syncParams.invoiceStatus);
          break;
        case 'PRODUTOS':
          result = await syncBlingProducts(token);
          break;
      }

      if (result.success) {
        console.log(`✅ Sincronização de ${pendingSyncType} concluída:`, result);
        if (pendingSyncType === 'PEDIDOS' && onOrdersSynced) await onOrdersSynced(result.orders || []);
        if (pendingSyncType === 'NOTAS_FISCAIS' && onInvoicesSynced) onInvoicesSynced(result.invoices || []);
        if (pendingSyncType === 'PRODUTOS' && onProductsSynced) onProductsSynced(result.products || []);
        await loadSyncStatus();
      } else {
        setError(result.errorMessage || 'Erro na sincronização');
      }
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido na sincronização');
    } finally {
      setIsSyncing(false);
      setSyncingType(null);
      onSyncStateChange?.(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  const lastSync = syncStatus?.lastSync;
  const stats = syncStatus?.stats || {};

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'text-green-600';
      case 'ERROR':
        return 'text-red-600';
      case 'SYNCING':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle className="w-5 h-5" />;
      case 'ERROR':
        return <AlertCircle className="w-5 h-5" />;
      case 'SYNCING':
        return <Loader className="w-5 h-5 animate-spin" />;
      default:
        return <Clock className="w-5 h-5" />;
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('pt-BR');
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'PEDIDOS':
        return '📋 Pedidos de Vendas';
      case 'NOTAS_FISCAIS':
        return '📄 Notas Fiscais';
      case 'PRODUTOS':
        return '📦 Produtos';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">
              Sincronização de Dados
            </h2>
          </div>
          {lastSync && (
            <div className="text-right">
              <p className="text-xs text-gray-500">Última atualização</p>
              <p className="text-sm font-mono text-gray-700">
                {formatTime(lastSync.completedAt || lastSync.startedAt)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sync Buttons */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 space-y-4">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Filter className="w-4 h-4" /> Filtros de Sincronização Manual/Retroativa
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data início</label>
            <input
              type="date"
              value={syncParams.startDate}
              onChange={(e) => setSyncParams(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Data fim</label>
            <input
              type="date"
              value={syncParams.endDate}
              onChange={(e) => setSyncParams(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Status pedidos</label>
            <select
              value={syncParams.orderStatus}
              onChange={(e) => setSyncParams(prev => ({ ...prev, orderStatus: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="TODOS">Todos</option>
              <option value="EM ABERTO">Em aberto</option>
              <option value="EM ANDAMENTO">Em andamento</option>
              <option value="ATENDIDO">Atendido</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Canal pedidos</label>
            <select
              value={syncParams.orderChannel}
              onChange={(e) => setSyncParams(prev => ({ ...prev, orderChannel: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="ALL">Todos</option>
              <option value="ML">Mercado Livre</option>
              <option value="SHOPEE">Shopee</option>
              <option value="SITE">Site</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Status notas</label>
            <select
              value={syncParams.invoiceStatus}
              onChange={(e) => setSyncParams(prev => ({ ...prev, invoiceStatus: e.target.value as any }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="TODOS">Todos</option>
              <option value="PENDENTES">Pendentes</option>
              <option value="EMITIDAS">Emitidas</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            id: 'PEDIDOS' as const,
            label: '📋 Pedidos de Vendas',
            desc: 'Sincronizar últimos 30 dias',
            color: 'blue',
          },
          {
            id: 'NOTAS_FISCAIS' as const,
            label: '📄 Notas Fiscais',
            desc: 'Sincronizar últimos 30 dias',
            color: 'purple',
          },
          {
            id: 'PRODUTOS' as const,
            label: '📦 Produtos',
            desc: 'Sincronizar catálogo completo',
            color: 'green',
          },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => confirmSync(item.id)}
            disabled={isSyncing}
            className={`
              relative p-4 rounded-lg border-2 transition-all
              ${isSyncing && syncingType === item.id ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 hover:border-' + item.color + '-400'}
              ${!isSyncing ? 'hover:shadow-md' : 'opacity-50 cursor-not-allowed'}
            `}
          >
            <div className="flex items-start justify-between">
              <div className="text-left">
                <p className="font-semibold text-gray-800">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
              {isSyncing && syncingType === item.id && (
                <Loader className="w-5 h-5 text-yellow-600 animate-spin" />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Sincronizar Tudo */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <button
          onClick={handleSyncAll}
          disabled={isSyncing || !token}
          className="w-full flex items-center justify-center gap-3 py-4 bg-slate-800 text-white font-black uppercase text-sm tracking-widest rounded-xl hover:bg-slate-900 disabled:opacity-50 transition-all shadow-lg active:scale-95"
        >
          {isSyncing ? (
            <><Loader className="w-5 h-5 animate-spin" /> Sincronizando {syncingType?.toLowerCase().replace('_', ' ')}...</>
          ) : (
            <><RefreshCw className="w-5 h-5" /> Sincronizar Tudo de uma vez</>
          )}
        </button>
        <p className="text-xs text-center text-gray-400 mt-2">Sincroniza pedidos, notas fiscais e produtos sequencialmente</p>
      </div>

      {/* Statistics */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-4">📊 Estatísticas</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg text-center">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Total Sincs</p>
            <p className="text-2xl font-bold text-gray-800">{stats.totalSyncs || 0}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <p className="text-xs text-blue-600 uppercase tracking-wider">Pedidos</p>
            <p className="text-2xl font-bold text-blue-800">{stats.ordersSyncs || 0}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg text-center">
            <p className="text-xs text-purple-600 uppercase tracking-wider">NFes</p>
            <p className="text-2xl font-bold text-purple-800">{stats.invoicesSyncs || 0}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <p className="text-xs text-green-600 uppercase tracking-wider">Produtos</p>
            <p className="text-2xl font-bold text-green-800">{stats.productsSyncs || 0}</p>
          </div>
        </div>
      </div>

      {/* Recent Sync History */}
      {syncStatus?.recentSyncs && syncStatus.recentSyncs.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-4">📜 Histórico Recente</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {syncStatus.recentSyncs.map((log: SyncLog) => (
              <div
                key={log.id}
                className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className={`${getStatusColor(log.status)} flex-shrink-0`}>
                  {getStatusIcon(log.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-800">
                      {getTypeLabel(log.type)}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded font-medium ${
                      log.status === 'SUCCESS'
                        ? 'bg-green-100 text-green-800'
                        : log.status === 'ERROR'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {formatTime(log.startedAt)}
                  </p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-700">
                    <span>✓ {log.details?.newRecords || log.recordsProcessed} novos</span>
                    {log.recordsFailed > 0 && (
                      <span className="text-red-600">✗ {log.recordsFailed} erros</span>
                    )}
                  </div>
                  {log.errorMessage && (
                    <p className="text-xs text-red-600 mt-1">{log.errorMessage}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PHASE 2: Advanced Filtering & Bulk Operations */}
      {filteredData.length > 0 && (
        <div className="space-y-6">
          {/* Bulk Operations Panel */}
          <BulkOperationPanel
            selectedCount={selectedItems.size}
            onSelectAll={selectAllItems}
            onDeselectAll={deselectAllItems}
            onBulkChangeStatus={handleBulkChangeStatus}
            onBulkAssignLote={handleBulkAssignLote}
            onBulkDelete={handleBulkDelete}
            onBulkExport={handleBulkExport}
            isProcessing={isSyncing}
          />

          {/* Filtered Data Table */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-4">
              📋 Resultados Filtrados ({filteredData.length} itens)
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="p-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedItems.size === filteredData.length && filteredData.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectAllItems();
                          } else {
                            deselectAllItems();
                          }
                        }}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="p-3 text-left font-semibold text-gray-700">ID</th>
                    <th className="p-3 text-left font-semibold text-gray-700">Nome</th>
                    <th className="p-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="p-3 text-left font-semibold text-gray-700">Lote</th>
                    <th className="p-3 text-left font-semibold text-gray-700">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredData.slice(0, 10).map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={() => toggleItemSelection(item.id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="p-3 font-mono text-xs text-gray-600">{item.id?.substring(0, 8)}</td>
                      <td className="p-3 text-gray-800">{item.customer_name || item.descricao || item.nomeCliente || '-'}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-1 rounded font-semibold ${
                          item.status === 'NOVO' ? 'bg-blue-100 text-blue-800' :
                          item.status === 'EM_PROCESSAMENTO' ? 'bg-yellow-100 text-yellow-800' :
                          item.status === 'COMPLETO' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {item.status || '-'}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">{item.lote || '-'}</td>
                      <td className="p-3 text-xs text-gray-600">{item.data || item.dataEmissao || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredData.length > 10 && (
                <p className="text-xs text-gray-500 mt-2 p-3">... e {filteredData.length - 10} itens mais</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200 flex items-center gap-3">
        <label className="text-xs font-semibold text-gray-600">Base para filtros:</label>
        <select
          value={currentDataType}
          onChange={(e) => {
            setCurrentDataType(e.target.value as 'orders' | 'invoices' | 'products');
            setSelectedItems(new Set<string>());
            setFilteredData([]);
            setFilterResults(0);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value="orders">Pedidos</option>
          <option value="invoices">Notas Fiscais</option>
          <option value="products">Produtos</option>
        </select>
      </div>

      <AdvancedFilterPanel
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        isOpen={filterPanelOpen}
        onToggle={() => setFilterPanelOpen(!filterPanelOpen)}
        resultCount={filterResults}
      />

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
              <h3 className="font-bold text-gray-800">Confirmar Sincronização?</h3>
            </div>
            <p className="text-gray-700 mb-6">
              Você está prestes a sincronizar <strong>{getTypeLabel(pendingSyncType || '')}</strong> com o Bling.
              Esta ação pode levar alguns segundos.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={executeSync}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Sincronizar Agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};