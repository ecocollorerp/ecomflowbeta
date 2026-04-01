// ============================================================================
// components/AbaDanfeEtiquetaProntoUso.tsx
// Aba PRONTA para USAR - Integra DANFE + Etiqueta REAL do pedido
// ============================================================================

import React, { useState } from 'react';
import { ShoppingCart, Printer, AlertCircle, Info, Plus } from 'lucide-react';
import { ModalDanfeEtiquetaReal } from './ModalDanfeEtiquetaReal';

interface AbaDanfeEtiquetaProntoUsoProps {
  token?: string;
  addToast?: (msg: string, tipo: 'success' | 'error' | 'info') => void;
}

export const AbaDanfeEtiquetaProntoUso: React.FC<
  AbaDanfeEtiquetaProntoUsoProps
> = ({ token, addToast }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [marketplace, setMarketplace] = useState<'SHOPEE' | 'MERCADO_LIVRE'>(
    'SHOPEE'
  );

  const handleAbrirModal = (market: 'SHOPEE' | 'MERCADO_LIVRE') => {
    if (!token) {
      addToast?.(
        '❌ Token Bling não configurado. Configure nas suas configurações.',
        'error'
      );
      return;
    }
    setMarketplace(market);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg p-4 sm:p-8">
        <div className="flex items-start gap-4">
          <ShoppingCart size={40} className="flex-shrink-0" />
          <div>
            <h2 className="text-xl sm:text-3xl font-bold">📦 DANFE + Etiqueta REAL</h2>
            <p className="text-lg text-purple-100 mt-2">
              Impressão consolidada direto da Shopee/Bling com etiqueta REAL e SKU vinculado
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-purple-700 rounded-full text-sm font-semibold">
                ✅ Etiqueta REAL
              </span>
              <span className="px-3 py-1 bg-purple-700 rounded-full text-sm font-semibold">
                🔗 SKU Vinculado
              </span>
              <span className="px-3 py-1 bg-purple-700 rounded-full text-sm font-semibold">
                📊 Sem Limite
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Aviso se não tem token */}
      {!token && (
        <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 flex gap-3">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-1" />
          <div>
            <p className="font-bold text-red-900">⚠️ Token Bling não configurado</p>
            <p className="text-sm text-red-800 mt-1">
              Configure seu token Bling nas configurações para usar esta funcionalidade.
            </p>
          </div>
        </div>
      )}

      {/* Instruções Rápidas */}
      <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
        <div className="flex gap-2 items-start">
          <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-bold mb-2">📖 Como Funciona:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Clique em Shopee ou Mercado Livre</li>
              <li>Selecione quantos pedidos quer processar (SEM LIMITE)</li>
              <li>Sistema busca apenas pedidos com etiqueta REAL pronta</li>
              <li>Pedidos SEM etiqueta são pulados automaticamente</li>
              <li>Cada arquivo tem: DANFE + Etiqueta REAL + SKU Vinculado</li>
              <li>Baixa em ZIP pronto para imprimir</li>
              <li>Relatório mostra quantos erros tivemos</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Botões Marketplace */}
      {token && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Shopee */}
          <button
            onClick={() => handleAbrirModal('SHOPEE')}
            className="bg-gradient-to-br from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-lg p-4 sm:p-8 shadow-xl transition transform hover:scale-105"
          >
            <div className="flex items-center gap-4 mb-4">
              <Printer size={40} />
              <div className="text-left">
                <p className="text-2xl font-bold">Shopee</p>
                <p className="text-sm text-orange-100">Com Etiqueta</p>
              </div>
            </div>
            <p className="text-sm text-orange-100 text-left">
              Processa pedidos da Shopee com etiqueta REAL vinculada ao ERP
            </p>
          </button>

          {/* Mercado Livre */}
          <button
            onClick={() => handleAbrirModal('MERCADO_LIVRE')}
            className="bg-gradient-to-br from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white rounded-lg p-4 sm:p-8 shadow-xl transition transform hover:scale-105"
          >
            <div className="flex items-center gap-4 mb-4">
              <Printer size={40} />
              <div className="text-left">
                <p className="text-2xl font-bold">Mercado Livre</p>
                <p className="text-sm text-yellow-100">Com Etiqueta</p>
              </div>
            </div>
            <p className="text-sm text-yellow-100 text-left">
              Processa pedidos do Mercado Livre com etiqueta REAL vinculada ao ERP
            </p>
          </button>
        </div>
      )}

      {/* Benefícios */}
      <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
        <p className="font-bold text-green-900 mb-3 text-lg">✨ Diferenciais:</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-green-900">
          <div className="flex gap-2">
            <span className="text-xl">📊</span>
            <div>
              <p className="font-semibold">SEM Limite</p>
              <p className="text-xs text-green-700">
                Processe 1 a 10.000+ pedidos em uma rodada
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <span className="text-xl">🎯</span>
            <div>
              <p className="font-semibold">Filtro Automático</p>
              <p className="text-xs text-green-700">
                Apenas pedidos com etiqueta REAL pronta
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <span className="text-xl">📦</span>
            <div>
              <p className="font-semibold">Arquivo Consolidado</p>
              <p className="text-xs text-green-700">
                DANFE + Etiqueta REAL + SKU ERP juntos
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <span className="text-xl">📈</span>
            <div>
              <p className="font-semibold">Relatório Completo</p>
              <p className="text-xs text-green-700">
                Sucesso/Erros detalhados por pedido
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <span className="text-xl">📥</span>
            <div>
              <p className="font-semibold">Download Direto</p>
              <p className="text-xs text-green-700">
                ZIP pronto para impressão em um clique
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <span className="text-xl">🔗</span>
            <div>
              <p className="font-semibold">SKU Vinculado</p>
              <p className="text-xs text-green-700">
                Produtos vinculados ao ERP automaticamente
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <details className="bg-slate-50 border-2 border-slate-300 rounded-lg">
        <summary className="p-4 font-bold text-slate-900 cursor-pointer hover:bg-slate-100 transition flex items-center gap-2">
          <Plus size={20} /> Perguntas Frequentes (Clique para expandir)
        </summary>
        <div className="p-4 space-y-4 text-sm text-slate-700 border-t-2 border-slate-300">
          <div>
            <p className="font-bold text-slate-900">
              O que acontece com pedidos SEM etiqueta?
            </p>
            <p className="mt-1 text-slate-600">
              ✅ Eles são automaticamente PULADOS e não aparecem no resultado final. No
              relatório, aparecem listados como "Etiqueta não disponível".
            </p>
          </div>

          <div>
            <p className="font-bold text-slate-900">
              Posso processar todos os meus pedidos?
            </p>
            <p className="mt-1 text-slate-600">
              ✅ SIM! Não há limite. Você seleciona quantos quiser (10, 100, 1.000+) e o sistema
              processa tudo.
            </p>
          </div>

          <div>
            <p className="font-bold text-slate-900">
              De onde vem a etiqueta?
            </p>
            <p className="mt-1 text-slate-600">
              ✅ A etiqueta vem REAL da Shopee/Mercado Livre, passa pelo Bling e é
              automaticamente vinculada ao SKU do seu ERP.
            </p>
          </div>

          <div>
            <p className="font-bold text-slate-900">O SKU é vinculado automaticamente?</p>
            <p className="mt-1 text-slate-600">
              ✅ SIM! O sistema procura o SKU da etiqueta (da Shopee) no seu banco de dados do
              ERP e vincula automaticamente. Se não encontrar, mostra "N/A".
            </p>
          </div>

          <div>
            <p className="font-bold text-slate-900">
              Qual é a diferença para o Bling?
            </p>
            <p className="mt-1 text-slate-600">
              ✅ É exatamente o mesmo processo que o Bling usa, mas integrado direto no ERP
              para mais facilidade, sem limite de pedidos, e com vinculação automática ao SKU.
            </p>
          </div>

          <div>
            <p className="font-bold text-slate-900">
              Quanto tempo leva para processar?
            </p>
            <p className="mt-1 text-slate-600">
              ⚡ ~500ms por pedido. Então 50 pedidos = ~25 segundos. 100 pedidos = ~50 segundos.
            </p>
          </div>
        </div>
      </details>

      {/* Modal */}
      <ModalDanfeEtiquetaReal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
        }}
        token={token}
        marketplace={marketplace}
        addToast={addToast}
      />
    </div>
  );
};

export default AbaDanfeEtiquetaProntoUso;
