import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = resolve(__dirname, '../../../docs/system-prompt.md');

export const systemPrompt = readFileSync(PROMPT_PATH, 'utf8');
