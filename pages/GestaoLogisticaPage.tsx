
import React, { useState, useEffect } from "react";
import { Truck, Package, FileText, ChevronRight } from "lucide-react";
import { AbaObjetosPostagem } from "../components/AbaObjetosPostagem";
import { AbaRemessas } from "../components/AbaRemessas";
import { GeneralSettings, LoteNfe } from "../types";

interface GestaoLogisticaPageProps {
  token?: string;
  generalSettings: GeneralSettings;
  addToast: (msg: string, tipo: "success" | "error" | "info" | "warning") => void;
  onAddLote?: (lote: LoteNfe) => void;
}

const GestaoLogisticaPage: React.FC<GestaoLogisticaPageProps> = ({
  token,
  generalSettings,
  addToast,
  onAddLote
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"objetos" | "remessas">("objetos");
  const [remessaRefreshTrigger, setRemessaRefreshTrigger] = useState(0);

  // Filtros de data padrão (mês atual)
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const [dateFilter, setDateFilter] = useState({
    start: firstDay,
    end: lastDay
  });

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
        <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
          <Truck className="text-red-500" size={40} />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Bling não conectado</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-xs">Conecte sua conta Bling nas configurações para acessar a gestão logística.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header Premium */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Truck size={120} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-black uppercase tracking-widest rounded-md">Logística v3</span>
              <span className="text-slate-300">/</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gestão de Envios</span>
            </div>
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter flex items-center gap-3">
              <Truck className="text-orange-600" size={32} /> Gestão e Logística
            </h1>
            <p className="text-slate-500 mt-2 text-sm font-medium max-w-xl">
              Centralize o controle de seus objetos de postagem, crie remessas em lote e gerencie etiquetas simplificadas de forma integrada.
            </p>
          </div>

          <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Período de Consulta</span>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={dateFilter.start}
                onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none"
              />
              <ChevronRight size={14} className="text-slate-300" />
              <input 
                type="date" 
                value={dateFilter.end}
                onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Select */}
      <div className="flex gap-2 p-1.5 bg-slate-200/50 backdrop-blur-sm rounded-2xl w-fit">
        {(["objetos", "remessas"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`flex items-center gap-2 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 ${
              activeSubTab === tab 
                ? "bg-white shadow-lg text-orange-700 scale-105" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-300/40"
            }`}
          >
            {tab === "objetos" ? <Package size={14} /> : <FileText size={14} />}
            {tab === "objetos" ? "Objetos de Postagem" : "Remessas Gerenciadas"}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {activeSubTab === "objetos" ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <AbaObjetosPostagem
              token={token}
              addToast={addToast}
              startDate={dateFilter.start}
              endDate={dateFilter.end}
              onAddLote={onAddLote}
              onRemessaCriada={() => setRemessaRefreshTrigger(prev => prev + 1)}
            />
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <AbaRemessas
              token={token}
              addToast={addToast}
              onAddLote={onAddLote}
              refreshTrigger={remessaRefreshTrigger}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default GestaoLogisticaPage;
