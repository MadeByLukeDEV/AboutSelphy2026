// Roles come from the central auth service (auth.aboutselphy.com), which
// derives them from the user's Discord server roles on every sign-in -- this
// app never assigns them. Copied from the Social app; every authorization
// check goes through these helpers, never an inline role comparison.
//   - "admin": the owner. Everything, including owner-only settings.
//   - "moderator": staff. Can use the admin area; admin-only actions say so.
export const ADMIN_ROLE = "admin";
export const MODERATOR_ROLE = "moderator";

export type StaffRole = typeof ADMIN_ROLE | typeof MODERATOR_ROLE;

export function canAccessDashboard(role: string | null | undefined) {
  return role === ADMIN_ROLE || role === MODERATOR_ROLE;
}

export function isAdmin(role: string | null | undefined) {
  return role === ADMIN_ROLE;
}
