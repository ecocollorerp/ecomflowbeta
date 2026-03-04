import { User, UserRole, UserSetor } from '../types';

export type AppPage =
  | 'dashboard'
  | 'importer'
  | 'bipagem'
  | 'pedidos'
  | 'planejamento'
  | 'compras'
  | 'pesagem'
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

type AccessRule = {
  roles?: UserRole[];
  setores?: UserSetor[];
};

export const PAGE_ACCESS_RULES: Record<AppPage, AccessRule> = {
  dashboard: { setores: ['ADMINISTRATIVO', 'EMBALAGEM', 'PESAGEM', 'MOAGEM'] },
  importer: { setores: ['ADMINISTRATIVO', 'EMBALAGEM'] },
  bipagem: { setores: ['ADMINISTRATIVO', 'EMBALAGEM'] },
  pedidos: { setores: ['ADMINISTRATIVO', 'EMBALAGEM'] },
  planejamento: { setores: ['ADMINISTRATIVO'] },
  compras: { setores: ['ADMINISTRATIVO'] },
  pesagem: { setores: ['ADMINISTRATIVO', 'PESAGEM'] },
  moagem: { setores: ['ADMINISTRATIVO', 'MOAGEM'] },
  estoque: { setores: ['ADMINISTRATIVO', 'EMBALAGEM', 'PESAGEM', 'MOAGEM'] },
  funcionarios: { roles: ['SUPER_ADMIN', 'ADMIN'], setores: ['ADMINISTRATIVO'] },
  relatorios: { setores: ['ADMINISTRATIVO', 'EMBALAGEM', 'PESAGEM', 'MOAGEM'] },
  financeiro: { setores: ['ADMINISTRATIVO'] },
  etiquetas: { setores: ['ADMINISTRATIVO', 'EMBALAGEM'] },
  bling: { setores: ['ADMINISTRATIVO'] },
  integracoes: { setores: ['ADMINISTRATIVO'] },
  'passo-a-passo': { setores: ['ADMINISTRATIVO', 'EMBALAGEM', 'PESAGEM', 'MOAGEM'] },
  ajuda: { setores: ['ADMINISTRATIVO', 'EMBALAGEM', 'PESAGEM', 'MOAGEM'] },
  powerbi: { setores: ['ADMINISTRATIVO'] },
  'powerbi-templates': { setores: ['ADMINISTRATIVO'] },
  configuracoes: { roles: ['SUPER_ADMIN', 'ADMIN'], setores: ['ADMINISTRATIVO'] },
  'configuracoes-gerais': { roles: ['SUPER_ADMIN', 'ADMIN'], setores: ['ADMINISTRATIVO'] }
};

const DEFAULT_PAGE: AppPage = 'dashboard';

export function canAccessPage(user: User | null, page: string): boolean {
  if (!user) return false;
  if (user.role === 'SUPER_ADMIN') return true;

  const rule = PAGE_ACCESS_RULES[page as AppPage];
  if (!rule) return true;

  const roleAllowed = !rule.roles || rule.roles.includes(user.role);
  const setorAllowed =
    !rule.setores ||
    (Array.isArray(user.setor) && user.setor.some((setor) => rule.setores!.includes(setor)));

  return roleAllowed && setorAllowed;
}

export function getFirstAccessiblePage(user: User | null, preferredPage: string = DEFAULT_PAGE): AppPage {
  if (!user) return DEFAULT_PAGE;
  if (canAccessPage(user, preferredPage)) return preferredPage as AppPage;

  const orderedPages = Object.keys(PAGE_ACCESS_RULES) as AppPage[];
  const page = orderedPages.find((candidate) => canAccessPage(user, candidate));
  return page || DEFAULT_PAGE;
}
