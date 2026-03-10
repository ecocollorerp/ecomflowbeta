
import React, { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import { Settings, Printer, Trash2, X, FileText, Loader2, Image as ImageIcon, Zap, Link as LinkIcon, PlusCircle, AlertTriangle, Package, File, Eye, History, Clock, CheckCircle2, ExternalLink, ChevronDown, ChevronRight, Search, Copy, LayoutList, CalendarDays } from 'lucide-react';
import { ZplSettings, ExtractedZplData, GeneralSettings, UiSettings, StockItem, SkuLink, User, OrderItem, ZplPlatformSettings, EtiquetaHistoryItem, EtiquetasState } from '../types';
import { buildPdf } from '../services/pdfGenerator';
import LinkSkuModal from '../components/LinkSkuModal';
import CreateProductFromImportModal from '../components/CreateProductFromImportModal';
import { simpleHash } from '../utils/zplUtils';
import { loadPendingZpl, removePendingZplItem, clearPendingZpl, type PendingZplItem } from '../utils/pendingZpl';

// --- Types ---
type ProcessingMode = 'completo' | 'rapido';

interface EtiquetasPageProps {
  settings: ZplSettings;
  onSettingsSave: (newSettings: ZplSettings) => void;
  generalSettings: GeneralSettings;
  uiSettings: UiSettings;
  onSetUiSettings: (settings: (prev: UiSettings) => UiSettings) => void;
  stockItems: StockItem[];
  skuLinks: SkuLink[];
  onLinkSku: (importedSku: string, masterProductSku: string) => Promise<boolean>;
  onUnlinkSku: (importedSku: string) => Promise<boolean>;
  onAddNewItem: (item: Omit<StockItem, 'id'>) => Promise<StockItem | null>;
  etiquetasState: EtiquetasState;
  setEtiquetasState: React.Dispatch<React.SetStateAction<EtiquetasState>>;
  currentUser: User;
  allOrders: OrderItem[];
  etiquetasHistory: EtiquetaHistoryItem[];
  onSaveHistory: (item: Omit<EtiquetaHistoryItem, 'id' | 'created_at'>) => void;
  onGetHistoryDetails: (id: string) => Promise<EtiquetaHistoryItem | null>;
  onProcessZpl: (mode: ProcessingMode) => Promise<void>;
  isProcessing: boolean;
  progressMessage: string;
}

// ... DraggableFooterEditor e SettingsModal permanecem inalterados, copiados do original ...
// Para brevidade, mantendo apenas a parte lógica principal da página.
// --- Draggable Footer Editor ---
const DraggableFooterEditor: React.FC<{
    settings: ZplPlatformSettings['footer'];
    pageWidth_mm: number;
    pageHeight_mm: number;
    imageAreaPercentage: number;
    onChange: (key: keyof ZplPlatformSettings['footer'], value: any) => void;
    previewImageUrl?: string;
}> = ({ settings, pageWidth_mm, pageHeight_mm, imageAreaPercentage, onChange, previewImageUrl }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handlePositionChange = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x_px = e.clientX - rect.left;
        const y_px = e.clientY - rect.top;

        const scaleX = pageWidth_mm / rect.width;
        const scaleY = pageHeight_mm / rect.height;

        onChange('x_position_mm', Math.max(0, x_px * scaleX));
        onChange('y_position_mm', Math.max(0, y_px * scaleY));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        handlePositionChange(e);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            handlePositionChange(e);
        }
    };

    const handleMouseUp = () => setIsDragging(false);
    
    const containerWidth = 200; // Fixed width for preview
    const containerHeight = (pageHeight_mm / pageWidth_mm) * containerWidth;
    const x_px = (settings.x_position_mm / pageWidth_mm) * containerWidth;
    const y_px = (settings.y_position_mm / pageHeight_mm) * containerHeight;
    const imageAreaHeight_px = containerHeight * (imageAreaPercentage / 100);
    
    const placeholderText = settings.template
        .replace('{sku}', 'SKU-EXEMPLO')
        .replace('{name}', 'PRODUTO EXEMPLO')
        .replace('{qty}', '1');

    return (
        <div className="space-y-2">
            <div
                ref={containerRef}
                className="w-full border-2 border-dashed rounded-lg relative cursor-move bg-gray-200"
                style={{ height: `${containerHeight}px` }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                 {previewImageUrl ? (
                    <img 
                        src={previewImageUrl} 
                        alt="Preview da etiqueta"
                        className="absolute top-0 left-1/2 -translate-x-1/2 object-contain object-top pointer-events-none"
                        style={{ height: `${imageAreaHeight_px}px`, width: '100%' }}
                    />
                ) : (
                    <div className="absolute top-0 left-0 w-full bg-white flex items-center justify-center text-gray-400 text-xs" style={{height: `${imageAreaHeight_px}px`}}>
                        Área da Imagem
                    </div>
                )}
                <div 
                    className="absolute p-1 bg-blue-500 bg-opacity-70 text-white text-xs rounded-sm pointer-events-none whitespace-nowrap"
                    style={{ left: `${x_px}px`, top: `${y_px}px` }}
                >
                    {placeholderText}
                </div>
            </div>
        </div>
    );
};


