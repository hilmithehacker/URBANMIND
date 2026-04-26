import axios from 'axios';
import { NormalizedPaper, LiteratureSearchParams, ProviderResult } from '../literature.types';

const OPENALEX_BASE = process.env.OPENALEX_BASE_URL || 'https://api.openalex.org';
const POLITE_EMAIL = process.env.OPENALEX_EMAIL || 'admin@urbanmind.local';

function reconstructAbstract(invertedIndex: Record<string, number[]>): string {
  if (!invertedIndex) return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.join(' ').trim();
}

export async function searchOpenAlex(params: LiteratureSearchParams): Promise<ProviderResult> {
  try {
    const filters = ['type:article|proceedings-article'];
    if (params.yearStart) filters.push(`publication_year:>${params.yearStart - 1}`);
    if (params.yearEnd) filters.push(`publication_year:<${params.yearEnd + 1}`);
    if (params.openAccessOnly) filters.push('is_oa:true');

    const response = await axios.get(`${OPENALEX_BASE}/works`, {
      params: {
        search: params.query,
        filter: filters.join(','),
        per_page: params.limit || 10,
        sort: 'relevance_score:desc',
        mailto: POLITE_EMAIL
      },
      timeout: 15000
    });

    const works = response.data.results || [];
    
    const data: NormalizedPaper[] = works.map((w: any) => ({
      id: w.id,
      title: w.title || '',
      authors: w.authorships?.map((a: any) => a.author?.display_name).filter(Boolean) || [],
      year: w.publication_year || null,
      source: 'OpenAlex',
      journal: w.primary_location?.source?.display_name || '',
      abstract: w.abstract_inverted_index ? reconstructAbstract(w.abstract_inverted_index) : '',
      doi: w.doi ? w.doi.replace('https://doi.org/', '') : '',
      url: w.primary_location?.landing_page_url || w.doi || '',
      pdfUrl: w.open_access?.oa_url || '',
      citationCount: w.cited_by_count ?? null,
      influentialCitationCount: null,
      isOpenAccess: w.open_access?.is_oa || false,
      fieldsOfStudy: w.concepts?.map((c: any) => c.display_name) || [],
      keywords: [],
      providerSources: ['OpenAlex'],
      relevanceScore: w.relevance_score || null,
      notes: '',
      tags: []
    }));

    return { success: true, data };
  } catch (error: any) {
    console.error('[OpenAlex Error]', error.message);
    return { success: false, data: [], error: error.message };
  }
}
