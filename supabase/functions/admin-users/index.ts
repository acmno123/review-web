// Supabase Edge Function：管理員重設密碼、刪除帳號。
// 服務金鑰（SUPABASE_SERVICE_ROLE_KEY）由 Supabase 自動提供在伺服器端，不會傳到瀏覽器。
// 每次呼叫都會驗證呼叫者是否為 profiles.role = 'admin' 且未停用。
//
// 部署方式見 SUPABASE.md。

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "只接受 POST" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. 用呼叫者的登入權杖確認他是誰
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const caller = userData?.user;
    if (!caller) return json({ error: "請先登入" }, 401);

    // 2. 用服務金鑰確認他是管理員
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: me } = await admin
      .from("profiles")
      .select("role, disabled")
      .eq("id", caller.id)
      .single();
    if (!me || me.role !== "admin" || me.disabled) {
      return json({ error: "需要管理員權限" }, 403);
    }

    // 3. 執行操作
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    const userId = body?.userId;
    const password = body?.password;

    if (typeof userId !== "string" || !userId) return json({ error: "缺少 userId" }, 400);
    if (userId === caller.id) return json({ error: "不能對自己執行此操作" }, 400);

    if (action === "reset") {
      if (typeof password !== "string" || password.length < 6) {
        return json({ error: "新密碼至少需要 6 個字元" }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      // profiles 有 on delete cascade，刪除 auth 使用者時會一併刪除個人資料與學習紀錄
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "未知的操作" }, 400);
  } catch (err) {
    return json({ error: String((err as Error)?.message ?? err) }, 500);
  }
});
