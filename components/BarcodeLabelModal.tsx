import React, { useState, useEffect, useCallback } from 'react';
import { 
    X, 
    Printer, 
    Download, 
    QrCode, 
    Barcode as BarcodeIcon, 
    Layers, 
    Package as PackageIcon,
    Loader2,
    CheckCircle2
} from 'lucide-react';
import { generateBarcodeBase64, generateQRCodeBase64 } from '../utils/barcodeUtils';
import { jsPDF } from 'jspdf';
import { dbClient } from '../lib/supabaseClient';

interface Product {
    sku: string;
    nome: string;
    quantidade: number;
}

interface PacoteProto {
    id: string;
    nome: string;
    sku_primario: string;
    quantidade_total: number;
    localizacao: string;
    produtos: Product[];
}

type LabelType = 'barcode' | 'qrcode';
type LabelScope = 'batch' | 'products';

interface BarcodeLabelModalProps {
    isOpen: boolean;
    onClose: () => void;
    pacote: PacoteProto & { final_product_code?: string };
    targetTable?: 'estoque_pronto' | 'stock_items';
    addToast: (message: string, type: 'success' | 'error' | 'info') => void;
    skuLinks?: any[];
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({ 
    isOpen, 
    onClose, 
    pacote,
    targetTable = 'estoque_pronto',
    addToast,
    skuLinks = []
}) => {
    const [labelType, setLabelType] = useState<LabelType>('barcode');
    const [labelScope, setLabelScope] = useState<LabelScope>('batch');
    const [previews, setPreviews] = useState<{ id: string, name: string, dataUrl: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Novas opções
    const [useFinalProduct, setUseFinalProduct] = useState(false);
    const [labelQty, setLabelQty] = useState(1);
    const [observation, setObservation] = useState('');
    const [labelWidth, setLabelWidth] = useState(100);
    const [labelHeight, setLabelHeight] = useState(50);
    const [cols, setCols] = useState(1);
    const [rows, setRows] = useState(1);
    const [pageSize, setPageSize] = useState<[number, number] | null>(null);

    const getMasterSku = useCallback((sku: string) => {
        const link = skuLinks.find((l: any) => l.importedSku === sku);
        return link ? link.masterProductSku : sku;
    }, [skuLinks]);

    const presets = [
        { name: 'Padrão (100x50)', width: 100, height: 50, cols: 1, rows: 1, pageSize: null },
        { name: 'Padrão (40x25mm)', width: 40, height: 25, cols: 1, rows: 1, pageSize: null },
        { name: 'Pequena (33x21mm) - 3 Colunas', width: 33, height: 21, cols: 3, rows: 1, pageSize: null },
        { name: 'A6 (3x3 - 9 Etiquetas)', width: 33, height: 48, cols: 3, rows: 3, pageSize: [105, 148] as [number, number] },
        { name: 'A6 Retrato (100x150mm)', width: 100, height: 150, cols: 1, rows: 1, pageSize: null },
        { name: 'A6 Paisagem (150x100mm)', width: 150, height: 100, cols: 1, rows: 1, pageSize: null },
        { name: 'A4 Folha Inteira (210x297mm)', width: 210, height: 297, cols: 1, rows: 1, pageSize: null },
    ];

    const generatePreviews = useCallback(async () => {
        setIsLoading(true);
        try {
            const newPreviews: { id: string, name: string, dataUrl: string }[] = [];
            
            if (labelScope === 'batch') {
                const code = getMasterSku((useFinalProduct && pacote.final_product_code) ? pacote.final_product_code : pacote.sku_primario);
                const dataUrl = labelType === 'barcode' 
                    ? await generateBarcodeBase64(code) 
                    : await generateQRCodeBase64(code);
                
                newPreviews.push({ id: code, name: `Lote: ${pacote.nome}`, dataUrl });
            } else {
                for (const prod of pacote.produtos) {
                    const code = getMasterSku((useFinalProduct && pacote.final_product_code) ? pacote.final_product_code : prod.sku);
                    const dataUrl = labelType === 'barcode' 
                        ? await generateBarcodeBase64(code) 
                        : await generateQRCodeBase64(code);
                    
                    newPreviews.push({ id: code, name: prod.nome, dataUrl });
                }
            }
            
            setPreviews(newPreviews);
        } catch (error) {
            console.error('Erro ao gerar previews:', error);
            addToast('Erro ao gerar visualização das etiquetas', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [labelType, labelScope, pacote, addToast, useFinalProduct, getMasterSku]);

    useEffect(() => {
        if (labelWidth === 33 && labelHeight === 21) setCols(3);
        else if (labelWidth >= 100) setCols(1);
        else if (labelWidth >= 60) setCols(1);
        else setCols(1);
    }, [labelWidth, labelHeight]);

    useEffect(() => {
        if (isOpen) {
            generatePreviews();
        }
    }, [isOpen, generatePreviews]);

    const handlePrint = async () => {
        try {
            const docWidth = pageSize ? pageSize[0] : labelWidth * cols;
            const docHeight = pageSize ? pageSize[1] : labelHeight * rows;
            
            const doc = new jsPDF({
                orientation: docWidth > docHeight ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [docWidth, docHeight]
            });

            let currentLabelIndex = 0;
            const labelsPerSet = labelQty;
            const totalLabels = previews.length * labelsPerSet;
            const labelsPerPage = cols * rows;
            const totalPages = Math.ceil(totalLabels / labelsPerPage);
            let currentPageNum = 1;
            
            for (let i = 0; i < previews.length; i++) {
                const preview = previews[i];
                for (let q = 0; q < labelsPerSet; q++) {
                    const labelInPageIndex = currentLabelIndex % labelsPerPage;
                    const colIndex = labelInPageIndex % cols;
                    const rowIndex = Math.floor(labelInPageIndex / cols);
                    
                    if (labelInPageIndex === 0 && currentLabelIndex > 0) {
                        doc.addPage([docWidth, docHeight], docWidth > docHeight ? 'landscape' : 'portrait');
                        currentPageNum++;
                    }
                    
                    const offsetX = colIndex * labelWidth;
                    const offsetY = rowIndex * labelHeight;
                    
                    // Desenhar borda
                    doc.setDrawColor(200);
                    doc.rect(offsetX + 2, offsetY + 2, labelWidth - 4, labelHeight - 4);

                    // Título
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.text(preview.name.substring(0, 40), offsetX + 5, offsetY + 8);
                    
                    // Código
                    doc.setFontSize(8);
                    doc.setFont('helvetica', 'normal');
                    doc.text(`ID: ${preview.id}`, offsetX + 5, offsetY + 13);

                    // Imagem do código
                    const imgWidth = labelWidth - 10;
                    const imgHeight = (labelHeight / 2);
                    
                    if (labelType === 'barcode') {
                        doc.addImage(preview.dataUrl, 'PNG', offsetX + 5, offsetY + 15, imgWidth, imgHeight);
                    } else {
                        const qrSize = Math.min(imgWidth, imgHeight);
                        doc.addImage(preview.dataUrl, 'PNG', offsetX + (labelWidth - qrSize) / 2, offsetY + 15, qrSize, qrSize);
                    }

                    // Info adicional e Observação
                    doc.setFontSize(7);
                    if (observation) {
                        doc.text(`OBS: ${observation}`, offsetX + 5, offsetY + labelHeight - 10, { maxWidth: labelWidth - 10 });
                    }
                    doc.text(`Data: ${new Date().toLocaleDateString()}`, offsetX + 5, offsetY + labelHeight - 5);
                    doc.text(`Loc: ${pacote.localizacao}`, offsetX + labelWidth - 5, offsetY + labelHeight - 5, { align: 'right' });
                    doc.text(`Pág: ${currentPageNum}/${totalPages}`, offsetX + labelWidth / 2, offsetY + labelHeight - 5, { align: 'center' });
                    
                    currentLabelIndex++;
                }
            }

            doc.save(`etiquetas_${pacote.sku_primario}.pdf`);
            addToast('PDF gerado com sucesso!', 'success');
            
            if (labelScope === 'batch') {
                await saveBarcodeToDb();
            }
        } catch (error) {
            console.error('Erro ao imprimir:', error);
            addToast('Erro ao gerar PDF', 'error');
        }
    };

    const saveBarcodeToDb = async () => {
        setIsSaving(true);
        try {
            const { error } = await dbClient
                .from(targetTable)
                .update({ barcode: pacote.sku_primario })
                .eq('id', pacote.id);

            if (error) throw error;
            addToast(`Código vinculado com sucesso na tabela ${targetTable}`, 'success');
        } catch (error) {
            console.error('Erro ao salvar no banco:', error);
            addToast('Erro ao salvar código no banco de dados', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                            <Printer className="text-emerald-600" size={28} />
                            Gerar Etiquetas
                        </h2>
                        <p className="text-sm font-bold text-slate-500 mt-1">Configurar e imprimir códigos para {pacote.nome}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar Config */}
                    <div className="w-80 p-6 border-r border-slate-100 bg-slate-50/50 space-y-8 overflow-y-auto">
                        {/* Tipo de Código */}
                        <div>
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 block">Tipo de Código</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => setLabelType('barcode')}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${labelType === 'barcode' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}`}
                                >
                                    <BarcodeIcon size={24} />
                                    <span className="text-xs font-bold">Barras</span>
                                </button>
                                <button 
                                    onClick={() => setLabelType('qrcode')}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${labelType === 'qrcode' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}`}
                                >
                                    <QrCode size={24} />
                                    <span className="text-xs font-bold">QR Code</span>
                                </button>
                            </div>
                        </div>

                        {/* Escopo */}
                        <div>
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 block">Escopo das Etiquetas</label>
                            <div className="space-y-2">
                                <button 
                                    onClick={() => setLabelScope('batch')}
                                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${labelScope === 'batch' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}`}
                                >
                                    <Layers size={20} />
                                    <div className="text-left">
                                        <p className="text-xs font-bold">Etiqueta do Lote</p>
                                        <p className="text-[10px] opacity-70">Gera 1 código para o pacote</p>
                                    </div>
                                </button>
                                <button 
                                    onClick={() => setLabelScope('products')}
                                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${labelScope === 'products' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}`}
                                >
                                    <PackageIcon size={20} />
                                    <div className="text-left">
                                        <p className="text-xs font-bold">Por Produto</p>
                                        <p className="text-[10px] opacity-70">Gera {pacote.produtos.length} códigos individuais</p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Opções de Customização */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                            <div>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-10 h-5 rounded-full p-1 transition-all ${useFinalProduct ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                                        <div className={`w-3 h-3 bg-white rounded-full transition-all ${useFinalProduct ? 'ml-5' : 'ml-0'}`} />
                                    </div>
                                    <input type="checkbox" className="hidden" checked={useFinalProduct} onChange={e => setUseFinalProduct(e.target.checked)} />
                                    <span className="text-xs font-bold text-slate-600">Produtos (SKU)</span>
                                </label>
                                {useFinalProduct && !pacote.final_product_code && (
                                    <p className="text-[9px] text-amber-600 mt-1 italic font-bold">⚠️ O pacote não tem SKU configurado em Produtos (SKU).</p>
                                )}
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Quantidade de Cópias</label>
                                <input 
                                    type="number" 
                                    min={1} 
                                    value={labelQty} 
                                    onChange={e => setLabelQty(Number(e.target.value))}
                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-emerald-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Sugestões de Tamanho</label>
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    {presets.map(p => (
                                        <button 
                                            key={p.name}
                                            onClick={() => { 
                                                setLabelWidth(p.width); 
                                                setLabelHeight(p.height); 
                                                setCols(p.cols); 
                                                setRows(p.rows); 
                                                setPageSize(p.pageSize);
                                            }}
                                            className={`text-[9px] font-black p-2 bg-white border rounded-lg transition-all uppercase ${labelWidth === p.width && labelHeight === p.height ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 hover:bg-slate-100 hover:border-slate-300'}`}
                                        >
                                            {p.name}
                                        </button>
                                    ))}
                                </div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Tamanho customizado (L x A mm)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input 
                                        type="number" 
                                        value={labelWidth} 
                                        onChange={e => setLabelWidth(Number(e.target.value))}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-emerald-500 outline-none"
                                        placeholder="L mm"
                                    />
                                    <input 
                                        type="number" 
                                        value={labelHeight} 
                                        onChange={e => setLabelHeight(Number(e.target.value))}
                                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-emerald-500 outline-none"
                                        placeholder="A mm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Configuração de Impressão</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-bold text-slate-400">Colunas</label>
                                        <input 
                                            type="number" min={1} value={cols} 
                                            onChange={e => setCols(Number(e.target.value))}
                                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-bold text-slate-400">Linhas</label>
                                        <input 
                                            type="number" min={1} value={rows} 
                                            onChange={e => setRows(Number(e.target.value))}
                                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-emerald-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block">Observação na Etiqueta</label>
                                <textarea 
                                    value={observation}
                                    onChange={e => setObservation(e.target.value)}
                                    placeholder="Ex: Frágil / Manusear com cuidado"
                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-emerald-500 outline-none h-20 resize-none"
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                           <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                               Ao imprimir a etiqueta do lote, o código será salvo no banco de dados para permitir a identificação automática via scanner.
                           </p>
                        </div>
                    </div>

                    {/* Preview Area */}
                    <div className="flex-1 p-8 bg-slate-200/50 overflow-y-auto">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 block">Visualização da Impressão</label>
                        
                        {isLoading ? (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                                <Loader2 size={40} className="animate-spin mb-4" />
                                <p className="font-bold">Gerando etiquetas...</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-6 justify-items-center">
                                {previews.map((preview, i) => (
                                    <div key={i} className="bg-white w-[400px] h-[200px] shadow-lg rounded-sm border border-slate-300 p-6 flex flex-col relative overflow-hidden">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="text-sm font-black text-slate-800 uppercase">{preview.name}</p>
                                                <p className="text-xs font-mono text-slate-400">ID: {preview.id}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">Localização</p>
                                                <p className="text-xs font-black text-slate-800">{pacote.localizacao}</p>
                                            </div>
                                        </div>

                                        <div className="flex-1 flex items-center justify-center py-2">
                                            <img 
                                                src={preview.dataUrl} 
                                                alt="preview" 
                                                className={labelType === 'barcode' ? "w-full h-auto max-h-[80px] object-contain" : "h-full w-auto object-contain"} 
                                            />
                                        </div>

                                        <div className="mt-auto pt-2 border-t border-slate-100 flex justify-between items-center">
                                            <p className="text-[9px] font-bold text-slate-300 uppercase">Gerado pelo EcomFlow Pro</p>
                                            <div className="flex items-center gap-1 text-emerald-500">
                                                <CheckCircle2 size={10} />
                                                <span className="text-[9px] font-bold uppercase">Pronto para bipar</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-white">
                    <button 
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl bg-slate-100 text-slate-600 font-black uppercase text-sm hover:bg-slate-200 transition-all"
                    >
                        Cancelar
                    </button>
                    <div className="flex gap-3">
                        <button 
                            onClick={handlePrint}
                            disabled={isLoading || isSaving}
                            className="flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white font-black uppercase text-sm tracking-widest rounded-2xl hover:bg-emerald-700 active:scale-95 transition-all shadow-xl shadow-emerald-200 disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Printer size={20} />}
                            Imprimir e Salvar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
