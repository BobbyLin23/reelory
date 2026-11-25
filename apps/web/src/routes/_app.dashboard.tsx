import { PageIntro } from "@/components/page-intro";
import { useI18n } from "@/i18n/i18n";
import { pageTitle } from "@/i18n/meta";

import type { Route } from "./+types/_app.dashboard";

export const meta: Route.MetaFunction = ({ matches }: Route.MetaArgs) => [
  { title: pageTitle(matches, "dashboard.title") },
];

const Dashboard = () => {
  const { t } = useI18n();

  return <PageIntro description={t("dashboard.description")} title={t("dashboard.title")} />;
};

export default Dashboard;
