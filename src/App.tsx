import { useState, useMemo, useEffect, useCallback } from 'react';
import './App.css';
import { parseRawData, getUniqueValues, getTotalTokens, getResponseTime } from './data/logData';
import type { Filters, SortField, SortDirection } from './types';
import FiltersPanel from './components/Filters';
import EventCard from './components/EventCard';
import Charts from './components/Charts';
import RunExperiment from './components/RunExperiment';

type ViewTab = 'events' | 'charts' | 'experiment';

interface ApiFile {
  name: string;
  content: string;
}

const DEFAULT_API_URL = 'http://localhost:8000';

function App() {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [apiFiles, setApiFiles] = useState<ApiFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [apiStatus, setApiStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  const allFileNames = useMemo(
    () => apiFiles.map(f => f.name).sort(),
    [apiFiles],
  );

  // Auto-load all log files from the API whenever the API URL changes
  const loadFromApi = useCallback(async (url: string) => {
    setApiStatus('loading');
    try {
      const listRes = await fetch(`${url}/api/experiments/logs`);
      if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
      const { files } = await listRes.json() as { files: string[] };

      const loaded: ApiFile[] = await Promise.all(
        files.map(async (filename) => {
          const res = await fetch(`${url}/api/experiments/logs/${filename}`);
          const content = res.ok ? await res.text() : '';
          return { name: filename, content };
        })
      );

      setApiFiles(loaded);
      setSelectedFile(prev => loaded.some(f => f.name === prev) ? prev : (loaded[0]?.name ?? ''));
      setApiStatus('ok');
    } catch {
      setApiStatus('error');
    }
  }, []);

  useEffect(() => {
    loadFromApi(apiUrl);
  }, [apiUrl, loadFromApi]);

  function getFileContent(name: string): string {
    return apiFiles.find(f => f.name === name)?.content ?? '';
  }

  function handleLogLoaded(filename: string, content: string) {
    setApiFiles(prev => {
      const without = prev.filter(f => f.name !== filename);
      return [{ name: filename, content }, ...without];
    });
    setSelectedFile(filename);
    setActiveTab('charts');
  }

  const allEvents = useMemo(
    () => {
      const content = getFileContent(selectedFile);
      if (!content) return [];
      return parseRawData(content);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedFile, apiFiles],
  );

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
      if (e.TOOLCHAIN) tcs.add(e.TOOLCHAIN.split('/')[0]);
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
        const rootTc = e.TOOLCHAIN?.split('/')[0];
        return rootTc !== undefined && filters.toolchains.includes(rootTc);
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

  const showSidebar = activeTab === 'events' || activeTab === 'charts';

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-top">
          <div>
            <h1>Yaduha Log Viewer</h1>
            <p className="app-subtitle">Translation Pipeline Event Logger</p>
          </div>
          <span className={`api-status api-status-${apiStatus}`}>
            {apiStatus === 'loading' && '⏳ connecting…'}
            {apiStatus === 'ok' && `✓ ${allFileNames.length} file${allFileNames.length !== 1 ? 's' : ''}`}
            {apiStatus === 'error' && '✗ API offline'}
          </span>
        </div>

        {allFileNames.length > 0 && activeTab !== 'experiment' && (
          <div className="file-selector">
            <span className="file-selector-label">Dataset:</span>
            {allFileNames.map(name => (
              <button
                key={name}
                className={`file-btn ${selectedFile === name ? 'active' : ''}`}
                onClick={() => handleFileChange(name)}
              >
                {name.replace('.jsonl', '')}
              </button>
            ))}
          </div>
        )}

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
            Charts &amp; Analytics
          </button>
          <button
            className={`tab-btn tab-btn-accent ${activeTab === 'experiment' ? 'active' : ''}`}
            onClick={() => setActiveTab('experiment')}
          >
            Run Experiment
          </button>
        </nav>

        {activeTab === 'experiment' && (
          <div className="api-url-row">
            <label className="api-url-label">API URL</label>
            <input
              className="api-url-input"
              value={apiUrl}
              onChange={e => setApiUrl(e.target.value)}
              placeholder="http://localhost:8000"
            />
          </div>
        )}
      </header>

      <div className="app-body">
        {showSidebar && (
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
        )}

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

          {activeTab === 'experiment' && (
            <RunExperiment apiUrl={apiUrl} onLogLoaded={handleLogLoaded} />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
