import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

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
        const body = await req.json();
        const { message, agent_id } = body;
        console.log(`[CHAT] Iniciando solicitação para agent_id: ${agent_id || 'Global'}`);

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Get User and Tenant ID
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error("[CHAT] Header de Autorização ausente");
            throw new Error("Autorização necessária");
        }

        const token = authHeader.replace('Bearer ', '');
        console.log("[CHAT] Verificando token JWT...");
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.error("[CHAT] Erro na autenticação do utilizador:", authError?.message);
            throw new Error(`Falha na autenticação: ${authError?.message || 'Utilizador inválido'}`);
        }
        console.log(`[CHAT] Utilizador autenticado: ${user.id}`);

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            console.error("[CHAT] Erro ao buscar perfil:", profileError?.message);
            throw new Error("Perfil de utilizador não encontrado");
        }

        const tenant_id = profile.tenant_id;
        console.log(`[CHAT] Tenant identificado: ${tenant_id}`);

        // 2. Get Settings (Agent-specific or Global)
        let model = 'gpt-4o-mini';
        let provider = 'openai';
        let systemPrompt = 'És um assistente útil.';
        let knowledgeText = '';

        if (agent_id) {
            console.log(`[CHAT] Buscando configurações do agente ${agent_id}...`);
            const { data: agent, error: agentError } = await supabase
                .from('agents')
                .select('*')
                .eq('id', agent_id)
                .single();

            if (agentError || !agent) {
                console.error("[CHAT] Agente não encontrado:", agentError?.message);
                throw new Error("Agente inexistente");
            }

            // Security check: Ensure agent belongs to user's tenant
            if (agent.tenant_id && agent.tenant_id !== tenant_id) {
                console.error(`[CHAT] Acesso negado: Agente tenant (${agent.tenant_id}) != Utilizador tenant (${tenant_id})`);
                throw new Error("Acesso não autorizado a este agente");
            }
            model = agent.model || model;
            provider = agent.provider || provider;
            systemPrompt = agent.system_prompt || systemPrompt;
            knowledgeText = agent.knowledge_text || '';
        } else {
            console.log("[CHAT] Buscando configurações globais do tenant...");
            const { data: globalSettings } = await supabase
                .from('llm_settings')
                .select('*')
                .eq('tenant_id', tenant_id)
                .single();

            if (globalSettings) {
                model = globalSettings.model || model;
                provider = globalSettings.provider || provider;
                systemPrompt = globalSettings.system_prompt || systemPrompt;
            }
        }
        console.log(`[CHAT] Usando Provider: ${provider}, Model: ${model}`);

        // 3. Generate Embedding
        let queryEmbedding = [];
        console.log(`[CHAT] Gerando embedding com ${provider || 'openai'}...`);

        if (provider === 'openai') {
            if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada no Supabase");
            const embRes = await fetch("https://api.openai.com/v1/embeddings", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    input: message,
                    model: "text-embedding-3-small",
                    dimensions: 768
                })
            });

            if (!embRes.ok) {
                const errorData = await embRes.json();
                console.error("[CHAT] Erro OpenAI Embedding:", errorData);
                throw new Error(`OpenAI Embedding Fail: ${errorData.error?.message || embRes.statusText}`);
            }
            const embData = await embRes.json();
            queryEmbedding = embData.data[0].embedding;

            // Record Embedding Token Usage
            await supabase.from('token_usage').insert({
                tenant_id,
                user_id: user.id,
                agent_id: agent_id || null,
                type: 'embedding',
                model: 'text-embedding-3-small',
                input_tokens: embData.usage?.prompt_tokens || 0,
                output_tokens: 0,
                total_tokens: embData.usage?.total_tokens || 0,
                metadata: { context: 'chat_query' }
            });
        } else {
            if (!GOOGLE_AI_KEY) throw new Error("GOOGLE_AI_KEY não configurada no Supabase");
            const embRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GOOGLE_AI_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: { parts: [{ text: message }] } })
            });

            if (!embRes.ok) {
                const errorData = await embRes.json();
                console.error("[CHAT] Erro Gemini Embedding:", errorData);
                throw new Error(`Gemini Embedding Fail: ${errorData.error?.message || embRes.statusText}`);
            }
            const embData = await embRes.json();
            queryEmbedding = embData.embedding.values;

            // Gemini doesn't always return usage for embeddings, so we estimate (1 token ~ 4 chars)
            const estimatedTokens = Math.ceil(message.length / 4);
            await supabase.from('token_usage').insert({
                tenant_id,
                user_id: user.id,
                agent_id: agent_id || null,
                type: 'embedding',
                model: 'text-embedding-004',
                input_tokens: estimatedTokens,
                output_tokens: 0,
                total_tokens: estimatedTokens,
                metadata: { context: 'chat_query', estimated: true }
            });
        }

        // 4. Search related chunks
        console.log("[CHAT] Buscando chunks via RPC match_document_chunks...");
        const { data: documents, error: rpcError } = await supabase.rpc('match_document_chunks', {
            query_embedding: queryEmbedding,
            match_threshold: 0.1,
            match_count: 5,
            p_agent_id: agent_id || null,
            p_tenant_id: tenant_id
        });

        if (rpcError) {
            console.error("[CHAT] RPC match_document_chunks Error:", rpcError.message);
        }

        const vectorContext = documents?.map((doc: any) => doc.content).join("\n---\n") || "";
        const contextText = [knowledgeText, vectorContext].filter(Boolean).join("\n---\n") || "Nenhuma informação adicional disponível.";
        console.log(`[CHAT] Contexto recuperado (${contextText.length} chars)`);

        const fullPrompt = `Contexto de Conhecimento:\n${contextText}\n\nPergunta do Utilizador: ${message}`;
        let reply = "";

        // 5. LLM call
        console.log("[CHAT] Invocando LLM...");
        if (provider === 'gemini') {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_AI_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\n${fullPrompt}` }] }] })
            });
            const data = await response.json();
            if (data.error) throw new Error(`Gemini LLM Error: ${data.error.message}`);
            reply = data.candidates[0].content.parts[0].text;

            // Record Gemini Token Usage
            await supabase.from('token_usage').insert({
                tenant_id,
                user_id: user.id,
                agent_id: agent_id || null,
                type: 'chat',
                model: model,
                input_tokens: data.usageMetadata?.promptTokenCount || 0,
                output_tokens: data.usageMetadata?.candidatesTokenCount || 0,
                total_tokens: data.usageMetadata?.totalTokenCount || 0,
                metadata: { provider: 'gemini' }
            });
        } else {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: fullPrompt }
                    ],
                }),
            });
            const data = await response.json();
            if (data.error) {
                console.error("[CHAT] Erro OpenAI Chat:", data.error);
                throw new Error(`OpenAI Chat Error: ${data.error.message}`);
            }
            reply = data.choices[0].message.content;

            // Record OpenAI Token Usage
            await supabase.from('token_usage').insert({
                tenant_id,
                user_id: user.id,
                agent_id: agent_id || null,
                type: 'chat',
                model: model,
                input_tokens: data.usage?.prompt_tokens || 0,
                output_tokens: data.usage?.completion_tokens || 0,
                total_tokens: data.usage?.total_tokens || 0,
                metadata: { provider: 'openai' }
            });
        }

        console.log("[CHAT] Sucesso! Enviando resposta.");
        return new Response(JSON.stringify({ reply }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    } catch (err: any) {
        console.error("[CHAT] ERRO CRÍTICO:", err.message);
        return new Response(JSON.stringify({
            error: err.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }
});
