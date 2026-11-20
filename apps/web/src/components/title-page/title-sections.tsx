import type { TmdbCredits, TmdbTvDetail } from "@reelory/api/tmdb/schemas";

import { Avatar } from "@/components/arc/avatar/avatar";
import { Button } from "@/components/arc/button/button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { Rating } from "@/components/arc/rating/rating";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { fromIsoDate, ratingToStars, tmdbImageUrl, yearFromDate } from "@/utils/media";

import styles from "./title-page.module.css";

const CAST_LIMIT = 12;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface WatchLog {
  episode: number | null;
  id: string;
  rating: number | null;
  review: string | null;
  season: number | null;
  watchedOn: string | null;
}

const formatWatchDate = (value: string | null) => {
  if (value === null) {
    return "Unknown date";
  }
  const date = fromIsoDate(value);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
};

export const CastSection = ({
  credits,
  isPending,
}: {
  credits: TmdbCredits | undefined;
  isPending: boolean;
}) => {
  const cast = [...(credits?.cast ?? [])]
    .toSorted((left, right) => left.order - right.order)
    .slice(0, CAST_LIMIT);
  if (!isPending && cast.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="cast-heading" className={styles.section}>
      <h2 className={styles.heading} id="cast-heading">
        Cast
      </h2>
      <Skeleton label="Loading cast" lines={2} loading={isPending}>
        {cast.length > 0 ? (
          <ul className={styles.cast}>
            {cast.map((person) => (
              <li className={styles.person} key={person.id}>
                <Avatar
                  name={person.name}
                  size="lg"
                  src={tmdbImageUrl(person.profilePath, "w185") ?? undefined}
                />
                <p className={styles.personName}>{person.name}</p>
                {person.character === "" ? null : (
                  <p className={styles.character}>{person.character}</p>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </Skeleton>
    </section>
  );
};

export const SeasonsSection = ({ seasons }: { seasons: TmdbTvDetail["seasons"] }) => {
  if (seasons.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="seasons-heading" className={styles.section}>
      <h2 className={styles.heading} id="seasons-heading">
        Seasons
      </h2>
      <div className={styles.seasons}>
        {seasons.map((season) => {
          const year = yearFromDate(season.airDate);
          return (
            <article className={styles.season} key={season.id}>
              <p className={styles.seasonName}>{season.name}</p>
              <p className={styles.seasonMeta}>
                {season.episodeCount} {season.episodeCount === 1 ? "episode" : "episodes"}
                {year === null ? "" : ` · ${year}`}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export const WatchesSection = ({
  isPending,
  onDelete,
  onEdit,
  watches,
}: {
  isPending: boolean;
  onDelete: (id: string) => Promise<unknown>;
  onEdit: (id: string) => void;
  watches: WatchLog[];
}) => (
  <section aria-labelledby="watches-heading" className={styles.section}>
    <h2 className={styles.heading} id="watches-heading">
      Your watches
    </h2>
    <Skeleton label="Loading watches" lines={3} loading={isPending}>
      {watches.length === 0 ? (
        <p className={styles.overview}>Watches you log appear here, private to you.</p>
      ) : (
        <ul className={styles.logs}>
          {watches.map((watch) => (
            <li className={styles.log} key={watch.id}>
              <div className={styles.logHeader}>
                <div className={styles.logMeta}>
                  <p className={styles.logDate}>{formatWatchDate(watch.watchedOn)}</p>
                  {watch.season === null || watch.episode === null ? null : (
                    <p className={styles.logEpisode}>
                      Season {watch.season}, episode {watch.episode}
                    </p>
                  )}
                  {watch.rating === null ? null : (
                    <Rating
                      allowHalf
                      label="Your rating"
                      max={5}
                      readOnly
                      showValue
                      value={ratingToStars(watch.rating)}
                    />
                  )}
                </div>
                <div className={styles.logActions}>
                  <Button type="button" variant="secondary" onClick={() => onEdit(watch.id)}>
                    Edit watch
                  </Button>
                  <ConfirmMorph
                    confirmLabel="Delete"
                    doneLabel="Deleted"
                    label="Delete"
                    pendingLabel="Deleting"
                    prompt="Delete this watch?"
                    onConfirm={() => onDelete(watch.id)}
                  />
                </div>
              </div>
              {watch.review === null || watch.review === "" ? null : (
                <p className={styles.review}>{watch.review}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Skeleton>
  </section>
);
