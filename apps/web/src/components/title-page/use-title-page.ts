import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { LibraryStatus } from "@/utils/media";
import { formatRuntime, librarySnapshot, tmdbImageUrl, yearFromDate } from "@/utils/media";
import { orpc } from "@/utils/orpc";

export const errorCode = (error: unknown): string | undefined => {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
};

const useTitleQueries = (mediaType: "movie" | "tv", tmdbId: number) => {
  const isTv = mediaType === "tv";
  const movieQuery = useQuery(
    orpc.tmdb.movie.detail.queryOptions({ enabled: !isTv, input: { id: tmdbId } }),
  );
  const tvQuery = useQuery(
    orpc.tmdb.tv.detail.queryOptions({ enabled: isTv, input: { id: tmdbId } }),
  );
  const creditsQuery = useQuery(
    isTv
      ? orpc.tmdb.tv.credits.queryOptions({ input: { id: tmdbId } })
      : orpc.tmdb.movie.credits.queryOptions({ input: { id: tmdbId } }),
  );
  const libraryQuery = useQuery(orpc.library.list.queryOptions({ input: { mediaType, tmdbId } }));
  const watchesQuery = useQuery(orpc.watch.list.queryOptions({ input: { mediaType, tmdbId } }));
  const movie = movieQuery.data;
  const tv = tvQuery.data;
  const imagesQuery = useQuery(
    orpc.tmdb.movie.images.queryOptions({ enabled: !isTv && !!movie, input: { id: tmdbId } }),
  );

  return {
    credits: creditsQuery.data,
    creditsPending: creditsQuery.isPending,
    detailError: isTv ? tvQuery.error : movieQuery.error,
    detailPending: isTv ? tvQuery.isPending : movieQuery.isPending,
    genres: movie?.genres ?? tv?.genres ?? [],
    isTv,
    libraryStatus: libraryQuery.data?.[0]?.status,
    movie,
    posters: imagesQuery.data?.posters,
    refetchDetail: isTv ? tvQuery.refetch : movieQuery.refetch,
    tv,
    watches: watchesQuery.data ?? [],
    watchesPending: watchesQuery.isPending,
  };
};

const useTitleActions = ({
  genres,
  mediaType,
  posterPath,
  title,
  tmdbId,
  year,
}: {
  genres: readonly { name: string }[];
  mediaType: "movie" | "tv";
  posterPath: string | null;
  title: string;
  tmdbId: number;
  year: number | null;
}) => {
  const queryClient = useQueryClient();
  const [pendingStatus, setPendingStatus] = useState<LibraryStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const setStatus = useMutation(orpc.library.setStatus.mutationOptions());
  const deleteWatch = useMutation(orpc.watch.delete.mutationOptions());

  const handleSaveStatus = async (status: LibraryStatus) => {
    if (title === "") {
      return;
    }
    setPendingStatus(status);
    setStatusError(null);
    try {
      await setStatus.mutateAsync({
        mediaType,
        snapshot: librarySnapshot({ genres, posterPath, title, year }),
        status,
        tmdbId,
      });
      await queryClient.invalidateQueries({ queryKey: orpc.library.list.key() });
    } catch {
      setStatusError("We could not update your library. Check your connection and try again.");
    }
    setPendingStatus(null);
  };

  const handleDeleteLog = async (id: string) => {
    await deleteWatch.mutateAsync({ id });
    await queryClient.invalidateQueries({ queryKey: orpc.watch.list.key() });
  };

  return { handleDeleteLog, handleSaveStatus, pendingStatus, statusError };
};

const first = <T>(left: T | undefined, right: T | undefined, fallback: T) =>
  left ?? right ?? fallback;

const titleSnapshot = (
  movie: ReturnType<typeof useTitleQueries>["movie"],
  tv: ReturnType<typeof useTitleQueries>["tv"],
) => ({
  backdropUrl: tmdbImageUrl(first(movie?.backdropPath, tv?.backdropPath, null), "w780"),
  creators: tv?.createdBy ?? [],
  overview: first(movie?.overview, tv?.overview, ""),
  posterPath: first(movie?.posterPath, tv?.posterPath, null),
  runtimeLabel: formatRuntime(first(movie?.runtime, tv?.episodeRunTime[0], null)),
  seasons: tv?.seasons ?? [],
  title: first(movie?.title, tv?.name, ""),
  voteAverage: first(movie?.voteAverage, tv?.voteAverage, 0),
  year: yearFromDate(first(movie?.releaseDate, tv?.firstAirDate, null)),
});

export const useTitlePage = (mediaType: "movie" | "tv", tmdbId: number) => {
  const [logOpen, setLogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const queries = useTitleQueries(mediaType, tmdbId);
  const snapshot = titleSnapshot(queries.movie, queries.tv);
  const actions = useTitleActions({
    genres: queries.genres,
    mediaType,
    posterPath: snapshot.posterPath,
    title: snapshot.title,
    tmdbId,
    year: snapshot.year,
  });

  return {
    credits: queries.credits,
    creditsPending: queries.creditsPending,
    detailError: queries.detailError,
    detailPending: queries.detailPending,
    editing: queries.watches.find((watch) => watch.id === editingId) ?? null,
    editingId,
    genres: queries.genres,
    handleDeleteLog: actions.handleDeleteLog,
    handleRetryDetail: queries.refetchDetail,
    handleSaveStatus: actions.handleSaveStatus,
    isTv: queries.isTv,
    libraryStatus: queries.libraryStatus,
    logOpen,
    pendingStatus: actions.pendingStatus,
    posters: queries.posters,
    setEditingId,
    setLogOpen,
    statusError: actions.statusError,
    watches: queries.watches,
    watchesPending: queries.watchesPending,
    ...snapshot,
  };
};
