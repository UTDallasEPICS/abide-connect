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