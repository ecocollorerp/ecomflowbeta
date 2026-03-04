import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Loader, Copy, Download, Tag, Trash2, Link as LinkIcon } from 'lucide-react';

interface BulkOperationPanelProps {
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkChangeStatus: (status: string) => Promise<void>;
  onBulkAssignLote: (lote: string) => Promise<void>;
  onBulkDelete: () => Promise<void>;
  onBulkExport: () => void;
  isProcessing: boolean;
}

export const BulkOperationPanel: React.FC<BulkOperationPanelProps> = ({
  selectedCount,
  onSelectAll,
  onDeselectAll,
  onBulkChangeStatus,
  onBulkAssignLote,
  onBulkDelete,
  onBulkExport,
  isProcessing,
}) => {
  const [showLoteModal, setShowLoteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [loteValue, setLoteValue] = useState('');
  const [statusValue, setStatusValue] = useState('NOVO');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleStatusChange = async () => {
    if (!statusValue.trim()) {
      setError('Selecione um status');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await onBulkChangeStatus(statusValue);
      setSuccess(`✅ Status atualizado para ${selectedCount} itens`);
      setShowStatusModal(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao mudar status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignLote = async () => {
    if (!loteValue.trim()) {
      setError('Digite o nome do lote');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await onBulkAssignLote(loteValue);
      setSuccess(`✅ ${selectedCount} itens atribuídos ao lote ${loteValue}`);
      setShowLoteModal(false);
      setLoteValue('');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao atribuir lote');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`⚠️ Tem certeza que quer deletar ${selectedCount} itens? Esta ação é irreversível!`)) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await onBulkDelete();
      setSuccess(`✅ ${selectedCount} itens deletados`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao deletar itens');
    } finally {
      setIsLoading(false);
    }
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3 animate-in slide-in-from-top">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-800 font-semibold text-sm">{success}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 font-semibold text-sm">{error}</p>
        </div>
      )}

      {/* Main Panel */}
      <div className="bg-white rounded-lg shadow-sm p-6 border-2 border-blue-200">
        <div className="mb-6">
          <p className="text-lg font-bold text-gray-800 mb-2">
            📋 {selectedCount} item(ns) selecionado(s)
          </p>
          <p className="text-sm text-gray-600">Escolha uma ação em lote para aplicar a todos selecionados</p>
        </div>

        {/* Action Buttons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setShowStatusModal(true)}
            disabled={isLoading || isProcessing}
            className="flex items-center justify-center gap-2 p-4 bg-blue-100 text-blue-800 font-bold rounded-lg hover:bg-blue-200 transition disabled:opacity-50"
          >
            <Tag className="w-5 h-5" />
            Mudar Status
          </button>

          <button
            onClick={() => setShowLoteModal(true)}
            disabled={isLoading || isProcessing}
            className="flex items-center justify-center gap-2 p-4 bg-purple-100 text-purple-800 font-bold rounded-lg hover:bg-purple-200 transition disabled:opacity-50"
          >
            <LinkIcon className="w-5 h-5" />
            Atribuir Lote
          </button>

          <button
            onClick={onBulkExport}
            disabled={isLoading || isProcessing}
            className="flex items-center justify-center gap-2 p-4 bg-green-100 text-green-800 font-bold rounded-lg hover:bg-green-200 transition disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            Exportar
          </button>

          <button
            onClick={handleDelete}
            disabled={isLoading || isProcessing}
            className="flex items-center justify-center gap-2 p-4 bg-red-100 text-red-800 font-bold rounded-lg hover:bg-red-200 transition disabled:opacity-50"
          >
            <Trash2 className="w-5 h-5" />
            Deletar
          </button>
        </div>

        {/* Selection Controls */}
        <div className="flex gap-2 pt-4 border-t border-gray-200">
          <button
            onClick={onSelectAll}
            className="flex-1 px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition"
          >
            ✓ Selecionar Todos
          </button>
          <button
            onClick={onDeselectAll}
            className="flex-1 px-4 py-2 text-sm font-semibold bg-gray-100 text-gray-800 rounded hover:bg-gray-200 transition"
          >
            ✗ Desselecionar Todos
          </button>
        </div>
      </div>

      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Mudar Status</h3>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Novo Status
              </label>
              <select
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="NOVO">🆕 Novo</option>
                <option value="EM_PROCESSAMENTO">⚙️ Em Processamento</option>
                <option value="COMPLETO">✅ Completo</option>
                <option value="ERRO">❌ Erro</option>
                <option value="AGUARDANDO">⏳ Aguardando</option>
              </select>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleStatusChange}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lote Modal */}
      {showLoteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Atribuir Lote</h3>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nome do Lote
              </label>
              <input
                type="text"
                value={loteValue}
                onChange={(e) => setLoteValue(e.target.value)}
                placeholder="Ex: Lote-001"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Todos os {selectedCount} itens serão atribuídos a este lote
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowLoteModal(false);
                  setLoteValue('');
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAssignLote}
                disabled={isLoading || !loteValue.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                Atribuir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
