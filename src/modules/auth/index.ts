// Public surface of the auth module. The proxy imports ./session directly
// (it only needs getStaffSession/loginUrl, not the page/action guards).
export { getStaffSession, loginUrl, type StaffSession } from "./session";
export {
  requireStaff,
  requireAdmin,
  requireStaffPage,
  AuthorizationError,
} from "./guards";
export { canAccessDashboard, isAdmin, type StaffRole } from "./roles";
export { SignOutButton } from "./components/sign-out-button";
