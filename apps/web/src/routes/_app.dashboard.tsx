import { PageIntro } from "@/components/page-intro";

export const meta = () => [{ title: "Dashboard · reelory" }];

const Dashboard = () => (
  <PageIntro
    title="Dashboard"
    description="A private summary of your account and viewing history."
  />
);

export default Dashboard;
