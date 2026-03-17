/**
 * Gerador de DANFE Simplificada a partir do XML da NF-e.
 * Usa jsPDF + autoTable para gerar um PDF compacto no navegador.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const tag = (parent: Element | Document, name: string): string => {
  const el = parent.getElementsByTagName(name);
  return el.length > 0 ? (el[0].textContent || "").trim() : "";
};

const fmt = (v: string) => {
  const n = parseFloat(v || "0");
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtCnpj = (v: string) => {
  if (!v) return "";
  if (v.length === 14) return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (v.length === 11) return v.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return v;
};

const fmtChave = (chave: string) => {
  return chave.replace(/(\d{4})/g, "$1 ").trim();
};

export interface DanfeSimplificadaData {
  // Emitente
  emitRazao: string;
  emitCnpj: string;
  emitIe: string;
  emitEndereco: string;
  // Destinatário
  destNome: string;
  destDoc: string;
  destEndereco: string;
  // NF-e
  numero: string;
  serie: string;
  dataEmissao: string;
  chaveAcesso: string;
  naturezaOp: string;
  // Totais
  vProd: string;
  vFrete: string;
  vDesc: string;
  vTotTrib: string;
  vNF: string;
  // Itens
  itens: Array<{
    codigo: string;
    descricao: string;
    ncm: string;
    qtd: string;
    un: string;
    vUnit: string;
    vTotal: string;
  }>;
  // Transporte
  transportadora: string;
  rastreio: string;
  volumes: string;
}

function parseXmlToDanfeData(xmlString: string): DanfeSimplificadaData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");

  // Emitente
  const emit = doc.getElementsByTagName("emit")[0];
  const emitEnder = emit ? emit.getElementsByTagName("enderEmit")[0] : null;

  // Destinatário
  const dest = doc.getElementsByTagName("dest")[0];
  const destEnder = dest ? dest.getElementsByTagName("enderDest")[0] : null;

  // Itens
  const dets = Array.from(doc.getElementsByTagName("det"));
  const itens = dets.map((det) => {
    const prod = det.getElementsByTagName("prod")[0];
    return {
      codigo: tag(prod, "cProd"),
      descricao: tag(prod, "xProd"),
      ncm: tag(prod, "NCM"),
      qtd: tag(prod, "qCom"),
      un: tag(prod, "uCom"),
      vUnit: tag(prod, "vUnCom"),
      vTotal: tag(prod, "vProd"),
    };
  });

  // Totais
  const icmsTot = doc.getElementsByTagName("ICMSTot")[0];

  // Transporte
  const transp = doc.getElementsByTagName("transporta")[0];
  const vol = doc.getElementsByTagName("vol")[0];

  return {
    emitRazao: emit ? tag(emit, "xNome") : "",
    emitCnpj: emit ? (tag(emit, "CNPJ") || tag(emit, "CPF")) : "",
    emitIe: emit ? tag(emit, "IE") : "",
    emitEndereco: emitEnder
      ? `${tag(emitEnder, "xLgr")}, ${tag(emitEnder, "nro")} - ${tag(emitEnder, "xBairro")} - ${tag(emitEnder, "xMun")}/${tag(emitEnder, "UF")} - CEP ${tag(emitEnder, "CEP")}`
      : "",
    destNome: dest ? tag(dest, "xNome") : "",
    destDoc: dest ? fmtCnpj(tag(dest, "CNPJ") || tag(dest, "CPF")) : "",
    destEndereco: destEnder
      ? `${tag(destEnder, "xLgr")}, ${tag(destEnder, "nro")} - ${tag(destEnder, "xBairro")} - ${tag(destEnder, "xMun")}/${tag(destEnder, "UF")} - CEP ${tag(destEnder, "CEP")}`
      : "",
    numero: tag(doc, "nNF"),
    serie: tag(doc, "serie"),
    dataEmissao: tag(doc, "dhEmi") || tag(doc, "dEmi"),
    chaveAcesso: tag(doc, "chNFe") || (doc.getElementsByTagName("infNFe")[0]?.getAttribute("Id")?.replace("NFe", "") || ""),
    naturezaOp: tag(doc, "natOp"),
    vProd: icmsTot ? tag(icmsTot, "vProd") : "0",
    vFrete: icmsTot ? tag(icmsTot, "vFrete") : "0",
    vDesc: icmsTot ? tag(icmsTot, "vDesc") : "0",
    vTotTrib: tag(doc, "vTotTrib"),
    vNF: icmsTot ? tag(icmsTot, "vNF") : "0",
    itens,
    transportadora: transp ? tag(transp, "xNome") : "",
    rastreio: tag(doc, "nLacre") || "",
    volumes: vol ? `${tag(vol, "qVol")} ${tag(vol, "esp")}`.trim() : "",
  };
}

export function gerarDanfeSimplificadaPDF(xmlString: string): Blob {
  const d = parseXmlToDanfeData(xmlString);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  let y = 10;

  // Cabeçalho
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("DANFE SIMPLIFICADA", w / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA", w / 2, y, { align: "center" });
  y += 6;

  // Linha divisória
  doc.setLineWidth(0.5);
  doc.line(10, y, w - 10, y);
  y += 4;

  // NF-e info
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`NF-e Nº ${d.numero}`, 10, y);
  doc.text(`Série: ${d.serie}`, 70, y);
  doc.text(`Emissão: ${d.dataEmissao ? d.dataEmissao.split("T")[0].split("-").reverse().join("/") : ""}`, w - 10, y, { align: "right" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Natureza da Operação: ${d.naturezaOp}`, 10, y);
  y += 6;

  // Chave de Acesso
  doc.setFillColor(245, 245, 245);
  doc.rect(10, y - 3, w - 20, 8, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("CHAVE DE ACESSO", 12, y);
  y += 4;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(fmtChave(d.chaveAcesso), 12, y);
  y += 6;

  // Emitente
  doc.setLineWidth(0.3);
  doc.line(10, y, w - 10, y);
  y += 4;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("EMITENTE", 10, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.text(`${d.emitRazao}  |  CNPJ: ${fmtCnpj(d.emitCnpj)}  |  IE: ${d.emitIe}`, 10, y);
  y += 4;
  doc.setFontSize(7);
  doc.text(d.emitEndereco, 10, y);
  y += 5;

  // Destinatário
  doc.line(10, y, w - 10, y);
  y += 4;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("DESTINATÁRIO", 10, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.text(`${d.destNome}  |  CPF/CNPJ: ${d.destDoc}`, 10, y);
  y += 4;
  doc.setFontSize(7);
  doc.text(d.destEndereco, 10, y);
  y += 5;

  // Transporte
  if (d.transportadora || d.volumes) {
    doc.line(10, y, w - 10, y);
    y += 4;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("TRANSPORTE", 10, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const infoTransp: string[] = [];
    if (d.transportadora) infoTransp.push(`Transportadora: ${d.transportadora}`);
    if (d.volumes) infoTransp.push(`Volumes: ${d.volumes}`);
    if (d.rastreio) infoTransp.push(`Rastreio: ${d.rastreio}`);
    doc.text(infoTransp.join("  |  "), 10, y);
    y += 5;
  }

  // Itens
  doc.line(10, y, w - 10, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    head: [["Código", "Descrição", "NCM", "Qtd", "Un", "V.Unit", "V.Total"]],
    body: d.itens.map((it) => [
      it.codigo,
      it.descricao.substring(0, 40),
      it.ncm,
      it.qtd,
      it.un,
      fmt(it.vUnit),
      fmt(it.vTotal),
    ]),
    theme: "grid",
    styles: { fontSize: 6.5, cellPadding: 1.2 },
    headStyles: { fillColor: [50, 50, 50], textColor: 255, fontSize: 7, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 60 },
      2: { cellWidth: 18 },
      3: { cellWidth: 14, halign: "right" },
      4: { cellWidth: 10 },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 22, halign: "right" },
    },
    margin: { left: 10, right: 10 },
  });

  y = (doc as any).lastAutoTable.finalY + 4;

  // Totais
  doc.setFillColor(240, 240, 240);
  doc.rect(10, y - 2, w - 20, 22, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAIS", 12, y + 2);
  doc.setFont("helvetica", "normal");
  const col1 = 12, col2 = 60, col3 = 110;
  y += 6;
  doc.text(`Produtos: R$ ${fmt(d.vProd)}`, col1, y);
  doc.text(`Frete: R$ ${fmt(d.vFrete)}`, col2, y);
  doc.text(`Desconto: R$ ${fmt(d.vDesc)}`, col3, y);
  y += 4;
  doc.text(`Tributos: R$ ${fmt(d.vTotTrib)}`, col1, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`TOTAL NF-e: R$ ${fmt(d.vNF)}`, col3, y);

  return doc.output("blob");
}
