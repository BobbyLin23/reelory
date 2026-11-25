import { Discover } from "@/components/discover/discover";
import { pageTitle } from "@/i18n/meta";

import type { Route } from "./+types/_app.discover";

export const meta: Route.MetaFunction = ({ matches }: Route.MetaArgs) => [
  { title: pageTitle(matches, "nav.discover") },
];

const DiscoverRoute = () => <Discover />;

export default DiscoverRoute;
