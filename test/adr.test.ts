import { describe, it, expect } from 'vitest'
import { filterAddedAdrFiles, applyStatusUpdate } from '@/adr'

describe('filterAddedAdrFiles', () => {
  const adrDirectory = 'doc/adr/'

  it('returns added .md files under the adr directory', () => {
    // Given
    const files = [
      { status: 'added', filename: 'doc/adr/0001-use-adrs.md' },
      { status: 'added', filename: 'doc/adr/0002-use-typescript.md' },
    ]

    // When
    const result = filterAddedAdrFiles(files, adrDirectory)

    // Then
    expect(result).toEqual([
      'doc/adr/0001-use-adrs.md',
      'doc/adr/0002-use-typescript.md',
    ])
  })

  it('ignores modified files', () => {
    // Given
    const files = [{ status: 'modified', filename: 'doc/adr/0001-use-adrs.md' }]

    // When
    const result = filterAddedAdrFiles(files, adrDirectory)

    // Then
    expect(result).toEqual([])
  })

  it('ignores files outside the adr directory', () => {
    // Given
    const files = [
      { status: 'added', filename: 'doc/adr/0001-use-adrs.md' },
      { status: 'added', filename: 'src/index.ts' },
      { status: 'added', filename: 'README.md' },
    ]

    // When
    const result = filterAddedAdrFiles(files, adrDirectory)

    // Then
    expect(result).toEqual(['doc/adr/0001-use-adrs.md'])
  })

  it('ignores non-.md files under the adr directory', () => {
    // Given
    const files = [{ status: 'added', filename: 'doc/adr/0001-use-adrs.txt' }]

    // When
    const result = filterAddedAdrFiles(files, adrDirectory)

    // Then
    expect(result).toEqual([])
  })

  it('returns empty array when there are no files', () => {
    // Given / When
    const result = filterAddedAdrFiles([], adrDirectory)

    // Then
    expect(result).toEqual([])
  })

  it('respects a custom adr directory', () => {
    // Given
    const files = [
      { status: 'added', filename: 'docs/decisions/0001-use-adrs.md' },
      { status: 'added', filename: 'doc/adr/0001-use-adrs.md' },
    ]

    // When
    const result = filterAddedAdrFiles(files, 'docs/decisions/')

    // Then
    expect(result).toEqual(['docs/decisions/0001-use-adrs.md'])
  })
})

describe('applyStatusUpdate', () => {
  const pendingContent = `# Title\n\n## Status\n\nPending\n\n## Context\n\nSome context.`

  it('replaces Pending with Accepted', () => {
    // Given / When
    const result = applyStatusUpdate('doc/adr/0001.md', pendingContent)

    // Then
    expect(result).toEqual({
      path: 'doc/adr/0001.md',
      content: `# Title\n\n## Status\n\nAccepted\n\n## Context\n\nSome context.`,
    })
  })

  it('returns null if status is already Accepted', () => {
    // Given
    const content = pendingContent.replace('Pending', 'Accepted')

    // When / Then
    expect(applyStatusUpdate('doc/adr/0001.md', content)).toBeNull()
  })

  it('returns null if status is Deprecated', () => {
    // Given
    const content = pendingContent.replace('Pending', 'Deprecated')

    // When / Then
    expect(applyStatusUpdate('doc/adr/0001.md', content)).toBeNull()
  })

  it('returns null if there is no Status section', () => {
    // Given
    const content = `# Title\n\n## Context\n\nNo status here.`

    // When / Then
    expect(applyStatusUpdate('doc/adr/0001.md', content)).toBeNull()
  })

  it('does not match Pending that is not on its own line', () => {
    // Given
    const content = `# Title\n\n## Status\n\nPending review\n\n## Context`

    // When / Then
    expect(applyStatusUpdate('doc/adr/0001.md', content)).toBeNull()
  })
})
