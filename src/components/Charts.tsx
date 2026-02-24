import type { LogEvent } from '../types';
import { getTotalTokens, getResponseTime, groupByToolchain } from '../data/logData';

function BarChart({
  data,
  title,
  unit,
  colorMap,
}: {
  data: { label: string; value: number }[];
  title: string;
  unit?: string;
  colorMap?: Record<string, string>;
}) {
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <div className="bar-chart">
        {data.map(d => (
          <div key={d.label} className="bar-row">
            <span className="bar-label">{d.label}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${(d.value / max) * 100}%`,
                  background: colorMap?.[d.label] ?? '#6366f1',
                }}
              />
            </div>
            <span className="bar-value">
              {d.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              {unit ? ` ${unit}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({
  data,
  title,
}: {
  data: { label: string; value: number; color: string }[];
  title: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return null;

  let cumulative = 0;
  const segments = data.map(d => {
    const start = (cumulative / total) * 360;
    cumulative += d.value;
    const end = (cumulative / total) * 360;
    return { ...d, start, end };
  });

  const size = 120;
  const center = size / 2;
  const radius = 48;
  const innerRadius = 30;

  function polarToCartesian(angle: number, r: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: center + r * Math.cos(rad), y: center + r * Math.sin(rad) };
  }

  function describeArc(startAngle: number, endAngle: number, r: number, ir: number) {
    const span = endAngle - startAngle;
    if (span >= 359.99) {
      const mid = startAngle + 180;
      return (
        describeArc(startAngle, mid, r, ir) + ' ' + describeArc(mid, endAngle - 0.01, r, ir)
      );
    }
    const outerStart = polarToCartesian(startAngle, r);
    const outerEnd = polarToCartesian(endAngle, r);
    const innerEnd = polarToCartesian(endAngle, ir);
    const innerStart = polarToCartesian(startAngle, ir);
    const largeArc = span > 180 ? 1 : 0;
    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${ir} ${ir} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
      'Z',
    ].join(' ');
  }

  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <div className="donut-container">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {segments.map((seg, i) => (
            <path key={i} d={describeArc(seg.start, seg.end, radius, innerRadius)} fill={seg.color} />
          ))}
          <text x={center} y={center} textAnchor="middle" dominantBaseline="middle" className="donut-center-text">
            {total}
          </text>
        </svg>
        <div className="donut-legend">
          {data.map(d => (
            <div key={d.label} className="legend-item">
              <span className="legend-color" style={{ background: d.color }} />
              <span className="legend-label">{d.label}</span>
              <span className="legend-value">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

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

const TOOL_COLORS: Record<string, string> = {
  english_to_sentences: '#3b82f6',
  sentence_to_english: '#ef4444',
  pipeline_translator: '#22c55e',
};

const MODEL_COLORS: Record<string, string> = {
  'gpt-4o': '#8b5cf6',
  'gpt-4o-mini': '#f59e0b',
};

export default function Charts({ events }: { events: LogEvent[] }) {
  const toolchainGroups = groupByToolchain(events);

  // Event type distribution
  const eventCounts = new Map<string, number>();
  for (const e of events) {
    eventCounts.set(e.event, (eventCounts.get(e.event) ?? 0) + 1);
  }
  const eventDistribution = Array.from(eventCounts.entries()).map(([label, value]) => ({
    label,
    value,
    color: EVENT_COLORS[label] ?? '#6b7280',
  }));

  // Tool distribution
  const toolCounts = new Map<string, number>();
  for (const e of events) {
    toolCounts.set(e.TOOL, (toolCounts.get(e.TOOL) ?? 0) + 1);
  }
  const toolDistribution = Array.from(toolCounts.entries()).map(([label, value]) => ({
    label,
    value,
    color: TOOL_COLORS[label] ?? '#6b7280',
  }));

  // Model distribution
  const modelCounts = new Map<string, number>();
  for (const e of events) {
    if (e.agent_model) {
      modelCounts.set(e.agent_model, (modelCounts.get(e.agent_model) ?? 0) + 1);
    }
  }
  const modelDistribution = Array.from(modelCounts.entries()).map(([label, value]) => ({
    label,
    value,
    color: MODEL_COLORS[label] ?? '#6b7280',
  }));

  // Token usage by tool
  const tokensByTool = new Map<string, number>();
  for (const e of events) {
    const tokens = getTotalTokens(e);
    if (tokens > 0) {
      tokensByTool.set(e.TOOL, (tokensByTool.get(e.TOOL) ?? 0) + tokens);
    }
  }
  const tokenData = Array.from(tokensByTool.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Token usage by model
  const tokensByModel = new Map<string, number>();
  for (const e of events) {
    const tokens = getTotalTokens(e);
    if (tokens > 0 && e.agent_model) {
      tokensByModel.set(e.agent_model, (tokensByModel.get(e.agent_model) ?? 0) + tokens);
    }
  }
  const tokenByModelData = Array.from(tokensByModel.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  // Response times
  const responseTimes = events
    .filter(e => getResponseTime(e) !== null)
    .map(e => ({
      label: `#${e.lineNumber} ${e.TOOL}`,
      value: getResponseTime(e)!,
    }))
    .sort((a, b) => b.value - a.value);

  // Summary stats
  const totalTokens = events.reduce((sum, e) => sum + getTotalTokens(e), 0);
  const avgResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((sum, d) => sum + d.value, 0) / responseTimes.length
      : 0;
  const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes.map(d => d.value)) : 0;

  return (
    <div className="charts-container">
      <div className="stats-row">
        <StatCard label="Total Events" value={String(events.length)} />
        <StatCard label="Toolchains" value={String(toolchainGroups.length)} />
        <StatCard
          label="Total Tokens"
          value={totalTokens.toLocaleString()}
        />
        <StatCard
          label="Avg Response Time"
          value={`${avgResponseTime.toFixed(2)}s`}
          sub={`Max: ${maxResponseTime.toFixed(2)}s`}
        />
      </div>

      {toolchainGroups.length > 0 && (
        <div className="chart-card toolchain-summary">
          <h3>Toolchain Pipelines</h3>
          {toolchainGroups.map(group => (
            <div key={group.toolchainId} className="toolchain-row">
              <div className="toolchain-header">
                {/* <span className="toolchain-id">{group.toolchainId.slice(0, 8)}...</span> */}
                <span className="toolchain-id">{group.agent_model}</span>
                {group.source && (
                  <span className="toolchain-source">Source: "{group.source}"</span>
                )}
                {group.back_translation && (
                  <span className="toolchain-source">Back Translation: "{group.back_translation}"</span>
                )}
              </div>
              {group.finalResponse && (
                <div className="toolchain-response">{group.finalResponse}</div>
              )}
              <div className="toolchain-meta">
                <span>{group.events.length} events</span>
                {group.totalTime && <span>{group.totalTime.toFixed(2)}s</span>}
                {group.totalTokens > 0 && <span>{group.totalTokens.toLocaleString()} tokens</span>}
              </div>
              <div className="toolchain-timeline">
                {group.events.map(e => (
                  <div
                    key={e.lineNumber}
                    className="timeline-dot"
                    style={{ background: EVENT_COLORS[e.event] ?? '#6b7280' }}
                    title={`#${e.lineNumber}: ${e.event}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="charts-grid">
        <DonutChart data={eventDistribution} title="Event Distribution" />
        <DonutChart data={toolDistribution} title="Events by Tool" />
        {modelDistribution.length > 0 && (
          <DonutChart data={modelDistribution} title="Events by Model" />
        )}
      </div>

      <div className="charts-grid">
        {tokenData.length > 0 && (
          <BarChart data={tokenData} title="Tokens by Tool" unit="tok" colorMap={TOOL_COLORS} />
        )}
        {tokenByModelData.length > 0 && (
          <BarChart data={tokenByModelData} title="Tokens by Model" unit="tok" colorMap={MODEL_COLORS} />
        )}
      </div>

      {responseTimes.length > 0 && (
        <BarChart data={responseTimes} title="Response Times" unit="s" />
      )}
    </div>
  );
}
