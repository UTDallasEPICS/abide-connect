export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({ headers: event.headers });
  event.context.session = session;

  if (!session?.session) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: session?.user.id },
  })

  console.log("USER ON SERVER", user);
 
  return user;
})