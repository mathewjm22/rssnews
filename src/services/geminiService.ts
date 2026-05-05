import { parseFeedXml } from '../lib/xmlFeedParser';

export interface RelatedArticle {
  title: string;
  source: string;
  url: string;
  snippet: string;
}

export async function findRelatedCoverage(articleTitle: string): Promise<RelatedArticle[]> {
  try {
    // Replace this URL with YOUR actual Cloudflare Worker URL
    const WORKER_URL = 'https://chanfana-openapi-template.sweet-dream-0ed6.workers.dev/';
    
    const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(articleTitle)}+when:7d&hl=en-US&gl=US&ceid=US:en`;
    const proxyUrl = `${WORKER_URL}/?url=${encodeURIComponent(searchUrl)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`Worker error! status: ${response.status}`);
    
    // Cloudflare worker returns raw XML text instead of JSON
    const xmlText = await response.text();
    const items = parseFeedXml(xmlText);
    
    return items.slice(0, 5).map(item => ({
      title: item.title || '',
      source: item.source || 'News Source',
      url: item.link || '',
      snippet: item.contentSnippet || item.content || ''
    }));
  } catch (error) {
    console.error("Error finding related coverage:", error);
    return
