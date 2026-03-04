// ============================================================================
// TIPOS TYPESCRIPT - Adicione ao seu types.ts
// ============================================================================

export interface StockItem {
    id?: string;
    code?: string;
    name?: string;
    description?: string;
    kind?: 'INSUMO' | 'PRODUTO' | 'PROCESSADO';
    current_qty?: number;
    reserved_qty?: number;
    ready_qty?: number;
    is_ready?: boolean;
    ready_location?: string;
    ready_date?: number;
    cost_price?: number;
    sell_price?: number;
    bling_id?: string;
    bling_sku?: string;
    unit?: string;
    category?: string;
    status?: string;
    created_at?: number;
    updated_at?: number;
    codigo?: string;
    descricao?: string;
    saldoFisico?: number;
    saldoVirtual?: number;
    preco?: number;
    estoqueAtual?: number;
    estoqueVirtual?: number;
    readyQty?: number;
}

export interface EstoqueProto {
    id: string;
    stock_item_id: string;
    batch_id: string;
    lote_numero?: string;
    quantidade_total: number;
    quantidade_disponivel: number;
    quantidade_reservada?: number;
    localizacao?: string;
    ambiente?: string;
    status: 'PRONTO' | 'RESERVADO' | 'EXPEDIDO' | 'DEVOLVIDO';
    data_preparacao?: number;
    data_disponibilidade?: number;
    data_expedicao?: number;
    operador_id?: string;
    movimento_origem?: string;
    observacoes?: string;
    created_at: number;
    updated_at: number;
}

export interface StockMovement {
    id: string;
    stock_item_id: string;
    quantity: number;
    movement_type: 'ENTRADA' | 'SAÍDA' | 'BALANÇO' | 'AJUSTE';
    origin: 'AJUSTE_MANUAL' | 'PRODUCAO_MANUAL' | 'BIP' | 'PESAGEM' | 'MOAGEM' | 'IMPORT_XML' | 'PRODUCAO_INTERNA' | 'BLING_SINCRONIZADO';
    order_id?: string;
    reference_id?: string;
    operator_id?: string;
    description?: string;
    observations?: string;
    created_at: number;
}

export interface StockReservation {
    id: string;
    stock_item_id: string;
    order_id: string;
    quantity: number;
    status: 'ATIVA' | 'CONVERTIDA' | 'CANCELADA';
    reserved_at: number;
    expired_at?: number;
    converted_at?: number;
    created_at: number;
}

export interface Order {
    id: string;
    bling_id?: string;
    order_number: string;
    customer_name: string;
    customer_email?: string;
    customer_phone?: string;
    customer_cpf_cnpj?: string;
    subtotal?: number;
    frete?: number;
    desconto?: number;
    total?: number;
    status: 'RASCUNHO' | 'CONFIRMADO' | 'SEPARANDO' | 'SEPARADO' | 'EMBALANDO' | 'EMBALADO' | 'ENVIADO' | 'ENTREGUE' | 'CANCELADO';
    order_date?: number;
    deadline_date?: number;
    shipped_date?: number;
    delivery_date?: number;
    tracking_code?: string;
    carrier?: string;
    sales_channel?: string;
    observations?: string;
    created_at: number;
    updated_at: number;
}

export interface OrderItem {
    id: string;
    order_id: string;
    stock_item_id?: string;
    sku: string;
    product_name: string;
    quantity: number;
    completed_quantity?: number;
    unit_price: number;
    subtotal?: number;
    created_at: number;
}

export interface NFeData {
    id: string;
    numero: string;
    serie: string;
    emissao: number;
    cliente?: any;
    valor?: number;
    pedido_id?: string;
    status: 'RASCUNHO' | 'ASSINADA' | 'ENVIADA' | 'AUTORIZADA' | 'CANCELADA' | 'REJEITADA' | 'ERRO';
    chave_acesso?: string;
    xml_original?: string;
    xml_assinado?: string;
    sefaz_envio?: any;
    certificado_usado?: any;
    tentativas_envio?: number;
    erro_detalhes?: string;
    created_at: number;
    updated_at: number;
}

export interface Certificado {
    id: string;
    nome?: string;
    cnpj: string;
    tipo: 'A1' | 'A3' | 'e-CNPJ';
    issuer?: string;
    subject?: string;
    valido: boolean;
    data_inicio?: number;
    data_validade?: number;
    thumbprint?: string;
    algoritmo_assinatura?: string;
    certificado_pem?: string;
    chave_pem?: string;
    erros?: any;
    created_at: number;
    updated_at: number;
}

export interface EstoqueRefinadorProps {
    isLoadingStock: boolean;
    stockItems: StockItem[];
    stockTab: 'todos' | 'pronto' | 'movimentos' | 'comparacao';
    setStockTab: (tab: 'todos' | 'pronto' | 'movimentos' | 'comparacao') => void;
    stockSearch: string;
    setStockSearch: (search: string) => void;
    stockFilter: 'todos' | 'zerado' | 'baixo' | 'ok' | 'divergente';
    setStockFilter: (filter: 'todos' | 'zerado' | 'baixo' | 'ok' | 'divergente') => void;
    stockSort: 'sku' | 'nome' | 'fisico_asc' | 'fisico_desc';
    setStockSort: (sort: 'sku' | 'nome' | 'fisico_asc' | 'fisico_desc') => void;
    adjustStockModal: any;
    setAdjustStockModal: (modal: any) => void;
    adjustQty: string;
    setAdjustQty: (qty: string) => void;
    adjustOp: 'B' | 'E' | 'S';
    setAdjustOp: (op: 'B' | 'E' | 'S') => void;
    adjustObs: string;
    setAdjustObs: (obs: string) => void;
    isSavingAdjust: boolean;
    handleFetchStock: () => void;
    handleAdjustStock: () => void;
    erpStockMap?: Map<string, number>;
}
