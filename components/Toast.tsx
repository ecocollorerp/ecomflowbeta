// components/Toast.tsx
import React, { useEffect, useState } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { ToastMessage } from '../types';

interface ToastProps {
    toast: ToastMessage;
    removeToast: (id: number) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, removeToast }) => {
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setExiting(true);
            setTimeout(() => removeToast(toast.id), 300); // Allow time for exit animation
        }, 10000); // 10 seconds

        return () => clearTimeout(timer);
    }, [toast.id, removeToast]);

    const handleClose = () => {
        setExiting(true);
        setTimeout(() => removeToast(toast.id), 300);
    };

    const typeInfo = {
        success: {
            icon: <CheckCircle className="h-6 w-6 text-emerald-500" />,
            bg: 'bg-white/80 dark:bg-slate-900/80',
            border: 'border-emerald-100 dark:border-emerald-900/50',
            progress: 'bg-emerald-500',
            shadow: 'shadow-emerald-200/50',
            accent: 'text-emerald-700 dark:text-emerald-400'
        },
        error: {
            icon: <AlertTriangle className="h-6 w-6 text-rose-500" />,
            bg: 'bg-white/80 dark:bg-slate-900/80',
            border: 'border-rose-100 dark:border-rose-900/50',
            progress: 'bg-rose-500',
            shadow: 'shadow-rose-200/50',
            accent: 'text-rose-700 dark:text-rose-400'
        },
        info: {
            icon: <Info className="h-6 w-6 text-blue-500" />,
            bg: 'bg-white/80 dark:bg-slate-900/80',
            border: 'border-blue-100 dark:border-blue-900/50',
            progress: 'bg-blue-500',
            shadow: 'shadow-blue-200/50',
            accent: 'text-blue-700 dark:text-blue-400'
        },
        warning: {
            icon: <AlertCircle className="h-6 w-6 text-amber-500" />,
            bg: 'bg-white/80 dark:bg-slate-900/80',
            border: 'border-amber-100 dark:border-amber-900/50',
            progress: 'bg-amber-500',
            shadow: 'shadow-amber-200/50',
            accent: 'text-amber-700 dark:text-amber-400'
        },
    };

    const { icon, bg, border, progress, shadow, accent } = typeInfo[toast.type] || typeInfo.info;

    return (
        <div
            className={`w-full max-w-sm rounded-[2rem] border-2 backdrop-blur-xl ${bg} ${border} ${shadow} pointer-events-auto overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] transform shadow-2xl ${
                exiting ? 'opacity-0 translate-x-12 scale-90' : 'opacity-100 translate-x-0 scale-100 animate-in fade-in slide-in-from-right-10'
            }`}
        >
            <div className="p-6">
                <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                        {icon}
                    </div>
                    <div className="flex-1">
                        <p className={`text-xs font-black uppercase tracking-widest ${accent}`}>{toast.type}</p>
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-0.5 leading-tight">{toast.message}</p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
            
            {/* Progress Bar Animation */}
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800/50 overflow-hidden">
                <div 
                    className={`h-full ${progress} transition-all duration-[10000ms] ease-linear`}
                    style={{ 
                        width: exiting ? '0%' : '100%',
                        animation: !exiting ? 'toast-progress 10s linear forwards' : 'none'
                    }}
                />
            </div>
            
            <style>{`
                @keyframes toast-progress {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
        </div>
    );
};

export default Toast;