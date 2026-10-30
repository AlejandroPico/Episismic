export type InspectorKind = 'event' | 'station' | 'volcano';

export function readInspectorCollapsed(kind: InspectorKind): boolean {
  try { return localStorage.getItem(`episismic:${kind}-inspector-collapsed`) === 'true'; }
  catch { return false; }
}

export function saveInspectorCollapsed(kind: InspectorKind, collapsed: boolean) {
  try { localStorage.setItem(`episismic:${kind}-inspector-collapsed`, String(collapsed)); }
  catch { /* Keep the current sheet usable when storage is unavailable. */ }
}
