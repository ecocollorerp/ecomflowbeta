// ============================================================================
// components/ListaItensPedido.tsx - Lista de Itens do Pedido (IGUAL AO BLING)
// Exibe SKU, Descrição, Un, Qtd, Vlr Unit., Subtotal - Idêntico ao Bling
// ============================================================================

import React, { useEffect, useState } from 'react';
import { Tag, Loader2, AlertCircle } from 'lucide-react';

interface ItemPedido {
  id: string;
  order_id: string;
  bling_id: string;
  sku: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
  status: string;
}

interface ListaItensPedidoProps {
  orderId: string;
  blingOrderId?: string;
  itens?: ItemPedido[];
  isLoading?: boolean;
  onSync?: (orderId: string) => Promise<void>;
}

export const ListaItensPedido: React.FC<ListaItensPedidoProps> = ({
  orderId,
  blingOrderId,
  itens = [],
  isLoading = false,
  onSync,
}) => {
  const [itensMostrados, setItensMostrados] = useState<ItemPedido[]>(itens);
  const [isLoadingLocal, setIsLoadingLocal] = useState(isLoading);

  useEffect(() => {
    setItensMostrados(itens);
  }, [itens]);

  useEffect(() => {
    setIsLoadingLocal(isLoading);
  }, [isLoading]);

  return (
    <div className="space-y-3">
      {/* Header com Título e Botão */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black text-yellow-600 uppercase tracking-widest flex items-center gap-1">
          <Tag size={10} /> Itens do Pedido ({itensMostrados.length})
        </p>
        {onSync && (
          <button
            onClick={() => onSync(blingOrderId || orderId)}
            disabled={isLoadingLocal}
            className="px-2 py-1 text-[9px] font-black bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-all disabled:opacity-50"
          >
            {isLoadingLocal ? <Loader2 className="inline animate-spin mr-1" size={10} /> : null}
            {isLoadingLocal ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        )}
      </div>

      {/* Loading */}
      {isLoadingLocal ? (
        <div className="py-4 text-center">
          <Loader2 className="inline animate-spin text-yellow-600 mb-2" size={16} />
          <p className="text-[9px] text-gray-600 font-bold">Carregando itens...</p>
        </div>
      ) : itensMostrados.length === 0 ? (
        <div className="py-3 text-center bg-yellow-50 rounded text-[9px] text-gray-600 font-bold border border-yellow-100">
          <AlertCircle className="inline mr-1" size={12} />
          Nenhum item. Clique em "Sincronizar" para buscar do Bling.
        </div>
      ) : (
        <>
          {/* Tabela - EXATAMENTE IGUAL AO BLING */}
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] font-black text-slate-400 uppercase">
                {['SKU', 'Descrição', 'Un', 'Qtd', 'Vlr Unit.', 'Subtotal'].map((h) => (
                  <th key={h} className="text-left pb-1 pr-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-yellow-100">
              {itensMostrados.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-yellow-100/40">
                  <td className="py-1.5 pr-4 font-mono font-bold text-yellow-800">{item.sku || '-'}</td>
                  <td className="py-1.5 pr-4 text-slate-700 max-w-[240px] truncate">{item.descricao || '-'}</td>
                  <td className="py-1.5 pr-4 text-slate-400 text-[9px]">{item.unidade || 'UN'}</td>
                  <td className="py-1.5 pr-4 font-black text-center">{item.quantidade ?? '-'}</td>
                  <td className="py-1.5 pr-4 font-bold text-emerald-700">
                    {Number(item.valor_unitario || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="py-1.5 pr-4 font-black text-emerald-800">
                    {Number(item.subtotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default ListaItensPedido;
