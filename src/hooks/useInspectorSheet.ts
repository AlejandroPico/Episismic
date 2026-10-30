import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { readInspectorCollapsed, saveInspectorCollapsed, type InspectorKind } from '../utils/inspectorPreference';

/** A header can be swiped without taking touch scrolling away from the body. */
export function useInspectorSheet(itemId: string, kind: InspectorKind) {
  const [collapsed, setCollapsed] = useState(() => readInspectorCollapsed(kind));
  const [dragY, setDragY] = useState(0);
  const gesture = useRef<{ pointerId: number; startY: number; delta: number; limit: number } | null>(null);

  useEffect(() => {
    setDragY(0);
    gesture.current = null;
  }, [itemId]);

  const updateCollapsed = (value: boolean) => {
    saveInspectorCollapsed(kind, value);
    setCollapsed(value);
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!event.isPrimary || event.button !== 0
      || (event.target as HTMLElement).closest('button, a, input')) return;
    const panel = event.currentTarget.parentElement;
    const limit = collapsed ? 150 : Math.max(0, (panel?.offsetHeight ?? 0) - event.currentTarget.offsetHeight);
    gesture.current = { pointerId: event.pointerId, startY: event.clientY, delta: 0, limit };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    current.delta = event.clientY - current.startY;
    setDragY(collapsed ? Math.max(-current.limit, Math.min(0, current.delta))
      : Math.max(0, Math.min(current.limit, current.delta)));
  };
  const finish = (event: PointerEvent<HTMLElement>, cancelled = false) => {
    const current = gesture.current;
    if (!current || event.pointerId !== current.pointerId) return;
    if (!cancelled && Math.abs(current.delta) >= 35) updateCollapsed(current.delta > 0);
    gesture.current = null;
    setDragY(0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return {
    collapsed, dragY,
    toggle: () => updateCollapsed(!collapsed),
    headerGestures: { onPointerDown, onPointerMove, onPointerUp: (event: PointerEvent<HTMLElement>) => finish(event),
      onPointerCancel: (event: PointerEvent<HTMLElement>) => finish(event, true) },
  };
}
