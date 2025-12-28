import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        });
    }

    try {
        const { emails } = await req.json();
        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            throw new Error("Lista de emails é obrigatória");
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Get authenticated user
        const authHeader = req.headers.get('Authorization');
        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader?.split(' ')[1]);
        if (authError || !user) throw new Error("Não autorizado");

        // Get admin's profile
        const { data: adminProfile } = await supabase
            .from('profiles')
            .select('tenant_id, role, is_super_admin')
            .eq('id', user.id)
            .single();

        if (!adminProfile || (adminProfile.role !== 'admin' && !adminProfile.is_super_admin)) {
            throw new Error("Apenas administradores podem enviar convites");
        }

        const tenant_id = adminProfile.tenant_id;

        // Fetch tenant name for the email template
        const { data: tenant } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', tenant_id)
            .single();

        const results = [];

        for (const email of emails) {
            try {
                // Check if user already exists in profiles
                const { data: existingProfile } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('email', email)
                    .maybeSingle();

                if (existingProfile) {
                    results.push({ email, status: 'already_member', success: false, error: 'Utilizador já é membro' });
                    continue;
                }

                // Check if there is a pending invitation
                const { data: existingInvite } = await supabase
                    .from('invitations')
                    .select('*')
                    .eq('email', email)
                    .eq('tenant_id', tenant_id)
                    .maybeSingle();

                if (existingInvite && existingInvite.status === 'pending') {
                    // Resend
                    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
                        redirectTo: `${req.headers.get('origin')}/`,
                        data: { tenant_name: tenant?.name || 'Nexio AI' }
                    });

                    if (inviteError) throw inviteError;
                    results.push({ email, status: 'resent', success: true });
                } else if (existingInvite && existingInvite.status === 'accepted') {
                    results.push({ email, status: 'already_member', success: false, error: 'Utilizador já é membro' });
                } else {
                    // Create invitation record BEFORE calling inviteUserByEmail
                    const { error: dbError } = await supabase
                        .from('invitations')
                        .insert({
                            email,
                            tenant_id,
                            invited_by: user.id,
                            status: 'pending'
                        });

                    if (dbError) throw dbError;

                    // Now send the invitation email
                    const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
                        redirectTo: `${req.headers.get('origin')}/`,
                        data: { tenant_name: tenant?.name || 'Nexio AI' }
                    });

                    if (inviteError) {
                        // If invite fails, delete the invitation record
                        await supabase
                            .from('invitations')
                            .delete()
                            .eq('email', email)
                            .eq('tenant_id', tenant_id);
                        throw inviteError;
                    }

                    results.push({ email, status: 'sent', success: true });
                }
            } catch (err: any) {
                console.error(`Error inviting ${email}:`, err);
                results.push({ email, status: 'error', success: false, error: err.message });
            }
        }

        return new Response(JSON.stringify({ results }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    } catch (err: any) {
        console.error("[SEND-INVITATIONS] Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }
});
