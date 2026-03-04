// ============================================================================
// usePacotesProtos.ts - Hook Customizado para Gerenciar Pacotes Prontos
// Integra com Supabase e Bling API
// ============================================================================

import { useState, useCallback, useEffect, useMemo } from 'react';
// import { supabase } from '../services/supabaseClient'; // TODO: Descomentar quando disponível
// import { blingApi } from '../services/blingApi'; // TODO: Descomentar quando disponível

interface PacoteProto {
    id: string;
    nome: string;
    sku_primario: string;
    quantidade_total: number;
    quantidade_disponivel: number;
    quantidade_reservada: number;
    localizacao: string;
    status: 'PRONTO' | 'RESERVADO' | 'EXPEDIDO' | 'DEVOLVIDO';
    data_preparacao: number;
    data_disponibilidade: number;
    operador: string;
    observacoes?: string;
    produtos: Array<{
        sku: string;
        nome: string;
        quantidade: number;
    }>;
}

interface UsePacotosProtosReturn {
    pacotes: PacoteProto[];
    isLoading: boolean;
    error: string | null;
    
    // Operações CRUD
    criarPacote: (pacote: Omit<PacoteProto, 'id'>) => Promise<PacoteProto>;
    editarPacote: (id: string, updates: Partial<PacoteProto>) => Promise<PacoteProto>;
    deletarPacote: (id: string) => Promise<void>;
    
    // Operações específicas
    moverPacote: (id: string, novaLocalizacao: string) => Promise<void>;
    marcarComoExpedido: (id: string) => Promise<void>;
    marcarComoDevolvido: (id: string) => Promise<void>;
    
    // Carregamento de dados
    carregarPacotes: () => Promise<void>;
    
    // Filtragem
    pacotesFiltrados: (filtros: {
        status?: string;
        localizacao?: string;
        busca?: string;
    }) => PacoteProto[];
}

