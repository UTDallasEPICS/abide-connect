
export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  event.context.session = session;


  if (!session?.session) {
    return;
  }

  const volunteer = await prisma.volunteer.findUnique({
    where: { userId: session?.user.id },
  })
 
  return volunteer
})
