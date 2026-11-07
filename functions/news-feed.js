function decodeXml(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, value) => {
      if (value[0] === '#') {
        const codePoint = value[1].toLowerCase() === 'x'
          ? Number.parseInt(value.slice(2), 16)
          : Number.parseInt(value.slice(1), 10);
        const isValidCodePoint = Number.isFinite(codePoint)
          && codePoint >= 0
          && codePoint <= 0x10ffff
          && !(codePoint >= 0xd800 && codePoint <= 0xdfff);
        return isValidCodePoint ? String.fromCodePoint(codePoint) : entity;
      }

      return {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: '\'',
      }[value.toLowerCase()] ?? entity;
    })
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTag(item, tag) {
  const match = item.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function parseGoogleNewsRss(xml) {
  const items = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];

  return items.flatMap((item) => {
    let title = getTag(item, 'title');
    const sourceUrl = getTag(item, 'link');
    const summary = getTag(item, 'description').slice(0, 400);
    let sourceName = getTag(item, 'source');
    const publishedAtValue = getTag(item, 'pubDate');
    const publishedAt = publishedAtValue ? new Date(publishedAtValue) : null;

    try {
      if (new URL(sourceUrl).protocol !== 'https:') {
        return [];
      }
    } catch {
      return [];
    }

    if (!sourceName) {
      const sourceSeparator = title.lastIndexOf(' - ');
      if (sourceSeparator > 0) {
        sourceName = title.slice(sourceSeparator + 3).trim();
        title = title.slice(0, sourceSeparator).trim();
      }
    }

    if (!title) {
      return [];
    }

    return [{
      title,
      summary,
      sourceName: sourceName || 'Google Notícias',
      sourceUrl,
      publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
    }];
  });
}

module.exports = { parseGoogleNewsRss };
