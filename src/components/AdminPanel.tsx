import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    FileText,
    Trash2,
    Settings,
    Users,
    CheckCircle2,
    Loader2,
    ArrowLeft,
    LayoutDashboard,
    Bot,
    Plus,
    X,
    FolderPlus,
    Search,
    AlertCircle,
    Layers,
    PieChart as ChartIcon,
    ArrowRight
} from 'lucide-react';
import { Dashboard } from './Dashboard';
import { TourGuide } from './TourGuide';

interface Group {
    id: string;
    name: string;
    description: string;
}


interface Document {
    id: string;
    filename: string;
    status: 'uploaded' | 'processing' | 'ready' | 'error';
    created_at: string;
    storage_path: string;
    agent_id?: string | null;
    error_message?: string | null;
}

interface Agent {
    id?: string;
    name: string;
    description: string;
    system_prompt: string;
    status: 'live' | 'disabled';
    visibility: 'public' | 'private';
    provider: string;
    model: string;
    suggested_prompts?: string[] | null;
    knowledge_text?: string;
    knowledge_base_id?: string | null;
    knowledge_mode?: 'internal_only' | 'external_only' | 'hybrid';
    citations_mode?: 'hide' | 'show_on_hover' | 'always_show';
    rag_bias?: number;
    tests?: any[];
}

interface AdminPanelProps {
    onBack: () => void;
    userProfile: {
        id: string;
        role: 'worker' | 'admin';
        name: string | null;
        tenant_id: string;
        onboarding_completed?: boolean;
        is_super_admin?: boolean;
    } | null;
    tenant?: {
        id: string;
        name: string;
        logo_url: string | null;
    } | null;
}

const SYSTEM_PROMPT_TEMPLATES: Record<string, Record<string, { name: string, content: string }>> = {
    'pt-PT': {
        'generic': {
            name: 'Genérico (Recomendado)',
            content: `[Função do Agente]\nAtua como um agente de apoio integrado no contexto da organização.\n\n[Fontes de Informação]\nBaseia as tuas respostas prioritariamente no conhecimento interno associado a este agente, incluindo documentos, procedimentos e informação institucional disponível.\n\n[Regras e Limites]\nNão inventes informação nem faças suposições. Quando a informação disponível não for suficiente, indica claramente essa limitação e sugere como o utilizador pode obter ou fornecer mais contexto.\n\n[Estilo de Resposta]\nResponde de forma clara, estruturada e objetiva. Mantém um tom profissional, neutro e colaborativo.`
        },
        'operational': {
            name: 'Apoio Operacional',
            content: `[Função do Agente]\nAtua como um agente de apoio operacional da organização, ajudando no esclarecimento de tarefas, regras internas e procedimentos do dia a dia.\n\n[Fontes de Informação]\nUtiliza exclusivamente o conhecimento interno disponível associado a este agente.\n\n[Regras e Limites]\nFornece orientações práticas e acionáveis. Não inventes informação. Caso a resposta não esteja disponível, indica isso claramente e sugere o passo seguinte adequado.\n\n[Estilo de Resposta]\nUtiliza linguagem simples, direta e orientada à ação. Sempre que aplicável, apresenta a informação em passos ou listas.`
        },
        'documents': {
            name: 'Perguntas sobre Documentos e Procedimentos',
            content: `[Função do Agente]\nAtua como um agente especializado em responder a perguntas com base em documentos, normas e procedimentos internos da organização.\n\n[Fontes de Informação]\nResponde exclusivamente com base na informação presente nos documentos e textos associados a este agente.\n\n[Regras e Limites]\nNão utilizes conhecimento externo nem faças inferências não suportadas pelos documentos. Se a resposta não for encontrada, indica explicitamente essa situação.\n\n[Estilo de Resposta]\nFornece respostas objetivas, fiéis aos documentos e bem estruturadas.`
        },
        'decision': {
            name: 'Apoio à Decisão e Análise',
            content: `[Função do Agente]\nAtua como um agente de apoio à análise e à tomada de decisão no contexto da organização.\n\n[Fontes de Informação]\nAnalisa a informação disponível no conhecimento interno associado ao agente.\n\n[Regras e Limites]\nDistingue factos de interpretações. Não tires conclusões sem base suficiente. Explicita pressupostos e limitações sempre que necessário.\n\n[Estilo de Resposta]\nApresenta análises claras, estruturadas e fundamentadas, utilizando listas ou secções quando adequado.`
        },
        'functional': {
            name: 'Especialista Funcional',
            content: `[Função do Agente]\nAtua como um agente especialista numa área funcional da organização (ex.: recursos humanos, financeiro, qualidade, operações).\n\n[Fontes de Informação]\nBaseia as tuas respostas no conhecimento interno disponível relevante para essa área funcional.\n\n[Regras e Limites]\nFornece informação rigorosa e consistente. Não inventes dados. Indica explicitamente incertezas ou lacunas de informação.\n\n[Estilo de Resposta]\nMantém um tom profissional, claro e adequado ao contexto organizacional.`
        }
    }
};

