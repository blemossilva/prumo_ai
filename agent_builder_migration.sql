-- Add new columns to agents table
ALTER TABLE IF EXISTS agents 
ADD COLUMN IF NOT EXISTS knowledge_mode text DEFAULT 'internal_only',
ADD COLUMN IF NOT EXISTS citations_mode text DEFAULT 'hide',
ADD COLUMN IF NOT EXISTS rag_bias numeric DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS tests jsonb DEFAULT '[]'::jsonb;

-- Create agent_versions table
CREATE TABLE IF NOT EXISTS agent_versions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by uuid REFERENCES auth.users(id),
    snapshot jsonb NOT NULL
);

-- Add RLS policies for agent_versions
ALTER TABLE agent_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can see versions
CREATE POLICY "Admins can view agent versions" ON agent_versions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Policy: Admin can insert versions
CREATE POLICY "Admins can insert agent versions" ON agent_versions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
