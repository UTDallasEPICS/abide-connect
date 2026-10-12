export const routes = [
  {
    name: "admin_donations",
    path: "/admin/donations",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/admin/donations.vue")
  },
  {
    name: "admin_index",
    path: "/admin",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/admin/index.vue")
  },
  {
    name: "admin_member_management_id",
    path: "/admin/member-management/:id",
    params: ["id"],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/admin/member-management/[id].vue")
  },
  {
    name: "admin_member_management_index",
    path: "/admin/member-management",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/admin/member-management/index.vue")
  },
  {
    name: "admin_reports_impact",
    path: "/admin/reports/impact",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/admin/reports/impact.vue")
  },
  {
    name: "admin_reports_index",
    path: "/admin/reports",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/admin/reports/index.vue")
  },
  {
    name: "admin_training_index",
    path: "/admin/training",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/admin/training/index.vue")
  },
  {
    name: "admin_volunteer_logs_index",
    path: "/admin/volunteer-logs",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/admin/volunteer-logs/index.vue")
  },
  {
    name: "auth_complete",
    path: "/auth/complete",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/auth/complete.vue")
  },
  {
    name: "auth_login",
    path: "/auth/login",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/auth/login.vue")
  },
  {
    name: "auth_sign_up_verify",
    path: "/auth/sign-up-verify",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/auth/sign-up-verify.vue")
  },
  {
    name: "auth_sign_up",
    path: "/auth/sign-up",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/auth/sign-up.vue")
  },
  {
    name: "auth_staff_login",
    path: "/auth/staff-login",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/auth/staff-login.vue")
  },
  {
    name: "events_id",
    path: "/events/:id",
    params: ["id"],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/events/[id].vue")
  },
  {
    name: "events_index",
    path: "/events",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/events/index.vue")
  },
  {
    name: "events_list",
    path: "/events/list",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/events/list.vue")
  },
  {
    name: "events_manage",
    path: "/events/manage",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/events/manage.vue")
  },
  {
    name: "index",
    path: "/",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/index.vue")
  },
  {
    name: "ingest",
    path: "/ingest",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/ingest.vue")
  },
  {
    name: "mobileClinic",
    path: "/mobileClinic",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/mobileClinic.vue")
  },
  {
    name: "rsvp_cancel",
    path: "/rsvp/cancel",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/rsvp/cancel.vue")
  },
  {
    name: "settings",
    path: "/settings",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/settings.vue")
  },
  {
    name: "unauthorized",
    path: "/unauthorized",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/unauthorized.vue")
  },
  {
    name: "volunteer_index",
    path: "/volunteer",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/volunteer/index.vue")
  },
  {
    name: "volunteer_application_completed",
    path: "/volunteer-application/completed",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/volunteer-application/completed.vue")
  },
  {
    name: "volunteer_application_form_required",
    path: "/volunteer-application/form-required",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/volunteer-application/form-required.vue")
  },
  {
    name: "volunteer_application_index",
    path: "/volunteer-application",
    params: [],
    component: () => import("/home/vikachubro21/Documents/repos/abide-connect/app/pages/volunteer-application/index.vue")
  }
]
