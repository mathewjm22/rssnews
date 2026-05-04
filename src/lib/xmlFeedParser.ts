export interface ParsedFeedItem {
  guid: string;
  title: string;
  link: string;
  pubDate: string;
  content: string;
  contentSnippet: string;
  author: string;
  thumbnail: string;
  source: string;
}

function getElements(parent: Element | Document, tagName: string): Element[] {
  const exactMatches = Array.from(parent.getElementsByTagName(tagName));
  if (exactMatches.length > 0) return exactMatches;

  const localName = tagName.includes(':') ? tagName.split(':').pop()! : tagName;
  return Array.from(parent.getElementsByTagName('*')).filter(
    element => element.localName === localName,
  );
}

function getFirstText(parent: Element | Document, tagNames: string[]): string {
  for (const tagName of tagNames) {
    const match = getElements(parent, tagName)[0];
    const value = match?.textContent?.trim();
    if (value) return value;
  }

  return '';
}

function getLink(item: Element): string {
  for (const linkElement of getElements(item, 'link')) {
    const href = linkElement.getAttribute('href')?.trim();
    if (href) return href;

    const value = linkElement.textContent?.trim();
    if (value) return value;
  }

  return '';
}

function getImageUrl(item: Element, content: string): string {
  const enclosure = getElements(item, 'enclosure')[0];
  const enclosureUrl = enclosure?.getAttribute('url')?.trim();
  const enclosureType = enclosure?.getAttribute('type')?.trim();
  if (enclosureUrl && (!enclosureType || enclosureType.startsWith('image/'))) {
    return enclosureUrl;
  }

  const thumbnail = getElements(item, 'media:thumbnail')[0];
  const thumbnailUrl = thumbnail?.getAttribute('url')?.trim();
  if (thumbnailUrl) return thumbnailUrl;

  for (const mediaContent of getElements(item, 'media:content')) {
    const mediaUrl = mediaContent.getAttribute('url')?.trim();
    const mediaType = mediaContent.getAttribute('type')?.trim();
    if (mediaUrl && (!mediaType || mediaType.startsWith('image/'))) {
      return mediaUrl;
    }
  }

  const imageMatch = content.match(/<img[^>]+src="([^">]+)"/i);
  return imageMatch?.[1] ?? '';
}

export function toPlainText(value: string): string {
  if (!value) return '';

  const document = new DOMParser().parseFromString(value, 'text/html');
  return document.body.textContent?.trim() ?? '';
}

export function parseFeedXml(xml: string): ParsedFeedItem[] {
  const document = new DOMParser().parseFromString(xml, 'text/xml');
  if (document.querySelector('parsererror')) {
    throw new Error('Failed to parse feed XML');
  }

  return Array.from(document.querySelectorAll('item, entry')).map(item => {
    const content =
      getFirstText(item, ['content:encoded', 'content', 'description', 'summary']) || '';
    const contentSnippet =
      getFirstText(item, ['contentSnippet', 'description', 'summary']) ||
      toPlainText(content).substring(0, 200);
    const link = getLink(item);

    return {
      guid: getFirstText(item, ['guid', 'id']) || link,
      title: getFirstText(item, ['title']) || 'Untitled',
      link,
      pubDate: getFirstText(item, ['pubDate', 'published', 'updated']) || new Date().toISOString(),
      content,
      contentSnippet,
      author: getFirstText(item, ['creator', 'dc:creator', 'author', 'name']),
      thumbnail: getImageUrl(item, content),
      source: getFirstText(item, ['source']),
    };
  });
}
