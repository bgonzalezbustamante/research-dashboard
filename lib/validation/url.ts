// Mirrors the database link constraints: an absolute HTTP(S) URL with a
// host, no whitespace and at most 2,048 characters. Keep this pattern in
// step with the `~*` checks in supabase/migrations.
export const maxHttpUrlLength = 2048

const httpUrlPattern =
  /^https?:\/\/[^\s/?#]+([/?#]\S*)?$/i

export function isValidHttpUrl(
  value: string
) {
  if (
    value.length > maxHttpUrlLength ||
    !httpUrlPattern.test(value)
  ) {
    return false
  }

  try {
    const url =
      new URL(value)

    return (
      (url.protocol === 'http:' ||
        url.protocol === 'https:') &&
      url.hostname.length > 0
    )
  } catch {
    return false
  }
}
