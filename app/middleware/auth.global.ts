import { authClient } from '~~/server/utils/auth-client';

export default defineNuxtRouteMiddleware(async (to, _from) => {
	const { data } = await authClient.useSession(useFetch); 
	if (to.path.startsWith("/volunteer")) {
		if (!data) {
			return navigateTo("/auth/login");
		}
	}
});