import React, { useState, useEffect } from 'react';
import { dbClient as supabaseClient } from '../lib/supabaseClient';
import { ArrowRight, Save, Trash2, Plus, Search } from 'lucide-react';

interface ProdutoDanfe {
  codigo: string;
  descricao: string;
  quantidade: number;
  valor: number;
}

interface VinculoSKU {
  id?: string;
  codigoDanfe: string;
  descricaoDanfe: string;
  skuEtiqueta: string;
  skuPrincipal: string;
  nomeProduto: string;
  marketplace: string;
  createdAt?: string;
}

interface SKUDisponivel {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
}

export const VincularProdutoDanfeComSKU: React.FC<{
  produtosDanfe?: ProdutoDanfe[];
  marketplace?: string;
  onVinculoSalvo?: (vinculos: VinculoSKU[]) => void;
}> = ({ produtosDanfe = [], marketplace = 'SHOPEE', onVinculoSalvo }) => {
  const [vinculos, setVinculos] = useState<VinculoSKU[]>([]);
  const [skusDisponiveis, setSkusDisponiveis] = useState<SKUDisponivel[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSavando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [filtro, setFiltro] = useState('');
  const [vinculoEmEdicao, setVinculoEmEdicao] = useState<string | null>(null);

  // Carregar SKUs disponíveis do sistema
  useEffect(() => {
    carregarSkusDisponiveis();
  }, []);

  // Carregar vinculações existentes
  useEffect(() => {
    if (produtosDanfe.length > 0) {
      carregarVinculosExistentes();
    }
  }, [produtosDanfe, marketplace]);

  const carregarSkusDisponiveis = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('product_boms')
        .select('id, codigo, nome, descricao')
        .order('nome');

      if (error) throw error;
      setSkusDisponiveis(data || []);
    } catch (erro) {
      console.error('Erro ao carregar SKUs:', erro);
      setMensagem('❌ Erro ao carregar SKUs disponíveis');
    } finally {
      setLoading(false);
    }
  };

  const carregarVinculosExistentes = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('skus_vinculados')
        .select('*')
        .eq('marketplace', marketplace);

      if (error && error.code !== 'PGRST116') throw error;

      const vinculosExistentes = data || [];

      // Combinar produtos DANFE com vinculações existentes
      const novosVinculos = produtosDanfe.map(prod => {
        const vinculoExistente = vinculosExistentes.find(
          v => v.skuEtiqueta === prod.codigo || v.codigoDanfe === prod.codigo
        );

        return {
          id: vinculoExistente?.id,
          codigoDanfe: prod.codigo,
          descricaoDanfe: prod.descricao,
          skuEtiqueta: prod.codigo,
          skuPrincipal: vinculoExistente?.skuPrincipal || '',
          nomeProduto: vinculoExistente?.nomeProduto || '',
          marketplace,
          createdAt: vinculoExistente?.createdAt,
        };
      });

      setVinculos(novosVinculos);
    } catch (erro) {
      console.error('Erro ao carregar vinculações:', erro);
    }
  };

  const atualizarVinculo = (
    index: number,
    skuPrincipal: string,
    nomeProduto: string
  ) => {
    const novo = [...vinculos];
    novo[index].skuPrincipal = skuPrincipal;
    novo[index].nomeProduto = nomeProduto;
    setVinculos(novo);
  };

  const salvarVinculos = async () => {
    try {
      setSavando(true);
      setMensagem('');

      // Validar que todos têm SKU principal
      const invalidos = vinculos.filter(v => !v.skuPrincipal);
      if (invalidos.length > 0) {
        setMensagem(`❌ ${invalidos.length} produto(s) sem SKU principal vincul`);
        return;
      }

      for (const vinculo of vinculos) {
        if (vinculo.id) {
          // Update
          const { error } = await supabaseClient
            .from('skus_vinculados')
            .update({
              skuPrincipal: vinculo.skuPrincipal,
              nomeProduto: vinculo.nomeProduto,
            })
            .eq('id', vinculo.id);

          if (error) throw error;
        } else {
          // Insert
          const { error } = await supabaseClient
            .from('skus_vinculados')
            .insert({
              codigoDanfe: vinculo.codigoDanfe,
              descricaoDanfe: vinculo.descricaoDanfe,
              skuEtiqueta: vinculo.skuEtiqueta,
              skuPrincipal: vinculo.skuPrincipal,
              nomeProduto: vinculo.nomeProduto,
              marketplace: vinculo.marketplace,
            });

          if (error) throw error;
        }
      }

      setMensagem(`✅ ${vinculos.length} vinculação(ões) salva(s) com sucesso!`);
      onVinculoSalvo?.(vinculos);

      setTimeout(() => setMensagem(''), 3000);
    } catch (erro) {
      console.error('Erro ao salvar vinculações:', erro);
      setMensagem('❌ Erro ao salvar vinculações');
    } finally {
      setSavando(false);
    }
  };

  const skusFiltrados = skusDisponiveis.filter(
    sku =>
      sku.nome.toLowerCase().includes(filtro.toLowerCase()) ||
      sku.codigo.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-2">
          🔗 Vincular Produtos DANFE {marketplace} com SKUs do ERP
        </h3>
        <p className="text-sm text-gray-600">
          Mapeie cada produto da nota fiscal com o SKU principal do seu sistema
        </p>
      </div>

      {mensagem && (
        <div
          className={`p-4 rounded-lg mb-4 ${
            mensagem.includes('✅')
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {mensagem}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left px-4 py-3 font-semibold">Código DANFE</th>
              <th className="text-left px-4 py-3 font-semibold">Descrição</th>
              <th className="text-center px-4 py-3 font-semibold w-12">
                <ArrowRight size={16} className="inline" />
              </th>
              <th className="text-left px-4 py-3 font-semibold">SKU Principal</th>
              <th className="text-left px-4 py-3 font-semibold">Nome do Produto</th>
              <th className="text-center px-4 py-3 font-semibold">Ação</th>
            </tr>
          </thead>
          <tbody>
            {vinculos.map((vinculo, idx) => (
              <tr key={idx} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-mono text-blue-600">{vinculo.codigoDanfe}</span>
                </td>
                <td className="px-4 py-3 text-gray-700">{vinculo.descricaoDanfe}</td>
                <td className="text-center">
                  <ArrowRight size={16} className="text-green-500 mx-auto" />
                </td>
                <td className="px-4 py-3">
                  {vinculoEmEdicao === idx ? (
                    <select
                      value={vinculo.skuPrincipal}
                      onChange={e => {
                        const sku = skusDisponiveis.find(s => s.codigo === e.target.value);
                        atualizarVinculo(idx, e.target.value, sku?.nome || '');
                      }}
                      className="w-full px-2 py-1 border rounded text-sm"
                      onClick={e => e.stopPropagation()}
                    >
                      <option value="">Selecionar SKU...</option>
                      {skusFiltrados.map(sku => (
                        <option key={sku.id} value={sku.codigo}>
                          {sku.codigo} - {sku.nome}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className="font-mono cursor-pointer hover:bg-blue-50 px-2 py-1 rounded block"
                      onClick={() => setVinculoEmEdicao(idx)}
                    >
                      {vinculo.skuPrincipal || '(nenhum)'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700">{vinculo.nomeProduto}</td>
                <td className="text-center">
                  {vinculoEmEdicao === idx ? (
                    <button
                      onClick={() => setVinculoEmEdicao(null)}
                      className="text-green-600 hover:text-green-800 font-semibold"
                    >
                      ✓
                    </button>
                  ) : (
                    <button
                      onClick={() => setVinculoEmEdicao(idx)}
                      className="text-orange-600 hover:text-orange-800"
                      title="Editar vinculação"
                    >
                      <Plus size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={salvarVinculos}
          disabled={salvando || vinculos.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
        >
          <Save size={18} />
          Salvar Vinculações ({vinculos.filter(v => v.skuPrincipal).length}/{vinculos.length})
        </button>

        <button
          onClick={() => {
            setFiltro('');
            carregarVinculosExistentes();
          }}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
        >
          🔄 Recarregar
        </button>
      </div>

      {/* Busca de SKUs */}
      <div className="mt-6 pt-6 border-t">
        <h4 className="font-semibold text-gray-800 mb-3">🔍 Buscar SKUs</h4>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou código do SKU..."
            value={filtro}
            onChange={e => setFiltro(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>

        {filtro && (
          <div className="mt-3 bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
            {skusFiltrados.length === 0 ? (
              <p className="text-gray-600 text-sm">Nenhum SKU encontrado</p>
            ) : (
              <ul className="space-y-2">
                {skusFiltrados.slice(0, 10).map(sku => (
                  <li
                    key={sku.id}
                    className="p-2 bg-white rounded border border-gray-200 hover:bg-blue-50 cursor-pointer"
                  >
                    <div className="font-semibold text-blue-600">{sku.codigo}</div>
                    <div className="text-sm text-gray-700">{sku.nome}</div>
                    {sku.descricao && (
                      <div className="text-xs text-gray-500">{sku.descricao}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Resumo */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-blue-900 mb-2">📊 Resumo</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>✅ Total de Produtos: {vinculos.length}</li>
          <li>
            🔗 Vinculados: {vinculos.filter(v => v.skuPrincipal).length}
          </li>
          <li>
            ⚠️ Pendentes: {vinculos.filter(v => !v.skuPrincipal).length}
          </li>
          <li>📦 Marketplace: {marketplace}</li>
        </ul>
      </div>
    </div>
  );
};

export default VincularProdutoDanfeComSKU;
