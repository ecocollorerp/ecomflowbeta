import React, { useState, ReactNode, useMemo } from 'react';
import { GeneralSettings, User, ToastMessage, StockItem, ExpeditionRule, UserRole, UserSetor, ColumnMapping, Setor } from '../types';
import { Download, Upload, Trash2, ArrowLeft, Settings2, Database, ShieldAlert, CheckCircle, Info, FileSpreadsheet, ListTree, Filter, Plus, Calendar as CalendarIcon, PackageOpen, Globe, Terminal, Users, CheckSquare, Square, Building, Loader2, Edit2, X, Check, Link as LinkIcon, UploadCloud, EyeOff, Eye, ChevronDown, ChevronRight, RefreshCw, AlertTriangle, Save, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { syncDatabase } from '../lib/supabaseClient';
import ConfirmDbResetModal from '../components/ConfirmDbResetModal';
import ConfirmClearHistoryModal from '../components/ConfirmClearHistoryModal';

interface ConfiguracoesGeraisPageProps {
    setCurrentPage: (page: string) => void;
    generalSettings: GeneralSettings;
    onSaveGeneralSettings: (settings: GeneralSettings) => void;
    currentUser: User | null;
    onBackupData: () => void;
    onResetDatabase: (adminPassword: string) => Promise<{ success: boolean; message?: string }>;
    onClearScanHistory: (adminPassword: string) => Promise<{ success: boolean; message?: string }>;
    addToast: (message: string, type: ToastMessage['type']) => void;
    stockItems: StockItem[];
    users: User[];
    sectors: Setor[];
    onAddSector: (name: string) => Promise<boolean>;
    onDeleteSector: (id: string) => void;
    onEditSector?: (id: string, newName: string) => Promise<boolean>;
}

type ConfigTab = 'sistema' | 'mapeamento' | 'manutencao';

export const ConfiguracoesGeraisPage: React.FC<ConfiguracoesGeraisPageProps> = (props) => {
    const { setCurrentPage, generalSettings, onSaveGeneralSettings, addToast, stockItems, users, onBackupData, onResetDatabase, onClearScanHistory, sectors, onAddSector, onDeleteSector, onEditSector } = props;
    
    const [activeTab, setActiveTab] = useState<ConfigTab>('sistema');
    const [settings, setSettings] = useState<GeneralSettings>(generalSettings);
    const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
    const [sampleData, setSampleData] = useState<any[]>([]);
    
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
    const [newSectorName, setNewSectorName] = useState('');
    const [isAddingSector, setIsAddingSector] = useState(false);
    const [editingSectorId, setEditingSectorId] = useState<string | null>(null);
    const [editingSectorName, setEditingSectorName] = useState('');
    const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());

    const togglePanel = (canal: string) => {
        setExpandedPanels(prev => {
            const next = new Set(prev);
            if (next.has(canal)) next.delete(canal); else next.add(canal);
            return next;
        });
    };
    const allChannelsList = useMemo(() => ['ml', 'shopee', 'site', ...(settings.customStores || []).map(cs => cs.id)], [settings.customStores]);
    const showAllPanels = () => setExpandedPanels(new Set(allChannelsList));
    const hideAllPanels = () => setExpandedPanels(new Set());
    const allExpanded = expandedPanels.size > 0 && expandedPanels.size === allChannelsList.length;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            
            const isML = file.name.toLowerCase().includes('vendas') || file.name.toLowerCase().includes('mercado');
            const isTikTok = file.name.toLowerCase().includes('tiktok') || file.name.toLowerCase().includes('tik_tok');
            const startRow = isML ? 5 : 0;

            const headers = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, range: startRow })[0] || [];
            setDetectedHeaders(headers);

            const data = XLSX.utils.sheet_to_json(sheet, { range: startRow });
            setSampleData(data.slice(0, 1000));

            // Auto-expand o painel correspondente
            const detectedCanal = isML ? 'ml' : isTikTok ? 'site' : 'shopee';
            setExpandedPanels(new Set([detectedCanal]));

            addToast(`${headers.length} colunas detectadas (${isML ? 'Mercado Livre' : isTikTok ? 'TikTok Shop' : 'Shopee'}). Configure os filtros abaixo.`, 'info');
        } catch (error) {
            addToast('Erro ao ler planilha.', 'error');
        }
    };

    const getMappingForChannel = (canalId: string): any => {
        const key = canalId.toLowerCase();
        if (['ml', 'shopee', 'site'].includes(key)) return settings.importer[key as 'ml' | 'shopee' | 'site'] || {};
        return (settings as any)[`importer_${key}`] || {};
    };

    const updateMapping = (canalId: string, field: string, value: any) => {
        const key = canalId.toLowerCase();
        if (['ml', 'shopee', 'site'].includes(key)) {
            setSettings(prev => ({...prev, importer: {...prev.importer, [key]: { ...prev.importer[key as 'ml' | 'shopee' | 'site'], [field]: value }}}));
        } else {
            setSettings(prev => ({...prev, [`importer_${key}`]: { ...((prev as any)[`importer_${key}`] || {}), [field]: value }}));
        }
    };

    const toggleStatusValue = (canalId: string, value: string) => {
        const current = getMappingForChannel(canalId).acceptedStatusValues || [];
        const valueTrimmed = value.trim();
        const newValues = current.includes(valueTrimmed) ? current.filter((v: string) => v !== valueTrimmed) : [...current, valueTrimmed];
        updateMapping(canalId, 'acceptedStatusValues', newValues);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'reportLogoBase64' | 'customReportImageBase64' | 'pptxTemplateBase64') => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onloadend = () => {
            setSettings(prev => ({ ...prev, [field]: reader.result as string }));
            addToast(`Arquivo carregado com sucesso!`, 'success');
        };
        reader.readAsDataURL(file);
    };

    const toggleFeeColumn = (canalId: string, header: string) => {
        const current = getMappingForChannel(canalId).fees || [];
        const newFees = current.includes(header) ? current.filter((f: string) => f !== header) : [...current, header];
        updateMapping(canalId, 'fees', newFees);
    };

    const Section: React.FC<{title: string, icon: ReactNode, children: ReactNode, className?: string}> = ({title, icon, children, className}) => (
        <div className={`bg-white p-6 rounded-2xl border border-gray-200 shadow-sm ${className}`}>
            <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-3 uppercase tracking-tighter">{icon} {title}</h2>
            {children}
        </div>
    );
    
    const TabButton: React.FC<{tabId: ConfigTab, label: string, icon: ReactNode}> = ({ tabId, label, icon }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`flex items-center gap-2 px-6 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tabId ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
        >
            {icon} {label}
        </button>
    );

    const MapRow = ({ label, field, canalId, editable }: { label: string, field: string, canalId: string, editable?: boolean }) => {
        const val = getMappingForChannel(canalId)[field] as string;
        const OFF_VALUE = '__OFF__';
        return (
            <div className="flex flex-col gap-1 w-full">
                <label className="text-[10px] font-black text-gray-400 uppercase">{label}</label>
                {editable ? (
                    <input
                        type="text"
                        value={val || ''}
                        onChange={e => updateMapping(canalId, field, e.target.value)}
                        placeholder="Nome da coluna (opcional)"
                        className="p-2 border rounded-xl text-xs bg-gray-50 focus:ring-2 focus:ring-blue-500 font-bold outline-none"
                    />
                ) : (
                    <select value={val || ''} onChange={e => updateMapping(canalId, field, e.target.value)} className={`p-2 border rounded-xl w-full text-xs font-bold ${val === OFF_VALUE ? 'bg-red-50 text-red-500 border-red-200' : 'bg-gray-50 border-gray-200 focus:ring-2 focus:ring-blue-500'}`}>
                        <option value="">-- Selecione ou Auto --</option>
                        <option value={OFF_VALUE}>🚫 Desativado (Off)</option>
                        {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        {val && val !== OFF_VALUE && !detectedHeaders.includes(val) && (<option value={val}>{val} (Salvo)</option>)}
                    </select>
                )}
            </div>
        );
    };

    const FeeSelector = ({ canalId }: { canalId: string }) => {
        const fees = getMappingForChannel(canalId).fees || [];
        return (
            <div className="mt-4">
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Taxas e Descontos a Abater (Múltiplos)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-3 border rounded-2xl bg-slate-50 border-slate-100">
                    {detectedHeaders.length > 0 ? detectedHeaders.map(h => (<button key={h} onClick={() => toggleFeeColumn(canalId, h)} className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${fees.includes(h) ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'}`}><div className="flex-shrink-0">{fees.includes(h) ? <CheckSquare size={18}/> : <Square size={18} className="text-slate-300"/>}</div><span className="text-[11px] font-bold uppercase truncate">{h}</span></button>)) : (<div className="col-span-full py-6 text-center"><p className="text-xs text-slate-400 font-medium uppercase italic">Suba uma planilha de exemplo para listar as colunas de taxas.</p></div>)}
                </div>
            </div>
        );
    };

    const StatusFilterSettings = ({ canalId }: { canalId: string }) => {
        const OFF_VALUE = '__OFF__';
        const statusCol = getMappingForChannel(canalId).statusColumn;
        const savedValues = getMappingForChannel(canalId).acceptedStatusValues || [];
        const uniqueValuesInFile = useMemo(() => { if (!statusCol || statusCol === OFF_VALUE || sampleData.length === 0) return []; const values = new Set<string>(); sampleData.forEach(row => { const val = row[statusCol]; if (val) values.add(String(val).trim()); }); return Array.from(values).sort(); }, [statusCol, sampleData]);
        const allDisplayValues = Array.from(new Set([...savedValues, ...uniqueValuesInFile])).sort();
        return (<div className="mt-6 p-4 bg-purple-50 rounded-2xl border border-purple-100"><h4 className="text-xs font-black text-purple-800 uppercase mb-3 flex items-center gap-2"><Filter size={14}/> Filtro de Validação de Venda</h4><div className="space-y-4"><MapRow label="Coluna de Status na Planilha" field="statusColumn" canalId={canalId} />{statusCol && statusCol !== OFF_VALUE ? (<div><label className="text-[10px] font-black text-gray-400 uppercase mb-2 block">Selecione os Status Válidos (Venda Concluída)</label>{allDisplayValues.length > 0 ? (<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto bg-white p-2 rounded-xl border border-purple-100">{allDisplayValues.map(val => (<button key={val} onClick={() => toggleStatusValue(canalId, val)} className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${savedValues.includes(val) ? 'bg-purple-600 border-purple-600 text-white' : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'}`}>{savedValues.includes(val) ? <CheckSquare size={16}/> : <Square size={16}/>}<span className="text-xs font-bold truncate">{val}</span></button>))}</div>) : (<div className="flex items-center gap-2"><input type="text" value={savedValues.join(', ')} onChange={(e) => updateMapping(canalId, 'acceptedStatusValues', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} placeholder="ex: concluído, pago" className="flex-1 p-2 border border-slate-300 rounded text-xs bg-white outline-none focus:ring-1 focus:ring-purple-500" /><p className="text-[10px] text-gray-400">Separe por vírgulas</p></div>)}<p className="text-[9px] text-purple-600 mt-2 font-medium flex items-center gap-1"><Info size={12}/> Apenas linhas com os status marcados serão contabilizadas. O restante será desconsiderado.</p></div>) : (<p className="text-xs text-gray-400 italic">Selecione a coluna de status ou use "🚫 Desativado (Off)".</p>)}</div></div>);
    };

    return (
        <div className="max-w-6xl mx-auto pb-32">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setCurrentPage('configuracoes')} className="p-3 bg-white border rounded-2xl shadow-sm hover:bg-gray-50 transition-all active:scale-95 group">
                    <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                </button>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-blue-600 rounded-lg text-white">
                            <ShieldAlert size={18} />
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                            Painel de Administração Global
                        </h1>
                    </div>
                    <p className="text-gray-500 font-bold uppercase text-[9px] tracking-[0.2em]">Configurações Unificadas de Mapeamento, Sistema e Manutenção</p>
                </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-t-2xl">
                <div className="flex border-b">
                    <TabButton tabId="sistema" label="Geral e Setores" icon={<Settings2 size={16}/>} />
                    <TabButton tabId="mapeamento" label="Mapeamento de Planilhas" icon={<FileSpreadsheet size={16}/>} />
                    <TabButton tabId="manutencao" label="Manutenção do Sistema" icon={<Terminal size={16}/>} />
                </div>
            </div>

            <div className="py-8">
                {activeTab === 'sistema' && (
                    <div className="space-y-6">
                        <Section title="Informações da Empresa" icon={<Building className="text-blue-500" />}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase">Nome da Empresa</label>
                                    <input 
                                        type="text" 
                                        value={settings.companyName} 
                                        onChange={e => setSettings(prev => ({...prev, companyName: e.target.value}))}
                                        className="p-3 border rounded-xl text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 font-bold"
                                    />
                                </div>
                            </div>
                        </Section>

                        <Section title="Opções de Exportação (Relatórios)" icon={<FileDown size={24} className="text-emerald-500" />}>
                            <p className="text-xs text-slate-500 mb-4">Personalize o título, a logo, fotos e templates que aparecerão nos relatórios exportados em PDF e PPTX.</p>
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase">Título do Relatório</label>
                                        <input 
                                            type="text" 
                                            value={settings.reportTitle || ''} 
                                            onChange={e => setSettings(prev => ({...prev, reportTitle: e.target.value}))}
                                            placeholder="Ex: Relatório Financeiro Estratégico"
                                            className="p-3 border rounded-xl text-sm bg-gray-50 focus:ring-2 focus:ring-emerald-500 font-bold"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase">Logo Principal (PDF/PPTX)</label>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="file" 
                                                accept="image/*"
                                                onChange={e => handleImageUpload(e, 'reportLogoBase64')}
                                                className="hidden" 
                                                id="upload-logo" 
                                            />
                                            <label htmlFor="upload-logo" className="flex-1 p-2.5 border-2 border-dashed rounded-xl text-xs font-bold text-slate-500 hover:border-emerald-500 hover:text-emerald-600 cursor-pointer text-center bg-slate-50">
                                                {settings.reportLogoBase64 ? 'Alterar Logo' : 'Clique para subir LOGO'}
                                            </label>
                                            {settings.reportLogoBase64 && (
                                                <div className="w-12 h-12 rounded-lg border overflow-hidden bg-white flex items-center justify-center p-1">
                                                    <img src={settings.reportLogoBase64} alt="Preview" className="max-w-full max-h-full object-contain" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-6">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase">Subir Foto para os Slides (Opcional)</label>
                                        <p className="text-[10px] text-slate-400 mb-2">Esta foto aparecerá em uma página dedicada à análise visual no PPTX/PDF.</p>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="file" 
                                                accept="image/*"
                                                onChange={e => handleImageUpload(e, 'customReportImageBase64')}
                                                className="hidden" 
                                                id="upload-custom-img" 
                                            />
                                            <label htmlFor="upload-custom-img" className="flex-1 p-2.5 border-2 border-dashed rounded-xl text-xs font-bold text-slate-500 hover:border-blue-500 hover:text-blue-600 cursor-pointer text-center bg-slate-50">
                                                {settings.customReportImageBase64 ? 'Alterar Foto' : 'Subir FOTO ANALÍTICA'}
                                            </label>
                                            {settings.customReportImageBase64 && (
                                                <div className="w-12 h-12 rounded-lg border overflow-hidden bg-white flex items-center justify-center p-1">
                                                    <img src={settings.customReportImageBase64} alt="Preview" className="max-w-full max-h-full object-contain" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase">Template de PowerPoint (.pptx)</label>
                                        <p className="text-[10px] text-slate-400 mb-2">Importante: O sistema tentará adaptar as cores e o layout ao seu modelo base.</p>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="file" 
                                                accept=".pptx"
                                                onChange={e => handleImageUpload(e, 'pptxTemplateBase64')}
                                                className="hidden" 
                                                id="upload-pptx-template" 
                                            />
                                            <label htmlFor="upload-pptx-template" className={`flex-1 p-2.5 border-2 border-dashed rounded-xl text-xs font-bold cursor-pointer text-center ${settings.pptxTemplateBase64 ? 'border-orange-500 text-orange-600 bg-orange-50' : 'border-slate-300 text-slate-500 bg-slate-50 hover:border-orange-500 hover:text-orange-600'}`}>
                                                {settings.pptxTemplateBase64 ? 'Modelo PPTX Carregado ✅' : 'Subir MODELO PPTX'}
                                            </label>
                                            {settings.pptxTemplateBase64 && (
                                                <button onClick={() => setSettings(prev => ({...prev, pptxTemplateBase64: undefined}))} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Section>

                        <Section title="Modo de Navegação" icon={<Settings2 size={24} className="text-blue-500" />}>
                            <p className="text-xs text-slate-500 mb-4">Escolha como navegar pelo sistema: menu lateral fixo ou barra superior com menus dropdown.</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setSettings(prev => ({ ...prev, navMode: 'sidebar' }))}
                                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${(settings.navMode ?? 'sidebar') === 'sidebar' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:border-blue-200'}`}
                                >
                                    <div className="flex gap-1 items-start">
                                        <div className="w-4 h-8 rounded bg-current opacity-70"></div>
                                        <div className="flex-1 h-8 rounded bg-current opacity-20"></div>
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest">Menu Lateral</span>
                                    <span className="text-[10px] opacity-60 text-center">Sidebar fixa na esquerda</span>
                                </button>
                                <button
                                    onClick={() => setSettings(prev => ({ ...prev, navMode: 'topnav' }))}
                                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${settings.navMode === 'topnav' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:border-blue-200'}`}
                                >
                                    <div className="flex flex-col gap-1 w-full">
                                        <div className="h-2 w-full rounded bg-current opacity-70"></div>
                                        <div className="h-5 w-full rounded bg-current opacity-20"></div>
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest">Menu Superior</span>
                                    <span className="text-[10px] opacity-60 text-center">Barra no topo com dropdowns</span>
                                </button>
                            </div>
                        </Section>

                        <Section title="Gerenciamento de Setores" icon={<Users size={24} className="text-violet-500" />}>
                            <p className="text-xs text-slate-500 mb-6 font-medium">Configure os setores da fábrica. Funcionários podem ser vinculados a múltiplos setores.</p>
                            
                            <div className="flex gap-2 mb-8">
                                <input 
                                    type="text" 
                                    value={newSectorName}
                                    onChange={(e) => setNewSectorName(e.target.value)}
                                    placeholder="Novo setor (ex: Produção, Expedição...)"
                                    className="flex-1 p-3 border rounded-xl text-sm font-bold bg-white focus:ring-2 focus:ring-violet-500"
                                />
                                <button 
                                    onClick={async () => {
                                        if (!newSectorName.trim()) return;
                                        setIsAddingSector(true);
                                        const success = await onAddSector(newSectorName.trim());
                                        setIsAddingSector(false);
                                        if (success) setNewSectorName('');
                                    }}
                                    disabled={isAddingSector || !newSectorName.trim()}
                                    className="px-6 py-2 bg-violet-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-violet-700 disabled:opacity-50"
                                >
                                    {isAddingSector ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                                    ADICIONAR SETOR
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {sectors.length === 0 ? (
                                    <div className="col-span-full py-12 text-center bg-slate-50 rounded-2xl border-2 border-dashed">
                                        <p className="text-slate-400 font-bold">Nenhum setor cadastrado. Adicione um acima.</p>
                                    </div>
                                ) : sectors.map((sector) => {
                                    const sectorUsers = users.filter(u => Array.isArray(u.setor) && (u.setor.includes(sector.name) || u.setor.includes(sector.id)));
                                    return (
                                    <div key={sector.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm group hover:border-violet-300 transition-all">
                                        <div className="flex items-center justify-between">
                                            {editingSectorId === sector.id ? (
                                                <div className="flex-1 flex gap-2 w-full">
                                                    <input 
                                                        type="text" 
                                                        value={editingSectorName}
                                                        onChange={(e) => setEditingSectorName(e.target.value)}
                                                        className="flex-1 p-2 border border-violet-300 rounded-lg text-sm font-bold bg-violet-50 focus:outline-none"
                                                        autoFocus
                                                    />
                                                    <button 
                                                        onClick={async () => {
                                                            if (!editingSectorName.trim() || !onEditSector) return;
                                                            const success = await onEditSector(sector.id, editingSectorName.trim());
                                                            if (success) setEditingSectorId(null);
                                                        }}
                                                        disabled={!editingSectorName.trim()}
                                                        className="p-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50"
                                                    >
                                                        <Check size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => setEditingSectorId(null)}
                                                        className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-slate-800 uppercase">{sector.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase">{sectorUsers.length} funcionário(s)</span>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button 
                                                            onClick={() => {
                                                                setEditingSectorId(sector.id);
                                                                setEditingSectorName(sector.name);
                                                            }}
                                                            className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Editar Setor"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                if (confirm(`Tem certeza que deseja excluir o setor "${sector.name}"? Isso pode afetar funcionários vinculados.`)) {
                                                                    onDeleteSector(sector.id);
                                                                }
                                                            }}
                                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Excluir Setor"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        {sectorUsers.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-1.5">
                                                {sectorUsers.map(u => (
                                                    <span key={u.id} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-violet-50 border border-violet-100 text-violet-700 flex items-center gap-1">
                                                        <Users size={10} /> {u.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    );
                                })}
                            </div>
                        </Section>

                        {/* TikTok Shop Configurações */}
                        <Section title="TikTok Shop — Integração" icon={<Globe className="text-pink-500" />}>
                            <p className="text-xs text-slate-500 mb-4">Configure as credenciais do TikTok Shop para sincronização de pedidos.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase">App Key (Client ID)</label>
                                    <input
                                        type="text"
                                        value={settings.integrations?.tikTokShop?.apiKey || ''}
                                        onChange={e => setSettings(prev => ({ ...prev, integrations: { ...prev.integrations, tikTokShop: { ...prev.integrations?.tikTokShop, apiKey: e.target.value } } }))}
                                        className="p-3 border rounded-xl text-sm bg-gray-50 focus:ring-2 focus:ring-pink-500 font-mono"
                                        placeholder="App Key do TikTok Shop"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase">Shop ID</label>
                                    <input
                                        type="text"
                                        value={settings.integrations?.tikTokShop?.shopId || ''}
                                        onChange={e => setSettings(prev => ({ ...prev, integrations: { ...prev.integrations, tikTokShop: { ...prev.integrations?.tikTokShop, shopId: e.target.value } } }))}
                                        className="p-3 border rounded-xl text-sm bg-gray-50 focus:ring-2 focus:ring-pink-500 font-mono"
                                        placeholder="Shop ID"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase">Nome da Loja (exibição)</label>
                                    <input
                                        type="text"
                                        value={settings.integrations?.tikTokShop?.shopName || ''}
                                        onChange={e => setSettings(prev => ({ ...prev, integrations: { ...prev.integrations, tikTokShop: { ...prev.integrations?.tikTokShop, shopName: e.target.value } } }))}
                                        className="p-3 border rounded-xl text-sm bg-gray-50 focus:ring-2 focus:ring-pink-500 font-bold"
                                        placeholder="Ex: Minha Loja TikTok"
                                    />
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-pink-50 rounded-xl border border-pink-100 mt-auto">
                                    <input
                                        type="checkbox"
                                        id="tiktok-autosync"
                                        checked={settings.integrations?.tikTokShop?.autoSync ?? false}
                                        onChange={e => setSettings(prev => ({ ...prev, integrations: { ...prev.integrations, tikTokShop: { ...prev.integrations?.tikTokShop, autoSync: e.target.checked } } }))}
                                        className="rounded text-pink-600 w-5 h-5"
                                    />
                                    <label htmlFor="tiktok-autosync" className="text-sm font-bold text-pink-800 cursor-pointer">
                                        Sincronização automática habilitada
                                    </label>
                                </div>
                            </div>
                        </Section>

                        {/* Tipos de Loja Personalizados */}
                        <Section title="Tipos de Loja Personalizados" icon={<LinkIcon className="text-indigo-500" />}>
                            <p className="text-xs text-slate-500 mb-4">Crie lojas personalizadas que sempre aparecem nos filtros de canal. Útil para Amazon, Loja Própria, etc.</p>
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    id="new-store-name"
                                    placeholder="Nome da loja (ex: Amazon, Loja Própria...)"
                                    className="flex-1 p-3 border rounded-xl text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500"
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            const val = (e.target as HTMLInputElement).value.trim();
                                            if (!val) return;
                                            const newStore = { id: 'custom_' + Date.now(), name: val };
                                            setSettings(prev => ({ ...prev, customStores: [...(prev.customStores || []), newStore] }));
                                            (e.target as HTMLInputElement).value = '';
                                        }
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        const input = document.getElementById('new-store-name') as HTMLInputElement;
                                        const val = input?.value.trim();
                                        if (!val) return;
                                        const newStore = { id: 'custom_' + Date.now(), name: val };
                                        setSettings(prev => ({ ...prev, customStores: [...(prev.customStores || []), newStore] }));
                                        if (input) input.value = '';
                                    }}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700"
                                >
                                    <Plus size={18} /> ADICIONAR
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {(settings.customStores || []).length === 0 ? (
                                    <div className="col-span-full py-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed">
                                        <p className="text-slate-400 font-bold text-sm">Nenhuma loja personalizada. Adicione acima.</p>
                                    </div>
                                ) : (settings.customStores || []).map(store => (
                                    <div key={store.id} className="flex items-center justify-between p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                        <div>
                                            <p className="text-sm font-black text-indigo-800">{store.name}</p>
                                            <p className="text-[9px] text-indigo-400 font-mono">{store.id}</p>
                                        </div>
                                        <button
                                            onClick={() => setSettings(prev => ({ ...prev, customStores: (prev.customStores || []).filter(s => s.id !== store.id) }))}
                                            className="p-1.5 text-indigo-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    </div>
                )}

                {activeTab === 'mapeamento' && (
                     <Section title="Mapeamento de Planilhas" icon={<FileSpreadsheet className="text-emerald-500" />}>
                        <div className="p-6 bg-emerald-50 rounded-2xl border-2 border-dashed border-emerald-200 text-center mb-6 group hover:bg-emerald-100 transition-all">
                            <input type="file" id="sample-upload" className="hidden" onChange={handleFileUpload} />
                            <label htmlFor="sample-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                <UploadCloud size={24} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                                <div>
                                    <p className="font-bold text-emerald-900 text-sm">Subir Planilha de Exemplo</p>
                                    <p className="text-xs text-emerald-600">Para extrair e ticar as colunas de taxas dinamicamente</p>
                                </div>
                            </label>
                        </div>

                        <div className="flex justify-end mb-4">
                            <button onClick={allExpanded ? hideAllPanels : showAllPanels} className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-all hover:shadow-md bg-white text-gray-600 border-gray-200 hover:border-blue-400 hover:text-blue-600">
                                {allExpanded ? <EyeOff size={16}/> : <Eye size={16}/>}
                                {allExpanded ? 'Recolher Todos' : 'Exibir Todos'}
                            </button>
                        </div>

                        <div className={allExpanded ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-3'}>
                            {[
                                { id: 'ml', name: 'Mercado Livre', type: 'system' },
                                { id: 'shopee', name: 'Shopee', type: 'system' },
                                { id: 'site', name: 'Padrão (Site/Outros)', type: 'system' },
                                ...(settings.customStores || []).map(cs => ({ id: cs.id, name: cs.name, type: 'custom' }))
                            ].map(canal => (
                                <div key={canal.id} className="bg-gray-50/50 rounded-2xl border overflow-hidden">
                                    <button onClick={() => togglePanel(canal.id)} className="w-full flex items-center justify-between p-4 hover:bg-gray-100 transition-colors">
                                        <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                            {canal.name}
                                            {canal.type === 'custom' && <span className="text-[9px] font-normal text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider border border-indigo-100">Personalizado</span>}
                                        </h3>
                                        <div className="flex items-center gap-2 text-gray-400">
                                            {expandedPanels.has(canal.id) ? <Eye size={18} className="text-blue-500"/> : <EyeOff size={18}/>}
                                            {expandedPanels.has(canal.id) ? <ChevronDown size={18}/> : <ChevronRight size={18}/>}
                                        </div>
                                    </button>
                                    {expandedPanels.has(canal.id) && (
                                        <div className="p-4 pt-0 space-y-4 animate-in fade-in">
                                            {canal.id === 'site' && (
                                                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 mb-4">
                                                    <div className="flex flex-col gap-1 w-full">
                                                        <label className="text-[10px] font-black text-blue-700 uppercase">Nome de Exibição no Gráfico de Financeiro</label>
                                                        <input
                                                            type="text"
                                                            value={settings.importer.site.storeName || ''}
                                                            onChange={e => updateMapping('site', 'storeName', e.target.value)}
                                                            placeholder="Ex: Minha Loja"
                                                            className="p-2 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 font-bold outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            
                                            <div className="space-y-6">
                                                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                                                    <h4 className="text-xs font-black text-blue-800 uppercase mb-4 flex items-center gap-2">
                                                        <PackageOpen size={14}/> Dados do Pedido (Importação)
                                                    </h4>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <MapRow label="ID do Pedido (Loja/Bling)" field="orderId" canalId={canal.id} />
                                                        <MapRow label="Código do Produto (SKU)" field="sku" canalId={canal.id} />
                                                        <MapRow label="Quantidade" field="qty" canalId={canal.id} />
                                                        <MapRow label="Rastreio / Tracking" field="tracking" canalId={canal.id} />
                                                        <MapRow label="Data da Venda" field="date" canalId={canal.id} />
                                                        <MapRow label="Nome do Cliente" field="customerName" canalId={canal.id} />
                                                        <MapRow label="CPF/CNPJ do Cliente" field="customerCpf" canalId={canal.id} />
                                                    </div>
                                                </div>

                                                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                                                    <h4 className="text-xs font-black text-emerald-800 uppercase mb-4 flex items-center gap-2">
                                                        <Database size={14}/> Dados Financeiros (Relatórios e DRE)
                                                    </h4>
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <MapRow label="Valor Bruto da Venda" field="priceGross" canalId={canal.id} />
                                                            <MapRow label="Frete / Envio / Dedutíveis (Opcional)" field="shippingFee" canalId={canal.id} />
                                                            <MapRow label="Valor Líquido Recebido" field="priceNet" canalId={canal.id} />
                                                        </div>
                                                        <FeeSelector canalId={canal.id} />
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="border-t border-gray-200 mt-4 pt-4">
                                                <StatusFilterSettings canalId={canal.id} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {activeTab === 'manutencao' && (
                    <Section title="Manutenção do Banco de Dados" icon={<Terminal className="text-slate-800" />}>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <button onClick={async () => { await syncDatabase(); addToast('Banco de dados sincronizado!', 'success'); }} className="flex flex-col items-center p-4 bg-blue-50 border rounded-xl hover:bg-blue-100"><RefreshCw size={20} className="mb-2 text-blue-600" /><span className="text-xs font-bold text-blue-800">Sincronizar Estrutura</span></button>
                            <button onClick={onBackupData} className="flex flex-col items-center p-4 bg-green-50 border rounded-xl hover:bg-green-100"><Download size={20} className="mb-2 text-green-600" /><span className="text-xs font-bold text-green-800">Backup dos Dados</span></button>
                            <button onClick={() => setIsClearHistoryModalOpen(true)} className="flex flex-col items-center p-4 bg-orange-50 border rounded-xl hover:bg-orange-100"><History size={20} className="mb-2 text-orange-600" /><span className="text-xs font-bold text-orange-800">Limpar Bipagens</span></button>
                            <button onClick={() => setIsResetModalOpen(true)} className="sm:col-span-3 flex items-center justify-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100"><AlertTriangle size={20} className="text-red-600" /><span className="text-sm font-bold text-red-800">Resetar Banco de Dados (Apagar TUDO)</span></button>
                        </div>
                    </Section>
                )}
            </div>

            <div className="fixed bottom-8 right-8 z-50">
                <button onClick={() => onSaveGeneralSettings(settings)} className="bg-blue-600 text-white px-12 py-5 rounded-2xl font-black text-xl shadow-2xl shadow-blue-200 hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                    <Save size={28}/> SALVAR TUDO
                </button>
            </div>

            <ConfirmDbResetModal isOpen={isResetModalOpen} onClose={() => setIsResetModalOpen(false)} onConfirmReset={onResetDatabase} />
            <ConfirmClearHistoryModal isOpen={isClearHistoryModalOpen} onClose={() => setIsClearHistoryModalOpen(false)} onConfirmClear={onClearScanHistory} />
        </div>
    );
};
