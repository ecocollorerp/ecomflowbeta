import React, { useState, useMemo } from 'react';
import { StockItem, WeighingBatch, WeighingType, User } from '../types';
import {
    Weight, PlusCircle, User as UserIcon, Calendar,
    TrendingUp, Scale, Award, Clock
} from 'lucide-react';
import AddWeighingModal from '../components/AddWeighingModal';
import WeighingBatchList from '../components/WeighingBatchList';

interface PesagemPageProps {
    stockItems: StockItem[];
    weighingBatches: WeighingBatch[];
    onAddNewWeighing: (insumoCode: string, quantity: number, type: WeighingType, userId: string) => void;
    currentUser: User;
    onDeleteBatch: (batchId: string) => Promise<boolean>;
    users: User[];
}

const MEDALS = ['🥇', '🥈', '🥉'];
const getTodayString = () => new Date().toISOString().split('T')[0];

export const PesagemPage: React.FC<PesagemPageProps> = ({ stockItems, weighingBatches, onAddNewWeighing, currentUser, onDeleteBatch, users }) => {
    const [isAddWeighingModalOpen, setIsAddWeighingModalOpen] = useState(false);
    const [filterDate, setFilterDate] = useState(getTodayString());

    const weighableItems = useMemo(() => stockItems.filter(item => item.kind === 'PROCESSADO'), [stockItems]);
    const pesagemUsers = useMemo(() => users.filter(user => Array.isArray(user.setor) && user.setor.includes('PESAGEM')), [users]);

    const handleConfirmNewWeighing = (insumoCode: string, quantity: number, type: WeighingType, userId: string) => {
        onAddNewWeighing(insumoCode, quantity, type, userId);
        setIsAddWeighingModalOpen(false);
    };
    
    const filteredBatches = useMemo(() => {
        return weighingBatches.filter(batch => {
            if (!batch.createdAt || isNaN(batch.createdAt.getTime())) return false;
            const batchDateStr = batch.createdAt.toISOString().split('T')[0];
            return batchDateStr === filterDate;
        });
    }, [weighingBatches, filterDate]);

    const summary = useMemo(() => {
        if (filteredBatches.length === 0) return { total: 0, lotes: 0, byUser: [] };
        const total = filteredBatches.reduce((sum, batch) => sum + batch.initialQty, 0);
        const lotes = filteredBatches.length;
        const byUserMap = new Map<string, { name: string, total: number, count: number }>();
        filteredBatches.forEach(batch => {
            const userStats = byUserMap.get(batch.userId) || { name: batch.createdBy, total: 0, count: 0 };
            userStats.total += batch.initialQty;
            userStats.count += 1;
            byUserMap.set(batch.userId, userStats);
        });
        const byUser = Array.from(byUserMap.values()).sort((a, b) => b.total - a.total);
        return { total, lotes, byUser };
    }, [filteredBatches]);

    const isToday = filterDate === getTodayString();
    const dateLabel = isToday ? 'Hoje' : new Date(filterDate + 'T12:00:00').toLocaleDateString('pt-BR');

    return (
        <div className="space-y-6">
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex justify-between items-center flex-wrap gap-4 border-b border-slate-200 pb-6">
                <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3 uppercase tracking-tighter">
                    <Scale size={40} className="text-violet-600 bg-violet-100 p-2 rounded-2xl shadow-sm" />
                    Pesagem
                </h1>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                        <Calendar size={14} className="text-slate-400" />
                        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                            className="bg-transparent font-bold text-sm text-slate-700 outline-none" />
                    </div>
                    <button onClick={() => setIsAddWeighingModalOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-violet-700 transition-all shadow-lg shadow-violet-100">
                        <PlusCircle size={16} /> Nova Pesagem
                    </button>
                </div>
            </div>

            {/* ── KPI Cards ──────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Pesado', value: `${summary.total.toFixed(1)} kg`, icon: Weight, color: 'text-violet-700', iconColor: 'text-violet-500', bg: 'bg-violet-50' },
                    { label: 'Lotes', value: summary.lotes, icon: TrendingUp, color: 'text-blue-700', iconColor: 'text-blue-500', bg: 'bg-blue-50' },
                    { label: 'Operadores', value: summary.byUser.length, icon: UserIcon, color: 'text-emerald-700', iconColor: 'text-emerald-500', bg: 'bg-emerald-50' },
                    { label: 'Período', value: dateLabel, icon: Clock, color: 'text-slate-700', iconColor: 'text-slate-500', bg: 'bg-slate-50' },
                ].map(card => (
                    <div key={card.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <card.icon size={16} className={card.iconColor} />
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{card.label}</span>
                        </div>
                        <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Tabela de lotes ────────────────────────────── */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-violet-600 to-purple-500 px-6 py-4 flex items-center gap-3">
                        <Weight size={20} className="text-white/80" />
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-widest">Lotes Lançados</h2>
                            <p className="text-[10px] text-white/70 font-bold">{filteredBatches.length} lote(s) no período</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
                        <WeighingBatchList
                            weighingBatches={filteredBatches}
                            currentUser={currentUser}
                            onDeleteBatch={onDeleteBatch}
                        />
                    </div>
                    {filteredBatches.length === 0 && (
                        <div className="px-6 py-14 text-center">
                            <Scale size={40} className="mx-auto mb-3 text-slate-200" />
                            <p className="font-black text-sm text-slate-400">Nenhum lote registrado</p>
                            <p className="text-[11px] text-slate-300 mt-1">Clique em <span className="font-black">Nova Pesagem</span> para começar.</p>
                        </div>
                    )}
                </div>

                {/* ── Painel lateral: Resumo + Ranking ──────────── */}
                <div className="space-y-4">
                    {/* Card destaque total */}
                    <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-3xl shadow-xl p-6 text-center">
                        <p className="text-[10px] font-black text-violet-200 uppercase tracking-widest mb-1">Total Pesado no Dia</p>
                        <p className="text-5xl font-black text-white">{summary.total.toFixed(1)}</p>
                        <p className="text-sm font-bold text-violet-200 mt-1">quilogramas</p>
                    </div>

                    {/* Ranking */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
                            <Award size={16} className="text-amber-500" />
                            <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Ranking de Pesagem</h3>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {summary.byUser.length > 0 ? summary.byUser.map((user, index) => {
                                const pct = summary.total > 0 ? (user.total / summary.total) * 100 : 0;
                                const initial = user.name.charAt(0).toUpperCase();
                                return (
                                    <div key={user.name} className="px-5 py-3.5 flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-black text-sm flex-shrink-0">
                                            {index < 3 ? MEDALS[index] : initial}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-sm font-bold text-slate-700 truncate">{user.name}</span>
                                                <span className="text-xs font-black text-violet-600 ml-2 whitespace-nowrap">{user.total.toFixed(1)} kg</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1.5">
                                                <div className="bg-violet-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">{user.count} lote(s) · {pct.toFixed(0)}%</p>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="px-5 py-10 text-center">
                                    <UserIcon size={30} className="mx-auto mb-2 text-slate-200" />
                                    <p className="text-xs text-slate-400 font-bold">Nenhuma pesagem no período.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <AddWeighingModal 
                isOpen={isAddWeighingModalOpen} 
                onClose={() => setIsAddWeighingModalOpen(false)} 
                insumos={weighableItems} 
                stockItems={stockItems}
                onConfirm={handleConfirmNewWeighing} 
                users={pesagemUsers} 
                currentUser={currentUser}
            />
        </div>
    );
};

export default PesagemPage;