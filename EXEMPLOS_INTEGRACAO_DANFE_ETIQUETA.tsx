// ============================================================================
// EXEMPLOS_INTEGRACAO_DANFE_ETIQUETA.tsx
// Exemplos prontos para copiar e colar em suas páginas
// ============================================================================

// ============================================================================
// EXEMPLO 1: Integração Simples (Aba Completa)
// Copie e cole em BlingPage.tsx ou ImporterPage.tsx
// ============================================================================

import { AbaDanfeEtiquetaBling } from './components/AbaDanfeEtiquetaBling';

export const BlingPageComDanfe = () => {
  const token = 'seu-token-bling'; // Buscar de context/settings
  const [toasts, setToasts] = useState([]);

  const addToast = (msg: string, tipo: 'success' | 'error' | 'info') => {
    // Implementar notificação ou usar biblioteca: react-toastify, sonner, etc
    console.log(`[${tipo.toUpperCase()}] ${msg}`);
  };

  return (
    <div>
      {/* Suas outras abas */}
      <h1>Bling Integration</h1>

      {/* ADICIONAR APENAS ESTA LINHA */}
      <AbaDanfeEtiquetaBling token={token} addToast={addToast} />

      {/* Fim */}
    </div>
  );
};

// ============================================================================
// EXEMPLO 2: Com Abas Separadas
// Se você quer controlar qual aba mostrar
// ============================================================================

export const BlingPageComAbas = () => {
  const [abaAtiva, setAbaAtiva] = useState('danfe');
  const token = 'seu-token-bling';

  const addToast = (msg: string, tipo: 'success' | 'error' | 'info') => {
    console.log(`[${tipo}] ${msg}`);
  };

  return (
    <div>
      {/* Navegação de Abas */}
      <div className="flex gap-2 border-b mb-4">
        <button
          onClick={() => setAbaAtiva('danfe')}
          className={`px-4 py-2 ${abaAtiva === 'danfe' ? 'border-b-2 border-blue-600' : ''}`}
        >
          🖨️ DANFE + Etiqueta
        </button>
        <button
          onClick={() => setAbaAtiva('importacao')}
          className={`px-4 py-2 ${abaAtiva === 'importacao' ? 'border-b-2 border-blue-600' : ''}`}
        >
          📥 Importação
        </button>
      </div>

      {/* Conteúdo da Aba */}
      {abaAtiva === 'danfe' && (
        <AbaDanfeEtiquetaBling token={token} addToast={addToast} />
      )}
      {abaAtiva === 'importacao' && <div>Sua importação aqui</div>}
    </div>
  );
};

// ============================================================================
// EXEMPLO 3: Apenas o Modal em um Botão
// Use se você já tem sua própria interface
// ============================================================================

import { ModalDanfeEtiqueta } from './components/ModalDanfeEtiqueta';

export const BotaoDanfe = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const token = 'seu-token-bling';

  return (
    <>
      {/* Seu botão */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
      >
        🖨️ Gerar DANFE + Etiqueta
      </button>

      {/* Modal */}
      <ModalDanfeEtiqueta
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        token={token}
        marketplace="SHOPEE" // Opcional: especificar marketplace
        addToast={(msg, tipo) => console.log(`[${tipo}] ${msg}`)}
      />
    </>
  );
};

// ============================================================================
// EXEMPLO 4: Modal com Seleção de Marketplace
// Sem especificar marketplace no modal
// ============================================================================

export const BotaoDanfeComEscolha = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [marketplace, setMarketplace] = useState<'SHOPEE' | 'MERCADO_LIVRE' | undefined>(
    undefined
  );
  const token = 'seu-token-bling';

  return (
    <>
      {/* Dois botões */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setMarketplace('SHOPEE');
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-orange-600 text-white rounded"
        >
          Shopee
        </button>
        <button
          onClick={() => {
            setMarketplace('MERCADO_LIVRE');
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-yellow-600 text-white rounded"
        >
          Mercado Livre
        </button>
      </div>

      {/* Modal */}
      <ModalDanfeEtiqueta
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setMarketplace(undefined);
        }}
        token={token}
        marketplace={marketplace}
        addToast={(msg, tipo) => console.log(`[${tipo}] ${msg}`)}
      />
    </>
  );
};

// ============================================================================
// EXEMPLO 5: Usar o Serviço Diretamente (Programático/Avançado)
// Para casos onde você quer controlar todo o fluxo
// ============================================================================

import { danfeSimplificadoComEtiquetaService } from './services/danfeSimplificadoComEtiquetaService';

