import { PageIntro } from "@/components/page-intro";

export const meta = () => [{ title: "Dashboard · reelory" }];

const Dashboard = () => (
  <PageIntro
    title="Dashboard"
    description="Your account at a glance, with the films and people you follow."
  />
);

export default Dashboard;
