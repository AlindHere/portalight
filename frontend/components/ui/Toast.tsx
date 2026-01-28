'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

interface ToastMessage {
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
}

interface ToastContextType {
    showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return '✓';
            case 'error': return '✗';
            case 'warning': return '⚠';
            case 'info': return 'ℹ';
            default: return '•';
        }
    };

    const getColors = (type: string) => {
        switch (type) {
            case 'success': return { bg: '#10b981', text: 'white' };
            case 'error': return { bg: '#ef4444', text: 'white' };
            case 'warning': return { bg: '#f59e0b', text: 'white' };
            case 'info': return { bg: '#3b82f6', text: 'white' };
            default: return { bg: '#6b7280', text: 'white' };
        }
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Toast Container */}
            <div style={{
                position: 'fixed',
                bottom: '1.5rem',
                right: '1.5rem',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
            }}>
                {toasts.map(toast => {
                    const colors = getColors(toast.type);
                    return (
                        <div
                            key={toast.id}
                            style={{
                                padding: '0.75rem 1.25rem',
                                borderRadius: '0.5rem',
                                background: colors.bg,
                                color: colors.text,
                                fontWeight: 500,
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                animation: 'slideIn 0.3s ease',
                                maxWidth: '400px',
                            }}
                        >
                            <span style={{ fontSize: '1rem' }}>{getIcon(toast.type)}</span>
                            <span style={{ fontSize: '0.875rem' }}>{toast.message}</span>
                        </div>
                    );
                })}
            </div>
            <style jsx global>{`
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </ToastContext.Provider>
    );
}
