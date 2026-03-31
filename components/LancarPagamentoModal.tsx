import React, { useState, useMemo } from 'react';
import { X, Plus, CreditCard, Calendar, DollarSign, Truck, User, Package, Tag, Building2, FileText, ChevronRight, Check, Trash2 } from 'lucide-react';
import { DespesaCategoria, DespesaFornecedor, DespesaLancamento, DespesaParcela, StockItem, User as UserType } from '../types';

interface LancarPagamentoModalProps {
    isOpen: boolean;
    onClose: () => void;
    categorias: DespesaCategoria[];
    fornecedores: DespesaFornecedor[];
    onSaveCategorias: (cats: DespesaCategoria[]) => void;
    onSaveFornecedores: (forns: DespesaFornecedor[]) => void;
    onLancar: (lancamento: DespesaLancamento) => void;
    stockItems: StockItem[];
    users: UserType[];
}

const LancarPagamentoModal: React.FC<LancarPagamentoModalProps> = ({
    isOpen, onClose, categorias, fornecedores, onSaveCategorias, onSaveFornecedores, onLancar, stockItems, users
}) => {
    // Etapa: 'tipo' | 'form'
    const [step, setStep] = useState<'tipo' | 'form'>('tipo');
    const [tipo, setTipo] = useState<'mensal' | 'faturado'>('mensal');

    // Categoria
    const [categoriaId, setCategoriaId] = useState('');
    const [showAddCategoria, setShowAddCategoria] = useState(false);
    const [newCategoriaName, setNewCategoriaName] = useState('');

    // Fornecedor
    const [fornecedorMode, setFornecedorMode] = useState<'existente' | 'novo' | 'generico'>('generico');
    const [fornecedorId, setFornecedorId] = useState('');
    const [newFornecedorNome, setNewFornecedorNome] = useState('');
    const [newFornecedorCnpj, setNewFornecedorCnpj] = useState('');
    const [fornecedorGenerico, setFornecedorGenerico] = useState('');

    // Produto
    const [produtoMode, setProdutoMode] = useState<'insumo' | 'generico'>('generico');
    const [produtoSku, setProdutoSku] = useState('');
    const [produtoGenericoNome, setProdutoGenericoNome] = useState('');

    // Funcionário
    const [funcionarioId, setFuncionarioId] = useState('');

    // Valor e pagamento
    const [valor, setValor] = useState('');
    const [pagoCartao, setPagoCartao] = useState(false);
    const [observacao, setObservacao] = useState('');

    // Competência
    const now = new Date();
    const currentCompetencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [competencia, setCompetencia] = useState(currentCompetencia);
    const [competencias, setCompetencias] = useState<string[]>([currentCompetencia]);

    const toggleCompetencia = (mes: string) => {
        setCompetencias(prev => {
            if (prev.includes(mes)) {
                const next = prev.filter(c => c !== mes);
                return next.length === 0 ? [mes] : next; // manter pelo menos 1
            }
            return [...prev, mes].sort();
        });
    };

    const competenciasOpcoes = useMemo(() => {
        const opts: string[] = [];
        for (let i = -3; i <= 6; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return opts;
    }, []);

    // Faturado
    const [dataInicial, setDataInicial] = useState(new Date().toISOString().split('T')[0]);
    const [parcelasDias, setParcelasDias] = useState<number[]>([]);
    const [parcelasCustomValues, setParcelasCustomValues] = useState<Record<number, string>>({});
    const diasOpcoes = [0, 15, 30, 45, 60, 90];

    const insumos = useMemo(() => stockItems.filter(s => s.kind === 'INSUMO'), [stockItems]);

    const toggleParcela = (dias: number) => {
        setParcelasDias(prev => {
            if (prev.includes(dias)) {
                const next = prev.filter(d => d !== dias);
                setParcelasCustomValues(cv => { const copy = { ...cv }; delete copy[dias]; return copy; });
                return next;
            }
            return [...prev, dias].sort((a, b) => a - b);
        });
    };

    const parcelasPreview = useMemo(() => {
        if (tipo !== 'faturado' || !dataInicial || parcelasDias.length === 0 || !valor) return [];
        const valorNum = parseFloat(valor.replace(',', '.'));
        if (isNaN(valorNum) || valorNum <= 0) return [];
        const valorParcela = valorNum / parcelasDias.length;
        const baseDate = new Date(dataInicial + 'T12:00:00');

        return parcelasDias.map(dias => {
            const customVal = parcelasCustomValues[dias];
            const customNum = customVal !== undefined ? parseFloat(customVal.replace(',', '.')) : NaN;
            const dt = new Date(baseDate);
            dt.setDate(dt.getDate() + dias);
            const comp = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
            return {
                dias,
                data: dt.toISOString().split('T')[0],
                competencia: comp,
                valor: !isNaN(customNum) && customNum >= 0 ? customNum : valorParcela
            };
        });
    }, [tipo, dataInicial, parcelasDias, valor, parcelasCustomValues]);

    const handleAddCategoria = () => {
        if (!newCategoriaName.trim()) return;
        const nova: DespesaCategoria = { id: Date.now().toString(), name: newCategoriaName.trim() };
        onSaveCategorias([...categorias, nova]);
        setCategoriaId(nova.id);
        setNewCategoriaName('');
        setShowAddCategoria(false);
    };

    const handleRemoveCategoria = (id: string) => {
        onSaveCategorias(categorias.filter(c => c.id !== id));
        if (categoriaId === id) setCategoriaId('');
    };

    const handleSubmit = () => {
        const valorNum = parseFloat(valor.replace(',', '.'));
        if (isNaN(valorNum) || valorNum <= 0) return;
        if (!categoriaId) return;

        const catNome = categorias.find(c => c.id === categoriaId)?.name || '';

        let fornNome = '';
        let fornCnpj = '';
        let fornId: string | undefined;

        if (fornecedorMode === 'existente' && fornecedorId) {
            const f = fornecedores.find(f => f.id === fornecedorId);
            fornNome = f?.name || '';
            fornCnpj = f?.cnpj || '';
            fornId = fornecedorId;
        } else if (fornecedorMode === 'novo' && newFornecedorNome) {
            const novoForn: DespesaFornecedor = {
                id: Date.now().toString(),
                name: newFornecedorNome.trim(),
                cnpj: newFornecedorCnpj.trim() || undefined
            };
            onSaveFornecedores([...fornecedores, novoForn]);
            fornNome = novoForn.name;
            fornCnpj = novoForn.cnpj || '';
            fornId = novoForn.id;
        } else {
            fornNome = fornecedorGenerico || 'Genérico';
        }

        const prodNome = produtoMode === 'insumo'
            ? (insumos.find(i => i.code === produtoSku)?.name || produtoSku)
            : produtoGenericoNome || undefined;

        const funcNome = funcionarioId ? (users.find(u => u.id === funcionarioId)?.name || '') : undefined;

        let parcelasGeradas: DespesaParcela[] | undefined;
        if (tipo === 'faturado' && parcelasPreview.length > 0) {
            parcelasGeradas = parcelasPreview.map((p, i) => ({
                id: `${Date.now()}_${i}`,
                despesaId: '',
                competencia: p.competencia,
                dataVencimento: p.data,
                valor: p.valor,
                pago: false
            }));
        }

        const lancamento: DespesaLancamento = {
            id: Date.now().toString(),
            tipo,
            categoriaId,
            categoriaNome: catNome,
            fornecedorId: fornId,
            fornecedorNome: fornNome,
            fornecedorCnpj: fornCnpj,
            produtoSku: produtoMode === 'insumo' ? produtoSku : undefined,
            produtoNome: prodNome,
            funcionarioId: funcionarioId || undefined,
            funcionarioNome: funcNome,
            valor: valorNum,
            pagoCartao,
            competencia: tipo === 'mensal' ? competencias[0] : competencia,
            competencias: tipo === 'mensal' ? competencias : undefined,
            dataLancamento: new Date().toISOString(),
            dataInicial: tipo === 'faturado' ? dataInicial : undefined,
            parcelasDias: tipo === 'faturado' ? parcelasDias : undefined,
            parcelasGeradas,
            observacao: observacao || undefined,
            created_at: new Date().toISOString()
        };

        // Preenche o despesaId nas parcelas
        if (lancamento.parcelasGeradas) {
            lancamento.parcelasGeradas = lancamento.parcelasGeradas.map(p => ({ ...p, despesaId: lancamento.id }));
        }

        onLancar(lancamento);
        resetForm();
        onClose();
    };

    const resetForm = () => {
        setStep('tipo');
        setTipo('mensal');
        setCategoriaId('');
        setFornecedorMode('generico');
        setFornecedorId('');
        setNewFornecedorNome('');
        setNewFornecedorCnpj('');
        setFornecedorGenerico('');
        setProdutoMode('generico');
        setProdutoSku('');
        setProdutoGenericoNome('');
        setFuncionarioId('');
        setValor('');
        setPagoCartao(false);
        setObservacao('');
        setCompetencia(currentCompetencia);
        setCompetencias([currentCompetencia]);
        setDataInicial(new Date().toISOString().split('T')[0]);
        setParcelasDias([]);
        setParcelasCustomValues({});
        setShowAddCategoria(false);
        setNewCategoriaName('');
    };

    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const isValid = useMemo(() => {
        const v = parseFloat(valor.replace(',', '.'));
        if (isNaN(v) || v <= 0) return false;
        if (!categoriaId) return false;
        if (tipo === 'faturado' && parcelasDias.length === 0) return false;
        return true;
    }, [valor, categoriaId, tipo, parcelasDias]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-emerald-50 to-blue-50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
                            <DollarSign className="text-emerald-600" size={24} />
                            Lançar Pagamento
                        </h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                            {step === 'tipo' ? 'Selecione o tipo de débito' : tipo === 'mensal' ? 'Débito Mensal' : 'Débito Faturado'}
                        </p>
                    </div>
                    <button onClick={() => { resetForm(); onClose(); }} className="p-2 bg-white text-gray-400 hover:text-red-500 rounded-xl transition-all shadow-sm">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {step === 'tipo' ? (
                        /* ─── ETAPA 1: Selecionar tipo ─── */
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => { setTipo('mensal'); setStep('form'); }}
                                className="group p-6 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 transition-all text-left space-y-3 hover:shadow-lg"
                            >
                                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                                    <Calendar size={24} className="text-emerald-600 group-hover:text-white transition-colors" />
                                </div>
                                <h3 className="font-black text-slate-800 uppercase text-sm tracking-tight">Débito Mensal</h3>
                                <p className="text-[10px] text-slate-500 leading-relaxed">
                                    Lançamento avulso para a competência selecionada. Ideal para despesas pontuais do mês.
                                </p>
                                <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                                    Selecionar <ChevronRight size={12} />
                                </div>
                            </button>

                            <button
                                onClick={() => { setTipo('faturado'); setStep('form'); }}
                                className="group p-6 rounded-2xl border-2 border-slate-200 hover:border-blue-500 transition-all text-left space-y-3 hover:shadow-lg"
                            >
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                                    <FileText size={24} className="text-blue-600 group-hover:text-white transition-colors" />
                                </div>
                                <h3 className="font-black text-slate-800 uppercase text-sm tracking-tight">Débito Faturado</h3>
                                <p className="text-[10px] text-slate-500 leading-relaxed">
                                    Divide automaticamente em parcelas (15, 30, 45, 60, 90 dias). Cada parcela é lançada na competência do seu vencimento.
                                </p>
                                <div className="flex items-center gap-1 text-blue-600 text-[10px] font-black uppercase tracking-widest">
                                    Selecionar <ChevronRight size={12} />
                                </div>
                            </button>
                        </div>
                    ) : (
                        /* ─── ETAPA 2: Formulário ─── */
                        <>
                            {/* Tipo badge */}
                            <div className="flex items-center gap-2">
                                <button onClick={() => setStep('tipo')} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors">
                                    ← Voltar
                                </button>
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${tipo === 'mensal' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {tipo === 'mensal' ? 'Débito Mensal' : 'Débito Faturado'}
                                </span>
                            </div>

                            {/* ── Categoria ── */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                    <Tag size={12} /> Categoria *
                                </label>
                                <div className="flex gap-2">
                                    <select
                                        value={categoriaId}
                                        onChange={e => setCategoriaId(e.target.value)}
                                        className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                                    >
                                        <option value="">Selecionar categoria...</option>
                                        {categorias.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => setShowAddCategoria(!showAddCategoria)}
                                        className="p-3 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200 transition-colors"
                                        title="Adicionar categoria"
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                                {showAddCategoria && (
                                    <div className="flex gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                        <input
                                            type="text"
                                            value={newCategoriaName}
                                            onChange={e => setNewCategoriaName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleAddCategoria()}
                                            placeholder="Nome da nova categoria"
                                            className="flex-1 p-2 bg-white border rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                                            autoFocus
                                        />
                                        <button onClick={handleAddCategoria} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black hover:bg-emerald-700 transition-colors">
                                            Adicionar
                                        </button>
                                    </div>
                                )}
                                {categorias.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                        {categorias.map(c => (
                                            <span key={c.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border cursor-pointer transition-all ${categoriaId === c.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'}`}
                                                onClick={() => setCategoriaId(c.id)}
                                            >
                                                {c.name}
                                                <button onClick={(e) => { e.stopPropagation(); handleRemoveCategoria(c.id); }} className="ml-0.5 hover:text-red-400">
                                                    <X size={10} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ── Fornecedor ── */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                    <Building2 size={12} /> Fornecedor
                                </label>
                                <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                                    {[
                                        { id: 'generico' as const, label: 'Genérico' },
                                        { id: 'existente' as const, label: 'Cadastrado' },
                                        { id: 'novo' as const, label: 'Novo' },
                                    ].map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setFornecedorMode(opt.id)}
                                            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${fornecedorMode === opt.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                {fornecedorMode === 'generico' && (
                                    <input
                                        type="text"
                                        value={fornecedorGenerico}
                                        onChange={e => setFornecedorGenerico(e.target.value)}
                                        placeholder="Nome genérico (ex: Compra avulsa)"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                )}

                                {fornecedorMode === 'existente' && (
                                    <select
                                        value={fornecedorId}
                                        onChange={e => setFornecedorId(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Selecionar fornecedor...</option>
                                        {fornecedores.map(f => (
                                            <option key={f.id} value={f.id}>{f.name} {f.cnpj ? `(${f.cnpj})` : ''}</option>
                                        ))}
                                    </select>
                                )}

                                {fornecedorMode === 'novo' && (
                                    <div className="space-y-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                        <input
                                            type="text"
                                            value={newFornecedorNome}
                                            onChange={e => setNewFornecedorNome(e.target.value)}
                                            placeholder="Nome do fornecedor *"
                                            className="w-full p-2.5 bg-white border rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <input
                                            type="text"
                                            value={newFornecedorCnpj}
                                            onChange={e => setNewFornecedorCnpj(e.target.value)}
                                            placeholder="CNPJ (opcional)"
                                            className="w-full p-2.5 bg-white border rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* ── Produto ── */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                    <Package size={12} /> Produto / Insumo
                                </label>
                                <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
                                    <button onClick={() => setProdutoMode('generico')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${produtoMode === 'generico' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>
                                        Nome Genérico
                                    </button>
                                    <button onClick={() => setProdutoMode('insumo')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${produtoMode === 'insumo' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>
                                        Insumo do Sistema
                                    </button>
                                </div>

                                {produtoMode === 'generico' ? (
                                    <input
                                        type="text"
                                        value={produtoGenericoNome}
                                        onChange={e => setProdutoGenericoNome(e.target.value)}
                                        placeholder="Descrição do produto/serviço (opcional)"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                ) : (
                                    <select
                                        value={produtoSku}
                                        onChange={e => setProdutoSku(e.target.value)}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Selecionar insumo...</option>
                                        {insumos.map(item => (
                                            <option key={item.code} value={item.code}>
                                                {item.name} ({item.code})
                                            </option>
                                        ))}
                                        {insumos.length === 0 && <option disabled>Nenhum insumo cadastrado</option>}
                                    </select>
                                )}
                            </div>

                            {/* ── Funcionário (opcional) ── */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                    <User size={12} /> Quem Comprou (opcional)
                                </label>
                                <select
                                    value={funcionarioId}
                                    onChange={e => setFuncionarioId(e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Nenhum / Não informar</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* ── Valor e Cartão ── */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                        <DollarSign size={12} /> Valor Total *
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">R$</span>
                                        <input
                                            type="text"
                                            value={valor}
                                            onChange={e => setValor(e.target.value)}
                                            placeholder="0,00"
                                            className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none focus:ring-2 focus:ring-emerald-500 text-right"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                        <CreditCard size={12} /> Forma de Pagamento
                                    </label>
                                    <button
                                        onClick={() => setPagoCartao(!pagoCartao)}
                                        className={`w-full p-3 rounded-xl text-xs font-bold border-2 transition-all flex items-center justify-center gap-2 ${pagoCartao ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300'}`}
                                    >
                                        <CreditCard size={14} />
                                        {pagoCartao ? 'Pago no Cartão' : 'Outro / Não informado'}
                                    </button>
                                </div>
                            </div>

                            {/* ── Competência ── */}
                            {tipo === 'mensal' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                                        <Calendar size={12} /> Competência (Meses) *
                                    </label>
                                    <p className="text-[9px] text-slate-400">Selecione um ou mais meses para lançar esta despesa:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {competenciasOpcoes.map(mes => {
                                            const selected = competencias.includes(mes);
                                            const [y, m] = mes.split('-');
                                            const label = new Date(Number(y), Number(m) - 1, 15).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                                            const isCurrent = mes === currentCompetencia;
                                            return (
                                                <button
                                                    key={mes}
                                                    type="button"
                                                    onClick={() => toggleCompetencia(mes)}
                                                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${selected ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'} ${isCurrent && !selected ? 'border-emerald-200' : ''}`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {competencias.length > 1 && (
                                        <p className="text-[9px] text-emerald-600 font-bold">
                                            {competencias.length} meses selecionados — o valor será lançado em cada competência selecionada
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* ── Faturado: Datas de cobrança ── */}
                            {tipo === 'faturado' && (
                                <div className="space-y-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                    <h4 className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Configuração de Faturamento</h4>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Data Inicial</label>
                                        <input
                                            type="date"
                                            value={dataInicial}
                                            onChange={e => setDataInicial(e.target.value)}
                                            className="w-full p-3 bg-white border border-blue-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Parcelas (selecione os dias)</label>
                                        <div className="flex gap-2">
                                            {diasOpcoes.map(d => (
                                                <button
                                                    key={d}
                                                    onClick={() => toggleParcela(d)}
                                                    className={`flex-1 py-3 rounded-xl text-xs font-black border-2 transition-all ${parcelasDias.includes(d) ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}
                                                >
                                                    {d === 0 ? 'Hoje' : `${d}d`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {parcelasPreview.length > 0 && (
                                        <div className="space-y-2 mt-3">
                                            <div className="flex justify-between items-center">
                                                <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Previsão de Parcelas</label>
                                                <span className="text-[9px] font-bold text-slate-400">Clique no valor para ajustar</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                {parcelasPreview.map((p, i) => {
                                                    const hasCustom = parcelasCustomValues[p.dias] !== undefined;
                                                    const somaAtual = parcelasPreview.reduce((s, pp) => s + pp.valor, 0);
                                                    const valorTotal = parseFloat(valor.replace(',', '.')) || 0;
                                                    const diff = Math.abs(somaAtual - valorTotal);
                                                    return (
                                                        <div key={i} className={`flex justify-between items-center p-2.5 bg-white rounded-lg border ${hasCustom ? 'border-amber-300 bg-amber-50/30' : 'border-blue-100'}`}>
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-5 h-5 bg-blue-600 text-white rounded-md text-[9px] font-black flex items-center justify-center">{i + 1}</span>
                                                                <span className="text-[10px] font-bold text-slate-600">
                                                                    {new Date(p.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                                    {p.dias === 0 && <span className="ml-1 text-[8px] font-black text-emerald-600 bg-emerald-50 px-1 rounded">HOJE</span>}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded">
                                                                    {p.competencia.split('-').reverse().join('/')}
                                                                </span>
                                                                <div className="relative">
                                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">R$</span>
                                                                    <input
                                                                        type="text"
                                                                        value={parcelasCustomValues[p.dias] ?? p.valor.toFixed(2).replace('.', ',')}
                                                                        onChange={e => setParcelasCustomValues(prev => ({ ...prev, [p.dias]: e.target.value }))}
                                                                        className={`w-24 py-1 pl-7 pr-2 text-right text-xs font-black rounded-lg border outline-none focus:ring-2 focus:ring-blue-400 ${hasCustom ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-slate-200 bg-white text-slate-800'}`}
                                                                    />
                                                                </div>
                                                                {hasCustom && (
                                                                    <button
                                                                        onClick={() => setParcelasCustomValues(prev => { const copy = { ...prev }; delete copy[p.dias]; return copy; })}
                                                                        className="text-slate-300 hover:text-red-500 transition-colors"
                                                                        title="Restaurar valor automático"
                                                                    >
                                                                        <X size={12} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {(() => {
                                                const somaAtual = parcelasPreview.reduce((s, p) => s + p.valor, 0);
                                                const valorTotal = parseFloat(valor.replace(',', '.')) || 0;
                                                const diff = somaAtual - valorTotal;
                                                if (Math.abs(diff) > 0.01) {
                                                    return (
                                                        <div className={`text-[9px] font-black p-2 rounded-lg ${diff > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                                            Soma das parcelas: {fmt(somaAtual)} · Valor total: {fmt(valorTotal)} · Diferença: {fmt(Math.abs(diff))} {diff > 0 ? '(excedente)' : '(faltante)'}
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                            <p className="text-[9px] text-blue-500 font-bold">
                                                Somente as parcelas cuja competência coincidir com o mês fiscal aparecerão no resumo geral daquele mês.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Observação ── */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Observação (opcional)</label>
                                <textarea
                                    value={observacao}
                                    onChange={e => setObservacao(e.target.value)}
                                    placeholder="Alguma nota sobre este lançamento..."
                                    rows={2}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {step === 'form' && (
                    <div className="p-6 bg-slate-50 border-t border-gray-100 flex justify-between items-center gap-4">
                        <div className="text-xs text-slate-500">
                            {tipo === 'faturado' && parcelasPreview.length > 0 && (
                                <span className="font-bold">{parcelasPreview.length} parcela(s) de {fmt(parcelasPreview[0]?.valor || 0)}</span>
                            )}
                        </div>
                        <button
                            onClick={handleSubmit}
                            disabled={!isValid}
                            className="px-8 py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Check size={16} /> Lançar Pagamento
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LancarPagamentoModal;
