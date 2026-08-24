import { useEffect, useRef, useState } from 'react';
import {
  BellRing, BookOpen, Database, History, Info, Layers3, RadioTower,
  Search, SlidersHorizontal, X,
} from 'lucide-react';
import type { DataStatus } from '../types';

export type PanelId = 'layers' | 'filters' | 'archive' | 'stations' | 'settings' | 'guide' | 'about' | null;

interface TopBarProps {
  activePanel: PanelId;
  query: string;
  status: DataStatus;
  alertCount: number;
  historyOpen: boolean;
  onPanel: (panel: PanelId) => void;
  onQuery: (query: string) => void;
  onHistory: () => void;
}

const tools = [
  { id: 'layers' as const, label: 'Capas', icon: Layers3 },
  { id: 'filters' as const, label: 'Filtros', icon: SlidersHorizontal },
  { id: 'archive' as const, label: 'Archivo', icon: Database },
  { id: 'stations' as const, label: 'Estaciones', icon: RadioTower },
  { id: 'settings' as const, label: 'Alertas', icon: BellRing },
  { id: 'guide' as const, label: 'Enciclopedia', icon: BookOpen },
  { id: 'about' as const, label: 'Acerca de', icon: Info },
];

export function TopBar({ activePanel, query, status, alertCount, historyOpen, onPanel, onQuery, onHistory }: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(Boolean(query));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (query) setSearchOpen(true); }, [query]);
  const toggleSearch = () => {
    setSearchOpen((open) => {
      if (!open) window.setTimeout(() => inputRef.current?.focus(), 30);
      return !open;
    });
  };
  return (
    <header className="topbar" aria-label="Navegación principal">
      <div className={`search-control ${searchOpen ? 'open' : ''}`}>
        <button className="search-trigger" onClick={toggleSearch} title="Buscar" aria-label="Abrir búsqueda"><Search size={18} /></button>
        <label><input ref={inputRef} value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Lugar, magnitud, fuente o estación" aria-label="Buscar en Episismic" /></label>
        {searchOpen && <button className="search-close" onClick={() => { onQuery(''); setSearchOpen(false); }} aria-label="Cerrar búsqueda"><X size={14} /></button>}
      </div>
      <nav className="top-tools" aria-label="Herramientas">
        {tools.map(({ id, label, icon: Icon }) => (
          <button key={id} className={activePanel === id ? 'active' : ''} onClick={() => onPanel(activePanel === id ? null : id)} title={label}>
            <Icon size={18} />
            <span>{label}</span>
            {id === 'settings' && alertCount > 0 && <i>{alertCount}</i>}
          </button>
        ))}
      </nav>
      <div className="top-status" title={status.sources?.join(' · ') || 'Estado de catálogos'}>
        <span className={`live-dot ${status.state}`} />
        <small>{status.state === 'live' ? `${status.sources?.length ?? 1}/3 FUENTES` : status.state === 'loading' ? 'SINCRONIZANDO' : 'LOCAL'}</small>
      </div>
      <button className={`history-toggle ${historyOpen ? 'active' : ''}`} onClick={onHistory} title="Historial sísmico">
        <History size={19} /><span>Historial</span>
      </button>
    </header>
  );
}
