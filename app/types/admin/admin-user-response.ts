/**
 * Response shape of `server/api/admin/users.get.ts`, for the paginated member
 * list on /admin/member-management.
 *
 * `counts` is what populates the filter tabs' badges: `all` ignores the active
 * role filter (so the tab totals stay stable as you switch between them) while
 * still respecting the current search.
 *
 * `hours` is the sum of *approved* hour logs only.
 */

// Mirrors the UserRole enum in prisma/schema/user.prisma — kept as a literal
// union rather than imported, since the generated Prisma client is server-only.
export type UserRole = 'USER' | 'ADMIN' | 'VOLUNTEER';

export interface ApiUser {
  id: string
  name: string
  email: string
  roles: UserRole[]
  hours: number
  avatarUrl?: string | null
}

export interface UsersResponse {
  users: ApiUser[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  counts: { all: number; volunteer: number; admin: number }
}