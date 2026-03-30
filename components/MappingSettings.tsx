import React from 'react';
import { ColumnMapping, GeneralSettings } from '../types';
import { PackageOpen, Database, Filter, Info, X, Check } from 'lucide-react';

interface MappingSettingsProps {
    canalId: string;
    canalName: string;
    settings: GeneralSettings;
    onUpdateMapping: (canalId: string, field: string, value: any) => void;
    detectedHeaders?: string[];
    mode: 'import' | 'fiscal';
}

export const MapRow: React.FC<{
    label: string,
    field: string,
    canalId: string,
    val: string,
    onUpdate: (field: string, value: string) => void,
    detectedHeaders?: string[]
}> = ({ label, field, canalId, val, onUpdate, detectedHeaders }) => {
    const OFF_VALUE = '__OFF__';
    
    return (
        <div className="flex flex-col gap-1 w-full">
            <label className="text-[10px] font-black text-gray-400 uppercase">{label}</label>
            <div className="flex gap-2">
                <select
                    value={val || ''}
                    onChange={e => onUpdate(field, e.target.value)}
                    className={`flex-1 p-2 border rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 font-bold outline-none ${!val ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'}`}
                >
                    <option value="">-- Não mapeado --</option>
                    <option value={OFF_VALUE}>[ DESATIVAR COLUNA ]</option>
                    {detectedHeaders && detectedHeaders.length > 0 && (
                        <optgroup label="Colunas Detectadas">
                            {detectedHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </optgroup>
                    )}
                    {val && !detectedHeaders?.includes(val) && val !== OFF_VALUE && (
                        <optgroup label="Valor Atual">
                            <option value={val}>{val}</option>
                        </optgroup>
                    )}
                </select>
                {val === OFF_VALUE && (
                    <div className="flex items-center text-[9px] font-black text-amber-600 bg-amber-50 px-2 rounded-lg border border-amber-100 uppercase">OFF</div>
                )}
            </div>
        </div>
    );
};

export const MappingPanel: React.FC<MappingSettingsProps> = ({ canalId, canalName, settings, onUpdateMapping, detectedHeaders, mode }) => {
    const mapping = (settings.importer as any)[canalId] || (settings as any)[`importer_${canalId}`] || {};

    const handleUpdate = (field: string, value: any) => {
        onUpdateMapping(canalId, field, value);
    };

    const toggleFeeColumn = (header: string) => {
        const current = mapping.fees || [];
        const newFees = current.includes(header) ? current.filter((f: string) => f !== header) : [...current, header];
        handleUpdate('fees', newFees);
    };

    const toggleStatusValue = (value: string) => {
        const current = mapping.acceptedStatusValues || [];
        const valueTrimmed = value.trim();
        const newValues = current.includes(valueTrimmed) ? current.filter((v: string) => v !== valueTrimmed) : [...current, valueTrimmed];
        handleUpdate('acceptedStatusValues', newValues);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {mode === 'import' && (
                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                    <h4 className="text-xs font-black text-blue-800 uppercase mb-4 flex items-center gap-2">
                        <PackageOpen size={14}/> Dados do Pedido (Importação)
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1 w-full sm:col-span-2 pb-2 mb-2 border-b border-blue-50">
                            <label className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                                <Database size={10} /> Linha Inicial (Cabeçalho)
                            </label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    min="0"
                                    value={mapping.importStartRow ?? ''}
                                    onChange={e => handleUpdate('importStartRow', e.target.value === '' ? undefined : parseInt(e.target.value))}
                                    placeholder="Detecção Automática (Padrão)"
                                    className="max-w-[200px] p-2 border border-blue-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-blue-500 font-bold outline-none"
                                />
                                <div className="text-[9px] text-blue-400 font-medium italic">
                                    Define a linha onde os nomes das colunas aparecem (ex: Mercado Livre costuma ser linha 5 ou 6).
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 w-full sm:col-span-2 pb-2 mb-2 border-b border-blue-50">
                            <label className="text-[10px] font-black text-blue-600 uppercase flex items-center gap-1">
                                <Check size={10} /> Agregação Financeira (Multi-SKU)
                            </label>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={mapping.sumMultipleLines ?? false}
                                        onChange={e => handleUpdate('sumMultipleLines', e.target.checked)}
                                        className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
                                        Somar valores de pedidos com múltiplas linhas
                                    </span>
                                </label>
                                <div className="text-[9px] text-blue-400 font-medium italic">
                                    Se ativado, valores financeiros de cada linha do mesmo pedido serão somados. Desative se o marketplace repete o valor total em cada linha.
                                </div>
                            </div>
                        </div>
                        <MapRow label="ID do Pedido (Loja/Bling)" field="orderId" canalId={canalId} val={mapping.orderId} onUpdate={handleUpdate} detectedHeaders={detectedHeaders} />
                        <MapRow label="Código do Produto (SKU)" field="sku" canalId={canalId} val={mapping.sku} onUpdate={handleUpdate} detectedHeaders={detectedHeaders} />
                        <MapRow label="Quantidade" field="qty" canalId={canalId} val={mapping.qty} onUpdate={handleUpdate} detectedHeaders={detectedHeaders} />
                        <MapRow label="Rastreio / Tracking" field="tracking" canalId={canalId} val={mapping.tracking} onUpdate={handleUpdate} detectedHeaders={detectedHeaders} />
                        <MapRow label="Data da Venda" field="date" canalId={canalId} val={mapping.date} onUpdate={handleUpdate} detectedHeaders={detectedHeaders} />
                        <MapRow label="Data Prevista de Envio" field="dateShipping" canalId={canalId} val={mapping.dateShipping} onUpdate={handleUpdate} detectedHeaders={detectedHeaders} />
                        <MapRow label="Nome do Cliente" field="customerName" canalId={canalId} val={mapping.customerName} onUpdate={handleUpdate} detectedHeaders={detectedHeaders} />
                        <MapRow label="CPF/CNPJ do Cliente" field="customerCpf" canalId={canalId} val={mapping.customerCpf} onUpdate={handleUpdate} detectedHeaders={detectedHeaders} />
                    </div>
                </div>
            )}

            {mode === 'fiscal' && (
                <>
                    <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                        <h4 className="text-xs font-black text-emerald-800 uppercase mb-4 flex items-center gap-2">
                            <Database size={14}/> Dados Financeiros (Relatórios e DRE)
                        </h4>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <MapRow label="Valor Bruto da Venda" field="priceGross" canalId={canalId} val={mapping.priceGross} onUpdate={handleUpdate} detectedHeaders={detectedHeaders} />
                                <MapRow label="Frete Pago pelo Cliente" field="shippingPaidByCustomer" canalId={canalId} val={mapping.shippingPaidByCustomer} onUpdate={handleUpdate} detectedHeaders={detectedHeaders} />
                                <MapRow label="Logística / Nosso Custo Frete (Opcional)" field="shippingFee" canalId={canalId} val={mapping.shippingFee} onUpdate={handleUpdate} detectedHeaders={detectedHeaders} />
                                <MapRow label="Valor Líquido Recebido" field="priceNet" canalId={canalId} val={mapping.priceNet} onUpdate={handleUpdate} detectedHeaders={detectedHeaders} />
                            </div>
                            
                            <div className="mt-4">
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Colunas de Taxas/Comissões (Somar ao Custo)</label>
                                <div className="flex flex-wrap gap-2">
                                    {detectedHeaders && detectedHeaders.length > 0 ? (
                                        detectedHeaders.map(h => (
                                            <button
                                                key={h}
                                                onClick={() => toggleFeeColumn(h)}
                                                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                                                    (mapping.fees || []).includes(h)
                                                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-md'
                                                        : 'bg-white text-gray-400 border-gray-200 hover:border-emerald-300 hover:text-emerald-600'
                                                }`}
                                            >
                                                {h}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-4 bg-white border border-dashed rounded-xl w-full text-center text-[10px] font-bold text-gray-400 uppercase">
                                            Suba uma planilha de exemplo para listar colunas
                                        </div>
                                    )}
                                </div>
                                <p className="text-[9px] text-gray-400 mt-2 font-medium italic">* As colunas selecionadas acima serão somadas para compor o valor total de taxas da plataforma.</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                        <h4 className="text-xs font-black text-orange-800 uppercase mb-4 flex items-center gap-2">
                            <Filter size={14}/> Filtro de Status para Importação
                        </h4>
                        <div className="space-y-3">
                            <p className="text-[10px] text-orange-700 font-medium">Selecione uma coluna de status e os valores que devem ser aceitos para importação (ex: "PEDIDO_PAGO", "READY_TO_SHIP"). Se vazio, todos são aceitos.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <MapRow label="Coluna de Status na Planilha" field="statusColumn" canalId={canalId} val={mapping.statusColumn} onUpdate={handleUpdate} detectedHeaders={detectedHeaders} />
                            </div>
                            
                            <div className="mt-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase block mb-2">Valores de Status Aceitos</label>
                                <div className="flex flex-wrap gap-2">
                                    {(mapping.acceptedStatusValues || []).map((val: string) => (
                                        <div key={val} className="flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white rounded-xl text-[10px] font-bold">
                                            {val}
                                            <button onClick={() => toggleStatusValue(val)} className="hover:text-red-200"><X size={12}/></button>
                                        </div>
                                    ))}
                                    <input
                                        type="text"
                                        placeholder="Add status + Enter"
                                        className="px-3 py-1.5 rounded-xl text-[10px] font-bold border border-orange-200 bg-white focus:ring-2 focus:ring-orange-500 outline-none"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const target = e.target as HTMLInputElement;
                                                if (target.value.trim()) {
                                                    toggleStatusValue(target.value.trim());
                                                    target.value = '';
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
