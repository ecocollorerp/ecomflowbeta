// ============================================================================
// EXEMPLO_COPIAR_COLAR.tsx
// Copie e Cole este código em sua página para adicionar DANFE + Etiqueta REAL
// ============================================================================

// ============================================================================
// OPÇÃO 1: Integração Simples (COMECE POR AQUI)
// ============================================================================

import React from 'react';
import { AbaDanfeEtiquetaProntoUso } from '../components/AbaDanfeEtiquetaProntoUso';

export const MinhaPageBlingOpcao1 = () => {
  // 1. Pegue seu token (de onde quiser: localStorage, context, props, etc)
  const token = localStorage.getItem('tokenBling') || '';

  // 2. Crie uma função de notificação (ou use console.log)
  const addToast = (msg: string, tipo: 'success' | 'error' | 'info') => {
    console.log(`[${tipo.toUpperCase()}] ${msg}`);
    // Se tiver react-toastify ou outra lib, use:
    // toast[tipo](msg);
  };

  // 3. Apenas adicione o componente
  return (
    <div>
      <h1>Integração Bling</h1>
      <AbaDanfeEtiquetaProntoUso token={token} addToast={addToast} />
    </div>
  );
};

// ============================================================================
// OPÇÃO 2: Com Verificação de Token
// ============================================================================

export const MinhaPageBlingOpcao2 = () => {
  const token = localStorage.getItem('tokenBling');

  if (!token) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-300 rounded">
        <p className="font-bold text-yellow-900">⚠️ Token não configurado</p>
        <p className="text-sm text-yellow-800">
          Configure seu token Bling antes de usar este recurso
        </p>
      </div>
    );
  }

  return (
    <AbaDanfeEtiquetaProntoUso
      token={token}
      addToast={(msg, tipo) => console.log(`[${tipo}] ${msg}`)}
    />
  );
};

// ============================================================================
// OPÇÃO 3: Com react-toastify
// ============================================================================

import { toast } from 'react-toastify';

export const MinhaPageBlingOpcao3 = () => {
  const token = localStorage.getItem('tokenBling') || '';

  return (
    <AbaDanfeEtiquetaProntoUso
      token={token}
      addToast={(msg, tipo) => {
        if (tipo === 'success') toast.success(msg);
        else if (tipo === 'error') toast.error(msg);
        else toast.info(msg);
      }}
    />
  );
};

// ============================================================================
// OPÇÃO 4: Com Context/Redux
// ============================================================================

import { useSelector } from 'react-redux';

export const MinhaPageBlingOpcao4 = () => {
  // Assumindo que você tem um store Redux com token
  const token = useSelector((state: any) => state.bling.token);
  const dispatch = useSelector((state: any) => state.notifications.dispatch);

  const addToast = (msg: string, tipo: 'success' | 'error' | 'info') => {
    dispatch({ type: 'ADD_NOTIFICATION', payload: { msg, tipo } });
  };

  return <AbaDanfeEtiquetaProntoUso token={token} addToast={addToast} />;
};

// ============================================================================
// OPÇÃO 5: Com Abas (se sua página já tem abas)
// ============================================================================

export const MinhaPageBlingComAbas = () => {
  const [abaAtiva, setAbaAtiva] = React.useState('danfe');
  const token = localStorage.getItem('tokenBling') || '';

  return (
    <div>
      {/* Navigation */}
      <div className="flex gap-2 border-b mb-4">
        <button
          onClick={() => setAbaAtiva('danfe')}
          className={`px-4 py-2 font-bold ${
            abaAtiva === 'danfe' ? 'border-b-2 border-blue-600 text-blue-600' : ''
          }`}
        >
          📦 DANFE + Etiqueta
        </button>
        <button
          onClick={() => setAbaAtiva('outro')}
          className={`px-4 py-2 font-bold ${
            abaAtiva === 'outro' ? 'border-b-2 border-blue-600 text-blue-600' : ''
          }`}
        >
          Outra Aba
        </button>
      </div>

      {/* Conteúdo */}
      {abaAtiva === 'danfe' && (
        <AbaDanfeEtiquetaProntoUso token={token} />
      )}
      {abaAtiva === 'outro' && <div>Conteúdo da outra aba...</div>}
    </div>
  );
};

// ============================================================================
// OPÇÃO 6: Usar o Modal Diretamente (sem a aba)
// ============================================================================

import { ModalDanfeEtiquetaReal } from '../components/ModalDanfeEtiquetaReal';

export const BotaoDanfeSimples = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const token = localStorage.getItem('tokenBling') || '';

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
      >
        🖨️ Gerar DANFE + Etiqueta
      </button>

      <ModalDanfeEtiquetaReal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        token={token}
        addToast={(msg, tipo) => console.log(`[${tipo}] ${msg}`)}
      />
    </>
  );
};

// ============================================================================
// OPÇÃO 7: Usar o Serviço Diretamente (Programático)
// ============================================================================

