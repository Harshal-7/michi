/**
 * The passphrase sign-in is switched off for now (Harshal, 22 Nov 2026): every page, action and
 * route works without it, on production and previews alike. TODO: set this back to true in a later
 * round. The passphrase hash, the sign-in page and the sessions table all stay, so switching it on
 * again needs nothing else; devices then sign in once as before.
 */
export const SIGN_IN_REQUIRED = false;
