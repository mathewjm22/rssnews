import { Article, FeedSource } from '../types';
import {
  extractImageUrlFromContent,
  FALLBACK_ID_CONTENT_LENGTH,
  FALLBACK_PUB_DATE,
  parseFeedXml,
  SNIPPET_MAX_LENGTH,
  toPlainText,
} from './xmlFeedParser';

interface FeedItem {
  guid?: string;
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
  contentEncoded?: string;
  content?: string;
  description?: string;
  contentSnippet?: string;
  creator?: string;
  author?: string;
  thumbnail?: string;
  enclosure?: {
    url?: string;
    type?: string;
  };
  mediaThumbnail?: {
    $?: {
      url?: string;
    };
  };
  mediaContent?:
    | {
        $?: {
          url?: string;
          type?: string;
        };
      }
    | Array<{
        $?: {
          url?: string;
          type?: string;
        };
      }>;
}

export async function fetchRSS(source: FeedSource): Promise<Article[]> {
  try {
    let feed;
    
    // Attempt to use local API first (works in Dev and Full-stack hosting)
    try {
      const response = await fetch(`/api/rss?url=${encodeURIComponent(source.url)}`);
      if (response.ok) {
        feed = await response.json();
      }
    } catch (e) {
      console.log("Local API not found, falling back to CORS proxy for static hosting.");
    }

    // Fallback: If local API failed or we are on static hosting (like GitHub Pages)
    if (!feed) {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(source.url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error(`Proxy error! status: ${response.status}`);
      const data = await response.json();
      feed = { items: parseFeedXml(data.contents) };
    }
    
    if (!feed || !feed.items) return [];

    return (feed.items as FeedItem[]).map(item => {
      const content = item.contentEncoded || item.content || item.description || '';
      const snippet = item.contentSnippet || toPlainText(content).substring(0, SNIPPET_MAX_LENGTH) || '';

      let thumbnail = item.thumbnail || '';

      if (!thumbnail && item.enclosure?.url && item.enclosure?.type?.startsWith('image/')) {
        thumbnail = item.enclosure.url;
      }

      if (!thumbnail && item.mediaThumbnail?.$.url) {
        thumbnail = item.mediaThumbnail.$.url;
      }

      if (!thumbnail && item.mediaContent) {
        const media = Array.isArray(item.mediaContent) ? item.mediaContent[0] : item.mediaContent;
        if (media?.$?.url && (!media.$.type || media.$.type.startsWith('image/'))) {
          thumbnail = media.$.url;
        }
      }

      if (!thumbnail) {
        thumbnail = extractImageUrlFromContent(content);
      }

      return {
        id:
          item.guid ||
          item.link ||
          `${source.id}:${item.pubDate || item.isoDate || FALLBACK_PUB_DATE}:${item.title || content.substring(0, FALLBACK_ID_CONTENT_LENGTH)}`,
        title: item.title || 'Untitled',
        link: item.link || '',
        pubDate: item.pubDate || item.isoDate || FALLBACK_PUB_DATE,
        content,
        contentSnippet: snippet,
        author: item.creator || item.author || '',
        thumbnail,
        feedSourceId: source.id,
        feedSourceName: source.name,
        category: source.category,
      };
    });
  } catch (error) {
    console.error(`Error fetching ${source.name}:`, error);
    return [];
  }
}
