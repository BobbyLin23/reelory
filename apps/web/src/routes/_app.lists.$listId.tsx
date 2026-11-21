import { EmptyState } from "@/components/arc/empty-state/empty-state";
import { ListDetail } from "@/components/lists/list-detail";

import type { Route } from "./+types/_app.lists.$listId";

const LIST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export const meta = () => [{ title: "List · reelory" }];

const ListRoute = ({ params }: Route.ComponentProps) => {
  if (!LIST_ID.test(params.listId)) {
    return (
      <EmptyState
        description="The link is missing a list id."
        title="This list link is not valid"
      />
    );
  }

  return <ListDetail listId={params.listId} />;
};

export default ListRoute;
