const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { parseGoogleNewsRss } = require('./news-feed');

describe('parseGoogleNewsRss', () => {
  it('parses article metadata, XML entities, and CDATA', () => {
    const xml = `
      <rss><channel><item>
        <title><![CDATA[Osasco &amp; região - Jornal Local]]></title>
        <link>https://example.com/noticia</link>
        <description>&lt;p&gt;Resumo da notícia &amp; contexto&lt;/p&gt;</description>
        <pubDate>Sat, 07 Nov 2026 10:00:00 GMT</pubDate>
      </item></channel></rss>`;

    assert.deepEqual(parseGoogleNewsRss(xml), [{
      title: 'Osasco & região',
      summary: 'Resumo da notícia & contexto',
      sourceName: 'Jornal Local',
      sourceUrl: 'https://example.com/noticia',
      publishedAt: new Date('Sat, 07 Nov 2026 10:00:00 GMT'),
    }]);
  });

  it('uses the publisher tag and skips entries without a secure URL or title', () => {
    const xml = `
      <rss><channel>
        <item>
          <title>Notícia de Osasco</title>
          <link>https://example.com/noticia</link>
          <source url="https://example.com">Portal da Cidade</source>
        </item>
        <item><title>Link inseguro</title><link>http://example.com/noticia</link></item>
        <item><link>https://example.com/sem-titulo</link></item>
      </channel></rss>`;

    assert.deepEqual(parseGoogleNewsRss(xml), [{
      title: 'Notícia de Osasco',
      summary: '',
      sourceName: 'Portal da Cidade',
      sourceUrl: 'https://example.com/noticia',
      publishedAt: null,
    }]);
  });
});
