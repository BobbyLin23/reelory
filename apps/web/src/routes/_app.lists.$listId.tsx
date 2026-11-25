import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { ListDetail } from "@/components/lists/list-detail";
import { useI18n } from "@/i18n/i18n";
import { pageTitle } from "@/i18n/meta";

import type { Route } from "./+types/_app.lists.$listId";

const LIST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export const meta: Route.MetaFunction = ({ matches }: Route.MetaArgs) => [
  { title: pageTitle(matches, "lists.title") },
];

const ListRoute = ({ params }: Route.ComponentProps) => {
  const { t } = useI18n();

  if (!LIST_ID.test(params.listId)) {
    return (
      <EmptyState
        description={t("errors.invalidListDescription")}
        title={t("errors.invalidListTitle")}
      />
    );
  }

  return <ListDetail listId={params.listId} />;
};

export default ListRoute;
