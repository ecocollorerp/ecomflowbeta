// ============================================================================
// components/EtiquetasPrioritarias.tsx
// Fluxo completo: Pedidos com NF-e → Selecionar → Gerar Etiqueta Bling Real
// Armazenar por lote em ZPL → Rastreabilidade completa
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Package,
  Truck,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  Save,
  RefreshCw,
  Filter,
  Search,
  Archive,
  Eye,
} from 'lucide-react';
import { supabaseClient } from '../lib/supabaseClient';

interface PedidoComNFe {
  id: string;
  numero: string; // número do pedido Bling
  lojaVirtual: string;
  canalVendas: string; // MERCADO_LIVRE, SHOPEE, SITE
  cliente: {
    nome: string;
    cpfCnpj: string;
    email?: string;
  };
  nfeNumero?: string;
  nfeChave?: string;
  nfeLote?: string;
  total: number;
  statusNFe?: 'RASCUNHO' | 'EMITIDA' | 'CANCELADA';
  enderecoEntrega?: {
    rua: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  };
  itens: Array<{
    descricao: string;
    sku: string;
    quantidade: number;
    valor: number;
  }>;
}

interface EtiquetaGerada {
  id: string;
  pedidoId: string;
  nfeLote: string;
  dataGeracao: string;
  statusProcessamento: 'pendente' | 'processando' | 'concluido' | 'salvo_no_pc';
  armazenagem: 'zpl' | 'pc';
  caminhoArquivo?: string;
  rastreabilidade: {
    numeroBling: string;
    lojaVirtual: string;
    canalVendas: string;
  };
}

interface Props {
  token?: string;
  addToast?: (msg: string, tipo: 'success' | 'error' | 'info') => void;
}

