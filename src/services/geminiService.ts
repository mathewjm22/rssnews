import Parser from 'rss-parser';

const parser = new Parser();

export interface RelatedArticle {
  title: string;
  source: string;
  url: string;
  snippet: string;
}

export async function findRelatedCoverage(articleTitle: string): Promise<RelatedArticle[]> {
  try {
    // Attempt local API first
    try {
      const response = await fetch(`/api/search-news?q=${encodeURIComponent(articleTitle)}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.log("Local search API not found, falling back to client-side CORS search.");
    }

    // Fallback for static hosting (GitHub Pages)
    // Use Google News RSS Search via AllOrigins proxy
    const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(articleTitle)}+when:7d&hl=en-US&gl=US&ceid=US:en`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(searchUrl)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`Proxy error! status: ${response.status}`);
    
    const data = await response.json();
    const feed = await parser.parseString(data.contents);
    
    return (feed.items || []).slice(0, 5).map(item => ({
      title: item.title || '',
      source: (item as any).source || 'News Source',
      url: item.link || '',
      snippet: item.contentSnippet || item.content || ''
    }));
  } catch (error) {
    console.error("Error finding related coverage:", error);
    return [];
  }
}
