// ============================================================================
// components/ModalDanfeEtiqueta.tsx
// Modal para processar DANFE Simplificado + Etiqueta (migração do Bling)
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
  FileText,
  Package,
} from 'lucide-react';
import { danfeSimplificadoComEtiquetaService } from '../services/danfeSimplificadoComEtiquetaService';

interface ModalDanfeEtiquetaProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
  marketplace?: 'SHOPEE' | 'MERCADO_LIVRE';
  addToast?: (msg: string, tipo: 'success' | 'error' | 'info') => void;
}

export const ModalDanfeEtiqueta: React.FC<ModalDanfeEtiquetaProps> = ({
  isOpen,
  onClose,
  token,
  marketplace,
  addToast,
}) => {
  const [quantidade, setQuantidade] = useState(10);
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

  // Buscar pedidos com etiqueta
  const handleBuscarPedidos = async () => {
    if (!token) {
      addToast?.('❌ Token Bling não configurado', 'error');
      return;
    }

    setIsCarregando(true);
    try {
      const { pedidos, total, comEtiqueta, semEtiqueta } =
        await danfeSimplificadoComEtiquetaService.buscarPedidosComEtiquetaDisponivel(
          token,
          quantidade,
          marketplace
        );

      setPedidosCarregados(pedidos);
      addToast?.(
        `✅ Carregado ${comEtiqueta}/${total} pedidos com etiqueta (${semEtiqueta} sem)`,
        'success'
      );
    } catch (error: any) {
      addToast?.(`❌ Erro: ${error.message}`, 'error');
    } finally {
      setIsCarregando(false);
    }
  };

  // Processar DANFE + Etiqueta
  const handleProcessar = async () => {
    if (pedidosCarregados.length === 0) {
      addToast?.('❌ Busque pedidos primeiro', 'error');
      return;
    }

    setIsProcessando(true);
    try {
      const resultado = await danfeSimplificadoComEtiquetaService.processarPedidosParaDanfeEtiqueta(
        pedidosCarregados,
        'usuario@email.com'
      );

      setResultado(resultado);
      addToast?.(
        `✅ ${resultado.totalSucesso} processado(s) | ❌ ${resultado.totalErros} erro(s)`,
        resultado.totalSucesso > 0 ? 'success' : 'error'
      );
    } catch (error: any) {
      addToast?.(`❌ Erro ao processar: ${error.message}`, 'error');
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
      a.download = `danfe-etiquetas-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast?.('✅ Arquivos baixados com sucesso', 'success');
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
    a.download = `relatorio-danfe-${new Date().toISOString().split('T')[0]}.txt`;
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
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText size={24} />
            <div>
              <h2 className="font-bold text-lg">Impressão DANFE + Etiqueta</h2>
              <p className="text-sm text-blue-100">Migração do Bling - Formato Simplificado</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-blue-500 rounded transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Etapa 1: Seleção de Quantidade */}
          {!resultado && (
            <>
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
                <label className="block text-sm font-bold text-blue-900 mb-4">
                  📦 Selecione a Quantidade de Pedidos
                </label>

                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={() => setQuantidade(Math.max(1, quantidade - 5))}
                    className="p-2 bg-white hover:bg-blue-100 rounded border border-blue-300 transition"
                  >
                    <Minus size={18} className="text-blue-600" />
                  </button>

                  <input
                    type="number"
                    value={quantidade}
                    onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value)))}
                    className="w-24 px-4 py-2 border-2 border-blue-400 rounded text-center font-bold text-lg"
                    min="1"
                  />

                  <button
                    onClick={() => setQuantidade(quantidade + 5)}
                    className="p-2 bg-white hover:bg-blue-100 rounded border border-blue-300 transition"
                  >
                    <Plus size={18} className="text-blue-600" />
                  </button>

                  <span className="text-sm text-blue-900 font-semibold flex-1">
                    {marketplace && `(${marketplace})`} {quantidade} pedidos
                  </span>
                </div>

                <button
                  onClick={handleBuscarPedidos}
                  disabled={isCarregando}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCarregando ? (
                    <Loader size={20} className="animate-spin" />
                  ) : (
                    <Download size={20} />
                  )}
                  {isCarregando ? 'Buscando pedidos...' : 'Buscar Pedidos com Etiqueta'}
                </button>
              </div>

              {/* Pedidos Carregados */}
              {pedidosCarregados.length > 0 && (
                <div className="bg-white border-2 border-green-200 rounded-lg p-4">
                  <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                    <CheckCircle2 size={20} className="text-green-600" />
                    {pedidosCarregados.length} Pedido(s) com Etiqueta Carregado(s)
                  </h4>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pedidosCarregados.map((pedido, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-300"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">#{pedido.numero}</p>
                          <p className="text-sm text-slate-600">{pedido.cliente.nome}</p>
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">
                            {pedido.marketplace}
                          </span>
                          <p className="text-xs text-slate-500 mt-1">{pedido.rastreio}</p>
                        </div>
                      </div>
                    ))}
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
                      <Package size={20} />
                    )}
                    {isProcessando
                      ? 'Processando DANFE + Etiqueta...'
                      : '⚡ Processar e Montar Arquivos'}
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
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-blue-600 font-semibold">Total</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {resultado.totalSucesso + resultado.totalErros}
                  </p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-green-600 font-semibold">✅ Sucesso</p>
                  <p className="text-2xl font-bold text-green-600">
                    {resultado.totalSucesso}
                  </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-red-600 font-semibold">❌ Erros</p>
                  <p className="text-2xl font-bold text-red-600">{resultado.totalErros}</p>
                </div>
              </div>

              {/* Detalhes de Processamento */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-bold text-slate-900 mb-3">📋 Detalhes de Processamento</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto text-sm">
                  {resultado.processados.map((p, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 p-2 rounded ${
                        p.sucesso
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      {p.sucesso ? (
                        <CheckCircle2 size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">#{p.pedidoId}</p>
                        <p className="text-xs text-slate-600">
                          {p.sucesso ? 'Processado com sucesso' : p.motivo}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botões de Download */}
              <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 rounded-lg p-4">
                <h4 className="font-bold text-green-900 mb-3">📥 Downloads</h4>
                <div className="space-y-2">
                  {resultado.totalSucesso > 0 && (
                    <button
                      onClick={handleDownload}
                      className="w-full px-4 py-3 bg-green-600 text-white rounded font-bold hover:bg-green-700 transition flex items-center justify-center gap-2"
                    >
                      <Download size={20} /> Baixar Arquivos ZIP ({resultado.totalSucesso}
                      {resultado.totalSucesso === 1 ? ' arquivo' : ' arquivos'})
                    </button>
                  )}
                  <button
                    onClick={handleDownloadRelatorio}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                  >
                    <FileText size={20} /> Baixar Relatório (TXT)
                  </button>
                </div>
              </div>

              {/* Informações Importantes */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-900 font-semibold mb-2">⚠️ Informações Importantes:</p>
                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                  <li>Pedidos SEM etiqueta foram automaticamente pulados</li>
                  <li>
                    Cada arquivo contém DANFE Simplificado + Etiqueta (formato Bling)
                  </li>
                  <li>Todos os arquivos já estão prontos para impressão</li>
                  <li>ZIP contém {resultado.arquivos.length} arquivo(s) válido(s)</li>
                </ul>
              </div>

              {/* Botão Voltar */}
              <button
                onClick={() => {
                  setResultado(null);
                  setPedidosCarregados([]);
                }}
                className="w-full px-4 py-2 bg-slate-300 text-slate-900 rounded font-bold hover:bg-slate-400 transition"
              >
                ← Voltar e Processar Novamente
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalDanfeEtiqueta;
