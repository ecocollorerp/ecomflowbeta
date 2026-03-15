import { User, UserRole, UserSetor, GeneralSettings } from '../types';

export type AppPage =
  | 'dashboard'
  | 'importer'
  | 'bipagem'
  | 'pedidos'
  | 'planejamento'
  | 'compras'
  | 'ensacamento'
  | 'moagem'
  | 'estoque'
  | 'funcionarios'
  | 'relatorios'
  | 'financeiro'
  | 'etiquetas'
  | 'bling'
  | 'integracoes'
  | 'passo-a-passo'
  | 'ajuda'
  | 'powerbi'
  | 'powerbi-templates'
  | 'configuracoes'
  | 'configuracoes-gerais';

export const ALL_APP_PAGES: { id: AppPage, label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'importer', label: 'Importação' },
    { id: 'bipagem', label: 'Bipagem' },
    { id: 'pedidos', label: 'Pedidos' },
    { id: 'planejamento', label: 'Planejamento' },
    { id: 'compras', label: 'Compras' },
    { id: 'ensacamento', label: 'Máquinas' },
    { id: 'moagem', label: 'Moagem' },
    { id: 'estoque', label: 'Estoque' },
    { id: 'funcionarios', label: 'Funcionários' },
    { id: 'relatorios', label: 'Relatórios' },
    { id: 'financeiro', label: 'Financeiro' },
    { id: 'etiquetas', label: 'Etiquetas' },
    { id: 'bling', label: 'Bling' },
    { id: 'integracoes', label: 'Integrações' },
    { id: 'passo-a-passo', label: 'Passo a Passo' },
    { id: 'ajuda', label: 'Ajuda' },
    { id: 'configuracoes', label: 'Configurações' },
];

type AccessRule = {
  roles?: UserRole[];
  setores?: string[];
};

export const PAGE_ACCESS_RULES: Record<AppPage, AccessRule> = {
  dashboard: {},
  importer: {},
  bipagem: {},
  pedidos: {},
  planejamento: {},
  compras: {},
  ensacamento: {},
  moagem: {},
  estoque: {},
  funcionarios: { roles: ['SUPER_ADMIN', 'ADMIN'] },
  relatorios: {},
  financeiro: {},
  etiquetas: {},
  bling: {},
  integracoes: {},
  'passo-a-passo': {},
  ajuda: {},
  powerbi: {},
  'powerbi-templates': {},
  configuracoes: { roles: ['SUPER_ADMIN', 'ADMIN'] },
  'configuracoes-gerais': { roles: ['SUPER_ADMIN', 'ADMIN'] }
};

const DEFAULT_PAGE: AppPage = 'dashboard';

export function canAccessPage(user: User | null, page: string, generalSettings?: GeneralSettings): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;

  // 1. Verificar regras de Perfil (Role)
  const rule = PAGE_ACCESS_RULES[page as AppPage];
  if (rule?.roles && !rule.roles.includes(user.role)) {
    return false; // Perfil não tem permissão mínima (ex: Funcionários precisa de ADMIN)
  }

  // Se for ADMIN, geralmente tem acesso a quase tudo, exceto se houver restrição específica de setor futura
  // mas aqui seguimos a lógica: SUPER_ADMIN > ADMIN > Outros (via setor)
  if (user.role === 'ADMIN') return true;

  // 2. Verificar setores customizados (dinâmico)
  if (generalSettings?.customSectors && Array.isArray(user.setor)) {
    const sectorsWithAccess = generalSettings.customSectors.filter(s => 
      user.setor.includes(s.id) || user.setor.includes(s.name)
    );
    
    for (const sector of sectorsWithAccess) {
      if (sector.allowedPages.includes(page)) return true;
    }
  }

  return false;
}

export function getFirstAccessiblePage(user: User | null, preferredPage: string = DEFAULT_PAGE, generalSettings?: GeneralSettings): AppPage {
  if (!user) return DEFAULT_PAGE;
  if (canAccessPage(user, preferredPage, generalSettings)) return preferredPage as AppPage;

  const orderedPages = Object.keys(PAGE_ACCESS_RULES) as AppPage[];
  const page = orderedPages.find((candidate) => canAccessPage(user, candidate, generalSettings));
  return page || DEFAULT_PAGE;
}
