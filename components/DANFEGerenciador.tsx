// ============================================================================
// DANFEGerenciador.tsx - Gerenciador de DANFE (Documento Auxiliar NF-e)
// Exibe DANFE emitidas, pendentes e com opção de imprimir etiquetas ZPL
// ============================================================================

import React, { useState, useMemo, useCallback } from 'react';
import { FileText, Printer, Download, AlertCircle, CheckCircle, Clock, Package, Loader2, Eye, ZapOff } from 'lucide-react';
import { ListaItensPedido } from './ListaItensPedido';

interface DANFE {
  id: string;
  nfeNumero: string;
  nfeChave: string;
  pedidoId: string;
  pedidoNumero?: string;
  cliente: string;
  status: 'emitida' | 'autorizada' | 'enviada' | 'pendente' | 'erro';
  dataEmissao: number;
  dataAutorizacao?: number;
  valor: number;
  observacoes?: string;
  xmlUrl?: string;
  pdfUrl?: string;
  etiquetaZpl?: string;
  canal?: string;
  pedidoLoja?: string;
}

interface DANFEGerenciadorProps {
  danfes: DANFE[];
  isLoading?: boolean;
  onImprimir?: (danfe: DANFE) => void;
  onDownloadXML?: (danfe: DANFE) => void;
  onDownloadPDF?: (danfe: DANFE) => void;
  onGerarZPL?: (danfe: DANFE) => void;
  onReemitir?: (danfeId: string) => void;
  itensPorPedido?: { [key: string]: any[] };
  onSincronizarItens?: (pedidoId: string) => Promise<void>;
  onImprimirSimplificada?: (danfe: DANFE) => void;
  onCorrigirErro?: (danfe: DANFE) => void;
}

const statusConfig = {
  emitida: { cor: 'bg-yellow-100', textCor: 'text-yellow-800', icon: Clock, label: 'Emitida' },
  autorizada: { cor: 'bg-green-100', textCor: 'text-green-800', icon: CheckCircle, label: 'Autorizada' },
  enviada: { cor: 'bg-blue-100', textCor: 'text-blue-800', icon: Package, label: 'Enviada' },
  pendente: { cor: 'bg-orange-100', textCor: 'text-orange-800', icon: AlertCircle, label: 'Pendente' },
  erro: { cor: 'bg-red-100', textCor: 'text-red-800', icon: ZapOff, label: 'Erro' },
};

