import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@actions/core')
vi.mock('@actions/github', () => ({
  getOctokit: vi.fn(),
  context: {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    sha: 'head-sha',
    ref: 'refs/heads/main',
  },
}))
vi.mock('@/git')
vi.mock('@/adr')

import * as core from '@actions/core'
import * as github from '@actions/github'
import * as git from '@/git'
import * as adr from '@/adr'
import { run } from '@/index'

const mockOctokit = {
  rest: {
    repos: {
      getCommit: vi.fn(),
    },
  },
}

beforeEach(() => {
  vi.clearAllMocks()

  vi.mocked(core.getInput).mockImplementation((name) => {
    if (name === 'github-token') return 'mock-token'
    if (name === 'adr-directory') return 'doc/adr'
    return ''
  })

  vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as never)

  mockOctokit.rest.repos.getCommit.mockResolvedValue({
    data: {
      files: [],
      commit: { tree: { sha: 'tree-sha' } },
    },
  })

  vi.mocked(adr.filterAddedAdrFiles).mockReturnValue([])
  vi.mocked(git.fetchFileContents).mockResolvedValue([])
  vi.mocked(git.commitUpdates).mockResolvedValue('new-commit-sha')
})

describe('run', () => {
  it('exits early when no new ADR files are detected', async () => {
    // Given
    vi.mocked(adr.filterAddedAdrFiles).mockReturnValue([])

    // When
    await run()

    // Then
    expect(core.info).toHaveBeenCalledWith(
      'No new ADR files detected, nothing to do.'
    )
    expect(git.fetchFileContents).not.toHaveBeenCalled()
  })

  it('exits early when no files need updating', async () => {
    // Given
    vi.mocked(adr.filterAddedAdrFiles).mockReturnValue(['doc/adr/0001.md'])
    vi.mocked(git.fetchFileContents).mockResolvedValue([
      {
        path: 'doc/adr/0001.md',
        content: '## Status\n\nAccepted',
        treeSha: 'sha',
      },
    ])
    vi.mocked(adr.applyStatusUpdate).mockReturnValue(null)

    // When
    await run()

    // Then
    expect(core.info).toHaveBeenCalledWith('No files needed updating.')
    expect(git.commitUpdates).not.toHaveBeenCalled()
  })

  it('commits updates and logs the sha on the happy path', async () => {
    // Given
    vi.mocked(adr.filterAddedAdrFiles).mockReturnValue(['doc/adr/0001.md'])
    vi.mocked(git.fetchFileContents).mockResolvedValue([
      {
        path: 'doc/adr/0001.md',
        content: '## Status\n\nPending',
        treeSha: 'sha',
      },
    ])
    vi.mocked(adr.applyStatusUpdate).mockReturnValue({
      path: 'doc/adr/0001.md',
      content: '## Status\n\nAccepted',
    })

    // When
    await run()

    // Then
    expect(git.commitUpdates).toHaveBeenCalledWith(
      mockOctokit,
      'test-owner',
      'test-repo',
      [{ path: 'doc/adr/0001.md', content: '## Status\n\nAccepted' }],
      'tree-sha',
      'head-sha',
      'heads/main'
    )
    expect(core.info).toHaveBeenCalledWith(
      'Committed status updates: new-commit-sha'
    )
  })

  it('calls setFailed when an error is thrown', async () => {
    // Given
    mockOctokit.rest.repos.getCommit.mockRejectedValue(new Error('API error'))

    // When
    await run()

    // Then
    expect(core.setFailed).toHaveBeenCalledWith('API error')
  })

  it('strips the refs/ prefix from the context ref when committing', async () => {
    // Given
    github.context.ref = 'refs/heads/feature-branch'
    vi.mocked(adr.filterAddedAdrFiles).mockReturnValue(['doc/adr/0001.md'])
    vi.mocked(git.fetchFileContents).mockResolvedValue([
      {
        path: 'doc/adr/0001.md',
        content: '## Status\n\nPending',
        treeSha: 'sha',
      },
    ])
    vi.mocked(adr.applyStatusUpdate).mockReturnValue({
      path: 'doc/adr/0001.md',
      content: '## Status\n\nAccepted',
    })

    // When
    await run()

    // Then
    expect(git.commitUpdates).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'heads/feature-branch'
    )
  })
})
