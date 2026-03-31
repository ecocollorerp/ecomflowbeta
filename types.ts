import React from "react";

// Basic Types
export type Period =
  | "today"
  | "yesterday"
  | "last7days"
  | "thisMonth"
  | "lastMonth"
  | "custom"
  | "last_upload";
export type Canal = "ML" | "SHOPEE" | "SITE" | "TIKTOK" | "ALL" | "AUTO" | string;
export type UserRole = "SUPER_ADMIN" | "ADMIN" | "OPERATOR";
export type UserSetor = string;

// UI & Settings
export interface UiSettings {
  baseTheme: "light" | "dark" | "system";
  accentColor: "indigo" | "emerald" | "fuchsia" | "orange" | "slate" | "custom";
  customAccentColor?: string;
  fontSize: number;
  soundOnSuccess: boolean;
  soundOnDuplicate: boolean;
  soundOnError: boolean;
}

export interface BipagemSettings {
  soundOnSuccess: boolean;
  soundOnDuplicate: boolean;
  soundOnError: boolean;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

export interface AdminNotice {
  id: string;
  text: string;
  level: "green" | "yellow" | "red";
  type: "post-it" | "banner";
  createdBy: string;
  createdAt: string;
}

export interface AttendanceRecord {
  date: string;
  status: "PRESENT" | "ABSENT";
  hasDoctorsNote?: boolean;
  doctorsNoteFile?: any;
  leftEarly?: string | null;
  overtime?: string | null;
}

export interface Setor {
  id: string;
  name: string;
  created_at?: string;
}

export interface UserPermissions {
  estoque?: boolean;
  pacotes?: boolean;
  calculadora?: boolean;
  bling?: boolean;
  financeiro?: boolean;
  relatorios?: boolean;
  funcionarios?: boolean;
  configuracoes?: boolean;
  etiquetas?: boolean;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  setor: UserSetor[];
  password?: string;
  prefix?: string;
  attendance: AttendanceRecord[];
  ui_settings?: UiSettings;
  permissions?: UserPermissions;
  avatar_base64?: string;
}

// Dashboard & Stats
export interface DashboardFilters {
  period: Period;
  canal: Canal;
  startDate?: string;
  endDate?: string;
  compare: boolean;
  compareStartDate?: string;
  compareEndDate?: string;
  shippingDateStart?: string;
  shippingDateEnd?: string;
}

export interface StatCardData {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
  changeLabel?: string;
}

export interface ActionCardData {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBgColor: string;
  page: string;
}

export enum ActivityType {
  OrderScanned = "OrderScanned",
  StockUpdated = "StockUpdated",
  StockAlert = "StockAlert"
}

export interface ActivityItemData {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  time: string;
}

export enum AlertLevel {
  Info = "info",
  Warning = "warning",
  Danger = "danger"
}

export interface AlertItemData {
  id: string;
  level: AlertLevel;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export interface DashboardWidgetConfig {
  showProductionSummary: boolean;
  showMaterialDeductions: boolean;
  showStatCards: boolean;
  showActionCards: boolean;
  showPackGroups: boolean;
  showRecentActivity: boolean;
  showSystemAlerts: boolean;
}

export interface ProductionStats {
  totalPedidos: number;
  totalPacotes: number;
  totalUnidades: number;
  totalUnidadesBranca: number;
  totalUnidadesPreta: number;
  totalUnidadesEspecial: number;
  totalMiudos: number;
  miudos: { [category: string]: number };
}

export interface ProductionSummaryData {
  ml: ProductionStats;
  shopee: ProductionStats;
  total: ProductionStats;
}

export interface DeducedMaterial {
  name: string;
  quantity: number;
  unit: string;
}

// Stock & Products
export type StockItemKind = "INSUMO" | "PRODUTO" | "PROCESSADO";

export interface StockItem {
  id: string;
  code: string;
  name: string;
  kind: StockItemKind;
  unit: string;
  current_qty: number;
  min_qty: number;
  reserved_qty?: number;
  ready_qty?: number;
  sell_price?: number;
  cost_price?: number;
  description?: string;
  status?: string;
  category?: string;
  color?: string;
  product_type?: "papel_de_parede" | "miudos";
  substitute_product_code?: string;
  expedition_items?: { stockItemCode: string; qty_per_pack: number }[];
  barcode?: string;
  is_volatile_infinite?: boolean;
  base_type?: "branca" | "preta" | "especial";
  localizacao?: string;
  mixed_qty?: number;
  bom_composition?: {
    items: Array<{
      code?: string;
      stockItemCode?: string;
      name?: string;
      qty?: number;
      [key: string]: any;
    }>;
  };
  items?: any[];
}

export type StockMovementOrigin =
  | "AJUSTE_MANUAL"
  | "PRODUCAO_MANUAL"
  | "BIP"
  | "ENSACAMENTO"
  | "MOAGEM"
  | "IMPORT_XML"
  | "PRODUCAO_INTERNA";

export interface StockMovement {
  id: string;
  stockItemCode: string;
  stockItemName?: string;
  operatorName?: string;
  createdBy?: string;
  qty_delta: number;
  itemSnapshot?: { name: string, unit: string };
  new_total?: number;
  origin: StockMovementOrigin | string;
  ref: string;
  createdAt: Date;
  fromWeighing?: boolean;
  productSku?: string;
}

export interface ProdutoCombinado {
  productSku: string;
  items: {
    stockItemCode: string;
    qty_per_pack: number;
    fromWeighing?: boolean;
    substituteCode?: string;
  }[];
}

export interface StockPackGroup {
  id: string;
  name: string;
  barcode?: string;
  item_codes: string[];
  min_pack_qty: number;
  tipo?: "volatil" | "tradicional";
  quantidade_volatil?: number;
  final_product_code?: string;
  localizacao?: string;
  pallet?: string;
  galpao?: string;
  com_desempenadeira?: boolean;
  pack_size?: number;
  created_at?: string;
}

export type StockDeductionMode = "STOCK" | "PRODUCTION";

// Production: Weighing & Grinding
export type WeighingType = "daily" | "hourly";

export interface WeighingBatchProduct {
  sku: string;
  nome: string;
  cor?: string;
  qty_batida: number;
  qty_ensacada: number;
}

export interface WeighingBatch {
  id: string;
  stock_item_code: string;
  stock_item_name: string;
  stockItemName: string;
  initialQty: number;
  initial_qty: number;
  usedQty: number;
  used_qty: number;
  createdAt: Date;
  userId: string;
  createdBy: string;
  weighingType: WeighingType;
  weighing_type?: WeighingType;
  operadorMaquina?: string;
  operador_maquina?: string;
  operadorBatedor?: string;
  operador_batedor?: string;
  quantidade_batedor?: number;
  comCor?: boolean;
  com_cor?: boolean;
  tipoOperacao?: "SO_BATEU" | "SO_ENSACADEIRA" | "BATEU_ENSACOU";
  tipo_operacao?: string;
  equipeMistura?: string;
  equipe_mistura?: string;
  destino?: string;
  baseSku?: string;
  base_sku?: string;
  batchName?: string;
  batch_name?: string;
  produtos?: WeighingBatchProduct[];
}

export interface GrindingBatch {
  id: string;
  sourceInsumoCode: string;
  sourceInsumoName: string;
  sourceQtyUsed: number;
  outputInsumoCode: string;
  outputInsumoName: string;
  outputQtyProduced: number;
  createdAt: Date;
  userId: string;
  userName: string;
  mode: "manual" | "automatico";
  batch_name?: string;
}

// Orders
export type OrderStatusValue =
  | "NORMAL"
  | "ERRO"
  | "DEVOLVIDO"
  | "BIPADO"
  | "SOLUCIONADO";
export const ORDER_STATUS_VALUES: OrderStatusValue[] = [
  "NORMAL",
  "ERRO",
  "DEVOLVIDO",
  "BIPADO",
  "SOLUCIONADO"
];

export interface OrderResolutionDetails {
  resolution_type: string;
  notes: string;
  new_tracking?: string;
  refunded: boolean;
  shipping_cost?: number;
  resolved_by: string;
  resolved_at: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  blingId?: string;
  blingNumero?: string;
  tracking: string;
  sku: string;
  qty_original: number;
  multiplicador: number;
  qty_final: number;
  color: string;
  canal: Canal;
  data: string;
  created_at?: string;
  status: OrderStatusValue;
  customer_name?: string;
  customer_cpf_cnpj?: string;
  price_gross: number;
  price_total: number;
  platform_fees: number;
  shipping_fee: number;
  shipping_paid_by_customer: number;
  price_net: number;
  error_reason?: string;
  resolution_details?: OrderResolutionDetails;
  data_prevista_envio?: string;
  venda_origem?: string;
  id_pedido_loja?: string;
  vinculado_bling?: boolean;
  etiqueta_gerada?: boolean;
  lote_id?: string;
  descontar_volatil?: boolean;
  idLojaVirtual?: string;
  loja?: any;
}

export interface ScanLogItem {
  id: string;
  time: Date;
  userId: string;
  user: string;
  device: string;
  displayKey: string;
  status: "OK" | "DUPLICATE" | "NOT_FOUND" | "ERROR" | "ADJUSTED";
  synced: boolean;
  canal?: Canal;
}

export interface ScanResult {
  status: "OK" | "DUPLICATE" | "NOT_FOUND" | "ERROR";
  message: string;
  input_code: string;
  display_key: string;
  synced_with_list: boolean;
  channel?: Canal;
  order_key?: string;
  sku_key?: string;
  tracking_number?: string;
  groupComplete?: boolean;
  groupSize?: number;
  first_scan?: {
    by: string;
    at: string;
    device: string;
  };
  scan?: {
    id: string;
    at: string;
  };
  user?: {
    name: string;
    device: string;
  };
}

export interface ReturnItem {
  id: string;
  tracking: string;
  customerName?: string;
  loggedBy: string;
  loggedById: string;
  loggedAt: Date;
  order_id?: string;
}

export interface SkuLink {
  importedSku: string;
  masterProductSku: string;
}

// Bling Integration
export interface BlingExportacaoConfig {
  statusPadrao?: number[];
  diasPadrao?: number;
  canalPadrao?: "ML" | "SHOPEE" | "SITE" | "TODOS";
  autoImportarRastreio?: boolean;
  limitePedidos?: number;
}

export interface BlingEtiquetasConfig {
  modoPadrao?: "danfe_etiqueta" | "apenas_etiqueta";
  fonteZpl?: "bling_api" | "local";
  delayEntrePrintMs?: number;
}

export interface BlingSettings {
  apiKey: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  expiresIn?: number;
  createdAt?: number;
  autoSync: boolean;
  autoSyncFromDate?: string;
  scope: BlingScopeSettings;
  exportacao?: BlingExportacaoConfig;
  etiquetasConfig?: BlingEtiquetasConfig;
  certificado?: {
    base64?: string;
    password?: string;
    fileName?: string;
    expiryDate?: number;
  };
}

// Mercado Livre Integration
export interface MLSettings {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  sellerId?: string;
  sellerNickname?: string;
  autoSync: boolean;
}

// Shopee Open Platform Integration
export interface ShopeeSettings {
  authMode?: "oauth" | "direct";
  partnerId: string;
  partnerKey: string;
  shopId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  shopName?: string;
  autoSync: boolean;
}

export interface BlingScopeSettings {
  importarProdutos: boolean;
  importarPedidos: boolean;
  importarNotasFiscais: boolean;
  gerarEtiquetas: boolean;
  pedidosVenda?: boolean;
  produtos?: boolean;
  contatos?: boolean;
  estoque?: boolean;
  nfe?: boolean;
  logistica?: boolean;
  financeiro?: boolean;
  webhooks?: boolean;
}

export interface BlingSaleOrderItem {
  codigo: string;
  descricao: string;
  quantidade: number;
  valorunidade: number;
}

export interface BlingSaleOrder {
  numero: string;
  numeroPedidoLoja?: string;
  data: string;
  totalvenda: number;
  cliente: { nome: string };
  itens: BlingSaleOrderItem[];
  transporte?: { codigoRastreamento?: string };
  situacao: string;
  id: string;
  nota?: { numero?: string };
}

export interface BlingInvoice {
  id: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  nomeCliente: string;
  valorNota: number;
  chaveAcesso?: string;
  situacao: string;
  idPedidoVenda?: string;
  numeroLoja?: string;
  linkDanfe?: string;
  idLojaVirtual?: string;
}

export interface BlingProduct {
  id: string;
  codigo: string;
  descricao: string;
  preco: number;
  estoqueAtual: number;
}

// Sync Infrastructure
export enum SyncStatus {
  PENDING = "PENDING",
  SYNCING = "SYNCING",
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
  PARTIAL = "PARTIAL"
}

export interface SyncLog {
  id: string;
  type: "PEDIDOS" | "NOTAS_FISCAIS" | "PRODUTOS";
  status: SyncStatus;
  startedAt: number;
  completedAt?: number;
  recordsProcessed: number;
  recordsFailed: number;
  errorMessage?: string;
  details?: {
    newRecords?: number;
    updatedRecords?: number;
    skippedRecords?: number;
  };
}

export interface ProductVinculation {
  id: string;
  erpProductId: string;
  blingProductId: string;
  blingCode: string;
  erpSku: string;
  createdAt: number;
  lastSyncedAt?: number;
}

export interface SyncResult {
  success: boolean;
  status: SyncStatus;
  type: "PEDIDOS" | "NOTAS_FISCAIS" | "PRODUTOS";
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  newRecords: number;
  updatedRecords: number;
  errorMessage?: string;
  timestamp: number;
}

export interface BlingOrderSyncData {
  blingOrder: BlingSaleOrder;
  internalOrderId?: string;
  syncedAt: number;
  status: SyncStatus;
}

export interface BlingInvoiceSyncData {
  blingInvoice: BlingInvoice;
  pedidoVendaId?: string;
  syncedAt: number;
  status: SyncStatus;
}

// Advanced Filtering
export enum BatchStatus {
  NOVO = "NOVO",
  EM_PROCESSAMENTO = "EM_PROCESSAMENTO",
  COMPLETO = "COMPLETO",
  ERRO = "ERRO",
  AGUARDANDO = "AGUARDANDO"
}

export interface AdvancedFilter {
  searchTerm?: string;
  status?: string[];
  lote?: string;
  dateFrom?: string;
  dateTo?: string;
  skus?: string[];
  productIds?: string[];
  excludeCompleted?: boolean;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: "date" | "amount" | "status" | "name";
  sortOrder?: "asc" | "desc";
}

export interface FilterResult {
  items: any[];
  totalCount: number;
  displayCount: number;
  hasMore: boolean;
  filters: AdvancedFilter;
}

export interface BatchOperation {
  id: string;
  type: "UPDATE_STATUS" | "VINCULATE" | "ASSIGN_LOTE" | "DELETE";
  targetIds: string[];
  createdAt: number;
  completedAt?: number;
  status: "PENDING" | "PROCESSING" | "SUCCESS" | "PARTIAL" | "ERROR";
  successCount: number;
  errorCount: number;
  errors?: Array<{ itemId: string; message: string }>;
}

export interface LoteInfo {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  itemsCount: number;
  completedCount: number;
  errorCount: number;
  status: BatchStatus;
  tags?: string[];
}

// NFe & SEFAZ Integration
export enum NFeStatus {
  PENDENTE = "PENDENTE",
  ASSINADA = "ASSINADA",
  ENVIADA = "ENVIADA",
  AUTORIZADA = "AUTORIZADA",
  REJEITADA = "REJEITADA",
  CANCELADA = "CANCELADA",
  INUTILIZADA = "INUTILIZADA",
  ERRO_ASSINATURA = "ERRO_ASSINATURA",
  ERRO_SEFAZ = "ERRO_SEFAZ"
}

export interface NFeDados {
  id: string;
  numero?: string;
  serie?: string;
  chaveAcesso?: string;
  cnpjEmitente: string;
  nomeEmitente: string;
  cnpjDestinatario: string;
  nomeDestinatario: string;
  enderecoDestinatario: string;
  municipioDestinatario: string;
  ufDestinatario: string;
  itens: NFeItem[];
  valorSubtotal: number;
  valorDesconto?: number;
  valorFrete?: number;
  valorICMS?: number;
  valorIPI?: number;
  valorPIS?: number;
  valorCOFINS?: number;
  valorTotal: number;
  dataEmissao: string;
  naturezaOperacao: string;
  descricaoNatureza: string;
  pedidoVendaId?: string;
  observacoes?: string;
  transporte?: {
    modalidade: "RODO" | "AÉREO" | "AQUAVIÁRIO" | "FERROVIÁRIO" | "DUTO";
    transportador?: string;
    placa?: string;
    volume?: number;
    pesoLiquido?: number;
    pesoBruto?: number;
  };
}

export interface NFeItem {
  numero: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  valorDesconto?: number;
  aliquotaIcms?: number;
  aliquotaIpi?: number;
  baseICMS?: number;
  valorICMS?: number;
}

export interface NFeAssinatura {
  nfeId: string;
  dataAssinatura: number;
  certificadoSerialNumber: string;
  assinadaPor: string;
}

export interface NFeSefazEnvio {
  nfeId: string;
  dataEnvio: number;
  versaoPadrao: string;
  ambiente: "PRODUÇÃO" | "HOMOLOGAÇÃO";
  statusSefaz: string;
  recibo?: string;
  protocoloAutorizacao?: string;
  dataAutorizacao?: number;
  urlConsulta?: string;
}

export interface NFeRegistro {
  id: string;
  nfeDados: NFeDados;
  assinatura?: NFeAssinatura;
  sefazEnvio?: NFeSefazEnvio;
  status: NFeStatus;
  xmlOriginal?: string;
  xmlAssinado?: string;
  pdfRenderizado?: string;
  linkDanfe?: string;
  erroDetalhes?: string;
  tentativasEnvio: number;
  ultimaTentativa?: number;
  criadoEm: number;
  atualizadoEm: number;
}

export interface CertificadoDigital {
  id: string;
  nome: string;
  nomeArquivo: string;
  senhaArmazenada?: string;
  cnpjAssociado: string;
  valido: boolean;
  dataValidade: number;
  dataCarregamento: number;
  tipo: "A1" | "A3";
  instancia: "RAIZ" | "INTERMEDIÁRIA" | "FINAL";
}

export interface ConfiguracaoNFe {
  emissao: "NORMAL" | "CONTINGÊNCIA";
  ambiente: "PRODUÇÃO" | "HOMOLOGAÇÃO";
  versaoPadrao: string;
  certificadoDigital?: CertificadoDigital;
  cnpjEmitente: string;
  uf: string;
  numSerieNFe: string;
  proxNumNFe: number;
  naturezaOperacao: string;
  sequencialAssinatura: number;
  estrategiaSefaz?: "bling" | "direto";
}

export interface ZplPlatformSettings {
  imageAreaPercentage_even: number;
  footer: {
    positionPreset: "below" | "above" | "custom";
    x_position_mm: number;
    y_position_mm: number;
    spacing_mm: number;
    fontSize_pt: number;
    lineSpacing_pt: number;
    fontFamily: "helvetica" | "times" | "courier";
    textAlign: "left" | "center" | "right";
    multiColumn: boolean;
    template: string;
  };
}

export interface ZplSettings {
  pageWidth: number;
  pageHeight: number;
  dpi: "203" | "300" | "Auto";
  sourcePageScale_percent: number;
  pairingMode: "Odd/Even Sequential";
  pairLayout: "vertical" | "horizontal";
  combineMultiPageDanfe: boolean;
  regex: {
    orderId: string;
    sku: string;
    quantity: string;
  };
  shopee: ZplPlatformSettings;
  mercadoLivre: ZplPlatformSettings;
  tikTokShop?: ZplPlatformSettings;
}

export const defaultZplSettings: ZplSettings = {
  pageWidth: 100,
  pageHeight: 150,
  dpi: "Auto",
  sourcePageScale_percent: 100,
  pairingMode: "Odd/Even Sequential",
  pairLayout: "vertical",
  combineMultiPageDanfe: true,
  regex: {
    orderId: "Order ID: ([A-Z0-9]+)",
    sku: "SKU: ([A-Z0-9-]+)",
    quantity: "Qty: (\\d+)"
  },
  shopee: {
    imageAreaPercentage_even: 70,
    footer: {
      positionPreset: "below",
      x_position_mm: 2,
      y_position_mm: 105,
      spacing_mm: 5,
      fontSize_pt: 10,
      lineSpacing_pt: 12,
      fontFamily: "helvetica",
      textAlign: "left",
      multiColumn: false,
      template: "{qty} un - SKU: {sku}"
    }
  },
  mercadoLivre: {
    imageAreaPercentage_even: 70,
    footer: {
      positionPreset: "below",
      x_position_mm: 2,
      y_position_mm: 105,
      spacing_mm: 5,
      fontSize_pt: 10,
      lineSpacing_pt: 12,
      fontFamily: "helvetica",
      textAlign: "left",
      multiColumn: false,
      template: "{qty} un - SKU: {sku}"
    }
  },
  tikTokShop: {
    imageAreaPercentage_even: 100,
    footer: {
      positionPreset: "below",
      x_position_mm: 3,
      y_position_mm: 60,
      spacing_mm: 5,
      fontSize_pt: 10,
      lineSpacing_pt: 12,
      fontFamily: "helvetica",
      textAlign: "left",
      multiColumn: false,
      template: "{qty}x {sku}"
    }
  }
};

export interface ExtractedZplData {
  skus: { sku: string; qty: number }[];
  orderId?: string;
  hasDanfe?: boolean;
  isMercadoLivre?: boolean;
  containsDanfeInLabel?: boolean;
  isTikTokShop?: boolean;
}

export interface EtiquetaHistoryItem {
  id: string;
  created_at: string;
  created_by_name: string;
  page_count: number;
  zpl_content: string;
  settings_snapshot: ZplSettings;
  page_hashes: string[];
}

export interface ZplBatch {
  id: string;
  created_at: string;
  batch_id: string;
  description?: string;
  source: string | 'bling-notas' | 'marketplace' | 'individual' | 'manual';
  label_count: number;
  zpl_content: string;
  created_by_name?: string;
}

export interface EtiquetasState {
  zplInput: string;
  includeMode: "both" | "only_danfe" | "only_label";
  zplPages: string[];
  previews: string[];
  extractedData: Map<number, ExtractedZplData>;
  printedIndices: Set<number>;
  warnings: string[];
  useHalfCount?: boolean;
  showUnificadores?: boolean;
}

export type ZplIncludeMode = "both" | "only_label" | "only_danfe";

// Planning & Shopping
export interface PlanningParameters {
  purchaseSuggestionMultiplier: number;
  stockProjectionDays: number;
  promotionMultiplier: number;
  analysisPeriodValue: number;
  analysisPeriodUnit: "days" | "months";
  forecastPeriodDays: number;
  safetyStockDays: number;
  defaultLeadTimeDays: number;
  historicalSpikeDays?: {
    date: string;
    name: string;
    channel: "Geral" | "ML" | "SHOPEE";
  }[];
  targetMode: PlanningTargetMode;
  targetValue: number;
}

export type PlanningTargetMode =
  | "growth_percentage"
  | "revenue_target"
  | "unit_target";

export interface ProductionPlanItem {
  product: StockItem;
  avgDailySales: number;
  forecastedDemand: number;
  requiredProduction: number;
  reason: string;
  substitute?: StockItem;
  avgPrice?: number;
  projectedRevenue?: number;
  calculatedCost?: number;
  calculatedMargin?: number;
}

export interface ProductionPlan {
  id: string;
  name: string;
  status: "Draft" | "Final";
  parameters: PlanningParameters;
  items: any[];
  planDate: string;
  createdAt: string;
  createdBy: string;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  is_purchased?: boolean;
}

export interface RequiredInsumo {
  insumo: StockItem;
  requiredQty: number;
  currentStock: number;
  deficit: number;
  leadTime: number;
  purchaseBy: Date;
}

// Import & Parser
export interface ResumidaItem {
  sku: string;
  color: string;
  distribution: { [qty: number]: number };
  total_units: number;
}

export interface MaterialItem {
  name: string;
  quantity: number;
  unit: string;
  cost?: number;
}

export interface ProcessedData {
  importId: string;
  canal: Canal;
  lists: {
    completa: OrderItem[];
    resumida: ResumidaItem[];
    totaisPorCor: any[];
    listaDeMateriais?: MaterialItem[];
  };
  skusNaoVinculados: { sku: string; colorSugerida: string }[];
  idempotencia: { lancaveis: number; jaSalvos: number };
  summary: {
    totalPedidos: number;
    totalPacotes: number;
    totalUnidades: number;
    totalUnidadesBranca: number;
    totalUnidadesPreta: number;
    totalUnidadesEspecial: number;
    totalMiudos: number;
  };
}

export interface ImportHistoryItem {
  id: string;
  fileName: string;
  processedAt: string;
  user: string;
  itemCount: number;
  unlinkedCount: number;
  unlinked_count: number;
  canal: Canal;
  processedData?: ProcessedData;
  processed_data?: ProcessedData;
}

export interface ParsedNfeItem {
  code: string;
  name: string;
  quantity: number;
  unit: "kg" | "un" | "m" | "L";
}

// General Settings Structure
export interface ColumnMapping {
  orderId: string;
  sku: string;
  qty: string;
  tracking: string;
  date: string;
  dateShipping: string;
  priceGross: string;
  totalValue?: string;
  buyerPaidTotal?: string;
  shippingFee: string;
  shippingPaidByCustomer?: string;
  fees: string[];
  priceNet?: string;
  customerName: string;
  customerCpf: string;
  statusColumn?: string;
  acceptedStatusValues?: string[];
  storeName?: string;
  importStartRow?: number;
  sumMultipleLines?: boolean;
  fixedFeePerItem?: number;
  commissionPercent?: number;
  // Produção
  productionEnabled?: boolean;
  productionSku?: string;
  productionQty?: string;
  productionBatchName?: string;
  productionBaseType?: string;
  productionOperationType?: string;
  productionOperator?: string;
}

export interface ExpeditionRule {
  id: string;
  from: number;
  to: number;
  stockItemCode: string;
  quantity: number;
  category: string;
}

export interface ExpeditionSettings {
  packagingRules: ExpeditionRule[];
  miudosPackagingRules: ExpeditionRule[];
}

export interface CategoryConfig {
  name: string;
  hasBase: boolean;
  baseNames?: string[];
}

export interface ProductBaseConfig {
  type: "branca" | "preta" | "especial";
  specialBaseSku?: string;
}

export interface CustomSector {
  id: string;
  name: string;
  allowedPages: string[];
}

export interface GeneralSettings {
  companyName: string;
  appIcon: string;
  dateSource: "sale_date" | "import_date";
  isRepeatedValue: boolean;
  bipagem: {
    debounceTime_ms: number;
    scanSuffix: string;
    defaultOperatorId: string;
  };
  etiquetas: {
    labelaryApiUrl: string;
    apiRequestDelay_ms: number;
    renderChunkSize: number;
  };
  estoque: PlanningParameters;
  dashboard: DashboardWidgetConfig;
  baseColorConfig: { [key: string]: ProductBaseConfig };
  miudosCategoryList: string[];
  miudosCategories?: { [key: string]: string };
  productTypeNames: { papel_de_parede: string; miudos: string };
  insumoCategoryList: string[];
  productCategoryList: string[];
  productCategoryConfigs?: CategoryConfig[];
  expeditionRules: ExpeditionSettings;
  importer: {
    ml: ColumnMapping;
    shopee: ColumnMapping;
    site: ColumnMapping;
    tiktok: ColumnMapping;
  };
  pedidos: {
    errorReasons: string[];
    resolutionTypes: string[];
    displayCustomerIdentifier: boolean;
  };
  integrations?: {
    bling?: BlingSettings;
    mercadoLivre?: MLSettings;
    shopee?: ShopeeSettings;
    tikTokShop?: {
      apiKey?: string;
      shopId?: string;
      shopName?: string;
      autoSync?: boolean;
    };
  };
  setorList: string[];
  setorDisplayNames: Record<string, string>;
  customSectors?: CustomSector[];
  customStores?: CustomStore[];
  navMode?: 'sidebar' | 'topnav';
  deductions?: TaxEntry[];
  financeCards?: FinanceCardConfig[];
  despesaCategorias?: DespesaCategoria[];
  despesaFornecedores?: DespesaFornecedor[];
  despesaLancamentos?: DespesaLancamento[];
  reportTitle?: string;
  reportLogoBase64?: string;
  customReportImageBase64?: string;
  pptxTemplateBase64?: string;
}

export interface FinanceCardConfig {
  id: string;
  label: string;
  metric: 'gross' | 'net' | 'buyerTotal' | 'fees' | 'shipping' | 'customerPaid' | 'taxTotal' | 'units' | 'totalPedidos' | 'ticketMedio' | 'margemPct' | 'deductions' | 'estProfit' | 'estMargin' | 'despesasLancadas' | 'custom';
  color: 'blue' | 'red' | 'orange' | 'emerald' | 'slate' | 'purple';
  enabled: boolean;
  customFormula?: string;
}

export const defaultGeneralSettings: GeneralSettings = {
  companyName: "ERP Fábrica Pro",
  appIcon: "Factory",
  dateSource: "sale_date",
  isRepeatedValue: false,
  bipagem: { debounceTime_ms: 50, scanSuffix: "", defaultOperatorId: "" },
  etiquetas: {
    labelaryApiUrl:
      "https://api.labelary.com/v1/printers/{dpmm}dpmm/labels/{width}x{height}/0/",
    apiRequestDelay_ms: 1200,
    renderChunkSize: 3
  },
  estoque: {
    purchaseSuggestionMultiplier: 2,
    stockProjectionDays: 7,
    promotionMultiplier: 0,
    analysisPeriodValue: 7,
    analysisPeriodUnit: "days",
    forecastPeriodDays: 7,
    safetyStockDays: 7,
    defaultLeadTimeDays: 14,
    historicalSpikeDays: [],
    targetMode: "growth_percentage",
    targetValue: 10
  },
  dashboard: {
    showProductionSummary: true,
    showMaterialDeductions: true,
    showStatCards: true,
    showActionCards: true,
    showRecentActivity: true,
    showSystemAlerts: true,
    showPackGroups: true
  },
  baseColorConfig: {},
  miudosCategoryList: [],
  productTypeNames: { papel_de_parede: "Papel de Parede", miudos: "Miúdos" },
  insumoCategoryList: [],
  productCategoryList: [],
  expeditionRules: { packagingRules: [], miudosPackagingRules: [] },
  importer: {
    ml: {
      orderId: "N.º de venda",
      sku: "SKU",
      qty: "Quantidade",
      tracking: "Código de rastreamento",
      date: "Data de venda",
      dateShipping: "",
      priceGross: "Receita por produtos (BRL)",
      totalValue: "",
      shippingFee: "",
      shippingPaidByCustomer: "Custo de envio (pago pelo comprador)",
      fees: ["Tarifa de venda e impostos (BRL)"],
      customerName: "Comprador",
      customerCpf: "Documento do comprador",
      statusColumn: "",
      acceptedStatusValues: []
    },
    shopee: {
      orderId: "N.º do pedido",
      sku: "Referência SKU",
      qty: "Quantidade",
      tracking: "Código de rastreio",
      date: "Data de criação do pedido",
      dateShipping: "Data prevista de envio",
      priceGross: "Preço acordado",
      totalValue: "",
      shippingFee: "Desconto de Frete Aproximado",
      shippingPaidByCustomer: "Taxa de envio paga pelo comprador",
      fees: ["Taxa de comissão", "Taxa de serviço"],
      customerName: "Nome do Comprador",
      customerCpf: "",
      statusColumn: "",
      acceptedStatusValues: []
    },
    site: {
      orderId: "Order ID",
      sku: "Seller SKU",
      qty: "Quantity",
      tracking: "Tracking ID",
      date: "Created Time",
      dateShipping: "",
      priceGross: "SKU Subtotal After Discount",
      totalValue: "Order Amount",
      shippingFee: "Shipping Fee After Discount",
      shippingPaidByCustomer: "",
      fees: ["SKU Platform Discount"],
      customerName: "Recipient",
      customerCpf: "CPF Number",
      statusColumn: "Order Status",
      acceptedStatusValues: []
    },
    tiktok: {
      orderId: "Order ID",
      sku: "Seller SKU",
      qty: "Quantity",
      tracking: "Tracking ID",
      date: "Created Time",
      dateShipping: "",
      priceGross: "SKU Subtotal After Discount",
      totalValue: "Order Amount",
      shippingFee: "Shipping Fee After Discount",
      shippingPaidByCustomer: "",
      fees: ["SKU Platform Discount"],
      customerName: "Recipient",
      customerCpf: "CPF Number",
      statusColumn: "Order Status",
      acceptedStatusValues: []
    }
  },
  pedidos: {
    errorReasons: ["Sem cola", "Quantidade errada", "Cor errada"],
    resolutionTypes: ["Reenviado", "Reembolso"],
    displayCustomerIdentifier: false
  },
  setorList: [],
  setorDisplayNames: {},
  customSectors: [],
  navMode: 'sidebar',
  deductions: [],
  financeCards: [
    { id: 'card_1', label: 'Faturado (sem taxas)', metric: 'gross', color: 'blue', enabled: true },
    { id: 'card_2', label: 'Líquido Final', metric: 'net', color: 'emerald', enabled: true },
    { id: 'card_3', label: 'Pago pelos Clientes + Frete', metric: 'buyerTotal', color: 'purple', enabled: true },
  ]
};

// BI Data
export interface BiDataItem {
  id_pedido: string;
  codigo_pedido: string;
  data_pedido: string;
  canal: Canal;
  status_pedido: string;
  sku_mestre: string;
  nome_produto: string;
  quantidade_final: number;
  bipado_por: string;
  bipado_por_id: string;
  data_bipagem: string;
  status_derivado: string;
  tempo_separacao_horas: number;
}

export type ReportFilters = {
  period: string;
  startDate: string;
  endDate: string;
  search: string;
  canal: string;
  status: string;
  insumoCode: string;
  operatorId: string;
  stockKindFilter: string;
  orderStatusFilter: string;
};

export type ReportPeriod =
  | "today"
  | "yesterday"
  | "last7days"
  | "thisMonth"
  | "custom";
export type BipStatus = "OK" | "DUPLICATE" | "NOT_FOUND" | "ERROR" | "ADJUSTED";

export interface OrderProduct {
  product: StockItem;
  quantity: number;
}

export interface TaxEntry {
  id: string;
  name: string;
  type: "percent" | "fixed";
  value: number;
  enabled?: boolean;
  calculatedAmount?: number;
  appliesTo?: 'gross' | 'after_fees' | 'after_ship' | 'after_both';
  category?: 'imposto' | 'publicidade' | 'funcionarios' | 'insumos' | 'outro';
  appliesToChannels?: string[];
  isMarketplaceCommission?: boolean;
}

export interface CustomStore {
  id: string;
  name: string;
  color?: string;
}

// ── Lançamento de Pagamentos (Despesas) ──
export interface DespesaCategoria {
  id: string;
  name: string;
  color?: string;
}

export interface DespesaFornecedor {
  id: string;
  name: string;
  cnpj?: string;
}

export interface DespesaLancamento {
  id: string;
  tipo: 'mensal' | 'faturado';
  categoriaId: string;
  categoriaNome: string;
  fornecedorId?: string;
  fornecedorNome: string;
  fornecedorCnpj?: string;
  produtoSku?: string;
  produtoNome?: string;
  funcionarioId?: string;
  funcionarioNome?: string;
  valor: number;
  pagoCartao?: boolean;
  competencia: string; // formato "YYYY-MM" (principal / retrocompatibilidade)
  competencias?: string[]; // múltiplas competências "YYYY-MM" para mensal
  dataLancamento: string; // ISO date
  // Campos para faturado
  dataInicial?: string; // ISO date
  parcelasDias?: number[]; // ex: [15, 30, 45, 60, 90]
  parcelasGeradas?: DespesaParcela[];
  observacao?: string;
  created_at: string;
}

export interface DespesaParcela {
  id: string;
  despesaId: string;
  competencia: string; // "YYYY-MM"
  dataVencimento: string; // ISO date
  valor: number;
  pago?: boolean;
}

export interface PedidoOverride {
  ncm?: string;
  origemProduto?: number;
  desconto?: number;
  clienteNome?: string;
}

export interface LoteNfeItem {
  pedidoVendaId: string;
  pedidoNumero?: string;
  nfeId?: string;
  nfeNumero?: string;
}

export interface LoteNfeFalha {
  pedidoVendaId: string;
  pedidoNumero?: string;
  error: string;
}

export interface LoteNfe {
  id: string;
  data: string;
  tipo: "GERACAO_APENAS" | "GERACAO_EMISSAO";
  total: number;
  ok: number;
  fail: number;
  nfes: LoteNfeItem[];
  falhas?: LoteNfeFalha[];
}

export interface ZplBatch {
  id: string;
  timestamp: string;
  total: number;
  success: number;
  successIds: string[];
  failed: { orderId: string; blingId: string; error: string }[];
  zplContent: string;
  nfes?: LoteNfeItem[];
}

export type NfeSituacao =
  | "todas"
  | "pendentes"
  | "autorizadas"
  | "autorizadas_sem_danfe"
  | "emitidas"
  | "rejeitadas"
  | "canceladas"
  | "recibo";

export const NFE_SITUACAO_CODES: Record<string, number[]> = {
  pendentes: [1],
  canceladas: [2],
  recibo: [3],
  rejeitadas: [4],
  autorizadas: [5, 6, 9],
  autorizadas_sem_danfe: [5, 6, 9],
  emitidas: [11]
};