export const ProcessarDanfeProgramaticamente = async () => {
  const token = 'seu-token-bling';
  const quantidade = 25;

  try {
    // ETAPA 1: Buscar pedidos com etiqueta
    console.log('📥 Buscando pedidos...');
    const { pedidos, comEtiqueta, semEtiqueta } =
      await danfeSimplificadoComEtiquetaService.buscarPedidosComEtiquetaDisponivel(
        token,
        quantidade,
        'SHOPEE'
      );

    console.log(`✅ ${comEtiqueta} com etiqueta, ❌ ${semEtiqueta} sem`);

    // ETAPA 2: Processar pedidos
    console.log('⚙️ Processando...');
    const resultado =
      await danfeSimplificadoComEtiquetaService.processarPedidosParaDanfeEtiqueta(
        pedidos,
        'usuario@email.com'
      );

    console.log(`✅ ${resultado.totalSucesso} processados, ❌ ${resultado.totalErros} erros`);
    console.log(resultado.relatorio);

    // ETAPA 3: Baixar ZIP
    console.log('📦 Gerando ZIP...');
    const zipBlob =
      await danfeSimplificadoComEtiquetaService.gerarZipDosArquivos(resultado.arquivos);

    // ETAPA 4: Fazer download
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `danfe-etiquetas-${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    console.log('✅ Download iniciado!');
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  }
};

// ============================================================================
// EXEMPLO 6: Com Sistema de Toast (Notificações)
// Se você usa react-toastify ou sonner
// ============================================================================

import { toast } from 'react-toastify'; // ou outro library

export const DanfeComToast = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const token = 'seu-token-bling';

  const addToast = (msg: string, tipo: 'success' | 'error' | 'info') => {
    // Com react-toastify
    if (tipo === 'success') toast.success(msg);
    if (tipo === 'error') toast.error(msg);
    if (tipo === 'info') toast.info(msg);
  };

  return (
    <>
      <button onClick={() => setIsModalOpen(true)}>Gerar DANFE</button>
      <ModalDanfeEtiqueta
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        token={token}
        addToast={addToast}
      />
    </>
  );
};

// ============================================================================
// EXEMPLO 7: Integração em Contexto/Redux
// Se você usa Context API ou Redux para gerenciar estado
// ============================================================================

// AuthContext.tsx
const { token } = useAuth(); // seu context/hook

// Componente
export const DanfeComContext = () => {
  const { token } = useAuth();
  const { addToast } = useNotifications();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!token) {
    return <div>❌ Faça login primeiro</div>;
  }

  return (
    <>
      <AbaDanfeEtiquetaBling token={token} addToast={addToast} />
    </>
  );
};

// ============================================================================
// EXEMPLO 8: Com Carregamento de Token Dinâmico
// Token vindo de settings/database
// ============================================================================

export const DanfeComTokenDinamico = () => {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Buscar token de settings/database
    const buscarToken = async () => {
      try {
        const response = await fetch('/api/settings/bling-token');
        const data = await response.json();
        setToken(data.token);
      } catch (error) {
        console.error('Erro ao buscar token:', error);
      } finally {
        setIsLoading(false);
      }
    };

    buscarToken();
  }, []);

  if (isLoading) return <div>Carregando...</div>;
  if (!token) return <div>❌ Configure seu token Bling</div>;

  return <AbaDanfeEtiquetaBling token={token} />;
};

// ============================================================================
// EXEMPLO 9: Completo com Error Boundary
// Para tratamento de erros robusto
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class DanfeBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 p-4 rounded border border-red-300">
          <p className="font-bold text-red-900">❌ Erro ao carregar DANFE</p>
          <p className="text-sm text-red-700">{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

// Uso:
export const DanfeComErrorBoundary = () => {
  const token = 'seu-token-bling';

  return (
    <DanfeBoundary>
      <AbaDanfeEtiquetaBling token={token} />
    </DanfeBoundary>
  );
};

// ============================================================================
// EXEMPLO 10: Com Configurações Customizadas
// Personalize conforme necessário
// ============================================================================

interface ConfiguracacaoDanfe {
  limiteMaximoPedidos?: number;
  mostrarRelatorioDetalhado?: boolean;
  autoDownloadZip?: boolean;
  notificarPorEmail?: boolean;
  marketplacePadrao?: 'SHOPEE' | 'MERCADO_LIVRE';
}

const configPadrao: ConfiguracacaoDanfe = {
  limiteMaximoPedidos: 1000,
  mostrarRelatorioDetalhado: true,
  autoDownloadZip: true,
  notificarPorEmail: false,
  marketplacePadrao: 'SHOPEE',
};

export const DanfeComConfiguracao = (config: ConfiguracacaoDanfe = configPadrao) => {
  const token = 'seu-token-bling';

  return (
    <div>
      <h2>Configurações Ativas:</h2>
      <pre>{JSON.stringify(config, null, 2)}</pre>
      <AbaDanfeEtiquetaBling token={token} />
    </div>
  );
};

// ============================================================================
// DICA DE OURO: Combinações Úteis
// ============================================================================

/*
1. INTEGRAÇÃO RÁPIDA (2 linhas):
   <AbaDanfeEtiquetaBling token={token} addToast={addToast} />

2. COM ABAS E MODAL:
   Combine AbaDanfeEtiquetaBling com outras abas

3. BOTÃO + MODAL:
   Use ModalDanfeEtiqueta em um botão existente

4. SERVIÇO DIRETO:
   Para integração com sistemas externos ou automação

5. PROGRAMÁTICO:
   Chamar via API/webhook para processar automaticamente

6. CONTEXT:
   Integrar com seu sistema global de autenticação

7. ERROR BOUNDARY:
   Para capturar erros sem quebrar toda a página

8. TOASTS:
   Notifique o usuário sobre sucesso/erro

9. CONFIGURÁVEL:
   Passe config como props para personalizar

10. RESPONSIVE:
    Cai muito bem em mobile (já está responsivo)
*/

export default {
  BlingPageComDanfe,
  BlingPageComAbas,
  BotaoDanfe,
  BotaoDanfeComEscolha,
  ProcessarDanfeProgramaticamente,
  DanfeComToast,
  DanfeComContext,
  DanfeComTokenDinamico,
  DanfeComErrorBoundary,
  DanfeComConfiguracao,
};
