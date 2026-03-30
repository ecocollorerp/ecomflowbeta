
import React, { useState } from 'react';
import { X, Copy, CheckCircle2, FileText, Zap, AlertTriangle } from 'lucide-react';
import { calculate50PercentFill, mergeZplBlocks, isValidZpl } from '../utils/zpl_merge_utils';

interface ZplMergerModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedZpls: string[];
    onConfirm: (mergedZpl: string) => void;
    addToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function ZplMergerModal({ isOpen, onClose, selectedZpls, onConfirm, addToast }: ZplMergerModalProps) {
    const [mode, setMode] = useState<'simple' | 'fifty'>('simple');
    const [mergedContent, setMergedContent] = useState('');

    if (!isOpen) return null;

    const handleProcess = () => {
        if (selectedZpls.length === 0) return;

        let result = '';
        if (mode === 'simple') {
            result = mergeZplBlocks(selectedZpls);
        } else {
            // Lógica de 50%: agrupamos de 2 em 2
            const pairs: string[] = [];
            for (let i = 0; i < selectedZpls.length; i += 2) {
                if (i + 1 < selectedZpls.length) {
                    pairs.push(calculate50PercentFill(selectedZpls[i], selectedZpls[i + 1]));
                } else {
                    pairs.push(selectedZpls[i]); // Último sozinho se ímpar
                }
            }
            result = mergeZplBlocks(pairs);
        }
        setMergedContent(result);
        if (addToast) addToast("ZPL Mesclado com Sucesso!", "success");
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(mergedContent);
        if (addToast) addToast("Conteúdo copiado!", "success");
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <Zap className="text-amber-500" size={24} /> Mesclador de Etiquetas ZPL
                        </h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {selectedZpls.length} etiquetas selecionadas para processamento
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <button 
                            onClick={() => setMode('simple')}
                            className={`p-6 rounded-2xl border-2 transition-all text-left group ${mode === 'simple' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-100 hover:border-gray-200'}`}
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`p-2 rounded-lg ${mode === 'simple' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                    <FileText size={20} />
                                </div>
                                <span className={`font-black text-sm uppercase tracking-wider ${mode === 'simple' ? 'text-blue-700' : 'text-slate-400'}`}>Mesclagem Simples</span>
                            </div>
                            <p className="text-xs font-medium text-slate-500 leading-relaxed">
                                Apenas empilha os comandos ZPL um após o outro. Ideal para impressoras com rolo contínuo ou drivers padrão.
                            </p>
                        </button>

                        <button 
                            onClick={() => setMode('fifty')}
                            className={`p-6 rounded-2xl border-2 transition-all text-left group ${mode === 'fifty' ? 'border-indigo-500 bg-indigo-50/50' : 'border-gray-100 hover:border-gray-200'}`}
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`p-2 rounded-lg ${mode === 'fifty' ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                    <Zap size={20} />
                                </div>
                                <span className={`font-black text-sm uppercase tracking-wider ${mode === 'fifty' ? 'text-indigo-700' : 'text-slate-400'}`}>Otimização 50% Fill</span>
                            </div>
                            <p className="text-xs font-medium text-slate-500 leading-relaxed">
                                Combina duas etiquetas em uma única página física, removendo rodapés repetitivos. Economiza 50% de fita/papel.
                            </p>
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Resultado do Merge</h3>
                            {mergedContent && (
                                <button onClick={copyToClipboard} className="text-[10px] font-black text-blue-600 flex items-center gap-1 hover:underline">
                                    <Copy size={12} /> COPIAR TUDO
                                </button>
                            )}
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-6 font-mono text-[10px] text-emerald-400 overflow-x-auto min-h-[200px] border-4 border-slate-800 shadow-inner">
                            {mergedContent ? (
                                <pre className="whitespace-pre-wrap">{mergedContent}</pre>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 mt-10">
                                    <div className="w-12 h-12 rounded-full border-2 border-slate-800 flex items-center justify-center animate-pulse">
                                        <Zap size={24} />
                                    </div>
                                    <span className="font-bold uppercase tracking-tighter">Aguardando Processamento</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedZpls.length % 2 !== 0 && mode === 'fifty' && (
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-3">
                            <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                            <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                                <span className="uppercase">Atenção:</span> Você selecionou um número ímpar de etiquetas. 
                                A última etiqueta será mantida em seu formato original sem par.
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-50 border-t border-gray-100 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 bg-white border border-gray-200 text-slate-600 rounded-xl font-black text-[11px] uppercase hover:bg-gray-50 transition-all"
                    >
                        Cancelar
                    </button>
                    {!mergedContent ? (
                        <button 
                            onClick={handleProcess}
                            className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-black text-[11px] uppercase hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                        >
                            Processar Merge
                        </button>
                    ) : (
                        <button 
                            onClick={() => onConfirm(mergedContent)}
                            className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[11px] uppercase hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
                        >
                            <CheckCircle2 size={16} /> Finalizar e Abrir Imprimir
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
