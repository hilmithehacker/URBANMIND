import axios from 'axios';
import { NormalizedPaper, EnrichmentResult } from '../literature.types';

const SEMANTIC_SCHOLAR_BASE = process.env.SEMANTIC_SCHOLAR_BASE_URL || 'https://api.semanticscholar.org/graph/v1';
const API_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY;

let lastRequestTime = 0;
const RATE_LIMIT_MS = 1050; // Slightly over 1s to be safe

async function throttle() {
  const now = Date.now();
  const diff = now - lastRequestTime;
  if (diff < RATE_LIMIT_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - diff));
  }
  lastRequestTime = Date.now();
}

export async function enrichWithSemanticScholar(paper: NormalizedPaper): Promise<EnrichmentResult> {
  try {
    await throttle();
    let endpoint = '';
    if (paper.doi) {
      endpoint = `${SEMANTIC_SCHOLAR_BASE}/paper/DOI:${paper.doi}`;
    } else {
      const searchRes = await axios.get(`${SEMANTIC_SCHOLAR_BASE}/paper/search`, {
        params: { query: paper.title, limit: 1, fields: 'paperId,title' },
        headers: API_KEY ? { 'x-api-key': API_KEY } : {},
        timeout: 8000
      });
      if (searchRes.data.data && searchRes.data.data.length > 0) {
        endpoint = `${SEMANTIC_SCHOLAR_BASE}/paper/${searchRes.data.data[0].paperId}`;
      } else {
        return { success: false, data: {}, error: 'Not found in Semantic Scholar' };
      }
    }

    const response = await axios.get(endpoint, {
      params: { fields: 'abstract,citationCount,influentialCitationCount,openAccessPdf,fieldsOfStudy' },
      headers: API_KEY ? { 'x-api-key': API_KEY } : {},
      timeout: 8000
    });

    const data = response.data;
    const enriched: Partial<NormalizedPaper> = {
      providerSources: [...paper.providerSources, 'Semantic Scholar']
    };

    if (!paper.abstract && data.abstract) enriched.abstract = data.abstract;
    if (!paper.citationCount && data.citationCount != null) enriched.citationCount = data.citationCount;
    if (!paper.influentialCitationCount && data.influentialCitationCount != null) {
      enriched.influentialCitationCount = data.influentialCitationCount;
    }
    if (!paper.pdfUrl && data.openAccessPdf?.url) enriched.pdfUrl = data.openAccessPdf.url;
    if (data.fieldsOfStudy?.length) enriched.fieldsOfStudy = [...new Set([...paper.fieldsOfStudy, ...data.fieldsOfStudy])];

    return { success: true, data: enriched };
  } catch (error: any) {
    return { success: false, data: {}, error: error.message };
  }
}
