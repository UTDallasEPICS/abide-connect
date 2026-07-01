const SHOW_DEBUG = true;

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  event.context.session = session;


  if (!session?.session) {
    if (SHOW_DEBUG) {
      console.log(`Could not find volunteer object. Session is null.`);
    }

    return;
  }

  const volunteer = await prisma.volunteer.findUnique({
    where: { id: session?.user.id },
  })
  
  return volunteer
})
