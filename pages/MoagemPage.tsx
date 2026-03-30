import React, { useState, useMemo } from 'react';
import { StockItem, GrindingBatch, User, GeneralSettings } from '../types';
import {
    Recycle, PlusCircle, User as UserIcon, Search,
    TrendingUp, TrendingDown, Award, Calendar
} from 'lucide-react';
import AddGrindingModal from '../components/AddGrindingModal';
import GrindingBatchList from '../components/GrindingBatchList';

import { canAccessPage } from '../lib/accessControl';

type PeriodFilter = 'today' | '7d' | '30d' | 'custom';
const MEDALS = ['🥇', '🥈', '🥉'];

interface MoagemPageProps {
    stockItems: StockItem[];
    grindingBatches: GrindingBatch[];
    onAddNewGrinding: (data: { sourceCode: string; sourceQty: number; outputCode: string; outputName: string; outputQty: number; mode: 'manual' | 'automatico'; userId?: string; userName: string; batchName?: string }) => void;
    currentUser: User;
    onDeleteBatch: (batchId: string) => Promise<boolean>;
    users: User[];
    generalSettings: GeneralSettings;
}

const getTodayString = () => new Date().toISOString().split('T')[0];

const MoagemPage: React.FC<MoagemPageProps> = ({
    stockItems, grindingBatches, onAddNewGrinding, currentUser, onDeleteBatch, users, generalSettings
}) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [periodFilter, setPeriodFilter]     = useState<PeriodFilter>('today');
    const [customDate,   setCustomDate]       = useState(getTodayString());
    const [searchTerm,   setSearchTerm]       = useState('');

    const grindableItems = useMemo(() => stockItems.filter(i => i.kind === 'INSUMO'), [stockItems]);
    const moagemUsers    = useMemo(() => {
        return users.filter(u => canAccessPage(u, 'moagem', generalSettings));
    }, [users, generalSettings]);

    const dateCutoff = useMemo((): Date | null => {
        const now = new Date();
        if (periodFilter === 'today') { const d = new Date(now); d.setHours(0,0,0,0); return d; }
        if (periodFilter === '7d')  return new Date(now.getTime() - 7  * 86400000);
        if (periodFilter === '30d') return new Date(now.getTime() - 30 * 86400000);
        return new Date(customDate + 'T00:00:00');
    }, [periodFilter, customDate]);

    const filteredBatches = useMemo(() => {
        const lower = searchTerm.toLowerCase();
        return grindingBatches.filter(batch => {
            if (!batch.createdAt || isNaN(batch.createdAt.getTime())) return false;
            if (periodFilter === 'custom') {
                if (batch.createdAt.toISOString().split('T')[0] !== customDate) return false;
            } else {
                if (dateCutoff && batch.createdAt < dateCutoff) return false;
            }
            if (lower) {
                const hay = `${batch.sourceInsumoName} ${batch.outputInsumoName} ${batch.userName}`.toLowerCase();
                if (!hay.includes(lower)) return false;
            }
            return true;
        });
    }, [grindingBatches, dateCutoff, periodFilter, customDate, searchTerm]);

    const stats = useMemo(() => ({
        totalLotes:   filteredBatches.length,
        kgProduzidos: filteredBatches.reduce((s, b) => s + b.outputQtyProduced, 0),
        kgUsados:     filteredBatches.reduce((s, b) => s + b.sourceQtyUsed, 0),
        operadores:   new Set(filteredBatches.map(b => b.userId || b.userName)).size,
    }), [filteredBatches]);

    const ranking = useMemo(() => {
        const map = new Map<string, { name: string; total: number }>();
        filteredBatches.forEach(b => {
            const key = b.userId || b.userName;
            const cur = map.get(key) || { name: b.userName, total: 0 };
            cur.total += b.outputQtyProduced;
            map.set(key, cur);
        });
        return Array.from(map.values()).sort((a, b) => b.total - a.total);
    }, [filteredBatches]);

    const handleConfirm = (data: Parameters<typeof onAddNewGrinding>[0]) => {
        onAddNewGrinding(data);
        setIsAddModalOpen(false);
    };

    const periodLabel = periodFilter === 'today' ? 'Hoje'
        : periodFilter === '7d'  ? 'Últimos 7 dias'
        : periodFilter === '30d' ? 'Últimos 30 dias'
        : new Date(customDate + 'T12:00:00').toLocaleDateString('pt-BR');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Moagem</h1>
                    <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">Controle de Lotes e Produção por Operador</p>
                </div>
                <button onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center text-xs font-black bg-blue-600 text-white px-5 py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 uppercase tracking-widest">
                    <PlusCircle size={16} className="mr-2"/>Lançar Nova Moagem
                </button>
            </div>

            {/* Filtros */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                    <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Buscar insumo, produto ou operador..."
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 font-bold focus:ring-blue-500 focus:border-blue-500"/>
                </div>
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                    {(['today','7d','30d','custom'] as PeriodFilter[]).map(f => (
                        <button key={f} onClick={() => setPeriodFilter(f)}
                            className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest transition-all ${periodFilter === f ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-blue-500'}`}>
                            {f === 'today' ? 'Hoje' : f === '7d' ? '7 dias' : f === '30d' ? '30 dias' : 'Data'}
                        </button>
                    ))}
                </div>
                {periodFilter === 'custom' && (
                    <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400"/>
                        <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)}
                            className="text-xs font-bold border border-gray-200 rounded-xl px-3 py-2 bg-slate-50 focus:ring-blue-500"/>
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 rounded-xl"><Recycle size={20} className="text-blue-600"/></div>
                    <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Lotes</p><p className="text-2xl font-black text-slate-800">{stats.totalLotes}</p></div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 rounded-xl"><TrendingUp size={20} className="text-emerald-600"/></div>
                    <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kg Produzidos</p><p className="text-2xl font-black text-emerald-700">{stats.kgProduzidos.toFixed(2)}</p></div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-red-50 rounded-xl"><TrendingDown size={20} className="text-red-500"/></div>
                    <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kg Consumidos</p><p className="text-2xl font-black text-red-600">{stats.kgUsados.toFixed(2)}</p></div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                    <div className="p-2.5 bg-amber-50 rounded-xl"><UserIcon size={20} className="text-amber-600"/></div>
                    <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Operadores</p><p className="text-2xl font-black text-amber-700">{stats.operadores}</p></div>
                </div>
            </div>

            {/* Lista + Ranking */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-200 shadow-xl">
                    <h2 className="text-base font-black text-slate-800 uppercase tracking-tighter mb-4 flex items-center gap-2">
                        <Recycle size={18} className="text-blue-600"/>
                        Lotes — {periodLabel}
                        {filteredBatches.length > 0 && (
                            <span className="ml-auto text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                {filteredBatches.length} lote{filteredBatches.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </h2>
                    {filteredBatches.length === 0 ? (
                        <div className="py-16 text-center text-gray-400">
                            <Recycle size={40} className="mx-auto mb-3 opacity-20"/>
                            <p className="font-black text-sm">Nenhum lote encontrado</p>
                            <p className="text-xs mt-1">Tente ajustar os filtros ou lançar uma nova moagem</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                            <GrindingBatchList grindingBatches={filteredBatches} currentUser={currentUser} onDeleteBatch={onDeleteBatch}/>
                        </div>
                    )}
                </div>

                <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xl">
                    <h2 className="text-base font-black text-slate-800 uppercase tracking-tighter mb-4 flex items-center gap-2">
                        <Award size={18} className="text-amber-500"/>Ranking — {periodLabel}
                    </h2>
                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 text-center text-white mb-5">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Total Produzido</p>
                        <p className="text-4xl font-black mt-1">{stats.kgProduzidos.toFixed(2)}<span className="text-xl font-bold ml-1 opacity-80">kg</span></p>
                    </div>
                    {ranking.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">Sem dados para o período.</p>
                    ) : (
                        <div className="space-y-3">
                            {ranking.map((user, i) => {
                                const pct = stats.kgProduzidos > 0 ? (user.total / stats.kgProduzidos) * 100 : 0;
                                const bar = i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-700' : 'bg-blue-400';
                                return (
                                    <div key={user.name}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm font-black text-slate-700 flex items-center gap-1.5">
                                                <span className="text-base">{MEDALS[i] ?? `#${i+1}`}</span>{user.name}
                                            </span>
                                            <span className="text-xs font-black text-gray-500">
                                                {user.total.toFixed(2)} kg <span className="text-gray-300">({pct.toFixed(0)}%)</span>
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                            <div className={`${bar} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }}/>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <AddGrindingModal
                isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}
                insumos={grindableItems} stockItems={stockItems}
                onConfirm={handleConfirm} users={moagemUsers}
                currentUser={currentUser} generalSettings={generalSettings}
            />
        </div>
    );
};

export default MoagemPage;
