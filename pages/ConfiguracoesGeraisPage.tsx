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
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
    const [newSectorName, setNewSectorName] = useState('');
    const [isAddingSector, setIsAddingSector] = useState(false);
    const [editingSectorId, setEditingSectorId] = useState<string | null>(null);
    const [editingSectorName, setEditingSectorName] = useState('');

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

    return (
        <div className="max-w-6xl mx-auto pb-32">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setCurrentPage('dashboard')} className="p-3 bg-white border rounded-2xl shadow-sm hover:bg-gray-50 transition-all active:scale-95 group">
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
                    <p className="text-gray-500 font-bold uppercase text-[9px] tracking-[0.2em]">Configurações Unificadas de Sistema e Manutenção</p>
                </div>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-t-2xl">
                <div className="flex border-b">
                    <TabButton tabId="sistema" label="Geral e Integrações" icon={<Settings2 size={16}/>} />
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

                {activeTab === 'manutencao' && (
                    <Section title="Manutenção do Banco de Dados" icon={<Terminal className="text-slate-800" />}>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <button onClick={async () => { await syncDatabase(); addToast('Banco de dados sincronizado!', 'success'); }} className="flex flex-col items-center p-4 bg-blue-50 border rounded-xl hover:bg-blue-100"><RefreshCw size={20} className="mb-2 text-blue-600" /><span className="text-xs font-bold text-blue-800">Sincronizar Estrutura</span></button>
                            <button onClick={onBackupData} className="flex flex-col items-center p-4 bg-green-50 border rounded-xl hover:bg-green-100"><Download size={20} className="mb-2 text-green-600" /><span className="text-xs font-bold text-green-800">Backup dos Dados</span></button>
                            <button onClick={() => setIsClearHistoryModalOpen(true)} className="flex flex-col items-center p-4 bg-orange-50 border rounded-xl hover:bg-orange-100"><RefreshCw size={20} className="mb-2 text-orange-600" /><span className="text-xs font-bold text-orange-800">Limpar Bipagens</span></button>
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
