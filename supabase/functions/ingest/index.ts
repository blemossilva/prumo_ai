import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import * as pdfjs from "https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs";

const GOOGLE_AI_KEY = Deno.env.get("GOOGLE_AI_KEY");

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

    try {
        const { document_id, text } = await req.json();
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        console.log(`[INGEST] Processando documento ID: ${document_id}`);

        const { data: doc, error: docError } = await supabase
            .from('documents')
            .select('*')
            .eq('id', document_id)
            .single();

        if (docError || !doc) throw new Error("Documento não encontrado");

        await supabase.from('documents').update({ status: 'processing' }).eq('id', document_id);

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

        // 4. Chunking (Simple overlap chunking)
        const CHUNK_SIZE = 1000;
        const chunks = [];
        for (let i = 0; i < fullText.length; i += CHUNK_SIZE) {
            chunks.push(fullText.substring(i, i + CHUNK_SIZE));
        }

        // 5. Clear old chunks
        await supabase.from('document_chunks').delete().eq('document_id', document_id);

        console.log(`[INGEST] Gerando embeddings para ${chunks.length} chunks...`);

        // 6. Generate Gemini Embeddings and Save
        for (const [index, content] of chunks.entries()) {
            console.log(`[INGEST] Gerando embedding ${index + 1}/${chunks.length}`);
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

            const { error: insError } = await supabase.from('document_chunks').insert({
                document_id: document_id,
                content: content,
                embedding: embData.embedding.values,
                chunk_index: index
            });

            if (insError) throw new Error(`Erro DB Insert: ${insError.message}`);
        }

        await supabase.from('documents').update({ status: 'ready' }).eq('id', document_id);
        console.log("[INGEST] Processo concluído com sucesso!");

        return new Response(JSON.stringify({ success: true, chunks: chunks.length }), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });

    } catch (err: any) {
        console.error("[INGEST] ERRO FATAL:", err.message);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
    }
});
