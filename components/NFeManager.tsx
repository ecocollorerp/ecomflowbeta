import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Upload,
  Send,
  CheckCircle,
  AlertCircle,
  Loader,
  RotateCcw,
  Lock,
  Eye,
  EyeOff,
  Filter,
  Plus,
  Download,
} from 'lucide-react';

interface NFeManagerProps {
  isAuthenticated: boolean;
  blingToken?: string;
  onStatusChange?: (status: string) => void;
}

interface NFeItem {
  id: string;
  numero: string;
  serie?: string;
  emissao?: number;
  cliente?: { nome?: string } | string;
  valor?: number;
  pedidoId?: string;
  status: string;
  chaveAcesso?: string;
  erroDetalhes?: string;
}

interface CertificadoItem {
  id: string;
  nome: string;
  cnpj: string;
  valido: boolean;
  dataValidade: number;
  tipo: string;
}

interface NFeConfigState {
  cnpj: string;
  uf: string;
  serie: number;
  versaoPadrao: string;
  ambientePadrao: 'HOMOLOGAÇÃO' | 'PRODUÇÃO';
  estrategiaSefaz: 'bling' | 'direto';
}

const defaultConfig: NFeConfigState = {
  cnpj: '',
  uf: 'SP',
  serie: 1,
  versaoPadrao: '4.00',
  ambientePadrao: 'HOMOLOGAÇÃO',
  estrategiaSefaz: 'direto',
};

