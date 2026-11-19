import { SignIn } from "@clerk/react-router";

import { AuthPage } from "@/components/auth-page";
import { normalizeAuthRedirect } from "@/utils/auth-redirect";
import { clerkAppearance } from "@/utils/clerk-appearance";

import type { Route } from "./+types/sign-in.$";

export const loader = ({ request }: Route.LoaderArgs) => normalizeAuthRedirect(request);

export const meta = () => [{ title: "Sign in · reelory" }];

const SignInPage = () => (
  <AuthPage title="Sign in" description="Continue to your lists, stats, and saved films.">
    <SignIn
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
      appearance={clerkAppearance}
    />
  </AuthPage>
);

export default SignInPage;
