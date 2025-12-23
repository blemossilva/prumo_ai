import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        });
    }

    try {
        const url = new URL(req.url);
        const action = url.searchParams.get('action');
        const provider = url.searchParams.get('provider');

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. AI Model Listing
        if (action === 'list-models') {
            if (provider === 'openai') {
                const res = await fetch("https://api.openai.com/v1/models", {
                    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` }
                });
                const data = await res.json();
                const models = data.data
                    .filter((m: any) => m.id.startsWith('gpt-'))
                    .map((m: any) => ({ id: m.id, name: m.id }));
                return new Response(JSON.stringify({ models }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
            }

            if (provider === 'gemini') {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GOOGLE_AI_KEY}`);
                const data = await res.json();
                const models = data.models
                    .filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
                    .map((m: any) => ({ id: m.name.replace('models/', ''), name: m.displayName }));
                return new Response(JSON.stringify({ models }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
            }
        }

        // 2. User Management
        if (action === 'list-users') {
            // Join with auth.users would be ideal but since we only have public.profiles:
            const { data: users, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return new Response(JSON.stringify({ users }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
        }

        if (action === 'update-user') {
            const body = await req.json();
            const { id, ...updates } = body;
            if (!id) throw new Error("User ID required");

            const { error } = await supabase.from('profiles').update(updates).eq('id', id);
            if (error) throw error;

            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
        }

        if (action === 'create-user') {
            const { email, password, name, role } = await req.json();
            if (!email || !password) throw new Error("Email and Password required");

            const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { name, role: role || 'worker' }
            });

            if (authError) throw authError;

            // Profile is usually created by trigger, but if not:
            const { error: profileError } = await supabase.from('profiles').upsert({
                id: authUser.user.id,
                name: name || email,
                role: role || 'worker',
                active: true
            });

            if (profileError) throw profileError;

            return new Response(JSON.stringify({ success: true, user: authUser.user }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
        }

        if (action === 'delete-user') {
            const { id } = await req.json();
            if (!id) throw new Error("User ID required");

            // Delete from Auth
            const { error: authError } = await supabase.auth.admin.deleteUser(id);
            if (authError) throw authError;

            // Delete from public table (auth table requires auth.admin but service_role works for profiles)
            const { error } = await supabase.from('profiles').delete().eq('id', id);
            if (error) throw error;

            return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
        }

        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
    } catch (err: any) {
        console.error("[ADMIN-ACTIONS] Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
    }
});
