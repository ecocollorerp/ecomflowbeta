// ============================================================================
// DANFEManagerPage.tsx - Página de Gestão de DANFE integrada ao Bling
// ============================================================================

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { DANFEGerenciador } from '../components/DANFEGerenciador';
import { ListaItensPedido } from '../components/ListaItensPedido';
import { FileText, AlertCircle, CheckCircle, Package, Loader2, Eye, ZapOff, Zap, Clock } from 'lucide-react';
import { gerarEtiquetaDANFE } from '../services/zplService';
import { syncBlingItems, useSyncBlingItems } from '../services/syncBlingItems';
import { dbClient } from '../lib/supabaseClient';

interface NotaFiscal {
  id: string;
  numero: string;
  chave: string;
  pedidoId: string;
  pedidoNumero: string;
  cliente: string;
  cpfCnpj: string;
  endereco: string;
  numeroEndereco: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  valor: number;
  peso?: number;
  status: 'emitida' | 'autorizada' | 'enviada' | 'pendente' | 'erro';
  dataEmissao: number;
  dataAutorizacao?: number;
  erroMsg?: string;
  xmlUrl?: string;
  pdfUrl?: string;
  canal?: string;
  pedidoLoja?: string;
}

interface DANFEManagerPageProps {
  addToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export const DANFEManagerPage: React.FC<DANFEManagerPageProps> = ({ addToast }) => {
  const [danfes, setDANFEs] = useState<any[]>([]);
  const [notasFiscais, setNotasFiscais] = useState<NotaFiscal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('danfe');
  const [itensPorPedido, setItensPorPedido] = useState<{ [key: string]: any[] }>({});
  const [danfeEmCorrecao, setDanfeEmCorrecao] = useState<any | null>(null);
  const [lotesDiarios, setLotesDiarios] = useState<any[]>([]);
  const { isSyncing, sincronizar: sincronizarItens } = useSyncBlingItems();

  const [limiteNfe, setLimiteNfe] = useState<number>(200);
  const [skuFilter, setSkuFilter] = useState('');

  // Carregar DANFE e NF-e
  useEffect(() => {
    carregarDados();
    // Sincronizar itens automaticamente a cada 5 minutos
    const interval = setInterval(() => {
      sincronizarItensAutomatico();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [limiteNfe]); // Recarrega se alterar o limite

  // Carregar Lotes Diários da Memória
  useEffect(() => {
    if (activeTab === 'lotes') {
      try {
        const locally = JSON.parse(localStorage.getItem('nfe_lotes_diarios') || '[]');
        setLotesDiarios(locally);
      } catch (e) {
        console.error('Erro ao ler lotes do localStorage:', e);
      }
    }
  }, [activeTab]);

  const carregarDados = async () => {
    try {
      setIsLoading(true);

      const token = localStorage.getItem('bling_token');
      if (!token) throw new Error('Token Bling não encontrado');

      // Buscar pedidos de vendas para pegar NF-e COM limite aberto
      const response = await fetch(`/api/bling/pedidos/vendas?limit=${limiteNfe}`, {
        headers: { Authorization: token },
      });

      if (!response.ok) throw new Error('Erro ao buscar pedidos');

      const data = await response.json();
      const pedidos = data.data || [];

      // Mapear notas fiscais dos pedidos
      const notasFiscaisMap = pedidos
        .filter((p: any) => p.notaFiscal || p.nfe)
        .map((p: any) => {
          const nfe = p.notaFiscal || p.nfe;
          return {
            id: nfe.id || p.id,
            numero: nfe.numero || '',
            chave: nfe.chave || nfe.chaveAcesso || '',
            pedidoId: p.id,
            pedidoNumero: p.numero,
            cliente: p.contato?.nome || 'N/A',
            cpfCnpj: p.contato?.numeroDocumento || '',
            endereco: p.enderecoEntrega?.endereco || '',
            numeroEndereco: p.enderecoEntrega?.numero || '',
            complemento: p.enderecoEntrega?.complemento,
            bairro: p.enderecoEntrega?.bairro || '',
            cidade: p.enderecoEntrega?.municipio?.nome || '',
            uf: p.enderecoEntrega?.municipio?.uf || '',
            cep: p.enderecoEntrega?.cep || '',
            valor: p.total || 0,
            peso: nfe.peso,
            status: nfe.status || 'emitida',
            dataEmissao: new Date(nfe.dataEmissao || Date.now()).getTime(),
            dataAutorizacao: nfe.dataAutorizacao ? new Date(nfe.dataAutorizacao).getTime() : undefined,
            erroMsg: nfe.erroMsg,
            xmlUrl: nfe.xmlUrl,
            pdfUrl: nfe.pdfUrl,
            canal: p.loja?.nome || p.origem || '',
            pedidoLoja: p.numeroLoja || p.intermediador?.numeroPedido || '',
          };
        });

      setNotasFiscais(notasFiscaisMap);

      // Conversão inicial para DANFE
      const danfesMap = notasFiscaisMap.map((nf: NotaFiscal) => ({
        id: nf.id,
        nfeNumero: nf.numero,
        nfeChave: nf.chave,
        pedidoId: nf.pedidoId,
        pedidoNumero: nf.pedidoNumero,
        cliente: nf.cliente,
        status: nf.status,
        dataEmissao: nf.dataEmissao,
        dataAutorizacao: nf.dataAutorizacao,
        valor: nf.valor,
        observacoes: nf.erroMsg,
        xmlUrl: nf.xmlUrl,
        pdfUrl: nf.pdfUrl,
        canal: nf.canal,
        pedidoLoja: nf.pedidoLoja,
      }));
      setDANFEs(danfesMap);

      // Enriquecer com dados do Supabase (Lote e Pedido Loja) em background
      (async () => {
        try {
          const blingNumeros = [...new Set(notasFiscaisMap.map(nf => nf.pedidoNumero).filter(Boolean))];
          if (blingNumeros.length > 0) {
            const { data: dbOrders } = await dbClient
              .from('orders')
              .select('bling_numero, id_pedido_loja, venda_origem')
              .in('bling_numero', blingNumeros);

            if (dbOrders && dbOrders.length > 0) {
              setDANFEs(prev => prev.map(nf => {
                const matched = dbOrders.find(dbo => dbo.bling_numero === nf.pedidoNumero);
                if (matched) {
                  return {
                    ...nf,
                    pedidoLoja: matched.id_pedido_loja || nf.pedidoLoja,
                    canal: matched.venda_origem || nf.canal
                  };
                }
                return nf;
              }));
            }
          }
        } catch (e) {
          console.error('Erro ao enriquecer dados com Supabase:', e);
        }
      })();
      addToast(`${danfesMap.length} NF-e(s) carregada(s). Sincronizando SKUs em segundo plano...`, 'info');

      // Buscar Intens IMEDIATAMENTE em background (P/ filtro de SKU)
      (async () => {
        const itensMap: { [key: string]: any[] } = {};
        // Processar em chunks para não dar Rate Limit 429
        const chunkSize = 10;
        for (let i = 0; i < notasFiscaisMap.length; i += chunkSize) {
          const chunk = notasFiscaisMap.slice(i, i + chunkSize);

          await Promise.all(chunk.map(async (nf) => {
            try {
              // Tenta puxar via sync
              const result = await syncBlingItems.sincronizarPedido(nf.pedidoId, nf.id, token);
              if (result.sucesso && result.itens) {
                itensMap[nf.pedidoId] = result.itens;
              }
            } catch (e) {
              // Silencioso pro usuário, só avisa no console
            }
          }));

          // Atualiza na tela a cada lote de 10 pra aliviar o loading e habilitar o filtro
          setItensPorPedido(prev => ({ ...prev, ...itensMap }));

          if (i + chunkSize < notasFiscaisMap.length) {
            await new Promise(res => setTimeout(res, 600)); // Sleep de Rate limit
          }
        }
        addToast(`SKUs sincronizados com sucesso! Filtragem disponível.`, 'success');
      })();

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      addToast(`Erro ao carregar DANFE: ${error instanceof Error ? error.message : 'erro'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Sincronizar itens automaticamente
  const sincronizarItensAutomatico = async () => {
    try {
      const token = localStorage.getItem('bling_token');
      if (!token) return;

      if (notasFiscais && notasFiscais.length > 0) {
        for (const nf of notasFiscais.slice(0, 10)) {
          try {
            const resultado = await syncBlingItems.sincronizarPedido(nf.pedidoId, nf.id, token);
            if (resultado.sucesso) {
              setItensPorPedido(prev => ({
                ...prev,
                [nf.pedidoId]: resultado.itens || []
              }));
            }
          } catch (error) {
            console.error(`Erro ao sincronizar itens do pedido ${nf.pedidoId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao sincronizar itens automaticamente:', error);
    }
  };

  // Handler para sincronizar itens de um pedido específico
  const handleSincronizarItens = async (orderId: string) => {
    try {
      const nf = notasFiscais?.find(n => n.pedidoId === orderId);
      const token = localStorage.getItem('bling_token');

      if (!token) {
        addToast('Token Bling não configurado', 'error');
        return;
      }

      if (!nf) {
        addToast('Nota fiscal não encontrada', 'error');
        return;
      }

      const resultado = await syncBlingItems.sincronizarPedido(orderId, nf.id, token);

      if (resultado.sucesso) {
        setItensPorPedido(prev => ({
          ...prev,
          [orderId]: resultado.itens || []
        }));
        addToast(`${resultado.itens?.length || 0} itens sincronizados`, 'success');
      } else {
        addToast(`Erro: ${resultado.erro || 'Erro desconhecido'}`, 'error');
      }
    } catch (error) {
      console.error('Erro ao sincronizar itens:', error);
      addToast('Erro ao sincronizar itens. Verifique a conexão.', 'error');
    }
  };

  // Imprimir DANFE
  const handleImprimir = useCallback((danfe: any) => {
    // Abrir PDF se disponível
    if (danfe.pdfUrl) {
      window.open(danfe.pdfUrl, '_blank');
      addToast('Abrindo DANFE em PDF...', 'info');
    } else {
      addToast('PDF da DANFE não disponível', 'error');
    }
  }, [addToast]);

  // Download XML
  const handleDownloadXML = useCallback((danfe: any) => {
    if (danfe.xmlUrl) {
      window.open(danfe.xmlUrl, '_blank');
      addToast('Baixando XML...', 'info');
    } else {
      addToast('XML não disponível', 'error');
    }
  }, [addToast]);

  // Download PDF
  const handleDownloadPDF = useCallback((danfe: any) => {
    if (danfe.pdfUrl) {
      window.open(danfe.pdfUrl, '_blank');
      addToast('Abrindo PDF...', 'info');
    } else {
      addToast('PDF não disponível', 'error');
    }
  }, [addToast]);

  // Imprimir DANFE Simplificada
  const handleImprimirSimplificada = useCallback((danfe: any) => {
    if (danfe.pdfUrl) {
      window.open(danfe.pdfUrl, '_blank');
      addToast('Abrindo DANFE Simplificada...', 'info');
    } else {
      addToast('PDF da DANFE não disponível', 'error');
    }
  }, [addToast]);

  // Corrigir Erro SEFAZ
  const handleCorrigirErro = useCallback((danfe: any) => {
    setDanfeEmCorrecao(danfe);
  }, []);

  const fecharModalCorrecao = useCallback(() => {
    setDanfeEmCorrecao(null);
  }, []);

  // Gerar ZPL
  const handleGerarZPL = useCallback((danfe: any) => {
    try {
      const notaFiscal = notasFiscais.find(nf => nf.id === danfe.id);
      if (!notaFiscal) return;

      // Montar a string de SKUs para colar no rodapé da etiqueta zebra
      let skusFormatados = '';
      const itensDaNota = itensPorPedido[notaFiscal.pedidoId];
      if (itensDaNota && itensDaNota.length > 0) {
        skusFormatados = itensDaNota.map(item => `${item.quantidade}x ${item.sku}`).join(' | ');
      }

      const zpl = gerarEtiquetaDANFE({
        nfeNumero: danfe.nfeNumero,
        nfeChave: danfe.nfeChave,
        cliente: danfe.cliente,
        endereco: notaFiscal.endereco,
        cidade: notaFiscal.cidade,
        uf: notaFiscal.uf,
        cep: notaFiscal.cep,
        peso: notaFiscal.peso,
        valor: danfe.valor,
        skus: skusFormatados,
      });

      // Adicionar ZPL ao objeto DANFE
      setDANFEs(prev => prev.map(d =>
        d.id === danfe.id ? { ...d, etiquetaZpl: zpl } : d
      ));

      addToast('Código ZPL gerado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao gerar ZPL:', error);
      addToast('Erro ao gerar ZPL', 'error');
    }
  }, [notasFiscais, itensPorPedido, addToast]);

  // Reemitir NF-e
  const handleReemitir = useCallback(async (danfeId: string) => {
    try {
      setIsLoading(true);
      const danfe = danfes.find(d => d.id === danfeId);
      if (!danfe) return;

      const token = localStorage.getItem('bling_token');
      if (!token) throw new Error('Token Bling não encontrado');

      // Chamar endpoint para reemitir
      const response = await fetch('/api/bling/nfe/reemitir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token,
        },
        body: JSON.stringify({
          nfeId: danfe.id,
          nfeChave: danfe.nfeChave,
        }),
      });

      if (!response.ok) throw new Error('Erro ao reemitir');

      addToast('NF-e reenumerada e reemitida com sucesso!', 'success');
      await carregarDados();
    } catch (error) {
      console.error('Erro ao reemitir:', error);
      addToast(`Erro ao reemitir: ${error instanceof Error ? error.message : 'erro'}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [danfes, addToast]);

  const filteredDanfes = useMemo(() => {
    if (!skuFilter.trim()) return danfes;
    const filterUpper = skuFilter.trim().toUpperCase();
    return danfes.filter(d => {
      const itens = itensPorPedido[d.pedidoId];
      if (!itens) return false;
      return itens.some(item =>
        item.sku.toUpperCase().includes(filterUpper) ||
        item.descricao?.toUpperCase().includes(filterUpper)
      );
    });
  }, [danfes, skuFilter, itensPorPedido]);

  // Estatísticas
  const stats = useMemo(() => {
    const target = skuFilter.trim() ? filteredDanfes : danfes;
    return {
      total: target.length,
      autorizada: target.filter(d => d.status === 'autorizada').length,
      emitida: target.filter(d => d.status === 'emitida').length,
      enviada: target.filter(d => d.status === 'enviada').length,
      pendente: target.filter(d => d.status === 'pendente').length,
      erro: target.filter(d => d.status === 'erro').length,
    };
  }, [danfes, filteredDanfes, skuFilter]);

  const valorTotal = useMemo(() =>
    danfes.reduce((sum, d) => sum + (d.valor || 0), 0),
    [danfes]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-100 rounded-2xl">
                <FileText className="text-blue-600" size={32} />
              </div>
              <div>
                <h1 className="text-4xl font-black text-gray-900 uppercase">DANFE Manager</h1>
                <p className="text-gray-600 font-bold">Documentos Auxiliares de Nota Fiscal Eletrônica</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-gray-700 font-bold">Exibir até:</span>
                <select
                  value={limiteNfe}
                  onChange={(e) => setLimiteNfe(Number(e.target.value))}
                  className="border-2 border-blue-200 rounded-lg p-2 font-bold text-blue-900 bg-blue-50 outline-none focus:border-blue-500"
                >
                  <option value={100}>100 Notas</option>
                  <option value={200}>200 Notas</option>
                  <option value={500}>500 Notas</option>
                  <option value={1000}>1000 Notas</option>
                  <option value={2000}>2000 Notas</option>
                </select>
              </label>

              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400" size={18} />
                <input
                  type="text"
                  placeholder="Filtrar por SKU..."
                  value={skuFilter}
                  onChange={(e) => setSkuFilter(e.target.value)}
                  className="pl-10 pr-4 py-2 border-2 border-blue-200 rounded-lg font-bold text-blue-900 bg-blue-50 outline-none focus:border-blue-500 w-64"
                />
              </div>

              <button
                onClick={carregarDados}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : null}
                Atualizar
              </button>
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

          {/* Valor Total */}
          <div className="mt-4 p-4 bg-gradient-to-r from-green-100 to-green-50 rounded-lg border-2 border-green-200">
            <p className="text-sm font-bold text-green-700 uppercase">Valor Total das NF-e</p>
            <p className="text-3xl font-black text-green-900">
              R$ {(valorTotal / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-200">
          {[
            { id: 'danfe', label: '📄 Gerenciar DANFE', icon: FileText },
            { id: 'pendentes', label: '⚠️ Pendentes', icon: AlertCircle },
            { id: 'autorizadas', label: '✓ Autorizadas', icon: CheckCircle },
            { id: 'lotes', label: '📦 Lotes Diários', icon: Package },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-6 py-4 font-black uppercase text-sm tracking-widest transition-all ${activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Conteúdo */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {activeTab === 'danfe' && (
            <DANFEGerenciador
              danfes={filteredDanfes}
              isLoading={isLoading}
              onImprimir={handleImprimir}
              onDownloadXML={handleDownloadXML}
              onDownloadPDF={handleDownloadPDF}
              onGerarZPL={handleGerarZPL}
              onReemitir={handleReemitir}
              itensPorPedido={itensPorPedido}
              onSincronizarItens={handleSincronizarItens}
              onImprimirSimplificada={handleImprimirSimplificada}
              onCorrigirErro={handleCorrigirErro}
            />
          )}

          {activeTab === 'pendentes' && (
            <DANFEGerenciador
              danfes={filteredDanfes.filter(d => d.status === 'pendente' || d.status === 'emitida' || d.status === 'erro')}
              isLoading={isLoading}
              onImprimir={handleImprimir}
              onDownloadPDF={handleDownloadPDF}
              onGerarZPL={handleGerarZPL}
              onReemitir={handleReemitir}
              itensPorPedido={itensPorPedido}
              onSincronizarItens={handleSincronizarItens}
              onCorrigirErro={handleCorrigirErro}
            />
          )}

          {activeTab === 'autorizadas' && (
            <DANFEGerenciador
              danfes={filteredDanfes.filter(d => d.status === 'autorizada' || d.status === 'enviada')}
              isLoading={isLoading}
              onImprimir={handleImprimir}
              onDownloadXML={handleDownloadXML}
              onDownloadPDF={handleDownloadPDF}
              onGerarZPL={handleGerarZPL}
              itensPorPedido={itensPorPedido}
              onSincronizarItens={handleSincronizarItens}
              onImprimirSimplificada={handleImprimirSimplificada}
            />
          )}

          {activeTab === 'lotes' && (
            <div className="p-6 min-h-[500px]">
              <div className="flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
                <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                  <Package size={28} className="text-blue-600" /> Lotes de Geração/Emissão
                </h3>
                <button
                  onClick={() => {
                    if (window.confirm("Isso apagará o log visual dos envios em Lote feitos nesta máquina hoje. Continuar?")) {
                      localStorage.removeItem('nfe_lotes_diarios');
                      setLotesDiarios([]);
                    }
                  }}
                  className="px-4 py-2 bg-red-50 text-red-700 font-bold rounded-lg hover:bg-red-100 border border-red-200 transition-all text-xs"
                >
                  Limpar Histórico Local
                </button>
              </div>

              {lotesDiarios.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                  <Package size={64} className="mx-auto mb-4 opacity-20" />
                  <p className="font-bold text-gray-500 text-lg">Nenhum lote diário encontrado nesta máquina.</p>
                  <p className="text-sm mt-2">Os lotes de envio aparecerão aqui após você gerar notas em massa na aba "Importação de Pedidos".</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {lotesDiarios.map((lote: any, i: number) => (
                    <div key={i} className="border-2 border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all bg-white relative overflow-hidden">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 inline-block rounded-md mb-2">NF-e Lote: {lote.id}</p>
                          <p className="text-sm text-gray-700 font-bold flex items-center gap-2">
                            <Clock size={14} className="opacity-50" /> {new Date(lote.data).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2 mb-4 bg-gray-50 p-4 rounded-xl border border-gray-100 divide-x divide-gray-200">
                        <div className="text-center flex-1 px-2">
                          <p className="text-[10px] uppercase font-black tracking-widest text-gray-500 mb-1">Processadas</p>
                          <p className="text-2xl font-black text-gray-800">{lote.total}</p>
                        </div>
                        <div className="text-center flex-1 px-2">
                          <p className="text-[10px] uppercase font-black tracking-widest text-green-600 mb-1">Sucesso</p>
                          <p className="text-2xl font-black text-green-700">{lote.ok}</p>
                        </div>
                        <div className="text-center flex-1 px-2">
                          <p className="text-[10px] uppercase font-black tracking-widest text-red-600 mb-1">Rejeitadas</p>
                          <p className="text-2xl font-black text-red-700">{lote.fail}</p>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t-2 border-dashed border-gray-100 text-xs">
                        <p className="font-bold text-gray-800 mb-2 uppercase tracking-wide text-[10px]">Detalhamento das NF-es (Livre/Aprovadas):</p>
                        <div className="max-h-32 overflow-y-auto pr-2 space-y-1">
                          {lote.nfes?.map((nfe: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                              <span className="font-bold text-gray-600">NF-e: {nfe.nfeNumero || 'S/N'}</span>
                              <span className="text-[9px] text-gray-400 font-mono">Ped: {nfe.pedidoVendaId}</span>
                            </div>
                          ))}
                          {(!lote.nfes || lote.nfes.length === 0) && (
                            <p className="text-gray-400 italic font-medium p-2 bg-gray-50 rounded text-center">Nenhum detalhe salvo (Lote vázio ou 100% erro).</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dica */}
        <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-xl">
          <h3 className="font-black text-blue-900 mb-2 flex items-center gap-2">
            <FileText className="text-blue-600" size={24} />
            Como Usar
          </h3>
          <ul className="space-y-2 text-blue-800 font-bold text-sm">
            <li>✓ Visualize todas as suas NF-e emitidas via Bling</li>
            <li>✓ Acompanhe o status: Emitida → Autorizada → Enviada</li>
            <li>✓ Imprima a DANFE (Documento Auxiliar) em PDF</li>
            <li>✓ Gere etiquetas ZPL para impressoras térmicas Zebra</li>
            <li>✓ Download do XML para integrações e sistemas</li>
          </ul>
        </div>

        {/* Modal de Correção SEFAZ */}
        {danfeEmCorrecao && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
              <h3 className="text-xl font-black text-red-600 flex items-center gap-2">
                <AlertCircle size={28} />
                Correção de Erro SEFAZ - NF-e #{danfeEmCorrecao.nfeNumero || 'Nova'}
              </h3>

              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm font-bold text-red-900 mb-1">Motivo da Rejeição:</p>
                <p className="text-red-700 font-bold">{danfeEmCorrecao.observacoes || 'Erro não especificado pela SEFAZ. Ocorreu falha na transmissão da nota.'}</p>
              </div>

              <div className="space-y-3">
                <p className="text-sm text-gray-700 font-bold">Instruções para Correção:</p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2 font-semibold">
                    <li>Clique no botão abaixo para abrir a nota no painel do ERP Bling.</li>
                    <li>Navegue até os Dados Adicionais ou Produtos para corrigir as inconsistências (ex: NCM, CPF/CNPJ, Endereço).</li>
                    <li>Após corrigir e salvar no ambiente remoto, feche esta tela.</li>
                    <li>Clique no botão <strong>"Tentar Reemitir Novamente"</strong> na listagem vermelha de erro.</li>
                  </ol>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={fecharModalCorrecao}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-bold hover:bg-gray-300 transition-all"
                >
                  Fechar Manualmente
                </button>
                <button
                  onClick={() => {
                    window.open(`https://www.bling.com.br/b/notas.fiscais.php`, '_blank');
                  }}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                >
                  Abrir Ambiente Bling para Corrigir
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DANFEManagerPage;
