import axios from 'axios';
import { NormalizedPaper, EnrichmentResult } from '../literature.types';

const ARXIV_BASE = process.env.ARXIV_BASE_URL || 'http://export.arxiv.org/api/query';

export async function enrichWithArxiv(paper: NormalizedPaper): Promise<EnrichmentResult> {
  try {
    const query = paper.title.split(' ').slice(0, 5).join('+'); // Arxiv search needs short exact matches or words
    const response = await axios.get(ARXIV_BASE, {
      params: { search_query: `ti:"${query}"`, start: 0, max_results: 1 },
      timeout: 8000
    });

    const data = response.data as string;
    // Simple XML parsing without heavy dependencies
    if (!data.includes('<entry>')) return { success: false, data: {} };
    
    const enriched: Partial<NormalizedPaper> = {
      providerSources: [...paper.providerSources, 'arXiv'],
      isOpenAccess: true
    };

    if (!paper.abstract) {
      const abstractMatch = data.match(/<summary>([\s\S]*?)<\/summary>/);
      if (abstractMatch) enriched.abstract = abstractMatch[1].trim();
    }
    
    if (!paper.pdfUrl) {
      const pdfMatch = data.match(/<link title="pdf" href="(.*?)"/);
      if (pdfMatch) enriched.pdfUrl = pdfMatch[1];
    }

    return { success: true, data: enriched };
  } catch (error: any) {
    return { success: false, data: {}, error: error.message };
  }
}
