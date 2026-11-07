import type {
  AcademicApiRpcResult,
  AcademicApiRpcTransport,
} from './client.js'

// Request options passed through to fetch. `next` lets Next.js sites opt
// into incremental static regeneration per request, for example
// { next: { revalidate: 3600 } }; other runtimes ignore it.
export type AcademicApiFetchInit =
  Omit<
    RequestInit,
    'method' | 'body'
  > & {
    next?: {
      revalidate?: number | false
      tags?: string[]
    }
  }

export type AcademicApiFetchTransportOptions = {
  url: string
  publishableKey: string
  fetch?: typeof globalThis.fetch
  init?: AcademicApiFetchInit
}

const rpcNamePattern =
  /^[a-z_][a-z0-9_]*$/

function readErrorMessage(
  body: unknown,
  status: number
) {
  if (
    body !== null &&
    typeof body === 'object' &&
    'message' in body &&
    typeof body.message === 'string'
  ) {
    return body.message
  }

  return `HTTP ${status}`
}

// A dependency-free transport for the Supabase Data API: each call is a
// POST to /rest/v1/rpc/<name> with the publishable key. Use it where adding
// @supabase/supabase-js is not worth it; a supabase-js client also works as
// a transport because it exposes the same rpc() method.
export function createFetchTransport(
  options: AcademicApiFetchTransportOptions
): AcademicApiRpcTransport {
  let baseUrl: URL

  try {
    baseUrl =
      new URL(options.url)
  } catch {
    throw new Error(
      'Academic API url must be an absolute URL.'
    )
  }

  if (
    baseUrl.protocol !== 'https:' &&
    baseUrl.protocol !== 'http:'
  ) {
    throw new Error(
      'Academic API url must use HTTP(S).'
    )
  }

  if (
    typeof options.publishableKey !==
      'string' ||
    options.publishableKey.trim()
      .length === 0
  ) {
    throw new Error(
      'Academic API publishableKey is required.'
    )
  }

  const fetchImplementation =
    options.fetch ??
    globalThis.fetch

  if (
    typeof fetchImplementation !==
    'function'
  ) {
    throw new Error(
      'No fetch implementation is available; pass one as options.fetch.'
    )
  }

  const rpcBase =
    `${baseUrl.origin}${baseUrl.pathname.replace(/\/+$/, '')}/rest/v1/rpc/`

  return {
    async rpc(
      name,
      args
    ): Promise<AcademicApiRpcResult> {
      if (
        !rpcNamePattern.test(name)
      ) {
        return {
          data: null,
          error: {
            message: `Invalid RPC name: ${name}`,
          },
        }
      }

      const headers =
        new Headers(
          options.init?.headers
        )

      headers.set(
        'apikey',
        options.publishableKey
      )
      headers.set(
        'Authorization',
        `Bearer ${options.publishableKey}`
      )
      headers.set(
        'Content-Type',
        'application/json'
      )
      headers.set(
        'Accept',
        'application/json'
      )

      let response: Response

      try {
        response =
          await fetchImplementation(
            `${rpcBase}${name}`,
            {
              ...options.init,
              method: 'POST',
              headers,
              body: JSON.stringify(
                args ?? {}
              ),
            } as RequestInit
          )
      } catch (error) {
        return {
          data: null,
          error: {
            message:
              error instanceof Error
                ? `Network error: ${error.message}`
                : 'Network error',
          },
        }
      }

      const text =
        await response.text()

      let body: unknown = null

      if (text.length > 0) {
        try {
          body =
            JSON.parse(text)
        } catch {
          return {
            data: null,
            error: {
              message: `HTTP ${response.status}: response was not JSON`,
            },
          }
        }
      }

      if (!response.ok) {
        return {
          data: null,
          error: {
            message: readErrorMessage(
              body,
              response.status
            ),
          },
        }
      }

      return {
        data: body,
        error: null,
      }
    },
  }
}
