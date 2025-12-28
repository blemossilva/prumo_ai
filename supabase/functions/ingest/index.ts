import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import * as pdfjs from "https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs";

const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Initialize PDF.js worker
const pdfjsWorker = await import("https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs");
pdfjs.GlobalWorkerOptions.workerSrc = "https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs";

Deno.serve(async (req: Request) => {
    console.log("[INGEST] Iniciando processo...");

    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            }
        });
    }

    let currentDocId = null;

    try {
        const body = await req.json();
        const { document_id, text } = body;
        currentDocId = document_id;

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Security: Verify user JWT (optional for ingest since it's internal but good practice)
        const authHeader = req.headers.get('Authorization');
        if (authHeader) {
            const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
            if (authError || !user) console.warn("[INGEST] Chamada sem utilizador autenticado (usando service role)");
        }

        console.log(`[INGEST] Processando documento ID: ${currentDocId}`);

        // Fetch document and agent info separately to be absolutely safe about join behavior
        const { data: doc, error: docError } = await supabase
            .from('documents')
            .select('*')
            .eq('id', currentDocId)
            .single();

        if (docError || !doc) throw new Error(`Documento não encontrado: ${docError?.message}`);

        console.log(`[INGEST] Doc encontrado: ${doc.filename}. Agent ID: ${doc.agent_id}`);

        let provider = 'gemini';
        if (doc.agent_id) {
            const { data: agent } = await supabase
                .from('agents')
                .select('provider')
                .eq('id', doc.agent_id)
                .single();
            if (agent) provider = agent.provider;
        }

        console.log(`[INGEST] Fornecedor identificado: ${provider}`);

        await supabase.from('documents').update({ status: 'processing' }).eq('id', currentDocId);

        let fullText = "";

        if (text) {
            console.log("[INGEST] Usando texto fornecido diretamente...");
            fullText = text;
        } else {
            console.log(`[INGEST] Baixando do storage: ${doc.storage_path}`);
            const { data: fileData, error: storageError } = await supabase.storage
                .from('hr_kb')
                .download(doc.storage_path);

            if (storageError) throw storageError;

            // 3. Extract text using PDF.js
            console.log("[INGEST] Extraindo texto do PDF...");
            const arrayBuffer = await fileData.arrayBuffer();
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(" ");
                fullText += pageText + "\n\n";
            }
        }

        console.log(`[INGEST] Texto extraído (${fullText.length} caracteres)`);

        if (!fullText.trim()) {
            throw new Error("O PDF parece estar vazio ou não contém texto extraível.");
        }

        // 4. Chunking (Simple overlap chunking)
        const CHUNK_SIZE = 1000;
        const chunks = [];
        for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
            chunks.push(fullText.substring(i, i + CHUNK_SIZE));
        }

        // 5. Clear old chunks using document_id safely
        await supabase.from('document_chunks').delete().eq('document_id', currentDocId);

        console.log(`[INGEST] Gerando embeddings para ${chunks.length} chunks usando ${provider}...`);

        // 6. Generate Embeddings and Save
        for (const [index, content] of chunks.entries()) {
            console.log(`[INGEST] Gerando embedding ${index + 1}/${chunks.length}`);

            let embedding = [];

            if (provider === 'openai') {
                const embRes = await fetch("https://api.openai.com/v1/embeddings", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${OPENAI_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        input: content,
                        model: "text-embedding-3-small",
                        dimensions: 768 // Match our DB column
                    })
                });

                if (!embRes.ok) {
                    const errData = await embRes.json();
                    throw new Error(`Erro OpenAI: ${JSON.stringify(errData)}`);
                }
                const embData = await embRes.json();
                embedding = embData.data[0].embedding;

                // Record OpenAI Embedding Token Usage
                await supabase.from('token_usage').insert({
                    tenant_id: doc.tenant_id,
                    user_id: null, // Ingest can be system-triggered
                    agent_id: doc.agent_id || null,
                    type: 'ingest',
                    model: 'text-embedding-3-small',
                    input_tokens: embData.usage?.prompt_tokens || 0,
                    output_tokens: 0,
                    total_tokens: embData.usage?.total_tokens || 0,
                    metadata: { document_id: currentDocId, chunk_index: index }
                });
            } else {
                // Default Gemini
                const embRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GOOGLE_AI_KEY}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: { parts: [{ text: content }] } })
                });

                if (!embRes.ok) {
                    const errData = await embRes.json();
                    throw new Error(`Erro Gemini: ${JSON.stringify(errData)}`);
                }
                const embData = await embRes.json();
                embedding = embData.embedding.values;

                // Gemini estimate
                const estimatedTokens = Math.ceil(content.length / 4);
                await supabase.from('token_usage').insert({
                    tenant_id: doc.tenant_id,
                    user_id: null,
                    agent_id: doc.agent_id || null,
                    type: 'ingest',
                    model: 'text-embedding-004',
                    input_tokens: estimatedTokens,
                    output_tokens: 0,
                    total_tokens: estimatedTokens,
                    metadata: { document_id: currentDocId, chunk_index: index, estimated: true }
                });
            }

            const { error: insError } = await supabase.from('document_chunks').insert({
                document_id: currentDocId,
                content: content,
                embedding: embedding,
                chunk_index: index,
                tenant_id: doc.tenant_id
            });

            if (insError) throw new Error(`Erro DB Insert: ${insError.message}`);
        }

        await supabase.from('documents').update({ status: 'ready' }).eq('id', currentDocId);
        console.log("[INGEST] Processo concluído com sucesso!");

        return new Response(JSON.stringify({ success: true, chunks: chunks.length }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });

    } catch (err: any) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("[INGEST] ERRO FATAL:", errorMessage);

        if (currentDocId) {
            try {
                const supabase = createClient(
                    Deno.env.get('SUPABASE_URL') ?? '',
                    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
                );

                console.log(`[INGEST] Registando erro na DB para o documento ${currentDocId}...`);
                const { error: updateError } = await supabase.from('documents').update({
                    status: 'error',
                    error_message: errorMessage
                }).eq('id', currentDocId);

                if (updateError) {
                    console.error("[INGEST] Falha ao atualizar status de erro na DB:", updateError.message);
                } else {
                    console.log("[INGEST] Status de erro registado com sucesso.");
                }
            } catch (e: any) {
                console.error("[INGEST] Falha crítica ao tentar registar o erro:", e.message);
            }
        }

        return new Response(JSON.stringify({
            error: errorMessage,
            document_id: currentDocId
        }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }
});
