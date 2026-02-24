import rawData from '../../data/test-1.3.jsonl?raw';
import type { LogEvent } from '../types';

export function parseLogData(): LogEvent[] {
  const lines = rawData.trim().split('\n');
  return lines.map((line, index) => {
    const parsed = JSON.parse(line) as LogEvent;
    parsed.lineNumber = index + 1;
    return parsed;
  });
}

export function getUniqueValues(events: LogEvent[], field: keyof LogEvent): string[] {
  const values = new Set<string>();
  for (const event of events) {
    const val = event[field];
    if (val !== undefined && val !== null) {
      values.add(String(val));
    }
  }
  return Array.from(values).sort();
}

export function getTotalTokens(event: LogEvent): number {
  let total = 0;
  if (event.prompt_tokens) total += event.prompt_tokens;
  if (event.completion_tokens) total += event.completion_tokens;
  if (event.total_prompt_tokens) total += event.total_prompt_tokens;
  if (event.total_completion_tokens) total += event.total_completion_tokens;
  return total;
}

export function getResponseTime(event: LogEvent): number | null {
  return event.response_time ?? event.translation_time ?? null;
}

export interface ToolchainGroup {
  toolchainId: string;
  agent_model?: string;
  events: LogEvent[];
  source?: string;
  back_translation?: string;
  finalResponse?: string;
  totalTime?: number;
  totalTokens: number;
}

export function groupByToolchain(events: LogEvent[]): ToolchainGroup[] {
  const groups = new Map<string, LogEvent[]>();
  for (const event of events) {
    const tcParts = event.TOOLCHAIN.split('/');
    const rootTc = tcParts[0];
    if (!groups.has(rootTc)) {
      groups.set(rootTc, []);
    }
    groups.get(rootTc)!.push(event);
  }

  return Array.from(groups.entries()).map(([toolchainId, evts]) => {
    const completionEvent = evts.find(e => e.event === 'translation_completed');
    let totalTokens = 0;
    let totalTime = 0;
    for (const e of evts) {
      totalTokens += getTotalTokens(e);
      const rt = getResponseTime(e);
      if (rt) totalTime = Math.max(totalTime, rt);
    }
    return {
      toolchainId,
      events: evts,
      agent_model: completionEvent?.agent_model as string | undefined,
      source: completionEvent?.source as string | undefined,
      back_translation: completionEvent?.source as string | undefined,
      finalResponse: completionEvent?.response as string | undefined,
      totalTime: completionEvent?.translation_time as number | undefined ?? totalTime,
      totalTokens,
    };
  });
}
