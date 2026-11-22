/**
 * Which deploy is running, for the "new version, reload" banner. Vercel sets these at build and
 * run time; locally there's no deploy, so the banner never shows.
 */
export function appVersion(): string {
  return process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || "dev";
}
