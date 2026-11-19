import { SignIn } from "@clerk/react-router";
import { Link } from "react-router";

import styles from "@/components/sign-in-page.module.css";

export const meta = () => [{ title: "Sign in · reelory" }];

const SignInPage = () => (
  <main className={styles.page}>
    <div className={styles.panel}>
      <Link className={styles.brand} to="/">
        reelory
      </Link>
      <SignIn
        routing="path"
        path="/sign-in"
        fallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
      />
    </div>
  </main>
);

export default SignInPage;
