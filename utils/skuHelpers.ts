import { StockItem } from '../types';

// Build a map from child SKU code to an array of parent StockItems that contain it
export function buildParentMap(items: StockItem[]): Map<string, StockItem[]> {
    const map = new Map<string, StockItem[]>();
    items.forEach(parent => {
        const children: string[] = [];
        if (parent.bom_composition && Array.isArray(parent.bom_composition.items)) {
            parent.bom_composition.items.forEach((c: any) => {
                if (c.code) children.push(c.code);
                if (c.stockItemCode) children.push(c.stockItemCode);
            });
        }
        children.forEach(childCode => {
            const list = map.get(childCode) || [];
            list.push(parent);
            map.set(childCode, list);
        });
    });
    return map;
}

// Determine if the given StockItem should match the search term.
// The match will succeed if:
//  * the item's code or name contains the term;
//  * any of its own BOM children codes/names contain the term;
//  * the item is a child of a parent whose code or name contains the term.
export function skuMatchesTerm(
    item: StockItem,
    term: string,
    allItems: StockItem[],
    parentMap?: Map<string, StockItem[]>
): boolean {
    const lower = term.toLowerCase();
    if (item.code.toLowerCase().includes(lower) || item.name.toLowerCase().includes(lower)) {
        return true;
    }

    // check children of this item
    if (item.bom_composition && Array.isArray(item.bom_composition.items)) {
        for (const c of item.bom_composition.items) {
            const code = (c.code || c.stockItemCode || '').toString().toLowerCase();
            const name = (c.name || '').toString().toLowerCase();
            if (code.includes(lower) || name.includes(lower)) {
                return true;
            }
        }
    }

    // check parents (if this item is a component of somebody else)
    const map = parentMap || buildParentMap(allItems);
    const parents = map.get(item.code) || [];
    for (const p of parents) {
        if (p.code.toLowerCase().includes(lower) || p.name.toLowerCase().includes(lower)) {
            return true;
        }
    }

    return false;
}

// Helper for filtering by SKU code only.  Returns true if the code itself or any parent matches term.
export function skuCodeMatches(
    code: string,
    term: string,
    allItems: StockItem[],
    parentMap?: Map<string, StockItem[]>
): boolean {
    const lower = term.toLowerCase();
    if (code.toLowerCase().includes(lower)) return true;
    const map = parentMap || buildParentMap(allItems);
    const parents = map.get(code) || [];
    return parents.some(p => p.code.toLowerCase().includes(lower) || p.name.toLowerCase().includes(lower));
}
