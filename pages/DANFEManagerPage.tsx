// ============================================================================
// DANFEManagerPage.tsx - Página de Gestão de DANFE integrada ao Bling
// ============================================================================

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { DANFEGerenciador } from '../components/DANFEGerenciador';
import { ListaItensPedido } from '../components/ListaItensPedido';
import { FileText, AlertCircle, CheckCircle, Package, Loader2, Eye, ZapOff, Zap } from 'lucide-react';
import { gerarEtiquetaDANFE } from '../services/zplService';
import { syncBlingItems, useSyncBlingItems } from '../services/syncBlingItems';

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
  const { isSyncing, sincronizar: sincronizarItens } = useSyncBlingItems();

  // Carregar DANFE e NF-e
  useEffect(() => {
    carregarDados();
    // Sincronizar itens automaticamente a cada 5 minutos
    const interval = setInterval(() => {
      sincronizarItensAutomatico();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const carregarDados = async () => {
    try {
      setIsLoading(true);

      const token = localStorage.getItem('bling_token');
      if (!token) throw new Error('Token Bling não encontrado');

      // Buscar pedidos de vendas para pegar NF-e
      const response = await fetch('/api/bling/pedidos/vendas?limit=100', {
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
          };
        });

      setNotasFiscais(notasFiscaisMap);

      // Converter para formato DANFE
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
      }));

      setDANFEs(danfesMap);
      addToast(`${danfesMap.length} DANFE(s) carregada(s)`, 'success');
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

  // Gerar ZPL
  const handleGerarZPL = useCallback((danfe: any) => {
    try {
      const notaFiscal = notasFiscais.find(nf => nf.id === danfe.id);
      if (!notaFiscal) return;

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
  }, [notasFiscais, addToast]);

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

  // Estatísticas
  const stats = useMemo(() => {
    return {
      total: danfes.length,
      autorizada: danfes.filter(d => d.status === 'autorizada').length,
      emitida: danfes.filter(d => d.status === 'emitida').length,
      enviada: danfes.filter(d => d.status === 'enviada').length,
      pendente: danfes.filter(d => d.status === 'pendente').length,
      erro: danfes.filter(d => d.status === 'erro').length,
    };
  }, [danfes]);

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
            <button
              onClick={carregarDados}
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : null}
              Atualizar
            </button>
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
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-6 py-4 font-black uppercase text-sm tracking-widest transition-all ${
                activeTab === tab.id
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
              danfes={danfes}
              isLoading={isLoading}
              onImprimir={handleImprimir}
              onDownloadXML={handleDownloadXML}
              onDownloadPDF={handleDownloadPDF}
              onGerarZPL={handleGerarZPL}
              onReemitir={handleReemitir}
              itensPorPedido={itensPorPedido}
              onSincronizarItens={handleSincronizarItens}
            />
          )}

          {activeTab === 'pendentes' && (
            <DANFEGerenciador
              danfes={danfes.filter(d => d.status === 'pendente' || d.status === 'emitida')}
              isLoading={isLoading}
              onImprimir={handleImprimir}
              onDownloadPDF={handleDownloadPDF}
              onGerarZPL={handleGerarZPL}
              itensPorPedido={itensPorPedido}
              onSincronizarItens={handleSincronizarItens}
            />
          )}

          {activeTab === 'autorizadas' && (
            <DANFEGerenciador
              danfes={danfes.filter(d => d.status === 'autorizada' || d.status === 'enviada')}
              isLoading={isLoading}
              onImprimir={handleImprimir}
              onDownloadXML={handleDownloadXML}
              onDownloadPDF={handleDownloadPDF}
              onGerarZPL={handleGerarZPL}
              itensPorPedido={itensPorPedido}
              onSincronizarItens={handleSincronizarItens}
            />
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
      </div>
    </div>
  );
};

export default DANFEManagerPage;
