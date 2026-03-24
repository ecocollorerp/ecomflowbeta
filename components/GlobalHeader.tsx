
import React, { useState } from 'react';
import { Menu, QrCode, X, Loader2, ChevronDown, LayoutDashboard, ScanLine, Package, BarChart3, DollarSign, Printer, Settings, Weight, Recycle, ShoppingCart, ClipboardCheck, ListPlus, BookOpen, HelpCircle, Users, Link as LinkIcon, Globe } from 'lucide-react';
import { StockItem, AdminNotice, User, GeneralSettings } from '../types';
import NotificationPanel from './NotificationPanel';
import { canAccessPage } from '../lib/accessControl';

interface GlobalHeaderProps {
  currentPage: string;
  onMenuClick: () => void;
  lowStockItems: StockItem[];
  setCurrentPage: (page: string) => void;
  bannerNotice?: AdminNotice;
  isAutoBipagemActive: boolean;
  onToggleAutoBipagem: (isActive: boolean) => void;
  onDismissNotice: (id: string) => void;
  currentUser: User | null;
  isProcessingLabels?: boolean;
  labelProgressMessage?: string;
  labelProcessingProgress?: number;
  generalSettings?: GeneralSettings;
  navMode?: 'sidebar' | 'topnav';
}

const getPageTitle = (page: string): string => {
    const titles: { [key: string]: string } = {
        'dashboard': 'Dashboard',
        'importer': 'Importação de Pedidos',
        'bipagem': 'Bipagem Automática',
        'pedidos': 'Gerenciamento de Pedidos',
        'pesagem': 'Controle de Pesagem',
        'estoque': 'Gerenciamento de Estoque',
        'funcionarios': 'Controle de Funcionários',
        'relatorios': 'Relatórios e Análises',
        'etiquetas': 'Gerador de Etiquetas ZPL',
        'passo-a-passo': 'Passo a Passo',
        'ajuda': 'Central de Ajuda',
        'configuracoes': 'Configurações de Usuários',
        'configuracoes-gerais': 'Configurações Gerais'
    };
    return titles[page] || 'ERP Fábrica Pro';
};

const NoticeBanner: React.FC<{ notice: AdminNotice; onDismiss: (id: string) => void; canDismiss: boolean }> = ({ notice, onDismiss, canDismiss }) => {
    const levelClasses = {
        green: 'bg-green-600 text-white',
        yellow: 'bg-yellow-500 text-black',
        red: 'bg-red-600 text-white',
    };
    return (
        <div className={`relative w-full p-1 text-sm font-semibold overflow-hidden whitespace-nowrap ${levelClasses[notice.level]}`}>
            <div className={`inline-block animate-marquee ${canDismiss ? 'pr-10' : ''}`}>
                {notice.text} - (Aviso de {notice.createdBy})
            </div>
            {canDismiss && (
                <button
                    onClick={() => onDismiss(notice.id)}
                    className="absolute top-1/2 right-2 transform -translate-y-1/2 p-1 rounded-full hover:bg-black/20"
                    aria-label="Dispensar aviso"
                >
                    <X size={16} />
                </button>
            )}
        </div>
    );
};


