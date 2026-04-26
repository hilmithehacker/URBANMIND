import axios from 'axios';
import { NormalizedPaper, EnrichmentResult } from '../literature.types';

const CROSSREF_BASE = process.env.CROSSREF_BASE_URL || 'https://api.crossref.org';
const POLITE_EMAIL = process.env.OPENALEX_EMAIL || 'admin@urbanmind.local';

export async function enrichWithCrossref(paper: NormalizedPaper): Promise<EnrichmentResult> {
  if (!paper.doi) return { success: false, data: {}, error: 'No DOI provided' };
  
  try {
    const response = await axios.get(`${CROSSREF_BASE}/works/${paper.doi}`, {
      params: { mailto: POLITE_EMAIL },
      timeout: 8000
    });
    
    const msg = response.data.message;
    if (!msg) return { success: false, data: {} };

    const enriched: Partial<NormalizedPaper> = {
      providerSources: [...paper.providerSources, 'Crossref']
    };

    if (!paper.citationCount && msg['is-referenced-by-count'] != null) {
      enriched.citationCount = msg['is-referenced-by-count'];
    }
    if (!paper.url && msg.URL) enriched.url = msg.URL;
    if (!paper.journal && msg['container-title']?.[0]) enriched.journal = msg['container-title'][0];

    return { success: true, data: enriched };
  } catch (error: any) {
    return { success: false, data: {}, error: error.message };
  }
}