async function requestJson(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data: any = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const errorMessage = data?.error || data?.message || `Erro HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  return data;
}

const toBase64 = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

export const NFeManager: React.FC<NFeManagerProps> = ({ isAuthenticated, blingToken, onStatusChange }) => {
  const [activeTab, setActiveTab] = useState<'nfes' | 'certificados' | 'config'>('nfes');
  const [nfes, setNfes] = useState<NFeItem[]>([]);
  const [certificados, setCertificados] = useState<CertificadoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCertUpload, setShowCertUpload] = useState(false);
  const [certPassword, setCertPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [filterStatus, setFilterStatus] = useState('TODOS');
  const [selectedCertId, setSelectedCertId] = useState<string>('');
  const [ambienteEnvio, setAmbienteEnvio] = useState<'PRODUÇÃO' | 'HOMOLOGAÇÃO'>('HOMOLOGAÇÃO');
  const [nfeConfig, setNfeConfig] = useState<NFeConfigState>(defaultConfig);

  const setMessage = (type: 'success' | 'error', message: string) => {
    if (type === 'success') {
      setSuccess(message);
      setError(null);
    } else {
      setError(message);
      setSuccess(null);
    }
    if (onStatusChange) onStatusChange(`${type}:${message}`);
  };

  const loadNFes = async () => {
    try {
      setLoading(true);
      const query = filterStatus !== 'TODOS' ? `?status=${encodeURIComponent(filterStatus)}` : '';
      const payload = await requestJson(`/api/nfe/listar${query}`);
      const list = payload?.nfes?.nfes || [];
      setNfes(list);
    } catch (err: any) {
      setMessage('error', err.message || 'Erro ao carregar NFes');
    } finally {
      setLoading(false);
    }
  };

  const loadCertificados = async () => {
    try {
      const payload = await requestJson('/api/nfe/certificados');
      const list = payload?.certificados || [];
      setCertificados(list);
      if (!selectedCertId && list.length > 0) {
        setSelectedCertId(list[0].id);
      }
    } catch (err: any) {
      setMessage('error', err.message || 'Erro ao carregar certificados');
    }
  };

  const loadConfig = async () => {
    try {
      const payload = await requestJson('/api/nfe/configuracao');
      const cfg = payload?.configuracao || {};
      setNfeConfig((prev) => ({
        ...prev,
        cnpj: cfg.cnpj || prev.cnpj,
        uf: cfg.uf || prev.uf,
        serie: Number(cfg.serie || prev.serie || 1),
        versaoPadrao: cfg.versaoPadrao || prev.versaoPadrao,
        ambientePadrao: cfg.ambientePadrao || prev.ambientePadrao,
        estrategiaSefaz: cfg.estrategiaSefaz || prev.estrategiaSefaz,
      }));
    } catch (err: any) {
      setMessage('error', err.message || 'Erro ao carregar configuração NFe');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    loadNFes();
    loadCertificados();
    loadConfig();
  }, [isAuthenticated]);

  const handleCertUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!certPassword.trim()) {
      setMessage('error', 'Digite a senha do certificado');
      return;
    }

    try {
      setLoading(true);
      const arquivo = await toBase64(file);

      await requestJson('/api/nfe/certificado/carregar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-certificado-senha': certPassword,
        },
        body: JSON.stringify({ arquivo }),
      });

      await loadCertificados();
      setCertPassword('');
      setShowCertUpload(false);
      setMessage('success', `✅ Certificado ${file.name} carregado com sucesso`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setMessage('error', err.message || 'Erro ao carregar certificado');
    } finally {
      setLoading(false);
    }
  };

  const handleGerarNFe = async () => {
    const pedidoId = window.prompt('Digite o ID do pedido para gerar a NFe:');
    if (!pedidoId) return;

    try {
      setLoading(true);
      await requestJson('/api/nfe/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedidoId }),
      });
      await loadNFes();
      setMessage('success', `✅ NFe gerada para o pedido ${pedidoId}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setMessage('error', err.message || 'Erro ao gerar NFe');
    } finally {
      setLoading(false);
    }
  };

  const handleAssinarNFe = async (nfeId: string) => {
    const certificadoId = selectedCertId || certificados[0]?.id;
    if (!certificadoId) {
      setMessage('error', 'Carregue e selecione um certificado A1 primeiro');
      return;
    }

    try {
      setLoading(true);
      await requestJson('/api/nfe/assinar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nfeId, certificadoId }),
      });
      await loadNFes();
      setMessage('success', '✅ NFe assinada com sucesso');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setMessage('error', err.message || 'Erro ao assinar NFe');
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarSefaz = async (nfe: NFeItem) => {
    try {
      setLoading(true);
      if (nfeConfig.estrategiaSefaz === 'bling') {
        if (!blingToken) {
          throw new Error('Token do Bling não encontrado para envio via Bling');
        }

        await requestJson('/api/nfe/enviar-bling', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${blingToken}`,
          },
          body: JSON.stringify({
            nfeId: nfe.id,
            pedidoId: nfe.pedidoId,
            ambiente: ambienteEnvio,
            via: 'bling',
          }),
        });
      } else {
        await requestJson('/api/nfe/enviar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nfeId: nfe.id, ambiente: ambienteEnvio }),
        });
      }

      await loadNFes();
      setMessage('success', `✅ NFe enviada para SEFAZ em ${ambienteEnvio}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setMessage('error', err.message || 'Erro ao enviar NFe para SEFAZ');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadXml = async (nfe: NFeItem) => {
    try {
      const response = await fetch(`/api/nfe/${nfe.id}/xml`);
      if (!response.ok) throw new Error('Não foi possível baixar XML');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nfe-${nfe.numero}.xml`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setMessage('error', err.message || 'Erro ao baixar XML');
    }
  };

  const handleSaveConfig = async () => {
    try {
      setLoading(true);
      await requestJson('/api/nfe/configuracao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cnpj: nfeConfig.cnpj,
          uf: nfeConfig.uf,
          serie: nfeConfig.serie,
          versaoPadrao: nfeConfig.versaoPadrao,
          ambientePadrao: nfeConfig.ambientePadrao,
          estrategiaSefaz: nfeConfig.estrategiaSefaz,
        }),
      });
      setMessage('success', '✅ Configurações de NFe salvas');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setMessage('error', err.message || 'Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'AUTORIZADA': return 'bg-green-100 text-green-800';
      case 'REJEITADA': return 'bg-red-100 text-red-800';
      case 'ENVIADA': return 'bg-blue-100 text-blue-800';
      case 'ASSINADA': return 'bg-yellow-100 text-yellow-800';
      case 'CANCELADA': return 'bg-gray-300 text-gray-900';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredNfes = useMemo(
    () => filterStatus === 'TODOS' ? nfes : nfes.filter((nfe) => nfe.status === filterStatus),
    [nfes, filterStatus]
  );

  if (!isAuthenticated) return null;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-purple-600" />
          <h2 className="text-xl font-bold text-gray-800">Gerenciador NFe / SEFAZ</h2>
        </div>
        <p className="text-sm text-gray-600 mt-2">Fluxo real: gerar, assinar com A1, enviar para SEFAZ e baixar XML.</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-red-800">Erro</p>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-800 font-semibold text-sm">{success}</p>
        </div>
      )}

      <div className="flex border-b overflow-x-auto bg-white rounded-lg shadow-sm">
        {[
          { id: 'nfes', label: '📋 Notas Fiscais' },
          { id: 'certificados', label: '🔐 Certificados A1' },
          { id: 'config', label: '⚙️ Configuração SEFAZ' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
              activeTab === tab.id
                ? 'border-purple-600 text-purple-700 bg-purple-50'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'nfes' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Filtrar por Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                >
                  <option value="TODOS">Todas</option>
                  <option value="RASCUNHO">Rascunho</option>
                  <option value="ASSINADA">Assinada</option>
                  <option value="AUTORIZADA">Autorizada</option>
                  <option value="REJEITADA">Rejeitada</option>
                  <option value="CANCELADA">Cancelada</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Ambiente SEFAZ</label>
                <select
                  value={ambienteEnvio}
                  onChange={(e) => setAmbienteEnvio(e.target.value as any)}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                >
                  <option value="HOMOLOGAÇÃO">🧪 Homologação</option>
                  <option value="PRODUÇÃO">🚀 Produção</option>
                </select>
              </div>

              <button
                onClick={handleGerarNFe}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Gerar NFe
              </button>

              <button
                onClick={loadNFes}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Atualizar
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="p-4 text-left font-bold text-gray-700">Número</th>
                    <th className="p-4 text-left font-bold text-gray-700">Pedido</th>
                    <th className="p-4 text-left font-bold text-gray-700">Cliente</th>
                    <th className="p-4 text-left font-bold text-gray-700">Valor</th>
                    <th className="p-4 text-left font-bold text-gray-700">Status</th>
                    <th className="p-4 text-left font-bold text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredNfes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">Nenhuma NFe encontrada</td>
                    </tr>
                  ) : (
                    filteredNfes.map((nfe) => (
                      <tr key={nfe.id} className="hover:bg-gray-50">
                        <td className="p-4 font-mono font-bold text-gray-800">{nfe.numero}</td>
                        <td className="p-4 text-gray-700">{nfe.pedidoId || '-'}</td>
                        <td className="p-4 text-gray-700">{typeof nfe.cliente === 'string' ? nfe.cliente : nfe.cliente?.nome || '-'}</td>
                        <td className="p-4 font-bold text-green-600">
                          {(Number(nfe.valor || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(nfe.status)}`}>
                            {nfe.status}
                          </span>
                          {nfe.erroDetalhes && <p className="text-xs text-red-600 mt-1">⚠️ {nfe.erroDetalhes}</p>}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2 flex-wrap">
                            {(nfe.status === 'RASCUNHO' || nfe.status === 'PENDENTE') && (
                              <button
                                onClick={() => handleAssinarNFe(nfe.id)}
                                className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 font-bold"
                              >
                                🔏 Assinar
                              </button>
                            )}

                            {nfe.status === 'ASSINADA' && (
                              <button
                                onClick={() => handleEnviarSefaz(nfe)}
                                className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 font-bold"
                              >
                                <Send className="w-3 h-3 inline mr-1" />Enviar
                              </button>
                            )}

                            {(nfe.status === 'REJEITADA' || nfe.status === 'ERRO_SEFAZ') && (
                              <button
                                onClick={() => handleEnviarSefaz(nfe)}
                                className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded hover:bg-orange-200 font-bold"
                              >
                                🔄 Reenviar
                              </button>
                            )}

                            <button
                              onClick={() => handleDownloadXml(nfe)}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded hover:bg-gray-200 font-bold"
                            >
                              <Download className="w-3 h-3 inline mr-1" />XML
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'certificados' && (
        <div className="space-y-6">
          {!showCertUpload ? (
            <button
              onClick={() => setShowCertUpload(true)}
              className="w-full flex items-center justify-center gap-2 px-6 py-8 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-dashed border-purple-300 rounded-lg hover:border-purple-500 transition"
            >
              <Upload className="w-5 h-5 text-purple-600" />
              <span className="font-bold text-purple-800">Carregar Certificado Digital A1 (.pfx/.p12)</span>
            </button>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 space-y-4">
              <h3 className="font-bold text-gray-800">Carregar Certificado Digital A1</h3>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Senha do Certificado</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={certPassword}
                    onChange={(e) => setCertPassword(e.target.value)}
                    placeholder="Digite a senha do .pfx"
                    className="w-full p-3 border border-gray-300 rounded-lg pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Arquivo Certificado</label>
                <input
                  type="file"
                  accept=".pfx,.p12"
                  onChange={handleCertUpload}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                />
              </div>

              <button
                onClick={() => {
                  setShowCertUpload(false);
                  setCertPassword('');
                }}
                className="w-full px-4 py-2 bg-gray-200 text-gray-800 font-bold rounded-lg hover:bg-gray-300"
              >
                Fechar Upload
              </button>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 space-y-4">
            <h3 className="font-bold text-gray-800">Certificados Carregados</h3>

            {certificados.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Certificado padrão para assinatura</label>
                <select
                  value={selectedCertId}
                  onChange={(e) => setSelectedCertId(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                >
                  {certificados.map((cert) => (
                    <option key={cert.id} value={cert.id}>{cert.nome} - {cert.cnpj}</option>
                  ))}
                </select>
              </div>
            )}

            {certificados.length === 0 ? (
              <p className="text-gray-600 text-sm">Nenhum certificado carregado</p>
            ) : (
              certificados.map((cert) => (
                <div key={cert.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="font-bold text-gray-800">{cert.nome}</p>
                  <p className="text-sm text-gray-600">CNPJ: {cert.cnpj}</p>
                  <p className="text-xs text-gray-500">Tipo: {cert.tipo} | Válido até: {new Date(cert.dataValidade).toLocaleDateString('pt-BR')}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'config' && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 space-y-6">
          <h3 className="font-bold text-gray-800">Configurações de NFe / SEFAZ</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">CNPJ da Empresa</label>
              <input
                type="text"
                value={nfeConfig.cnpj}
                onChange={(e) => setNfeConfig((prev) => ({ ...prev, cnpj: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">UF</label>
              <select
                value={nfeConfig.uf}
                onChange={(e) => setNfeConfig((prev) => ({ ...prev, uf: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg"
              >
                <option value="SP">São Paulo (SP)</option>
                <option value="RJ">Rio de Janeiro (RJ)</option>
                <option value="MG">Minas Gerais (MG)</option>
                <option value="RS">Rio Grande do Sul (RS)</option>
                <option value="BA">Bahia (BA)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Série de Emissão</label>
              <input
                type="number"
                min={1}
                value={nfeConfig.serie}
                onChange={(e) => setNfeConfig((prev) => ({ ...prev, serie: Number(e.target.value || 1) }))}
                className="w-full p-3 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase mb-2">Estratégia SEFAZ</label>
              <select
                value={nfeConfig.estrategiaSefaz}
                onChange={(e) => setNfeConfig((prev) => ({ ...prev, estrategiaSefaz: e.target.value as 'bling' | 'direto' }))}
                className="w-full p-3 border border-gray-300 rounded-lg"
              >
                <option value="direto">SEFAZ Direto (com A1 local)</option>
                <option value="bling">Via Bling (OAuth)</option>
              </select>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            <p><strong>SEFAZ Direto:</strong> usa certificado A1 carregado na aba de certificados.</p>
            <p><strong>Via Bling:</strong> exige token OAuth ativo do Bling.</p>
          </div>

          <button
            onClick={handleSaveConfig}
            disabled={loading}
            className="w-full px-6 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin inline mr-2" /> : null}
            💾 Salvar Configurações
          </button>
        </div>
      )}
    </div>
  );
};
