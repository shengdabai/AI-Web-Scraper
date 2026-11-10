import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

function render(data: unknown, type = 'text') {
  const html = readFileSync(new URL('../examples/firecrawl-demo.html', import.meta.url), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  if (!script) throw new Error('Demo script not found');
  const elements = Object.fromEntries(['loading', 'result', 'stats', 'textContent'].map((id) => [
    id, { style: {}, innerHTML: '', textContent: '' },
  ]));
  runInNewContext(`${script}\nshowResult(data, type);`, {
    document: { getElementById: (id: string) => elements[id], addEventListener() {} }, data, type,
  });
  return elements;
}

describe('demo response rendering', () => {
  it.each(['<img src=x onerror=alert(1)>', { value: '<svg onload=alert(1)>' }])(
    'does not interpolate a nonnumeric word count into HTML: %j', (wordCount) => {
      const elements = render({ wordCount, text: '<script>alert(1)</script>' });
      expect(elements.stats?.innerHTML).not.toMatch(/<img|<svg/);
      expect(elements.stats?.innerHTML).toContain('>0</div>');
      expect(elements.textContent?.textContent).toBe('<script>alert(1)</script>');
    },
  );

  it('preserves numeric statistics and treats scraped HTML as text', () => {
    expect(render({ wordCount: 42, text: 'hello' }).stats?.innerHTML).toContain('>42</div>');
    const elements = render({ data: { html: '<img src=x onerror=alert(1)>' } }, 'scrape');
    expect(elements.textContent?.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
