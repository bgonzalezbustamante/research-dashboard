import type {
  PublicationAuthorship,
  PublicCollectionPublication,
  PublicExternalPublication,
  PublicProjectPublication,
} from './types.js'

// Pure helpers for consuming sites. The feeds return every Public row, and
// each site keeps its own selection by filtering on a collection or Project
// slug.

export function filterExternalPublicationsByCollection(
  rows: readonly PublicExternalPublication[],
  collectionSlug: string
): PublicExternalPublication[] {
  return rows.filter(
    (row) =>
      row.collection_slugs.includes(
        collectionSlug
      )
  )
}

// Rows of one collection from list_public_collection_publications(): the
// owner's own Public Papers and Public external publications, optionally
// only one authorship.
export function filterCollectionPublications(
  rows: readonly PublicCollectionPublication[],
  collectionSlug: string,
  authorship?: PublicationAuthorship
): PublicCollectionPublication[] {
  return rows.filter(
    (row) =>
      row.collection_slug ===
        collectionSlug &&
      (authorship === undefined ||
        row.authorship ===
          authorship)
  )
}

export function filterProjectPublications(
  rows: readonly PublicProjectPublication[],
  projectSlug: string,
  authorship?: PublicationAuthorship
): PublicProjectPublication[] {
  return rows.filter(
    (row) =>
      row.project_slug ===
        projectSlug &&
      (authorship === undefined ||
        row.authorship ===
          authorship)
  )
}

type DatedPublication = {
  title: string
  publication_date: string | null
  publication_year: number | null
}

function sortKey(
  row: DatedPublication
) {
  if (row.publication_date) {
    return row.publication_date
  }

  // A row with only a year sorts as the start of that year: after the year's
  // dated rows when newest first, before them when oldest first.
  return row.publication_year === null
    ? ''
    : `${String(row.publication_year).padStart(4, '0')}-00-00`
}

// Returns a new array, newest first by default. Rows without a date or year
// go last; ties are broken by title.
export function sortPublicationsByDate<
  Row extends DatedPublication,
>(
  rows: readonly Row[],
  order: 'newest' | 'oldest' = 'newest'
): Row[] {
  const direction =
    order === 'newest'
      ? -1
      : 1

  return [...rows].sort(
    (left, right) => {
      const leftKey =
        sortKey(left)
      const rightKey =
        sortKey(right)

      if (
        leftKey === '' ||
        rightKey === ''
      ) {
        if (leftKey === rightKey) {
          return left.title.localeCompare(
            right.title
          )
        }

        return leftKey === ''
          ? 1
          : -1
      }

      if (leftKey !== rightKey) {
        return leftKey < rightKey
          ? -direction
          : direction
      }

      return left.title.localeCompare(
        right.title
      )
    }
  )
}
