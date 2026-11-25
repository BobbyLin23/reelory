import { zhCN } from "@clerk/localizations";

/**
 * Clerk ships a Simplified Chinese resource, but the version this app installs
 * predates the sign-up password placeholder, so that one string is filled here.
 *
 * Clerk's "Secured by Clerk" branding and development-mode badge have no
 * localization keys, so they cannot be translated here. The branding is removed
 * in the Clerk Dashboard under Settings → Branding; the badge is a development
 * warning that does not appear in production.
 */
export const clerkZh = {
  ...zhCN,
  formFieldInputPlaceholder__signUpPassword: "创建密码",
};
