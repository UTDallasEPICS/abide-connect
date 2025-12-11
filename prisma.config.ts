import path from "node:path";
import type { PrismaConfig } from "prisma";
import dotenv from "dotenv";
import { env } from "prisma/config"

dotenv.config();

export default {
	schema: path.join("prisma", "schema"),
	migrations: {
		path: path.join("prisma", "migrations"),
		seed: "ts-node ./server/utils/seed.ts",
	},
	datasource: {
		url: import.meta.env.DATABASE_URL
	}
} satisfies PrismaConfig;
