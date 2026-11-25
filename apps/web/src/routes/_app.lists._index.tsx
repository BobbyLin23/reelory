import { Lists } from "@/components/lists/lists";
import { pageTitle } from "@/i18n/meta";

import type { Route } from "./+types/_app.lists._index";

export const meta: Route.MetaFunction = ({ matches }: Route.MetaArgs) => [
  { title: pageTitle(matches, "nav.lists") },
];

const ListsIndex = () => <Lists />;

export default ListsIndex;
