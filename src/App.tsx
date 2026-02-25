import { useState, useMemo } from 'react';
import './App.css';
import { logFiles, logFileNames, parseRawData, getUniqueValues, getTotalTokens, getResponseTime } from './data/logData';
import type { Filters, SortField, SortDirection } from './types';
import FiltersPanel from './components/Filters';
import EventCard from './components/EventCard';
import Charts from './components/Charts';

type ViewTab = 'events' | 'charts' | 'toolchains';

const DEFAULT_FILE = logFileNames.includes('test-1.3.jsonl') ? 'test-1.3.jsonl' : logFileNames[0];

function App() {
  const [selectedFile, setSelectedFile] = useState<string>(DEFAULT_FILE);
  const allEvents = useMemo(() => parseRawData(logFiles[selectedFile]), [selectedFile]);

  const [filters, setFilters] = useState<Filters>({
    tools: [],
    events: [],
    models: [],
    toolchains: [],
    functionality: [],
    searchText: '',
  });
  const [sortField, setSortField] = useState<SortField>('lineNumber');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [activeTab, setActiveTab] = useState<ViewTab>('events');

  function handleFileChange(file: string) {
    setSelectedFile(file);
    setFilters({ tools: [], events: [], models: [], toolchains: [], functionality: [], searchText: '' });
  }

  const availableTools = useMemo(() => getUniqueValues(allEvents, 'TOOL'), [allEvents]);
  const availableEvents = useMemo(() => getUniqueValues(allEvents, 'event'), [allEvents]);
  const availableModels = useMemo(() => getUniqueValues(allEvents, 'agent_model'), [allEvents]);
  const availableFunctionality = useMemo(() => getUniqueValues(allEvents, 'functionality'), [allEvents]);
  const availableToolchains = useMemo(() => {
    const tcs = new Set<string>();
    for (const e of allEvents) {
      tcs.add(e.TOOLCHAIN.split('/')[0]);
    }
    return Array.from(tcs).sort();
  }, [allEvents]);

  const filteredEvents = useMemo(() => {
    let result = allEvents;

    if (filters.tools.length > 0) {
      result = result.filter(e => filters.tools.includes(e.TOOL));
    }
    if (filters.events.length > 0) {
      result = result.filter(e => filters.events.includes(e.event));
    }
    if (filters.models.length > 0) {
      result = result.filter(e => e.agent_model && filters.models.includes(e.agent_model));
    }
    if (filters.toolchains.length > 0) {
      result = result.filter(e => {
        const rootTc = e.TOOLCHAIN.split('/')[0];
        return filters.toolchains.includes(rootTc);
      });
    }
    if (filters.functionality.length > 0) {
      result = result.filter(
        e => e.functionality && filters.functionality.includes(e.functionality)
      );
    }
    if (filters.searchText) {
      const lower = filters.searchText.toLowerCase();
      result = result.filter(e => JSON.stringify(e).toLowerCase().includes(lower));
    }

    return result;
  }, [allEvents, filters]);

  const sortedEvents = useMemo(() => {
    const sorted = [...filteredEvents];
    const dir = sortDirection === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      switch (sortField) {
        case 'lineNumber':
          return (a.lineNumber - b.lineNumber) * dir;
        case 'event':
          return a.event.localeCompare(b.event) * dir;
        case 'TOOL':
          return a.TOOL.localeCompare(b.TOOL) * dir;
        case 'response_time': {
          const aTime = getResponseTime(a) ?? 0;
          const bTime = getResponseTime(b) ?? 0;
          return (aTime - bTime) * dir;
        }
        case 'tokens': {
          return (getTotalTokens(a) - getTotalTokens(b)) * dir;
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [filteredEvents, sortField, sortDirection]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Yaduha Log Viewer</h1>
        <p className="app-subtitle">Translation Pipeline Event Logger</p>
        <div className="file-selector">
          <span className="file-selector-label">Dataset:</span>
          {logFileNames.map(name => (
            <button
              key={name}
              className={`file-btn ${selectedFile === name ? 'active' : ''}`}
              onClick={() => handleFileChange(name)}
            >
              {name.replace('.jsonl', '')}
            </button>
          ))}
        </div>
        <nav className="tab-nav">
          <button
            className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            Events
          </button>
          <button
            className={`tab-btn ${activeTab === 'charts' ? 'active' : ''}`}
            onClick={() => setActiveTab('charts')}
          >
            Charts & Analytics
          </button>
        </nav>
      </header>

      <div className="app-body">
        <FiltersPanel
          filters={filters}
          onFiltersChange={setFilters}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={(field, dir) => {
            setSortField(field);
            setSortDirection(dir);
          }}
          availableTools={availableTools}
          availableEvents={availableEvents}
          availableModels={availableModels}
          availableToolchains={availableToolchains}
          availableFunctionality={availableFunctionality}
          totalCount={allEvents.length}
          filteredCount={filteredEvents.length}
        />

        <main className="main-content">
          {activeTab === 'events' && (
            <div className="events-list">
              {sortedEvents.map(event => (
                <EventCard key={event.lineNumber} event={event} />
              ))}
              {sortedEvents.length === 0 && (
                <div className="empty-state">No events match the current filters.</div>
              )}
            </div>
          )}

          {activeTab === 'charts' && <Charts events={filteredEvents} />}
        </main>
      </div>
    </div>
  );
}

export default App;
