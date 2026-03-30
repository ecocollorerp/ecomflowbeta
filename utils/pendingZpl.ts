/**
 * Fila de Pendentes de Impressão ZPL
 * Persiste no localStorage — compartilhada entre BlingPage e EtiquetasPage.
 */

const STORAGE_KEY = 'erp_pending_zpl_queue';

export interface PendingZplItem {
  id: string;           // ex: "LOTE-MP-2026-02-26T12-34-56"
  loteId: string;       // label legível
  zplContent: string;
  labelCount: number;
  timestamp: string;    // ISO
  source: 'bling-notas' | 'marketplace' | 'individual' | 'manual';
  /** descricao extra: ex nº pedido, lista de IDs */
  descricao?: string;
}

export function loadPendingZpl(): PendingZplItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingZplItem[];
  } catch {
    return [];
  }
}

export function savePendingZpl(items: PendingZplItem[]): void {
  try {
    // Limita a 100 itens para não sobrecarregar o localStorage
    const trimmed = items.slice(0, 100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    // Dispara evento para outras abas / componentes que estejam ouvindo
    window.dispatchEvent(new CustomEvent('pendingZplChanged'));
  } catch {
    // silently ignore quota exceeded
  }
}

export function addPendingZplItem(item: PendingZplItem): void {
  const current = loadPendingZpl();
  // Dedup por id
  const updated = [item, ...current.filter(i => i.id !== item.id)];
  savePendingZpl(updated);
}

export function removePendingZplItem(id: string): void {
  const current = loadPendingZpl();
  savePendingZpl(current.filter(i => i.id !== id));
}

export function clearPendingZpl(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('pendingZplChanged'));
}
