import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY") ?? "";
const LITELLM_PRICES_URL = "https://raw.githubusercontent.com/berriai/litellm/main/model_prices_and_context_window.json";

Deno.serve(async (req: Request) => {
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Fetch Model Lists from Providers
        const [openAiRes, geminiRes, priceRes] = await Promise.all([
            fetch("https://api.openai.com/v1/models", {
                headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` }
            }),
            fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GOOGLE_AI_KEY}`),
            fetch(LITELLM_PRICES_URL)
        ]);

        if (!priceRes.ok) throw new Error("Falha ao buscar preços do LiteLLM");
        const externalPrices = await priceRes.json();

        const discoveredModels: { id: string, provider: string }[] = [];

        // Parse OpenAI Models
        if (openAiRes.ok) {
            const data = await openAiRes.json();
            const models = data.data
                .filter((m: any) => m.id.startsWith('gpt-') || m.id.startsWith('text-embedding-'))
                .forEach((m: any) => discoveredModels.push({ id: m.id, provider: 'openai' }));
        }

        // Parse Gemini Models
        if (geminiRes.ok) {
            const data = await geminiRes.json();
            data.models
                ?.filter((m: any) => m.supportedGenerationMethods.includes('generateContent') || m.supportedGenerationMethods.includes('embedContent'))
                .forEach((m: any) => {
                    discoveredModels.push({ id: m.name.replace('models/', ''), provider: 'gemini' });
                });
        }

        // 2. Get currently active records to avoid redundant inserts
        const { data: activePrices } = await supabase
            .from('llm_prices')
            .select('*')
            .is('valid_to', null);

        const now = new Date().toISOString();
        const results = { newly_added: 0, updated: 0, ignored: 0 };

        for (const modelInfo of discoveredModels) {
            const modelKey = modelInfo.id;
            const externalData = externalPrices[modelKey];

            if (externalData && externalData.input_cost_per_token !== undefined) {
                const newInputPrice = externalData.input_cost_per_token * 1000;
                const newOutputPrice = (externalData.output_cost_per_token || 0) * 1000;

                const currentActive = activePrices?.find(p => p.model === modelKey);

                if (!currentActive) {
                    // New model discovered!
                    await supabase.from('llm_prices').insert({
                        model: modelKey,
                        provider: modelInfo.provider,
                        input_price_per_1k: newInputPrice,
                        output_price_per_1k: newOutputPrice,
                        valid_from: now
                    });
                    results.newly_added++;
                } else {
                    // Check for price change
                    if (
                        Math.abs(currentActive.input_price_per_1k - newInputPrice) > 0.0000001 ||
                        Math.abs(currentActive.output_price_per_1k - newOutputPrice) > 0.0000001
                    ) {
                        // Price changed
                        await supabase.from('llm_prices').update({ valid_to: now }).eq('id', currentActive.id);
                        await supabase.from('llm_prices').insert({
                            model: modelKey,
                            provider: modelInfo.provider,
                            input_price_per_1k: newInputPrice,
                            output_price_per_1k: newOutputPrice,
                            valid_from: now
                        });
                        results.updated++;
                    } else {
                        results.ignored++;
                    }
                }
            }
        }

        return new Response(JSON.stringify({
            success: true,
            discovered: discoveredModels.length,
            ...results
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err: any) {
        console.error("[UPDATE-PRICES] Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
});
