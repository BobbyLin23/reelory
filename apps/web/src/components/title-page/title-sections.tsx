import type { TmdbCredits, TmdbTvDetail } from "@reelory/api/tmdb/schemas";

import { Avatar } from "@/components/arc/avatar/avatar";
import { Button } from "@/components/arc/button/button";
import { ConfirmMorph } from "@/components/arc/confirm-morph/confirm-morph";
import { Rating } from "@/components/arc/rating/rating";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { useI18n } from "@/i18n/i18n";
import type { MessageKey } from "@/i18n/messages";
import { formatWatchDate, ratingToStars, tmdbImageUrl, yearFromDate } from "@/utils/media";

import styles from "./title-page.module.css";

const CAST_LIMIT = 12;
const CREW_ROLES: readonly [string, MessageKey][] = [
  ["Director", "title.directedBy"],
  ["Producer", "title.producedBy"],
  ["Executive Producer", "title.executiveProduction"],
];

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
  const { t } = useI18n();
  const roles = CREW_ROLES.map(([job, key]) => ({
    label: t(key),
    names: (credits?.crew ?? []).filter((person) => person.job === job).map(({ name }) => name),
  }));
  const createdBy = {
    label: t("title.createdBy"),
    names: creators.map(({ name }) => name),
  };
  const rows = [createdBy, ...roles]
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
        {t("title.crew")}
      </h2>
      {isTv && roles.some(({ names }) => names.length > 0) ? (
        <p className={styles.note}>{t("title.crewNote")}</p>
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
  const { t } = useI18n();
  const cast = [...(credits?.cast ?? [])]
    .toSorted((left, right) => left.order - right.order)
    .slice(0, CAST_LIMIT);
  if (!isPending && cast.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="cast-heading" className={styles.section}>
      <h2 className={styles.heading} id="cast-heading">
        {t("title.cast")}
      </h2>
      <Skeleton label={t("title.loadingCast")} lines={2} loading={isPending}>
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
  const { t } = useI18n();

  if (seasons.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="seasons-heading" className={styles.section}>
      <h2 className={styles.heading} id="seasons-heading">
        {t("title.seasons")}
      </h2>
      <div className={styles.seasons}>
        {seasons.map((season) => {
          const year = yearFromDate(season.airDate);
          return (
            <article className={styles.season} key={season.id}>
              <p className={styles.seasonName}>{season.name}</p>
              <p className={styles.seasonMeta}>
                {t("count.episodes", { count: season.episodeCount })}
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
}) => {
  const { locale, t } = useI18n();

  return (
    <section aria-labelledby="watches-heading" className={styles.section}>
      <h2 className={styles.heading} id="watches-heading">
        {t("title.yourWatches")}
      </h2>
      <Skeleton label={t("title.loadingWatches")} lines={3} loading={isPending}>
        {watches.length === 0 ? (
          <p className={styles.overview}>{t("title.noWatches")}</p>
        ) : (
          <ul className={styles.logs}>
            {watches.map((watch) => (
              <li className={styles.log} key={watch.id}>
                <div className={styles.logHeader}>
                  <div className={styles.logMeta}>
                    <p className={styles.logDate}>
                      {formatWatchDate(watch.watchedOn, locale) ?? t("common.unknownDate")}
                    </p>
                    {watch.season === null || watch.episode === null ? null : (
                      <p className={styles.logEpisode}>
                        {t("title.seasonEpisode", {
                          episode: watch.episode,
                          season: watch.season,
                        })}
                      </p>
                    )}
                    {watch.rating === null ? null : (
                      <Rating
                        allowHalf
                        formatSpokenValue={(value, max) => t("arc.rating.spoken", { max, value })}
                        formatValue={(value, max) => t("arc.rating.value", { max, value })}
                        label={t("title.yourRating")}
                        max={5}
                        readOnly
                        showValue
                        value={ratingToStars(watch.rating)}
                      />
                    )}
                  </div>
                  <div className={styles.logActions}>
                    <Button type="button" variant="secondary" onClick={() => onEdit(watch.id)}>
                      {t("title.editWatch")}
                    </Button>
                    <ConfirmMorph
                      cancelLabel={t("common.cancel")}
                      confirmLabel={t("common.delete")}
                      doneLabel={t("common.deleted")}
                      errorLabel={t("common.errorLabel")}
                      label={t("common.delete")}
                      pendingLabel={t("common.deleting")}
                      prompt={t("title.deleteWatchPrompt")}
                      retryLabel={t("common.tryAgain")}
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
};
