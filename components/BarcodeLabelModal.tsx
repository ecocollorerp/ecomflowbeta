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

interface BarcodeLabelModalProps {
    isOpen: boolean;
    onClose: () => void;
    pacote: PacoteProto;
    targetTable?: 'estoque_pronto' | 'stock_items';
    addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type LabelType = 'barcode' | 'qrcode';
type LabelScope = 'batch' | 'products';

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({ 
    isOpen, 
    onClose, 
    pacote,
    targetTable = 'estoque_pronto',
    addToast
}) => {
    const [labelType, setLabelType] = useState<LabelType>('barcode');
    const [labelScope, setLabelScope] = useState<LabelScope>('batch');
    const [previews, setPreviews] = useState<{ id: string, name: string, dataUrl: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const generatePreviews = useCallback(async () => {
        setIsLoading(true);
        try {
            const newPreviews: { id: string, name: string, dataUrl: string }[] = [];
            
            if (labelScope === 'batch') {
                const code = pacote.sku_primario; // Ou gerar um ID único se preferir
                const dataUrl = labelType === 'barcode' 
                    ? await generateBarcodeBase64(code) 
                    : await generateQRCodeBase64(code);
                
                newPreviews.push({ id: code, name: `Lote: ${pacote.nome}`, dataUrl });
            } else {
                for (const prod of pacote.produtos) {
                    const dataUrl = labelType === 'barcode' 
                        ? await generateBarcodeBase64(prod.sku) 
                        : await generateQRCodeBase64(prod.sku);
                    
                    newPreviews.push({ id: prod.sku, name: prod.nome, dataUrl });
                }
            }
            
            setPreviews(newPreviews);
        } catch (error) {
            console.error('Erro ao gerar previews:', error);
            addToast('Erro ao gerar visualização das etiquetas', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [labelType, labelScope, pacote, addToast]);

    useEffect(() => {
        if (isOpen) {
            generatePreviews();
        }
    }, [isOpen, generatePreviews]);

    const handlePrint = async () => {
        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [100, 50] // Exemplo de tamanho de etiqueta térmica 100x50mm
            });

            previews.forEach((preview, index) => {
                if (index > 0) doc.addPage([100, 50], 'portrait');
                
                // Desenhar borda (opcional)
                doc.setDrawColor(200);
                doc.rect(2, 2, 96, 46);

                // Título
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(preview.name.substring(0, 40), 5, 8);
                
                // Código
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text(`ID: ${preview.id}`, 5, 13);

                // Imagem do código
                if (labelType === 'barcode') {
                    doc.addImage(preview.dataUrl, 'PNG', 5, 15, 90, 25);
                } else {
                    doc.addImage(preview.dataUrl, 'PNG', 35, 15, 30, 30);
                }

                // Info adicional
                doc.setFontSize(7);
                doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 5, 45);
                doc.text(`Loc: ${pacote.localizacao}`, 80, 45, { align: 'right' });
            });

            doc.save(`etiquetas_${pacote.sku_primario}.pdf`);
            addToast('PDF gerado com sucesso!', 'success');
            
            // Se for etiqueta de lote, salvar o código no banco
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
