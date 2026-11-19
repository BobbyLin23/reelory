import { PageIntro } from "@/components/page-intro";

export const meta = () => [{ title: "Settings · reelory" }];

export default function Settings() {
  return <PageIntro title="Settings" description="Account, appearance, and other preferences." />;
}
