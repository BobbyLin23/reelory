import { PageIntro } from "@/components/page-intro";

export const meta = () => [{ title: "Home · reelory" }];

export default function Home() {
  return <PageIntro title="Home" description="Your recent activity and what to watch next." />;
}
