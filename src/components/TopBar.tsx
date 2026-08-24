import {
  BellRing, BookOpen, Database, History, Info, Layers3, RadioTower,
  SlidersHorizontal,
} from 'lucide-react';

export type PanelId = 'layers' | 'filters' | 'archive' | 'stations' | 'settings' | 'guide' | 'about' | null;

interface TopBarProps {
  activePanel: PanelId;
  alertCount: number;
  historyOpen: boolean;
  onPanel: (panel: PanelId) => void;
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

export function TopBar({ activePanel, alertCount, historyOpen, onPanel, onHistory }: TopBarProps) {
  return (
    <header className="topbar" aria-label="Navegación principal">
      <nav className="top-tools" aria-label="Herramientas">
        {tools.map(({ id, label, icon: Icon }) => (
          <button key={id} className={activePanel === id ? 'active' : ''} onClick={() => onPanel(id)} title={label} aria-label={label}>
            <Icon size={18} />
            <span>{label}</span>
            {id === 'settings' && alertCount > 0 && <i>{alertCount}</i>}
          </button>
        ))}
        <button className={`history-toggle ${historyOpen ? 'active' : ''}`} onClick={onHistory} title="Historial sísmico" aria-label="Historial sísmico">
          <History size={19} /><span>Historial</span>
        </button>
      </nav>
    </header>
  );
}
