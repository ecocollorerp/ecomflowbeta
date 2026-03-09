import React, { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { EstoqueProto, StockItem } from '../types';
import { Download, TrendingUp, TrendingDown, Package } from 'lucide-react';

interface EstoquePromtoReportProps {
  estoqueProntoItems: EstoqueProto[];
  stockItems: StockItem[];
  onPrint?: () => void;
}

const EstoquePromtoReport: React.FC<EstoquePromtoReportProps> = ({
  estoqueProntoItems,
  stockItems,
  onPrint
}) => {
  const reportData = useMemo(() => {
    // Agrupar por status e calcular totais
    const statusGrouped = estoqueProntoItems.reduce((acc, item) => {
      const existing = acc.find(g => g.status === item.status);
      if (existing) {
        existing.quantidade += item.quantidade_total;
        existing.disponivel += item.quantidade_disponivel;
        existing.count += 1;
      } else {
        acc.push({
          status: item.status,
          quantidade: item.quantidade_total,
          disponivel: item.quantidade_disponivel,
          count: 1
        });
      }
      return acc;
    }, [] as Array<{ status: string; quantidade: number; disponivel: number; count: number }>);

    // Top 10 itens por quantidade
    const topItens = estoqueProntoItems
      .sort((a, b) => b.quantidade_total - a.quantidade_total)
      .slice(0, 10)
      .map(item => ({
        nome: item.lote_numero || item.stock_item_id || 'Sem identificação',
        quantidade: item.quantidade_total,
        disponivel: item.quantidade_disponivel
      }));

    // Resumo geral
    const totalQuantidade = estoqueProntoItems.reduce((sum, item) => sum + item.quantidade_total, 0);
    const totalDisponivel = estoqueProntoItems.reduce((sum, item) => sum + item.quantidade_disponivel, 0);
    const totalReservado = totalQuantidade - totalDisponivel;

    return {
      statusGrouped,
      topItens,
      totalQuantidade,
      totalDisponivel,
      totalReservado,
      totalBatches: estoqueProntoItems.length
    };
  }, [estoqueProntoItems]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">📊 Relatório Estoque Pronto</h2>
          <p className="text-sm text-gray-500 mt-1">Análise de pacotes prontos para expedição</p>
        </div>
        {onPrint && (
          <button
            onClick={onPrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download size={16} />
            Imprimir
          </button>
        )}
      </div>

      {/* Resumo em Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
          <p className="text-gray-600 text-sm font-medium">Total de Lotes</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{reportData.totalBatches}</p>
          <p className="text-xs text-gray-500 mt-1">pacotes pronto</p>
        </div>

        <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
          <p className="text-gray-600 text-sm font-medium">Quantidade Total</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{reportData.totalQuantidade.toFixed(1)}</p>
          <p className="text-xs text-gray-500 mt-1">unidades</p>
        </div>

        <div className="bg-amber-50 rounded-lg p-4 border-l-4 border-amber-500">
          <p className="text-gray-600 text-sm font-medium">Disponível</p>
          <p className="text-3xl font-bold text-amber-600 mt-2">{reportData.totalDisponivel.toFixed(1)}</p>
          <p className="text-xs text-gray-500 mt-1">pronto para expedição</p>
        </div>

        <div className="bg-red-50 rounded-lg p-4 border-l-4 border-red-500">
          <p className="text-gray-600 text-sm font-medium">Reservado</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{reportData.totalReservado.toFixed(1)}</p>
          <p className="text-xs text-gray-500 mt-1">aguardando processamento</p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Barras - Top 10 Itens */}
        {reportData.topItens.length > 0 && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 10 Itens Pronto</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={reportData.topItens}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="quantidade" fill="#3b82f6" name="Total" />
                <Bar dataKey="disponivel" fill="#10b981" name="Disponível" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Gráfico de Pizza - Distribuição por Status */}
        {reportData.statusGrouped.length > 0 && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Distribuição por Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={reportData.statusGrouped}
                  dataKey="quantidade"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {reportData.statusGrouped.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => value.toFixed(1)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Tabela Detalhada */}
      <div className="border rounded-lg p-4 bg-white overflow-x-auto">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Detalhes Completos</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-gray-700 font-semibold">Lote</th>
              <th className="px-4 py-3 text-left text-gray-700 font-semibold">Item</th>
              <th className="px-4 py-3 text-center text-gray-700 font-semibold">Total</th>
              <th className="px-4 py-3 text-center text-gray-700 font-semibold">Disponível</th>
              <th className="px-4 py-3 text-center text-gray-700 font-semibold">Reservado</th>
              <th className="px-4 py-3 text-center text-gray-700 font-semibold">Status</th>
              <th className="px-4 py-3 text-left text-gray-700 font-semibold">Localização</th>
            </tr>
          </thead>
          <tbody>
            {estoqueProntoItems.map((item, idx) => {
              const reservado = item.quantidade_total - item.quantidade_disponivel;
              const statusColor = {
                'PRONTO': 'bg-green-100 text-green-800',
                'PROCESSANDO': 'bg-amber-100 text-amber-800',
                'EM_FALTA': 'bg-red-100 text-red-800'
              }[item.status] || 'bg-gray-100 text-gray-800';

              return (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{item.lote_numero || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{item.stock_item_id || '-'}</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-800">{item.quantidade_total.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center text-green-600 font-semibold">{item.quantidade_disponivel.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center text-red-600 font-semibold">{reservado.toFixed(1)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{item.localizacao || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {estoqueProntoItems.length === 0 && (
          <div className="text-center py-8">
            <Package className="mx-auto text-gray-300 mb-2" size={48} />
            <p className="text-gray-500">Nenhum estoque pronto encontrado</p>
          </div>
        )}
      </div>

      {/* Resumo de Status */}
      {reportData.statusGrouped.length > 0 && (
        <div className="border rounded-lg p-4 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Resumo por Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {reportData.statusGrouped.map((status, idx) => (
              <div key={idx} className="bg-white rounded-lg p-4 border">
                <p className="text-gray-600 font-medium mb-2">{status.status}</p>
                <div className="space-y-1">
                  <p className="text-sm text-gray-500">Lotes: <span className="font-semibold text-gray-800">{status.count}</span></p>
                  <p className="text-sm text-gray-500">Total: <span className="font-semibold text-gray-800">{status.quantidade.toFixed(1)}</span></p>
                  <p className="text-sm text-gray-500">Disponível: <span className="font-semibold text-green-600">{status.disponivel.toFixed(1)}</span></p>
                  <p className="text-sm text-gray-500">Reservado: <span className="font-semibold text-red-600">{(status.quantidade - status.disponivel).toFixed(1)}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EstoquePromtoReport;