export const AdminPanel = ({ onBack, userProfile, tenant }: AdminPanelProps) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'agents' | 'groups'>('dashboard');
    const [documents, setDocuments] = useState<Document[]>([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [availableModels, setAvailableModels] = useState<{ id: string, name: string }[]>([]);
    const [fetchingModels, setFetchingModels] = useState(false);
    const [runTour, setRunTour] = useState(false);

    const [users, setUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Invitation state
    const [invitations, setInvitations] = useState<any[]>([]);
    const [loadingInvitations, setLoadingInvitations] = useState(false);
    const [emailInput, setEmailInput] = useState('');
    const [parsedEmails, setParsedEmails] = useState<string[]>([]);
    const [showInviteConfirmation, setShowInviteConfirmation] = useState(false);
    const [sendingInvites, setSendingInvites] = useState(false);

    const [agents, setAgents] = useState<Agent[]>([]);
    const [loadingAgents, setLoadingAgents] = useState(false);
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
    const [savingAgent, setSavingAgent] = useState(false);

    // Group management state
    const [groups, setGroups] = useState<Group[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(false);

    // Versioning state
    const [agentVersions, setAgentVersions] = useState<any[]>([]);
    const [loadingVersions, setLoadingVersions] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [savingGroup, setSavingGroup] = useState(false);
    const [groupMembers, setGroupMembers] = useState<string[]>([]); // list of user_ids
    const [groupAgents, setGroupAgents] = useState<string[]>([]);   // list of agent_ids
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // State for managing user-group associations outside of group tab
    const [userGroups, setUserGroups] = useState<Record<string, string[]>>({});
    const [agentGroups, setAgentGroups] = useState<Record<string, string[]>>({});


    useEffect(() => {
        fetchDocuments();
    }, []);

    useEffect(() => {
        if (activeTab === 'dashboard') {
            // Dashboard data is fetched within the component
        } else if (activeTab === 'users') {
            fetchUsers();
            fetchGroups();
            fetchAllUserGroups();
            fetchInvitations();
        } else if (activeTab === 'groups') {
            fetchGroups();
            fetchAllUserGroups();
            fetchAllAgentGroups();
            fetchUsers();
            fetchAgents();
        } else if (activeTab === 'agents') {
            fetchAgents();
            fetchDocuments();
            fetchGroups();
            fetchAllAgentGroups();
        }
    }, [activeTab]);

    // --- Agent Builder / Wizard Logix ---
    const [wizardMode, setWizardMode] = useState<'simple' | 'advanced'>('advanced');
    const [wizardStep, setWizardStep] = useState(1);

    // Wizard Data (Temporary State for Builder)
    const [templateId, setTemplateId] = useState<string | null>(null);

    // Icons
    const { MessageSquare, Users, Target, BarChart } = {
        MessageSquare: ({ size }: { size: number }) => <span style={{ fontSize: size }}>💬</span>,
        Users: ({ size }: { size: number }) => <span style={{ fontSize: size }}>👥</span>,
        Target: ({ size }: { size: number }) => <span style={{ fontSize: size }}>🎯</span>,
        BarChart: ({ size }: { size: number }) => <span style={{ fontSize: size }}>📊</span>
    };

    const AGENT_TEMPLATES = [
        { id: 'support', name: 'Suporte ao Cliente', icon: MessageSquare, desc: 'Responde a dúvidas frequentes e resolve problemas básicos.' },
        { id: 'hr', name: 'Recursos Humanos', icon: Users, desc: 'Apoio a colaboradores, onboarding e políticas internas.' },
        { id: 'sales', name: 'Vendas & Leads', icon: Target, desc: 'Qualificação de leads e apoio comercial.' },
        { id: 'analyst', name: 'Analista de Dados', icon: BarChart, desc: 'Interpretação de relatórios e métricas.' },
    ];


    const handleWizardNext = () => {
        if (wizardStep === 1) {
            if (!templateId) return alert('Selecione um template.');
            setWizardStep(2);
        } else if (wizardStep === 2) {
            setWizardStep(3);
        } else if (wizardStep === 3) {
            setWizardStep(4);
        }
    };
    // --- End Wizard Logix ---

    useEffect(() => {
        // Auto-start tour if triggered from outside or just enabled
        if (userProfile && userProfile.onboarding_completed === false) {
            // We don't auto-start here anymore if we want the App.tsx tour to lead here.
            // But if we want to support direct access, we can keep it check if we are already in "step 2" logic
            // For now, relies on runTour being true default or passed?
            // Actually, let's allow manual start or if App passes a "continue tour" state.
            // Simplified: The user clicks the button in App.tsx, which routes here.
            // We can check a URL param or just rely on the user clicking "Tutorial" if they get lost.
            // desired behavior: "indicar como o primeiro passo passo entrar no painel de adminsitração"
            // After entering, it should probably continue.

            // Let's assume the App.tsx tour brings them here. We can make this tour start 
            // if onboarding is false AND we are in this component.
            setTimeout(() => setRunTour(true), 1000);
        }
    }, [userProfile]);

    const handleTourFinish = () => {
        setRunTour(false);
    };

    const adminTourSteps = [
        {
            content: (
                <div className="p-2">
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Bem-vindo ao Painel! 🚀</h3>
                    <p className="text-slate-600">
                        Aqui é o centro de comando. Vamos configurar a sua organização.
                    </p>
                </div>
            ),
            locale: { skip: "Saltar", next: "Começar", back: "Voltar", last: "Terminar" },
            placement: 'center' as const,
            target: 'body',
        },
        {
            content: (
                <div className="p-2">
                    <h3 className="font-bold text-slate-800 mb-1">1. Crie o seu primeiro Agente</h3>
                    <p className="text-sm text-slate-600">
                        A inteligência da sua equipa. Clique aqui para criar assistentes.
                    </p>
                </div>
            ),
            target: '[data-tour="agents-tab"]',
            placement: 'right' as const,
        },
        {
            content: (
                <div className="p-2">
                    <h3 className="font-bold text-slate-800 mb-1">2. Organize em Grupos</h3>
                    <p className="text-sm text-slate-600">
                        Crie departamentos ou equipas para controlar acessos.
                    </p>
                </div>
            ),
            target: '[data-tour="groups-tab"]',
            placement: 'right' as const,
        },
        {
            content: (
                <div className="p-2">
                    <h3 className="font-bold text-slate-800 mb-1">3. Convide a Equipa</h3>
                    <p className="text-sm text-slate-600">
                        Adicione colaboradores e atribua-lhes grupos aqui.
                    </p>
                </div>
            ),
            target: '[data-tour="users-tab"]',
            placement: 'right' as const,
        }
    ];

    // WebSocket subscription for documents status
    useEffect(() => {
        console.log('[REALTIME] Iniciando subscrição de documentos...');
        const channel = supabase
            .channel('documents-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'documents'
                    // Removendo filtro de servidor para máxima robustez, filtramos no cliente
                },
                (payload) => {
                    console.log('[REALTIME] Mudança detectada:', payload.eventType, payload.new);
                    const newDoc = payload.new as any;
                    // Só refresh se for do nosso tenant ou se formos super admin
                    if (userProfile?.is_super_admin || newDoc?.tenant_id === userProfile?.tenant_id) {
                        console.log('[REALTIME] Refreshing documents list...');
                        fetchDocuments(editingAgent?.id);
                    }
                }
            )
            .subscribe((status) => {
                console.log('[REALTIME] Status da subscrição:', status);
            });

        return () => {
            console.log('[REALTIME] Removendo subscrição...');
            supabase.removeChannel(channel);
        };
    }, [userProfile?.tenant_id, editingAgent?.id, userProfile?.is_super_admin]);

    const fetchGroups = async () => {
        setLoadingGroups(true);
        let query = supabase.from('user_groups').select('*');
        if (!userProfile?.is_super_admin) {
            query = query.eq('tenant_id', userProfile?.tenant_id);
        }
        const { data } = await query.order('name');
        if (data) setGroups(data);
        setLoadingGroups(false);
    };

    const fetchAllUserGroups = async () => {
        let query = supabase.from('user_group_members').select('*');
        // Note: Joining with user_groups table might be needed if we want to be strict,
        // but RLS on user_group_members already handles this based on our new policies.
        const { data } = await query;
        if (data) {
            const mapping: Record<string, string[]> = {};
            data.forEach((m: any) => {
                if (!mapping[m.user_id]) mapping[m.user_id] = [];
                mapping[m.user_id].push(m.group_id);
            });
            setUserGroups(mapping);
        }
    };

    const fetchAllAgentGroups = async () => {
        let query = supabase.from('user_group_agents').select('*');
        const { data } = await query;
        if (data) {
            const mapping: Record<string, string[]> = {};
            data.forEach((m: any) => {
                if (!mapping[m.agent_id]) mapping[m.agent_id] = [];
                mapping[m.agent_id].push(m.group_id);
            });
            setAgentGroups(mapping);
        }
    };

    const fetchGroupDetails = async (groupId: string) => {
        const { data: members } = await supabase.from('user_group_members').select('user_id').eq('group_id', groupId);
        const { data: agentsData } = await supabase.from('user_group_agents').select('agent_id').eq('group_id', groupId);

        if (members) setGroupMembers(members.map(m => m.user_id));
        if (agentsData) setGroupAgents(agentsData.map(a => a.agent_id));
    };

    const saveGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingGroup) return;
        setSavingGroup(true);

        try {
            const { id, ...rest } = editingGroup;
            const groupData = id
                ? { id, ...rest, tenant_id: userProfile?.tenant_id, updated_at: new Date().toISOString() }
                : { ...rest, tenant_id: userProfile?.tenant_id, updated_at: new Date().toISOString() };

            const { data, error } = await supabase
                .from('user_groups')
                .upsert(groupData)
                .select()
                .single();

            if (error) throw error;

            if (data) {
                const groupId = data.id;

                // Sync members
                await supabase.from('user_group_members').delete().eq('group_id', groupId);
                if (groupMembers.length > 0) {
                    const { error: memberError } = await supabase.from('user_group_members').insert(
                        groupMembers.map(userId => ({ group_id: groupId, user_id: userId }))
                    );
                    if (memberError) throw memberError;
                }

                // Sync agents
                await supabase.from('user_group_agents').delete().eq('group_id', groupId);
                if (groupAgents.length > 0) {
                    const { error: agentError } = await supabase.from('user_group_agents').insert(
                        groupAgents.map(agentId => ({ group_id: groupId, agent_id: agentId }))
                    );
                    if (agentError) throw agentError;
                }

                setEditingGroup(null);
                fetchGroups();
                fetchAllUserGroups();
                fetchAllAgentGroups();
                alert('Grupo guardado com sucesso!');
            }
        } catch (err: any) {
            console.error('Error saving group:', err);
            alert(`Erro ao guardar grupo: ${err.message}`);
        } finally {
            setSavingGroup(false);
        }
    };

    const deleteGroup = async (id: string) => {
        if (!confirm('Eliminar este grupo permanentemente?')) return;
        const { error } = await supabase.from('user_groups').delete().eq('id', id);
        if (error) alert('Erro ao eliminar grupo');
        else fetchGroups();
    };


    const fetchAgents = async () => {
        setLoadingAgents(true);
        let query = supabase.from('agents').select('*');

        if (!userProfile?.is_super_admin) {
            query = query.eq('tenant_id', userProfile?.tenant_id);
        }

        const { data } = await query.order('created_at', { ascending: false });
        if (data) setAgents(data);
        setLoadingAgents(false);
    };

    const saveAgent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAgent) return;
        setSavingAgent(true);

        try {
            console.log('A guardar agente...', editingAgent);
            const { data, error } = await supabase
                .from('agents')
                .upsert({
                    ...editingAgent,
                    tenant_id: userProfile?.tenant_id,
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (!error && data) {
                // Create version snapshot
                await supabase.from('agent_versions').insert({
                    agent_id: data.id,
                    created_by: userProfile?.id,
                    snapshot: data
                });
            }

            if (error) {
                console.error('Erro Supabase:', error);
                alert(`Erro ao guardar: ${error.message}`);
            } else {
                if (data) {
                    setEditingAgent(data);

                    // Ingest knowledge_text if it exists
                    if (data.knowledge_text && data.knowledge_text.trim() !== '') {
                        // 1. Check if a virtual document for this knowledge_text already exists
                        const { data: existingDoc } = await supabase
                            .from('documents')
                            .select('id')
                            .eq('agent_id', data.id)
                            .eq('filename', 'CONHECIMENTO_MANUAL')
                            .maybeSingle();

                        let docId = existingDoc?.id;

                        if (!docId) {
                            // 2. Create the virtual document
                            const { data: newDoc, error: docError } = await supabase
                                .from('documents')
                                .insert({
                                    agent_id: data.id,
                                    tenant_id: userProfile?.tenant_id,
                                    filename: 'CONHECIMENTO_MANUAL',
                                    status: 'uploaded',
                                    storage_path: 'manual_text'
                                })
                                .select()
                                .single();

                            if (docError) {
                                console.error('Error creating virtual document:', docError);
                            } else {
                                docId = newDoc.id;
                            }
                        }

                        if (docId) {
                            // 3. Trigger ingest
                            await supabase.functions.invoke('ingest', {
                                body: {
                                    document_id: docId,
                                    text: data.knowledge_text
                                }
                            });
                        }
                    } else {
                        // If knowledge_text is cleared, delete the virtual document and its chunks
                        const { data: existingDoc } = await supabase
                            .from('documents')
                            .select('id')
                            .eq('agent_id', data.id)
                            .eq('filename', 'CONHECIMENTO_MANUAL')
                            .maybeSingle();

                        if (existingDoc) {
                            await supabase.from('document_chunks').delete().eq('document_id', existingDoc.id);
                            await supabase.from('documents').delete().eq('id', existingDoc.id);
                        }
                    }
                }
                fetchAgents();
                if (data.id) fetchAgentVersions(data.id);
                alert('Agente guardado e conhecimento processado!');
            }
        } catch (err: any) {
            console.error('Erro fatal ao guardar:', err);
            alert(`Erro inesperado: ${err.message || 'Erro desconhecido'}`);
        } finally {
            setSavingAgent(false);
        }
    };

    const fetchAgentVersions = async (agentId: string) => {
        setLoadingVersions(true);
        const { data, error } = await supabase
            .from('agent_versions')
            .select('*')
            .eq('agent_id', agentId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (!error && data) setAgentVersions(data);
        setLoadingVersions(false);
    };

    const restoreAgentVersion = (snapshot: any) => {
        if (!confirm('Deseja repor esta versão? As alterações atuais não gravadas serão perdidas.')) return;
        setEditingAgent(snapshot);
    };

    const deleteAgent = async (id: string) => {
        if (!confirm('Eliminar este agente?')) return;
        const { error } = await supabase.from('agents').delete().eq('id', id);
        if (error) alert('Erro ao eliminar agente');
        else fetchAgents();
    };

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const { data } = await supabase.functions.invoke('admin-actions?action=list-users', {
                method: 'GET'
            });
            if (data?.users) setUsers(data.users);
        } catch (err) {
            console.error('Erro ao buscar utilizadores:', err);
        } finally {
            setLoadingUsers(false);
        }
    };

    const toggleUserRole = async (userId: string, currentRole: string) => {
        const newRole = currentRole === 'admin' ? 'worker' : 'admin';
        try {
            const { data } = await supabase.functions.invoke('admin-actions?action=update-user', {
                body: { id: userId, role: newRole }
            });
            if (data?.success) fetchUsers();
        } catch (err) {
            alert('Erro ao alterar cargo');
        }
    };

    const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
        try {
            const { data } = await supabase.functions.invoke('admin-actions?action=update-user', {
                body: { id: userId, active: !currentStatus }
            });
            if (data?.success) fetchUsers();
        } catch (err) {
            alert('Erro ao alterar estado');
        }
    };

    const deleteUser = async (userId: string) => {
        if (!confirm('Eliminar permanentemente este perfil?')) return;
        try {
            const { data } = await supabase.functions.invoke('admin-actions?action=delete-user', {
                body: { id: userId }
            });
            if (data?.success) fetchUsers();
        } catch (err) {
            alert('Erro ao eliminar utilizador');
        }
    };

    const fetchInvitations = async () => {
        setLoadingInvitations(true);
        try {
            const { data, error } = await supabase
                .from('invitations')
                .select('*')
                .order('invited_at', { ascending: false });
            if (error) throw error;
            setInvitations(data || []);
        } catch (err) {
            console.error('Erro ao buscar convites:', err);
        } finally {
            setLoadingInvitations(false);
        }
    };

    const parseEmails = () => {
        const emails = emailInput
            .split(/[,;]/)  // Split by comma or semicolon
            .map(e => e.trim())
            .filter(e => e.length > 0)
            .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)); // Basic email validation
        setParsedEmails([...new Set(emails)]); // Remove duplicates
        setShowInviteConfirmation(true);
    };

    const sendInvitations = async () => {
        setSendingInvites(true);
        try {
            const { data, error } = await supabase.functions.invoke('send-invitations', {
                body: { emails: parsedEmails }
            });
            if (error) throw error;
            alert(`Convites enviados! ${data.results.filter((r: any) => r.success).length} de ${parsedEmails.length} com sucesso.`);
            setEmailInput('');
            setParsedEmails([]);
            setShowInviteConfirmation(false);
            fetchInvitations();
        } catch (err: any) {
            alert('Erro ao enviar convites: ' + err.message);
        } finally {
            setSendingInvites(false);
        }
    };

    const resendInvitation = async (_invitationId: string, email: string) => {
        try {
            const { error } = await supabase.functions.invoke('send-invitations', {
                body: { emails: [email] }
            });
            if (error) throw error;
            alert('Convite reenviado com sucesso!');
            fetchInvitations();
        } catch (err: any) {
            alert('Erro ao reenviar convite: ' + err.message);
        }
    };

    useEffect(() => {
        if (editingAgent?.provider) {
            fetchModels(editingAgent.provider);
        }
    }, [editingAgent?.provider]);

    const fetchModels = async (provider: string) => {
        setFetchingModels(true);
        try {
            const { data } = await supabase.functions.invoke(`admin-actions?action=list-models&provider=${provider}`, {
                method: 'GET'
            });
            if (data?.models) setAvailableModels(data.models);
        } catch (err) {
            console.error('Erro ao buscar modelos:', err);
        } finally {
            setFetchingModels(false);
        }
    };




    const fetchDocuments = async (agentId?: string) => {
        setLoading(true);
        let query = supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false });

        if (agentId) {
            query = query.eq('agent_id', agentId);
        }

        if (!userProfile?.is_super_admin) {
            query = query.eq('tenant_id', userProfile?.tenant_id);
        }

        const { data } = await query;
        if (data) setDocuments(data as Document[]);
        setLoading(false);
    };



    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, agentId?: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;

            // Organize storage by tenant_id
            const tenantPath = userProfile?.tenant_id || 'default';
            const filePath = `knowledge/${tenantPath}/${agentId || 'general'}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('hr_kb')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: docRecord, error: dbError } = await supabase
                .from('documents')
                .insert({
                    filename: file.name,
                    storage_path: filePath,
                    status: 'uploaded',
                    agent_id: agentId || null,
                    tenant_id: userProfile?.tenant_id
                })
                .select()
                .single();

            if (dbError) throw dbError;

            if (docRecord) {
                console.log('[UPLOAD] Invocando ingest para o doc:', docRecord.id);
                try {
                    const { error: invokeError } = await supabase.functions.invoke('ingest', {
                        body: { document_id: docRecord.id }
                    });
                    if (invokeError) {
                        console.error('[UPLOAD] Erro retornado pela função ingest:', invokeError);
                        // O status será atualizado para 'error' pela própria função se chegar ao catch lá
                    }
                } catch (err: any) {
                    console.error('[UPLOAD] Falha crítica ao invocar function:', err);
                }
            }

            // Garante sempre o refresh da lista
            console.log('[UPLOAD] Fazendo refresh da lista de documentos...');
            await fetchDocuments(agentId);
        } catch (error: any) {
            console.error('[UPLOAD] Erro no fluxo de upload:', error);
            alert(error.message || 'Erro ao carregar ficheiro');
            // Refresh mesmo em erro para ver se o registo ficou lá
            await fetchDocuments(agentId);
        } finally {
            setUploading(false);
        }
    };

    const deleteDocument = async (docId: string, storagePath: string, bypassConfirm = false) => {
        console.log('[DELETE] Início da função deleteDocument:', { docId, storagePath, bypassConfirm });
        if (!docId) {
            console.error('[DELETE] docId em falta');
            return;
        }

        if (!bypassConfirm) {
            console.log('[DELETE] Solicitando confirmação via UI');
            setConfirmDeleteId(docId);
            return;
        }

        try {
            console.log('[DELETE] Passo 1: Apagar do Storage...', storagePath);
            if (storagePath && storagePath !== 'CONHECIMENTO_MANUAL') {
                const { error: storageError } = await supabase.storage.from('hr_kb').remove([storagePath]);
                if (storageError) {
                    console.warn('[DELETE] Aviso Storage (não fatal):', storageError.message);
                } else {
                    console.log('[DELETE] Sucesso no Storage');
                }
            } else {
                console.log('[DELETE] Salto Passo 1 (sem storagePath válido)');
            }

            console.log('[DELETE] Passo 2: Apagar da DB...', docId);
            const { error: dbError } = await supabase.from('documents').delete().eq('id', docId);
            if (dbError) {
                console.error('[DELETE] Erro DB:', dbError);
                throw dbError;
            }
            console.log('[DELETE] Sucesso na DB');

            // 3. Atualização optimista do estado local
            console.log('[DELETE] Passo 3: Atualização optimista');
            setDocuments(prev => prev.filter(d => d.id !== docId));
            setConfirmDeleteId(null);

            // 4. Forçar refresh
            console.log('[DELETE] Passo 4: Refresh final...');
            if (editingAgent?.id) {
                await fetchDocuments(editingAgent.id);
            } else {
                await fetchDocuments();
            }

            console.log('[DELETE] Fluxo terminado com sucesso');
        } catch (err: any) {
            console.error('[DELETE] Falha crítica:', err);
            alert('Erro ao apagar documento: ' + (err.message || 'Erro desconhecido'));
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
            {userProfile && (
                <TourGuide
                    run={runTour}
                    userId={userProfile.id}
                    onFinish={handleTourFinish}
                    steps={adminTourSteps}
                    saveOnComplete={true}
                />
            )}

            {/* Sidebar */}
            <aside className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/5 flex flex-col z-20 shadow-xl">
                <header className="h-16 glass sticky top-0 z-50 flex items-center px-4 md:px-6 justify-between border-b border-color">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 flex items-center justify-center p-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200/50 dark:border-white/5">
                                <img
                                    src={tenant?.logo_url || "/nexio_ai_icone.png"}
                                    alt="Nexio AI"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-tighter leading-none">Nexio AI</span>
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-0.5">{tenant?.name || 'Sistema'}</span>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 p-4 flex flex-col gap-2">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'dashboard'
                            ? 'bg-primary-500/10 text-primary-700 dark:text-primary-400'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/40'
                            }`}
                    >
                        <ChartIcon size={18} />
                        <span className="font-semibold">Dashboard</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('agents')}
                        data-tour="agents-tab"
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'agents'
                            ? 'bg-primary-500/10 text-primary-700 dark:text-primary-400'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/40'
                            }`}
                    >
                        <Bot size={18} />
                        <span className="font-semibold">Gestão de Agentes</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        data-tour="users-tab"
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'users'
                            ? 'bg-primary-500/10 text-primary-700 dark:text-primary-400'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/40'
                            }`}
                    >
                        <Users size={18} />
                        <span className="font-semibold">Gestão de Utilizadores</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('groups')}
                        data-tour="groups-tab"
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${activeTab === 'groups'
                            ? 'bg-primary-500/10 text-primary-700 dark:text-primary-400'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/40'
                            }`}
                    >
                        <Layers size={18} />
                        <span className="font-semibold">Gestão de Grupos</span>
                    </button>

                    <div className="flex-1" />

                    <div className="border-t border-slate-100 dark:border-white/5 pt-2">
                        <button
                            onClick={() => setRunTour(true)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-all text-xs font-bold uppercase tracking-widest"
                        >
                            <Bot size={16} />
                            Tutorial
                        </button>
                        <button
                            onClick={onBack}
                            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-all"
                        >
                            <ArrowLeft size={18} />
                            <span className="font-semibold">Voltar</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Admin Content */}
            <main className="flex-1 overflow-y-auto p-8">
                {activeTab === 'dashboard' && (
                    <Dashboard tenantId={userProfile?.tenant_id} />
                )}


                {activeTab === 'users' && (
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="flex items-center justify-between pb-8 border-b border-slate-200/40">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Gestão de Utilizadores</h2>
                                <p className="text-slate-500 mt-1">Controle permissões e acessos dos colaboradores.</p>
                            </div>
                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest px-4 py-1.5 bg-slate-100 rounded-lg">
                                {users.length} Utilizadores
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                            {loadingUsers ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <Loader2 className="animate-spin mb-2" />
                                    <span>A carregar utilizadores...</span>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Utilizador</th>
                                                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grupos</th>
                                                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cargo</th>
                                                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                                                <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map((user) => (
                                                <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center text-primary-700 font-bold shadow-sm">
                                                                {user.name?.[0] || user.id[0]}
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-slate-800 text-sm">{user.name || 'Sem nome'}</div>
                                                                <div className="text-[10px] text-slate-400 font-medium tracking-tight">{user.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                            {(userGroups[user.id] || []).map(gid => {
                                                                const groupName = groups.find(g => g.id === gid)?.name || '...';
                                                                return (
                                                                    <span key={gid} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold truncate">
                                                                        {groupName}
                                                                    </span>
                                                                );
                                                            })}
                                                            {(!userGroups[user.id] || userGroups[user.id].length === 0) && (
                                                                <span className="text-[10px] text-slate-300 italic">Sem grupos</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <button
                                                            onClick={() => toggleUserRole(user.id, user.role)}
                                                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}
                                                        >
                                                            {user.role}
                                                        </button>
                                                    </td>

                                                    <td className="p-4">
                                                        <button
                                                            onClick={() => toggleUserStatus(user.id, user.active)}
                                                            className={`flex items-center gap-2 group`}
                                                        >
                                                            <div className={`w-3 h-3 rounded-full ${user.active ? 'bg-green-500 shadow-sm shadow-green-200' : 'bg-slate-300'}`} />
                                                            <span className="text-xs font-medium text-slate-600 group-hover:text-slate-950 transition-colors">
                                                                {user.active ? 'Ativo' : 'Desativado'}
                                                            </span>
                                                        </button>
                                                    </td>
                                                    <td className="p-4">
                                                        <button
                                                            onClick={() => deleteUser(user.id)}
                                                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Invitation Section */}
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 space-y-6">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">Enviar Convites</h3>
                                <p className="text-sm text-slate-500">Cole múltiplos emails separados por vírgula (,) ou ponto-e-vírgula (;)</p>
                            </div>

                            <div className="space-y-4">
                                <textarea
                                    value={emailInput}
                                    onChange={(e) => setEmailInput(e.target.value)}
                                    placeholder="exemplo1@empresa.com, exemplo2@empresa.com; exemplo3@empresa.com"
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary-100 outline-none font-medium transition-all text-slate-800 min-h-[120px]"
                                />
                                <button
                                    onClick={parseEmails}
                                    disabled={!emailInput.trim()}
                                    className="w-full py-3 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Pré-visualizar Convites
                                </button>
                            </div>

                            {/* Pending Invitations */}
                            <div className="border-t border-slate-100 pt-6">
                                <h4 className="text-lg font-bold text-slate-800 mb-4">Convites Pendentes</h4>
                                {loadingInvitations ? (
                                    <div className="flex items-center justify-center py-8 text-slate-400">
                                        <Loader2 className="animate-spin mr-2" size={20} />
                                        <span>A carregar convites...</span>
                                    </div>
                                ) : invitations.filter(inv => inv.status === 'pending').length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-8">Nenhum convite pendente</p>
                                ) : (
                                    <div className="space-y-2">
                                        {invitations.filter(inv => inv.status === 'pending').map((inv) => (
                                            <div key={inv.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                                <div>
                                                    <p className="font-medium text-slate-800">{inv.email}</p>
                                                    <p className="text-xs text-slate-400">
                                                        Enviado em {new Date(inv.invited_at).toLocaleDateString('pt-PT')}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => resendInvitation(inv.id, inv.email)}
                                                    className="px-4 py-2 text-xs font-bold text-primary-600 hover:bg-primary-50 rounded-xl transition-all"
                                                >
                                                    Reenviar
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Confirmation Modal */}
                        {showInviteConfirmation && (
                            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
                                <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                                    <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                                        <h3 className="text-xl font-bold text-slate-800 tracking-tight">Confirmar Envio de Convites</h3>
                                        <button
                                            onClick={() => {
                                                setShowInviteConfirmation(false);
                                                setParsedEmails([]);
                                            }}
                                            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>
                                    <div className="p-8 space-y-6">
                                        <p className="text-sm text-slate-600">
                                            {parsedEmails.length} email{parsedEmails.length !== 1 ? 's' : ''} válido{parsedEmails.length !== 1 ? 's' : ''} encontrado{parsedEmails.length !== 1 ? 's' : ''}:
                                        </p>
                                        <div className="max-h-60 overflow-y-auto space-y-2 bg-slate-50 p-4 rounded-2xl">
                                            {parsedEmails.map((email, idx) => (
                                                <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded-xl">
                                                    <CheckCircle2 className="text-green-500" size={16} />
                                                    <span className="text-sm font-medium text-slate-700">{email}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => {
                                                    setShowInviteConfirmation(false);
                                                    setParsedEmails([]);
                                                }}
                                                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={sendInvitations}
                                                disabled={sendingInvites}
                                                className="flex-1 py-3 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                            >
                                                {sendingInvites ? (
                                                    <>
                                                        <Loader2 className="animate-spin" size={18} />
                                                        Enviando...
                                                    </>
                                                ) : (
                                                    'Enviar Convites'
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'agents' && (
                    <div className="max-w-5xl mx-auto space-y-6">
                        <div className="flex items-center justify-between pb-8 border-b border-slate-200/40">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Multi-Agentes</h2>
                                <p className="text-slate-500 mt-1">Crie e configure as personas da sua IA.</p>
                            </div>
                            <button
                                onClick={() => {
                                    setEditingAgent({
                                        name: '',
                                        description: '',
                                        system_prompt: SYSTEM_PROMPT_TEMPLATES['pt-PT'].generic.content,
                                        status: 'live',
                                        visibility: 'public',
                                        provider: 'openai',
                                        model: 'gpt-4o-mini',
                                        suggested_prompts: [''],
                                        knowledge_mode: 'internal_only',
                                        citations_mode: 'hide',
                                        rag_bias: 0.5,
                                        tests: []
                                    });
                                    setAgentVersions([]);
                                }}
                                className="border border-primary-600/30 text-primary-600 bg-white dark:bg-slate-900 px-6 py-2.5 rounded-2xl font-bold hover:bg-primary-50 transition-all flex items-center gap-2 text-sm shadow-sm"
                            >
                                <Plus size={18} /> Novo Agente
                            </button>
                        </div>

                        {editingAgent && (
                            <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
                                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-5xl shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh] border border-slate-200/50 dark:border-white/10">
                                    {/* Header with Mode Toggle */}
                                    <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/5 shrink-0">
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
                                                {editingAgent.id ? 'Configurar Agente' : 'Novo Agente'}
                                                {wizardMode === 'simple' && <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full">Modo Assistido</span>}
                                            </h3>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                {wizardMode === 'simple' ? 'Siga os passos para criar o seu agente rapidamente.' : 'Configuração manual completa.'}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="bg-slate-100 dark:bg-white/10 p-1 rounded-xl flex">
                                                <button
                                                    onClick={() => setWizardMode('simple')}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${wizardMode === 'simple' ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                                                >
                                                    Assistido
                                                    <span className="ml-1.5 px-1.5 py-0.5 text-[8px] bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-md border border-amber-200/50 dark:border-amber-500/20 tracking-tighter uppercase font-black">Beta</span>
                                                </button>
                                                <button
                                                    onClick={() => setWizardMode('advanced')}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${wizardMode === 'advanced' ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                                                >
                                                    Avançado
                                                </button>
                                            </div>
                                            <button type="button" onClick={() => setEditingAgent(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors text-slate-500 dark:text-slate-400"><X size={20} /></button>
                                        </div>
                                    </div>

                                    {wizardMode === 'simple' ? (
                                        /* --- WIZARD UI --- */
                                        <div className="p-8 flex-1 overflow-y-auto bg-slate-50/30 dark:bg-black/20">
                                            {/* Step Indicator */}
                                            <div className="flex justify-center mb-10">
                                                <div className="flex items-center gap-4">
                                                    {[1, 2, 3, 4].map(step => (
                                                        <div key={step} className="flex items-center gap-2">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${wizardStep >= step ? 'bg-primary-600 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500'
                                                                }`}>
                                                                {step}
                                                            </div>
                                                            {step < 4 && <div className={`w-12 h-0.5 ${wizardStep > step ? 'bg-primary-600' : 'bg-slate-200 dark:bg-white/10'}`} />}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="max-w-3xl mx-auto space-y-8 min-h-[400px]">
                                                {wizardStep === 1 && (
                                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                                        <div className="text-center">
                                                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Escolha um ponto de partida</h3>
                                                            <p className="text-slate-500 dark:text-slate-400 text-sm">Qual será a função principal deste agente?</p>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            {AGENT_TEMPLATES.map(t => (
                                                                <button
                                                                    key={t.id}
                                                                    type="button"
                                                                    onClick={() => { setTemplateId(t.id); setEditingAgent(prev => prev ? { ...prev, name: t.name } : null); }}
                                                                    className={`p-6 bg-white dark:bg-white/5 border-2 rounded-2xl text-left transition-all hover:shadow-lg ${templateId === t.id ? 'border-primary-500 ring-4 ring-primary-500/10' : 'border-slate-100 dark:border-white/5 hover:border-primary-200 dark:hover:border-primary-500/50'}`}
                                                                >
                                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${templateId === t.id ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400' : 'bg-slate-50 dark:bg-white/10 text-slate-400 dark:text-slate-300'}`}>
                                                                        <t.icon size={24} />
                                                                    </div>
                                                                    <h4 className="font-bold text-slate-800 dark:text-white">{t.name}</h4>
                                                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{t.desc}</p>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {wizardStep === 2 && (
                                                    <div className="max-w-2xl mx-auto space-y-6">
                                                        <div className="text-center mb-8">
                                                            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Persona do Agente</h3>
                                                            <p className="text-slate-500 dark:text-slate-400">Escolha um template ou defina o comportamento manual.</p>
                                                        </div>

                                                        <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm space-y-6">
                                                            <div>
                                                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Template de Agente (opcional)</label>
                                                                <select
                                                                    onChange={e => {
                                                                        const template = SYSTEM_PROMPT_TEMPLATES['pt-PT'][e.target.value];
                                                                        if (template) {
                                                                            setEditingAgent({ ...editingAgent!, system_prompt: template.content });
                                                                        }
                                                                    }}
                                                                    value={Object.keys(SYSTEM_PROMPT_TEMPLATES['pt-PT']).find(key => SYSTEM_PROMPT_TEMPLATES['pt-PT'][key].content === editingAgent?.system_prompt) || ''}
                                                                    className="w-full mt-1.5 p-3 bg-slate-50 dark:bg-black/20 dark:text-white rounded-xl border-none ring-1 ring-slate-200 dark:ring-white/10 focus:ring-2 focus:ring-primary-500/20 outline-none font-medium transition-all text-sm"
                                                                >
                                                                    <option value="">Personalizado / Manual</option>
                                                                    {Object.entries(SYSTEM_PROMPT_TEMPLATES['pt-PT']).map(([key, value]) => (
                                                                        <option key={key} value={key}>{value.name}</option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Mensagem do Sistema (Persona)</label>
                                                                <textarea
                                                                    value={editingAgent?.system_prompt || ''}
                                                                    onChange={e => setEditingAgent({ ...editingAgent!, system_prompt: e.target.value })}
                                                                    rows={8}
                                                                    placeholder="Define como o agente se deve comportar..."
                                                                    className="w-full mt-1.5 p-4 bg-slate-50 dark:bg-black/20 dark:text-white border-none ring-1 ring-slate-200 dark:ring-white/10 rounded-xl focus:ring-2 focus:ring-primary-500/20 outline-none font-medium transition-all text-sm resize-none"
                                                                />
                                                                <p className="text-[10px] text-slate-400 mt-2 px-1">Este prompt define a personalidade e as regras do assistente.</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {wizardStep === 3 && (
                                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                                        <div className="text-center">
                                                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Base de Conhecimento</h3>
                                                            <p className="text-slate-500 dark:text-slate-400 text-sm">Configure como o agente utiliza a base de conhecimento.</p>
                                                        </div>
                                                        <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm space-y-6">
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-1.5">
                                                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Modo de Resposta</label>
                                                                    <select
                                                                        value={editingAgent?.knowledge_mode || 'internal_only'}
                                                                        onChange={e => setEditingAgent({ ...editingAgent!, knowledge_mode: e.target.value as any })}
                                                                        className="w-full mt-1 p-3 bg-slate-50 dark:bg-black/20 dark:text-white rounded-xl border-none ring-1 ring-slate-200 dark:ring-white/10 focus:ring-2 focus:ring-primary-500/20 outline-none"
                                                                    >
                                                                        <option value="internal_only" className="dark:bg-slate-800">Apenas Documentos Internos</option>
                                                                        <option value="hybrid" className="dark:bg-slate-800">Híbrido (Interno + Geral)</option>
                                                                    </select>
                                                                </div>
                                                                <div className="space-y-1.5">
                                                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Citações</label>
                                                                    <select
                                                                        value={editingAgent?.citations_mode || 'hide'}
                                                                        onChange={e => setEditingAgent({ ...editingAgent!, citations_mode: e.target.value as any })}
                                                                        className="w-full mt-1 p-3 bg-slate-50 dark:bg-black/20 dark:text-white rounded-xl border-none ring-1 ring-slate-200 dark:ring-white/10 focus:ring-2 focus:ring-primary-500/20 outline-none"
                                                                    >
                                                                        <option value="hide" className="dark:bg-slate-800">Ocultar</option>
                                                                        <option value="show_on_hover" className="dark:bg-slate-800">Mostrar ao passar rato</option>
                                                                        <option value="always_show" className="dark:bg-slate-800">Sempre visíveis</option>
                                                                    </select>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-3">
                                                                <div className="flex justify-between items-center">
                                                                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Prioridade de Resposta ({(editingAgent?.rag_bias || 0.5) * 100}%)</label>
                                                                    <span className="text-[10px] text-slate-400 italic">{(editingAgent?.rag_bias || 0.5) < 0.4 ? 'Precisão Máxima' : (editingAgent?.rag_bias || 0.5) > 0.7 ? 'Criatividade Máxima' : 'Equilibrado'}</span>
                                                                </div>
                                                                <input
                                                                    type="range"
                                                                    min="0"
                                                                    max="1"
                                                                    step="0.1"
                                                                    value={editingAgent?.rag_bias || 0.5}
                                                                    onChange={e => setEditingAgent({ ...editingAgent!, rag_bias: parseFloat(e.target.value) })}
                                                                    className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary-600"
                                                                />
                                                                <div className="flex justify-between text-[10px] text-slate-400">
                                                                    <span>Fiel aos Documentos</span>
                                                                    <span>Mais Criatividade</span>
                                                                </div>
                                                            </div>

                                                            <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-4">Ficheiros de Suporte</p>
                                                                <div className="space-y-4">
                                                                    <div className="flex items-center gap-4">
                                                                        <label className="flex-1 cursor-pointer">
                                                                            <input
                                                                                type="file"
                                                                                className="hidden"
                                                                                multiple
                                                                                onChange={(e) => handleFileUpload(e, editingAgent?.id)}
                                                                            />
                                                                            <div className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all group">
                                                                                <Plus size={20} className="text-slate-400 group-hover:text-primary-500" />
                                                                                <span className="text-xs font-bold text-slate-500 group-hover:text-primary-600">Upload de Documentos</span>
                                                                            </div>
                                                                        </label>
                                                                    </div>
                                                                    <div className="space-y-2 max-h-[120px] overflow-y-auto pr-2">
                                                                        {documents.filter(d => d.agent_id === editingAgent?.id).map(doc => (
                                                                            <div key={doc.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-black/20 rounded-xl border border-slate-100 dark:border-white/5">
                                                                                <div className="flex items-center gap-2 overflow-hidden">
                                                                                    <FileText size={12} className="text-primary-500 shrink-0" />
                                                                                    <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate">{doc.filename}</span>
                                                                                </div>
                                                                                <button onClick={() => deleteDocument(doc.id, doc.storage_path)} className="text-slate-400 hover:text-red-500 transition-colors">
                                                                                    <X size={12} />
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {wizardStep === 4 && (
                                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                                        <div className="text-center">
                                                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Qualidade e Testes</h3>
                                                            <p className="text-slate-500 dark:text-slate-400 text-sm">Validamos as configurações para garantir o melhor desempenho.</p>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm flex flex-col items-center justify-center text-center">
                                                                <div className="relative mb-4">
                                                                    <svg className="w-24 h-24 transform -rotate-90">
                                                                        <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100 dark:text-white/5" />
                                                                        <circle
                                                                            cx="48"
                                                                            cy="48"
                                                                            r="40"
                                                                            stroke="currentColor"
                                                                            strokeWidth="8"
                                                                            fill="transparent"
                                                                            strokeDasharray={2 * Math.PI * 40}
                                                                            strokeDashoffset={2 * Math.PI * 40 * (1 - (
                                                                                ((editingAgent?.system_prompt?.length || 0) > 100 ? 0.3 : 0.1) +
                                                                                (documents.filter(d => d.agent_id === editingAgent?.id).length > 0 ? 0.4 : 0) +
                                                                                ((editingAgent?.tests?.length || 0) > 0 ? 0.3 : 0)
                                                                            ))}
                                                                            className="text-primary-600 transition-all duration-1000"
                                                                        />
                                                                    </svg>
                                                                    <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-slate-800 dark:text-white">
                                                                        {Math.round((
                                                                            ((editingAgent?.system_prompt?.length || 0) > 100 ? 0.3 : 0.1) +
                                                                            (documents.filter(d => d.agent_id === editingAgent?.id).length > 0 ? 0.4 : 0) +
                                                                            ((editingAgent?.tests?.length || 0) > 0 ? 0.3 : 0)
                                                                        ) * 100)}%
                                                                    </div>
                                                                </div>
                                                                <h4 className="font-bold text-slate-800 dark:text-white">Score de Qualidade</h4>
                                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">Aumente o score adicionando docs e testes.</p>
                                                            </div>

                                                            <div className="bg-white dark:bg-white/5 p-6 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Checklist de Qualidade</h4>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2 text-xs">
                                                                        {(editingAgent?.system_prompt?.length || 0) > 100 ? <CheckCircle2 size={14} className="text-green-500" /> : <X size={14} className="text-slate-300" />}
                                                                        <span className={(editingAgent?.system_prompt?.length || 0) > 100 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}>Persona Detalhada (+30%)</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-xs">
                                                                        {documents.filter(d => d.agent_id === editingAgent?.id).length > 0 ? <CheckCircle2 size={14} className="text-green-500" /> : <X size={14} className="text-slate-300" />}
                                                                        <span className={documents.filter(d => d.agent_id === editingAgent?.id).length > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}>Base de Conhecimento (+40%)</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 text-xs">
                                                                        {(editingAgent?.tests?.length || 0) > 0 ? <CheckCircle2 size={14} className="text-green-500" /> : <X size={14} className="text-slate-300" />}
                                                                        <span className={(editingAgent?.tests?.length || 0) > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}>Casos de Teste Definidos (+30%)</span>
                                                                    </div>
                                                                </div>

                                                                <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                                                                    <button
                                                                        onClick={() => setEditingAgent({ ...editingAgent!, tests: [...(editingAgent?.tests || []), { id: Date.now(), input: '', expected: '' }] })}
                                                                        className="w-full py-2 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 transition-all border border-slate-200 dark:border-white/10 flex items-center justify-center gap-2"
                                                                    >
                                                                        <Plus size={14} /> Adicionar Caso de Teste
                                                                    </button>
                                                                    {editingAgent?.tests && editingAgent.tests.length > 0 && (
                                                                        <p className="text-[10px] text-primary-600 dark:text-primary-400 mt-2 text-center font-bold">{editingAgent.tests.length} teste(s) pronto(s).</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Wizard Footer */}
                                            <div className="p-6 border-t border-slate-200 dark:border-white/5 flex justify-between items-center bg-white dark:bg-white/5 mt-auto">
                                                <button
                                                    onClick={() => setWizardStep(prev => Math.max(1, prev - 1))}
                                                    className={`px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 transition-all ${wizardStep === 1 ? 'invisible' : ''}`}
                                                >
                                                    Voltar
                                                </button>

                                                {wizardStep < 4 ? (
                                                    <button
                                                        onClick={handleWizardNext}
                                                        className="px-8 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-500/20 flex items-center gap-2"
                                                    >
                                                        Seguinte <ArrowRight size={18} />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={(e) => {
                                                            // Ensure event prevents default if inside a form, though here we are just clicking
                                                            saveAgent(e as any);
                                                        }}
                                                        disabled={savingAgent}
                                                        className="px-8 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-500/20 flex items-center gap-2"
                                                    >
                                                        {savingAgent ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                                        Publicar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        /* --- EXISTING ADVANCED FORM --- */
                                        <form onSubmit={saveAgent} className="flex flex-col flex-1 overflow-hidden">
                                            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Nome do Agente</label>
                                                        <input
                                                            required
                                                            value={editingAgent.name || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, name: e.target.value })}
                                                            placeholder="Ex: Agente de Vendas"
                                                            className="w-full p-3 bg-slate-50 dark:bg-black/20 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 outline-none font-medium transition-all text-slate-800"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Visibilidade</label>
                                                        <select
                                                            value={editingAgent.visibility || 'public'}
                                                            onChange={e => setEditingAgent({ ...editingAgent, visibility: e.target.value as any })}
                                                            className="w-full p-3 bg-slate-50 dark:bg-black/20 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 outline-none font-medium transition-all text-slate-800"
                                                        >
                                                            <option value="public" className="dark:bg-slate-800">Público (Acessível a todos)</option>
                                                            <option value="private" className="dark:bg-slate-800">Restrito (Admin e Grupos)</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* API and Model Selection */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">API (Provider)</label>
                                                        <select
                                                            required
                                                            value={editingAgent.provider || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, provider: e.target.value, model: '' })}
                                                            className="w-full p-3 bg-slate-50 dark:bg-black/20 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 outline-none font-medium transition-all text-slate-800"
                                                        >
                                                            <option value="" disabled>Seleccionar API</option>
                                                            <option value="openai" className="dark:bg-slate-800">OpenAI (GPT)</option>
                                                            <option value="google" className="dark:bg-slate-800">Google Gemini</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Modelo</label>
                                                        <select
                                                            required
                                                            value={editingAgent.model || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, model: e.target.value })}
                                                            disabled={!editingAgent.provider || fetchingModels}
                                                            className="w-full p-3 bg-slate-50 dark:bg-black/20 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 outline-none font-medium transition-all text-slate-800 disabled:opacity-50"
                                                        >
                                                            <option value="" disabled>{fetchingModels ? 'A carregar modelos...' : 'Seleccionar Modelo'}</option>
                                                            {availableModels.map(m => (
                                                                <option key={m.id} value={m.id} className="dark:bg-slate-800">{m.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Descrição Curta</label>
                                                    <input
                                                        value={editingAgent.description || ''}
                                                        onChange={e => setEditingAgent({ ...editingAgent, description: e.target.value })}
                                                        placeholder="Breve resumo da função..."
                                                        className="w-full p-3 bg-slate-50 dark:bg-black/20 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 outline-none font-medium transition-all text-slate-800"
                                                    />
                                                </div>

                                                {/* Configuração da Base de Conhecimento (Avançado) */}
                                                <div className="bg-slate-50 dark:bg-white/5 p-5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-4">
                                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest px-1">Configuração da Base de Conhecimento</p>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Modo de Resposta</label>
                                                            <select
                                                                value={editingAgent.knowledge_mode || 'internal_only'}
                                                                onChange={e => setEditingAgent({ ...editingAgent, knowledge_mode: e.target.value as any })}
                                                                className="w-full p-2.5 bg-white dark:bg-black/20 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 outline-none font-medium transition-all text-sm"
                                                            >
                                                                <option value="internal_only" className="dark:bg-slate-800">Apenas Documentos Internos</option>
                                                                <option value="hybrid" className="dark:bg-slate-800">Híbrido (Interno + Geral)</option>
                                                            </select>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Citações</label>
                                                            <select
                                                                value={editingAgent.citations_mode || 'hide'}
                                                                onChange={e => setEditingAgent({ ...editingAgent, citations_mode: e.target.value as any })}
                                                                className="w-full p-2.5 bg-white dark:bg-black/20 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 outline-none font-medium transition-all text-sm"
                                                            >
                                                                <option value="hide" className="dark:bg-slate-800">Ocultar</option>
                                                                <option value="show_on_hover" className="dark:bg-slate-800">Mostrar ao passar rato</option>
                                                                <option value="always_show" className="dark:bg-slate-800">Sempre visíveis</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Prioridade de Resposta ({(editingAgent.rag_bias || 0.5) * 100}%)</label>
                                                            <span className="text-[10px] text-slate-400 italic">{(editingAgent.rag_bias || 0.5) < 0.4 ? 'Precisão' : (editingAgent.rag_bias || 0.5) > 0.7 ? 'Criatividade' : 'Equilibrado'}</span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="1"
                                                            step="0.1"
                                                            value={editingAgent.rag_bias || 0.5}
                                                            onChange={e => setEditingAgent({ ...editingAgent, rag_bias: parseFloat(e.target.value) })}
                                                            className="w-full h-2 bg-primary-100 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary-600"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between items-center px-1">
                                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Template de Agente (opcional)</label>
                                                        <select
                                                            onChange={e => {
                                                                const template = SYSTEM_PROMPT_TEMPLATES['pt-PT'][e.target.value];
                                                                if (template) {
                                                                    setEditingAgent({ ...editingAgent, system_prompt: template.content });
                                                                }
                                                            }}
                                                            value={Object.keys(SYSTEM_PROMPT_TEMPLATES['pt-PT']).find(key => SYSTEM_PROMPT_TEMPLATES['pt-PT'][key].content === editingAgent.system_prompt) || ''}
                                                            className="text-[10px] bg-transparent border-none text-primary-600 dark:text-primary-400 font-bold focus:ring-0 cursor-pointer"
                                                        >
                                                            <option value="">Personalizado</option>
                                                            {Object.entries(SYSTEM_PROMPT_TEMPLATES['pt-PT']).map(([key, value]) => (
                                                                <option key={key} value={key}>{value.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <textarea
                                                        required
                                                        value={editingAgent.system_prompt}
                                                        onChange={e => setEditingAgent({ ...editingAgent, system_prompt: e.target.value })}
                                                        rows={6}
                                                        placeholder="Define como o agente se deve comportar..."
                                                        className="w-full p-4 bg-slate-50 dark:bg-black/20 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 outline-none font-medium transition-all text-sm resize-none"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 pt-2">
                                                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Estado:</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingAgent({ ...editingAgent, status: editingAgent.status === 'live' ? 'disabled' : 'live' })}
                                                        className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${editingAgent.status === 'live' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}
                                                    >
                                                        {editingAgent.status === 'live' ? 'Ativo' : 'Desativado'}
                                                    </button>
                                                </div>

                                                {/* Knowledge Base Section inside Agent Form */}
                                                {!editingAgent.id ? (
                                                    <div className="bg-primary-50/50 dark:bg-primary-900/10 p-6 rounded-2xl border border-primary-100/50 dark:border-primary-500/10 text-center animate-pulse">
                                                        <p className="text-xs font-semibold text-primary-700 dark:text-primary-400">Guarde o Agente primeiro para ativar a Base de Conhecimento.</p>
                                                    </div>
                                                ) : (
                                                    <div className="bg-slate-50 dark:bg-white/5 p-5 rounded-2xl border border-slate-100 dark:border-white/5 space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest px-1">Base de Conhecimento (Ficheiros)</p>
                                                            <label className="cursor-pointer text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-[11px] font-bold flex items-center gap-1 transition-all">
                                                                <Plus size={14} /> Adicionar PDF
                                                                <input type="file" className="hidden" accept=".pdf" onChange={(e) => handleFileUpload(e, editingAgent.id || '')} disabled={uploading} />
                                                            </label>
                                                        </div>

                                                        <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 scrollbar-thin">
                                                            {loading ? (
                                                                <div className="py-2 text-center text-slate-400 dark:text-slate-500 text-[10px] flex items-center justify-center gap-2">
                                                                    <Loader2 size={10} className="animate-spin" /> Carregando...
                                                                </div>
                                                            ) : documents.filter(d => d.agent_id === editingAgent.id).length === 0 ? (
                                                                <div className="py-4 text-center text-slate-400 dark:text-slate-500 text-[10px] bg-white dark:bg-black/20 rounded-xl border border-dashed border-slate-200 dark:border-white/10">
                                                                    Nenhum ficheiro para este agente.
                                                                </div>
                                                            ) : (
                                                                documents.filter(d => d.agent_id === editingAgent.id).map(doc => (
                                                                    <div key={doc.id}>
                                                                        <div className="bg-white dark:bg-white/5 p-2.5 rounded-xl border border-slate-100 dark:border-white/5 flex items-center justify-between group shadow-sm transition-all hover:border-primary-100 dark:hover:border-primary-500/20">
                                                                            <div className="flex items-center gap-2 overflow-hidden px-1">
                                                                                <FileText size={14} className="text-primary-500 dark:text-primary-400 shrink-0" />
                                                                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">{doc.filename}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                {doc.status === 'ready' ? (
                                                                                    <span className="px-2 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg text-[7px] font-bold uppercase tracking-wider flex items-center gap-1">
                                                                                        <CheckCircle2 size={10} /> PRONTO
                                                                                    </span>
                                                                                ) : doc.status === 'error' ? (
                                                                                    <span className="px-2 py-0.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-[7px] font-bold uppercase tracking-wider flex items-center gap-1">
                                                                                        <AlertCircle size={10} /> ERRO
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg text-[7px] font-bold uppercase tracking-wider flex items-center gap-1">
                                                                                        <Loader2 size={10} className="animate-spin" /> A PROCESSAR...
                                                                                    </span>
                                                                                )}

                                                                                {confirmDeleteId === doc.id ? (
                                                                                    <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.preventDefault();
                                                                                                e.stopPropagation();
                                                                                                deleteDocument(doc.id, doc.storage_path, true);
                                                                                            }}
                                                                                            className="px-2 py-1 bg-red-600 text-white text-[8px] font-bold rounded-md hover:bg-red-700 transition-colors shadow-sm"
                                                                                        >
                                                                                            Apagar?
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.preventDefault();
                                                                                                e.stopPropagation();
                                                                                                setConfirmDeleteId(null);
                                                                                            }}
                                                                                            className="p-1 bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 rounded-md hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                                                                                        >
                                                                                            <X size={10} />
                                                                                        </button>
                                                                                    </div>
                                                                                ) : (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={(e) => {
                                                                                            e.preventDefault();
                                                                                            e.stopPropagation();
                                                                                            console.log('[UI] Clique no lixo para doc:', doc.id);
                                                                                            deleteDocument(doc.id, doc.storage_path);
                                                                                        }}
                                                                                        className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer relative z-10"
                                                                                        title="Apagar documento"
                                                                                    >
                                                                                        <Trash2 size={14} />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        {doc.status === 'error' && doc.error_message && (
                                                                            <div className="mx-3 mt-1 mb-2 p-2 bg-red-50 border border-red-100 rounded-lg animate-in fade-in slide-in-from-top-1">
                                                                                <p className="text-[9px] text-red-600 leading-tight">
                                                                                    <strong>Erro no processamento:</strong> {doc.error_message}
                                                                                </p>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>

                                                        <div className="pt-4 border-t border-slate-200/50 dark:border-white/5 space-y-3">
                                                            <div className="flex items-center justify-between px-1">
                                                                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest">Temas de conversa</p>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingAgent({ ...editingAgent, suggested_prompts: [...(editingAgent.suggested_prompts || []), ''] })}
                                                                    className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 text-[10px] font-bold flex items-center gap-1"
                                                                >
                                                                    <Plus size={12} /> Adicionar Tema
                                                                </button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {(editingAgent.suggested_prompts || ['']).map((prompt, idx) => (
                                                                    <div key={idx} className="flex items-center gap-2 group">
                                                                        <input
                                                                            value={prompt}
                                                                            onChange={e => {
                                                                                const newPrompts = [...(editingAgent.suggested_prompts || [])];
                                                                                newPrompts[idx] = e.target.value;
                                                                                setEditingAgent({ ...editingAgent, suggested_prompts: newPrompts });
                                                                            }}
                                                                            placeholder="Ex: Como posso ajudar?"
                                                                            className="flex-1 p-2.5 bg-white dark:bg-black/20 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 outline-none font-medium transition-all text-xs"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const newPrompts = (editingAgent.suggested_prompts || []).filter((_, i) => i !== idx);
                                                                                setEditingAgent({ ...editingAgent, suggested_prompts: newPrompts });
                                                                            }}
                                                                            className="p-2 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl"
                                                                        >
                                                                            <X size={14} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <p className="text-[9px] text-slate-400 dark:text-slate-500 italic">Estes temas aparecerão como sugestões rápidas no início do chat.</p>
                                                        </div>

                                                        <div className="pt-4 border-t border-slate-200/50 dark:border-white/5 space-y-2">
                                                            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-widest px-1">Base de Conhecimento (Texto)</p>
                                                            <textarea
                                                                value={editingAgent.knowledge_text || ''}
                                                                onChange={e => setEditingAgent({ ...editingAgent, knowledge_text: e.target.value })}
                                                                placeholder="Adicione informações, regras ou factos adicionais..."
                                                                rows={4}
                                                                className="w-full p-3 bg-white dark:bg-black/20 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 outline-none font-medium transition-all text-xs resize-none text-slate-800"
                                                            />
                                                            <p className="text-[9px] text-slate-400 dark:text-slate-500 italic">Este texto servirá como conhecimento base para todas as respostas deste agente.</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-6 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3 shrink-0">
                                                <button type="button" onClick={() => setEditingAgent(null)} className="px-6 py-2.5 font-bold text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10 rounded-xl transition-all">Cancelar</button>
                                                <button type="submit" disabled={savingAgent} className="px-8 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-100 dark:shadow-primary-500/20 disabled:opacity-50 flex items-center gap-2">
                                                    {savingAgent ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                                    Guardar Agente
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {loadingAgents ? (
                                <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                                    <Loader2 className="animate-spin mb-2" />
                                    <span>A carregar agentes...</span>
                                </div>
                            ) : agents.length === 0 ? (
                                <div className="col-span-full text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                                    <LayoutDashboard className="mx-auto text-slate-300 mb-4" size={48} />
                                    <p className="text-slate-500">Nenhum agente configurado. Crie o primeiro!</p>
                                </div>
                            ) : (
                                agents.map((agent) => (
                                    <div key={agent.id} className="bg-white rounded-[2rem] border border-slate-200/50 shadow-sm overflow-hidden flex flex-col hover:shadow-2xl hover:border-primary-200/50 transition-all group animate-slide-up">
                                        <div className="p-8 flex-1">
                                            <div className="flex items-start justify-between mb-6">
                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-xl shadow-primary-500/10 ${agent.visibility === 'private' ? 'bg-amber-500' : 'bg-primary-600'}`}>
                                                    {agent.name[0]}
                                                </div>
                                                <div className="flex items-center gap-1.5 grayscale group-hover:grayscale-0 transition-all">
                                                    <button
                                                        onClick={() => setEditingAgent({
                                                            ...agent,
                                                            suggested_prompts: agent.suggested_prompts || []
                                                        })}
                                                        className="p-2 text-slate-400 hover:text-primary-600 transition-colors bg-slate-50 rounded-xl"
                                                    >
                                                        <Settings size={18} />
                                                    </button>
                                                    <button onClick={() => deleteAgent(agent.id!)} className="p-2 text-slate-400 hover:text-red-600 transition-colors bg-slate-50 rounded-xl"><Trash2 size={18} /></button>
                                                </div>
                                            </div>
                                            <h3 className="font-bold text-slate-800 text-xl tracking-tight group-hover:text-primary-600 transition-colors">{agent.name}</h3>
                                            <p className="text-slate-500 text-sm mt-2 line-clamp-2 leading-relaxed">{agent.description || 'Sem descrição.'}</p>

                                            <div className="flex items-center gap-2 mt-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {(agentGroups[agent.id!] || []).map(gid => (
                                                        <span key={gid} className="px-2 py-0.5 bg-primary-50 text-primary-600 border border-primary-100 rounded text-[8px] font-bold uppercase tracking-tight">
                                                            {groups.find(g => g.id === gid)?.name}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 mt-6">
                                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider ${agent.visibility === 'public' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                                    {agent.visibility === 'public' ? 'Público' : 'Restrito'}
                                                </span>
                                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider ${agent.status === 'live' ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                                                    {agent.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="p-5 bg-slate-50/50 flex items-center justify-between border-t border-slate-100/50">
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest pl-3">Prompt: {agent.system_prompt.length} carateres</span>
                                            <div className="w-2 h-2 rounded-full bg-green-500/50 animate-pulse mr-3" />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )
                }

                {
                    activeTab === 'groups' && (
                        <div className="max-w-6xl mx-auto space-y-6">
                            <div className="flex items-center justify-between pb-8 border-b border-slate-200/40">
                                <div>
                                    <h2 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">Gestão de Grupos</h2>
                                    <p className="text-slate-500 mt-1">Organize utilizadores e agentes em grupos de trabalho.</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setEditingGroup({ id: '', name: '', description: '' });
                                        setGroupMembers([]);
                                        setGroupAgents([]);
                                    }}
                                    className="border border-primary-600/30 text-primary-600 bg-white dark:bg-slate-900 px-6 py-2.5 rounded-2xl font-bold hover:bg-primary-50 transition-all flex items-center gap-2 text-sm shadow-sm"
                                >
                                    <FolderPlus size={18} /> Novo Grupo
                                </button>
                            </div>

                            {editingGroup && (
                                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
                                    <form onSubmit={saveGroup} className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh] border border-slate-200/50 dark:border-white/10">
                                        <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/30 dark:bg-white/5 shrink-0">
                                            <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">{editingGroup.id ? 'Editar Grupo' : 'Novo Grupo'}</h3>
                                            <button type="button" onClick={() => setEditingGroup(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors text-slate-500 dark:text-slate-400"><X size={20} /></button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Nome do Grupo</label>
                                                        <input
                                                            required
                                                            value={editingGroup.name}
                                                            onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                                                            placeholder="Ex: Departamento Comercial"
                                                            className="w-full p-3 bg-slate-50 dark:bg-black/20 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 outline-none font-medium transition-all"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Descrição</label>
                                                        <textarea
                                                            value={editingGroup.description}
                                                            onChange={e => setEditingGroup({ ...editingGroup, description: e.target.value })}
                                                            placeholder="Breve descrição do grupo..."
                                                            rows={3}
                                                            className="w-full p-3 bg-slate-50 dark:bg-black/20 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 outline-none font-medium transition-all resize-none"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="bg-slate-50 dark:bg-white/5 p-6 rounded-3xl border border-slate-100 dark:border-white/5">
                                                    <p className="text-xs font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                                        <Search size={14} className="text-primary-500 dark:text-primary-400" /> Pesquisa Rápida
                                                    </p>
                                                    <input
                                                        type="text"
                                                        value={searchTerm}
                                                        onChange={e => setSearchTerm(e.target.value)}
                                                        placeholder="Pesquisar utilizadores ou agentes..."
                                                        className="w-full p-3 bg-white dark:bg-black/20 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 outline-none font-medium transition-all text-sm mb-4"
                                                    />
                                                    <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-relaxed">Utilize o campo de pesquisa abaixo para encontrar rapidamente utilizadores ou agentes para adicionar ao grupo.</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                {/* Member Selection */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between px-1">
                                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Utilizadores no Grupo ({groupMembers.length})</label>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.5rem] overflow-hidden">
                                                        <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                                                            {users.filter(u => !searchTerm || u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.id.includes(searchTerm)).map(user => {
                                                                const isChecked = groupMembers.includes(user.id);
                                                                return (
                                                                    <div
                                                                        key={user.id}
                                                                        onClick={() => {
                                                                            if (isChecked) setGroupMembers(prev => prev.filter(id => id !== user.id));
                                                                            else setGroupMembers(prev => [...prev, user.id]);
                                                                        }}
                                                                        className={`p-3 flex items-center justify-between cursor-pointer hover:bg-white dark:hover:bg-white/10 transition-colors group ${isChecked ? 'bg-primary-50/30 dark:bg-primary-900/20' : ''}`}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${isChecked ? 'bg-primary-600 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400'}`}>
                                                                                {user.name?.[0] || 'U'}
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{user.name || 'Sem nome'}</div>
                                                                                <div className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">{user.email}</div>
                                                                                <div className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-tighter">{user.role}</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${isChecked ? 'border-primary-600 bg-primary-600' : 'border-slate-300'}`}>
                                                                            {isChecked && <CheckCircle2 size={12} className="text-white" />}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Agent Selection */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between px-1">
                                                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Agentes no Grupo ({groupAgents.length})</label>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-[1.5rem] overflow-hidden">
                                                        <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                                                            {agents.filter(a => !searchTerm || a.name.toLowerCase().includes(searchTerm.toLowerCase())).map(agent => {
                                                                const isChecked = groupAgents.includes(agent.id!);
                                                                return (
                                                                    <div
                                                                        key={agent.id}
                                                                        onClick={() => {
                                                                            if (isChecked) setGroupAgents(prev => prev.filter(id => id !== agent.id));
                                                                            else setGroupAgents(prev => [...prev, agent.id!]);
                                                                        }}
                                                                        className={`p-3 flex items-center justify-between cursor-pointer hover:bg-white dark:hover:bg-white/10 transition-colors group ${isChecked ? 'bg-amber-50/30 dark:bg-amber-900/20' : ''}`}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${isChecked ? 'bg-amber-500 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400'}`}>
                                                                                {agent.name[0]}
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{agent.name}</div>
                                                                                <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate max-w-[150px]">{agent.description}</div>
                                                                            </div>
                                                                        </div>
                                                                        <div className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${isChecked ? 'border-amber-500 bg-amber-500' : 'border-slate-300'}`}>
                                                                            {isChecked && <CheckCircle2 size={12} className="text-white" />}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-6 bg-slate-50 dark:bg-white/5 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3 shrink-0">
                                            <button type="button" onClick={() => setEditingGroup(null)} className="px-6 py-2.5 font-bold text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10 rounded-xl transition-all">Cancelar</button>
                                            <button type="submit" disabled={savingGroup} className="px-8 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-100 dark:shadow-primary-500/20 disabled:opacity-50 flex items-center gap-2">
                                                {savingGroup ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                                Guardar Grupo
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {loadingGroups ? (
                                    <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                                        <Loader2 className="animate-spin mb-2" />
                                        <span>A carregar grupos...</span>
                                    </div>
                                ) : groups.length === 0 ? (
                                    <div className="col-span-full text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                                        <FolderPlus className="mx-auto text-slate-300 mb-4" size={48} />
                                        <p className="text-slate-500">Nenhum grupo criado. Crie o primeiro!</p>
                                    </div>
                                ) : (
                                    groups.map((group) => (
                                        <div key={group.id} className="bg-white rounded-[2rem] border border-slate-200/50 shadow-sm overflow-hidden flex flex-col hover:shadow-2xl hover:border-primary-200/50 transition-all group animate-slide-up">
                                            <div className="p-8 flex-1">
                                                <div className="flex items-start justify-between mb-6">
                                                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-2xl shadow-sm group-hover:bg-primary-100 group-hover:text-primary-600 transition-colors">
                                                        <Users size={32} />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => {
                                                                setEditingGroup(group);
                                                                fetchGroupDetails(group.id);
                                                            }}
                                                            className="p-2 text-slate-400 hover:text-primary-600 transition-colors bg-slate-50 rounded-xl"
                                                        >
                                                            <Settings size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteGroup(group.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 transition-colors bg-slate-50 rounded-xl"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <h3 className="font-bold text-slate-800 text-xl tracking-tight group-hover:text-primary-600 transition-colors">{group.name}</h3>
                                                <p className="text-slate-500 text-sm mt-2 line-clamp-2 leading-relaxed">{group.description || 'Sem descrição.'}</p>

                                                <div className="mt-6 flex items-center gap-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Utilizadores</span>
                                                        <span className="text-lg font-bold text-slate-700">
                                                            {Object.values(userGroups).filter(gids => gids.includes(group.id)).length}
                                                        </span>
                                                    </div>
                                                    <div className="w-px h-8 bg-slate-100" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agentes</span>
                                                        <span className="text-lg font-bold text-slate-700">
                                                            {Object.values(agentGroups).filter(gids => gids.includes(group.id)).length}
                                                        </span>
                                                    </div>
                                                </div>

                                            </div>
                                            <div className="p-5 bg-slate-50/50 flex items-center justify-between border-t border-slate-100/50">
                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest pl-3 flex items-center gap-2">
                                                    <CheckCircle2 size={10} className="text-green-500" /> Ativo
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )
                }
            </main >
        </div >
    );
};
