import { translate } from '@/i18n/i18n'
import type { KontextOntologyProgress } from '../../../../shared/kontext-ontology-contract'

const MEGABYTE = 1_048_576

/**
 * The sidecar counts model phases in completed batches, so `done` is 0 while the
 * first batch runs. People read "batch N of M" as the one in progress.
 */
function batchInProgress(done: number, total: number): number {
  return total > 0 ? Math.min(done + 1, total) : done
}

/** The one-line status shown under the build buttons while setup or embedding runs. */
export function ontologyProgressLine(progress: KontextOntologyProgress): string {
  const { done, total } = progress
  switch (progress.phase) {
    case 'collect':
      return translate('kondex.ontology.progressCollect', 'Collecting documents… {{done}}', {
        done
      })
    case 'discover':
      return translate(
        'kondex.ontology.progressDiscover',
        'Discovering topics: batch {{done}} of {{total}}',
        { done: batchInProgress(done, total), total }
      )
    case 'design':
      return translate('kondex.ontology.progressDesign', 'Designing nodes…')
    case 'classify':
      return translate(
        'kondex.ontology.progressClassify',
        'Classifying documents: batch {{done}} of {{total}}',
        { done: batchInProgress(done, total), total }
      )
    case 'sync':
      return translate(
        'kondex.ontology.progressSync',
        'Writing knowledge: {{done}} of {{total}} documents',
        { done, total }
      )
    case 'code':
      return translate(
        'kondex.ontology.progressCode',
        'Projecting code symbols: {{done}} of {{total}} files ({{source}})',
        { done, total, source: progress.message ?? '' }
      )
    case 'embed':
      return embedLine(progress)
  }
}

function embedLine({ done, total, message }: KontextOntologyProgress): string {
  // Why: while the model downloads the counters are bytes, not chunks.
  if (!message?.startsWith('download')) {
    return translate('kondex.ontology.progressEmbed', 'Embedding chunks {{done}}/{{total}}', {
      done,
      total
    })
  }
  // A file without a length, or one under half a megabyte, would read "0/0 MB".
  const megabytes = Math.round(total / MEGABYTE)
  return megabytes > 0
    ? translate(
        'kondex.ontology.progressDownload',
        'Downloading the embedding model {{done}}/{{total}} MB',
        { done: Math.round(done / MEGABYTE), total: megabytes }
      )
    : translate('kondex.ontology.progressDownloadUnsized', 'Downloading the embedding model…')
}