import { danfeSimplificadoComEtiquetaService } from '../services/danfeSimplificadoComEtiquetaService';

export const ProcessarDanfeProgramaticamente = async (token: string) => {
  try {
    // Buscar pedidos
    console.log('🔍 Buscando pedidos...');
    const { pedidos, comEtiqueta, semEtiqueta } =
      await danfeSimplificadoComEtiquetaService.buscarPedidosComEtiquetaDisponivel(
        token,
        10, // quantidade
        'SHOPEE'
      );

    console.log(`✅ ${comEtiqueta} com etiqueta, ❌ ${semEtiqueta} sem`);

    // Processar
    console.log('⚙️ Processando...');
    const resultado =
      await danfeSimplificadoComEtiquetaService.processarPedidosParaDanfeEtiqueta(
        pedidos,
        'usuario@email.com'
      );

    console.log(`✅ ${resultado.totalSucesso} sucesso, ❌ ${resultado.totalErros} erros`);

    // Gerar ZIP
    const zip = await danfeSimplificadoComEtiquetaService.gerarZipDosArquivos(
      resultado.arquivos
    );

    // Download
    const url = URL.createObjectURL(zip);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'danfe-etiquetas.zip';
    a.click();

    console.log('✅ Download realizado!');
  } catch (error) {
    console.error('❌ Erro:', error);
  }
};

// Usar:
// <button onClick={() => ProcessarDanfeProgramaticamente(token)}>
//   Processar Agora
// </button>

// ============================================================================
// OPÇÃO 8: Com Error Boundary (tratamento de erros)
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class DanfeErrorBoundary extends React.Component<
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
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded">
          <p className="font-bold text-red-900">❌ Erro ao carregar DANFE + Etiqueta</p>
          <p className="text-sm text-red-700">{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded"
          >
            Recarregar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Uso:
// <DanfeErrorBoundary>
//   <AbaDanfeEtiquetaProntoUso token={token} />
// </DanfeErrorBoundary>

// ============================================================================
// EXEMPLO COMPLETO: Token + Toast + Abas + Error Boundary
// ============================================================================

export const MinhaPageBlingCompleta = () => {
  // Estado
  const [abaAtiva, setAbaAtiva] = React.useState('danfe');
  const [toasts, setToasts] = React.useState<
    { id: string; msg: string; tipo: 'success' | 'error' | 'info' }[]
  >([]);

  // Token
  const token = localStorage.getItem('tokenBling') || '';

  // Toast function
  const addToast = (msg: string, tipo: 'success' | 'error' | 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, msg, tipo }]);

    // Remover após 5 segundos
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  return (
    <DanfeErrorBoundary>
      <div className="min-h-screen bg-gray-100">
        {/* Toasts */}
        <div className="fixed top-4 right-4 space-y-2 z-40">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-4 py-2 rounded shadow-lg text-white ${
                t.tipo === 'success'
                  ? 'bg-green-600'
                  : t.tipo === 'error'
                    ? 'bg-red-600'
                    : 'bg-blue-600'
              }`}
            >
              {t.msg}
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="container mx-auto">
          {/* Abas */}
          <div className="flex gap-2 border-b bg-white p-4">
            <button
              onClick={() => setAbaAtiva('danfe')}
              className={`px-4 py-2 font-bold ${
                abaAtiva === 'danfe' ? 'border-b-2 border-purple-600 text-purple-600' : ''
              }`}
            >
              📦 DANFE + Etiqueta
            </button>
            <button
              onClick={() => setAbaAtiva('importacao')}
              className={`px-4 py-2 font-bold ${
                abaAtiva === 'importacao'
                  ? 'border-b-2 border-purple-600 text-purple-600'
                  : ''
              }`}
            >
              📥 Importação
            </button>
          </div>

          {/* Conteúdo */}
          <div className="bg-white">
            {abaAtiva === 'danfe' && (
              <AbaDanfeEtiquetaProntoUso token={token} addToast={addToast} />
            )}
            {abaAtiva === 'importacao' && (
              <div className="p-4">Sua page de importação aqui...</div>
            )}
          </div>
        </div>
      </div>
    </DanfeErrorBoundary>
  );
};

// ============================================================================
// QUAL OPÇÃO USAR?
// ============================================================================

/*
COMECE COM:
→ OPÇÃO 1: Integração Simples (mais rápido)

SE TEM ABAS:
→ OPÇÃO 5: Com Abas

SE TEM REDUX:
→ OPÇÃO 4: Com Context/Redux

SE TEM react-toastify:
→ OPÇÃO 3: Com react-toastify

SE QUER USAR DIRETO:
→ OPÇÃO 7: Serviço Diretamente

SE QUER TUDO:
→ EXEMPLO COMPLETO: Página com tudo integrado
*/

export default MinhaPageBlingOpcao1;
