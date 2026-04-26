export interface NormalizedPaper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  source: string;
  journal: string;
  abstract: string;
  doi: string;
  url: string;
  pdfUrl: string;
  citationCount: number | null;
  influentialCitationCount: number | null;
  isOpenAccess: boolean;
  fieldsOfStudy: string[];
  keywords: string[];
  providerSources: string[];
  relevanceScore: number | null;
  notes: string;
  tags: string[];
}

export interface LiteratureSearchParams {
  query: string;
  yearStart?: number;
  yearEnd?: number;
  limit?: number;
  openAccessOnly?: boolean;
}

export interface ProviderResult {
  success: boolean;
  data: NormalizedPaper[];
  error?: string;
}

export interface EnrichmentResult {
  success: boolean;
  data: Partial<NormalizedPaper>;
  error?: string;
}
