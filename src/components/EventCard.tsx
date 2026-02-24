import { useState } from 'react';
import type { LogEvent } from '../types';
import { getTotalTokens, getResponseTime } from '../data/logData';

const EVENT_COLORS: Record<string, string> = {
  get_response_start: '#3b82f6',
  get_response_received: '#8b5cf6',
  get_response_parsed: '#6366f1',
  get_response_complete: '#10b981',
  get_response_content: '#06b6d4',
  english_to_sentences_complete: '#f59e0b',
  sentence_to_english_complete: '#ef4444',
  translation_completed: '#22c55e',
};

const TOOL_ICONS: Record<string, string> = {
  english_to_sentences: 'EN→S',
  sentence_to_english: 'S→EN',
  pipeline_translator: 'PIPE',
};

function formatJson(obj: unknown): string {
  try {
    if (typeof obj === 'string') {
      const parsed = JSON.parse(obj);
      return JSON.stringify(parsed, null, 2);
    }
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export default function EventCard({ event }: { event: LogEvent }) {
  const [expanded, setExpanded] = useState(false);
  const color = EVENT_COLORS[event.event] ?? '#6b7280';
  const icon = TOOL_ICONS[event.TOOL] ?? event.TOOL.slice(0, 4).toUpperCase();
  const totalTokens = getTotalTokens(event);
  const responseTime = getResponseTime(event);

  const excludedKeys = new Set([
    'lineNumber', 'TOOL', 'TOOLCHAIN', 'event', 'agent_model',
    'agent_name', 'functionality', 'request_id',
  ]);

  const detailKeys = Object.keys(event).filter(
    k => !excludedKeys.has(k) && event[k] !== undefined && event[k] !== null
  );

  return (
    <div className={`event-card ${expanded ? 'expanded' : ''}`} onClick={() => setExpanded(!expanded)}>
      <div className="event-card-header">
        <span className="event-line">#{event.lineNumber}</span>
        <span className="event-tool-badge" style={{ background: color }}>
          {icon}
        </span>
        <span className="event-type">{event.event}</span>
        <div className="event-meta">
          {event.functionality && (
            <span className="event-tag functionality">{event.functionality}</span>
          )}
          {event.agent_model && (
            <span className="event-tag model">{event.agent_model}</span>
          )}
          {responseTime !== null && (
            <span className="event-tag time">{responseTime.toFixed(2)}s</span>
          )}
          {totalTokens > 0 && (
            <span className="event-tag tokens">{totalTokens.toLocaleString()} tok</span>
          )}
        </div>
        <span className="expand-indicator">{expanded ? '▼' : '▶'}</span>
      </div>

      {expanded && (
        <div className="event-card-body">
          <div className="event-detail-grid">
            <div className="detail-item">
              <span className="detail-label">Tool</span>
              <span className="detail-value">{event.TOOL}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Toolchain</span>
              <span className="detail-value mono">{event.TOOLCHAIN}</span>
            </div>
            {event.request_id && (
              <div className="detail-item">
                <span className="detail-label">Request ID</span>
                <span className="detail-value mono">{event.request_id}</span>
              </div>
            )}
            {event.agent_name && (
              <div className="detail-item">
                <span className="detail-label">Agent</span>
                <span className="detail-value">{event.agent_name}</span>
              </div>
            )}
          </div>

          {detailKeys.length > 0 && (
            <div className="event-details">
              {detailKeys.map(key => {
                const value = event[key];
                const isObject = typeof value === 'object' && value !== null;
                return (
                  <div key={key} className="detail-block">
                    <span className="detail-block-label">{key}</span>
                    {isObject || (typeof value === 'string' && value.length > 100) ? (
                      <pre className="detail-block-value">{formatJson(value)}</pre>
                    ) : (
                      <span className="detail-block-value inline">
                        {String(value)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