export const usePacotesProtos = (): UsePacotosProtosReturn => {
    const [pacotes, setPacotes] = useState<PacoteProto[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Carregar todos os pacotes
    const carregarPacotes = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            // ✅ Implementado com dbClient (Supabase)
            const { data, error: err } = await dbClient
                .from('estoque_pronto')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (err) throw err;
            
            const pacotesFormatados = (data || []).map((p: any) => ({
                id: p.id,
                nome: p.batch_id || 'Pacote',
                sku_primario: p.lote_numero || p.stock_item_id || '',
                quantidade_total: Number(p.quantidade_total || 0),
                quantidade_disponivel: Number(p.quantidade_disponivel || 0),
                quantidade_reservada: Number(p.quantidade_total || 0) - Number(p.quantidade_disponivel || 0),
                localizacao: p.localizacao || '',
                status: p.status || 'PRONTO',
                data_preparacao: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
                data_disponibilidade: p.updated_at ? new Date(p.updated_at).getTime() : Date.now(),
                operador: p.created_by || 'Sistema',
                observacoes: p.observacoes || '',
                produtos: p.produtos || []
            }));
            
            setPacotes(pacotesFormatados);
            console.log(`✅ ${pacotesFormatados.length} pacotes carregados`);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao carregar pacotes';
            setError(message);
            console.error('Erro ao carregar pacotes:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Criar novo pacote
    const criarPacote = useCallback(async (novosPacote: Omit<PacoteProto, 'id'>) => {
        try {
            console.log('💾 Salvando novo pacote...', novosPacote);
            
            // ✅ Implementado para Supabase com dbClient
            const novoRegistro = {
                batch_id: novosPacote.nome,
                lote_numero: novosPacote.sku_primario,
                stock_item_id: novosPacote.sku_primario,
                quantidade_total: novosPacote.quantidade_total,
                quantidade_disponivel: novosPacote.quantidade_disponivel,
                localizacao: novosPacote.localizacao,
                status: novosPacote.status,
                observacoes: novosPacote.observacoes || '',
                produtos: novosPacote.produtos || [],
                created_by: novosPacote.operador
            };
            
            const { data, error: err } = await dbClient
                .from('estoque_pronto')
                .insert([novoRegistro])
                .select()
                .single();
            
            if (err) throw err;
            
            const pacoteCriado: PacoteProto = {
                id: data.id,
                ...novosPacote
            };
            
            setPacotes(prev => [pacoteCriado, ...prev]);
            console.log(`✅ Pacote criado: ${pacoteCriado.id}`);
            return pacoteCriado;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao criar pacote';
            setError(message);
            throw err;
        }
    }, []);

    // Editar pacote
    const editarPacote = useCallback(async (id: string, updates: Partial<PacoteProto>) => {
        try {
            // TODO: Implementar com Supabase
            /*
            const { data, error: err } = await supabase
                .from('estoque_pronto')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            
            if (err) throw err;
            setPacotes(prev => prev.map(p => p.id === id ? data : p));
            return data;
            */
            
            const pacote = pacotes.find(p => p.id === id);
            if (!pacote) throw new Error('Pacote não encontrado');
            
            const updated = { ...pacote, ...updates };
            setPacotes(prev => prev.map(p => p.id === id ? updated : p));
            return updated;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao editar pacote';
            setError(message);
            throw err;
        }
    }, [pacotes]);

    // Deletar pacote
    const deletarPacote = useCallback(async (id: string) => {
        try {
            console.log('🗑️  Deletando pacote:', id);
            
            // ✅ Implementado para Supabase com dbClient
            const { error: err } = await dbClient
                .from('estoque_pronto')
                .delete()
                .eq('id', id);
            
            if (err) throw err;
            
            setPacotes(prev => prev.filter(p => p.id !== id));
            console.log(`✅ Pacote deletado: ${id}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao deletar pacote';
            setError(message);
            throw err;
        }
    }, []);

    // Mover pacote (alterar localização)
    const moverPacote = useCallback(async (id: string, novaLocalizacao: string) => {
        try {
            await editarPacote(id, { localizacao: novaLocalizacao });
            
            // TODO: Sincronizar com Bling se necessário
            // await blingApi.updatePackageLocation(id, novaLocalizacao);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao mover pacote';
            setError(message);
            throw err;
        }
    }, [editarPacote]);

    // Marcar como expedido
    const marcarComoExpedido = useCallback(async (id: string) => {
        try {
            await editarPacote(id, { 
                status: 'EXPEDIDO',
                data_disponibilidade: Date.now()
            });
            
            // TODO: Sincronizar com Bling
            // await blingApi.updatePackageStatus(id, 'expedido');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao marcar como expedido';
            setError(message);
            throw err;
        }
    }, [editarPacote]);

    // Marcar como devolvido
    const marcarComoDevolvido = useCallback(async (id: string) => {
        try {
            await editarPacote(id, { status: 'DEVOLVIDO' });
            
            // TODO: Sincronizar com Bling
            // await blingApi.updatePackageStatus(id, 'devolvido');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao marcar como devolvido';
            setError(message);
            throw err;
        }
    }, [editarPacote]);

    // Filtrar pacotes
    const pacotesFiltrados = useCallback((filtros: {
        status?: string;
        localizacao?: string;
        busca?: string;
    }) => {
        return pacotes.filter(p => {
            if (filtros.status && p.status !== filtros.status) return false;
            if (filtros.localizacao && p.localizacao !== filtros.localizacao) return false;
            if (filtros.busca) {
                const busca = filtros.busca.toLowerCase();
                return p.nome.toLowerCase().includes(busca) || 
                       p.sku_primario.toLowerCase().includes(busca);
            }
            return true;
        });
    }, [pacotes]);

    // Carregar ao montar
    useEffect(() => {
        carregarPacotes();
    }, [carregarPacotes]);

    return {
        pacotes,
        isLoading,
        error,
        criarPacote,
        editarPacote,
        deletarPacote,
        moverPacote,
        marcarComoExpedido,
        marcarComoDevolvido,
        carregarPacotes,
        pacotesFiltrados
    };
};

// ============================================================================
// useBlingItemsSync.ts - Hook Customizado para Sincronizar com Bling
// ============================================================================

interface PedidoItem {
    id: string;
    orderId: string;
    blingId?: string;
    sku: string;
    nome: string;
    quantidade: number;
    preco_unitario: number;
    preco_total: number;
    status: 'nao_sincronizado' | 'sincronizado' | 'erro' | 'pendente';
    data_criacao: number;
    ultima_sincronizacao?: number;
    erro_mensagem?: string;
}

interface BlingConfiguracao {
    sincronizar_automatico: boolean;
    atualizar_estoque: boolean;
    notificar_devolucoes: boolean;
}

interface UseBlingItemsSyncReturn {
    itens: PedidoItem[];
    isLoading: boolean;
    isSyncing: boolean;
    error: string | null;
    
    // Operações de sincronização
    sincronizarItens: (itemIds: string[]) => Promise<void>;
    sincronizarTodos: () => Promise<void>;
    baixarItensBlIng: () => Promise<void>;
    
    // Operações CRUD
    criarItem: (item: Omit<PedidoItem, 'id'>) => Promise<PedidoItem>;
    editarItem: (id: string, updates: Partial<PedidoItem>) => Promise<PedidoItem>;
    deletarItem: (id: string) => Promise<void>;
    
    // Carregamento
    carregarItens: () => Promise<void>;
    
    // Filtragem
    itensFiltrados: (filtros: {
        status?: string;
        orderId?: string;
        busca?: string;
    }) => PedidoItem[];
    
    // Configuração
    salvarConfiguracao: (config: BlingConfiguracao) => Promise<void>;
    carregarConfiguracao: () => Promise<BlingConfiguracao>;
}

export const useBlingItemsSync = (): UseBlingItemsSyncReturn => {
    const [itens, setItens] = useState<PedidoItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Carregar itens
    const carregarItens = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            // TODO: Implementar com Supabase/Bling
            /*
            const { data, error: err } = await supabase
                .from('order_items')
                .select('*')
                .order('data_criacao', { ascending: false });
            
            if (err) throw err;
            setItens(data || []);
            */
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao carregar itens';
            setError(message);
            console.error('Erro ao carregar itens:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Sincronizar itens com Bling
    const sincronizarItens = useCallback(async (itemIds: string[]) => {
        try {
            setIsSyncing(true);
            setError(null);
            
            // TODO: Implementar com Bling API
            /*
            for (const itemId of itemIds) {
                const item = itens.find(i => i.id === itemId);
                if (!item) continue;
                
                try {
                    const response = await blingApi.createOrUpdateItem({
                        sku: item.sku,
                        nome: item.nome,
                        quantidade: item.quantidade,
                        preco: item.preco_unitario
                    });
                    
                    setItens(prev => prev.map(i => i.id === itemId 
                        ? {
                            ...i,
                            blingId: response.id,
                            status: 'sincronizado',
                            ultima_sincronizacao: Date.now()
                        }
                        : i
                    ));
                } catch (itemErr) {
                    setItens(prev => prev.map(i => i.id === itemId
                        ? {
                            ...i,
                            status: 'erro',
                            erro_mensagem: itemErr instanceof Error ? itemErr.message : 'Erro desconhecido'
                        }
                        : i
                    ));
                }
            }
            */
            
            // Simulação
            setItens(prev => prev.map(i => 
                itemIds.includes(i.id) && i.status !== 'sincronizado'
                    ? { ...i, status: 'sincronizado', ultima_sincronizacao: Date.now() }
                    : i
            ));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao sincronizar';
            setError(message);
            throw err;
        } finally {
            setIsSyncing(false);
        }
    }, [itens]);

    // Sincronizar todos os itens não sincronizados
    const sincronizarTodos = useCallback(async () => {
        const naoSincronizados = itens
            .filter(i => i.status !== 'sincronizado')
            .map(i => i.id);
        
        if (naoSincronizados.length > 0) {
            await sincronizarItens(naoSincronizados);
        }
    }, [itens, sincronizarItens]);

    // Baixar itens do Bling
    const baixarItensBlIng = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            // TODO: Implementar com Bling API
            /*
            const blingItens = await blingApi.getItems();
            
            // Comparar e atualizar com o banco local
            for (const blingItem of blingItens) {
                const itemLocal = itens.find(i => i.blingId === blingItem.id);
                
                if (itemLocal) {
                    // Item já existe, atualizar status
                    setItens(prev => prev.map(i => i.id === itemLocal.id
                        ? { ...i, status: 'sincronizado' }
                        : i
                    ));
                } else {
                    // Novo item do Bling, adicionar
                    const novoItem: PedidoItem = {
                        id: `bling_${blingItem.id}`,
                        orderId: blingItem.orderId,
                        blingId: blingItem.id,
                        sku: blingItem.sku,
                        nome: blingItem.nome,
                        quantidade: blingItem.quantidade,
                        preco_unitario: blingItem.preco,
                        preco_total: blingItem.total,
                        status: 'sincronizado',
                        data_criacao: Date.now(),
                        ultima_sincronizacao: Date.now()
                    };
                    setItens(prev => [...prev, novoItem]);
                }
            }
            */
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao baixar do Bling';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [itens]);

    // Criar item
    const criarItem = useCallback(async (novoItem: Omit<PedidoItem, 'id'>) => {
        try {
            // TODO: Implementar com Supabase
            const item: PedidoItem = { id: Date.now().toString(), ...novoItem };
            setItens(prev => [...prev, item]);
            return item;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao criar item';
            setError(message);
            throw err;
        }
    }, []);

    // Editar item
    const editarItem = useCallback(async (id: string, updates: Partial<PedidoItem>) => {
        try {
            const item = itens.find(i => i.id === id);
            if (!item) throw new Error('Item não encontrado');
            
            const updated = { ...item, ...updates };
            setItens(prev => prev.map(i => i.id === id ? updated : i));
            return updated;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao editar item';
            setError(message);
            throw err;
        }
    }, [itens]);

    // Deletar item
    const deletarItem = useCallback(async (id: string) => {
        try {
            setItens(prev => prev.filter(i => i.id !== id));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao deletar item';
            setError(message);
            throw err;
        }
    }, []);

    // Filtrar itens
    const itensFiltrados = useCallback((filtros: {
        status?: string;
        orderId?: string;
        busca?: string;
    }) => {
        return itens.filter(i => {
            if (filtros.status && i.status !== filtros.status) return false;
            if (filtros.orderId && i.orderId !== filtros.orderId) return false;
            if (filtros.busca) {
                const busca = filtros.busca.toLowerCase();
                return i.sku.toLowerCase().includes(busca) ||
                       i.nome.toLowerCase().includes(busca) ||
                       i.orderId.toLowerCase().includes(busca);
            }
            return true;
        });
    }, [itens]);

    // Salvar configuração
    const salvarConfiguracao = useCallback(async (config: BlingConfiguracao) => {
        try {
            // TODO: Salvar no localStorage ou Supabase
            localStorage.setItem('bling_config', JSON.stringify(config));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Erro ao salvar configuração';
            setError(message);
            throw err;
        }
    }, []);

    // Carregar configuração
    const carregarConfiguracao = useCallback(async (): Promise<BlingConfiguracao> => {
        try {
            const stored = localStorage.getItem('bling_config');
            return stored ? JSON.parse(stored) : {
                sincronizar_automatico: false,
                atualizar_estoque: true,
                notificar_devolucoes: true
            };
        } catch (err) {
            console.error('Erro ao carregar configuração:', err);
            return {
                sincronizar_automatico: false,
                atualizar_estoque: true,
                notificar_devolucoes: true
            };
        }
    }, []);

    // Carregar ao montar
    useEffect(() => {
        carregarItens();
    }, [carregarItens]);

    return {
        itens,
        isLoading,
        isSyncing,
        error,
        sincronizarItens,
        sincronizarTodos,
        baixarItensBlIng,
        criarItem,
        editarItem,
        deletarItem,
        carregarItens,
        itensFiltrados,
        salvarConfiguracao,
        carregarConfiguracao
    };
};
