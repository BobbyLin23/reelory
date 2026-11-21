import { useQueries } from "@tanstack/react-query";

import type { MediaType } from "@/utils/media";
import { yearFromDate } from "@/utils/media";
import { orpc } from "@/utils/orpc";

export interface ListTitleRef {
  mediaType: MediaType;
  tmdbId: number;
}

export interface ListTitle {
  posterPath: string | null;
  title: string;
  year: number | null;
}

export const listTitleKey = ({ mediaType, tmdbId }: ListTitleRef) => `${mediaType}:${tmdbId}`;

const uniqueTitles = (refs: ListTitleRef[]): ListTitleRef[] => {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = listTitleKey(ref);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

/**
 * Lists store only a title key, so names and poster art come from TMDB's cached
 * detail endpoints. The title page, a collage, and a list row for the same title
 * share one request. A missing key is still loading; null means TMDB has no data.
 */
export const useListTitles = (refs: ListTitleRef[]): Map<string, ListTitle | null> => {
  const unique = uniqueTitles(refs);
  const queries = useQueries({
    queries: unique.map((ref) =>
      ref.mediaType === "movie"
        ? orpc.tmdb.movie.detail.queryOptions({ input: { id: ref.tmdbId } })
        : orpc.tmdb.tv.detail.queryOptions({ input: { id: ref.tmdbId } }),
    ),
  });

  const titles = new Map<string, ListTitle | null>();
  for (const [index, ref] of unique.entries()) {
    const query = queries[index];
    if (query?.isError) {
      // A title TMDB no longer serves still keeps its place in the list.
      titles.set(listTitleKey(ref), null);
      continue;
    }
    const data = query?.data;
    if (data === undefined) {
      continue;
    }
    const isMovie = "title" in data;
    titles.set(listTitleKey(ref), {
      posterPath: data.posterPath,
      title: isMovie ? data.title : data.name,
      year: yearFromDate(isMovie ? data.releaseDate : data.firstAirDate),
    });
  }
  return titles;
};
