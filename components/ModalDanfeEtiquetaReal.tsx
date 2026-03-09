// ============================================================================
// components/ModalDanfeEtiquetaReal.tsx
// Modal que processa DANFE + Etiqueta REAL (Shopee → Bling → SKU ERP)
// ============================================================================

import React, { useState } from 'react';
import {
  X,
  Download,
  Loader,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Minus,
  ShoppingCart,
  Link2,
} from 'lucide-react';
import { danfeSimplificadoComEtiquetaService } from '../services/danfeSimplificadoComEtiquetaService';

interface ModalDanfeEtiquetaRealProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
  marketplace?: 'SHOPEE' | 'MERCADO_LIVRE';
  addToast?: (msg: string, tipo: 'success' | 'error' | 'info') => void;
}

export const ModalDanfeEtiquetaReal: React.FC<ModalDanfeEtiquetaRealProps> = ({
  isOpen,
  onClose,
  token,
  marketplace = 'SHOPEE',
  addToast,
}) => {
  const [quantidade, setQuantidade] = useState(5);
  const [isCarregando, setIsCarregando] = useState(false);
  const [isProcessando, setIsProcessando] = useState(false);
  const [pedidosCarregados, setPedidosCarregados] = useState<any[]>([]);
  const [resultado, setResultado] = useState<{
    processados: any[];
    totalSucesso: number;
    totalErros: number;
    relatorio: string;
    arquivos: any[];
  } | null>(null);

  if (!isOpen) return null;

  // Buscar pedidos com etiqueta REAL
  const handleBuscarPedidos = async () => {
    if (!token) {
      addToast?.('❌ Token Bling não configurado', 'error');
      return;
    }

    setIsCarregando(true);
    try {
      console.log(`🔍 Buscando ${quantidade} pedidos de ${marketplace} com etiqueta REAL...`);

      const { pedidos, total, comEtiqueta, semEtiqueta } =
        await danfeSimplificadoComEtiquetaService.buscarPedidosComEtiquetaDisponivel(
          token,
          quantidade,
          marketplace as 'SHOPEE' | 'MERCADO_LIVRE'
        );

      setPedidosCarregados(pedidos);

      addToast?.(
        `✅ ${comEtiqueta}/${total} pedidos com etiqueta REAL (${semEtiqueta} sem etiqueta)`,
        'success'
      );

      console.log(`✅ Carregado: ${comEtiqueta} com etiqueta, ${semEtiqueta} sem`);
    } catch (error: any) {
      addToast?.(`❌ Erro: ${error.message}`, 'error');
      console.error('Erro:', error);
    } finally {
      setIsCarregando(false);
    }
  };

  // Processar com etiqueta REAL + SKU vinculado
  const handleProcessar = async () => {
    if (pedidosCarregados.length === 0) {
      addToast?.('❌ Busque pedidos primeiro', 'error');
      return;
    }

    setIsProcessando(true);
    try {
      console.log(`⚙️ Processando ${pedidosCarregados.length} pedidos com etiqueta REAL...`);

      const resultado = await danfeSimplificadoComEtiquetaService.processarPedidosParaDanfeEtiqueta(
        pedidosCarregados,
        'usuario@email.com'
      );

      setResultado(resultado);

      addToast?.(
        `✅ ${resultado.totalSucesso} processado(s) | ❌ ${resultado.totalErros} erro(s)`,
        resultado.totalSucesso > 0 ? 'success' : 'error'
      );

      console.log(`✅ Sucesso: ${resultado.totalSucesso}, ❌ Erros: ${resultado.totalErros}`);
    } catch (error: any) {
      addToast?.(`❌ Erro ao processar: ${error.message}`, 'error');
      console.error('Erro:', error);
    } finally {
      setIsProcessando(false);
    }
  };

  // Download dos arquivos
  const handleDownload = async () => {
    if (!resultado?.arquivos || resultado.arquivos.length === 0) {
      addToast?.('Nenhum arquivo para download', 'error');
      return;
    }

    try {
      const zipBlob = await danfeSimplificadoComEtiquetaService.gerarZipDosArquivos(
        resultado.arquivos
      );
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `danfe-etiqueta-${marketplace}-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast?.('✅ ZIP baixado com sucesso', 'success');
    } catch (error: any) {
      addToast?.(`❌ Erro ao baixar: ${error.message}`, 'error');
    }
  };

  // Download do relatório
  const handleDownloadRelatorio = () => {
    if (!resultado?.relatorio) {
      addToast?.('Nenhum relatório disponível', 'error');
      return;
    }

    const blob = new Blob([resultado.relatorio], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${marketplace}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addToast?.('✅ Relatório baixado', 'success');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart size={24} />
            <div>
              <h2 className="font-bold text-lg">
                📦 {marketplace} - DANFE + Etiqueta REAL
              </h2>
              <p className="text-sm text-purple-100">
                Etiqueta vem da Shopee → Bling → Vinculado ao SKU ERP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-purple-500 rounded transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Etapa 1: Seleção de Quantidade */}
          {!resultado && (
            <>
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-4">
                <label className="block text-sm font-bold text-purple-900 mb-4">
                  📊 Selecione Quantidade de Pedidos para Processar
                </label>

                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={() => setQuantidade(Math.max(1, quantidade - 5))}
                    className="p-2 bg-white hover:bg-purple-100 rounded border-2 border-purple-300 transition"
                  >
                    <Minus size={18} className="text-purple-600" />
                  </button>

                  <input
                    type="number"
                    value={quantidade}
                    onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value)))}
                    className="w-24 px-4 py-2 border-2 border-purple-400 rounded text-center font-bold text-lg"
                    min="1"
                  />

                  <button
                    onClick={() => setQuantidade(quantidade + 5)}
                    className="p-2 bg-white hover:bg-purple-100 rounded border-2 border-purple-300 transition"
                  >
                    <Plus size={18} className="text-purple-600" />
                  </button>

                  <span className="text-sm text-purple-900 font-semibold flex-1">
                    {quantidade} pedidos serão processados
                  </span>
                </div>

                <button
                  onClick={handleBuscarPedidos}
                  disabled={isCarregando}
                  className="w-full px-4 py-3 bg-purple-600 text-white rounded font-bold hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCarregando ? (
                    <Loader size={20} className="animate-spin" />
                  ) : (
                    <Download size={20} />
                  )}
                  {isCarregando
                    ? 'Buscando pedidos com etiqueta REAL...'
                    : `🔍 Buscar ${quantidade} Pedidos com Etiqueta`}
                </button>

                <p className="text-xs text-purple-700 mt-3 p-2 bg-purple-100 rounded">
                  ℹ️ Pedidos SEM etiqueta (rastreamento) serão automaticamente pulados e não
                  aparecerão no resultado.
                </p>
              </div>

              {/* Pedidos Carregados */}
              {pedidosCarregados.length > 0 && (
                <div className="bg-white border-2 border-green-300 rounded-lg p-4">
                  <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                    <CheckCircle2 size={20} className="text-green-600" />
                    ✅ {pedidosCarregados.length} Pedido(s) COM Etiqueta REAL Carregado(s)
                  </h4>

                  <div className="space-y-2 max-h-48 overflow-y-auto bg-green-50 p-3 rounded">
                    {pedidosCarregados.map((pedido, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-white rounded border border-green-300"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">#{pedido.numero}</p>
                          <p className="text-sm text-slate-600 line-clamp-1">
                            {pedido.cliente.nome}
                          </p>
                          <p className="text-xs text-slate-500">
                            Itens: {pedido.itens.length} | SKU vinculados: 
                            {pedido.itens.filter((i: any) => i.skuPrincipal).length}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">
                            {pedido.marketplace}
                          </span>
                          <p className="text-xs text-slate-600 mt-1 font-mono">
                            {pedido.rastreio.substring(0, 12)}...
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Aviso de SKU */}
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded flex gap-2">
                    <Link2 size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                      <p className="font-semibold">SKU Vinculados</p>
                      <p className="text-xs">
                        Produtos serão automaticamente vinculados aos SKUs principais do ERP
                      </p>
                    </div>
                  </div>

                  {/* Botão Processar */}
                  <button
                    onClick={handleProcessar}
                    disabled={isProcessando}
                    className="w-full mt-4 px-4 py-3 bg-green-600 text-white rounded font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2 animate-pulse"
                  >
                    {isProcessando ? (
                      <Loader size={20} className="animate-spin" />
                    ) : (
                      <ShoppingCart size={20} />
                    )}
                    {isProcessando
                      ? `Processando ${pedidosCarregados.length} pedidos com etiqueta REAL...`
                      : `⚡ Processar DANFE + Etiqueta (${pedidosCarregados.length})`}
                  </button>
                </div>
              )}
            </>
          )}

          {/* Etapa 2: Resultados */}
          {resultado && (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 text-center">
                  <p className="text-xs text-blue-600 font-bold">Total Processado</p>
                  <p className="text-3xl font-bold text-blue-900">
                    {resultado.totalSucesso + resultado.totalErros}
                  </p>
                </div>
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-center">
                  <p className="text-xs text-green-600 font-bold">✅ Com Sucesso</p>
                  <p className="text-3xl font-bold text-green-600">
                    {resultado.totalSucesso}
                  </p>
                </div>
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 text-center">
                  <p className="text-xs text-red-600 font-bold">❌ Pulados/Erros</p>
                  <p className="text-3xl font-bold text-red-600">{resultado.totalErros}</p>
                </div>
              </div>

              {/* Detalhes de Processamento */}
              <div className="bg-slate-50 border-2 border-slate-300 rounded-lg p-4">
                <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <ShoppingCart size={18} /> Detalhes de Cada Pedido
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {resultado.processados.map((p, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 p-2 rounded text-sm ${
                        p.sucesso
                          ? 'bg-green-50 border border-green-300'
                          : 'bg-red-50 border border-red-300'
                      }`}
                    >
                      {p.sucesso ? (
                        <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-slate-900">#{p.pedidoId}</p>
                        <p className="text-xs text-slate-600">
                          {p.sucesso ? '✅ Processado com etiqueta REAL' : `❌ ${p.motivo}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botões de Download */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-300 rounded-lg p-4">
                <h4 className="font-bold text-green-900 mb-4 flex items-center gap-2">
                  📥 Downloads Prontos
                </h4>
                <div className="space-y-2">
                  {resultado.totalSucesso > 0 && (
                    <button
                      onClick={handleDownload}
                      className="w-full px-4 py-3 bg-green-600 text-white rounded font-bold hover:bg-green-700 transition flex items-center justify-center gap-2"
                    >
                      <Download size={20} /> 📦 Baixar ZIP ({resultado.totalSucesso} arquivo
                      {resultado.totalSucesso === 1 ? '' : 's'} com etiqueta REAL)
                    </button>
                  )}
                  <button
                    onClick={handleDownloadRelatorio}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                  >
                    <Download size={20} /> 📋 Baixar Relatório Detalhado (TXT)
                  </button>
                </div>
              </div>

              {/* Informações Importantes */}
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                <p className="text-sm text-yellow-900 font-bold mb-2">
                  ℹ️ O Que Contém nos Arquivos:
                </p>
                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                  <li>DANFE Simplificado com dados reais do pedido</li>
                  <li>✅ Etiqueta REAL que veio da Shopee/Bling</li>
                  <li>
                    <strong>SKU Principal do ERP</strong> vinculado aos produtos
                  </li>
                  <li>Código de rastreamento (para código de barras)</li>
                  <li>Dados do cliente completos</li>
                  <li>Todos prontos para impressão</li>
                </ul>
              </div>

              {/* Botão Voltar */}
              <button
                onClick={() => {
                  setResultado(null);
                  setPedidosCarregados([]);
                }}
                className="w-full px-4 py-2 bg-slate-400 text-white rounded font-bold hover:bg-slate-500 transition"
              >
                ← Voltar e Processar Novos Pedidos
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalDanfeEtiquetaReal;
