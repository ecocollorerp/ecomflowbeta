import React, { useState } from 'react';
import { Link, Book, AlertCircle } from 'lucide-react';
import VincularProdutoDanfeComSKU from './VincularProdutoDanfeComSKU';

interface NotaFiscalSaida {
  numero: string;
  idBling: string;
  cliente: {
    nome: string;
    cpfCnpj: string;
  };
  itens: Array<{
    descricao: string;
    codigo: string;
    quantidade: number;
    valor: number;
  }>;
  marketplace?: string;
  rastreio?: string;
}

export const AbaVincularSkuDanfe: React.FC<{
  notaFiscal?: NotaFiscalSaida;
  marketplace?: string;
  onVinculoSalvo?: () => void;
}> = ({
  notaFiscal,
  marketplace = 'SHOPEE',
  onVinculoSalvo,
}) => {
  const [expandido, setExpandido] = useState(false);
  const [mostraTutorial, setMostraTutorial] = useState(!notaFiscal);

  if (!notaFiscal) {
    return (
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="text-orange-600 flex-shrink-0 mt-1" size={24} />
          <div>
            <h3 className="font-bold text-orange-900 mb-2">
              🔗 Vincular Produtos DANFE com SKUs
            </h3>
            <p className="text-sm text-orange-800 mb-3">
              Selecione uma nota fiscal de saída (do Bling) para vincular seus produtos
              com os SKUs do seu sistema ERP. Isso garante que a etiqueta consolidada
              tenha as referências corretas.
            </p>
            <button
              onClick={() => setMostraTutorial(!mostraTutorial)}
              className="text-sm px-3 py-1 bg-orange-200 text-orange-900 rounded hover:bg-orange-300 font-semibold"
            >
              {mostraTutorial ? '✓ Entendi' : '? Como funciona'}
            </button>
          </div>
        </div>

        {mostraTutorial && (
          <div className="mt-4 p-4 bg-white rounded border border-orange-300">
            <h4 className="font-semibold text-gray-800 mb-2">📚 Como Vincular SKUs</h4>
            <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
              <li>Acesse uma nota fiscal de saída gerada do Bling</li>
              <li>Clique em "Vincular SKUs" na seção de impressão</li>
              <li>Você verá uma tabela com todos os produtos da nota</li>
              <li>Para cada produto, selecione o SKU correspondente do seu ERP</li>
              <li>Clique em "Salvar Vinculações"</li>
              <li>As vinculações são salvas e usadas na geração de etiquetas</li>
            </ol>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header da Nota Fiscal */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <div
          onClick={() => setExpandido(!expandido)}
          className="cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Book size={20} className="text-blue-600" />
            <div>
              <h3 className="font-bold text-gray-800">
                Nota Fiscal #{notaFiscal.numero}
              </h3>
              <p className="text-sm text-gray-600">
                {notaFiscal.cliente.nome} • {marketplace}
              </p>
              {notaFiscal.rastreio && (
                <p className="text-xs text-gray-500 mt-1">
                  Rastreio: {notaFiscal.rastreio.substring(0, 15)}...
                </p>
              )}
            </div>
          </div>
          <div className="text-2xl">{expandido ? '▼' : '▶'}</div>
        </div>
      </div>

      {/* Detalhes da Nota */}
      {expandido && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h4 className="font-semibold text-gray-800 mb-3">Produtos da Nota ({notaFiscal.itens.length})</h4>
          <div className="space-y-2">
            {notaFiscal.itens.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start p-2 bg-white rounded border border-gray-200">
                <div className="flex-1">
                  <p className="font-mono text-blue-600 text-sm">{item.codigo}</p>
                  <p className="text-sm text-gray-700">{item.descricao}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-gray-600">Qtd: {item.quantidade}</p>
                  <p className="text-gray-500">R$ {item.valor.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Componente de Vinculação */}
      <VincularProdutoDanfeComSKU
        produtosDanfe={notaFiscal.itens}
        marketplace={marketplace || 'SHOPEE'}
        onVinculoSalvo={() => {
          onVinculoSalvo?.();
        }}
      />

      {/* Info Box */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <h4 className="font-semibold text-green-900 mb-2">✅ Próxima Etapa</h4>
        <p className="text-sm text-green-800">
          Após vincular os SKUs, você poderá gerar a <strong>DANFE Consolidada + Etiqueta</strong>
          que automaticamente usará esses números de SKU na nota fiscal impressa.
        </p>
      </div>
    </div>
  );
};

export default AbaVincularSkuDanfe;
