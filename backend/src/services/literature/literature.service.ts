import { LiteratureSearchParams, NormalizedPaper } from './literature.types';
import { searchOpenAlex } from './providers/openalex.provider';
import { enrichWithCrossref } from './providers/crossref.provider';
import { enrichWithSemanticScholar } from './providers/semanticScholar.provider';
import { enrichWithCore } from './providers/core.provider';
import { enrichWithDoaj } from './providers/doaj.provider';
import { enrichWithArxiv } from './providers/arxiv.provider';
import { mergePaperMetadata } from './mergePaperMetadata';
import { deduplicatePapers } from './deduplicatePapers';

export class LiteratureService {
  async search(params: LiteratureSearchParams): Promise<NormalizedPaper[]> {
    // 1. Primary search with OpenAlex
    const res = await searchOpenAlex(params);
    if (!res.success) throw new Error(res.error || 'Failed to search OpenAlex');
    
    // 2. Deduplicate
    return deduplicatePapers(res.data);
  }

  async enrich(paper: NormalizedPaper): Promise<NormalizedPaper> {
    let currentPaper = { ...paper };
    
    // Enrich with providers concurrently
    const enrichmentPromises = [
      enrichWithCrossref(currentPaper),
      enrichWithSemanticScholar(currentPaper),
      enrichWithCore(currentPaper),
      enrichWithDoaj(currentPaper),
      enrichWithArxiv(currentPaper)
    ];

    const results = await Promise.allSettled(enrichmentPromises);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        currentPaper = mergePaperMetadata(currentPaper, result.value.data);
      }
    }

    return currentPaper;
  }
}
