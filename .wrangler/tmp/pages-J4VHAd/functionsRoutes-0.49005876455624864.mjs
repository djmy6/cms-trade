import { onRequestPut as __api_admin_users__id__role_js_onRequestPut } from "D:\\cms-trade\\functions\\api\\admin\\users\\[id]\\role.js"
import { onRequestDelete as __api_admin_users__id__js_onRequestDelete } from "D:\\cms-trade\\functions\\api\\admin\\users\\[id].js"
import { onRequestGet as __api_admin_posts_js_onRequestGet } from "D:\\cms-trade\\functions\\api\\admin\\posts.js"
import { onRequestGet as __api_admin_stats_js_onRequestGet } from "D:\\cms-trade\\functions\\api\\admin\\stats.js"
import { onRequestGet as __api_admin_users_js_onRequestGet } from "D:\\cms-trade\\functions\\api\\admin\\users.js"
import { onRequestDelete as __api_posts__id__js_onRequestDelete } from "D:\\cms-trade\\functions\\api\\posts\\[id].js"
import { onRequestGet as __api_posts__id__js_onRequestGet } from "D:\\cms-trade\\functions\\api\\posts\\[id].js"
import { onRequestPut as __api_posts__id__js_onRequestPut } from "D:\\cms-trade\\functions\\api\\posts\\[id].js"
import { onRequestPost as __api_export_js_onRequestPost } from "D:\\cms-trade\\functions\\api\\export.js"
import { onRequestPost as __api_login_js_onRequestPost } from "D:\\cms-trade\\functions\\api\\login.js"
import { onRequestGet as __api_me_js_onRequestGet } from "D:\\cms-trade\\functions\\api\\me.js"
import { onRequestGet as __api_posts_js_onRequestGet } from "D:\\cms-trade\\functions\\api\\posts.js"
import { onRequestPost as __api_posts_js_onRequestPost } from "D:\\cms-trade\\functions\\api\\posts.js"
import { onRequestPost as __api_register_js_onRequestPost } from "D:\\cms-trade\\functions\\api\\register.js"
import { onRequestPost as __api_send_code_js_onRequestPost } from "D:\\cms-trade\\functions\\api\\send-code.js"
import { onRequestGet as __api_settings_js_onRequestGet } from "D:\\cms-trade\\functions\\api\\settings.js"
import { onRequestPut as __api_settings_js_onRequestPut } from "D:\\cms-trade\\functions\\api\\settings.js"

export const routes = [
    {
      routePath: "/api/admin/users/:id/role",
      mountPath: "/api/admin/users/:id",
      method: "PUT",
      middlewares: [],
      modules: [__api_admin_users__id__role_js_onRequestPut],
    },
  {
      routePath: "/api/admin/users/:id",
      mountPath: "/api/admin/users",
      method: "DELETE",
      middlewares: [],
      modules: [__api_admin_users__id__js_onRequestDelete],
    },
  {
      routePath: "/api/admin/posts",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_posts_js_onRequestGet],
    },
  {
      routePath: "/api/admin/stats",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_stats_js_onRequestGet],
    },
  {
      routePath: "/api/admin/users",
      mountPath: "/api/admin",
      method: "GET",
      middlewares: [],
      modules: [__api_admin_users_js_onRequestGet],
    },
  {
      routePath: "/api/posts/:id",
      mountPath: "/api/posts",
      method: "DELETE",
      middlewares: [],
      modules: [__api_posts__id__js_onRequestDelete],
    },
  {
      routePath: "/api/posts/:id",
      mountPath: "/api/posts",
      method: "GET",
      middlewares: [],
      modules: [__api_posts__id__js_onRequestGet],
    },
  {
      routePath: "/api/posts/:id",
      mountPath: "/api/posts",
      method: "PUT",
      middlewares: [],
      modules: [__api_posts__id__js_onRequestPut],
    },
  {
      routePath: "/api/export",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_export_js_onRequestPost],
    },
  {
      routePath: "/api/login",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_login_js_onRequestPost],
    },
  {
      routePath: "/api/me",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_me_js_onRequestGet],
    },
  {
      routePath: "/api/posts",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_posts_js_onRequestGet],
    },
  {
      routePath: "/api/posts",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_posts_js_onRequestPost],
    },
  {
      routePath: "/api/register",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_register_js_onRequestPost],
    },
  {
      routePath: "/api/send-code",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_send_code_js_onRequestPost],
    },
  {
      routePath: "/api/settings",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_settings_js_onRequestGet],
    },
  {
      routePath: "/api/settings",
      mountPath: "/api",
      method: "PUT",
      middlewares: [],
      modules: [__api_settings_js_onRequestPut],
    },
  ]