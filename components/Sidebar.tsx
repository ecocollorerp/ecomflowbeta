
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LayoutDashboard, LayoutGrid, ScanLine, Package, BarChart3, DollarSign, Printer, Settings, UserCircle, ArrowLeftToLine, ArrowRightFromLine, Weight, Factory, QrCode, Users, ShoppingCart, LogOut, ClipboardCheck, ListPlus, BookOpen, Recycle, HelpCircle, ChevronDown, ChevronUp, Link as LinkIcon, Globe, PackageOpen, ShieldAlert, Calculator, Truck } from 'lucide-react';
import { User, GeneralSettings } from '../types';
import DynamicIcon from './DynamicIcon';
import { canAccessPage } from '../lib/accessControl';

type NavItemProps = {
  icon: React.ReactNode;
  text: string;
  page: string;
  active?: boolean;
  onClick: (page: string) => void;
  alertCount?: number;
  isCollapsed: boolean;
};

const NavItem = ({ icon, text, page, active = false, onClick, alertCount, isCollapsed }: NavItemProps) => (
  <li className="relative group">
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault();
        onClick(page);
      }}
      className={`flex items-center w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-[var(--color-primary-bg-subtle)] text-[var(--color-primary-text-subtle)]'
          : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]'
      } ${isCollapsed ? 'justify-center px-0' : ''}`}
    >
      <span className="flex-shrink-0">{icon}</span>
      {!isCollapsed && <span className="ml-3 flex-1">{text}</span>}
      {!isCollapsed && typeof alertCount === 'number' && alertCount > 0 && (
        <span className="ml-auto bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
          {alertCount}
        </span>
      )}
      {isCollapsed && typeof alertCount === 'number' && alertCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
          {alertCount}
        </span>
      )}
    </a>
    {isCollapsed && (
      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-[9999] pointer-events-none">
        <div className="bg-gray-900 text-white text-xs font-semibold rounded-lg py-1.5 px-3 whitespace-nowrap shadow-lg">
          {text}
        </div>
      </div>
    )}
  </li>
);

const NavSection: React.FC<{ title: string, isCollapsed: boolean, children: React.ReactNode }> = ({ title, isCollapsed, children }) => {
    const [isOpen, setIsOpen] = useState(true);

    if (isCollapsed) {
        return <ul className="space-y-0.5 py-1 border-t border-[var(--color-border)]/30">{children}</ul>;
    }

    return (
        <div>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold tracking-wider text-[var(--color-text-secondary)] uppercase hover:bg-[var(--color-surface-secondary)] rounded-md"
            >
                {title}
                <ChevronDown size={14} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <ul className="mt-1 space-y-1">{children}</ul>}
        </div>
    );
};

