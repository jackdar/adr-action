const STATUS_REGEX = /^(## Status\s*\n\n)Pending$/m

export function filterAddedAdrFiles(
  files: Array<{ status: string; filename: string }>,
  adrDirectory: string
): string[] {
  return files
    .filter(
      (f) =>
        f.status === 'added' &&
        f.filename.startsWith(adrDirectory) &&
        f.filename.endsWith('.md')
    )
    .map((f) => f.filename)
}

export function applyStatusUpdate(
  path: string,
  content: string
): { path: string; content: string } | null {
  const updated = content.replace(STATUS_REGEX, '$1Accepted')
  if (updated === content) return null
  return { path, content: updated }
}
