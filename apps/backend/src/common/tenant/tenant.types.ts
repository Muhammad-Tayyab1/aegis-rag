export type AuthenticatedUser = {
  id: string;
  tenantId: string;
  email: string;
  role: "admin" | "member";
};
