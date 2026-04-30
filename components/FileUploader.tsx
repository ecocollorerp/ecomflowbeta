
import React, { useState, useCallback } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';

interface FileUploaderProps {
    onFilesSelect: (files: File[]) => void;
    files: File[];
    accept?: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFilesSelect, files, accept = '.xlsx, .xls, .csv' }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDrag = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setIsDragging(true);
        } else if (e.type === "dragleave") {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFilesSelect(Array.from(e.dataTransfer.files));
        }
    }, [onFilesSelect]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFilesSelect(Array.from(e.target.files));
        }
    };

    return (
        <div className="bg-[var(--color-surface)] p-6 rounded-xl border border-[var(--color-border)] shadow-sm w-full">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">Importar Pedidos</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">Arraste ou selecione um ou mais arquivos Excel/CSV.</p>
            
            <label 
                htmlFor="file-upload"
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                ${isDragging ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-[var(--color-border)] bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-tertiary)]'}`}
            >
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                    {files && files.length > 0 ? (
                        <>
                            <FileText className="w-10 h-10 mb-3 text-green-500" />
                            <p className="mb-2 text-sm text-[var(--color-text-primary)] font-semibold">{files.length} arquivo(s) selecionado(s)</p>
                            <p className="text-xs text-[var(--color-text-secondary)]">{files.map(f => f.name).join(', ')}</p>
                        </>
                    ) : (
                        <>
                            <UploadCloud className="w-10 h-10 mb-3 text-[var(--color-text-secondary)]" />
                            <p className="mb-2 text-sm text-[var(--color-text-secondary)]">
                                <span className="font-semibold text-[var(--color-primary)]">Clique para enviar</span> ou arraste e solte
                            </p>
                            <p className="text-xs text-[var(--color-text-secondary)]">{accept}</p>
                        </>
                    )}
                </div>
                <input id="file-upload" type="file" className="hidden" onChange={handleChange} accept={accept} multiple />
            </label>

            {files && files.length > 0 && (
                <div className="mt-3 grid gap-2">
                    {files.map((f, idx) => (
                        <div key={`${f.name}-${idx}`} className="flex items-center justify-between bg-white border border-slate-100 p-2 rounded-lg">
                            <div className="truncate text-sm font-medium">{f.name}</div>
                            <div className="text-xs text-slate-500">{(f.size / 1024).toFixed(1)} KB</div>
                        </div>
                    ))}
                    <div className="text-[10px] text-slate-400 italic">Você pode enviar múltiplos arquivos e escolher mesclar ou processar separadamente.</div>
                </div>
            )}
        </div>
    );
};

export default FileUploader;