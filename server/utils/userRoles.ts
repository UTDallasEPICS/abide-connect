import prisma from './prisma'

/**
 * A user's active roles, lowercased — `['user', 'admin']`.
 *
 * The single definition of "what roles does this person have", shared by
 * `/api/user/roles` and by the sign-in endpoints that hand roles back with the
 * session they just minted. Casing is normalised here because the column stores
 * them upper-case (`USER`, `ADMIN`) while every caller compares lower-case.
 */
export async function activeRoles(userId: string): Promise<string[]> {
  const rows = await prisma.user_Role.findMany({
    where: { userId, active: true },
    select: { role: true },
  })
  return rows.map(r => r.role.toLowerCase())
}
