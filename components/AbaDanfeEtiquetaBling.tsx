// ============================================================================
// components/AbaDanfeEtiquetaBling.tsx
// Aba/Seção para gerenciar importação de pedidos + geração de DANFE + Etiqueta do Bling
// ============================================================================

import React, { useState } from 'react';
import {
  FileText,
  Printer,
  AlertCircle,
  Info,
  ShoppingCart,
  Package,
} from 'lucide-react';
import { ModalDanfeEtiqueta } from './ModalDanfeEtiqueta';
import { AbaImportacaoPedidosBling } from './AbaImportacaoPedidosBling';

interface AbaDanfeEtiquetaBlingProps {
  token?: string;
  addToast?: (msg: string, tipo: 'success' | 'error' | 'info') => void;
}

export const AbaDanfeEtiquetaBling: React.FC<AbaDanfeEtiquetaBlingProps> = ({
  token,
  addToast,
}) => {
  const [abaAtiva, setAbaAtiva] = useState<'importacao' | 'danfe-etiqueta'>('importacao');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tipoMarketplace, setTipoMarketplace] = useState<'SHOPEE' | 'MERCADO_LIVRE' | undefined>(
    undefined
  );

  const handleAbrirModal = (marketplace?: 'SHOPEE' | 'MERCADO_LIVRE') => {
    if (!token) {
      addToast?.(
        '❌ Token Bling não configurado. Configure nas configurações.',
        'error'
      );
      return;
    }
    setTipoMarketplace(marketplace);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6 p-4">
      {/* Abas */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setAbaAtiva('importacao')}
          className={`px-4 py-2 font-medium text-sm ${abaAtiva === 'importacao'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          📦 Importação de Pedidos
        </button>
        <button
          onClick={() => setAbaAtiva('danfe-etiqueta')}
          className={`px-4 py-2 font-medium text-sm ${abaAtiva === 'danfe-etiqueta'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          🖨️ DANFE Simplificado + Etiqueta de transporte
        </button>
      </div>

      {abaAtiva === 'importacao' && (
        <AbaImportacaoPedidosBling token={token} addToast={addToast} />
      )}

      {abaAtiva === 'danfe-etiqueta' && (
        <>
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <FileText size={32} className="text-purple-600 flex-shrink-0" />
              <div>
                <h2 className="text-2xl font-bold text-purple-900">
                  🖨️ Impressão de DANFE Simplificado + Etiqueta
                </h2>
                <p className="text-sm text-purple-700 mt-2">
                  Combine DANFE Simplificado + Etiqueta da plataforma em um único arquivo.
                  Migração automática do processo do Bling.
                </p>
              </div>
            </div>
          </div>

          {/* Aviso se não tem token */}
          {!token && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex gap-3">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-bold text-red-900">Token Bling não configurado</p>
                <p className="text-sm text-red-800 mt-1">
                  Acesse as configurações e configure seu token Bling para usar esta funcionalidade.
                </p>
              </div>
            </div>
          )}

          {/* Instruções */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2 items-start">
              <Info size={16} className="text-blue-600 flex-shrink-0 mt-1" />
              <div className="text-sm text-blue-900 space-y-2">
                <p className="font-semibold">📖 Como Funciona:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Selecione a quantidade de pedidos que deseja processar</li>
                  <li>Sistema busca apenas pedidos com etiqueta pronta</li>
                  <li>Pedidos sem etiqueta são automaticamente pulados</li>
                  <li>Cada arquivo contém: DANFE Simplificado + Etiqueta</li>
                  <li>Download em ZIP pronto para impressão</li>
                  <li>Relatório detalhado de todos os processados</li>
                </ol>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          {token && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Shopee */}
              <button
                onClick={() => handleAbrirModal('SHOPEE')}
                className="bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-lg p-6 shadow-lg transition transform hover:scale-105"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Printer size={28} />
                  <span className="text-xl font-bold">Shopee</span>
                </div>
                <p className="text-sm text-orange-100 text-left">
                  Gerar DANFE + Etiqueta para pedidos da Shopee
                </p>
              </button>

              {/* Mercado Livre */}
              <button
                onClick={() => handleAbrirModal('MERCADO_LIVRE')}
                className="bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white rounded-lg p-6 shadow-lg transition transform hover:scale-105"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Printer size={28} />
                  <span className="text-xl font-bold">Mercado Livre</span>
                </div>
                <p className="text-sm text-yellow-100 text-left">
                  Gerar DANFE + Etiqueta para pedidos do Mercado Livre
                </p>
              </button>
            </div>
          )}

          {/* Benefícios */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="font-bold text-green-900 mb-3">✨ Benefícios:</p>
            <ul className="text-sm text-green-800 space-y-2 list-disc list-inside">
              <li>
                <span className="font-semibold">Sem limite de pedidos</span> - Processe quantos
                precisar em uma rodada
              </li>
              <li>
                <span className="font-semibold">Filtro automático</span> - Apenas pedidos com etiqueta
                pronta
              </li>
              <li>
                <span className="font-semibold">Arquivo consolidado</span> - DANFE + Etiqueta em um
                único arquivo por pedido
              </li>
              <li>
                <span className="font-semibold">Relatório completo</span> - Listagem de sucessos e
                erros
              </li>
              <li>
                <span className="font-semibold">Pronto para impressão</span> - ZIP com todos os
                arquivos
              </li>
            </ul>
          </div>

          {/* FAQ */}
          <details className="bg-slate-50 border border-slate-200 rounded-lg">
            <summary className="p-4 font-bold text-slate-900 cursor-pointer hover:bg-slate-100 transition">
              ❓ Perguntas Frequentes
            </summary>
            <div className="p-4 space-y-4 text-sm text-slate-700 border-t border-slate-200">
              <div>
                <p className="font-semibold text-slate-900">
                  O que acontece com pedidos sem etiqueta?
                </p>
                <p className="mt-1 text-slate-600">
                  Eles são automaticamente pulados e aparecem no relatório como "Etiqueta não
                  disponível".
                </p>
              </div>

              <div>
                <p className="font-semibold text-slate-900">Posso processar todos os pedidos?</p>
                <p className="mt-1 text-slate-600">
                  Sim! Não há limite. Você seleciona a quantidade desejada (1 a 10.000 ou mais).
                </p>
              </div>

              <div>
                <p className="font-semibold text-slate-900">
                  Por quanto tempo os arquivos ficam disponíveis?
                </p>
                <p className="mt-1 text-slate-600">
                  Você pode baixar imediatamente após o processamento. Os links expiram após alguns
                  minutos.
                </p>
              </div>

              <div>
                <p className="font-semibold text-slate-900">
                  Qual é a diferença para o processo normal do Bling?
                </p>
                <p className="mt-1 text-slate-600">
                  Este é exatamente o mesmo processo que o Bling usa internamente, mas integrado no
                  ERP para mais facilidade.
                </p>
              </div>
            </div>
          </details>
        </>
      )}

      {/* Modal */}
      <ModalDanfeEtiqueta
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setTipoMarketplace(undefined);
        }}
        token={token}
        marketplace={tipoMarketplace}
        addToast={addToast}
      />
    </div>
  );
};

export default AbaDanfeEtiquetaBling;
