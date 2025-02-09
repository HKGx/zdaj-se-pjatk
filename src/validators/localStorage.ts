import { z } from 'zod';

import { LocalStorageConfig } from 'hooks/useLocalStorageState/useLocalStorageState';

export const OpenAiToken = {
  key: 'openai-token',
  validator: z.string(),
  defaultValue: null,
} satisfies LocalStorageConfig;

export const AiBaseUrl = {
  key: 'ai-base-url',
  validator: z.string(),
  defaultValue: 'https://api.openai.com/v1' as const,
} satisfies LocalStorageConfig;

export const OpenAiModel = {
  key: 'openai-model',
  validator: z
    .string(),
  defaultValue: 'gpt-4o' as const,
} satisfies LocalStorageConfig;
