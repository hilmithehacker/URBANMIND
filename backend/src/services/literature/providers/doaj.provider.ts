import axios from 'axios';
import { NormalizedPaper, EnrichmentResult } from '../literature.types';

const DOAJ_BASE = process.env.DOAJ_BASE_URL || 'https://doaj.org/api/v2';

export async function enrichWithDoaj(paper: NormalizedPaper): Promise<EnrichmentResult> {
  try {
    const query = paper.doi ? `doi:"${paper.doi}"` : `title:"${paper.title}"`;
    const response = await axios.get(`${DOAJ_BASE}/search/articles/${encodeURIComponent(query)}`, {
      params: { pageSize: 1 },
      timeout: 8000
    });

    const results = response.data.results;
    if (!results || results.length === 0) return { success: false, data: {} };

    const data = results[0].bibjson;
    const enriched: Partial<NormalizedPaper> = {
      providerSources: [...paper.providerSources, 'DOAJ'],
      isOpenAccess: true // DOAJ is directory of open access journals
    };

    if (!paper.abstract && data.abstract) enriched.abstract = data.abstract;
    if (!paper.url && data.link?.length > 0) {
      const fullText = data.link.find((l: any) => l.type === 'fulltext');
      if (fullText) enriched.url = fullText.url;
    }

    return { success: true, data: enriched };
  } catch (error: any) {
    return { success: false, data: {}, error: error.message };
  }
}
