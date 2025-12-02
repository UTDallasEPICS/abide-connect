import { authClient } from '~~/server/utils/auth-client';
import { relativeFetch } from '@/lib/relativeFetch';



export default defineNuxtRouteMiddleware(async (to, _from) => {
	const { data: session } = await authClient.useSession(relativeFetch); 
	if (!session?.value?.session) {
		if (to.path.startsWith("/volunteer")) {
			return navigateTo("/auth/login");
		}
	}
});