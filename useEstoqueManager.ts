// ============================================================================
// useEstoqueManager.ts - Hook para gerenciar Estoque Pronto
// Adicione ao projeto: src/hooks/useEstoqueManager.ts
// ============================================================================

import { useState, useCallback } from 'react';
// import { supabase } from '@/lib/supabase'; // Descomente e ajuste conforme seu projeto

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

    // Buscar estoque do Bling
    const handleFetchStock = useCallback(async () => {
        try {
            setIsLoadingStock(true);
            
            // TODO: Integrar com API do Bling
            // Este é um exemplo - ajuste com seus dados reais
            const response = await fetch('/api/bling/estoque');
            const data = await response.json();
            
            if (data && Array.isArray(data)) {
                setStockItems(data);
            }
            
        } catch (error) {
            console.error('Erro ao buscar estoque:', error);
            alert('Erro ao sincronizar. Verifique o console.');
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
            
            // TODO: Registrar movimento no banco Supabase
            // const { data: movement, error: movError } = await supabase
            //     .from('stock_movements')
            //     .insert([
            //         {
            //             id: `mov_${Date.now()}_${Math.random()}`,
            //             stock_item_id: stockItem.id,
            //             quantity,
            //             movement_type: adjustOp === 'B' ? 'BALANÇO' : adjustOp === 'E' ? 'ENTRADA' : 'SAÍDA',
            //             origin: 'BLING_SINCRONIZADO',
            //             description: `Ajuste ${adjustOp === 'B' ? 'Balanço' : adjustOp === 'E' ? 'Entrada' : 'Saída'} - ${stockItem.codigo}`,
            //             observations: adjustObs,
            //             created_at: Date.now()
            //         }
            //     ]);

            // if (movError) throw movError;

            // TODO: Sincronizar com Bling API
            
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
