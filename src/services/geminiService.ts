export interface RelatedArticle {
  title: string;
  source: string;
  url: string;
  snippet: string;
}

export async function findRelatedCoverage(articleTitle: string): Promise<RelatedArticle[]> {
  try {
    // We've switched to a free Search API in the backend that doesn't 
    // require an API key for news searching.
    const response = await fetch(`/api/search-news?q=${encodeURIComponent(articleTitle)}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const results = await response.json();
    return results;
  } catch (error) {
    console.error("Error finding related coverage:", error);
    return [];
  }
}
