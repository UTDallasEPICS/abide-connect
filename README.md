# Abide Connect

Abide Connect is a Progressive Web Application (PWA) developed for Abide Women’s Health Services. 
The goal of this project is to enhance community outreach, streamline volunteer and donor engagement, and provide an accessible, seamless user experience to engage with across devices. 

## Prerequisites

Ensure that you have `pnpm` installed for global usage. 

## Setup

After cloning the repository, install dependencies:

```bash
pnpm install
```

Next, make sure to create a `.env` file based on the `.env.example` file and fill in the required environment variables.

Then, initialize prisma client.

```bash
pnpx prisma generate
```

The generated client will be placed in `/server/utils/generated/prisma`.

Next, migrate and seed the database.

```bash
pnpx prisma migrate dev
pnpx prisma db seed
```

You are now ready to use/deploy the app!

## Development Server

> WARNING: You will see many warning messages during startup. This is normal. Ignore them!
> However, if any errors show up, they must be resolved.

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
# or
pnpm run dev

```

## Resettting the Database

After performing database operations, it may be good to reset the database to ensure you're working with the same starting set of data.

In order to achieve this, run the following commands:

```bash
pnpx prisma migrate reset
pnpx prisma db seed
```

## Production

> WARNING: You will see many warning messages during build. This is normal. Ignore them!
> However, if any errors show up, they must be resolved.

Build the application for production:

```bash
pnpm build
# or
pnpm run build
```
