# Abide Connect

Abide Connect is a Progressive Web Application (PWA) developed for Abide Women’s Health Services. 
The goal of this project is to enhance community outreach, streamline volunteer and donor engagement, 
and provide an accessible, seamless user experience to engage with across devices.

## Features

Start-up Page:
- Abide logo and splash screen
- Automatic redirect to home page

Home page
- Hero/Carousel section
- Upcoming events section

- Volunteer signup section
  -  “Sign Up Now” button, redirects to sign up page

- Donation section with lists of available funds
- Services section

Events Page
- Calendar view with event details
- Event feed in chronological order
- Volunteers have access to volunteer-only events

Clinic Locator
- Map showing the closest mobile clinic

Pre-Signup Page
- Sign up page for volunteer, after signing up becomes volunteer dashboard

Post-Signup Volunteer Dashboard
- Calendar of events
- Volunteer hours log access

Admin Dashboard (Admin only)
- Overview Panel
  - Event management
  - Training Certificate approval
  - Volunteer hour log approval

Event Management
- Add Event (options: volunteer-only, public, internal)
- Current event list displayed below

Volunteer Hour Log
- Review and approve volunteer hour log

Training Certificate
- Review and approve volunteer’s training certificates
- Searchable certificate records

Event Details Page
- Event picture and detailed description
- RSVP functionality

## Tech Stack

This project uses Nuxt + Prisma as its main tech stack, with SQLite as the current database choice. 
- UI: NuxtUI
- Styling: Tailwind
- Input Validation: Zod

## Third Party Integrations

Currently, there are no third party integrations. However, we plan to integrate with Google Calander as to fetch and update events on Abide's timeline.


## Development
### Prerequisites

Ensure that you have `pnpm` installed for global usage. 

### Setup

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

### Development Server

> WARNING: You will see many warning messages during startup. This is normal. Ignore them!
> However, if any errors show up, they must be resolved.

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
# or
pnpm run dev

```

### Resettting the Database

After performing database operations, it may be good to reset the database to ensure you're working with the same starting set of data.

In order to achieve this, run the following commands:

```bash
pnpx prisma migrate reset
pnpx prisma db seed
```

### Production

> WARNING: You will see many warning messages during build. This is normal. Ignore them!
> However, if any errors show up, they must be resolved.

Build the application for production:

```bash
pnpm build
# or
pnpm run build
```
## Deploying to Production

There is currently a Github Actions flow setup such that for each commit to main, a new build is created and dockerized.
We can then manually deploy to the NPTS EC2 instances for prod and staging that are currently set up.