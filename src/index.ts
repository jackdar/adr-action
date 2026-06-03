import * as core from '@actions/core'
import * as github from '@actions/github'

const ADR_PATH_PREFIX = 'doc/adr/'
const STATUS_REGEX = /^(## Status\s*\n\n)Pending$/m

async function run(): Promise<void> {
  const token = core.getInput('github-token', { required: true })
  const octokit = github.getOctokit(token)
  const { owner, repo } = github.context.repo

  const { data: commitData } = await octokit.rest.repos.getCommit({
    owner,
    repo,
    ref: github.context.sha,
  })

  const addedAdrFiles = (commitData.files ?? [])
    .filter((f) => f.status === 'added' && f.filename.startsWith(ADR_PATH_PREFIX) && f.filename.endsWith('.md'))
    .map((f) => f.filename)

  if (addedAdrFiles.length === 0) {
    core.info('No new ADR files detected, nothing to do.')
    return
  }

  core.info(`New ADR files: ${addedAdrFiles.join(', ')}`)

  const updates: Array<{ path: string; content: string }> = []

  for (const path of addedAdrFiles) {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path })

    if (!('content' in data) || data.type !== 'file') {
      core.warning(`Skipping ${path}: unexpected response type`)
      continue
    }

    const original = Buffer.from(data.content, 'base64').toString('utf-8')
    const updated = original.replace(STATUS_REGEX, '$1Accepted')

    if (updated === original) {
      core.info(`Skipping ${path}: status is not 'Pending'`)
      continue
    }

    updates.push({ path, content: updated })
  }

  if (updates.length === 0) {
    core.info('No files needed updating.')
    return
  }

  // Build a single commit via the Git Data API
  const headRef = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: 'heads/main',
  })
  const headSha = headRef.data.object.sha

  const baseCommit = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: headSha,
  })
  const baseTreeSha = baseCommit.data.tree.sha

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
    message: 'chore: accept ADR(s) [skip ci]',
    tree: tree.data.sha,
    parents: [headSha],
  })

  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: 'heads/main',
    sha: commit.data.sha,
  })

  core.info(`Committed status updates: ${commit.data.sha}`)
}

run().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? err.message : String(err))
})
