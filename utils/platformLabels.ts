/**
 * Mapeamento de canais/plataformas para labels amigáveis
 */

export type Canal = 'ML' | 'SHOPEE' | 'SITE' | 'ALL' | 'AUTO';

export interface PlatformLabel {
  displayName: string;
  shortName: string;
  color: string;
  bgColor: string;
  icon: string;
}

const PLATFORM_LABELS: Record<Canal | string, PlatformLabel> = {
  ML: {
    displayName: 'Ecocollor Mercado Livre',
    shortName: 'Mercado Livre',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    icon: '🏪'
  },
  MERCADO_LIVRE: {
    displayName: 'Ecocollor Mercado Livre',
    shortName: 'Mercado Livre',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    icon: '🏪'
  },
  SHOPEE: {
    displayName: 'Shopee Ecocollor',
    shortName: 'Shopee',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    icon: '🛍️'
  },
  SITE: {
    displayName: 'Loja Virtual Nuvem',
    shortName: 'Loja Virtual',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    icon: '☁️'
  },
  ALL: {
    displayName: 'Todos os Canais',
    shortName: 'Todos',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    icon: '📊'
  },
  AUTO: {
    displayName: 'Detectar Automaticamente',
    shortName: 'Auto',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    icon: '🔄'
  }
};

/**
 * Obtém o label completo de uma plataforma
 * @param canal - Canal/Plataforma
 * @returns PlatformLabel com displayName, shortName, cores e ícone
 */
export const getPlatformLabel = (canal: Canal | string): PlatformLabel => {
  return PLATFORM_LABELS[canal] || PLATFORM_LABELS['ALL'];
};

/**
 * Obtém apenas o nome de exibição da plataforma
 * @param canal - Canal/Plataforma
 * @returns Nome amigável da plataforma
 */
export const getPlatformDisplayName = (canal: Canal | string): string => {
  return getPlatformLabel(canal).displayName;
};

/**
 * Obtém apenas o nome curto da plataforma
 * @param canal - Canal/Plataforma
 * @returns Nome curto da plataforma
 */
export const getPlatformShortName = (canal: Canal | string): string => {
  return getPlatformLabel(canal).shortName;
};

/**
 * Mapeamento para opções de select
 */
export const PLATFORM_SELECT_OPTIONS = [
  { value: 'ALL', label: 'Todos os Canais' },
  { value: 'ML', label: 'Ecocollor Mercado Livre' },
  { value: 'SHOPEE', label: 'Shopee Ecocollor' },
  { value: 'SITE', label: 'Loja Virtual Nuvem' }
];

/**
 * Normaliza um canal para o formato padrão
 */
export const normalizeCanal = (canal: string): Canal => {
  const normalized = canal.toUpperCase();
  if (normalized === 'MERCADO_LIVRE' || normalized === 'MERCADO') return 'ML';
  if (normalized === 'SHOPEE') return 'SHOPEE';
  if (normalized === 'SITE' || normalized === 'SITE_OWN') return 'SITE';
  return 'ALL';
};