export const DANFEGerenciador: React.FC<DANFEGerenciadorProps> = ({
  danfes,
  isLoading = false,
  onImprimir,
  onDownloadXML,
  onDownloadPDF,
  onGerarZPL,
  onReemitir,
  itensPorPedido = {},
  onSincronizarItens,
  onImprimirSimplificada,
  onCorrigirErro,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchSKU, setSearchSKU] = useState(''); // Estado para filtro de SKU
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showZPLModal, setShowZPLModal] = useState(false);
  const [selectedDANFE, setSelectedDANFE] = useState<DANFE | null>(null);

  // Filtrar DANFE
  const danfesFiltrados = useMemo(() => {
    return danfes.filter(d => {
      const matchSearch =
        d.nfeNumero.includes(searchTerm) ||
        d.nfeChave.includes(searchTerm) ||
        d.cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.pedidoNumero?.includes(searchTerm);

      // Lógica de Filtro por SKU (Verifica nos itens vinculados ao pedido da NF)
      const buscarSKU = searchSKU.trim().toUpperCase();
      let matchSKU = true;

      if (buscarSKU) {
        const itensDestaNota = itensPorPedido[d.pedidoId] || [];
        // Se ainda não carregou os itens ou a nota não tem itens
        if (itensDestaNota.length === 0) {
          matchSKU = false; // Se tá buscando SKU forte e a nota não tem item, não exibe
        } else {
          matchSKU = itensDestaNota.some(item =>
            item.sku?.toUpperCase().includes(buscarSKU)
          );
        }
      }

      const matchStatus = !statusFilter || d.status === statusFilter;
      return matchSearch && matchStatus && matchSKU;
    });
  }, [danfes, searchTerm, searchSKU, statusFilter, itensPorPedido]);

  // Estatísticas
  const stats = useMemo(() => {
    return {
      total: danfes.length,
      autorizada: danfes.filter(d => d.status === 'autorizada').length,
      emitida: danfes.filter(d => d.status === 'emitida').length,
      enviada: danfes.filter(d => d.status === 'enviada').length,
      pendente: danfes.filter(d => d.status === 'pendente').length,
      erro: danfes.filter(d => d.status === 'erro').length,
    };
  }, [danfes]);

  const handleGerarZPL = useCallback((danfe: DANFE) => {
    setSelectedDANFE(danfe);
    setShowZPLModal(true);
    onGerarZPL?.(danfe);
  }, [onGerarZPL]);

  const formatarData = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatarValor = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(valor);
  };

  return (
    <div className="space-y-6 p-6 bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg">
            <FileText className="text-blue-600" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gestão de DANFE</h2>
            <p className="text-sm text-gray-600">Documentos Auxiliares de Nota Fiscal Eletrônica</p>
          </div>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', valor: stats.total, cor: 'bg-gray-100 text-gray-800' },
          { label: 'Autorizada', valor: stats.autorizada, cor: 'bg-green-100 text-green-800' },
          { label: 'Emitida', valor: stats.emitida, cor: 'bg-yellow-100 text-yellow-800' },
          { label: 'Enviada', valor: stats.enviada, cor: 'bg-blue-100 text-blue-800' },
          { label: 'Pendente', valor: stats.pendente, cor: 'bg-orange-100 text-orange-800' },
          { label: 'Erro', valor: stats.erro, cor: 'bg-red-100 text-red-800' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.cor} p-3 rounded-lg text-center`}>
            <p className="text-xs font-bold uppercase">{stat.label}</p>
            <p className="text-2xl font-black">{stat.valor}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por NF-e, chave, cliente ou pedido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500 font-bold"
          />
        </div>

        {/* Filtro específico por SKU Principal */}
        <div className="flex-1 max-w-sm relative">
          <Package className="absolute left-3 top-3 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Filtrar por SKU Principal..."
            value={searchSKU}
            onChange={(e) => setSearchSKU(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border-2 border-purple-200 bg-purple-50 text-purple-900 placeholder-purple-400 rounded-lg outline-none focus:border-purple-500 focus:bg-white transition-all font-bold uppercase"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500 font-bold"
        >
          <option value="">Todos os Status</option>
          {Object.entries(statusConfig).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
      </div>

      {/* Lista de DANFE */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-blue-600" size={32} />
          <span className="ml-3 font-bold text-gray-600">Carregando DANFE...</span>
        </div>
      ) : danfesFiltrados.length === 0 ? (
        <div className="py-12 text-center">
          <FileText className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-600 font-bold">Nenhuma DANFE encontrada</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {danfesFiltrados.map((danfe) => {
            const config = statusConfig[danfe.status];
            const StatusIcon = config.icon;
            const isExpanded = expandedId === danfe.id;

            return (
              <div key={danfe.id} className="border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-300 transition-all">
                {/* Linha Principal */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : danfe.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 text-left">
                    <StatusIcon className={`${config.textCor} flex-shrink-0`} size={20} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900">NF-e #{danfe.nfeNumero}</div>
                      <div className="text-sm text-gray-600">Chave: {danfe.nfeChave}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                          {danfe.canal || 'S/ Canal'}
                        </span>
                        <span className="text-[10px] font-bold text-gray-500">
                          Loja: {danfe.pedidoLoja || 'S/ Referência'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mt-1">{danfe.cliente}</div>
                    </div>
                    <div className="text-right">
                      <div className={`px-3 py-1 rounded-full text-xs font-black ${config.cor} ${config.textCor}`}>
                        {config.label}
                      </div>
                      <div className="text-lg font-black text-gray-900 mt-1">{formatarValor(danfe.valor)}</div>
                    </div>
                  </div>
                </button>

                {/* Expandido */}
                {isExpanded && (
                  <div className="border-t-2 border-gray-200 p-4 bg-gray-50 space-y-4">
                    {/* Detalhes */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-bold text-gray-600 uppercase">Pedido</p>
                        <p className="font-bold text-gray-900">{danfe.pedidoNumero || danfe.pedidoId}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-600 uppercase">Emissão</p>
                        <p className="font-bold text-gray-900">{formatarData(danfe.dataEmissao)}</p>
                      </div>
                      {danfe.dataAutorizacao && (
                        <div>
                          <p className="text-xs font-bold text-gray-600 uppercase">Autorização</p>
                          <p className="font-bold text-gray-900">{formatarData(danfe.dataAutorizacao)}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-gray-600 uppercase">Valor</p>
                        <p className="font-bold text-gray-900">{formatarValor(danfe.valor)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-600 uppercase">Origem/Canal</p>
                        <p className="font-bold text-blue-700 uppercase">{danfe.canal || 'Não detectado'}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-600 uppercase">Nº Pedido Loja</p>
                        <p className="font-bold text-indigo-700">{danfe.pedidoLoja || 'Sem referência'}</p>
                      </div>
                    </div>

                    {danfe.observacoes && (
                      <div className="p-3 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs font-bold text-blue-700 uppercase mb-1">Observações</p>
                        <p className="text-sm text-blue-900">{danfe.observacoes}</p>
                      </div>
                    )}

                    {/* Ações */}
                    <div className="flex flex-wrap gap-2">
                      {onImprimir && (
                        <button
                          onClick={() => onImprimir(danfe)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold transition-all"
                        >
                          <Printer size={16} />
                          Danfe Regular
                        </button>
                      )}

                      {onImprimirSimplificada && danfe.status === 'autorizada' && (
                        <button
                          onClick={() => onImprimirSimplificada(danfe)}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold transition-all"
                        >
                          <Printer size={16} />
                          Danfe Simplificada
                        </button>
                      )}

                      {onGerarZPL && (
                        <button
                          onClick={() => handleGerarZPL(danfe)}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold transition-all"
                        >
                          <Printer size={16} />
                          {danfe.status === 'autorizada' ? 'Apenas Etiqueta' : 'Etiqueta ZPL'}
                        </button>
                      )}

                      {onDownloadPDF && (
                        <button
                          onClick={() => onDownloadPDF(danfe)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold transition-all"
                        >
                          <Download size={16} />
                          PDF
                        </button>
                      )}

                      {onDownloadXML && (
                        <button
                          onClick={() => onDownloadXML(danfe)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold transition-all"
                        >
                          <Download size={16} />
                          XML
                        </button>
                      )}

                      {danfe.status === 'erro' && onCorrigirErro && (
                        <button
                          onClick={() => onCorrigirErro(danfe)}
                          className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold transition-all"
                        >
                          <AlertCircle size={16} />
                          Alterar e Completar
                        </button>
                      )}

                      {danfe.status === 'erro' && onReemitir && (
                        <button
                          onClick={() => onReemitir(danfe.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold transition-all"
                        >
                          <AlertCircle size={16} />
                          Tentar Reemitir Novamente
                        </button>
                      )}
                    </div>

                    {/* Itens do Pedido */}
                    {(itensPorPedido[danfe.pedidoId]?.length ?? 0) > 0 || onSincronizarItens ? (
                      <div className="border-t-2 border-gray-200 pt-4">
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <Package size={18} className="text-blue-600" />
                          Itens do Pedido
                        </h4>
                        <ListaItensPedido
                          orderId={danfe.pedidoId}
                          blingOrderId={danfe.id}
                          itens={itensPorPedido[danfe.pedidoId] || []}
                          onSync={onSincronizarItens ? () => onSincronizarItens(danfe.pedidoId) : undefined}
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Visualização ZPL */}
      {showZPLModal && selectedDANFE && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-4">
            <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <Printer className="text-purple-600" size={28} />
              Gerar Etiqueta ZPL - NF-e #{selectedDANFE.nfeNumero}
            </h3>

            {/* Preview ZPL */}
            {selectedDANFE.etiquetaZpl && (
              <div className="p-4 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 font-mono text-xs overflow-auto max-h-64">
                <pre className="text-gray-700">{selectedDANFE.etiquetaZpl}</pre>
              </div>
            )}

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-bold text-blue-900">
                💡 Código ZPL pronto para impressora térmica Zebra. Configure sua impressora com essa etiqueta para rastreamento.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowZPLModal(false)}
                className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-bold hover:bg-gray-300 transition-all"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  // Copiar ZPL para clipboard
                  if (selectedDANFE.etiquetaZpl) {
                    navigator.clipboard.writeText(selectedDANFE.etiquetaZpl);
                    alert('Código ZPL copiado para clipboard!');
                  }
                }}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition-all"
              >
                Copiar Código
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DANFEGerenciador;
