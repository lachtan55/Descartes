export interface AIModelConfig {
  id: string;                              // exact model string for API call
  label: string;                           // display name
  provider: 'anthropic' | 'google' | 'openai';
  description: string;                     // one-line description
  envKey: string;                          // which env var key is required
  isDefault: boolean;
}

export const AI_MODELS: AIModelConfig[] = [
  // ── Anthropic ──
  {
    id: 'claude-sonnet-4-6',
    label: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    description: 'Balanced — recommended for macro analysis',
    envKey: 'ANTHROPIC_API_KEY',
    isDefault: true,
  },
  {
    id: 'claude-opus-4-7',
    label: 'Claude Opus 4.7',
    provider: 'anthropic',
    description: 'Most thorough — detailed multi-factor analysis',
    envKey: 'ANTHROPIC_API_KEY',
    isDefault: false,
  },
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Claude Haiku 4.5',
    provider: 'anthropic',
    description: 'Fastest — brief summaries',
    envKey: 'ANTHROPIC_API_KEY',
    isDefault: false,
  },
  // ── Google ──
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'Google — high-quality analysis',
    envKey: 'GEMINI_API_KEY',
    isDefault: false,
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash',
    provider: 'google',
    description: 'Google — fast, good default',
    envKey: 'GEMINI_API_KEY',
    isDefault: false,
  },
  // ── OpenAI ──
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'openai',
    description: 'OpenAI — multimodal, versatile',
    envKey: 'OPENAI_API_KEY',
    isDefault: false,
  },
  {
    id: 'gpt-4.1',
    label: 'GPT-4.1',
    provider: 'openai',
    description: 'OpenAI — latest flagship',
    envKey: 'OPENAI_API_KEY',
    isDefault: false,
  },
];

export const DEFAULT_AI_MODEL = AI_MODELS.find(m => m.isDefault)!;
export const AI_MODELS_BY_PROVIDER = AI_MODELS.reduce<Record<string, AIModelConfig[]>>(
  (acc, m) => { (acc[m.provider] ??= []).push(m); return acc; },
  {}
);
