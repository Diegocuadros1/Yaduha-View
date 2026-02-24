import type { Filters, SortField, SortDirection } from '../types';

interface FiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  availableTools: string[];
  availableEvents: string[];
  availableModels: string[];
  availableToolchains: string[];
  availableFunctionality: string[];
  totalCount: number;
  filteredCount: number;
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <div className="filter-group">
      <label className="filter-label">{label}</label>
      <div className="filter-chips">
        {options.map(option => (
          <button
            key={option}
            className={`chip ${selected.includes(option) ? 'active' : ''}`}
            onClick={() => toggle(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FiltersPanel({
  filters,
  onFiltersChange,
  sortField,
  sortDirection,
  onSortChange,
  availableTools,
  availableEvents,
  availableModels,
  availableToolchains,
  availableFunctionality,
  totalCount,
  filteredCount,
}: FiltersProps) {
  const update = (partial: Partial<Filters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const clearAll = () => {
    onFiltersChange({
      tools: [],
      events: [],
      models: [],
      toolchains: [],
      functionality: [],
      searchText: '',
    });
  };

  const hasActiveFilters =
    filters.tools.length > 0 ||
    filters.events.length > 0 ||
    filters.models.length > 0 ||
    filters.toolchains.length > 0 ||
    filters.functionality.length > 0 ||
    filters.searchText.length > 0;

  return (
    <aside className="filters-panel">
      <div className="filters-header">
        <h2>Filters</h2>
        <span className="event-count">
          {filteredCount} / {totalCount} events
        </span>
      </div>

      {hasActiveFilters && (
        <button className="clear-all-btn" onClick={clearAll}>
          Clear all filters
        </button>
      )}

      <div className="filter-group">
        <label className="filter-label">Search</label>
        <input
          type="text"
          className="search-input"
          placeholder="Search events..."
          value={filters.searchText}
          onChange={e => update({ searchText: e.target.value })}
        />
      </div>

      <div className="filter-group">
        <label className="filter-label">Sort by</label>
        <div className="sort-controls">
          <select
            value={sortField}
            onChange={e => onSortChange(e.target.value as SortField, sortDirection)}
          >
            <option value="lineNumber">Line Number</option>
            <option value="event">Event Type</option>
            <option value="TOOL">Tool</option>
            <option value="response_time">Response Time</option>
            <option value="tokens">Token Usage</option>
          </select>
          <button
            className="sort-dir-btn"
            onClick={() =>
              onSortChange(sortField, sortDirection === 'asc' ? 'desc' : 'asc')
            }
          >
            {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <MultiSelect
        label="Tool"
        options={availableTools}
        selected={filters.tools}
        onChange={tools => update({ tools })}
      />

      <MultiSelect
        label="Event Type"
        options={availableEvents}
        selected={filters.events}
        onChange={events => update({ events })}
      />

      <MultiSelect
        label="Model"
        options={availableModels}
        selected={filters.models}
        onChange={models => update({ models })}
      />

      {availableFunctionality.length > 0 && (
        <MultiSelect
          label="Functionality"
          options={availableFunctionality}
          selected={filters.functionality}
          onChange={functionality => update({ functionality })}
        />
      )}

      <MultiSelect
        label="Toolchain"
        options={availableToolchains.map(tc => tc.slice(0, 8) + '...')}
        selected={filters.toolchains.map(tc => tc.slice(0, 8) + '...')}
        onChange={shortIds => {
          const fullIds = shortIds.map(short => {
            const prefix = short.replace('...', '');
            return availableToolchains.find(tc => tc.startsWith(prefix)) ?? short;
          });
          update({ toolchains: fullIds });
        }}
      />
    </aside>
  );
}
