import React, { useState } from 'react';
import { AdvancedFilter, BatchStatus } from '../types';
import {
  Search,
  X,
  ChevronDown,
  Filter,
  RefreshCw,
  Save,
  Calendar,
  Tag,
  Package,
} from 'lucide-react';

interface AdvancedFilterPanelProps {
  onFilterChange: (filters: AdvancedFilter) => void;
  onClearFilters: () => void;
  isOpen: boolean;
  onToggle: () => void;
  resultCount?: number;
}

export const AdvancedFilterPanel: React.FC<AdvancedFilterPanelProps> = ({
  onFilterChange,
  onClearFilters,
  isOpen,
  onToggle,
  resultCount = 0,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [lote, setLote] = useState('');
  const [skus, setSkus] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status' | 'name'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const statusOptions = [
    { value: 'NOVO', label: '🆕 Novo' },
    { value: 'EM_PROCESSAMENTO', label: '⚙️ Em Processamento' },
    { value: 'COMPLETO', label: '✅ Completo' },
    { value: 'ERRO', label: '❌ Erro' },
    { value: 'AGUARDANDO', label: '⏳ Aguardando' },
  ];

  const applyFilters = () => {
    const filters: AdvancedFilter = {
      searchTerm: searchTerm.trim() || undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      lote: lote.trim() || undefined,
      skus: skus.trim() ? skus.split(',').map(s => s.trim()) : undefined,
      sortBy,
      sortOrder,
    };

    onFilterChange(filters);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedStatuses([]);
    setDateFrom('');
    setDateTo('');
    setLote('');
    setSkus('');
    setSortBy('date');
    setSortOrder('desc');
    onClearFilters();
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition"
        >
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-800">
              🔍 Filtros Avançados
            </span>
            {resultCount > 0 && (
              <span className="text-xs font-bold text-white bg-blue-600 px-2 py-1 rounded-full">
                {resultCount}
              </span>
            )}
          </div>
          <ChevronDown
            className={`w-5 h-5 text-gray-600 transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Filter Content */}
      {isOpen && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 space-y-6 animate-in fade-in slide-in-from-top-2">
          {/* Search */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
              🔎 Buscar (Nome, SKU, Pedido)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Digite o termo de busca..."
                className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Row 1: Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                📅 Data Inicial
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                📅 Data Final
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Row 2: Lote e SKUs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                🏷️ Lote Específico
              </label>
              <input
                type="text"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                placeholder="Ex: Lote-001"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                📦 SKUs (separados por vírgula)
              </label>
              <input
                type="text"
                value={skus}
                onChange={(e) => setSkus(e.target.value)}
                placeholder="SKU1, SKU2, SKU3..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">
              ✓ Status
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => toggleStatus(option.value)}
                  className={`p-3 rounded-lg border-2 transition-all text-sm font-semibold ${
                    selectedStatuses.includes(option.value)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                📊 Ordenar Por
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="date">Data</option>
                <option value="amount">Valor</option>
                <option value="status">Status</option>
                <option value="name">Nome</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">
                🔀 Ordem
              </label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="desc">Descendente (Newer First)</option>
                <option value="asc">Ascendente (Older First)</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={applyFilters}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition active:scale-95"
            >
              <Search className="w-4 h-4" />
              Aplicar Filtros
            </button>
            <button
              onClick={resetFilters}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300 transition active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              Limpar
            </button>
          </div>

          {/* Active Filters Summary */}
          {(searchTerm ||
            selectedStatuses.length > 0 ||
            dateFrom ||
            dateTo ||
            lote ||
            skus) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">
                Filtros Ativos:
              </p>
              <div className="flex flex-wrap gap-2">
                {searchTerm && (
                  <span className="text-xs bg-blue-200 text-blue-900 px-3 py-1 rounded-full font-semibold">
                    🔍 "{searchTerm}"
                  </span>
                )}
                {selectedStatuses.map((status) => (
                  <span
                    key={status}
                    className="text-xs bg-blue-200 text-blue-900 px-3 py-1 rounded-full font-semibold"
                  >
                    ✓ {status}
                  </span>
                ))}
                {dateFrom && (
                  <span className="text-xs bg-blue-200 text-blue-900 px-3 py-1 rounded-full font-semibold">
                    📅 De {dateFrom}
                  </span>
                )}
                {dateTo && (
                  <span className="text-xs bg-blue-200 text-blue-900 px-3 py-1 rounded-full font-semibold">
                    📅 Até {dateTo}
                  </span>
                )}
                {lote && (
                  <span className="text-xs bg-blue-200 text-blue-900 px-3 py-1 rounded-full font-semibold">
                    🏷️ {lote}
                  </span>
                )}
                {skus && (
                  <span className="text-xs bg-blue-200 text-blue-900 px-3 py-1 rounded-full font-semibold">
                    📦 {skus.split(',').length} SKUs
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
