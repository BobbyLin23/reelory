import { SignUp } from "@clerk/react-router";

import { AuthPage } from "@/components/auth-page";
import { normalizeAuthRedirect } from "@/utils/auth-redirect";
import { clerkAppearance } from "@/utils/clerk-appearance";

import type { Route } from "./+types/sign-up.$";

export const loader = ({ request }: Route.LoaderArgs) => normalizeAuthRedirect(request);

export const meta = () => [{ title: "Create an account · reelory" }];

const SignUpPage = () => (
  <AuthPage
    title="Create an account"
    description="Keep your lists, stats, and saved films in one place."
  >
    <SignUp
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
      fallbackRedirectUrl="/"
      signInFallbackRedirectUrl="/"
      appearance={clerkAppearance}
    />
  </AuthPage>
);

export default SignUpPage;