const GlobalHeader: React.FC<GlobalHeaderProps> = ({ currentPage, onMenuClick, lowStockItems, setCurrentPage, bannerNotice, isAutoBipagemActive, onToggleAutoBipagem, currentUser, onDismissNotice, isProcessingLabels, labelProgressMessage, labelProcessingProgress, generalSettings, navMode }) => {
  
  const headerContainerClasses = `flex-shrink-0 bg-[var(--color-surface)]`;

  const headerClasses = `flex items-center justify-between p-4 border-b border-[var(--color-border)] text-[var(--color-text-primary)]`;
  
  const canDismissBanner = !!currentUser && (currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'ADMIN');

  const canShow = (page: string) => generalSettings ? canAccessPage(currentUser, page, generalSettings) : true;

  const menuSections = [
    {
      label: 'Produção',
      items: [
        { page: 'importer', label: 'Importação', icon: <ScanLine size={14} /> },
        { page: 'bipagem', label: 'Bipagem', icon: <QrCode size={14} /> },
        { page: 'pedidos', label: 'Pedidos', icon: <ShoppingCart size={14} /> },
      ]
    },
    {
      label: 'Estoque',
      items: [
        { page: 'estoque', label: 'Estoque', icon: <Package size={14} /> },
        { page: 'pesagem', label: 'Máquinas', icon: <Weight size={14} /> },
        { page: 'moagem', label: 'Moagem', icon: <Recycle size={14} /> },
      ]
    },
    {
      label: 'Planejamento',
      items: [
        { page: 'planejamento', label: 'Planejamento', icon: <ClipboardCheck size={14} /> },
        { page: 'compras', label: 'Compras', icon: <ListPlus size={14} /> },
      ]
    },
    {
      label: 'Análise',
      items: [
        { page: 'financeiro', label: 'Financeiro', icon: <DollarSign size={14} /> },
        { page: 'relatorios', label: 'Relatórios', icon: <BarChart3 size={14} /> },
      ]
    },
    {
      label: 'Ferramentas',
      items: [
        { page: 'etiquetas', label: 'Etiquetas', icon: <Printer size={14} /> },
        { page: 'bling', label: 'Bling', icon: <LinkIcon size={14} /> },
        { page: 'integracoes', label: 'Integrações', icon: <Globe size={14} /> },
      ]
    },
    {
      label: 'Admin',
      items: [
        { page: 'funcionarios', label: 'Funcionários', icon: <Users size={14} /> },
        { page: 'configuracoes', label: 'Configurações', icon: <Settings size={14} /> },
      ]
    },
  ];

  return (
    <header className={headerContainerClasses}>
      {isProcessingLabels && (
        <div className="bg-purple-600 text-white p-2 text-sm font-semibold flex items-center justify-between animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
                <Loader2 size={16} className="animate-spin" />
                <span>{labelProgressMessage || 'Processando etiquetas em segundo plano...'}</span>
            </div>
             {labelProcessingProgress !== undefined && (
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono">{labelProcessingProgress}%</span>
                    <div className="w-32 h-2 bg-purple-800 rounded-full overflow-hidden">
                        <div className="h-full bg-white transition-all duration-300" style={{ width: `${labelProcessingProgress}%` }}></div>
                    </div>
                </div>
            )}
        </div>
      )}
      {bannerNotice && <NoticeBanner notice={bannerNotice} onDismiss={onDismissNotice} canDismiss={canDismissBanner} />}
      <div className={headerClasses}>
        <div className="flex items-center gap-4">
          <button onClick={onMenuClick} className="p-2 -ml-2 md:hidden">
              <Menu size={24} />
          </button>
          <h1 className="text-lg md:text-xl font-bold">{getPageTitle(currentPage)}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button
              onClick={() => onToggleAutoBipagem(!isAutoBipagemActive)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                  isAutoBipagemActive 
                  ? 'bg-blue-600 text-white border-blue-700 shadow-md animate-pulse' 
                  : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
              }`}
              title={isAutoBipagemActive ? "Desativar Auto Bipagem" : "Ativar Auto Bipagem"}
          >
              <QrCode size={16} />
              <span className="hidden sm:inline">Auto Bipagem</span>
          </button>
          <NotificationPanel lowStockItems={lowStockItems} onNavigate={setCurrentPage} />
        </div>
      </div>

      {/* Top Navigation Menu with hover dropdowns — só mostra no modo topnav */}
      {navMode !== 'sidebar' && <nav className="hidden md:flex items-center gap-1 px-4 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto relative z-[100]">
        <button
          onClick={() => setCurrentPage('dashboard')}
          className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${currentPage === 'dashboard' ? 'bg-blue-100 text-blue-700' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]'}`}
        >
          <LayoutDashboard size={14} /> Dashboard
        </button>
        {menuSections.map(section => {
          const visibleItems = section.items.filter(item => canShow(item.page));
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label} className="relative group">
              <button className={`px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 ${visibleItems.some(i => currentPage === i.page) ? 'bg-blue-100 text-blue-700' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]'}`}>
                {section.label} <ChevronDown size={10} className="opacity-50" />
              </button>
              <div className="absolute top-full left-0 mt-0.5 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 min-w-[180px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[9999]">
                {visibleItems.map(item => (
                  <button
                    key={item.page}
                    onClick={() => setCurrentPage(item.page)}
                    className={`w-full text-left px-4 py-2 text-xs font-bold flex items-center gap-2 transition-all ${currentPage === item.page ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'}`}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </nav>}
    </header>
  );
};

export default GlobalHeader;
