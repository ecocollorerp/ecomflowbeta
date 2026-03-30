import React, { useMemo } from 'react';
import { OrderItem } from '../types';
import { Calendar, Truck, AlertTriangle, CheckCircle, Clock, CalendarDays } from 'lucide-react';

interface DailyOverviewWidgetsProps {
    allOrders: OrderItem[];
    dateSourceMode: 'sale_date' | 'import_date';
    onClickAtrasados?: () => void;
    onClickQuickStatus?: (orders: OrderItem[]) => void;
}

const getTodayString = () => new Date().toISOString().split('T')[0];
const getTomorrowString = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
};

const getOrderDateString = (order: OrderItem, source: 'sale_date' | 'import_date'): string | null => {
    if (source === 'import_date' && order.created_at) {
        return order.created_at.split('T')[0];
    }
    const dStr = String(order.data || '');
    if (!dStr) return order.created_at ? order.created_at.split('T')[0] : null;

    if (dStr.includes('-')) return dStr;
    if (dStr.includes('/')) {
        const [d, m, y] = dStr.split('/');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return null;
};

const DailyOverviewWidgets: React.FC<DailyOverviewWidgetsProps> = ({ allOrders, dateSourceMode, onClickAtrasados, onClickQuickStatus }) => {
    const today = getTodayString();
    const tomorrow = getTomorrowString();

    const stats = useMemo(() => {
        // 1. Pedidos da "Data de Venda/Importação" (Hoje)
        const vendasHoje = allOrders.filter(o => {
            const dateStr = getOrderDateString(o, dateSourceMode);
            return dateStr === today;
        });

        // Contar quantos pacotes e pedidos únicos
        const uniqueVendasHoje = new Set(vendasHoje.map(o => o.orderId)).size;
        const totalItensVendasHoje = vendasHoje.length;

        // 2. Envios Pendentes (status = NORMAL ou BIPADO) - considerando data_prevista_envio
        const pendentes = allOrders.filter(o => o.status === 'NORMAL' || o.status === 'BIPADO');
        
        let atrasados = 0;
        let enviosHoje = 0;
        let enviosAmanha = 0;
        let enviosFuturo = 0;
        let semPrevisao = 0;

        pendentes.forEach(o => {
            if (!o.data_prevista_envio) {
                semPrevisao++;
                return;
            }
            // data_prevista_envio usually is YYYY-MM-DD
            const env = o.data_prevista_envio;
            if (env < today) atrasados++;
            else if (env === today) enviosHoje++;
            else if (env === tomorrow) enviosAmanha++;
            else enviosFuturo++;
        });

        return {
            vendasHoje: uniqueVendasHoje,
            itensVendasHoje: totalItensVendasHoje,
            envios: {
                atrasados,
                hoje: enviosHoje,
                amanha: enviosAmanha,
                futuro: enviosFuturo,
                semPrevisao
            }
        };
    }, [allOrders, dateSourceMode, today, tomorrow]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Widget de Vendas (Baseado na aba ativa: Venda vs Importação) */}
            <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5 flex items-center justify-between">
                <div>
                    <h3 className="text-xs font-black uppercase text-blue-600 mb-1 flex items-center gap-2">
                        <Calendar size={14} /> 
                        {dateSourceMode === 'sale_date' ? 'Pedidos Vendidos (Hoje)' : 'Pedidos Importados (Hoje)'}
                    </h3>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-slate-800">{stats.vendasHoje}</span>
                        <span className="text-xs font-bold text-slate-400">pedidos</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 mt-1 bg-slate-100 inline-block px-2 py-0.5 rounded">
                        Total de {stats.itensVendasHoje} itens no dia
                    </p>
                </div>
                <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                    <CheckCircle size={28} />
                </div>
            </div>

            {/* Widget de Envios (Baseado em data_prevista_envio para pedidos em aberto) */}
            <div className="bg-white rounded-2xl border border-orange-100 shadow-sm p-4">
                <h3 className="text-xs font-black uppercase text-orange-600 mb-3 flex items-center gap-2">
                    <Truck size={14} /> Envios Pendentes por Prazo
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Atrasados */}
                    <div className="relative group">
                        <div 
                            onClick={() => {
                                if (stats.envios.atrasados > 0 && onClickQuickStatus) {
                                    const atrasadosList = allOrders.filter(o => (o.status === 'NORMAL' || o.status === 'BIPADO') && o.data_prevista_envio && o.data_prevista_envio < today);
                                    onClickQuickStatus(atrasadosList);
                                } else if (onClickAtrasados) {
                                    onClickAtrasados();
                                }
                            }}
                            className={`p-2 rounded-xl flex flex-col justify-center items-center border transition-all cursor-pointer hover:bg-opacity-80 active:scale-95 h-full ${stats.envios.atrasados > 0 ? 'bg-red-50 border-red-200 shadow-sm shadow-red-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}
                        >
                            <div className="flex items-center gap-1 mb-1">
                                {stats.envios.atrasados > 0 && <AlertTriangle size={10} className="text-red-500" />}
                                <span className={`text-[9px] font-black uppercase tracking-wider ${stats.envios.atrasados > 0 ? 'text-red-600' : 'text-slate-400'}`}>Atrasados</span>
                            </div>
                            <span className={`text-xl font-black ${stats.envios.atrasados > 0 ? 'text-red-700' : 'text-slate-600'}`}>{stats.envios.atrasados}</span>
                        </div>
                        {stats.envios.atrasados > 0 && onClickQuickStatus && (
                            <div 
                                className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-black uppercase px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap shadow-xl z-10 pointer-events-none"
                            >
                                Clique para Mudar Status
                            </div>
                        )}
                    </div>

                    {/* Hoje */}
                    <div className="p-2 rounded-xl flex flex-col justify-center items-center border bg-orange-50 border-orange-200">
                        <div className="flex items-center gap-1 mb-1">
                            <Clock size={10} className="text-orange-500" />
                            <span className="text-[9px] font-black tracking-wider uppercase text-orange-600">Para Hoje</span>
                        </div>
                        <span className="text-xl font-black text-orange-700">{stats.envios.hoje}</span>
                    </div>

                    {/* Mais Prazo */}
                    <div className="p-2 rounded-xl flex flex-col justify-center items-center border bg-green-50 border-green-200">
                        <div className="flex items-center gap-1 mb-1">
                            <CalendarDays size={10} className="text-green-500" />
                            <span className="text-[9px] font-black tracking-wider uppercase text-green-600">Amanhã+</span>
                        </div>
                        <span className="text-xl font-black text-green-700">{stats.envios.amanha + stats.envios.futuro}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DailyOverviewWidgets;
