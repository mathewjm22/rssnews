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

export const FALLBACK_ID_CONTENT_LENGTH = 40;
export const FALLBACK_PUB_DATE = new Date(0).toISOString();
export const SNIPPET_MAX_LENGTH = 200;

export function createStableFeedId(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return `generated:${(hash >>> 0).toString(36)}`;
}

export function extractImageUrlFromContent(content: string): string {
  const imageMatch = content.match(/<img[^>]+src="([^">]+)"/i);
  return imageMatch?.[1] ?? '';
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
  let url = '';
  const enclosure = getElements(item, 'enclosure')[0];
  const enclosureUrl = enclosure?.getAttribute('url')?.trim();
  const enclosureType = enclosure?.getAttribute('type')?.trim();
  
  if (enclosureUrl && (!enclosureType || enclosureType.startsWith('image/'))) {
    url = enclosureUrl;
  } else {
    const thumbnail = getElements(item, 'media:thumbnail')[0];
    const thumbnailUrl = thumbnail?.getAttribute('url')?.trim();
    if (thumbnailUrl) {
      url = thumbnailUrl;
    } else {
      for (const mediaContent of getElements(item, 'media:content')) {
        const mediaUrl = mediaContent.getAttribute('url')?.trim();
        const mediaType = mediaContent.getAttribute('type')?.trim();
        if (mediaUrl && (!mediaType || mediaType.startsWith('image/'))) {
          url = mediaUrl;
          break;
        }
      }
    }
  }

  if (!url) url = extractImageUrlFromContent(content);

  // FIX FOR CNN: Upgrade insecure HTTP images to HTTPS so the browser doesn't block them
  if (url && url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  }

  return url;
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
    const title = getFirstText(item, ['title']) || 'Untitled';
    const content =
      getFirstText(item, ['content:encoded', 'content', 'description', 'summary']) || '';
    const contentSnippet =
      getFirstText(item, ['contentSnippet', 'description', 'summary']) ||
      toPlainText(content).substring(0, SNIPPET_MAX_LENGTH);
    const link = getLink(item);
    const pubDate = getFirstText(item, ['pubDate', 'published', 'updated']) || FALLBACK_PUB_DATE;
    const guid =
      getFirstText(item, ['guid', 'id']) ||
      link ||
      createStableFeedId(`${title}|${link}|${pubDate}|${contentSnippet}`);

    return {
      guid,
      title,
      link,
      pubDate,
      content,
      contentSnippet,
      author: getFirstText(item, ['creator', 'dc:creator', 'author', 'name']),
      thumbnail: getImageUrl(item, content),
      source: getFirstText(item, ['source']),
    };
  });
}
