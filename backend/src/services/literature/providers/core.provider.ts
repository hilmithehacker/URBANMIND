import axios from 'axios';
import { NormalizedPaper, EnrichmentResult } from '../literature.types';

const CORE_BASE = process.env.CORE_BASE_URL || 'https://api.core.ac.uk/v3';
const API_KEY = process.env.CORE_API_KEY;

export async function enrichWithCore(paper: NormalizedPaper): Promise<EnrichmentResult> {
  if (!API_KEY) return { success: false, data: {}, error: 'CORE API key missing' };

  try {
    const query = paper.doi ? `doi:"${paper.doi}"` : `title:"${paper.title}"`;
    const response = await axios.get(`${CORE_BASE}/search/works`, {
      params: { q: query, limit: 1 },
      headers: { Authorization: `Bearer ${API_KEY}` },
      timeout: 8000
    });

    const results = response.data.results;
    if (!results || results.length === 0) return { success: false, data: {} };

    const data = results[0];
    const enriched: Partial<NormalizedPaper> = {
      providerSources: [...paper.providerSources, 'CORE']
    };

    if (!paper.abstract && data.abstract) enriched.abstract = data.abstract;
    if (!paper.pdfUrl && data.downloadUrl) enriched.pdfUrl = data.downloadUrl;
    if (!paper.url && data.sourceFulltextUrls?.length > 0) enriched.url = data.sourceFulltextUrls[0];
    
    return { success: true, data: enriched };
  } catch (error: any) {
    return { success: false, data: {}, error: error.message };
  }
}
