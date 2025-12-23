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
        const { message, agent_id } = await req.json();
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Get Settings (Agent-specific or Global)
        let model = 'gpt-4o-mini';
        let provider = 'openai';
        let systemPrompt = 'És um assistente útil.';
        let knowledgeText = '';

        if (agent_id) {
            const { data: agent } = await supabase
                .from('agents')
                .select('*')
                .eq('id', agent_id)
                .single();

            if (agent) {
                model = agent.model || model;
                provider = agent.provider || provider;
                systemPrompt = agent.system_prompt || systemPrompt;
                knowledgeText = agent.knowledge_text || '';
            }
        } else {
            const { data: globalSettings } = await supabase
                .from('llm_settings')
                .select('*')
                .single();

            if (globalSettings) {
                model = globalSettings.model || model;
                provider = globalSettings.provider || provider;
                systemPrompt = globalSettings.system_prompt || systemPrompt;
            }
        }

        // 2. Generate Embedding using Gemini
        const embRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GOOGLE_AI_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: { parts: [{ text: message }] } })
        });

        if (!embRes.ok) throw new Error("Erro Gemini Embedding");
        const embData = await embRes.json();
        const queryEmbedding = embData.embedding.values;

        // 3. Search related chunks for this specific agent
        const { data: documents } = await supabase.rpc('match_document_chunks', {
            query_embedding: queryEmbedding,
            match_threshold: 0.1,
            match_count: 5,
            p_agent_id: agent_id || null
        });

        const vectorContext = documents?.map((doc: any) => doc.content).join("\n---\n") || "";

        // Combine manual knowledge text + vector context
        const contextText = [knowledgeText, vectorContext].filter(Boolean).join("\n---\n") || "Nenhuma informação adicional disponível.";

        const fullPrompt = `Contexto de Conhecimento:\n${contextText}\n\nPergunta do Utilizador: ${message}`;

        let reply = "";

        // 4. LLM call
        if (provider === 'gemini') {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_AI_KEY}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\n${fullPrompt}` }] }] })
            });
            const data = await response.json();
            if (data.error) throw new Error(`Gemini: ${data.error.message}`);
            reply = data.candidates[0].content.parts[0].text;
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
            if (data.error) throw new Error(`OpenAI: ${data.error.message}`);
            reply = data.choices[0].message.content;
        }

        return new Response(JSON.stringify({ reply }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
    } catch (err: any) {
        console.error("[CHAT] Fatal:", err.message);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }
});
