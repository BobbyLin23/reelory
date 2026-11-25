import { SignUp } from "@clerk/react-router";

import { AuthPage } from "@/components/auth-page";
import { useI18n } from "@/i18n/i18n";
import { pageTitle } from "@/i18n/meta";
import { normalizeAuthRedirect } from "@/utils/auth-redirect";
import { clerkAppearance } from "@/utils/clerk-appearance";

import type { Route } from "./+types/sign-up.$";

export const loader = ({ request }: Route.LoaderArgs) => normalizeAuthRedirect(request);

export const meta: Route.MetaFunction = ({ matches }: Route.MetaArgs) => [
  { title: pageTitle(matches, "auth.signUpTitle") },
];

const SignUpPage = () => {
  const { t } = useI18n();

  return (
    <AuthPage description={t("auth.signUpDescription")} title={t("auth.signUpTitle")}>
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
};

export default SignUpPage;
