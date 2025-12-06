export default defineEventHandler(async (event) => {
    const session = await auth.api.getSession({ headers: event.headers })
    const volunteer = await prisma.volunteer.findUnique({
        where: { id: session?.user.id }
    })
    return volunteer
})