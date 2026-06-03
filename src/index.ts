import * as core from '@actions/core'
import * as github from '@actions/github'
import { filterAddedAdrFiles, applyStatusUpdate } from './adr'
import { fetchFileContents, commitUpdates } from './git'

export async function run(): Promise<void> {
  try {
    const token = core.getInput('github-token', { required: true })
    const adrDirectory = core.getInput('adr-directory').replace(/\/?$/, '/')
    const octokit = github.getOctokit(token)
    const { owner, repo } = github.context.repo
    const headSha = github.context.sha

    const { data: commitData } = await octokit.rest.repos.getCommit({
      owner,
      repo,
      ref: headSha,
    })

    const addedAdrFiles = filterAddedAdrFiles(
      commitData.files ?? [],
      adrDirectory
    )

    if (addedAdrFiles.length === 0) {
      core.info('No new ADR files detected, nothing to do.')
      return
    }

    core.info(`New ADR files: ${addedAdrFiles.join(', ')}`)

    const fileResults = await fetchFileContents(
      octokit,
      owner,
      repo,
      addedAdrFiles
    )

    const updates = fileResults.flatMap((result) => {
      if (result === null) return []
      const update = applyStatusUpdate(result.path, result.content)
      if (update === null) {
        core.info(`Skipping ${result.path}: status is not 'Pending'`)
        return []
      }
      return [update]
    })

    if (updates.length === 0) {
      core.info('No files needed updating.')
      return
    }

    const sha = await commitUpdates(
      octokit,
      owner,
      repo,
      updates,
      commitData.commit.tree.sha,
      headSha,
      github.context.ref.replace(/^refs\//, '')
    )

    core.info(`Committed status updates: ${sha}`)
  } catch (err: unknown) {
    core.setFailed(err instanceof Error ? err.message : String(err))
  }
}

run()
