import { vi } from 'vitest';

// Every test uses synthetic environment values; never load a developer's .env file.
vi.mock('dotenv', () => ({ default: { config: vi.fn(() => ({ parsed: {} })) } }));