export const EtiquetasPrioritarias: React.FC<Props> = ({ token, addToast }) => {
  const [abaAtiva, setAbaAtiva] = useState<'selecao' | 'geracao' | 'zpl' | 'historico'>(
    'selecao'
  );
  const [pedidosDisponiveis, setPedidosDisponiveis] = useState<PedidoComNFe[]>([]);
  const [pedidosSelecionados, setPedidosSelecionados] = useState<Set<string>>(new Set());
  const [isCarregando, setIsCarregando] = useState(false);
  const [isGerando, setIsGerando] = useState(false);
  const [filtroFiltro, setFiltroFiltro] = useState('');
  const [etiquetasGeradas, setEtiquetasGeradas] = useState<EtiquetaGerada[]>([]);
  const [filtroLote, setFiltroLote] = useState('');
  const [detalhesAbertos, setDetalhesAbertos] = useState<string | null>(null);

  // Carregar pedidos com NF-e emitidas
  useEffect(() => {
    if (token) {
      carregarPedidosComNFe();
    }
  }, [token]);

  // Carregar etiquetas geradas
  useEffect(() => {
    carregarEtiquetasGeradas();
  }, []);

  const carregarPedidosComNFe = async () => {
    setIsCarregando(true);
    try {
      // Buscar pedidos que têm NF-e emitida
      const { data, error } = await supabaseClient
        .from('pedidos')
        .select(
          `
          id,
          numero,
          lojaVirtual,
          canalVendas,
          cliente,
          nfeNumero,
          nfeChave,
          nfeLote,
          total,
          statusNFe,
          enderecoEntrega,
          itens
        `
        )
        .eq('statusNFe', 'EMITIDA')
        .order('criadoEm', { ascending: false });

      if (error) throw error;

      setPedidosDisponiveis(data || []);
      addToast?.(
        `✅ ${data?.length || 0} pedidos com NF-e disponíveis`,
        'success'
      );
    } catch (error: any) {
      console.error('Erro ao carregar pedidos:', error);
      addToast?.(
        `❌ Erro ao carregar pedidos: ${error.message}`,
        'error'
      );
    } finally {
      setIsCarregando(false);
    }
  };

  const carregarEtiquetasGeradas = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('etiquetas_prioritarias')
        .select('*')
        .order('dataGeracao', { ascending: false });

      if (error) throw error;

      setEtiquetasGeradas(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar etiquetas:', error);
    }
  };

  const togglePedidoSelecionado = (pedidoId: string) => {
    const novo = new Set(pedidosSelecionados);
    if (novo.has(pedidoId)) {
      novo.delete(pedidoId);
    } else {
      novo.add(pedidoId);
    }
    setPedidosSelecionados(novo);
  };

  const gerarEtiquetas = async (opcaoArmazenagem: 'zpl' | 'salvar_pc' | 'processar') => {
    if (pedidosSelecionados.size === 0) {
      addToast?.('❌ Selecione pelo menos um pedido', 'error');
      return;
    }

    setIsGerando(true);
    try {
      const pedidosParaGerar = pedidosDisponiveis.filter((p) =>
        pedidosSelecionados.has(p.id)
      );

      // Obtém o lote (usa o primeiro nfeLote disponível dos pedidos selecionados)
      const lote = pedidosParaGerar[0]?.nfeLote || `LOTE-${Date.now()}`;

      for (const pedido of pedidosParaGerar) {
        // 1. Buscar etiqueta real do Bling
        const etiquetaBling = await buscarEtiquetaBling(pedido.numero, token!);

        if (!etiquetaBling) {
          addToast?.(
            `⚠️ Etiqueta não encontrada para pedido ${pedido.numero}`,
            'error'
          );
          continue;
        }

        // 2. Processar conforme opção escolhida
        if (opcaoArmazenagem === 'zpl') {
          // Armazenar em ZPL
          await armazenarEtiquetaZPL(
            pedido,
            etiquetaBling,
            lote,
            'processando'
          );
        } else if (opcaoArmazenagem === 'salvar_pc') {
          // Salvar no PC
          await salvarEtiquetaPC(pedido, etiquetaBling, lote);
        } else if (opcaoArmazenagem === 'processar') {
          // Processar e ir para etiquetas
          await processarEtiqueta(pedido, etiquetaBling, lote);
        }
      }

      addToast?.(
        `✅ ${pedidosParaGerar.length} etiqueta(s) processada(s)`,
        'success'
      );

      setPedidosSelecionados(new Set());
      carregarEtiquetasGeradas();
    } catch (error: any) {
      console.error('Erro ao gerar etiquetas:', error);
      addToast?.(`❌ Erro: ${error.message}`, 'error');
    } finally {
      setIsGerando(false);
    }
  };

  const buscarEtiquetaBling = async (
    numeroPedido: string,
    token: string
  ): Promise<string | null> => {
    try {
      // Buscar dados do pedido no Bling
      const resp = await fetch(
        `https://www.bling.com.br/Api/v3/pedidos/vendas/${numeroPedido}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        }
      );

      if (!resp.ok) {
        console.warn(`Pedido ${numeroPedido} não encontrado (${resp.status})`);
        return null;
      }

      const data = await resp.json();
      const pedido = data?.data;

      // Retornar URL de etiqueta ou gerar formato padrão
      return (
        pedido?.transporte?.etiqueta ||
        gerarFormatoEtiquetaBling(pedido)
      );
    } catch (error: any) {
      console.error(`Erro ao buscar etiqueta do Bling:`, error);
      return null;
    }
  };

  const gerarFormatoEtiquetaBling = (pedido: any): string => {
    // Formato genérico de etiqueta se não existir no Bling
    const endereco = pedido?.enderecoEntrega || {};
    return `
ETIQUETA DE ENVIO - BLING
========================
Pedido: ${pedido?.numero}
Rastreamento: ${pedido?.transporte?.codigoRastreamento || 'N/A'}

DESTINATÁRIO:
${pedido?.cliente?.nome}
${endereco?.rua}, ${endereco?.numero}
${endereco?.complemento || ''}
${endereco?.bairro}
${endereco?.cidade} - ${endereco?.estado}
CEP: ${endereco?.cep}

REMETENTE:
Sua Empresa
    `;
  };

  const armazenarEtiquetaZPL = async (
    pedido: PedidoComNFe,
    etiquetaBling: string,
    lote: string,
    status: 'processando' | 'concluido' = 'concluido'
  ) => {
    try {
      // Converter para ZPL (formato para impressora térmica)
      const zpl = converterParaZPL(etiquetaBling, pedido);

      // Salvar no Supabase
      const { error } = await supabaseClient
        .from('etiquetas_prioritarias')
        .insert([
          {
            pedidoId: pedido.id,
            numeroBling: pedido.numero,
            nfeLote: lote,
            dataGeracao: new Date().toISOString(),
            statusProcessamento: status,
            armazenagem: 'zpl',
            conteudoZpl: zpl,
            rastreabilidade: {
              numeroBling: pedido.numero,
              lojaVirtual: pedido.lojaVirtual,
              canalVendas: pedido.canalVendas,
            },
          },
        ]);

      if (error) throw error;

      console.log(`✅ Etiqueta armazenada em ZPL para pedido ${pedido.numero}`);
    } catch (error: any) {
      console.error('Erro ao armazenar em ZPL:', error);
      throw error;
    }
  };

  const salvarEtiquetaPC = async (
    pedido: PedidoComNFe,
    etiquetaBling: string,
    lote: string
  ) => {
    try {
      // Criar blob
      const blob = new Blob([etiquetaBling], { type: 'text/plain' });

      // Salvar via download (simula salvar no PC)
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `etiqueta-pedido-${pedido.numero}-${lote}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Registrar no banco
      await supabaseClient
        .from('etiquetas_prioritarias')
        .insert([
          {
            pedidoId: pedido.id,
            numeroBling: pedido.numero,
            nfeLote: lote,
            dataGeracao: new Date().toISOString(),
            statusProcessamento: 'salvo_no_pc',
            armazenagem: 'pc',
            caminhoArquivo: `etiqueta-pedido-${pedido.numero}-${lote}.txt`,
            rastreabilidade: {
              numeroBling: pedido.numero,
              lojaVirtual: pedido.lojaVirtual,
              canalVendas: pedido.canalVendas,
            },
          },
        ]);

      console.log(`✅ Etiqueta salva no PC para pedido ${pedido.numero}`);
    } catch (error: any) {
      console.error('Erro ao salvar no PC:', error);
      throw error;
    }
  };

  const processarEtiqueta = async (
    pedido: PedidoComNFe,
    etiquetaBling: string,
    lote: string
  ) => {
    try {
      const zpl = converterParaZPL(etiquetaBling, pedido);

      await supabaseClient
        .from('etiquetas_prioritarias')
        .insert([
          {
            pedidoId: pedido.id,
            numeroBling: pedido.numero,
            nfeLote: lote,
            dataGeracao: new Date().toISOString(),
            statusProcessamento: 'concluido',
            armazenagem: 'zpl',
            conteudoZpl: zpl,
            rastreabilidade: {
              numeroBling: pedido.numero,
              lojaVirtual: pedido.lojaVirtual,
              canalVendas: pedido.canalVendas,
            },
          },
        ]);

      // Aqui você poderia fazer mais processamento ou ir para outra aba
      addToast?.(
        `✅ Etiqueta processada para ir para a aba "Etiquetas"`,
        'success'
      );
    } catch (error: any) {
      console.error('Erro ao processar:', error);
      throw error;
    }
  };

  const converterParaZPL = (
    etiquetaBling: string,
    pedido: PedidoComNFe
  ): string => {
    // Converter formato de etiqueta para ZPL (formato de impressora térmica)
    const endereco = pedido.enderecoEntrega;
    const rastreamento = etiquetaBling.match(/Rastreamento: (.+)/)?.[1] || 'N/A';

    return `^XA
^PW800
^LL1200
^CF0,60
^FO50,100^FD${pedido.cliente.nome}^FS
^CF0,30
^FO50,200^FD${endereco?.rua}, ${endereco?.numero}^FS
^FO50,250^FD${endereco?.bairro}, ${endereco?.cidade} - ${endereco?.estado}^FS
^FO50,300^FD${endereco?.cep}^FS
^FO50,400^BY2,3,50
^BC^FD${rastreamento}^FS
^CF0,20
^FO50,600^FDPedido: ${pedido.numero}^FS
^FO50,650^FDNF-e: ${pedido.nfeNumero || 'N/A'}^FS
^FO50,700^FDLote: ${pedido.nfeLote || 'N/A'}^FS
^FO50,750^FDLoja: ${pedido.lojaVirtual} | Canal: ${pedido.canalVendas}^FS
^XZ`;
  };

  const filtrarPedidos = () => {
    return pedidosDisponiveis.filter((p) => {
      const texto = filtroFiltro.toLowerCase();
      return (
        p.numero?.toLowerCase().includes(texto) ||
        p.cliente.nome.toLowerCase().includes(texto) ||
        p.lojaVirtual.toLowerCase().includes(texto) ||
        p.canalVendas.toLowerCase().includes(texto)
      );
    });
  };

  const filtrarEtiquetas = () => {
    return etiquetasGeradas.filter((e) => {
      const texto = filtroLote.toLowerCase();
      return (
        e.nfeLote.toLowerCase().includes(texto) ||
        e.numeroBling.toLowerCase().includes(texto) ||
        e.rastreabilidade.lojaVirtual.toLowerCase().includes(texto)
      );
    });
  };

  return (
    <div className="space-y-6 p-4 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg p-6 shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Truck size={40} className="flex-shrink-0" />
            <div>
              <h1 className="text-3xl font-bold">🎫 Etiquetas Prioritárias</h1>
              <p className="text-indigo-100 mt-2">
                Fluxo completo: Pedidos → NF-e → Etiquetas Bling → Armazenagem ZPL
              </p>
            </div>
          </div>
          <button
            onClick={carregarPedidosComNFe}
            className="flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-lg font-semibold hover:bg-indigo-50"
            disabled={isCarregando}
          >
            {isCarregando ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Carregando...
              </>
            ) : (
              <>
                <RefreshCw size={20} />
                Atualizar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b border-gray-300 bg-white rounded-t-lg p-4">
        {[
          { id: 'selecao', label: '📦 Seleção de Pedidos', icon: Package },
          { id: 'geracao', label: '🎫 Geração de Etiquetas', icon: FileText },
          { id: 'zpl', label: '📁 Armazenagem ZPL', icon: Archive },
          { id: 'historico', label: '📜 Histórico', icon: Eye },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setAbaAtiva(id as any)}
            className={`px-4 py-2 font-semibold rounded-lg transition ${
              abaAtiva === id
                ? 'bg-indigo-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo das Abas */}
      <div className="bg-white rounded-b-lg p-6 shadow-md">
        {/* Aba Seleção */}
        {abaAtiva === 'selecao' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Search className="text-gray-400" />
              <input
                type="text"
                placeholder="Filtrar por número, cliente, loja ou canal..."
                value={filtroFiltro}
                onChange={(e) => setFiltroFiltro(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left">Selecionar</th>
                    <th className="px-4 py-2 text-left">Pedido</th>
                    <th className="px-4 py-2 text-left">Cliente</th>
                    <th className="px-4 py-2 text-left">Loja Virtual</th>
                    <th className="px-4 py-2 text-left">Canal</th>
                    <th className="px-4 py-2 text-left">NF-e</th>
                    <th className="px-4 py-2 text-left">Lote</th>
                    <th className="px-4 py-2 text-left">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrarPedidos().map((pedido) => (
                    <tr
                      key={pedido.id}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={pedidosSelecionados.has(pedido.id)}
                          onChange={() => togglePedidoSelecionado(pedido.id)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-4 py-2 font-semibold">{pedido.numero}</td>
                      <td className="px-4 py-2">{pedido.cliente.nome}</td>
                      <td className="px-4 py-2">{pedido.lojaVirtual}</td>
                      <td className="px-4 py-2 font-semibold text-blue-600">
                        {pedido.canalVendas}
                      </td>
                      <td className="px-4 py-2">{pedido.nfeNumero || '-'}</td>
                      <td className="px-4 py-2 text-purple-600">
                        {pedido.nfeLote || '-'}
                      </td>
                      <td className="px-4 py-2 font-semibold">
                        R$ {pedido.total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-sm text-gray-600">
              {pedidosSelecionados.size} pedido(s) selecionado(s)
            </div>
          </div>
        )}

        {/* Aba Geração */}
        {abaAtiva === 'geracao' && (
          <div className="space-y-6">
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 flex gap-3">
              <AlertCircle size={24} className="text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-blue-900">Opções de Processamento</p>
                <p className="text-sm text-blue-800 mt-1">
                  Escolha como deseja processar as {pedidosSelecionados.size} etiqueta(s)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Opção 1: ZPL */}
              <div className="border-2 border-indigo-300 rounded-lg p-6 hover:shadow-lg transition">
                <div className="flex items-center gap-2 mb-3">
                  <Archive size={24} className="text-indigo-600" />
                  <h3 className="font-bold text-indigo-900">Armazenar em ZPL</h3>
                </div>
                <p className="text-sm text-gray-700 mb-4">
                  As etiquetas serão salvas no banco de dados em formato ZPL, organizadas por lote da NF-e.
                </p>
                <button
                  onClick={() => gerarEtiquetas('zpl')}
                  disabled={isGerando || pedidosSelecionados.size === 0}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50"
                >
                  {isGerando ? (
                    <>
                      <Loader2 className="inline animate-spin mr-2" size={16} />
                      Processando...
                    </>
                  ) : (
                    'Processar → ZPL'
                  )}
                </button>
              </div>

              {/* Opção 2: PC */}
              <div className="border-2 border-green-300 rounded-lg p-6 hover:shadow-lg transition">
                <div className="flex items-center gap-2 mb-3">
                  <Download size={24} className="text-green-600" />
                  <h3 className="font-bold text-green-900">Baixar no PC</h3>
                </div>
                <p className="text-sm text-gray-700 mb-4">
                  As etiquetas serão baixadas como arquivos TXT no seu computador.
                </p>
                <button
                  onClick={() => gerarEtiquetas('salvar_pc')}
                  disabled={isGerando || pedidosSelecionados.size === 0}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50"
                >
                  {isGerando ? (
                    <>
                      <Loader2 className="inline animate-spin mr-2" size={16} />
                      Processando...
                    </>
                  ) : (
                    '⬇️ Baixar no PC'
                  )}
                </button>
              </div>

              {/* Opção 3: Processar */}
              <div className="border-2 border-purple-300 rounded-lg p-6 hover:shadow-lg transition">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle size={24} className="text-purple-600" />
                  <h3 className="font-bold text-purple-900">Processar</h3>
                </div>
                <p className="text-sm text-gray-700 mb-4">
                  As etiquetas serão processadas e irão para a aba "Etiquetas".
                </p>
                <button
                  onClick={() => gerarEtiquetas('processar')}
                  disabled={isGerando || pedidosSelecionados.size === 0}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50"
                >
                  {isGerando ? (
                    <>
                      <Loader2 className="inline animate-spin mr-2" size={16} />
                      Processando...
                    </>
                  ) : (
                    '✓ Processar'
                  )}
                </button>
              </div>
            </div>

            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 flex gap-3">
              <AlertCircle size={20} className="text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                <strong>Nota:</strong> As etiquetas geradas conterão todos os dados de rastreabilidade:
                número Bling, loja virtual, canal de vendas e lote da NF-e.
              </p>
            </div>
          </div>
        )}

        {/* Aba ZPL */}
        {abaAtiva === 'zpl' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Filter className="text-gray-400" />
              <input
                type="text"
                placeholder="Filtrar por lote, número ou loja..."
                value={filtroLote}
                onChange={(e) => setFiltroLote(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left">Lote</th>
                    <th className="px-4 py-2 text-left">Número Bling</th>
                    <th className="px-4 py-2 text-left">Loja Virtual</th>
                    <th className="px-4 py-2 text-left">Canal</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Geração</th>
                    <th className="px-4 py-2 text-left">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrarEtiquetas()
                    .filter((e) => e.armazenagem === 'zpl')
                    .map((etiqueta) => (
                      <tr
                        key={etiqueta.id}
                        className="border-b hover:bg-gray-50"
                      >
                        <td className="px-4 py-2 font-semibold text-purple-600">
                          {etiqueta.nfeLote}
                        </td>
                        <td className="px-4 py-2">{etiqueta.numeroBling}</td>
                        <td className="px-4 py-2">{etiqueta.rastreabilidade.lojaVirtual}</td>
                        <td className="px-4 py-2 text-blue-600">
                          {etiqueta.rastreabilidade.canalVendas}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              etiqueta.statusProcessamento === 'concluido'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {etiqueta.statusProcessamento}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-600 text-xs">
                          {new Date(etiqueta.dataGeracao).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() =>
                              setDetalhesAbertos(
                                detalhesAbertos === etiqueta.id ? null : etiqueta.id
                              )
                            }
                            className="text-indigo-600 hover:text-indigo-800 font-semibold"
                          >
                            {detalhesAbertos === etiqueta.id ? 'Fechar' : 'Abrir'}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {detalhesAbertos && (
              <div className="bg-gray-100 p-4 rounded-lg">
                <h3 className="font-bold mb-2">Detalhes da Etiqueta</h3>
                <pre className="bg-white p-4 rounded text-xs overflow-auto max-h-60">
                  {etiquetasGeradas
                    .find((e) => e.id === detalhesAbertos)
                    ?.rastreabilidade &&
                    JSON.stringify(
                      etiquetasGeradas.find((e) => e.id === detalhesAbertos),
                      null,
                      2
                    )}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Aba Histórico */}
        {abaAtiva === 'historico' && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <p className="text-sm text-gray-600">Total de Etiquetas</p>
                <p className="text-2xl font-bold text-blue-700">
                  {etiquetasGeradas.length}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                <p className="text-sm text-gray-600">Processadas</p>
                <p className="text-2xl font-bold text-green-700">
                  {etiquetasGeradas.filter((e) => e.statusProcessamento === 'concluido').length}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
                <p className="text-sm text-gray-600">Em ZPL</p>
                <p className="text-2xl font-bold text-purple-700">
                  {etiquetasGeradas.filter((e) => e.armazenagem === 'zpl').length}
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg border-l-4 border-orange-500">
                <p className="text-sm text-gray-600">No PC</p>
                <p className="text-2xl font-bold text-orange-700">
                  {etiquetasGeradas.filter((e) => e.armazenagem === 'pc').length}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left">Lote</th>
                    <th className="px-4 py-2 text-left">Número Bling</th>
                    <th className="px-4 py-2 text-left">Loja | Canal</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Armazenagem</th>
                    <th className="px-4 py-2 text-left">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrarEtiquetas().map((etiqueta) => (
                    <tr key={etiqueta.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-semibold">{etiqueta.nfeLote}</td>
                      <td className="px-4 py-2">{etiqueta.numeroBling}</td>
                      <td className="px-4 py-2 text-sm">
                        {etiqueta.rastreabilidade.lojaVirtual} |{' '}
                        <span className="text-blue-600 font-semibold">
                          {etiqueta.rastreabilidade.canalVendas}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            etiqueta.statusProcessamento === 'concluido'
                              ? 'bg-green-100 text-green-800'
                              : etiqueta.statusProcessamento === 'salvo_no_pc'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {etiqueta.statusProcessamento}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            etiqueta.armazenagem === 'zpl'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {etiqueta.armazenagem.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 text-xs">
                        {new Date(etiqueta.dataGeracao).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
