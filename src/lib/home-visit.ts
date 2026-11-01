/** Presentation only: never used for access, identity or private cache keys. */
export const HOME_VISIT_COOKIE = "archive_home_visit";

export function homeVisitHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}
