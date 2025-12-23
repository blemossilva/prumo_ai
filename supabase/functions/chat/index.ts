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
        const { message } = await req.json();
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 1. Get settings
        const { data: settings } = await supabase.from('llm_settings').select('*').single();
        const provider = settings?.provider || 'openai';
        const model = settings?.model || 'gpt-4o-mini';

        // 2. Generate Embedding using Gemini (stable in this project)
        const embRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GOOGLE_AI_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: { parts: [{ text: message }] } })
        });

        if (!embRes.ok) throw new Error("Erro Gemini Embedding");
        const embData = await embRes.json();
        const queryEmbedding = embData.embedding.values;

        // 3. Search
        const { data: documents } = await supabase.rpc('match_document_chunks', {
            query_embedding: queryEmbedding,
            match_threshold: 0.1,
            match_count: 5,
        });

        const contextText = documents?.map((doc: any) => doc.content).join("\n---\n") || "Nenhuma informação no manual.";
        const systemPrompt = settings?.system_prompt || "És um assistente de RH.";
        const fullPrompt = `Contexto:\n${contextText}\n\nPergunta: ${message}`;

        let reply = "";

        // 4. LLM call (Keep flexible provider)
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
                    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: fullPrompt }],
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
