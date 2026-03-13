
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { StockItem, StockMovement, ProdutoCombinado, WeighingBatch, WeighingType, StockMovementOrigin, StockItemKind, User, GeneralSettings, ParsedNfeItem, SkuLink, StockPackGroup } from '../types';
import { skuMatchesTerm, buildParentMap, skuCodeMatches } from '../utils/skuHelpers';
import { Package, Factory, History, Search, PlusCircle, Weight, Cog, SlidersHorizontal, Edit3, Trash2, ChevronDown, ChevronRight, FileUp, ArrowLeft, Settings, Box, Plus, Save, X, Link, ArrowRight, Loader2, ChevronUp, AlertTriangle, ArrowDownCircle, ArrowUpCircle, Layers, TrendingUp, TrendingDown, BarChart2, Filter, Calendar, RefreshCw, FileText } from 'lucide-react';
import { PesagemPage } from './PesagemPage';
import { dbClient } from '../lib/supabaseClient';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Modals
import BomConfigModal from '../components/BomConfigModal';
import AddItemModal from '../components/AddItemModal';
import ManualMovementModal from '../components/ManualMovementModal';
import EditItemModal from '../components/EditItemModal';
import ConfirmActionModal from '../components/ConfirmActionModal';
import ImportXmlModal from '../components/ImportXmlModal';
import InsumoCategoryManagerModal from '../components/InsumoCategoryManagerModal';
import UpdateStockModal from '../components/UpdateStockModal';
import UpdateStockFromSheetModal from '../components/UpdateStockFromSheetModal';
import UpdateStockFromSheetModalShopee from '../components/UpdateStockFromSheetModalShopee';
import PackGroupModal from '../components/PackGroupModal';
import BulkStockUpdateModal from '../components/BulkStockUpdateModal';
import BulkAssignCategoryModal from '../components/BulkAssignCategoryModal';
import UpdatePacksFromSheetModal from '../components/UpdatePacksFromSheetModal';
import VolatilMovementModal from '../components/VolatilMovementModal';
import { BarcodeLabelModal } from '../components/BarcodeLabelModal';
import { Barcode, QrCode } from 'lucide-react';


// ... ExpeditionItemsConfigModal e TransferSkuModal permanecem iguais ...
interface ExpeditionItemsConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: StockItem;
    insumos: StockItem[]; // All 'INSUMO' kind items
    onSave: (productCode: string, items: { stockItemCode: string; qty_per_pack: number }[]) => void;
}

