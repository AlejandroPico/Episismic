import {
  BellRing, BookOpen, Database, History, Info, Layers3, Menu, RadioTower,
  Search, SlidersHorizontal, SunMoon, X,
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
  onMenu: () => void;
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

export function TopBar({ activePanel, query, status, alertCount, historyOpen, onPanel, onQuery, onHistory, onMenu }: TopBarProps) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onMenu} aria-label="Abrir navegación">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
        <span><strong>EPISISMIC</strong><small>OBSERVATORIO MUNDIAL</small></span>
      </button>
      <label className="search-control">
        <Search size={17} />
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Buscar lugar, magnitud o estación" />
        {query && <button onClick={() => onQuery('')} aria-label="Limpiar búsqueda"><X size={14} /></button>}
      </label>
      <nav className="top-tools" aria-label="Herramientas">
        {tools.map(({ id, label, icon: Icon }) => (
          <button key={id} className={activePanel === id ? 'active' : ''} onClick={() => onPanel(activePanel === id ? null : id)} title={label}>
            <Icon size={18} />
            <span>{label}</span>
            {id === 'settings' && alertCount > 0 && <i>{alertCount}</i>}
          </button>
        ))}
        <button onClick={() => onPanel(activePanel === 'settings' ? null : 'settings')} title="Tema y preferencias"><SunMoon size={18} /><span>Tema</span></button>
      </nav>
      <div className="top-status">
        <span className={`live-dot ${status.state}`} />
        <small>{status.state === 'live' ? 'EN DIRECTO' : status.state === 'loading' ? 'SINCRONIZANDO' : 'LOCAL'}</small>
      </div>
      <button className={`history-toggle ${historyOpen ? 'active' : ''}`} onClick={onHistory} title="Historial sísmico">
        <History size={19} /><span>Historial</span>
      </button>
      <button className="mobile-menu" onClick={onMenu} title="Menú"><Menu size={20} /></button>
    </header>
  );
}
