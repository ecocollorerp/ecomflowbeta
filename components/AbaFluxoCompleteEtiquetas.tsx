// ============================================================================
// components/AbaFluxoCompleteEtiquetas.tsx
// Aba integrada para gerenciar fluxo completo de etiquetas
// ============================================================================

import React, { useState } from 'react';
import {
  Download,
  RefreshCw,
  Trash2,
  FileText,
  AlertCircle,
} from 'lucide-react';
import useFluxoCompleteEtiquetas from '../hooks/useFluxoCompleteEtiquetas';
import { FluxoCompleteEtiquetas } from './FluxoCompleteEtiquetas';

interface AbaFluxoCompleteEtiquetasProps {
  token?: string;
  addToast?: (msg: string, tipo: 'success' | 'error' | 'info') => void;
}

export const AbaFluxoCompleteEtiquetas: React.FC<AbaFluxoCompleteEtiquetasProps> = ({
  token,
  addToast,
}) => {
  const [tipoPedidos, setTipoPedidos] = useState<'nfe' | 'mercado_livre'>('nfe');

  const fluxo = useFluxoCompleteEtiquetas({
    tipoPedidos,
    addToast,
  });

  const handleDownloadResultados = () => {
    if (fluxo.resultados.length === 0) {
      addToast?.('Nenhum resultado para exportar', 'info');
      return;
    }

    // Gerar resumo
    const resumo = fluxo.resultados.map(r => ({
      pedidoId: r.pedidoId,
      sucesso: r.sucesso ? '✅' : '❌',
      etapa: r.etapa,
      mensagem: r.mensagem,
      erro: r.erro || '-',
    }));

    // Converter para CSV
    const headers = ['Pedido', 'Status', 'Etapa', 'Mensagem', 'Erro'];
    const csv = [
      headers.join(','),
      ...resumo.map(r =>
        [
          `"${r.pedidoId}"`,
          `"${r.sucesso}"`,
          `"${r.etapa}"`,
          `"${r.mensagem}"`,
          `"${r.erro}"`,
        ].join(',')
      ),
    ].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fluxo-etiquetas-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addToast?.('✅ Relatório exportado com sucesso', 'success');
  };

  return (
    <div className="space-y-4 p-4">
      {/* Seletor de Tipo de Pedido */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => {
            setTipoPedidos('nfe');
            fluxo.limparPedidos();
          }}
          className={`px-4 py-3 font-semibold border-b-2 transition ${
            tipoPedidos === 'nfe'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          🧾 NFe (Sem Limite)
        </button>
        <button
          onClick={() => {
            setTipoPedidos('mercado_livre');
            fluxo.limparPedidos();
          }}
          className={`px-4 py-3 font-semibold border-b-2 transition ${
            tipoPedidos === 'mercado_livre'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          🎫 Mercado Livre (Com Etiqueta)
        </button>
      </div>

      {/* Aviso de Configuração */}
      {!token && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
          <AlertCircle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-900">Token Bling não configurado</p>
            <p className="text-sm text-yellow-800 mt-1">
              Configure seu token Bling nas configurações para usar este fluxo.
            </p>
          </div>
        </div>
      )}

      {/* Componente Principal */}
      {token && (
        <>
          <FluxoCompleteEtiquetas
            token={token}
            tipoPedidos={tipoPedidos}
            addToast={addToast}
          />

          {/* Ações Adicionais */}
          {fluxo.resultados.length > 0 && (
            <div className="bg-white p-4 rounded-lg border space-y-4">
              <h4 className="font-bold text-slate-900">⚙️ Ações</h4>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleDownloadResultados}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition flex items-center gap-2 font-semibold"
                >
                  <Download size={18} /> Exportar CSV
                </button>

                <button
                  onClick={() => fluxo.limparResultados()}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200 transition flex items-center gap-2 font-semibold"
                >
                  <RefreshCw size={18} /> Nova Rodada
                </button>

                <button
                  onClick={() => fluxo.limparPedidos()}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 transition flex items-center gap-2 font-semibold"
                >
                  <Trash2 size={18} /> Limpar Tudo
                </button>
              </div>

              {/* Statísticas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-slate-100 p-3 rounded text-center">
                  <p className="text-xs text-slate-600">Total</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {fluxo.resultados.length}
                  </p>
                </div>
                <div className="bg-green-100 p-3 rounded text-center">
                  <p className="text-xs text-green-600">Sucesso</p>
                  <p className="text-2xl font-bold text-green-600">
                    {fluxo.resultadoSucesso}
                  </p>
                </div>
                <div className="bg-red-100 p-3 rounded text-center">
                  <p className="text-xs text-red-600">Falhas</p>
                  <p className="text-2xl font-bold text-red-600">{fluxo.resultadoFalhas}</p>
                </div>
                <div className="bg-purple-100 p-3 rounded text-center">
                  <p className="text-xs text-purple-600">Taxa Sucesso</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {fluxo.resultados.length > 0
                      ? `${Math.round((fluxo.resultadoSucesso / fluxo.resultados.length) * 100)}%`
                      : '0%'}
                  </p>
                </div>
              </div>

              {/* Log de Detalhes */}
              <details className="bg-slate-50 p-3 rounded">
                <summary className="cursor-pointer font-semibold text-slate-700 flex items-center gap-2">
                  <FileText size={16} /> Ver Log de Detalhes ({fluxo.resultados.length})
                </summary>
                <div className="mt-3 space-y-1 text-xs font-mono text-slate-600 max-h-48 overflow-y-auto">
                  {fluxo.resultados.map((r, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded ${
                        r.sucesso ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}
                    >
                      [{r.sucesso ? '✅' : '❌'}] #{r.pedidoId} - {r.etapa}
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </>
      )}

      {/* Instruções */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-bold text-blue-900 mb-2">📖 Como Funciona</h4>
        <ol className="text-sm text-blue-900 space-y-1 list-decimal list-inside">
          <li>Selecione o tipo de pedido (NFe ou Mercado Livre)</li>
          <li>Clique em "Buscar Pedidos" para carregar orders</li>
          <li>Execute o fluxo completo: TXT → Upload → ZPL → Processar</li>
          <li>Baixe os arquivos ZPL gerados para sua impressora</li>
          <li>Exporte o relatório CSV se necessário</li>
        </ol>
      </div>
    </div>
  );
};

export default AbaFluxoCompleteEtiquetas;
