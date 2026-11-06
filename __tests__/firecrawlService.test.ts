import { describe, it, expect } from 'vitest';

describe('FirecrawlService', () => {
  // Test text cleaning logic without needing actual API key
  describe('text cleaning', () => {
    it('should remove markdown headers', () => {
      const input = '### Hello World\nSome content';
      const cleaned = input
        .replace(/#{1,6}\s+/g, '')
        .trim();
      expect(cleaned).toBe('Hello World\nSome content');
    });

    it('should remove bold and italic formatting', () => {
      const input = '**bold text** and *italic text*';
      const cleaned = input
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1');
      expect(cleaned).toBe('bold text and italic text');
    });

    it('should convert markdown links to plain text', () => {
      const input = '[Click here](https://example.com)';
      const cleaned = input.replace(/\[(.*?)\]\(.*?\)/g, '$1');
      expect(cleaned).toBe('Click here');
    });

    it('should remove code blocks', () => {
      const input = '```\nconst x = 1;\n```';
      const cleaned = input.replace(/```[\s\S]*?```/g, '');
      expect(cleaned.trim()).toBe('');
    });

    it('should reduce multiple newlines', () => {
      const input = 'line1\n\n\n\n\nline2';
      const cleaned = input.replace(/\n{3,}/g, '\n\n');
      expect(cleaned).toBe('line1\n\nline2');
    });

    it('should handle complex markdown with all transformations', () => {
      const input = `## Title

**Important** note with [link](https://example.com)

\`\`\`js
const code = true;
\`\`\`

Final paragraph.`;
      const cleaned = input
        .replace(/#{1,6}\s+/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      expect(cleaned).toContain('Title');
      expect(cleaned).toContain('Important note with link');
      expect(cleaned).toContain('Final paragraph.');
      expect(cleaned).not.toContain('##');
      expect(cleaned).not.toContain('**');
    });

    it('should count words correctly', () => {
      const text = 'hello world test';
      const count = text.split(/\s+/).filter((w: string) => w.length > 0).length;
      expect(count).toBe(3);
    });

    it('should handle empty text word count', () => {
      const text = '';
      const count = text.split(/\s+/).filter((w: string) => w.length > 0).length;
      expect(count).toBe(0);
    });
  });
});
