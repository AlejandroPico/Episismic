import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, ExternalLink, LibraryBig, ListTree, Search } from 'lucide-react';
import { encyclopediaCategories, encyclopediaChapters } from '../data/encyclopedia';
import { ScientificDiagram } from './ScientificDiagram';

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function Encyclopedia() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [selectedId, setSelectedId] = useState(encyclopediaChapters[0].id);
  const [mobileIndexOpen, setMobileIndexOpen] = useState(false);
  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    return encyclopediaChapters.filter((item) => (category === 'Todos' || item.category === category)
      && (!term || normalize(`${item.title} ${item.subtitle} ${item.category} ${item.sections.map((section) => section.text).join(' ')} ${item.facts.join(' ')}`).includes(term)));
  }, [category, query]);
  const selected = encyclopediaChapters.find((item) => item.id === selectedId) ?? filtered[0] ?? encyclopediaChapters[0];

  return <div className="encyclopedia-workspace">
    <button className="encyclopedia-mobile-index-toggle" onClick={() => setMobileIndexOpen((open) => !open)} aria-expanded={mobileIndexOpen}>
      <ListTree size={16} /><span><small>ÍNDICE</small><strong>{selected.title}</strong></span><ChevronDown size={16} />
    </button>
    <aside className={`encyclopedia-index ${mobileIndexOpen ? 'mobile-open' : ''}`}>
      <div className="encyclopedia-stats">
        <LibraryBig size={20} />
        <div><strong>{encyclopediaChapters.length} capítulos</strong><small>{encyclopediaCategories.length} áreas · esquemas y fuentes</small></div>
      </div>
      <label className="encyclopedia-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cualquier concepto" /></label>
      <div className="encyclopedia-categories" aria-label="Categorías enciclopédicas">
        {['Todos', ...encyclopediaCategories].map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <div className="encyclopedia-chapters">
        {filtered.map((item, index) => <button key={item.id} className={selected.id === item.id ? 'active' : ''} onClick={() => { setSelectedId(item.id); setMobileIndexOpen(false); }}>
          <span>{String(index + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><small>{item.category}</small></div><ChevronRight size={14} />
        </button>)}
        {!filtered.length && <p className="encyclopedia-empty">No hay capítulos para esta búsqueda.</p>}
      </div>
    </aside>
    <article className="encyclopedia-article">
      <header>
        <p className="eyebrow">ENCICLOPEDIA SÍSMICA / {selected.category.toUpperCase()}</p>
        <h2>{selected.title}</h2>
        <p>{selected.subtitle}</p>
      </header>
      {selected.diagram && <ScientificDiagram kind={selected.diagram} />}
      <div className="encyclopedia-body">
        {selected.sections.map((section) => <section key={section.title}><h3>{section.title}</h3><p>{section.text}</p></section>)}
        <section className="key-facts"><h3>Conceptos esenciales</h3><ul>{selected.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul></section>
        <section className="encyclopedia-references"><h3>Referencias y ampliación</h3><div>{selected.references.map((reference) => <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer"><span><small>{reference.authority}</small><strong>{reference.label}</strong></span><ExternalLink size={15} /></a>)}</div></section>
      </div>
      <footer><BookOpen size={15} /><span>Contenido educativo estructurado; los avisos de protección civil deben consultarse siempre en organismos oficiales.</span></footer>
    </article>
  </div>;
}
