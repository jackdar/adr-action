import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as core from '@actions/core'
import { fetchFileContents, commitUpdates } from '@/git'

vi.mock('@actions/core')

const encode = (s: string) => Buffer.from(s).toString('base64')

const makeOctokit = () => ({
  rest: {
    repos: {
      getContent: vi.fn(),
    },
    git: {
      createBlob: vi.fn(),
      createTree: vi.fn(),
      createCommit: vi.fn(),
      updateRef: vi.fn(),
    },
  },
})

describe('fetchFileContents', () => {
  let octokit: ReturnType<typeof makeOctokit>

  beforeEach(() => {
    octokit = makeOctokit()
    vi.mocked(core.warning).mockClear()
  })

  it('returns decoded content for a valid file', async () => {
    // Given
    octokit.rest.repos.getContent.mockResolvedValue({
      data: { type: 'file', content: encode('file content'), sha: 'blob-sha' },
    })

    // When
    const result = await fetchFileContents(octokit as never, 'owner', 'repo', ['doc/adr/0001.md'])

    // Then
    expect(result).toEqual([{ path: 'doc/adr/0001.md', content: 'file content', treeSha: 'blob-sha' }])
  })

  it('returns null and warns when the response is not a file', async () => {
    // Given
    octokit.rest.repos.getContent.mockResolvedValue({
      data: { type: 'dir' },
    })

    // When
    const result = await fetchFileContents(octokit as never, 'owner', 'repo', ['doc/adr/0001.md'])

    // Then
    expect(result).toEqual([null])
    expect(core.warning).toHaveBeenCalledWith('Skipping doc/adr/0001.md: unexpected response type')
  })

  it('fetches multiple files in parallel', async () => {
    // Given
    octokit.rest.repos.getContent
      .mockResolvedValueOnce({ data: { type: 'file', content: encode('first'), sha: 'sha-1' } })
      .mockResolvedValueOnce({ data: { type: 'file', content: encode('second'), sha: 'sha-2' } })

    // When
    const result = await fetchFileContents(octokit as never, 'owner', 'repo', [
      'doc/adr/0001.md',
      'doc/adr/0002.md',
    ])

    // Then
    expect(result).toEqual([
      { path: 'doc/adr/0001.md', content: 'first', treeSha: 'sha-1' },
      { path: 'doc/adr/0002.md', content: 'second', treeSha: 'sha-2' },
    ])
  })

  it('returns a mix of results when some files are invalid', async () => {
    // Given
    octokit.rest.repos.getContent
      .mockResolvedValueOnce({ data: { type: 'file', content: encode('content'), sha: 'sha-1' } })
      .mockResolvedValueOnce({ data: { type: 'dir' } })

    // When
    const result = await fetchFileContents(octokit as never, 'owner', 'repo', [
      'doc/adr/0001.md',
      'doc/adr/0002.md',
    ])

    // Then
    expect(result).toEqual([
      { path: 'doc/adr/0001.md', content: 'content', treeSha: 'sha-1' },
      null,
    ])
  })
})

describe('commitUpdates', () => {
  let octokit: ReturnType<typeof makeOctokit>

  const updates = [{ path: 'doc/adr/0001.md', content: 'updated content' }]

  beforeEach(() => {
    octokit = makeOctokit()
    octokit.rest.git.createBlob.mockResolvedValue({ data: { sha: 'blob-sha' } })
    octokit.rest.git.createTree.mockResolvedValue({ data: { sha: 'tree-sha' } })
    octokit.rest.git.createCommit.mockResolvedValue({ data: { sha: 'commit-sha' } })
    octokit.rest.git.updateRef.mockResolvedValue({})
  })

  it('returns the new commit sha', async () => {
    // Given / When
    const sha = await commitUpdates(octokit as never, 'owner', 'repo', updates, 'base-tree', 'parent-sha', 'heads/main')

    // Then
    expect(sha).toBe('commit-sha')
  })

  it('creates a blob for each update', async () => {
    // Given / When
    await commitUpdates(octokit as never, 'owner', 'repo', updates, 'base-tree', 'parent-sha', 'heads/main')

    // Then
    expect(octokit.rest.git.createBlob).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      content: 'updated content',
      encoding: 'utf-8',
    })
  })

  it('creates a tree against the correct base with the new blobs', async () => {
    // Given / When
    await commitUpdates(octokit as never, 'owner', 'repo', updates, 'base-tree', 'parent-sha', 'heads/main')

    // Then
    expect(octokit.rest.git.createTree).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      base_tree: 'base-tree',
      tree: [{ path: 'doc/adr/0001.md', mode: '100644', type: 'blob', sha: 'blob-sha' }],
    })
  })

  it('creates a commit with the correct tree and parent', async () => {
    // Given / When
    await commitUpdates(octokit as never, 'owner', 'repo', updates, 'base-tree', 'parent-sha', 'heads/main')

    // Then
    expect(octokit.rest.git.createCommit).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      message: 'docs: accept ADR(s) [skip ci]',
      tree: 'tree-sha',
      parents: ['parent-sha'],
    })
  })

  it('updates the ref to point to the new commit', async () => {
    // Given / When
    await commitUpdates(octokit as never, 'owner', 'repo', updates, 'base-tree', 'parent-sha', 'heads/main')

    // Then
    expect(octokit.rest.git.updateRef).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      ref: 'heads/main',
      sha: 'commit-sha',
    })
  })
})
