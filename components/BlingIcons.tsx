/**
 * BlingIcons.tsx — Ícones e Badges visuais que replicam a interface do Bling ERP.
 * Situação NF-e, Canal de venda, Status de pedido, Logística.
 */
import React from "react";
import {
  Clock, CheckCircle2, XCircle, AlertTriangle, Send, Ban, FileCheck,
  ShieldAlert, Loader2, Package, Truck, Store, ShoppingBag,
  Globe, Smartphone, Tag, FileX, Eye, ReceiptText
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// NF-e Situação Badge — replica cores e ícones do painel Bling
// Situação: 1=Pendente, 2=Cancelada, 3=AguardandoRecibo, 4=Rejeitada,
//           5=Autorizada, 6=Emitida, 7=Denegada, 8=Encerrada
// ═══════════════════════════════════════════════════════════════════════

const NFE_SITUACAO_CONFIG: Record<number, {
  label: string;
  icon: React.ElementType;
  bg: string;
  text: string;
  ring: string;
}> = {
  1: { label: "Pendente",           icon: Clock,          bg: "bg-amber-50",    text: "text-amber-700",    ring: "ring-amber-200" },
  2: { label: "Cancelada",          icon: XCircle,        bg: "bg-red-50",      text: "text-red-700",      ring: "ring-red-200" },
  3: { label: "Aguardando Recibo",  icon: Loader2,        bg: "bg-purple-50",   text: "text-purple-700",   ring: "ring-purple-200" },
  4: { label: "Rejeitada",          icon: AlertTriangle,  bg: "bg-orange-50",   text: "text-orange-700",   ring: "ring-orange-200" },
  5: { label: "Autorizada",         icon: CheckCircle2,   bg: "bg-emerald-50",  text: "text-emerald-700",  ring: "ring-emerald-200" },
  6: { label: "Emitida",            icon: FileCheck,      bg: "bg-blue-50",     text: "text-blue-700",     ring: "ring-blue-200" },
  7: { label: "Denegada",           icon: ShieldAlert,    bg: "bg-slate-100",   text: "text-slate-600",    ring: "ring-slate-300" },
  8: { label: "Encerrada",          icon: Ban,            bg: "bg-gray-100",    text: "text-gray-500",     ring: "ring-gray-300" },
};

export const BlingNfeSituacaoBadge: React.FC<{
  situacao: number;
  size?: "sm" | "md";
  showLabel?: boolean;
}> = ({ situacao, size = "sm", showLabel = true }) => {
  const config = NFE_SITUACAO_CONFIG[situacao] || {
    label: `Status ${situacao}`,
    icon: Eye,
    bg: "bg-gray-50",
    text: "text-gray-500",
    ring: "ring-gray-200",
  };
  const Icon = config.icon;
  const iconSize = size === "sm" ? 10 : 13;
  const textCls = size === "sm" ? "text-[9px]" : "text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black uppercase tracking-wider ring-1 ${config.bg} ${config.text} ${config.ring} ${textCls}`}
      title={config.label}
    >
      <Icon size={iconSize} className={situacao === 3 ? "animate-spin" : ""} />
      {showLabel && config.label}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Canal de Venda Badge — ML, Shopee, Site/Loja própria, TikTok
// ═══════════════════════════════════════════════════════════════════════

const CANAL_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  bg: string;
  text: string;
  ring: string;
}> = {
  ML: {
    label: "Mercado Livre",
    icon: ShoppingBag,
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    ring: "ring-yellow-200",
  },
  SHOPEE: {
    label: "Shopee",
    icon: Smartphone,
    bg: "bg-orange-50",
    text: "text-orange-600",
    ring: "ring-orange-200",
  },
  SITE: {
    label: "Loja Própria",
    icon: Globe,
    bg: "bg-indigo-50",
    text: "text-indigo-600",
    ring: "ring-indigo-200",
  },
  TIKTOK: {
    label: "TikTok Shop",
    icon: Store,
    bg: "bg-pink-50",
    text: "text-pink-600",
    ring: "ring-pink-200",
  },
  AMAZON: {
    label: "Amazon",
    icon: Package,
    bg: "bg-sky-50",
    text: "text-sky-600",
    ring: "ring-sky-200",
  },
};

/**
 * Detecta o canal a partir de texto (nome da loja, descrição, etc.)
 */
function detectCanalKey(raw: string): string {
  const t = (raw || "").toUpperCase();
  if (t.includes("MERCADO") || t.includes("MLB") || t === "ML") return "ML";
  if (t.includes("SHOPEE") || t.includes("SHP")) return "SHOPEE";
  if (t.includes("TIKTOK") || t.includes("TIK TOK")) return "TIKTOK";
  if (t.includes("AMAZON")) return "AMAZON";
  return "SITE";
}

export const BlingCanalBadge: React.FC<{
  canal?: string;
  loja?: string;
  idLojaVirtual?: string | number;
  size?: "sm" | "md";
}> = ({ canal, loja, size = "sm" }) => {
  const key = detectCanalKey(canal || loja || "");
  const config = CANAL_CONFIG[key] || CANAL_CONFIG.SITE;
  const Icon = config.icon;
  const iconSize = size === "sm" ? 10 : 13;
  const textCls = size === "sm" ? "text-[9px]" : "text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black uppercase tracking-wider ring-1 ${config.bg} ${config.text} ${config.ring} ${textCls}`}
      title={config.label}
    >
      <Icon size={iconSize} />
      {config.label}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Status do Pedido Badge — Em aberto, Em andamento, Atendido, Cancelado
// ═══════════════════════════════════════════════════════════════════════

const PEDIDO_STATUS_CONFIG: Record<number, {
  label: string;
  icon: React.ElementType;
  bg: string;
  text: string;
  ring: string;
}> = {
  6:  { label: "Em aberto",     icon: Clock,         bg: "bg-amber-50",   text: "text-amber-700",   ring: "ring-amber-200" },
  9:  { label: "Atendido",      icon: CheckCircle2,  bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  12: { label: "Cancelado",     icon: XCircle,        bg: "bg-red-50",     text: "text-red-700",     ring: "ring-red-200" },
  15: { label: "Em andamento",  icon: Send,           bg: "bg-blue-50",    text: "text-blue-700",    ring: "ring-blue-200" },
};

export const BlingPedidoStatusBadge: React.FC<{
  situacaoId: number;
  situacaoNome?: string;
  size?: "sm" | "md";
}> = ({ situacaoId, situacaoNome, size = "sm" }) => {
  const config = PEDIDO_STATUS_CONFIG[situacaoId] || {
    label: situacaoNome || `#${situacaoId}`,
    icon: Tag,
    bg: "bg-gray-50",
    text: "text-gray-500",
    ring: "ring-gray-200",
  };
  const Icon = config.icon;
  const iconSize = size === "sm" ? 10 : 13;
  const textCls = size === "sm" ? "text-[9px]" : "text-[11px]";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black uppercase tracking-wider ring-1 ${config.bg} ${config.text} ${config.ring} ${textCls}`}
      title={config.label}
    >
      <Icon size={iconSize} />
      {config.label}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Ícone de Logística / Transportadora
// ═══════════════════════════════════════════════════════════════════════

export const BlingTransportadoraBadge: React.FC<{
  nome: string;
  rastreio?: string;
  size?: "sm" | "md";
}> = ({ nome, rastreio, size = "sm" }) => {
  const textCls = size === "sm" ? "text-[9px]" : "text-[11px]";
  const iconSize = size === "sm" ? 10 : 12;

  // Detecta transportadora para cor
  const t = (nome || "").toUpperCase();
  let bg = "bg-slate-50";
  let text = "text-slate-600";
  let ring = "ring-slate-200";
  if (t.includes("CORREIOS") || t.includes("PAC") || t.includes("SEDEX")) {
    bg = "bg-yellow-50"; text = "text-yellow-700"; ring = "ring-yellow-200";
  } else if (t.includes("MERCADO") || t.includes("MELI") || t.includes("FULL")) {
    bg = "bg-blue-50"; text = "text-blue-600"; ring = "ring-blue-200";
  } else if (t.includes("JADLOG") || t.includes("JL")) {
    bg = "bg-red-50"; text = "text-red-600"; ring = "ring-red-200";
  } else if (t.includes("SHOPEE") || t.includes("SPX")) {
    bg = "bg-orange-50"; text = "text-orange-600"; ring = "ring-orange-200";
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold tracking-wide ring-1 ${bg} ${text} ${ring} ${textCls}`}
      title={rastreio ? `Rastreio: ${rastreio}` : nome}
    >
      <Truck size={iconSize} />
      {nome || "—"}
      {rastreio && (
        <span className="ml-1 font-mono opacity-70 text-[8px]">
          {rastreio}
        </span>
      )}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// Badge de DANFE status
// ═══════════════════════════════════════════════════════════════════════

export const BlingDanfeBadge: React.FC<{
  hasLink: boolean;
  size?: "sm" | "md";
}> = ({ hasLink, size = "sm" }) => {
  const iconSize = size === "sm" ? 10 : 12;
  const textCls = size === "sm" ? "text-[9px]" : "text-[11px]";

  if (hasLink) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black uppercase tracking-wider ring-1 bg-green-50 text-green-700 ring-green-200 ${textCls}`}>
        <ReceiptText size={iconSize} />
        DANFE ✓
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black uppercase tracking-wider ring-1 bg-gray-50 text-gray-400 ring-gray-200 ${textCls}`}>
      <FileX size={iconSize} />
      Sem DANFE
    </span>
  );
};
