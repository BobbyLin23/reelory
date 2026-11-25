import { LibraryHome } from "@/components/library-home/library-home";
import { pageTitle } from "@/i18n/meta";

import type { Route } from "./+types/_app._index";

export const meta: Route.MetaFunction = ({ matches }: Route.MetaArgs) => [
  { title: pageTitle(matches, "nav.records") },
];

const Records = () => <LibraryHome />;

export default Records;