interface SidebarProps {
    currentPage: string;
    setCurrentPage: (page: string) => void;
    lowStockCount: number;
    isCollapsed: boolean;
    toggleCollapse: () => void;
    isMobileOpen: boolean;
    setIsMobileSidebarOpen: (isOpen: boolean) => void;
    currentUser: User | null;
    onLogout: () => void;
    generalSettings: GeneralSettings;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, setCurrentPage, lowStockCount, isCollapsed, toggleCollapse, isMobileOpen, setIsMobileSidebarOpen, currentUser, onLogout, generalSettings }) => {

  // ── Badge "pendentes ZPL" na aba Etiquetas ────────────────────────────────
  const [pendingZplCount, setPendingZplCount] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('erp_pending_zpl_queue');
      return raw ? (JSON.parse(raw) as any[]).length : 0;
    } catch { return 0; }
  });

  useEffect(() => {
    const refresh = () => {
      try {
        const raw = localStorage.getItem('erp_pending_zpl_queue');
        setPendingZplCount(raw ? (JSON.parse(raw) as any[]).length : 0);
      } catch { setPendingZplCount(0); }
    };
    window.addEventListener('pendingZplChanged', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('pendingZplChanged', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const handlePageClick = (page: string) => {
    setCurrentPage(page);
    setIsMobileSidebarOpen(false);
  }
  
  const hasSettingsPermission = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN';
  const canShow = (page: string) => canAccessPage(currentUser, page, generalSettings);

  const navRef = useRef<HTMLElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 0);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll);
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
  }, [checkScroll]);

  const scrollNav = (dir: 'up' | 'down') => {
    navRef.current?.scrollBy({ top: dir === 'down' ? 120 : -120, behavior: 'smooth' });
  };

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <div className={`flex items-center overflow-hidden ${isCollapsed ? 'justify-center w-full' : ''}`}>
            <DynamicIcon name={generalSettings.appIcon} className="h-8 w-8 text-[var(--color-primary)] flex-shrink-0" />
            {!isCollapsed && <span className="ml-2 text-xl font-bold text-[var(--color-text-primary)] whitespace-nowrap">{generalSettings.companyName}</span>}
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {canScrollUp && (
          <button onClick={() => scrollNav('up')} className="sticky top-0 z-10 w-full flex justify-center py-1 bg-gradient-to-b from-[var(--color-surface)] to-transparent hover:from-[var(--color-surface-secondary)] transition-colors">
            <ChevronUp size={16} className="text-[var(--color-text-secondary)]" />
          </button>
        )}
        <nav ref={navRef} className="flex-1 p-2 space-y-2 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <ul className="space-y-1">
          {canShow('dashboard') && <NavItem icon={<LayoutDashboard size={20} />} text="Dashboard" page="dashboard" active={currentPage === 'dashboard'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
        </ul>

        <NavSection title="Produção" isCollapsed={isCollapsed}>
          {canShow('importer') && <NavItem icon={<ScanLine size={20} />} text="Importação" page="importer" active={currentPage === 'importer'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
          {canShow('pacotes') && <NavItem icon={<PackageOpen size={20} />} text="Pacotes Prontos" page="pacotes" active={currentPage === 'pacotes' || currentPage === 'pacotes-prontos'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
          {canShow('bipagem') && <NavItem icon={<QrCode size={20} />} text="Bipagem" page="bipagem" active={currentPage === 'bipagem'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
          {canShow('pedidos') && <NavItem icon={<ShoppingCart size={20} />} text="Pedidos" page="pedidos" active={currentPage === 'pedidos'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
          {canShow('resumo-producao') && <NavItem icon={<Factory size={20} />} text="Resumo de Produção" page="resumo-producao" active={currentPage === 'resumo-producao'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
        </NavSection>

        <NavSection title="Estoque" isCollapsed={isCollapsed}>
          {canShow('estoque') && <NavItem icon={<Package size={20} />} text="Estoque" page="estoque" active={currentPage === 'estoque'} onClick={handlePageClick} alertCount={lowStockCount} isCollapsed={isCollapsed} />}
          {canShow('pesagem') && <NavItem icon={<Weight size={20} />} text="Máquinas" page="pesagem" active={currentPage === 'pesagem'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
          {canShow('moagem') && <NavItem icon={<Recycle size={20} />} text="Moagem" page="moagem" active={currentPage === 'moagem'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
        </NavSection>

        <NavSection title="Planejamento" isCollapsed={isCollapsed}>
          {canShow('planejamento') && <NavItem icon={<ClipboardCheck size={20} />} text="Planejamento" page="planejamento" active={currentPage === 'planejamento'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
          {canShow('compras') && <NavItem icon={<ListPlus size={20} />} text="Compras" page="compras" active={currentPage === 'compras'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
        </NavSection>

        <NavSection title="Análise" isCollapsed={isCollapsed}>
          {canShow('financeiro') && <NavItem icon={<DollarSign size={20} />} text="Financeiro" page="financeiro" active={currentPage === 'financeiro'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
          {canShow('relatorios') && <NavItem icon={<BarChart3 size={20} />} text="Relatórios" page="relatorios" active={currentPage === 'relatorios'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
          {canShow('calculadora') && <NavItem icon={<Calculator size={20} />} text="Calculadora" page="calculadora" active={currentPage === 'calculadora'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
        </NavSection>

        <NavSection title="Ferramentas" isCollapsed={isCollapsed}>
          {canShow('bling') && <NavItem icon={<LinkIcon size={20} />} text="Bling" page="bling" active={currentPage === 'bling'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
          {canShow('etiquetas') && <NavItem icon={<Printer size={20} />} text="Etiquetas" page="etiquetas" active={currentPage === 'etiquetas'} onClick={handlePageClick} isCollapsed={isCollapsed} alertCount={pendingZplCount} />}
          {canShow('gestao-logistica') && <NavItem icon={<Truck size={20} />} text="Gestão e Logística" page="gestao-logistica" active={currentPage === 'gestao-logistica'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
          {canShow('integracoes') && <NavItem icon={<Globe size={20} />} text="Integrações" page="integracoes" active={currentPage === 'integracoes'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
        </NavSection>

        <NavSection title="Administração" isCollapsed={isCollapsed}>
          {canShow('setores') && <NavItem icon={<LayoutGrid size={20} />} text="Setores" page="setores" active={currentPage === 'setores'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
          {canShow('funcionarios') && <NavItem icon={<Users size={20} />} text="Funcionários" page="funcionarios" active={currentPage === 'funcionarios'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
          {hasSettingsPermission && canShow('configuracoes-gerais') && (
                <NavItem icon={<ShieldAlert size={20} />} text="Painel Admin Global" page="configuracoes-gerais" active={currentPage === 'configuracoes-gerais'} onClick={handlePageClick} isCollapsed={isCollapsed} />
            )}
           {hasSettingsPermission && canShow('configuracoes') && (
                <NavItem icon={<Settings size={20} />} text="Setores e Prefixos" page="configuracoes" active={currentPage === 'configuracoes'} onClick={handlePageClick} isCollapsed={isCollapsed} />
            )}
        </NavSection>

         <NavSection title="Suporte" isCollapsed={isCollapsed}>
          {canShow('passo-a-passo') && <NavItem icon={<BookOpen size={20} />} text="Passo a Passo" page="passo-a-passo" active={currentPage === 'passo-a-passo'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
          {canShow('ajuda') && <NavItem icon={<HelpCircle size={20} />} text="Ajuda" page="ajuda" active={currentPage === 'ajuda'} onClick={handlePageClick} isCollapsed={isCollapsed} />}
        </NavSection>
      </nav>
        {canScrollDown && (
          <button onClick={() => scrollNav('down')} className="sticky bottom-0 z-10 w-full flex justify-center py-1 bg-gradient-to-t from-[var(--color-surface)] to-transparent hover:from-[var(--color-surface-secondary)] transition-colors">
            <ChevronDown size={16} className="text-[var(--color-text-secondary)]" />
          </button>
        )}
      </div>
      <div className="p-2 border-t border-[var(--color-border)]">
        <div className={`flex items-center px-2 py-3 rounded-lg ${isCollapsed ? 'justify-center' : ''}`}>
          {currentUser?.avatar_base64 ? (
            <img src={currentUser.avatar_base64} alt="Avatar" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
          ) : (
            <UserCircle size={36} className="text-[var(--color-text-secondary)] flex-shrink-0" />
          )}
          {!isCollapsed && currentUser && (
            <div className="ml-3 overflow-hidden flex-grow">
              <p className="text-sm font-semibold text-[var(--color-text-primary)] whitespace-nowrap">{currentUser.name}</p>
              <p className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">{currentUser.role.replace('_', ' ')}</p>
            </div>
          )}
          {!isCollapsed && (
            <button onClick={onLogout} title="Sair do Sistema" className="ml-2 p-2 text-[var(--color-text-secondary)] hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full flex-shrink-0">
              <LogOut size={18} />
            </button>
          )}
        </div>
        <button onClick={toggleCollapse} className="hidden md:flex w-full items-center justify-center p-2 mt-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)] rounded-lg transition-colors">
            {isCollapsed ? <ArrowRightFromLine size={20} /> : <ArrowLeftToLine size={20} />}
        </button>
      </div>
    </>
  );

  return (
    <>
        <div 
          className={`fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity md:hidden ${isMobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setIsMobileSidebarOpen(false)}
        ></div>
        <div className={`fixed top-0 left-0 h-full bg-[var(--color-surface)] border-r border-[var(--color-border)] z-40 flex flex-col transition-transform duration-300 md:hidden ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} w-64`}>
          {sidebarContent}
        </div>

        <div className={`hidden md:flex flex-col h-screen bg-[var(--color-surface)] fixed transition-all duration-300 border-r border-[var(--color-border)] z-[2147483646] ${isCollapsed ? 'w-20' : 'w-64'}`}>
          {sidebarContent}
        </div>
    </>
  );
};

export default Sidebar;