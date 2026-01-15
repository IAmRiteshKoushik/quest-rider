export function sortSequence<T extends { id: string; prevId?: string | null }>(
    items: T[]
): T[] {
    if (items.length <= 1) return items;

    const itemMap = new Map(items.map((item) => [item.id, item]));
    const sorted: T[] = [];

    // Find the head (the item where prevId is null or its prevId is not in the current set)
    let current = items.find(
        (item) => !item.prevId || !itemMap.has(item.prevId)
    );

    const visited = new Set<string>();

    while (current && !visited.has(current.id)) {
        sorted.push(current);
        visited.add(current.id);
        const nextId = current.id;
        current = items.find((item) => item.prevId === nextId);
    }

    return sorted;
}
