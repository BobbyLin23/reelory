import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
  listItems: {
    list: r.one.lists({ from: r.listItems.listId, to: r.lists.id }),
  },
  lists: {
    items: r.many.listItems(),
  },
}));
