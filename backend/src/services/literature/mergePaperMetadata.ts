import { NormalizedPaper } from './literature.types';

export function mergePaperMetadata(base: NormalizedPaper, enrichment: Partial<NormalizedPaper>): NormalizedPaper {
  const merged = { ...base };

  if (!merged.abstract && enrichment.abstract) merged.abstract = enrichment.abstract;
  if (!merged.citationCount && enrichment.citationCount != null) merged.citationCount = enrichment.citationCount;
  if (!merged.influentialCitationCount && enrichment.influentialCitationCount != null) {
    merged.influentialCitationCount = enrichment.influentialCitationCount;
  }
  if (!merged.url && enrichment.url) merged.url = enrichment.url;
  if (!merged.pdfUrl && enrichment.pdfUrl) merged.pdfUrl = enrichment.pdfUrl;
  if (!merged.journal && enrichment.journal) merged.journal = enrichment.journal;
  
  if (enrichment.isOpenAccess) merged.isOpenAccess = true;
  
  if (enrichment.providerSources) {
    merged.providerSources = [...new Set([...merged.providerSources, ...enrichment.providerSources])];
  }

  if (enrichment.fieldsOfStudy) {
    merged.fieldsOfStudy = [...new Set([...merged.fieldsOfStudy, ...enrichment.fieldsOfStudy])];
  }

  return merged;
}
