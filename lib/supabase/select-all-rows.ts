import type { PostgrestError } from '@supabase/supabase-js'

// The Data API returns at most `max_rows` rows per request (1000, see
// supabase/config.toml) and reports no error when it truncates. Reads that
// can grow past that, such as all work sessions linked to Papers, page
// through the rows instead. The query must have a stable order that ends in
// a unique column (usually `id`) so pages neither overlap nor skip rows.
export const SELECT_PAGE_SIZE = 1000

type PageResult<Row> = {
  data: Row[] | null
  error: PostgrestError | null
}

export async function selectAllRows<Row>(
  buildPage: (
    from: number,
    to: number
  ) => PromiseLike<
    PageResult<Row>
  >
): Promise<{
  data: Row[] | null
  error: PostgrestError | null
}> {
  const rows: Row[] = []

  let from = 0

  while (true) {
    const {
      data,
      error,
    } = await buildPage(
      from,
      from +
        SELECT_PAGE_SIZE -
        1
    )

    if (error) {
      return {
        data: null,
        error,
      }
    }

    const page =
      data ?? []

    rows.push(...page)

    if (
      page.length <
      SELECT_PAGE_SIZE
    ) {
      return {
        data: rows,
        error: null,
      }
    }

    from +=
      SELECT_PAGE_SIZE
  }
}
