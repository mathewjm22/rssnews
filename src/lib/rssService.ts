import Parser from 'rss-parser';
import { Article, FeedSource } from '../types';

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
      ['content:encoded', 'contentEncoded'],
      ['enclosure', 'enclosure'],
      ['source', 'source'],
    ],
  },
});

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
      feed = await parser.parseString(data.contents);
    }
    
    if (!feed || !feed.items) return [];

    return feed.items.map((item: any) => {
      // Content extraction - rss-parser often puts the full content in different spots
      const content = item.contentEncoded || item.content || item.description || '';
      const snippet = item.contentSnippet || content.replace(/<[^>]*>?/gm, '').substring(0, 200) || '';

      // Image selection logic
      let thumbnail = '';
      
      // Try enclosure
      if (item.enclosure?.url && item.enclosure?.type?.startsWith('image/')) {
        thumbnail = item.enclosure.url;
      }
      
      // Try media content/thumbnail from our custom fields
      if (!thumbnail && item.mediaThumbnail?.$.url) {
        thumbnail = item.mediaThumbnail.$.url;
      }

      if (!thumbnail && item.mediaContent) {
        // media:content can be an array
        const media = Array.isArray(item.mediaContent) ? item.mediaContent[0] : item.mediaContent;
        if (media?.$?.url && (!media.$.type || media.$.type.startsWith('image/'))) {
          thumbnail = media.$.url;
        }
      }

      // Fallback: extract from content
      if (!thumbnail) {
        const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
        if (imgMatch) thumbnail = imgMatch[1];
      }

      return {
        id: item.guid || item.link || Math.random().toString(36).substr(2, 9),
        title: item.title || 'Untitled',
        link: item.link || '',
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        content: content,
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
