import type { TmdbCredits, TmdbTvDetail } from "@reelory/api/tmdb/schemas";

import { Avatar } from "@/components/arc/avatar/avatar";
import { Button } from "@/components/arc/button/button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { Rating } from "@/components/arc/rating/rating";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { formatWatchDate, ratingToStars, tmdbImageUrl, yearFromDate } from "@/utils/media";

import styles from "./title-page.module.css";

const CAST_LIMIT = 12;
const CREW_ROLES = [
  ["Director", "Directed by"],
  ["Producer", "Produced by"],
  ["Executive Producer", "Executive production"],
] as const;

export interface WatchLog {
  episode: number | null;
  id: string;
  rating: number | null;
  review: string | null;
  season: number | null;
  watchedOn: string | null;
}

export const CrewSection = ({
  creators,
  credits,
  isTv,
}: {
  creators: TmdbTvDetail["createdBy"];
  credits: TmdbCredits | undefined;
  isTv: boolean;
}) => {
  const roles = CREW_ROLES.map(([job, label]) => ({
    label,
    names: (credits?.crew ?? []).filter((person) => person.job === job).map(({ name }) => name),
  }));
  const rows = [{ label: "Created by", names: creators.map(({ name }) => name) }, ...roles]
    .map(({ label, names }) => ({
      label,
      names: [...new Set(names.map((name) => name.trim()).filter(Boolean))],
    }))
    .filter(({ names }) => names.length > 0);
  if (rows.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="crew-heading" className={styles.section}>
      <h2 className={styles.heading} id="crew-heading">
        Crew
      </h2>
      {isTv && rows.some(({ label }) => label !== "Created by") ? (
        <p className={styles.note}>Directing and production credits are for the latest season.</p>
      ) : null}
      <dl className={styles.crew}>
        {rows.map(({ label, names }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{names.join(", ")}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
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
          <div aria-labelledby="cast-heading" className={styles.cast} role="region" tabIndex={0}>
            <ul className={styles.castList}>
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
          </div>
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
                  <p className={styles.logDate}>
                    {formatWatchDate(watch.watchedOn) ?? "Unknown date"}
                  </p>
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
