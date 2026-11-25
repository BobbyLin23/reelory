import { SignIn } from "@clerk/react-router";

import { AuthPage } from "@/components/auth-page";
import { useI18n } from "@/i18n/i18n";
import { pageTitle } from "@/i18n/meta";
import { normalizeAuthRedirect } from "@/utils/auth-redirect";
import { clerkAppearance } from "@/utils/clerk-appearance";

import type { Route } from "./+types/sign-in.$";

export const loader = ({ request }: Route.LoaderArgs) => normalizeAuthRedirect(request);

export const meta: Route.MetaFunction = ({ matches }: Route.MetaArgs) => [
  { title: pageTitle(matches, "auth.signInTitle") },
];

const SignInPage = () => {
  const { t } = useI18n();

  return (
    <AuthPage description={t("auth.signInDescription")} title={t("auth.signInTitle")}>
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
};

export default SignInPage;
