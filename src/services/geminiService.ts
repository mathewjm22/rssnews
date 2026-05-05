import { parseFeedXml } from '../lib/xmlFeedParser';

export interface RelatedArticle {
  title: string;
  source: string;
  url: string;
  snippet: string;
}

export async function findRelatedCoverage(articleTitle: string): Promise<RelatedArticle
    
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
    return [];
  }
}
