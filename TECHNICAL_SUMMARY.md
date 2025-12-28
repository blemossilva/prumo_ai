# Resumo Técnico-Funcional: Nexio AI

Este documento fornece o contexto técnico e funcional da solução Nexio AI, focado na gestão de agentes e controlo de visibilidade.

## 1. Visão Geral
A Nexio AI é uma plataforma de chat corporativo que permite a criação de múltiplos Agentes de IA especializados. A solução utiliza RAG (Retrieval-Augmented Generation) para fornecer respostas baseadas em documentos internos e texto de conhecimento específico.

## 2. Arquitetura de Dados (Esquema Supabase)

O controlo de acessos e a configuração dos agentes baseiam-se nas seguintes tabelas:

### Agentes e Visibilidade
| Tabela | Colunas Principais | Descrição |
| :--- | :--- | :--- |
| `agents` | `id`, `name`, `visibility`, `status`, `system_prompt`, `provider`, `model` | Define a persona e o motor de IA. `visibility` aceita `public` ou `private` (default). |
| `profiles` | `id`, `role`, `name` | Extensão do `auth.users`. `role` pode ser `admin` ou `worker`. |

### Gestão de Grupos (Permissões)
| Tabela | Colunas Principais | Descrição |
| :--- | :--- | :--- |
| `user_groups` | `id`, `name`, `description` | Define grupos organizacionais (ex: RH, Vendas). |
| `user_group_members` | `user_id`, `group_id` | Associa utilizadores a um ou mais grupos. |
| `user_group_agents` | `agent_id`, `group_id` | Associa agentes a grupos específicos. |

### Conhecimento e RAG
| Tabela | Colunas Principais | Descrição |
| :--- | :--- | :--- |
| `documents` | `id`, `agent_id`, `storage_path`, `status` | Registo de PDFs carregados para o Storage do Supabase (`hr_kb`). |
| `messages` | `id`, `conversation_id`, `role`, `content` | Histórico de mensagens de chat. |

## 3. Lógica de Negócio: Visibilidade de Agentes

A visibilidade é aplicada de forma dinâmica no frontend (`src/App.tsx`), validada indiretamente pelas relações na base de dados:

1.  **Administradores (`role: 'admin'`)**:
    *   Têm acesso a **todos** os agentes, independentemente da visibilidade ou grupo.
2.  **Trabalhadores (`role: 'worker'`)**:
    *   Visualizam agentes marcados como `public`.
    *   Visualizam agentes marcados como `private` apenas se houver um mapeamento em `user_group_agents` que coincida com os grupos do utilizador em `user_group_members`.

## 4. Implementação Técnica de Destaque

*   **Ingestão de Dados**: Existe um processo automatizado que deteta alterações no "Knowledge Text" do agente (campo de texto manual) e cria um documento virtual `CONHECIMENTO_MANUAL` em `documents`, disparando a Edge Function `ingest` para processamento vetorial imediato.
*   **Chat Edge Function**: A função `chat` recupera o contexto relevante da base de vetores antes de enviar o prompt final para o fornecedor de LLM (OpenAI/Gemini).
*   **Segurança de Base de Dados**: 
    *   A coluna `agents.visibility` tem o valor padrão `private`.
    *   RLS (Row Level Security) está ativo para garantir que utilizadores só acedam a perfis e dados próprios.

---
*Documento gerado para contextualização de equipas técnicas e modelos de IA.*
