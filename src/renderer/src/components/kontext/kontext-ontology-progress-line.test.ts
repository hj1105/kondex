import { afterEach, describe, expect, it } from 'vitest'
import { i18n } from '@/i18n/i18n'
import type { KontextOntologyProgress } from '../../../../shared/kontext-ontology-contract'
import { getKontextOntologyCopy } from './kontext-ontology-copy'
import { ontologyProgressLine } from './kontext-ontology-progress-line'

const MB = 1_048_576

function progress(
  phase: KontextOntologyProgress['phase'],
  done: number,
  total: number,
  message?: string
): KontextOntologyProgress {
  return {
    phase,
    done,
    total,
    ...(message === undefined ? {} : { message }),
    configPath: '/ws/kontext.yaml',
    startedAt: '2026-09-28T00:00:00.000Z',
    updatedAt: '2026-09-28T00:00:01.000Z',
    finished: false
  }
}

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('ontologyProgressLine', () => {
  it('names the batch in progress, counting from one', () => {
    // The sidecar reports completed batches, so the first batch arrives as done 0.
    expect(ontologyProgressLine(progress('discover', 0, 1))).toBe(
      'Discovering topics: batch 1 of 1'
    )
    expect(ontologyProgressLine(progress('classify', 0, 3))).toBe(
      'Classifying documents: batch 1 of 3'
    )
    expect(ontologyProgressLine(progress('classify', 2, 3))).toBe(
      'Classifying documents: batch 3 of 3'
    )
    expect(ontologyProgressLine(progress('classify', 3, 3))).toBe(
      'Classifying documents: batch 3 of 3'
    )
  })

  it('shows megabytes only when the download has a size', () => {
    expect(ontologyProgressLine(progress('embed', 40 * MB, 120 * MB, 'download model.onnx'))).toBe(
      'Downloading the embedding model 40/120 MB'
    )
    expect(ontologyProgressLine(progress('embed', 2_000, 0, 'download tokenizer.json'))).toBe(
      'Downloading the embedding model…'
    )
    expect(ontologyProgressLine(progress('embed', 1_000, 4_000, 'download config.json'))).toBe(
      'Downloading the embedding model…'
    )
    expect(ontologyProgressLine(progress('embed', 2, 5))).toBe('Embedding chunks 2/5')
  })
})

describe('document counts', () => {
  it('uses the singular for one document', () => {
    const copy = getKontextOntologyCopy()
    expect(copy.nodeDocuments(1)).toBe('1 document')
    expect(copy.nodeDocuments(0)).toBe('0 documents')
    expect(copy.nodeDocuments(4)).toBe('4 documents')
    expect(copy.resourceCount(1)).toBe('1 document')
    expect(copy.resourceCount(2)).toBe('2 documents')
  })

  it('follows the locale plural rules', async () => {
    await i18n.changeLanguage('fr')
    expect(getKontextOntologyCopy().nodeDocuments(0)).toBe('0 document rattaché')
    expect(getKontextOntologyCopy().nodeDocuments(2)).toBe('2 documents rattachés')
    await i18n.changeLanguage('ko')
    expect(getKontextOntologyCopy().nodeDocuments(1)).toBe('문서 1개')
  })
})