// --- Settings Modal Component ---
const SettingsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    currentSettings: ZplSettings;
    onSave: (newSettings: ZplSettings) => void;
    previews: string[];
    extractedData: Map<number, ExtractedZplData>;
}> = ({ isOpen, onClose, currentSettings, onSave, previews, extractedData }) => {
    const [settings, setSettings] = useState<ZplSettings>(currentSettings);
    const [activeTab, setActiveTab] = useState<'general' | 'shopee' | 'mercadoLivre'>('general');

    React.useEffect(() => {
        if (isOpen) setSettings(currentSettings);
    }, [isOpen, currentSettings]);
    
    const previewImageUrl = useMemo(() => {
        if (previews.length === 0 || extractedData.size === 0) return undefined;
        
        const targetIsMercadoLivre = activeTab === 'mercadoLivre';

        for (let i = 0; i < previews.length; i += 2) {
            const pairData = extractedData.get(i);
            if (pairData?.isMercadoLivre === targetIsMercadoLivre) {
                const labelPreview = previews[i + 1];
                if (labelPreview && labelPreview.startsWith('data:image')) {
                    return labelPreview;
                }
            }
        }
        // Fallback to first available label if no match for the active tab
        for (let i = 1; i < previews.length; i += 2) {
            if (previews[i] && previews[i].startsWith('data:image')) return previews[i];
        }

        return undefined;
    }, [activeTab, previews, extractedData]);

    if (!isOpen) return null;

    const handlePlatformChange = (platform: 'shopee' | 'mercadoLivre', key: keyof ZplPlatformSettings, value: any) => {
        setSettings(prev => ({ ...prev, [platform]: { ...prev[platform], [key]: value }}));
    };
    
    const handlePlatformFooterChange = (platform: 'shopee' | 'mercadoLivre', key: keyof ZplPlatformSettings['footer'], value: any) => {
        setSettings(prev => ({...prev, [platform]: { ...prev[platform], footer: { ...prev[platform].footer, [key]: value }}}));
    };
    
    const handlePresetChange = (platform: 'shopee' | 'mercadoLivre', preset: 'below' | 'above' | 'custom') => {
        handlePlatformFooterChange(platform, 'positionPreset', preset);
    };
    
    const handleRegexChange = (key: keyof ZplSettings['regex'], value: any) => {
         setSettings(prev => ({...prev, regex: { ...prev.regex, [key]: value } }));
    };

    const renderPlatformSettings = (platform: 'shopee' | 'mercadoLivre') => (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-3">Layout da Etiqueta</h3>
                <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div><label className="text-sm font-medium">Área da Imagem da Etiqueta (%)</label><input type="number" value={settings[platform].imageAreaPercentage_even} onChange={e => handlePlatformChange(platform, 'imageAreaPercentage_even', Number(e.target.value))} className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-800"/></div>
                </div>
            </div>
            <div>
                <h3 className="text-lg font-semibold mb-3">Rodapé da Etiqueta</h3>
                <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div>
                        <label className="text-sm font-medium">Posição Padrão</label>
                        <select 
                            value={settings[platform].footer.positionPreset}
                            onChange={e => handlePresetChange(platform, e.target.value as any)}
                            className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-800"
                        >
                            <option value="below">Abaixo da Etiqueta</option>
                            <option value="above">Acima da Etiqueta</option>
                            <option value="custom">Personalizado (Arrastar)</option>
                        </select>
                    </div>

                    {settings[platform].footer.positionPreset === 'custom' ? (
                        <>
                            <DraggableFooterEditor 
                                settings={settings[platform].footer}
                                pageWidth_mm={settings.pageWidth}
                                pageHeight_mm={settings.pageHeight}
                                imageAreaPercentage={settings[platform].imageAreaPercentage_even}
                                onChange={(key, value) => handlePlatformFooterChange(platform, key, value)}
                                previewImageUrl={previewImageUrl}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium">Posição X (mm)</label>
                                    <input type="number" value={settings[platform].footer.x_position_mm.toFixed(0)} onChange={e => handlePlatformFooterChange(platform, 'x_position_mm', Number(e.target.value))} className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-800"/>
                                </div>
                                 <div>
                                    <label className="text-sm font-medium">Posição Y (mm)</label>
                                    <input type="number" value={settings[platform].footer.y_position_mm.toFixed(0)} onChange={e => handlePlatformFooterChange(platform, 'y_position_mm', Number(e.target.value))} className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-800"/>
                                </div>
                            </div>
                        </>
                    ) : (
                         <div>
                            <label className="text-sm font-medium">Espaçamento (mm)</label>
                            <input type="number" value={settings[platform].footer.spacing_mm} onChange={e => handlePlatformFooterChange(platform, 'spacing_mm', Number(e.target.value))} className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-800"/>
                             <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Distância entre a imagem da etiqueta e o texto do rodapé.</p>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-sm font-medium">Tam. Fonte (pt)</label><input type="number" value={settings[platform].footer.fontSize_pt} onChange={e => handlePlatformFooterChange(platform, 'fontSize_pt', Number(e.target.value))} className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-800"/></div>
                        <div><label className="text-sm font-medium">Espaçamento (pt)</label><input type="number" value={settings[platform].footer.lineSpacing_pt} onChange={e => handlePlatformFooterChange(platform, 'lineSpacing_pt', Number(e.target.value))} className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-800"/></div>
                    </div>
                    <div><label className="text-sm font-medium">Fonte</label><select value={settings[platform].footer.fontFamily} onChange={e => handlePlatformFooterChange(platform, 'fontFamily', e.target.value as any)} className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-800"><option value="helvetica">Helvetica</option><option value="times">Times</option><option value="courier">Courier</option></select></div>
                    <div>
                        <label className="text-sm font-medium">Alinhamento do Texto</label>
                        <div className="flex gap-2 mt-1">
                            <button onClick={() => handlePlatformFooterChange(platform, 'textAlign', 'left')} className={`px-3 py-1 text-sm rounded-md border ${settings[platform].footer.textAlign === 'left' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}>Esquerda</button>
                            <button onClick={() => handlePlatformFooterChange(platform, 'textAlign', 'center')} className={`px-3 py-1 text-sm rounded-md border ${settings[platform].footer.textAlign === 'center' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}>Centro</button>
                            <button onClick={() => handlePlatformFooterChange(platform, 'textAlign', 'right')} className={`px-3 py-1 text-sm rounded-md border ${settings[platform].footer.textAlign === 'right' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}>Direita</button>
                        </div>
                    </div>
                     <div><label className="flex items-center"><input type="checkbox" checked={settings[platform].footer.multiColumn} onChange={e => handlePlatformFooterChange(platform, 'multiColumn', e.target.checked)} className="h-4 w-4 rounded"/><span className="ml-2 text-sm">Dividir SKUs em colunas se necessário</span></label></div>
                    <div><label className="text-sm font-medium">Template</label><input type="text" value={settings[platform].footer.template} onChange={e => handlePlatformFooterChange(platform, 'template', e.target.value)} className="mt-1 w-full p-2 border rounded-md font-mono text-sm bg-white dark:bg-gray-800"/><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Variáveis: {'{sku}'}, {'{name}'}, {'{qty}'}.</p></div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-50 rounded-lg shadow-2xl p-6 w-full max-w-3xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">Configurações de Etiquetas</h2><button onClick={onClose}><X size={24} /></button></div>
                
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <div className="flex -mb-px">
                        <button onClick={() => setActiveTab('general')} className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 ${activeTab === 'general' ? 'border-blue-500 text-blue-600' : 'border-transparent'}`}>Geral</button>
                        <button onClick={() => setActiveTab('shopee')} className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 ${activeTab === 'shopee' ? 'border-blue-500 text-blue-600' : 'border-transparent'}`}>Shopee</button>
                        <button onClick={() => setActiveTab('mercadoLivre')} className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 ${activeTab === 'mercadoLivre' ? 'border-blue-500 text-blue-600' : 'border-transparent'}`}>Mercado Livre</button>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto space-y-6 pr-4 pt-6">
                    {activeTab === 'general' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold mb-3">Layout da Página</h3>
                                    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <div>
                                            <label className="text-sm font-medium">Layout do Par (DANFE + Etiqueta)</label>
                                            <div className="flex gap-2 mt-1">
                                                <button onClick={() => setSettings(p => ({...p, pairLayout: 'vertical'}))} className={`px-3 py-1 text-sm rounded-md border ${settings.pairLayout === 'vertical' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}>Vertical</button>
                                                <button onClick={() => setSettings(p => ({...p, pairLayout: 'horizontal'}))} className={`px-3 py-1 text-sm rounded-md border ${settings.pairLayout === 'horizontal' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}>Horizontal</button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className="text-sm font-medium">Largura (mm)</label><input type="number" value={settings.pageWidth} onChange={e => setSettings(p => ({...p, pageWidth: Number(e.target.value)}))} className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-800"/></div>
                                            <div><label className="text-sm font-medium">Altura (mm)</label><input type="number" value={settings.pageHeight} onChange={e => setSettings(p => ({...p, pageHeight: Number(e.target.value)}))} className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-800"/></div>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold mb-3">Renderização e Processamento</h3>
                                    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <div><label className="text-sm font-medium">Qualidade (DPI)</label><select value={settings.dpi} onChange={e => setSettings(p => ({...p, dpi: e.target.value as ZplSettings['dpi']}))} className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-800"><option value="Auto">Auto</option><option value="203">203 DPI</option><option value="300">300 DPI</option></select></div>
                                        <div><label className="text-sm font-medium">Escala da DANFE (%)</label><input type="number" value={settings.sourcePageScale_percent} onChange={e => setSettings(p => ({...p, sourcePageScale_percent: Number(e.target.value)}))} className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-800"/></div>
                                        <div><label className="text-sm font-medium">Modo de Pareamento</label><select value={settings.pairingMode} onChange={e => setSettings(p => ({...p, pairingMode: e.target.value as ZplSettings['pairingMode']}))} className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-gray-800"><option value="Odd/Even Sequential">Ímpar/Par Sequencial</option></select></div>
                                        <div><label className="flex items-center"><input type="checkbox" checked={settings.combineMultiPageDanfe} onChange={e => setSettings(p => ({...p, combineMultiPageDanfe: e.target.checked}))} className="h-4 w-4 rounded"/><span className="ml-2 text-sm">Combinar DANFEs de múltiplas páginas</span></label></div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold mb-3">Padrões de Extração (RegEx)</h3>
                                    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700">
                                        <div><label className="text-sm font-medium">ID do Pedido</label><input type="text" value={settings.regex.orderId} onChange={e => handleRegexChange('orderId', e.target.value)} className="mt-1 w-full p-2 border rounded-md font-mono text-sm bg-white dark:bg-gray-800"/></div>
                                        <div><label className="text-sm font-medium">SKU</label><input type="text" value={settings.regex.sku} onChange={e => handleRegexChange('sku', e.target.value)} className="mt-1 w-full p-2 border rounded-md font-mono text-sm bg-white dark:bg-gray-800"/></div>
                                        <div><label className="text-sm font-medium">Quantidade</label><input type="text" value={settings.regex.quantity} onChange={e => handleRegexChange('quantity', e.target.value)} className="mt-1 w-full p-2 border rounded-md font-mono text-sm bg-white dark:bg-gray-800"/></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'shopee' && renderPlatformSettings('shopee')}
                    {activeTab === 'mercadoLivre' && renderPlatformSettings('mercadoLivre')}
                </div>
                <div className="mt-6 flex justify-end gap-3 border-t pt-4"><button onClick={onClose} className="px-4 py-2 rounded-md bg-gray-50 dark:bg-gray-700">Cancelar</button><button onClick={() => {onSave(settings); onClose();}} className="px-4 py-2 rounded-md bg-blue-600 dark:bg-blue-500 text-white font-semibold">Salvar</button></div>
            </div>
        </div>
    );
};

const ProcessingModeModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelectMode: (mode: ProcessingMode) => void;
}> = ({ isOpen, onClose, onSelectMode }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl w-full max-w-md">
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">Escolha o modo de processamento</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">O modo "Rápido" economiza recursos ignorando a pré-visualização da DANFE, ideal para grandes volumes ou conexões lentas.</p>
                <div className="space-y-4">
                    <button
                        onClick={() => onSelectMode('completo')}
                        className="w-full flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-600 dark:border-blue-500 hover:bg-blue-50 dark:bg-blue-900/20 transition-all"
                    >
                        <Package size={24} className="mr-4 text-blue-600 dark:text-blue-400" />
                        <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-50">Completo (Etiqueta + DANFE)</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Modo padrão. Gera a pré-visualização de todas as páginas.</p>
                        </div>
                    </button>
                    <button
                        onClick={() => onSelectMode('rapido')}
                        className="w-full flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-600 dark:border-blue-500 hover:bg-blue-50 dark:bg-blue-900/20 transition-all"
                    >
                        <Zap size={24} className="mr-4 text-orange-500" />
                        <div>
                            <p className="font-semibold text-gray-900 dark:text-gray-50">Rápido (Apenas Etiqueta)</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Processamento otimizado, ignora a DANFE na pré-visualização.</p>
                        </div>
                    </button>
                </div>
                <div className="mt-6 text-right">
                    <button onClick={onClose} className="text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-gray-50 px-4 py-2">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Main Page Component ---
const EtiquetasPage: React.FC<EtiquetasPageProps> = (props) => {
    const { settings, onSettingsSave, generalSettings, stockItems, skuLinks, onLinkSku, onAddNewItem, etiquetasState, setEtiquetasState, allOrders, currentUser, onSaveHistory, etiquetasHistory, onGetHistoryDetails, onProcessZpl, isProcessing, progressMessage } = props;
    const { zplInput, includeDanfe, zplPages, previews, extractedData, printedIndices, warnings } = etiquetasState;

    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [linkModalState, setLinkModalState] = useState<{isOpen: boolean, skus: string[], color: string}>({isOpen: false, skus: [], color: ''});
    const [createModalState, setCreateModalState] = useState<{isOpen: boolean, data: { sku: string; colorSugerida: string } | null}>({isOpen: false, data: null});
    const [isModeModalOpen, setIsModeModalOpen] = useState(false);
    
    // We handle the loading display via props now, but keep this for PDF generation blocking
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // ── Fila de pendentes de impressão ZPL (lida do localStorage) ────────────
    const [pendingItems, setPendingItems] = useState<PendingZplItem[]>(() => loadPendingZpl());
    const [showPrintedConfirm, setShowPrintedConfirm] = useState(false);
    const [pendingPanelOpen, setPendingPanelOpen] = useState(true);
    const [pendSearch, setPendSearch] = useState('');

    useEffect(() => {
        const refresh = () => setPendingItems(loadPendingZpl());
        window.addEventListener('pendingZplChanged', refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener('pendingZplChanged', refresh);
            window.removeEventListener('storage', refresh);
        };
    }, []);

    const handleConfirmPrinted = (id: string) => {
        removePendingZplItem(id);
        setPendingItems(loadPendingZpl());
    };

    const handleReopenZpl = (item: PendingZplItem) => {
        const win = window.open('about:blank', '_blank');
        if (!win) return;
        const escaped = item.zplContent.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>ZPL — ${item.loteId}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:24px}.header{display:flex;align-items:center;gap:12px;margin-bottom:18px}.title{font-size:22px;font-weight:900;color:#60a5fa}.badge{background:#1e3a5f;color:#93c5fd;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700}textarea{width:100%;height:60vh;background:#0d1117;color:#4ade80;border:1px solid #1e293b;border-radius:10px;padding:14px;font-family:'Courier New',monospace;font-size:11px;resize:vertical;outline:none}.actions{display:flex;gap:10px;margin-top:12px}button{padding:11px 22px;border:none;border-radius:8px;cursor:pointer;font-weight:800;font-size:12px;text-transform:uppercase}.btn-copy{background:#059669;color:#fff}.btn-print{background:#2563eb;color:#fff}@media print{body{background:#fff;color:#000;padding:0}.header,.actions{display:none}textarea{height:auto;background:#fff;color:#000;border:none;font-size:8px}}</style></head><body>
<div class="header"><div class="title">🖨️ ZPL Pendente</div><div class="badge">${item.loteId}</div></div>
<textarea id="zpl" readonly>${escaped}</textarea>
<div class="actions"><button class="btn-copy" onclick="navigator.clipboard.writeText(document.getElementById('zpl').value).then(()=>{this.innerText='✅ Copiado!'})">📋 Copiar ZPL</button><button class="btn-print" onclick="window.print()">🖨️ Imprimir / PDF</button></div>
</body></html>`);
        win.document.close();
    };

    const handleCopyZpl = (item: PendingZplItem) => {
        navigator.clipboard.writeText(item.zplContent).catch(() => {});
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    const skuLinkMap = useMemo(() => new Map(skuLinks.map(link => [link.importedSku.toUpperCase(), link.masterProductSku.toUpperCase()])), [skuLinks]);
    const stockItemMap = useMemo(() => new Map(stockItems.map(item => [item.code.toUpperCase(), item])), [stockItems]);

    const unlinkedSkusData = useMemo(() => {
        if (extractedData.size === 0) return [];
        const allExtractedSkus = Array.from(extractedData.values()).flatMap((d: ExtractedZplData) => d.skus.map(s => s.sku));
        const uniqueSkus = Array.from(new Set(allExtractedSkus));
        return uniqueSkus.filter(sku => !skuLinkMap.has(sku.toUpperCase()) && !stockItemMap.has(sku.toUpperCase())).map(sku => ({ sku, colorSugerida: 'Padrão' }));
    }, [extractedData, skuLinkMap, stockItemMap]);

    // Função helper para agrupar SKUs por produto principal
    const groupSkusByMasterProduct = useCallback((skus: Array<{sku: string, qty: number}>) => {
        const grouped = new Map<string, { product: StockItem | null, totalQty: number, originalSkus: Array<{sku: string, qty: number}> }>();
        
        skus.forEach(s => {
            const masterSku = skuLinkMap.get(s.sku.toUpperCase());
            const productKey = masterSku || s.sku.toUpperCase();
            const product = stockItemMap.get(productKey);
            
            if (grouped.has(productKey)) {
                const existing = grouped.get(productKey)!;
                existing.totalQty += s.qty;
                existing.originalSkus.push(s);
            } else {
                grouped.set(productKey, {
                    product,
                    totalQty: s.qty,
                    originalSkus: [s]
                });
            }
        });
        
        return Array.from(grouped.values());
    }, [skuLinkMap, stockItemMap]);

    const filteredPendingItems = useMemo(() => {
        const q = pendSearch.trim().toLowerCase();
        if (!q) return pendingItems;
        return pendingItems.filter(item =>
            item.loteId.toLowerCase().includes(q) ||
            (item.descricao ?? '').toLowerCase().includes(q) ||
            item.source.toLowerCase().includes(q)
        );
    }, [pendingItems, pendSearch]);

    const histStats = useMemo(() => {
        const totalPaginas = etiquetasHistory.reduce((acc, h) => acc + (h.page_count ?? 0), 0);
        const today = new Date().toDateString();
        const hojePaginas = etiquetasHistory
            .filter(h => new Date(h.created_at).toDateString() === today)
            .reduce((acc, h) => acc + (h.page_count ?? 0), 0);
        return { totalRegistros: etiquetasHistory.length, totalPaginas, hojePaginas };
    }, [etiquetasHistory]);

    const pendTotalEtiquetas = useMemo(
        () => pendingItems.reduce((acc, i) => acc + i.labelCount, 0),
        [pendingItems]
    );

    // Simply delegate the start command to the prop function (which is now in App.tsx)
    const startProcessing = (mode: ProcessingMode) => {
        setIsModeModalOpen(false);
        onProcessZpl(mode);
    };

    const handleProcessRequest = () => {
        if (!zplInput.trim()) return;
        setIsModeModalOpen(true);
    };


    const handlePdfAction = useCallback(async () => {
        setIsGeneratingPdf(true);
        try {
            if (onSaveHistory) {
                const pageHashes = zplPages.map(page => simpleHash(page));
                const historyItem: Omit<EtiquetaHistoryItem, 'id' | 'created_at'> = {
                    created_by_name: currentUser.name,
                    page_count: zplPages.length,
                    zpl_content: zplInput,
                    settings_snapshot: settings,
                    page_hashes: pageHashes,
                };
                await onSaveHistory(historyItem);
            }

            const pdfBlob = await buildPdf(previews, extractedData, settings, includeDanfe, stockItems, skuLinks);
            const url = URL.createObjectURL(pdfBlob);
            
            window.open(url, '_blank');

            // Se há pendentes, perguntar se já imprimiu
            if (pendingItems.length > 0) {
                setShowPrintedConfirm(true);
            }

            // Mark as printed locally
            const indicesToMark = new Set<number>(printedIndices);
            previews.forEach((p, index) => {
                if (p && p !== 'SKIPPED' && p !== 'ERROR') {
                     if (includeDanfe) {
                        indicesToMark.add(index);
                    } else if (index % 2 !== 0) { 
                        indicesToMark.add(index);
                    }
                }
            });
            setEtiquetasState(prev => ({ ...prev, printedIndices: indicesToMark }));

        } catch (error) { 
            alert(`Falha ao gerar PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`); 
        } finally { 
            setIsGeneratingPdf(false); 
        }
    }, [previews, extractedData, settings, includeDanfe, stockItems, skuLinks, onSaveHistory, currentUser, zplInput, zplPages, printedIndices, setEtiquetasState, pendingItems, setShowPrintedConfirm]);

    const handleClear = () => {
        setEtiquetasState(prev => ({ ...prev, zplInput: '', includeDanfe: true, zplPages: [], previews: [], extractedData: new Map(), warnings: [], printedIndices: new Set() }));
    };

    const handleReloadHistory = async (item: EtiquetaHistoryItem) => {
        // Just load the input and prompt for processing
        const fullItem = await onGetHistoryDetails(item.id);
        if (fullItem) {
            setEtiquetasState(prev => ({ ...prev, zplInput: fullItem.zpl_content }));
            onSettingsSave(fullItem.settings_snapshot);
            // Optionally, we could auto-start processing here if we wanted to be aggressive
            setIsModeModalOpen(true);
        }
    };

    const handleConfirmLink = async (masterSku: string) => {
        console.log(`🔗 [EtiquetasPage] Iniciando vínc ulo de ${linkModalState.skus.length} SKU(s) com produto mestre: ${masterSku}`);
        let sucessos = 0;
        let erros = 0;
        
        for (const importedSku of linkModalState.skus) {
            try {
                const resultado = await onLinkSku(importedSku, masterSku);
                if (resultado) {
                    sucessos++;
                    console.log(`✅ [EtiquetasPage] SKU ${importedSku} vinculado com sucesso`);
                } else {
                    erros++;
                    console.warn(`❌ [EtiquetasPage] SKU ${importedSku} falhou ao vincular`);
                }
            } catch (err) {
                erros++;
                console.error(`❌ [EtiquetasPage] Erro ao vincular ${importedSku}:`, err);
            }
        }
        
        console.log(`📊 [EtiquetasPage] Resultado: ${sucessos} vínc ulo(s) bem-sucedido(s), ${erros} erro(s)`);
        setLinkModalState({ isOpen: false, skus: [], color: '' });
    };

    const handleConfirmCreateAndLink = async (newItemData: Omit<StockItem, 'id'>) => {
        console.log('🆕 [EtiquetasPage] Criando novo produto e vinculando SKU...');
        const newItem = await onAddNewItem(newItemData);
        
        if (!newItem) {
            console.error('❌ [EtiquetasPage] Falha ao criar novo produto');
            setCreateModalState({ isOpen: false, data: null });
            return;
        }
        
        console.log(`✅ [EtiquetasPage] Produto criado: ${newItem.code} - ${newItem.name}`);
        
        if (createModalState.data) {
            const resultadoVinculo = await onLinkSku(createModalState.data.sku, newItem.code);
            if (resultadoVinculo) {
                console.log(`✅ [EtiquetasPage] SKU ${createModalState.data.sku} vinculado ao produto ${newItem.code}`);
            } else {
                console.error(`❌ [EtiquetasPage] Falha ao vincular SKU ${createModalState.data.sku}`);
            }
        }
        
        setCreateModalState({ isOpen: false, data: null });
    };

    return (
        <>
            {/* Já imprimiu? */}
            {showPrintedConfirm && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowPrintedConfirm(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-6 text-center" onClick={e => e.stopPropagation()}>
                        <p className="text-4xl mb-3">🖨️</p>
                        <h3 className="text-base font-black text-slate-800 mb-1">Já imprimiu as etiquetas?</h3>
                        <p className="text-xs text-slate-500 mb-5">{pendingItems.length} etiqueta(s) pendente(s) na fila</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { clearPendingZpl(); setPendingItems([]); setShowPrintedConfirm(false); }}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black py-2.5 rounded-xl transition-all"
                            >
                                ✅ Sim, confirmar tudo
                            </button>
                            <button
                                onClick={() => setShowPrintedConfirm(false)}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black py-2.5 rounded-xl transition-all"
                            >
                                Não, deixar pendente
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* O indicador de progresso agora é global no Header, mas mantemos o bloqueio para geração de PDF */}
            {(isGeneratingPdf) && <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50"><Loader2 size={48} className="animate-spin text-blue-400 mb-4" /><p className="text-lg text-white">Gerando PDF...</p></div>}

            {/* ── Painel de Pendentes de Impressão ZPL ──────────────────────────── */}
            {pendingItems.length > 0 && (
                <div className="flex-shrink-0 border border-orange-200 rounded-xl bg-orange-50 overflow-hidden">
                    {/* header — usando div em vez de button para evitar button aninhado */}
                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setPendingPanelOpen(p => !p)}
                        onKeyDown={e => e.key === 'Enter' && setPendingPanelOpen(p => !p)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-orange-100 transition-colors cursor-pointer"
                    >
                        <div className="flex items-center gap-2">
                            <Clock size={16} className="text-orange-600"/>
                            <span className="text-sm font-black text-orange-700 uppercase tracking-tight">
                                Fila de Impressão ZPL
                            </span>
                            <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                {pendingItems.length} lote{pendingItems.length !== 1 ? 's' : ''}
                            </span>
                            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                                {pendTotalEtiquetas} etiqueta{pendTotalEtiquetas !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={e => { e.stopPropagation(); clearPendingZpl(); setPendingItems([]); setPendSearch(''); }}
                                className="text-[10px] font-bold text-orange-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                            >
                                Limpar tudo
                            </button>
                            {pendingPanelOpen ? <ChevronDown size={16} className="text-orange-500"/> : <ChevronRight size={16} className="text-orange-500"/>}
                        </div>
                    </div>
                    {pendingPanelOpen && (
                        <>
                            {/* busca */}
                            <div className="border-t border-orange-200 px-4 py-2 bg-orange-50/80">
                                <div className="relative">
                                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-orange-400"/>
                                    <input
                                        type="text"
                                        value={pendSearch}
                                        onChange={e => setPendSearch(e.target.value)}
                                        placeholder="Buscar por lote, descrição ou origem..."
                                        className="w-full bg-white border border-orange-200 rounded-lg pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:border-orange-400 text-orange-900 placeholder-orange-300"
                                    />
                                </div>
                            </div>
                            <div className="border-t border-orange-200 divide-y divide-orange-100 max-h-64 overflow-y-auto">
                                {filteredPendingItems.length === 0 ? (
                                    <p className="text-center text-xs text-orange-400 py-4">Nenhum lote encontrado.</p>
                                ) : filteredPendingItems.map(item => {
                                    const sourceLabels: Record<string, string> = {
                                        'bling-notas': 'Notas ZPL',
                                        'marketplace': 'Marketplace',
                                        'individual': 'Individual',
                                    };
                                    return (
                                        <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-orange-100/60 transition-colors">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-bold text-sm text-orange-900 truncate">{item.loteId}</p>
                                                <p className="text-xs text-orange-600 flex items-center gap-2 mt-0.5 flex-wrap">
                                                    <span className="bg-orange-200 text-orange-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">
                                                        {sourceLabels[item.source] || item.source}
                                                    </span>
                                                    <span className="font-semibold">{item.labelCount} etiqueta{item.labelCount !== 1 ? 's' : ''}</span>
                                                    {item.descricao && <span className="truncate max-w-[140px] text-orange-500">{item.descricao}</span>}
                                                    <span className="text-orange-400">{new Date(item.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <button
                                                    onClick={() => handleCopyZpl(item)}
                                                    className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 transition-all"
                                                    title="Copiar ZPL para área de transferência"
                                                >
                                                    <Copy size={10}/> Copiar
                                                </button>
                                                <button
                                                    onClick={() => handleReopenZpl(item)}
                                                    className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all"
                                                    title="Abrir ZPL em nova aba"
                                                >
                                                    <ExternalLink size={10}/> Reabrir
                                                </button>
                                                <button
                                                    onClick={() => handleConfirmPrinted(item.id)}
                                                    className="flex items-center gap-1 text-[9px] font-black uppercase px-2 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all"
                                                    title="Confirmar que já foi impresso"
                                                >
                                                    <CheckCircle2 size={10}/> Confirmar
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}
            
            <div className="flex flex-col md:flex-row gap-6 h-full">
                
                <div className="flex-1 flex flex-col gap-6">
                    <div className="flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm flex-1 min-h-0">
                        <div className="flex-shrink-0 flex justify-between items-center p-3 gap-2 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-2">
                                <input type="file" ref={fileInputRef} onChange={(e) => { const file = e.target.files?.[0]; if (file) file.text().then(text => setEtiquetasState(p => ({...p, zplInput: text}))); e.target.value = ''; }} accept=".txt,.zpl" className="hidden" />
                                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-gray-50 dark:bg-gray-700 hover:bg-gray-200 dark:bg-gray-600"><FileText size={16} /> Importar</button>
                                <button onClick={handleClear} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-gray-50 dark:bg-gray-700 hover:bg-gray-200 dark:bg-gray-600"><Trash2 size={16} /> Limpar</button>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 rounded-full hover:bg-gray-50 dark:bg-gray-700"><Settings size={20} /></button>
                                <button onClick={handleProcessRequest} disabled={!zplInput.trim() || isProcessing} className="flex items-center gap-2 text-sm px-4 py-1.5 rounded-md bg-blue-600 dark:bg-blue-500 text-white font-semibold disabled:opacity-50"><Zap size={16}/> Processar</button>
                            </div>
                        </div>
                        <textarea value={zplInput} onChange={(e) => setEtiquetasState(p => ({ ...p, zplInput: e.target.value }))} placeholder="Cole seu código ZPL aqui ou clique em 'Importar'..." className="h-full w-full p-4 font-mono text-sm resize-none focus:outline-none bg-white dark:bg-gray-800"/>
                    </div>
                     {(previews.length > 0) && (
                        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                            {warnings.length > 0 && <div className="flex-shrink-0 p-3 border-l-4 border-orange-500 bg-orange-50 rounded-r-lg shadow-sm"><h3 className="font-bold text-orange-800 flex items-center gap-2"><AlertTriangle size={18}/> {warnings.join(' ')}</h3></div>}
                            {unlinkedSkusData.length > 0 && <div className="flex-shrink-0 p-3 border-l-4 border-yellow-500 bg-yellow-50 rounded-r-lg shadow-sm"><h3 className="font-bold text-yellow-800 flex items-center gap-2"><AlertTriangle size={18}/> Vínculo de SKUs Pendentes ({unlinkedSkusData.length})</h3><div className="space-y-2 mt-2 max-h-32 overflow-y-auto pr-2">{unlinkedSkusData.map(({ sku }) => (<div key={sku} className="flex items-center justify-between bg-white p-2 rounded border border-yellow-200 text-sm"><span className="font-mono text-xs">{sku}</span><div className="flex gap-3"><button onClick={() => setLinkModalState({isOpen: true, skus: [sku], color: 'Padrão'})} className="font-semibold text-blue-600 hover:underline flex items-center gap-1"><LinkIcon size={14}/> Vincular</button><button onClick={() => setCreateModalState({isOpen: true, data: { sku, colorSugerida: 'Padrão' }})} className="font-semibold text-green-600 hover:underline flex items-center gap-1"><PlusCircle size={14}/> Criar</button></div></div>))}</div></div>}

                            <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 overflow-hidden">
                                <div className="flex-shrink-0 flex justify-between items-center mb-4"><h2 className="text-lg font-semibold">Pré-visualização ({previews.filter(p => p && p !== 'SKIPPED').length}/{zplPages.length})</h2><div className="flex items-center gap-4"><label className="flex items-center text-sm"><input type="checkbox" checked={includeDanfe} onChange={(e) => setEtiquetasState(p => ({ ...p, includeDanfe: e.target.checked }))} className="h-4 w-4 rounded"/> <span className="ml-2">Incluir DANFE</span></label><button onClick={handlePdfAction} disabled={previews.length === 0 || previews.every(p => !p) || isProcessing} className="flex items-center gap-2 text-sm px-4 py-2 rounded-md bg-blue-600 dark:bg-blue-500 text-white font-semibold disabled:opacity-50"><Printer size={16} /> Gerar PDF</button></div></div>
                                <div className="flex-1 overflow-y-auto pr-2"><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">{previews.map((src, index) => {
                                            if (!includeDanfe && index % 2 === 0) return null;
                                            const isEvenPage = index % 2 !== 0;
                                            const pairData = extractedData.get(Math.floor(index / 2) * 2);
                                            const platformSettings = pairData?.isMercadoLivre ? settings.mercadoLivre : settings.shopee;
                                            
                                            // Prepara as linhas de pré-visualização para o rodapé usando agrupamento por mestre
                                            const previewLines: string[] = [];
                                            if (pairData && pairData.skus.length > 0) {
                                                const grouped = groupSkusByMasterProduct(pairData.skus);
                                                grouped.forEach(({ product, totalQty }) => {
                                                    const finalSku = product ? product.code : 'SKU-UNKNOWN';
                                                    const finalName = product ? product.name : 'Produto não encontrado';
                                                    const line = platformSettings.footer.template
                                                        .replace('{sku}', finalSku)
                                                        .replace('{name}', finalName)
                                                        .replace('{qty}', String(totalQty));
                                                    previewLines.push(line);
                                                });
                                            }


                                            return (
                                                <div key={index} className="space-y-2 relative">
                                                    {printedIndices.has(index) && (
                                                        <div className="absolute inset-0 bg-green-900 bg-opacity-75 flex items-center justify-center z-10 rounded-lg pointer-events-none">
                                                            <span className="text-white font-bold text-lg rotate-[-15deg] border-2 border-white px-4 py-1 rounded">IMPRESSO</span>
                                                        </div>
                                                    )}
                                                    <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded-lg shadow-md flex flex-col aspect-[100/150] justify-center items-center overflow-hidden">
                                                        {src === 'SKIPPED' ? (
                                                            <div className="text-center p-4 text-gray-500">
                                                                <Eye size={24} className="mx-auto mb-2"/>
                                                                <p className="font-semibold">DANFE Omitida</p>
                                                                <p className="text-xs">(Modo Rápido)</p>
                                                            </div>
                                                        ) : src === 'ERROR' ? (
                                                            <div className="text-red-500 text-center p-4">Erro ao renderizar</div>
                                                        ) : src ? (
                                                            <img src={src} alt={`Preview ${index + 1}`} className="max-w-full max-h-full object-contain" />
                                                        ) : (
                                                            <Loader2 className="animate-spin text-gray-400" />
                                                        )}
                                                    </div>
                                                    {isEvenPage && pairData && (
                                                        <div className="text-center font-semibold text-xs text-gray-800 dark:text-gray-100 p-2 border-t mt-1 bg-gray-50 dark:bg-gray-800/50 rounded-b">
                                                            {previewLines.length > 0 ? (
                                                                previewLines.map((line, lIdx) => (
                                                                    <div key={lIdx} className="truncate" title={line}>{line}</div>
                                                                ))
                                                            ) : (
                                                                <p className="text-red-600 font-bold">Sem dados de SKU</p>
                                                            )}
                                                        </div>
                                                    )}
                                                    <p className="text-xs text-center text-gray-500 dark:text-gray-400">Página {index + 1}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-full md:w-1/3 lg:w-1/4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm flex flex-col overflow-hidden">
                    {/* header */}
                    <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                        <div className="flex items-center gap-2 mb-3">
                            <History size={16} className="text-blue-600 dark:text-blue-400"/>
                            <h2 className="text-sm font-black text-gray-900 dark:text-gray-50 uppercase tracking-tight">Histórico de Impressões</h2>
                        </div>
                        {/* stats cards */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700 text-center">
                                <p className="text-lg font-black text-blue-600 dark:text-blue-400">{histStats.totalRegistros}</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-tight">Registros</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700 text-center">
                                <p className="text-lg font-black text-emerald-600">{histStats.totalPaginas}</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-tight">Pág. Total</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700 text-center">
                                <p className="text-lg font-black text-amber-600">{histStats.hojePaginas}</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium leading-tight">Pág. Hoje</p>
                            </div>
                        </div>
                    </div>
                    {/* list */}
                    <div className="overflow-y-auto flex-grow p-3">
                        {etiquetasHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-gray-500 dark:text-gray-400">
                                <LayoutList size={28} className="mb-2 opacity-30"/>
                                <p className="text-sm">Nenhum histórico encontrado.</p>
                            </div>
                        ) : (() => {
                            const today = new Date().toDateString();
                            const sorted = [...etiquetasHistory].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                            const todayItems = sorted.filter(h => new Date(h.created_at).toDateString() === today);
                            const olderItems = sorted.filter(h => new Date(h.created_at).toDateString() !== today);
                            const renderItem = (item: typeof etiquetasHistory[0]) => {
                                const initials = (item.created_by_name ?? 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                                const ts = new Date(item.created_at);
                                const now = Date.now();
                                const diffMs = now - ts.getTime();
                                const diffMins = Math.floor(diffMs / 60000);
                                const relTime = diffMins < 1 ? 'agora mesmo'
                                    : diffMins < 60 ? `há ${diffMins}min`
                                    : diffMins < 1440 ? `há ${Math.floor(diffMins/60)}h`
                                    : ts.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                                return (
                                    <div key={item.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-2 hover:border-blue-600 dark:border-blue-500 transition-colors">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-7 h-7 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center text-[10px] font-black flex-shrink-0">
                                                {initials}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-xs text-gray-900 dark:text-gray-50 truncate">{item.created_by_name}</p>
                                                <p className="text-[10px] text-gray-500 dark:text-gray-400">{relTime}</p>
                                            </div>
                                            <span className="flex-shrink-0 bg-blue-100 text-blue-700 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-blue-200">
                                                {item.page_count} pág
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 mb-2">
                                            <CalendarDays size={10} className="text-gray-500 dark:text-gray-400"/>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{ts.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        <button
                                            onClick={() => handleReloadHistory(item)}
                                            className="w-full px-3 py-1.5 text-[10px] font-black uppercase bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:opacity-90 transition-all flex items-center justify-center gap-1"
                                        >
                                            <History size={10}/> Recarregar ZPL
                                        </button>
                                    </div>
                                );
                            };
                            return (
                                <>
                                    {todayItems.length > 0 && (
                                        <div className="mb-3">
                                            <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"/>
                                                Hoje ({todayItems.length})
                                            </p>
                                            {todayItems.map(renderItem)}
                                        </div>
                                    )}
                                    {olderItems.length > 0 && (
                                        <div>
                                            <p className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block"/>
                                                Anteriores ({olderItems.length})
                                            </p>
                                            {olderItems.map(renderItem)}
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>
            <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} currentSettings={settings} onSave={onSettingsSave} previews={previews} extractedData={extractedData} />
            <LinkSkuModal isOpen={linkModalState.isOpen} onClose={() => setLinkModalState({isOpen: false, skus: [], color: ''})} skusToLink={linkModalState.skus} colorSugerida={linkModalState.color} onConfirmLink={handleConfirmLink} products={stockItems.filter(i => i.kind === 'PRODUTO' || i.kind === 'PROCESSADO')} skuLinks={skuLinks} onTriggerCreate={() => { setLinkModalState(p => ({ ...p, isOpen: false })); setCreateModalState({isOpen: true, data: { sku: linkModalState.skus[0], colorSugerida: linkModalState.color }}); }} />
            <CreateProductFromImportModal isOpen={createModalState.isOpen} onClose={() => setCreateModalState({isOpen: false, data: null})} unlinkedSkuData={createModalState.data ? {skus: [createModalState.data.sku], colorSugerida: createModalState.data.colorSugerida} : null} onConfirm={handleConfirmCreateAndLink} generalSettings={generalSettings}/>
            <ProcessingModeModal isOpen={isModeModalOpen} onClose={() => setIsModeModalOpen(false)} onSelectMode={startProcessing} />
        </>
    );
}

export default EtiquetasPage;
