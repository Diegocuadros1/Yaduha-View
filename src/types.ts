export interface LogEvent {
  lineNumber: number;
  TOOL: string;
  TOOLCHAIN: string;
  event: string;
  agent_model?: string;
  agent_name?: string;
  functionality?: string;
  request_id?: string;
  api_call_index?: number;
  api_calls?: number;
  messages?: Array<{ role: string; content: string }>;
  tools?: unknown[];
  response?: unknown;
  parsed?: string;
  content?: string;
  sentence?: string;
  source?: string;
  response_time?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_prompt_tokens?: number;
  total_completion_tokens?: number;
  translation_time?: number;
  back_translation_time?: number;
  back_translation_prompt_tokens?: number;
  back_translation_completion_tokens?: number;
  back_translation_agent_name?: string;
  back_translation_agent_model?: string;
  [key: string]: unknown;
}

export type SortField = 'lineNumber' | 'event' | 'TOOL' | 'response_time' | 'tokens';
export type SortDirection = 'asc' | 'desc';

export interface Filters {
  tools: string[];
  events: string[];
  models: string[];
  toolchains: string[];
  functionality: string[];
  searchText: string;
}
