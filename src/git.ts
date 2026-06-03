import * as core from '@actions/core'
import type { getOctokit } from '@actions/github'

type Octokit = ReturnType<typeof getOctokit>

export async function fetchFileContents(
  octokit: Octokit,
  owner: string,
  repo: string,
  paths: string[]
): Promise<Array<{ path: string; content: string; treeSha: string } | null>> {
  return Promise.all(
    paths.map(async (path) => {
      const { data } = await octokit.rest.repos.getContent({ owner, repo, path })

      if (!('content' in data) || data.type !== 'file') {
        core.warning(`Skipping ${path}: unexpected response type`)
        return null
      }

      return {
        path,
        content: Buffer.from(data.content, 'base64').toString('utf-8'),
        treeSha: data.sha,
      }
    })
  )
}

export async function commitUpdates(
  octokit: Octokit,
  owner: string,
  repo: string,
  updates: Array<{ path: string; content: string }>,
  baseTreeSha: string,
  parentSha: string,
  ref: string
): Promise<string> {
  const blobs = await Promise.all(
    updates.map(({ content }) =>
      octokit.rest.git.createBlob({ owner, repo, content, encoding: 'utf-8' })
    )
  )

  const tree = await octokit.rest.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: updates.map(({ path }, i) => ({
      path,
      mode: '100644',
      type: 'blob',
      sha: blobs[i].data.sha,
    })),
  })

  const commit = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: 'docs: accept ADR(s) [skip ci]',
    tree: tree.data.sha,
    parents: [parentSha],
  })

  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref,
    sha: commit.data.sha,
  })

  return commit.data.sha
}
