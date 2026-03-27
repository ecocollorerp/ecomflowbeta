// components/ToastContainer.tsx
import React from 'react';
import { ToastMessage } from '../types';
import Toast from './Toast';

interface ToastContainerProps {
    toasts: ToastMessage[];
    removeToast: (id: number) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
    return (
        <div
            aria-live="assertive"
            className="fixed inset-0 flex flex-col items-end justify-end p-6 pointer-events-none z-[200] space-y-4"
        >
            {toasts.map((toast) => (
                <Toast key={toast.id} toast={toast} removeToast={removeToast} />
            ))}
        </div>
    );
};

export default ToastContainer;