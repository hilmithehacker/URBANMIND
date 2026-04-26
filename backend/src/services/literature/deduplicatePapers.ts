import { NormalizedPaper } from './literature.types';

export function deduplicatePapers(papers: NormalizedPaper[]): NormalizedPaper[] {
  const seenDoi = new Set<string>();
  const seenTitle = new Set<string>();
  
  return papers.filter(paper => {
    if (paper.doi) {
      if (seenDoi.has(paper.doi)) return false;
      seenDoi.add(paper.doi);
    }
    
    if (paper.title) {
      const cleanTitle = paper.title.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (seenTitle.has(cleanTitle)) return false;
      seenTitle.add(cleanTitle);
    }
    
    return true;
  });
}