const ExpeditionItemsConfigModal: React.FC<ExpeditionItemsConfigModalProps> = ({ isOpen, onClose, product, insumos, onSave }) => {
    const [editedItems, setEditedItems] = useState<{ stockItemCode: string; qty_per_pack: number }[]>([]);
    const [insumoSearch, setInsumoSearch] = useState('');
    const [selectedInsumo, setSelectedInsumo] = useState<StockItem | null>(null);
    const [newInsumoQty, setNewInsumoQty] = useState<number>(1);

    useEffect(() => {
        if (isOpen) {
            setEditedItems(product.expedition_items || []);
            setInsumoSearch('');
            setSelectedInsumo(null);
            setNewInsumoQty(1);
        }
    }, [isOpen, product]);

    const handleAddItem = () => {
        if (selectedInsumo && newInsumoQty > 0) {
            setEditedItems(prev => [...prev, { stockItemCode: selectedInsumo.code, qty_per_pack: newInsumoQty }]);
            setSelectedInsumo(null);
            setNewInsumoQty(1);
            setInsumoSearch('');
        }
    };

    const handleRemoveItem = (stockItemCode: string) => {
        setEditedItems(prev => prev.filter(item => item.stockItemCode !== stockItemCode));
    };

    const handleSave = () => onSave(product.code, editedItems);

    const availableInsumos = useMemo(() => insumos.filter(insumo => !editedItems.some(item => item.stockItemCode === insumo.code)), [insumos, editedItems]);
    const filteredInsumos = useMemo(() => {
        if (!insumoSearch) return [];
        return availableInsumos.filter(i => i.name.toLowerCase().includes(insumoSearch.toLowerCase()) || i.code.toLowerCase().includes(insumoSearch.toLowerCase()));
    }, [insumoSearch, availableInsumos]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Itens de Expedição por Produto</h2>
                        <p className="text-sm text-gray-500">{product.name}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2">
                    <h3 className="text-md font-semibold text-gray-700 mb-2">Itens Inclusos na Expedição</h3>
                    {editedItems.length > 0 ? (
                        <div className="space-y-2">
                            {editedItems.map(item => {
                                const details = insumos.find(i => i.code === item.stockItemCode);
                                return (
                                    <div key={item.stockItemCode} className="bg-gray-50 p-2 rounded-lg border flex justify-between items-center">
                                        <div>
                                            <p className="font-medium text-gray-800">{details?.name || item.stockItemCode}</p>
                                            <p className="text-xs text-gray-500">Qtd: {item.qty_per_pack} {details?.unit}</p>
                                        </div>
                                        <button onClick={() => handleRemoveItem(item.stockItemCode)} className="text-red-500 hover:text-red-700 p-1"><Trash2 size={16} /></button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">Nenhum item de expedição configurado.</p>}

                    <div className="mt-6 pt-4 border-t">
                        <h3 className="text-md font-semibold text-gray-700 mb-2">Adicionar Item</h3>
                        {!selectedInsumo ? (
                            <div className="relative">
                                <input type="text" value={insumoSearch} onChange={e => setInsumoSearch(e.target.value)} placeholder="Buscar insumo (espátula, manual...)" className="w-full p-2 border rounded-md bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" />
                                {insumoSearch && (
                                    <div className="absolute z-10 w-full border bg-white rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                                        {filteredInsumos.map(insumo => (
                                            <div key={insumo.id} onClick={() => { setSelectedInsumo(insumo); setInsumoSearch(''); }} className="p-2 hover:bg-blue-50 cursor-pointer border-b">
                                                {insumo.name} ({insumo.code})
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-end gap-2 p-2 bg-blue-50 rounded-lg">
                                <div className="flex-grow"><label className="text-xs">Item</label><p className="font-semibold p-2 bg-white rounded">{selectedInsumo.name}</p></div>
                                <div><label className="text-xs">Qtd.</label><input type="number" value={newInsumoQty} onChange={e => setNewInsumoQty(Number(e.target.value))} className="w-20 p-2 border rounded bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700" /></div>
                                <button onClick={handleAddItem} className="p-2 bg-blue-600 text-white rounded"><Plus size={20} /></button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3 border-t pt-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">Cancelar</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md flex items-center gap-2"><Save size={16} /> Salvar</button>
                </div>
            </div>
        </div>
    );
};

interface TransferSkuModalProps {
    isOpen: boolean;
    onClose: () => void;
    skuToTransfer: string;
    currentMaster: StockItem;
    allProducts: StockItem[];
    onConfirmTransfer: (newMasterCode: string) => Promise<void>;
}

const TransferSkuModal: React.FC<TransferSkuModalProps> = ({ isOpen, onClose, skuToTransfer, currentMaster, allProducts, onConfirmTransfer }) => {
    const [selectedNewMaster, setSelectedNewMaster] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isTransferring, setIsTransferring] = useState(false);

    const parentMapAll = useMemo(() => buildParentMap(allProducts), [allProducts]);
    const availableProducts = useMemo(() => {
        if (!searchTerm) {
            return allProducts.filter(p => p.id !== currentMaster.id);
        }
        return allProducts.filter(p =>
            p.id !== currentMaster.id && skuMatchesTerm(p, searchTerm, allProducts, parentMapAll)
        );
    }, [allProducts, currentMaster, searchTerm, parentMapAll]);

    useEffect(() => {
        if (!isOpen) {
            setSelectedNewMaster('');
            setSearchTerm('');
            setIsTransferring(false);
        }
    }, [isOpen]);

    const handleConfirm = async () => {
        if (!selectedNewMaster) return;
        setIsTransferring(true);
        await onConfirmTransfer(selectedNewMaster);
        setIsTransferring(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="flex-shrink-0 flex justify-between items-center mb-4 border-b pb-3">
                    <h2 className="text-xl font-bold text-gray-800">Transferir SKU de Importação</h2>
                    <button onClick={onClose}><X size={24} /></button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-500">SKU a ser transferido</label>
                        <p className="font-mono bg-gray-100 p-2 rounded">{skuToTransfer}</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-500">Produto Mestre Atual</label>
                        <div className="flex items-center gap-2 bg-gray-100 p-2 rounded">
                            <span className="font-semibold">{currentMaster.name}</span>
                            <span className="text-gray-500 font-bold mx-2">→</span>
                            <span className="font-semibold text-blue-600">{selectedNewMaster ? allProducts.find(p => p.code === selectedNewMaster)?.name : 'Novo Mestre'}</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700">Buscar Novo Produto Mestre</label>
                        <div className="relative mt-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar por nome ou SKU..." className="w-full pl-9 pr-3 py-2 text-sm border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800" />
                        </div>
                        <div className="mt-2 border rounded-md h-48 overflow-y-auto">
                            {availableProducts.map(p => (
                                <div key={p.id} onClick={() => setSelectedNewMaster(p.code)} className={`p-2 cursor-pointer ${selectedNewMaster === p.code ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>
                                    <p className="font-semibold">{p.name}</p>
                                    <p className="text-xs text-gray-500">{p.code}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex-shrink-0 mt-6 flex justify-end space-x-3 border-t pt-4">
                    <button onClick={onClose} disabled={isTransferring} className="px-4 py-2 bg-gray-200 rounded-md">Cancelar</button>
                    <button onClick={handleConfirm} disabled={!selectedNewMaster || isTransferring} className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold flex items-center gap-2 disabled:opacity-50">
                        {isTransferring ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                        Confirmar Transferência
                    </button>
                </div>
            </div>
        </div>
    );
};

interface EstoquePageProps {
    stockItems: StockItem[];
    stockMovements: StockMovement[];
    onStockAdjustment: (stockItemCode: string, quantityDelta: number, ref: string) => Promise<boolean>;
    produtosCombinados: ProdutoCombinado[];
    onSaveProdutoCombinado: (productSku: string, newBomItems: ProdutoCombinado['items']) => void;
    onAddNewItem: (item: Omit<StockItem, 'id'>) => Promise<StockItem | null>;
    weighingBatches: WeighingBatch[];
    onAddNewWeighing: (insumoCode: string, quantity: number, type: WeighingType, userId: string) => void;
    onProductionRun: (itemCode: string, quantity: number, ref: string) => void;
    onRegisterReadyStock: (itemCode: string, quantity: number, ref: string) => void;
    currentUser: User;
    onEditItem: (itemId: string, updates: Partial<Pick<StockItem, 'name' | 'min_qty' | 'category' | 'color' | 'product_type' | 'substitute_product_code'>>) => Promise<boolean>;
    onDeleteItem: (itemId: string) => Promise<boolean>;
    onBulkDeleteItems: (itemIds: string[]) => Promise<boolean>;
    onDeleteMovement: (movementId: string) => Promise<boolean>;
    onDeleteWeighingBatch: (batchId: string) => Promise<boolean>;
    generalSettings: GeneralSettings;
    setGeneralSettings: (settings: GeneralSettings | ((prev: GeneralSettings) => GeneralSettings)) => void;
    onConfirmImportFromXml: (payload: { itemsToCreate: any[], itemsToUpdate: any[] }) => void;
    onSaveExpeditionItems: (productCode: string, items: { stockItemCode: string; qty_per_pack: number }[]) => void;
    users: User[];
    onUpdateInsumoCategory: (oldName: string, newName: string) => Promise<void>;
    onBulkInventoryUpdate: (updates: { code: string, quantity: number }[]) => Promise<string>;
    skuLinks: SkuLink[];
    onLinkSku: (importedSku: string, masterProductSku: string) => Promise<boolean>;
    onUnlinkSku: (importedSku: string) => Promise<boolean>;
}

type Tab = 'insumos' | 'processados' | 'produtos' | 'pacotes' | 'pesagem' | 'movimentacoes';
type ModalState = {
    addItem: boolean;
    editItem: StockItem | null;
    bomConfig: StockItem | null;
    manualMovement: StockItem | null;
    updateStock: StockItem | null;
    importXml: boolean;
    manageInsumoCategories: boolean;
    manageProductCategories: boolean;
    expeditionItemsConfig: StockItem | null;
    updateFromSheet: boolean;
    updateFromSheetShopee: boolean;
    packGroup: StockPackGroup | null;
    isPackModalOpen: boolean;
    bulkUpdate: { isOpen: boolean; preselectedCodes?: string[]; title?: string };
    bulkAssignCategory: boolean;
    updatePacksFromSheet: boolean;
    barcodeModal: { isOpen: boolean; data: any; type: 'item' | 'pack' } | null;
};

const TabButton: React.FC<{ tab: Tab, activeTab: Tab, label: string, icon: React.ReactNode, onClick: (tab: Tab) => void }> = ({ tab, activeTab, label, icon, onClick }) => (
    <button
        onClick={() => onClick(tab)}
        className={`flex items-center px-4 py-2 text-sm font-black rounded-t-xl transition-all border-b-2 ${activeTab === tab ? 'bg-white border-blue-600 text-blue-600 shadow-sm' : 'border-transparent text-gray-500 hover:text-blue-600'}`}
    >
        {icon} <span className="ml-2">{label}</span>
    </button>
);

const EstoquePage: React.FC<EstoquePageProps> = (props) => {
    const { onBulkDeleteItems, onDeleteItem, generalSettings, setGeneralSettings, onSaveExpeditionItems, users, onConfirmImportFromXml, onEditItem, onUpdateInsumoCategory, onBulkInventoryUpdate, skuLinks, onLinkSku, onUnlinkSku } = props;
    const { stockItems, stockMovements, produtosCombinados, onSaveProdutoCombinado, onAddNewItem, weighingBatches, onAddNewWeighing, onProductionRun, onRegisterReadyStock, currentUser, onDeleteMovement, onStockAdjustment, onDeleteWeighingBatch } = props;

    const [activeTab, setActiveTab] = useState<Tab>('insumos');
    const [searchTerm, setSearchTerm] = useState('');
    const [packGroups, setPackGroups] = useState<StockPackGroup[]>([]);
    // Estado para modal de movimentação volátil
    const [volatilModal, setVolatilModal] = useState<{ isOpen: boolean; group: StockPackGroup | null; type: 'entrada' | 'saida' }>({ isOpen: false, group: null, type: 'entrada' });
    const [modalState, setModalState] = useState<ModalState>({
        addItem: false, editItem: null, bomConfig: null, manualMovement: null,
        updateStock: null, importXml: false, manageInsumoCategories: false, manageProductCategories: false,
        expeditionItemsConfig: null, updateFromSheet: false, updateFromSheetShopee: false,
        packGroup: null, isPackModalOpen: false,
        bulkUpdate: { isOpen: false },
        bulkAssignCategory: false,
        updatePacksFromSheet: false,
        barcodeModal: null
    });
    const [expandedMovements, setExpandedMovements] = useState<Set<string>>(new Set());
    const [histSearch, setHistSearch] = useState('');
    const [histOriginFilter, setHistOriginFilter] = useState<string>('all');
    const [histDateFilter, setHistDateFilter] = useState<'today' | '7d' | '30d' | 'all'>('all');

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ item: any, type: 'item' | 'movement' | 'weighing_batch' | 'pack_group' } | null>(null);
    const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
    const [transferState, setTransferState] = useState<{ sku: string, currentMaster: StockItem } | null>(null);
    const [showOnlyWithoutBom, setShowOnlyWithoutBom] = useState(false);
    const [viewModePacks, setViewModePacks] = useState<'list' | 'grid'>('grid');
    const [selectedPacks, setSelectedPacks] = useState<string[]>([]);

    const [packGroupColumnsExist, setPackGroupColumnsExist] = useState(false);

    const loadPackGroups = useCallback(async () => {
        // Tenta carregar com todos os campos
        let { data, error } = await dbClient.from('stock_pack_groups').select('*');
        if (!error && data) {
            setPackGroups(data);
            // Se o primeiro item tem 'tipo', as colunas existem
            setPackGroupColumnsExist(data.length === 0 || 'tipo' in (data[0] || {}));
            return;
        }
        // Fallback: seleciona apenas campos base conhecidos
        const fallback = await dbClient.from('stock_pack_groups').select('id,name,barcode,item_codes,min_pack_qty,created_at');
        if (fallback.data) {
            setPackGroups(fallback.data.map(g => ({ ...g, tipo: 'tradicional' as const, quantidade_volatil: 0 })));
            setPackGroupColumnsExist(false);
        }
    }, []);

    // ... RESTO DAS FUNÇÕES DE HANDLERS IGUAIS ...
    const handleSavePackGroup = async (group: Omit<StockPackGroup, 'id'>, id?: string) => {
        // SEMPRE tenta com todos os campos primeiro
        const doSave = async (payload: any) => {
            if (id) {
                return await dbClient.from('stock_pack_groups').update(payload).eq('id', id);
            } else {
                return await dbClient.from('stock_pack_groups').insert(payload);
            }
        };

        const { error } = await doSave(group);
        if (error) {
            // Fallback: salva sem campos novos
            const { tipo, quantidade_volatil, ...baseGroup } = group as any;
            await doSave(baseGroup);
        }
        await loadPackGroups();
    };

    // Movimentação de estoque volátil (entrada/saída)
    const handleVolatilMovement = async (groupId: string, delta: number, ref: string) => {
        const group = packGroups.find(g => g.id === groupId);
        if (!group) return;

        const newQty = Math.max(0, (group.quantidade_volatil || 0) + delta);

        // Atualiza quantidade no grupo
        await dbClient.from('stock_pack_groups').update({ quantidade_volatil: newQty }).eq('id', groupId);

        // Registra movimento no histórico
        await dbClient.from('stock_movements').insert({
            stock_item_code: `PACK:${group.name}`,
            movement_type: delta > 0 ? 'ENTRADA' : 'SAIDA',
            quantity: Math.abs(delta),
            reference: ref || (delta > 0 ? 'Entrada manual volátil' : 'Saída manual volátil'),
            previous_qty: group.quantidade_volatil || 0,
            new_qty: newQty,
        });

        await loadPackGroups();
    };

    useEffect(() => {
        loadPackGroups();
    }, [loadPackGroups]);

    const closeModal = () => {
        setModalState(prev => ({ ...prev, addItem: false, editItem: null, bomConfig: null, manualMovement: null, updateStock: null, importXml: false, manageInsumoCategories: false, manageProductCategories: false, expeditionItemsConfig: null, updateFromSheet: false, updateFromSheetShopee: false, packGroup: null, isPackModalOpen: false, bulkUpdate: { isOpen: false }, bulkAssignCategory: false, updatePacksFromSheet: false, barcodeModal: null }));
        setIsDeleteModalOpen(false);
        setItemToDelete(null);
        setTransferState(null);
    }

    const handleAssignProductsToCategory = async (category: string, productCodes: string[]) => {
        const productsToRemove = stockItems.filter(p => p.category === category && !productCodes.includes(p.code));
        for (const p of productsToRemove) {
            await onEditItem(p.id, { category: '' });
        }
        const productsToAdd = stockItems.filter(p => productCodes.includes(p.code) && p.category !== category);
        for (const p of productsToAdd) {
            await onEditItem(p.id, { category: category });
        }
    };

    const handleBulkAssignConfirm = async (category: string) => {
        const finalCategory = category === 'Sem Categoria' ? '' : category;
        const selectedItems = stockItems.filter(i => selectedIds.has(i.id));
        for (const item of selectedItems) {
            await onEditItem(item.id, { category: finalCategory });
        }
        setSelectedIds(new Set());
    };

    const insumos = useMemo(() => stockItems.filter(item => item.kind === 'INSUMO'), [stockItems]);
    const processados = useMemo(() => stockItems.filter(item => item.kind === 'PROCESSADO'), [stockItems]);
    const produtos = useMemo(() => {
        let finalProducts = stockItems.filter(item => item.kind === 'PRODUTO');
        if (showOnlyWithoutBom) {
            const productsWithBom = new Set(produtosCombinados.map(bom => bom.productSku));
            finalProducts = finalProducts.filter(product => !productsWithBom.has(product.code));
        }
        return finalProducts;
    }, [stockItems, showOnlyWithoutBom, produtosCombinados]);

    const dependenteQty = useMemo(() => produtos.reduce((sum, p) => sum + (p.current_qty || 0), 0), [produtos]);

    const handleDeletePackGroup = async (id: string) => {
        await dbClient.from('stock_pack_groups').delete().eq('id', id);
        await loadPackGroups();
    };

    const substituteOptions = useMemo(() => {
        if (!modalState.editItem) return [];
        if (modalState.editItem.kind === 'PRODUTO') return produtos;
        if (modalState.editItem.kind === 'PROCESSADO') return processados;
        return [];
    }, [modalState.editItem, produtos, processados]);

    const handleSelect = (id: string, isSelected: boolean) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (isSelected) newSet.add(id);
            else newSet.delete(id);
            return newSet;
        });
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>, items: StockItem[]) => {
        const pageIds = items.map(i => i.id);
        if (e.target.checked) {
            setSelectedIds(prev => new Set([...Array.from(prev), ...pageIds]));
        } else {
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                pageIds.forEach(id => newSet.delete(id));
                return newSet;
            });
        }
    };

    const handleDeleteSelected = async () => {
        setIsDeleting(true);
        await onBulkDeleteItems(Array.from(selectedIds));
        setIsDeleteModalOpen(false);
        setSelectedIds(new Set());
        setIsDeleting(false);
    };

    const handleConfirmAddItem = async (newItemData: Omit<StockItem, 'id'>, shouldConfigureBom: boolean) => {
        const newItem = await onAddNewItem(newItemData);
        if (newItem) {
            closeModal();
            if (shouldConfigureBom) setModalState(prev => ({ ...prev, bomConfig: newItem }));
        }
    };

    const handleConfirmEditItem = async (itemId: string, updates: Partial<Pick<StockItem, 'name' | 'min_qty' | 'category' | 'color' | 'product_type' | 'substitute_product_code'>>) => {
        const success = await onEditItem(itemId, updates);
        if (success) closeModal();
        return success;
    };

    const handleConfirmManualMovement = (itemCode: string, movementType: 'entrada' | 'saida', quantity: number, ref: string) => {
        const item = stockItems.find(i => i.code === itemCode);
        if (!item) return;
        const isBomProduction = (item.kind === 'PRODUTO' || item.kind === 'PROCESSADO') && movementType === 'saida';
        if (isBomProduction && ref.toLowerCase().includes('produção')) {
            if (item.kind === 'PRODUTO') {
                // Produtos vão para Estoque Pronto (ready_qty) com verificação automática de insumos
                onRegisterReadyStock(itemCode, quantity, ref);
            } else {
                // Processados continuam usando produção via BOM normal
                onProductionRun(itemCode, quantity, ref);
            }
        } else {
            onStockAdjustment(itemCode, movementType === 'entrada' ? quantity : -quantity, ref);
        }
        closeModal();
    };

    const handleConfirmUpdateStock = (itemCode: string, quantity: number, ref: string) => {
        onStockAdjustment(itemCode, quantity, ref);
        closeModal();
    }

    const handleBulkStockConfirm = async (updates: { code: string; quantity: number; ref: string }[], operationType: 'manual' | 'bom') => {
        for (const update of updates) {
            if (operationType === 'bom') {
                await onProductionRun(update.code, update.quantity, update.ref);
            } else {
                await onStockAdjustment(update.code, update.quantity, update.ref);
            }
        }
        closeModal();
    };

    const handleConfirmDelete = async () => {
        if (!itemToDelete) return;
        const { item, type } = itemToDelete;
        let success = false;
        if (type === 'item') success = await onDeleteItem(item.id);
        else if (type === 'movement') success = await onDeleteMovement(item.id);
        else if (type === 'pack_group') {
            await handleDeletePackGroup(item.id);
            success = true;
        }
        if (success) closeModal();
    };

    const handleSaveInsumoCategories = async (newCategories: string[]) => {
        setGeneralSettings(prev => ({ ...prev, insumoCategoryList: newCategories }));
    };

    const handleSaveProductCategories = async (newCategories: string[]) => {
        setGeneralSettings(prev => ({ ...prev, productCategoryList: newCategories }));
    };

    const toggleExpansion = (productId: string) => {
        setExpandedProducts(prev => {
            const newSet = new Set(prev);
            if (newSet.has(productId)) newSet.delete(productId);
            else newSet.add(productId);
            return newSet;
        });
    };

    const handleConfirmTransfer = async (newMasterCode: string) => {
        if (!transferState) return;
        await onUnlinkSku(transferState.sku);
        await onLinkSku(transferState.sku, newMasterCode);
    };

    const handleResetVolatile = async (item: StockItem) => {
        try {
            const { data, error } = await dbClient.rpc('reset_volatile_status', { p_item_code: item.code });
            if (error) throw error;
            if (data?.success) {
                props.addToast?.(data.message || 'Modo volátil desativado.', 'success');
                // O Supabase Realtime deve atualizar a lista, mas podemos forçar se necessário
            }
        } catch (e: any) {
            props.addToast?.('Erro ao resetar modo volátil: ' + e.message, 'error');
        }
    };

    const itemTypeForNewItem = useMemo((): StockItemKind => (activeTab === 'insumos' ? 'INSUMO' : activeTab === 'processados' ? 'PROCESSADO' : 'PRODUTO'), [activeTab]);

    const toggleMovementExpansion = (ref: string) => setExpandedMovements(prev => {
        const newSet = new Set(prev);
        if (newSet.has(ref)) newSet.delete(ref);
        else newSet.add(ref);
        return newSet;
    });

    const processedMovements = useMemo(() => {
        const productionGroups = new Map<string, { main: StockMovement, children: StockMovement[] }>();
        const bipGroups = new Map<string, { main: { stockItemName: string, createdAt: Date, createdBy: string, ref: string, productSku: string | undefined }, children: StockMovement[] }>();
        const otherMovements: StockMovement[] = [];

        stockMovements.forEach(mov => {
            if (mov.origin === 'PRODUCAO_MANUAL' && mov.ref) {
                if (!productionGroups.has(mov.ref)) productionGroups.set(mov.ref, { main: null as any, children: [] });
                const group = productionGroups.get(mov.ref)!;
                if (mov.qty_delta > 0) group.main = mov;
                else group.children.push(mov);
            } else if (mov.origin === 'BIP' && mov.ref && mov.productSku) {
                if (!bipGroups.has(mov.ref)) {
                    const product = stockItems.find(item => item.code === mov.productSku);
                    bipGroups.set(mov.ref, { main: { stockItemName: product?.name || mov.productSku, createdAt: mov.createdAt, createdBy: mov.createdBy, ref: mov.ref, productSku: mov.productSku }, children: [] });
                }
                const group = bipGroups.get(mov.ref)!;
                group.children.push(mov);
                if (new Date(mov.createdAt) > new Date(group.main.createdAt)) {
                    group.main.createdAt = mov.createdAt;
                    group.main.createdBy = mov.createdBy;
                }
            } else {
                otherMovements.push(mov);
            }
        });

        const manualList = Array.from(productionGroups.values()).filter(g => g.main).map(g => ({ ...g, isGroup: true, type: 'manual', ref: g.main.ref }));
        const bipList = Array.from(bipGroups.values()).map(g => ({ ...g, isGroup: true, type: 'bip', ref: g.main.ref }));
        return [...manualList, ...bipList, ...otherMovements].sort((a, b) => (new Date((b as any).isGroup ? (b as any).main.createdAt : (b as StockMovement).createdAt)).getTime() - (new Date((a as any).isGroup ? (a as any).main.createdAt : (a as StockMovement).createdAt)).getTime());
    }, [stockMovements, stockItems]);

    const filteredHistoryItems = useMemo(() => {
        const lower = histSearch.toLowerCase();
        const now = new Date();
        const cutoff = histDateFilter === 'today'
            ? (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; })()
            : histDateFilter === '7d' ? new Date(now.getTime() - 7 * 86400000)
                : histDateFilter === '30d' ? new Date(now.getTime() - 30 * 86400000)
                    : null;
        return processedMovements.filter(item => {
            if ('isGroup' in item) {
                const g = item as any;
                if (cutoff && new Date(g.main.createdAt) < cutoff) return false;
                const origin = g.type === 'manual' ? 'PRODUCAO_MANUAL' : 'BIP';
                if (histOriginFilter !== 'all' && origin !== histOriginFilter) return false;
                if (lower) { const t = `${g.main.stockItemName} ${g.main.ref} ${g.main.createdBy}`.toLowerCase(); if (!t.includes(lower)) return false; }
                return true;
            } else {
                const mov = item as StockMovement;
                if (cutoff && new Date(mov.createdAt) < cutoff) return false;
                if (histOriginFilter !== 'all' && mov.origin !== histOriginFilter) return false;
                if (lower) { const t = `${mov.stockItemName || ''} ${mov.ref || ''} ${mov.createdBy || ''}`.toLowerCase(); if (!t.includes(lower)) return false; }
                return true;
            }
        });
    }, [processedMovements, histSearch, histOriginFilter, histDateFilter]);

    const histStats = useMemo(() => {
        const now = new Date();
        const cutoff = histDateFilter === 'today'
            ? (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; })()
            : histDateFilter === '7d' ? new Date(now.getTime() - 7 * 86400000)
                : histDateFilter === '30d' ? new Date(now.getTime() - 30 * 86400000)
                    : null;
        const lower = histSearch.toLowerCase();
        const filtered = stockMovements.filter(mov => {
            if (cutoff && new Date(mov.createdAt) < cutoff) return false;
            if (histOriginFilter !== 'all' && mov.origin !== histOriginFilter) return false;
            if (lower) { const t = `${mov.stockItemName || ''} ${mov.ref || ''} ${mov.createdBy || ''}`.toLowerCase(); if (!t.includes(lower)) return false; }
            return true;
        });
        const entradas = filtered.filter(m => m.qty_delta > 0).reduce((s, m) => s + m.qty_delta, 0);
        const saidas = filtered.filter(m => m.qty_delta < 0).reduce((s, m) => s + Math.abs(m.qty_delta), 0);
        return { entradas, saidas, total: filtered.length };
    }, [stockMovements, histSearch, histOriginFilter, histDateFilter]);

    const relatorioProdutosProntos = useMemo(() => {
        let totalGeral = 0;
        const individuaisMap = new Map<string, { nome: string, sku: string, total: number, size: number }>();
        const packageSizeMap = new Map<number, number>();

        packGroups.forEach(group => {
            const currentTotal = group.tipo === 'volatil'
                ? (group.quantidade_volatil || 0)
                : stockItems.filter(i => group.item_codes.includes(i.code)).reduce((sum, i) => sum + i.current_qty, 0);

            totalGeral += currentTotal;

            // Tenta detectar o tamanho do pacote pelo nome ou min_pack_qty
            let size = 1;
            const nameMatch = group.name.match(/(\d+)\s*un/i);
            if (nameMatch) {
                size = parseInt(nameMatch[1], 10);
            } else if (group.name.toLowerCase().includes('duplo') || group.name.toLowerCase().includes('par')) {
                size = 2;
            } else if (group.min_pack_qty > 1) {
                size = group.min_pack_qty;
            }

            // Soma no breakdown por tamanho
            const currentSizeTotal = packageSizeMap.get(size) || 0;
            packageSizeMap.set(size, currentSizeTotal + currentTotal);

            let repName = group.name;
            let repSku = group.barcode || "N/A";

            if (group.item_codes.length > 0) {
                const skuCode = group.item_codes[0];
                const matchedItem = stockItems.find(i => i.code === skuCode);
                repName = matchedItem ? matchedItem.name : group.name;
                repSku = skuCode;
            }

            const mapKey = repSku + '-' + repName + '-' + size;
            const existing = individuaisMap.get(mapKey);
            individuaisMap.set(mapKey, {
                nome: repName,
                sku: repSku,
                total: (existing?.total || 0) + currentTotal,
                size
            });
        });

        const individuais = Array.from(individuaisMap.values());
        const packageSizes = Array.from(packageSizeMap.entries())
            .map(([size, total]) => ({ size, total }))
            .sort((a, b) => a.size - b.size);

        const packMovements = stockMovements.filter(m => m.stockItemCode?.startsWith('PACK:'));

        // Agrupar por setor (usando o setor do usuário que criou o log)
        const setorMap = new Map<string, { entradas: number, saidas: number }>();
        const usersMap = new Map(users.map(u => [u.name, u]));

        packMovements.forEach(m => {
            const user = usersMap.get(m.createdBy) as User | undefined;
            const setor = user?.setor?.[0] || 'Geral';
            const stats = setorMap.get(setor) || { entradas: 0, saidas: 0 };
            if (m.qty_delta > 0) stats.entradas += m.qty_delta;
            else stats.saidas += Math.abs(m.qty_delta);
            setorMap.set(setor, stats);
        });

        const setores = Array.from(setorMap.entries()).map(([name, stats]) => ({ name, ...stats }));

        const entradas = packMovements.filter(m => m.qty_delta > 0);
        const saidas = packMovements.filter(m => m.qty_delta < 0);

        const ultimaEntrada = entradas.length > 0 ? new Date(Math.max(...entradas.map(m => new Date(m.createdAt).getTime()))) : null;
        const ultimaSaida = saidas.length > 0 ? new Date(Math.max(...saidas.map(m => new Date(m.createdAt).getTime()))) : null;

        return { totalGeral, individuais, packageSizes, setores, ultimaEntrada, ultimaSaida, packMovements, entradas, saidas };
    }, [packGroups, stockItems, stockMovements, users]);

    const generateProdutosProntosPDF = () => {
        const doc = new jsPDF();
        const startY = 20;

        doc.setFontSize(22);
        doc.setTextColor(41, 128, 185);
        doc.text('Relatório de Fluxo de Produção', 14, startY);

        doc.setFontSize(10);
        doc.setTextColor(100);
        const hojeObj = new Date();
        doc.text(`Gerado em: ${hojeObj.toLocaleString()}`, 14, startY + 8);
        doc.line(14, startY + 12, 196, startY + 12);

        let yPos = startY + 25;

        // --- Totais do Dia ---
        const hoje = hojeObj.toISOString().split('T')[0];
        const entradasDoDia = relatorioProdutosProntos.entradas.filter(m => m.createdAt.startsWith(hoje));
        const saidasDoDia = relatorioProdutosProntos.saidas.filter(m => m.createdAt.startsWith(hoje));
        const sumEntradas = entradasDoDia.reduce((acc, m) => acc + m.qty_delta, 0);
        const sumSaidas = saidasDoDia.reduce((acc, m) => acc + Math.abs(m.qty_delta), 0);

        autoTable(doc, {
            startY: yPos,
            head: [['Resumo Diário', 'Total']],
            body: [
                ['Total Geral em Estoque', `${relatorioProdutosProntos.totalGeral} UN`],
                ['Entradas Hoje', `${sumEntradas} UN`],
                ['Saídas Hoje', `${sumSaidas} UN`],
                ['Saldo do Dia', `${sumEntradas - sumSaidas} UN`]
            ],
            theme: 'grid',
            styles: { fontSize: 10, halign: 'center' },
            headStyles: { fillColor: [41, 128, 185] }
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;

        // --- Mini Gráfico (Barras por Pacote) ---
        doc.setFontSize(14);
        doc.setTextColor(52, 73, 94);
        doc.text('Distribuição por Tamanho de Pacote', 14, yPos);
        yPos += 10;

        const maxTotal = Math.max(...relatorioProdutosProntos.packageSizes.map(p => p.total), 1);
        const chartWidth = 100;
        const chartHeight = 40;

        doc.setDrawColor(200);
        doc.line(14, yPos, 14, yPos + chartHeight); // Eixo Y
        doc.line(14, yPos + chartHeight, 14 + chartWidth, yPos + chartHeight); // Eixo X

        relatorioProdutosProntos.packageSizes.forEach((p, idx) => {
            const barWidth = 15;
            const barSpacing = 10;
            const barHeight = (p.total / maxTotal) * (chartHeight - 5);
            const x = 14 + 5 + (idx * (barWidth + barSpacing));

            doc.setFillColor(52, 152, 219);
            doc.rect(x, yPos + chartHeight - barHeight, barWidth, barHeight, 'F');

            doc.setFontSize(8);
            doc.text(`${p.size} UN`, x + (barWidth / 2) - 3, yPos + chartHeight + 5);
            doc.text(`${p.total}`, x + (barWidth / 2) - 2, yPos + chartHeight - barHeight - 2);
        });

        yPos += chartHeight + 15;

        // --- Setores ---
        doc.setFontSize(14);
        doc.text('Movimentação por Setor', 14, yPos);
        yPos += 10;

        autoTable(doc, {
            startY: yPos,
            head: [['Setor', 'Entradas', 'Saídas', 'Total Líquido']],
            body: relatorioProdutosProntos.setores.map(s => [
                s.name,
                `${s.entradas} UN`,
                `${s.saidas} UN`,
                `${s.entradas - s.saidas} UN`
            ]),
            theme: 'striped',
            headStyles: { fillColor: [52, 73, 94] }
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;

        // --- Lista Completa ---
        doc.setFontSize(14);
        doc.text('Inventário Atual Detalhado', 14, yPos);
        yPos += 10;

        const itensData = relatorioProdutosProntos.individuais.map(i => {
            const numPacks = i.size > 0 ? (i.total / i.size).toFixed(0) : i.total.toString();
            const formatado = i.size > 1 ? `${numPacks} de ${i.size}` : `${i.total} UN`;
            return [i.nome, i.sku, `Pacote ${i.size} UN`, formatado];
        });
        autoTable(doc, {
            startY: yPos,
            head: [['Nome do Item', 'Código SKU', 'Tamanho', 'Saldo']],
            body: itensData,
            theme: 'striped',
            headStyles: { fillColor: [52, 73, 94] }
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;

        // --- Histórico ---
        if (yPos > 240) { doc.addPage(); yPos = 20; }
        doc.setFontSize(14);
        doc.text('Todas as Movimentações do Período', 14, yPos);
        yPos += 10;

        const movData = [...relatorioProdutosProntos.packMovements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(m => {
            const date = new Date(m.createdAt).toLocaleString();
            const tipo = m.qty_delta > 0 ? 'Entrada' : 'Saída';
            let itemNome = m.stockItemName || m.stockItemCode;
            let itemSku = m.stockItemCode || 'N/A';

            if (m.stockItemCode?.startsWith('PACK:')) {
                const groupId = m.stockItemCode.replace('PACK:', '');
                const group = packGroups.find(g => g.id === groupId);
                if (group) {
                    itemNome = group.name;
                    if (group.item_codes.length > 0) {
                        const matchedItem = stockItems.find(i => i.code === group.item_codes[0]);
                        if (matchedItem) {
                            itemNome = matchedItem.name;
                            itemSku = matchedItem.code;
                        }
                    }
                }
            }
            return [date, String(itemNome), String(itemSku), tipo, `${Math.abs(m.qty_delta)} UN`, m.createdBy || 'Sistema', m.ref || ''];
        });

        autoTable(doc, {
            startY: yPos,
            head: [['Data/Hora', 'Nome do Item', 'Código SKU', 'Tipo', 'Qtd', 'Responsável', 'Referência']],
            body: movData,
            theme: 'striped',
            headStyles: { fillColor: [149, 165, 166] },
            styles: { fontSize: 7 }
        });

        doc.save(`Relatorio_EcomFlow_${hoje}.pdf`);
    };

    const renderContent = () => {
        const commonTableProps = {
            searchTerm, currentUser,
            onEdit: (item: StockItem) => setModalState(prev => ({ ...prev, editItem: item })),
            onDelete: (item: StockItem) => setItemToDelete({ item, type: 'item' }),
            onAdjustStock: (item: StockItem) => setModalState(prev => ({ ...prev, manualMovement: item })),
            onUpdateStock: (item: StockItem) => setModalState(prev => ({ ...prev, updateStock: item })),
            onResetVolatile: handleResetVolatile,
            onGenerateBarcode: (item: StockItem) => {
                const data = {
                    id: item.id,
                    nome: item.name,
                    sku_primario: item.code,
                    quantidade_total: item.current_qty,
                    localizacao: item.category || 'N/A',
                    produtos: [{ sku: item.code, nome: item.name, quantidade: 1 }]
                };
                setModalState(prev => ({ ...prev, barcodeModal: { isOpen: true, data, type: 'item' } }));
            }
        };
        const commonCardProps = {
            ...commonTableProps
        };
        switch (activeTab) {
            case 'insumos': return <ResponsiveStockList items={insumos} {...commonCardProps} showColorColumn={false} />;
            case 'processados': return <ResponsiveStockList items={processados} {...commonCardProps} showColorColumn={true} onConfigureBom={(item) => setModalState(prev => ({ ...prev, bomConfig: item }))} onProduce={(item) => setModalState(prev => ({ ...prev, manualMovement: item }))} />;
            case 'produtos':
                return (
                    <>
                        <div className="mb-4">
                            <label className="flex items-center text-sm font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showOnlyWithoutBom}
                                    onChange={(e) => setShowOnlyWithoutBom(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
                                />
                                Mostrar apenas produtos sem receita (BOM) configurada
                            </label>
                        </div>
                        <ResponsiveStockList items={produtos} {...commonCardProps} showColorColumn={true} onConfigureBom={(item) => setModalState(prev => ({ ...prev, bomConfig: item }))} onConfigureExpeditionItems={(item) => setModalState(prev => ({ ...prev, expeditionItemsConfig: item }))} onProduce={(item) => setModalState(prev => ({ ...prev, manualMovement: item }))} selectedIds={selectedIds} onSelect={handleSelect} onSelectAll={(e) => handleSelectAll(e, produtos)} isProdutos onToggleExpand={toggleExpansion} expandedRows={expandedProducts} skuLinks={skuLinks} onTransferSku={(sku, currentMaster) => setTransferState({ sku, currentMaster })} />
                    </>
                );
            case 'pacotes':
                return (
                    <div className="space-y-6">
                        {/* Relatório de Produtos Prontos */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-6">
                            <div className="flex-1">
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mb-4 flex items-center gap-2">
                                    <Box className="text-blue-500" size={20} /> Relatório de Produtos Prontos
                                </h3>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        <p className="text-[10px] font-black text-blue-500 uppercase">Total Geral Adicionado</p>
                                        <p className="text-3xl font-black text-blue-700">{relatorioProdutosProntos.totalGeral} <span className="text-xs">UN</span></p>
                                    </div>
                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                        <p className="text-[10px] font-black text-emerald-500 uppercase">Última Entrada</p>
                                        <p className="text-sm font-bold text-emerald-700 mt-1">{relatorioProdutosProntos.ultimaEntrada ? relatorioProdutosProntos.ultimaEntrada.toLocaleString() : 'N/A'}</p>
                                    </div>
                                    <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                        <p className="text-[10px] font-black text-red-500 uppercase">Última Saída</p>
                                        <p className="text-sm font-bold text-red-700 mt-1">{relatorioProdutosProntos.ultimaSaida ? relatorioProdutosProntos.ultimaSaida.toLocaleString() : 'N/A'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="w-full md:w-64 bg-slate-50 p-4 rounded-xl border border-slate-100 max-h-40 overflow-y-auto">
                                <p className="text-[10px] font-black text-slate-500 uppercase mb-2">Resumo de Seleção</p>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center text-xs pb-1 border-b">
                                        <span className="font-bold text-slate-700">Total Pacotes</span>
                                        <span className="font-black text-blue-600">{packGroups.length}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs pb-1 border-b">
                                        <span className="font-bold text-slate-700">Selecionados</span>
                                        <span className="font-black text-blue-600">{selectedPacks.length}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Controles de Visualização e Filtro */}
                        <div className="flex justify-between items-center bg-white p-4 rounded-xl border mb-4">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setViewModePacks('grid')}
                                    className={`p-2 rounded-lg transition-all ${viewModePacks === 'grid' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                                >
                                    <Layers size={18} />
                                </button>
                                <button
                                    onClick={() => setViewModePacks('list')}
                                    className={`p-2 rounded-lg transition-all ${viewModePacks === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                                >
                                    <FileText size={18} />
                                </button>
                            </div>

                            {selectedPacks.length > 0 && (
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-gray-500 uppercase">{selectedPacks.length} Selecionados</span>
                                    <button
                                        onClick={() => setSelectedPacks([])}
                                        className="text-xs font-bold text-red-500 uppercase hover:underline"
                                    >
                                        Limpar
                                    </button>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button onClick={generateProdutosProntosPDF} className="flex items-center text-xs font-black bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 uppercase tracking-widest">
                                    <FileText size={16} className="mr-2" /> Gerar PDF
                                </button>
                                <button onClick={() => setModalState(prev => ({ ...prev, updatePacksFromSheet: true }))} className="flex items-center text-xs font-black bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 uppercase tracking-widest">
                                    <FileUp size={16} className="mr-2" /> Importar via Excel
                                </button>
                            </div>
                        </div>

                        {viewModePacks === 'grid' ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {packGroups.map(group => {
                                    const isVolatil = group.tipo === 'volatil';
                                    const currentTotal = isVolatil
                                        ? (group.quantidade_volatil || 0)
                                        : stockItems
                                            .filter(i => group.item_codes.includes(i.code))
                                            .reduce((sum, i) => sum + i.current_qty, 0);
                                    const isBelowMin = currentTotal < group.min_pack_qty;
                                    return (
                                        <div key={group.id} className={`bg-white p-6 rounded-2xl border-2 shadow-xl transition-all ${isBelowMin ? 'border-red-500 bg-red-50' : 'border-gray-100 hover:border-blue-300'}`}>
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className="font-black text-slate-800 uppercase tracking-tighter">{group.name}</h3>
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${isVolatil ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                                            }`}>
                                                            {isVolatil ? '⚡ Volátil' : '📊 Tradicional'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">Monitorando {group.item_codes.length} SKUs</p>
                                                    {group.barcode && <p className="text-[9px] font-mono font-bold text-slate-500 mt-1 bg-white inline-block px-1 rounded border border-slate-200">{group.barcode}</p>}
                                                </div>
                                                <div className="flex gap-1">

                                                    <button onClick={() => setModalState(p => ({ ...p, packGroup: group, isPackModalOpen: true }))} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"><Edit3 size={16} /></button>
                                                    <button onClick={() => setItemToDelete({ item: group, type: 'pack_group' })} className="p-2 text-red-600 hover:bg-red-100 rounded-lg"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">{isVolatil ? 'Qtd. Manual' : 'Estoque Calculado'}</p>
                                                    <div className="flex items-baseline gap-1">
                                                        <p className={`text-4xl font-black ${isBelowMin ? 'text-red-600' : 'text-emerald-600'}`}>{currentTotal.toFixed(0)}</p>
                                                        {(() => {
                                                            let size = 1;
                                                            const nameMatch = group.name.match(/(\d+)\s*un/i);
                                                            if (nameMatch) size = parseInt(nameMatch[1], 10);
                                                            else if (group.name.toLowerCase().includes('duplo') || group.name.toLowerCase().includes('par')) size = 2;

                                                            if (size > 1) {
                                                                return <p className="text-sm font-bold text-slate-400">({(currentTotal / size).toFixed(1)} de {size})</p>;
                                                            }
                                                            return <span className="text-sm font-black text-slate-400">UN</span>;
                                                        })()}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Meta Mínima</p>
                                                    <p className="text-xl font-black text-slate-600">{group.min_pack_qty} <span className="text-xs">UN</span></p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                                                <button onClick={() => {
                                                    const data = {
                                                        id: group.id,
                                                        nome: group.name,
                                                        sku_primario: group.barcode || group.item_codes[0] || 'N/A',
                                                        quantidade_total: 1,
                                                        localizacao: 'N/A',
                                                        produtos: group.item_codes.map(code => ({ sku: code, nome: code, quantidade: 1 }))
                                                    };
                                                    setModalState(prev => ({ ...prev, barcodeModal: { isOpen: true, data, type: 'pack' } }));
                                                }} className="flex-1 flex items-center justify-center gap-1 py-2 bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all">
                                                    <Barcode size={14} /> Etiqueta
                                                </button>
                                            </div>
                                            <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-700 ${isBelowMin ? 'bg-red-500' : 'bg-emerald-500'}`}
                                                    style={{ width: `${Math.min(100, (currentTotal / (group.min_pack_qty || 1)) * 100)}%` }}
                                                />
                                            </div>
                                            {isVolatil && (
                                                <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                                                    <button
                                                        onClick={() => setVolatilModal({ isOpen: true, group, type: 'entrada' })}
                                                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-200 transition-all"
                                                    >
                                                        <ArrowDownCircle size={14} /> Entrada
                                                    </button>
                                                    <button
                                                        onClick={() => setVolatilModal({ isOpen: true, group, type: 'saida' })}
                                                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-200 transition-all"
                                                    >
                                                        <ArrowUpCircle size={14} /> Saída
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 border-b">
                                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <th className="px-6 py-4 w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPacks.length === packGroups.length && packGroups.length > 0}
                                                    onChange={(e) => setSelectedPacks(e.target.checked ? packGroups.map(g => g.id) : [])}
                                                    className="h-4 w-4 rounded border-gray-300"
                                                />
                                            </th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Nome do Pacote</th>
                                            <th className="px-6 py-4">Estoque</th>
                                            <th className="px-6 py-4 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {packGroups.map(group => {
                                            const isSelected = selectedPacks.includes(group.id);
                                            const isVolatil = group.tipo === 'volatil';
                                            const currentTotal = isVolatil
                                                ? (group.quantidade_volatil || 0)
                                                : stockItems
                                                    .filter(i => group.item_codes.includes(i.code))
                                                    .reduce((sum, i) => sum + i.current_qty, 0);
                                            const isBelowMin = currentTotal < group.min_pack_qty;

                                            return (
                                                <tr key={group.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                                    <td className="px-6 py-4">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {
                                                                setSelectedPacks(prev => isSelected ? prev.filter(id => id !== group.id) : [...prev, group.id]);
                                                            }}
                                                            className="h-4 w-4 rounded border-gray-300 text-blue-600"
                                                        />
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${isVolatil ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {isVolatil ? '⚡' : '📊'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-black text-slate-700 uppercase">{group.name}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className={`text-sm font-black ${isBelowMin ? 'text-red-600' : 'text-emerald-600'}`}>{currentTotal.toFixed(0)} UN</span>
                                                            {(() => {
                                                                let size = 1;
                                                                const nameMatch = group.name.match(/(\d+)\s*un/i);
                                                                if (nameMatch) size = parseInt(nameMatch[1], 10);
                                                                else if (group.name.toLowerCase().includes('duplo') || group.name.toLowerCase().includes('par')) size = 2;
                                                                if (size > 1) return <span className="text-[10px] text-slate-400 font-bold">({(currentTotal / size).toFixed(1)} de {size})</span>;
                                                                return null;
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-1">
                                                            {isVolatil && (
                                                                <>
                                                                    <button onClick={() => setVolatilModal({ isOpen: true, group, type: 'entrada' })} className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all"><ArrowDownCircle size={14} /></button>
                                                                    <button onClick={() => setVolatilModal({ isOpen: true, group, type: 'saida' })} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all"><ArrowUpCircle size={14} /></button>
                                                                </>
                                                            )}
                                                                    <button onClick={() => {
                                                                        const data = {
                                                                            id: group.id,
                                                                            nome: group.name,
                                                                            sku_primario: group.barcode || group.item_codes[0] || 'N/A',
                                                                            quantidade_total: 1,
                                                                            localizacao: 'N/A',
                                                                            produtos: group.item_codes.map(code => ({ sku: code, nome: code, quantidade: 1 }))
                                                                        };
                                                                        setModalState(prev => ({ ...prev, barcodeModal: { isOpen: true, data, type: 'pack' } }));
                                                                    }} className="p-2 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-600 hover:text-white transition-all" title="Gerar Etiqueta"><Barcode size={14} /></button>
                                                                    <button onClick={() => setModalState(prev => ({ ...prev, packDetail: group }))} className="p-2 text-slate-400 hover:text-blue-600 transition-all"><ArrowRight size={18} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                );
            case 'pesagem': return (
                <div>
                    <button onClick={() => setActiveTab('insumos')} className="flex items-center text-sm font-semibold text-blue-600 hover:underline mb-4"><ArrowLeft size={16} className="mr-2" />Voltar para Estoque</button>
                    <PesagemPage stockItems={stockItems} weighingBatches={weighingBatches} onAddNewWeighing={onAddNewWeighing} currentUser={currentUser!} onDeleteBatch={onDeleteWeighingBatch} users={users} />
                </div>
            );
            case 'movimentacoes': return (
                <div className="space-y-4">
                    {/* Filtros */}
                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input type="text" value={histSearch} onChange={e => setHistSearch(e.target.value)} placeholder="Buscar item, ref, operador..." className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-slate-50 font-bold focus:ring-blue-500 focus:border-blue-500" />
                        </div>
                        <div className="flex items-center gap-1">
                            <Filter size={14} className="text-gray-400" />
                            <select value={histOriginFilter} onChange={e => setHistOriginFilter(e.target.value)} className="text-xs font-bold border border-gray-200 rounded-xl px-3 py-2 bg-slate-50 focus:ring-blue-500">
                                <option value="all">Todas origens</option>
                                <option value="BIP">Bipagem</option>
                                <option value="PRODUCAO_MANUAL">Produção Manual</option>
                                <option value="AJUSTE_MANUAL">Ajuste Manual</option>
                                <option value="PESAGEM">Pesagem</option>
                                <option value="MOAGEM">Moagem</option>
                                <option value="IMPORT_XML">Importação XML</option>
                                <option value="PRODUCAO_INTERNA">Produção Interna</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                            {(['all', 'today', '7d', '30d'] as const).map(f => (
                                <button key={f} onClick={() => setHistDateFilter(f)}
                                    className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest transition-all ${histDateFilter === f ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-blue-500'
                                        }`}>
                                    {f === 'all' ? 'Tudo' : f === 'today' ? 'Hoje' : f === '7d' ? '7 dias' : '30 dias'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-xl"><TrendingUp size={18} className="text-emerald-600" /></div>
                            <div><p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Entradas</p><p className="text-2xl font-black text-emerald-700">{histStats.entradas.toFixed(1)}</p></div>
                        </div>
                        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
                            <div className="p-2 bg-red-100 rounded-xl"><TrendingDown size={18} className="text-red-500" /></div>
                            <div><p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Saídas</p><p className="text-2xl font-black text-red-600">{histStats.saidas.toFixed(1)}</p></div>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-xl"><BarChart2 size={18} className="text-slate-500" /></div>
                            <div><p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Registros</p><p className="text-2xl font-black text-slate-700">{histStats.total}</p></div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white text-sm">
                            <thead className="bg-gray-100"><tr><th className="py-2 px-3 w-8"></th>{['Data/Hora', 'Item', 'Origem', 'Ref.', 'Quantidade', 'Operador', 'Ações'].map(h => <th key={h} className="py-2 px-3 text-left font-semibold text-gray-600">{h}</th>)}</tr></thead>
                            <tbody className="divide-y divide-gray-200">{filteredHistoryItems.length === 0 ? (
                                <tr><td colSpan={8} className="py-12 text-center text-gray-400"><History size={32} className="mx-auto mb-2 opacity-30" /><p className="font-bold text-sm">Nenhuma movimentação encontrada</p><p className="text-xs mt-1">Tente ajustar os filtros acima</p></td></tr>
                            ) : filteredHistoryItems.map((item) => {
                                if ('isGroup' in item) {
                                    const { main, children, ref, type } = item as any;
                                    const isExpanded = expandedMovements.has(ref);
                                    const isManualProd = type === 'manual';
                                    return (<React.Fragment key={ref}><tr className={isManualProd ? "bg-blue-50 hover:bg-blue-100" : "bg-cyan-50 hover:bg-cyan-100"}><td className="py-2 px-3 text-center"><button onClick={() => toggleMovementExpansion(ref)} className="text-blue-600">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button></td><td className="py-2 px-3 text-gray-600 font-semibold">{new Date(main.createdAt).toLocaleString('pt-BR')}</td><td className="py-2 px-3 font-bold text-gray-800">{main.stockItemName}</td><td className="py-2 px-3">{isManualProd ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">{main.origin}</span> : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">BIP</span>}</td><td className="py-2 px-3 font-mono text-gray-500 text-xs">{main.ref}</td><td className={`py-2 px-3 font-bold text-center ${isManualProd ? 'text-green-600' : 'text-gray-700'}`}>{isManualProd ? `+${main.qty_delta.toFixed(2)}` : `(${children.length} insumos)`}</td><td className="py-2 px-3 text-gray-700">{main.createdBy}</td><td className="py-2 px-3 text-center">{currentUser.role === 'SUPER_ADMIN' && isManualProd && (<button onClick={() => setItemToDelete({ item: main, type: 'movement' })} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full" title="Excluir Movimentação Principal"><Trash2 size={14} /></button>)}</td></tr>{isExpanded && children.map((child: StockMovement) => (<tr key={child.id} className="bg-gray-50"><td className="py-1 px-3"></td><td className="py-1 px-3 pl-8 text-gray-500">{new Date(child.createdAt).toLocaleString('pt-BR')}</td><td className="py-1 px-3 pl-8 text-gray-700">{child.stockItemName}</td><td className="py-1 px-3"></td><td className="py-1 px-3"></td><td className={`py-1 px-3 font-semibold text-center text-red-600`}>{child.qty_delta.toFixed(2)}</td><td className="py-1 px-3 text-gray-600">{child.createdBy}</td><td className="py-2 px-3 text-center">{currentUser.role === 'SUPER_ADMIN' && (<button onClick={() => setItemToDelete({ item: child, type: 'movement' })} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full" title="Excluir Insumo Consumido"><Trash2 size={12} /></button>)}</td></tr>))}</React.Fragment>);
                                } else {
                                    const mov = item as StockMovement;
                                    return (<tr key={mov.id}><td></td><td className="py-2 px-3 text-gray-600">{new Date(mov.createdAt).toLocaleString('pt-BR')}</td><td className="py-2 px-3 font-medium text-gray-800">{mov.stockItemName}</td><td><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${mov.origin === 'PESAGEM' ? 'bg-purple-100 text-purple-800' : mov.origin === 'IMPORT_XML' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>{mov.origin}</span></td><td className="py-2 px-3 font-mono text-gray-500 text-xs">{mov.ref}</td><td className={`py-2 px-3 font-bold text-center ${mov.qty_delta > 0 ? 'text-green-600' : 'text-red-600'}`}>{mov.qty_delta > 0 ? '+' : ''}{mov.qty_delta.toFixed(2)}</td><td className="py-2 px-3 text-gray-700">{mov.createdBy}</td><td className="py-2 px-3 text-center">{currentUser.role === 'SUPER_ADMIN' && (<button onClick={() => setItemToDelete({ item: mov, type: 'movement' })} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full" title="Excluir Movimentação"><Trash2 size={14} /></button>)}</td></tr>);
                                }
                            })}</tbody>
                        </table>
                    </div>
                </div>
            );
            default: return null;
        }
    };

    return (
        <div>
            {activeTab !== 'pesagem' && (
                <>
                    <div className="flex justify-between items-start mb-6 flex-wrap gap-4"><div><h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Gestão de Estoque e Almoxarifado</h1><p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-1">Insumos, Produtos Acabados e Pronta Entrega</p></div></div>
                    <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-xl w-full">
                        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                            <div className="relative flex-grow max-w-sm"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" /><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar item por nome ou código..." className="w-full pl-9 pr-3 py-2 text-sm border-gray-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 bg-slate-50 font-bold" /></div>
                            <div className="flex items-center gap-2">
                                {activeTab === 'pacotes' && (
                                    <button onClick={() => setModalState(prev => ({ ...prev, isPackModalOpen: true, packGroup: null }))} className="flex items-center text-xs font-black bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 uppercase tracking-widest"><PlusCircle size={16} className="mr-2" />Novo Grupo de Pacotes</button>
                                )}
                                {activeTab === 'insumos' && (
                                    <button onClick={() => setModalState(prev => ({ ...prev, manageInsumoCategories: true }))} className="flex items-center text-[10px] font-black bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-200 transition-all uppercase tracking-widest"><Settings size={16} className="mr-2" />Categorias</button>
                                )}
                                {activeTab === 'produtos' && (
                                    <button onClick={() => setModalState(prev => ({ ...prev, manageProductCategories: true }))} className="flex items-center text-[10px] font-black bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-200 transition-all uppercase tracking-widest"><Settings size={16} className="mr-2" />Categorias</button>
                                )}
                                {(activeTab === 'produtos' || activeTab === 'processados') && (
                                    <button onClick={() => setModalState(prev => ({ ...prev, bulkUpdate: { isOpen: true, title: 'Lançar Entrada de Estoque' } }))} className="flex items-center text-[10px] font-black bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 uppercase tracking-widest"><ArrowDownCircle size={16} className="mr-2" />Atualizar Estoque</button>
                                )}
                                {selectedIds.size > 0 && activeTab === 'produtos' && (
                                    <div className="flex gap-2">
                                        <button onClick={() => setModalState(prev => ({ ...prev, bulkAssignCategory: true }))} className="flex items-center text-[10px] font-black bg-blue-500 text-white px-4 py-2.5 rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-100 uppercase tracking-widest"><Layers size={16} className="mr-2" />Categorizar ({selectedIds.size})</button>
                                        <button onClick={() => setIsDeleteModalOpen(true)} className="flex items-center text-[10px] font-black bg-red-600 text-white px-4 py-2.5 rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-100 uppercase tracking-widest"><Trash2 size={16} className="mr-2" />Excluir Selecionados</button>
                                    </div>
                                )}
                                {selectedIds.size === 0 && activeTab !== 'pacotes' && activeTab !== 'pesagem' && activeTab !== 'movimentacoes' && (
                                    <button onClick={() => setModalState(prev => ({ ...prev, addItem: true }))} className="flex items-center text-[10px] font-black bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 uppercase tracking-widest"><PlusCircle size={16} className="mr-2" />Adicionar Item</button>
                                )}
                            </div>
                        </div>
                        <div className="border-b border-gray-100"><div className="flex -mb-px flex-wrap gap-2">
                            <TabButton tab="insumos" activeTab={activeTab} label="Insumos" icon={<Package size={16} />} onClick={setActiveTab} />
                            <TabButton tab="processados" activeTab={activeTab} label="Processados" icon={<Factory size={16} />} onClick={setActiveTab} />
                            <TabButton tab="produtos" activeTab={activeTab} label="Produtos (SKU)" icon={<Package size={16} />} onClick={setActiveTab} />
                            <TabButton tab="pacotes" activeTab={activeTab} label="Pacotes Prontos" icon={<Box size={16} />} onClick={setActiveTab} />
                            <TabButton tab="pesagem" activeTab={activeTab} label="Pesagem" icon={<Weight size={16} />} onClick={setActiveTab} />
                            <TabButton tab="movimentacoes" activeTab={activeTab} label="Histórico" icon={<History size={16} />} onClick={setActiveTab} />
                        </div></div>
                        <div className="mt-6">{renderContent()}</div>
                    </div>
                </>
            )}
            {activeTab === 'pesagem' && renderContent()}
            {modalState.addItem && <AddItemModal isOpen={modalState.addItem} onClose={closeModal} itemType={itemTypeForNewItem} onConfirm={handleConfirmAddItem} generalSettings={generalSettings} />}
            {modalState.editItem && <EditItemModal isOpen={!!modalState.editItem} onClose={closeModal} item={modalState.editItem} currentUser={currentUser!} onConfirm={handleConfirmEditItem} generalSettings={generalSettings} products={substituteOptions} />}
            {modalState.bomConfig && <BomConfigModal isOpen={!!modalState.bomConfig} onClose={closeModal} product={modalState.bomConfig} insumos={[...insumos, ...processados]} currentBom={produtosCombinados.find(b => b.productSku === modalState.bomConfig?.code)} onSave={(productSku, items) => { onSaveProdutoCombinado(productSku, items); closeModal(); }} />}
            {modalState.expeditionItemsConfig && <ExpeditionItemsConfigModal isOpen={!!modalState.expeditionItemsConfig} onClose={closeModal} product={modalState.expeditionItemsConfig} insumos={insumos} onSave={(productCode, items) => { onSaveExpeditionItems(productCode, items); closeModal(); }} />}
            {modalState.manualMovement && <ManualMovementModal isOpen={!!modalState.manualMovement} onClose={closeModal} items={stockItems} onConfirm={handleConfirmManualMovement} preselectedItem={modalState.manualMovement} />}
            {modalState.updateStock && <UpdateStockModal isOpen={!!modalState.updateStock} onClose={closeModal} item={modalState.updateStock} onConfirm={handleConfirmUpdateStock} />}
            {modalState.importXml && <ImportXmlModal isOpen={modalState.importXml} onClose={closeModal} existingStockItems={stockItems} onConfirmImport={(payload) => { onConfirmImportFromXml(payload); closeModal(); }} generalSettings={generalSettings} />}
            {modalState.manageInsumoCategories && <InsumoCategoryManagerModal isOpen={modalState.manageInsumoCategories} onClose={closeModal} currentCategories={generalSettings.insumoCategoryList} onSave={handleSaveInsumoCategories} />}
            {modalState.manageProductCategories && <InsumoCategoryManagerModal isOpen={modalState.manageProductCategories} onClose={closeModal} currentCategories={generalSettings.productCategoryList} onSave={handleSaveProductCategories} allProducts={produtos} onAssignProducts={handleAssignProductsToCategory} />}
            {modalState.updateFromSheet && <UpdateStockFromSheetModal isOpen={modalState.updateFromSheet} onClose={closeModal} stockItems={stockItems} onBulkInventoryUpdate={onBulkInventoryUpdate} />}
            {modalState.updateFromSheetShopee && <UpdateStockFromSheetModalShopee isOpen={modalState.updateFromSheetShopee} onClose={closeModal} stockItems={stockItems} onBulkInventoryUpdate={onBulkInventoryUpdate} />}
            {modalState.isPackModalOpen && <PackGroupModal isOpen={modalState.isPackModalOpen} onClose={closeModal} groupToEdit={modalState.packGroup} allProducts={produtos} onSave={handleSavePackGroup} />}
            {volatilModal.isOpen && volatilModal.group && (
                <VolatilMovementModal
                    isOpen={volatilModal.isOpen}
                    onClose={() => setVolatilModal({ isOpen: false, group: null, type: 'entrada' })}
                    group={volatilModal.group}
                    stockItems={stockItems}
                    onConfirm={async (groupId, delta, ref) => {
                        await handleVolatilMovement(groupId, delta, ref);
                    }}
                    movementType={volatilModal.type}
                />
            )}
            {modalState.bulkUpdate.isOpen && <BulkStockUpdateModal isOpen={modalState.bulkUpdate.isOpen} onClose={closeModal} stockItems={stockItems} onConfirm={handleBulkStockConfirm} preselectedCodes={modalState.bulkUpdate.preselectedCodes} title={modalState.bulkUpdate.title} activeTab={activeTab as any} categories={activeTab === 'produtos' ? generalSettings.productCategoryList : activeTab === 'insumos' ? generalSettings.insumoCategoryList : []} />}
            {modalState.bulkAssignCategory && <BulkAssignCategoryModal isOpen={modalState.bulkAssignCategory} onClose={closeModal} onConfirm={handleBulkAssignConfirm} categories={generalSettings.productCategoryList} selectedCount={selectedIds.size} />}
            {modalState.updatePacksFromSheet && <UpdatePacksFromSheetModal isOpen={modalState.updatePacksFromSheet} onClose={closeModal} packGroups={packGroups} onBulkInventoryUpdate={onBulkInventoryUpdate} />}
            {itemToDelete && <ConfirmActionModal isOpen={!!itemToDelete} onClose={closeModal} onConfirm={handleConfirmDelete} title="Confirmar Exclusão" message={<><p>Você tem certeza que deseja excluir <strong>{itemToDelete.item.name || itemToDelete.item.stockItemName}</strong>?</p><p className="font-bold text-red-700">Esta ação é irreversível.</p></>} confirmButtonText="Excluir Permanentemente" isConfirming={isDeleting} />}
            {isDeleteModalOpen && <ConfirmActionModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDeleteSelected} title="Confirmar Exclusão em Massa" message={<><p>Você tem certeza que deseja excluir <strong>{selectedIds.size} produto(s)</strong> selecionado(s)?</p><p className="font-bold text-red-700">Esta ação é irreversível e removerá os registros permanentemente.</p></>} confirmButtonText="Excluir Permanentemente" isConfirming={isDeleting} />}
            {transferState && <TransferSkuModal isOpen={!!transferState} onClose={closeModal} skuToTransfer={transferState.sku} currentMaster={transferState.currentMaster} allProducts={produtos} onConfirmTransfer={handleConfirmTransfer} />}
            {modalState.barcodeModal?.isOpen && (
                <BarcodeLabelModal
                    isOpen={modalState.barcodeModal.isOpen}
                    onClose={closeModal}
                    pacote={modalState.barcodeModal.data}
                    targetTable={modalState.barcodeModal.type === 'item' ? 'stock_items' : 'estoque_pronto'}
                    addToast={props.addToast || (() => {})}
                />
            )}
        </div>
    );
};

// ... ResponsiveStockList, StockRow e StockCard permanecem iguais ...
const ResponsiveStockList: React.FC<any> = (props) => {
    const { items, searchTerm, onSelectAll, selectedIds } = props;
    const filteredItems = useMemo(() =>
        items.filter((item: StockItem) =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.code.toLowerCase().includes(searchTerm.toLowerCase())
        ), [items, searchTerm]);

    const hasAdjustPermission = props.currentUser.role === 'ADMIN' || props.currentUser.role === 'SUPER_ADMIN';

    // Grouping logic
    const groupedItems = useMemo(() => {
        if (items.length === 0) return null;
        const groups = filteredItems.reduce((acc: Record<string, StockItem[]>, item: StockItem) => {
            const category = item.category || 'Sem Categoria';
            if (!acc[category]) { acc[category] = []; }
            acc[category].push(item);
            return acc;
        }, {});
        return Object.keys(groups).sort((a, b) => {
            if (a === 'Sem Categoria') return 1; if (b === 'Sem Categoria') return -1; return a.localeCompare(b);
        }).map(category => ({ category, items: groups[category] }));
    }, [filteredItems, items]);

    return (
        <div>
            {/* Mobile View - Cards */}
            <div className="md:hidden space-y-4">
                {groupedItems ? (
                    groupedItems.map(({ category, items: categoryItems }) => (
                        <div key={category}>
                            <h3 className="text-lg font-black text-slate-800 my-4 p-2 bg-slate-100 rounded-xl uppercase tracking-tighter">{category}</h3>
                            {categoryItems.map((item: StockItem) => <StockCard key={item.id} item={item} {...props} hasAdjustPermission={hasAdjustPermission} />)}
                        </div>
                    ))
                ) : (
                    filteredItems.map((item: StockItem) => <StockCard key={item.id} item={item} {...props} hasAdjustPermission={hasAdjustPermission} />)
                )}
            </div>

            {/* Desktop View - Table */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
                <table className="min-w-full bg-white text-sm">
                    <thead className="bg-slate-900 text-white uppercase text-[10px] font-black sticky top-0 z-10">
                        <tr>
                            {props.onSelectAll && <th className="py-4 px-3 w-8 text-center"><input type="checkbox" onChange={(e) => onSelectAll(e, filteredItems)} checked={filteredItems.length > 0 && selectedIds && filteredItems.every((i: StockItem) => selectedIds.has(i.id))} /></th>}
                            {props.isProdutos && <th className="p-4"></th>}
                            {['Ações', 'Código', 'Nome do Item', props.showColorColumn && 'Cor', 'Saldo Atual', props.isProdutos && 'Reservado', props.isProdutos && 'Pronto', 'Estoque Mínimo', 'Unidade', props.isProdutos && 'SKUs'].filter(Boolean).map(h => <th key={h as string} className="py-4 px-3 text-left">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-bold text-slate-600">
                        {groupedItems ? (
                            groupedItems.flatMap(({ category, items: categoryItems }) => [
                                <tr key={category} className="bg-slate-50 sticky top-10 border-b border-gray-200"><td colSpan={10} className="py-2 px-4 text-xs font-black text-slate-400 uppercase tracking-widest">{category}</td></tr>,
                                ...categoryItems.map((item: StockItem) => <StockRow key={item.id} item={item} {...props} hasAdjustPermission={hasAdjustPermission} />)
                            ])
                        ) : (
                            filteredItems.map((item: StockItem) => <StockRow key={item.id} item={item} {...props} hasAdjustPermission={hasAdjustPermission} />)
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const StockRow: React.FC<{ item: StockItem, hasAdjustPermission: boolean } & any> = ({ item, hasAdjustPermission, ...props }) => {
    const { onAdjustStock, onUpdateStock, onConfigureBom, onConfigureExpeditionItems, onProduce, onEdit, onDelete, selectedIds, onSelect, isProdutos, expandedRows, onToggleExpand, skuLinks, onTransferSku, currentUser, onResetVolatile } = props;
    const isBelowMin = item.current_qty < item.min_qty;
    const isSelected = selectedIds && selectedIds.has(item.id);
    const isExpanded = isProdutos && expandedRows && expandedRows.has(item.id);
    const linkedSkusForThisProduct = isProdutos && skuLinks ? skuLinks.filter((link: SkuLink) => link.masterProductSku === item.code) : [];

    return (
        <React.Fragment>
            <tr className={`${isSelected ? 'bg-blue-50/50' : isBelowMin ? 'bg-red-50' : 'hover:bg-slate-50/50'}`}>
                {onSelect && <td className="py-4 px-3"><input type="checkbox" checked={isSelected} onChange={e => onSelect(item.id, e.target.checked)} className="rounded-md border-gray-300 text-blue-600" /></td>}
                {isProdutos && <td className="py-4 px-3"><button onClick={() => onToggleExpand(item.id)} className="text-gray-300 hover:text-blue-600">{isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button></td>}
                <td className="py-4 px-3"><div className="flex items-center gap-2">
                    {(item.kind === 'INSUMO' || item.kind === 'PRODUTO' || item.kind === 'PROCESSADO') && <button onClick={() => onUpdateStock(item)} title="Entrada Rápida" className="p-1 hover:bg-green-100 text-green-600 rounded"><PlusCircle size={16} /></button>}
                    <button onClick={() => onEdit(item)} title="Editar" className="p-1 hover:bg-blue-100 text-blue-600 rounded"><Edit3 size={16} /></button>
                    {hasAdjustPermission && <button onClick={() => onAdjustStock(item)} title="Ajustar Saldo" className="p-1 hover:bg-orange-100 text-orange-600 rounded"><SlidersHorizontal size={16} /></button>}
                    {onProduce && <button onClick={() => onProduce(item)} title={item.kind === 'PRODUTO' ? 'Registrar Estoque Pronto (BOM + Modo Volátil auto)' : 'Registrar Produção via BOM'} className="p-1 hover:bg-purple-100 text-purple-600 rounded"><Factory size={16} /></button>}
                    {item.is_volatile_infinite && onResetVolatile && <button onClick={() => onResetVolatile(item)} title="Desativar Modo Volátil Manualmente" className="p-1 hover:bg-orange-100 text-orange-600 rounded"><RefreshCw size={16} /></button>}
                    {onConfigureBom && <button onClick={() => onConfigureBom(item)} title="Configurar Receita (BOM)" className="p-1 hover:bg-slate-200 text-slate-600 rounded"><Cog size={16} /></button>}
                    {onConfigureExpeditionItems && <button onClick={() => onConfigureExpeditionItems(item)} title="Configurar Itens de Expedição" className="p-1 hover:bg-slate-200 text-slate-600 rounded"><Box size={16} /></button>}
                    <button onClick={() => props.onGenerateBarcode(item)} title="Gerar Etiqueta" className="p-1 hover:bg-slate-200 text-slate-600 rounded"><Barcode size={16} /></button>
                    {currentUser.role === 'SUPER_ADMIN' && <button onClick={() => onDelete(item)} title="Excluir" className="p-1 hover:bg-red-100 text-red-600 rounded"><Trash2 size={16} /></button>}
                </div></td>
                <td className="py-4 px-3 font-mono text-xs">{item.code}</td>
                <td className="py-4 px-3 text-slate-800">{item.name}</td>
                {props.showColorColumn && <td className="py-4 px-3 text-xs">{item.color || 'N/A'}</td>}
                <td className={`py-4 px-3 text-center font-black ${isBelowMin ? 'text-red-600' : 'text-slate-900'}`}>{item.current_qty.toFixed(2)}</td>
                {isProdutos && <td className="py-4 px-3 text-center text-orange-600 font-bold">{(item.reserved_qty || 0).toFixed(2)}</td>}
                {isProdutos && <td className="py-4 px-3 text-center text-emerald-600 font-black">
                    {(item.ready_qty || 0).toFixed(2)}
                    {item.is_volatile_infinite && <span className="ml-1.5 text-[8px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wide align-middle">⚡ Volátil</span>}
                </td>}
                <td className="py-4 px-3 text-center opacity-60">{item.min_qty.toFixed(2)}</td>
                <td className="py-4 px-3 text-center uppercase text-[10px] font-black text-gray-400">{item.unit}</td>
                {isProdutos && <td className="py-4 px-3 text-center">{linkedSkusForThisProduct.length > 0 ? <span className="bg-blue-100 text-blue-700 text-[9px] font-black px-2 py-0.5 rounded-full">{linkedSkusForThisProduct.length}</span> : <span className="text-gray-300 text-[9px]">—</span>}</td>}
            </tr>
            {isExpanded && (
                <tr className="bg-slate-50">
                    <td colSpan={10} className="p-4">
                        <div className="flex gap-2 mb-3">
                            <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-1 rounded-md uppercase tracking-widest">SKUs Vinculados</span>
                        </div>
                        {linkedSkusForThisProduct.length > 0 ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">{linkedSkusForThisProduct.map((link: SkuLink) => (
                                <div key={link.importedSku} className="flex flex-col bg-white p-2 rounded-xl border border-gray-100 shadow-sm">
                                    <span className="font-mono text-[9px] text-gray-400 uppercase truncate" title={link.importedSku}>{link.importedSku}</span>
                                    <button onClick={() => onTransferSku(link.importedSku, item)} className="text-[10px] font-black text-blue-600 hover:underline mt-1 text-left uppercase">Transferir</button>
                                </div>
                            ))}</div>
                        ) : <p className="text-xs text-gray-400 font-bold italic">Nenhum SKU de importação vinculado.</p>}
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
};

const StockCard: React.FC<{ item: StockItem, hasAdjustPermission: boolean } & any> = ({ item, hasAdjustPermission, ...props }) => {
    const { onAdjustStock, onUpdateStock, onConfigureBom, onConfigureExpeditionItems, onProduce, onEdit, onDelete, isProdutos, expandedRows, onToggleExpand, skuLinks, onTransferSku, currentUser, onResetVolatile } = props;
    const isBelowMin = item.current_qty < item.min_qty;
    const isExpanded = isProdutos && expandedRows && expandedRows.has(item.id);
    const linkedSkusForThisProduct = isProdutos && skuLinks ? skuLinks.filter((link: SkuLink) => link.masterProductSku === item.code) : [];

    return (
        <div className={`p-4 rounded-3xl border shadow-lg transition-all ${isBelowMin ? 'bg-red-50 border-red-200 shadow-red-50' : item.is_volatile_infinite ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-100 hover:border-blue-200'}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-black text-slate-800 uppercase leading-tight">{item.name}</p>
                    <p className="text-[10px] font-mono font-bold text-gray-400 uppercase mt-1">{item.code}</p>
                    {item.is_volatile_infinite && <span className="inline-block mt-1 text-[8px] bg-orange-200 text-orange-700 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wide">⚡ Modo Volátil</span>}
                </div>
                {isProdutos && <button onClick={() => onToggleExpand(item.id)} className="p-2 text-slate-300">{isExpanded ? <ChevronUp size={24} /> : <ChevronDown size={24} />}</button>}
            </div>
            <div className="flex justify-between items-end mt-4">
                <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Saldo Atual</p>
                    <p className={`text-2xl font-black ${isBelowMin ? 'text-red-600' : 'text-slate-900'}`}>{item.current_qty.toFixed(1)} <span className="text-xs">{item.unit}</span></p>
                    {isProdutos && (
                        <p className="text-[10px] text-emerald-600 font-black mt-1">
                            Pronto: {(item.ready_qty || 0).toFixed(1)} {item.unit}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {(item.kind === 'INSUMO' || item.kind === 'PRODUTO' || item.kind === 'PROCESSADO') && <button onClick={() => onUpdateStock(item)} className="p-2 bg-green-50 text-green-600 rounded-xl"><PlusCircle size={20} /></button>}
                    <button onClick={() => onEdit(item)} className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Edit3 size={20} /></button>
                    {hasAdjustPermission && <button onClick={() => onAdjustStock(item)} className="p-2 bg-orange-50 text-orange-600 rounded-xl"><SlidersHorizontal size={20} /></button>}
                    {onProduce && <button onClick={() => onProduce(item)} title={item.kind === 'PRODUTO' ? 'Registrar para Estoque Pronto (BOM)' : 'Produção via BOM'} className="p-2 bg-purple-50 text-purple-600 rounded-xl"><Factory size={20} /></button>}
                    <button onClick={() => props.onGenerateBarcode(item)} className="p-2 bg-slate-50 text-slate-600 rounded-xl"><Barcode size={20} /></button>
                    {item.is_volatile_infinite && onResetVolatile && <button onClick={() => onResetVolatile(item)} title="Reset Volátil" className="p-2 bg-orange-50 text-orange-600 rounded-xl"><RefreshCw size={20} /></button>}
                </div>
            </div>
            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-2">Vínculos ({linkedSkusForThisProduct.length})</p>
                    <div className="grid grid-cols-2 gap-2">{linkedSkusForThisProduct.map((link: SkuLink) => (
                        <div key={link.importedSku} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="font-mono text-[9px] text-slate-500 uppercase truncate w-20">{link.importedSku}</span>
                            <button onClick={() => onTransferSku(link.importedSku, item)} className="text-[9px] font-black text-blue-600 uppercase">Trocar</button>
                        </div>
                    ))}</div>
                </div>
            )}
        </div>
    );
};

export default EstoquePage;
