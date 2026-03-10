// ============================================================================
// useEstoqueManager.ts - Hook para gerenciar Estoque Pronto
// Adicione ao projeto: src/hooks/useEstoqueManager.ts
// ============================================================================

import { useState, useCallback } from 'react';
import { dbClient } from './lib/supabaseClient';

interface StockItem {
    id: string;
    codigo: string;
    descricao: string;
    saldoFisico: number;
    saldoVirtual: number;
    preco?: number;
    bling_sku?: string;
    readyQty?: number;
    reserved_qty?: number;
    ready_location?: string;
}

interface AdjustStockModal {
    item: StockItem;
}

interface EstoqueProto {
    id: string;
    stock_item_id: string;
    batch_id: string;
    quantidade_total: number;
    quantidade_disponivel: number;
    localizacao: string;
    status: 'PRONTO' | 'RESERVADO' | 'EXPEDIDO' | 'DEVOLVIDO';
    data_disponibilidade: number;
}

export const useEstoqueManager = () => {
    // Estados
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [isLoadingStock, setIsLoadingStock] = useState(false);
    const [isSavingAdjust, setIsSavingAdjust] = useState(false);

    // Filtros e abas
    const [stockTab, setStockTab] = useState<'todos' | 'pronto' | 'movimentos' | 'comparacao'>('todos');
    const [stockSearch, setStockSearch] = useState('');
    const [stockFilter, setStockFilter] = useState<'todos' | 'zerado' | 'baixo' | 'ok' | 'divergente'>('todos');
    const [stockSort, setStockSort] = useState<'sku' | 'nome' | 'fisico_asc' | 'fisico_desc'>('sku');

    // Modal
    const [adjustStockModal, setAdjustStockModal] = useState<AdjustStockModal | null>(null);
    const [adjustQty, setAdjustQty] = useState('');
    const [adjustOp, setAdjustOp] = useState<'B' | 'E' | 'S'>('B');
    const [adjustObs, setAdjustObs] = useState('');

    // Mapa auxiliar para comparação
    const erpStockMap = new Map<string, number>();

    // Buscar estoque (Sincronizado via App.tsx, mas provendo hook local)
    const handleFetchStock = useCallback(async () => {
        try {
            setIsLoadingStock(true);

            // ✅ Carrega diretamente do banco de dados local (stock_items)
            const { data, error } = await dbClient
                .from('stock_items')
                .select('*')
                .order('code', { ascending: true });

            if (error) throw error;

            if (data && Array.isArray(data)) {
                const mapped = data.map((i: any) => ({
                    id: i.id,
                    codigo: i.code,
                    descricao: i.name,
                    saldoFisico: Number(i.current_qty || 0),
                    saldoVirtual: Number(i.current_qty || 0),
                    bling_sku: i.code,
                    readyQty: Number(i.ready_qty || 0),
                    reserved_qty: Number(i.reserved_qty || 0),
                    ready_location: i.category || ''
                }));
                setStockItems(mapped);
            }

        } catch (error) {
            console.error('Erro ao buscar estoque:', error);
        } finally {
            setIsLoadingStock(false);
        }
    }, []);

    // Ajustar estoque
    const handleAdjustStock = useCallback(async () => {
        if (!adjustStockModal || !adjustQty) return;

        try {
            setIsSavingAdjust(true);

            const stockItem = adjustStockModal.item;
            const quantity = parseFloat(adjustQty);

            // ✅ Registrar movimento no banco Supabase utilizando a RPC adjust_stock_quantity
            const { error: movError } = await dbClient.rpc('adjust_stock_quantity', {
                item_code: stockItem.codigo,
                quantity_delta: adjustOp === 'S' ? -quantity : (adjustOp === 'B' ? (quantity - stockItem.saldoFisico) : quantity),
                origin_text: 'AJUSTE_MANUAL',
                ref_text: adjustObs || `Ajuste manual via Gerenciador`,
                user_name: 'Usuário' // TODO: Pegar do Contexto no componente se possível
            });

            if (movError) throw movError;

            // Atualizar estoque local
            setStockItems(prev =>
                prev.map(item =>
                    item.id === stockItem.id
                        ? {
                            ...item,
                            saldoFisico: adjustOp === 'B' ? quantity :
                                adjustOp === 'E' ? (item.saldoFisico || 0) + quantity :
                                    Math.max(0, (item.saldoFisico || 0) - quantity)
                        }
                        : item
                )
            );

            setAdjustStockModal(null);
            setAdjustQty('');
            setAdjustOp('B');
            setAdjustObs('');

            alert('✅ Ajuste realizado com sucesso!');

        } catch (error) {
            console.error('Erro ao ajustar estoque:', error);
            alert('❌ Erro ao ajustar. Verifique o console.');
        } finally {
            setIsSavingAdjust(false);
        }
    }, [adjustStockModal, adjustQty, adjustOp, adjustObs]);

    // Carregar estoque pronto
    const loadEstoqueProto = useCallback(async () => {
        try {
            // TODO: Implementar carregamento do Supabase
            // const { data, error } = await supabase
            //     .from('estoque_pronto')
            //     .select('*')
            //     .eq('status', 'PRONTO');

            // if (error) throw error;

            // if (data) {
            //     setStockItems(prev => 
            //         prev.map(item => {
            //             const pronto = data.find(p => p.stock_item_id === item.id);
            //             return {
            //                 ...item,
            //                 readyQty: pronto?.quantidade_total || 0,
            //                 ready_location: pronto?.localizacao || ''
            //             };
            //         })
            //     );
            // }
        } catch (error) {
            console.error('Erro ao carregar estoque pronto:', error);
        }
    }, []);

    return {
        // Estados
        stockItems,
        isLoadingStock,
        isSavingAdjust,

        // Filtros
        stockTab,
        setStockTab,
        stockSearch,
        setStockSearch,
        stockFilter,
        setStockFilter,
        stockSort,
        setStockSort,

        // Modal
        adjustStockModal,
        setAdjustStockModal,
        adjustQty,
        setAdjustQty,
        adjustOp,
        setAdjustOp,
        adjustObs,
        setAdjustObs,

        // Funções
        handleFetchStock,
        handleAdjustStock,
        loadEstoqueProto,
        erpStockMap
    };
};
