import { PageIntro } from "@/components/page-intro";

export const meta = () => [{ title: "Home · reelory" }];

export default function Home() {
  return (
    <PageIntro
      title="Home"
      description="Your library of films and series, and what to watch next."
    />
  );
}
