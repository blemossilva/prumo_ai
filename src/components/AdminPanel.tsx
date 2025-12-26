import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    FileText,
    Trash2,
    Settings,
    Users,
    CheckCircle2,
    Loader2,
    Shield,
    ArrowLeft,
    LayoutDashboard,
    Plus,
    X,
    FolderPlus,
    Search
} from 'lucide-react';

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
}

export const AdminPanel = ({ onBack }: { onBack: () => void }) => {
    const [activeTab, setActiveTab] = useState<'users' | 'agents' | 'groups'>('agents');
    const [documents, setDocuments] = useState<Document[]>([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [availableModels, setAvailableModels] = useState<{ id: string, name: string }[]>([]);
    const [fetchingModels, setFetchingModels] = useState(false);

    const [users, setUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const [agents, setAgents] = useState<Agent[]>([]);
    const [loadingAgents, setLoadingAgents] = useState(false);
    const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
    const [savingAgent, setSavingAgent] = useState(false);

    // Group management state
    const [groups, setGroups] = useState<Group[]>([]);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [editingGroup, setEditingGroup] = useState<Group | null>(null);
    const [savingGroup, setSavingGroup] = useState(false);
    const [groupMembers, setGroupMembers] = useState<string[]>([]); // list of user_ids
    const [groupAgents, setGroupAgents] = useState<string[]>([]);   // list of agent_ids
    const [searchTerm, setSearchTerm] = useState('');

    // State for managing user-group associations outside of group tab
    const [userGroups, setUserGroups] = useState<Record<string, string[]>>({});
    const [agentGroups, setAgentGroups] = useState<Record<string, string[]>>({});


    useEffect(() => {
        fetchDocuments();
    }, []);

    useEffect(() => {
        if (activeTab === 'agents') {
            fetchAgents();
            fetchDocuments();
            fetchGroups();
            fetchAllAgentGroups();
        }
        if (activeTab === 'users') {
            fetchUsers();
            fetchGroups();
            fetchAllUserGroups();
        }
        if (activeTab === 'groups') {
            fetchGroups();
            fetchUsers();
            fetchAgents();
        }
    }, [activeTab]);

    const fetchGroups = async () => {
        setLoadingGroups(true);
        const { data } = await supabase.from('user_groups').select('*').order('name');
        if (data) setGroups(data);
        setLoadingGroups(false);
    };

    const fetchAllUserGroups = async () => {
        const { data } = await supabase.from('user_group_members').select('*');
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
        const { data } = await supabase.from('user_group_agents').select('*');
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
                ? { id, ...rest, updated_at: new Date().toISOString() }
                : { ...rest, updated_at: new Date().toISOString() };

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
        const { data } = await supabase
            .from('agents')
            .select('*')
            .order('created_at', { ascending: false });
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
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

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
                            .single();

                        let docId = existingDoc?.id;

                        if (!docId) {
                            // 2. Create the virtual document
                            const { data: newDoc, error: docError } = await supabase
                                .from('documents')
                                .insert({
                                    agent_id: data.id,
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
                            .single();

                        if (existingDoc) {
                            await supabase.from('document_chunks').delete().eq('document_id', existingDoc.id);
                            await supabase.from('documents').delete().eq('id', existingDoc.id);
                        }
                    }
                }
                fetchAgents();
                alert('Agente guardado e conhecimento processado!');
            }
        } catch (err: any) {
            console.error('Erro fatal ao guardar:', err);
            alert(`Erro inesperado: ${err.message || 'Erro desconhecido'}`);
        } finally {
            setSavingAgent(false);
        }
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
            const filePath = `knowledge/${fileName}`;

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
                    agent_id: agentId || null
                })
                .select()
                .single();

            if (dbError) throw dbError;

            if (docRecord) {
                await supabase.functions.invoke('ingest', {
                    body: { document_id: docRecord.id }
                });
            }

            fetchDocuments(agentId);
        } catch (error: any) {
            alert(error.message || 'Erro ao carregar ficheiro');
        } finally {
            setUploading(false);
        }
    };

    const deleteDocument = async (docId: string, storagePath: string) => {
        if (!confirm('Tem certeza que deseja apagar este documento?')) return;

        try {
            await supabase.storage.from('hr_kb').remove([storagePath]);
            await supabase.from('documents').delete().eq('id', docId);
            fetchDocuments();
        } catch (err) {
            alert('Erro ao apagar documento');
        }
    };

    return (
        <div className="h-screen bg-[rgb(var(--background))] flex flex-col overflow-hidden transition-colors duration-300">
            <header className="h-16 glass sticky top-0 z-50 flex items-center px-4 md:px-6 justify-between border-b border-color">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-3">
                        <Shield className="text-primary-600" size={20} />
                        <h1 className="text-base md:text-lg font-medium tracking-tight text-slate-700 dark:text-white uppercase truncate">Painel de Administração</h1>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                <nav className="w-80 sidebar-bg border-r border-slate-200/40 p-4 flex flex-col gap-2">
                    <button
                        onClick={() => setActiveTab('agents')}
                        className={`flex items-center gap-3 p-3 text-xs rounded-xl transition-all font-semibold ${activeTab === 'agents' ? 'bg-primary-500/10 text-primary-700 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/40'}`}
                    >
                        <LayoutDashboard size={18} /> Gestão de Agentes
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex items-center gap-3 p-3 text-xs rounded-xl transition-all font-semibold ${activeTab === 'users' ? 'bg-primary-500/10 text-primary-700 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/40'}`}
                    >
                        <Users size={18} /> Gestão de Utilizadores
                    </button>
                    <button
                        onClick={() => setActiveTab('groups')}
                        className={`flex items-center gap-3 p-3 text-xs rounded-xl transition-all font-semibold ${activeTab === 'groups' ? 'bg-primary-500/10 text-primary-700 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/40'}`}
                    >
                        <LayoutDashboard size={18} /> Gestão de Grupos
                    </button>

                </nav>

                {/* Admin Content */}
                <main className="flex-1 overflow-y-auto p-8">

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
                                                                    <div className="text-[9px] text-slate-400 font-mono uppercase tracking-tight">{user.id.substring(0, 12)}</div>
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
                                    onClick={() => setEditingAgent({
                                        name: '',
                                        description: '',
                                        system_prompt: '',
                                        status: 'live',
                                        visibility: 'public',
                                        provider: 'openai',
                                        model: 'gpt-4o-mini',
                                        suggested_prompts: ['']
                                    })}
                                    className="border border-primary-600/30 text-primary-600 bg-white dark:bg-slate-900 px-6 py-2.5 rounded-2xl font-bold hover:bg-primary-50 transition-all flex items-center gap-2 text-sm shadow-sm"
                                >
                                    <Plus size={18} /> Novo Agente
                                </button>
                            </div>

                            {editingAgent && (
                                <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
                                    <form onSubmit={saveAgent} className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh] border border-slate-200/50">
                                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30 shrink-0">
                                            <h3 className="text-xl font-bold text-slate-800 tracking-tight">{editingAgent.id ? 'Editar Agente' : 'Novo Agente'}</h3>
                                            <button type="button" onClick={() => setEditingAgent(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
                                        </div>
                                        <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nome do Agente</label>
                                                    <input
                                                        required
                                                        value={editingAgent.name || ''}
                                                        onChange={e => setEditingAgent({ ...editingAgent, name: e.target.value })}
                                                        placeholder="Ex: Agente de Vendas"
                                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 outline-none font-medium transition-all text-slate-800"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Visibilidade</label>
                                                    <select
                                                        value={editingAgent.visibility || 'public'}
                                                        onChange={e => setEditingAgent({ ...editingAgent, visibility: e.target.value as any })}
                                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 outline-none font-medium transition-all text-slate-800"
                                                    >
                                                        <option value="public">Público (Acessível a todos)</option>
                                                        <option value="private">Restrito (Admin e Grupos)</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Descrição Curta</label>
                                                <input
                                                    value={editingAgent.description || ''}
                                                    onChange={e => setEditingAgent({ ...editingAgent, description: e.target.value })}
                                                    placeholder="Breve resumo da função..."
                                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 outline-none font-medium transition-all text-slate-800"
                                                />
                                            </div>

                                            {/* AI Configuration Section */}
                                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest px-1">Configuração de IA</p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Fornecedor</label>
                                                        <select
                                                            value={editingAgent.provider}
                                                            onChange={e => setEditingAgent({ ...editingAgent, provider: e.target.value, model: '' })}
                                                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 outline-none font-medium transition-all text-sm"
                                                        >
                                                            <option value="openai">OpenAI</option>
                                                            <option value="gemini">Gemini</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1 flex items-center gap-2">
                                                            Modelo
                                                            {fetchingModels && <Loader2 size={10} className="animate-spin text-primary-500" />}
                                                        </label>
                                                        <select
                                                            value={editingAgent.model}
                                                            onChange={e => setEditingAgent({ ...editingAgent, model: e.target.value })}
                                                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 outline-none font-medium transition-all text-sm h-[42px]"
                                                        >
                                                            <option value="">Selecione...</option>
                                                            {availableModels.map(m => (
                                                                <option key={m.id} value={m.id}>{m.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">System Prompt (Persona)</label>
                                                <textarea
                                                    required
                                                    value={editingAgent.system_prompt}
                                                    onChange={e => setEditingAgent({ ...editingAgent, system_prompt: e.target.value })}
                                                    rows={6}
                                                    placeholder="Define como o agente se deve comportar..."
                                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 outline-none font-medium transition-all text-sm resize-none"
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 pt-2">
                                                <label className="text-sm font-medium text-slate-600">Estado:</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingAgent({ ...editingAgent, status: editingAgent.status === 'live' ? 'disabled' : 'live' })}
                                                    className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all ${editingAgent.status === 'live' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}
                                                >
                                                    {editingAgent.status === 'live' ? 'Ativo' : 'Desativado'}
                                                </button>
                                            </div>

                                            {/* Knowledge Base Section inside Agent Form */}
                                            {!editingAgent.id ? (
                                                <div className="bg-primary-50/50 p-6 rounded-2xl border border-primary-100/50 text-center animate-pulse">
                                                    <p className="text-xs font-semibold text-primary-700">Guarde o Agente primeiro para ativar a Base de Conhecimento.</p>
                                                </div>
                                            ) : (
                                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest px-1">Base de Conhecimento (Ficheiros)</p>
                                                        <label className="cursor-pointer text-primary-600 hover:text-primary-700 text-[11px] font-bold flex items-center gap-1 transition-all">
                                                            <Plus size={14} /> Adicionar PDF
                                                            <input type="file" className="hidden" accept=".pdf" onChange={(e) => handleFileUpload(e, editingAgent.id || '')} disabled={uploading} />
                                                        </label>
                                                    </div>

                                                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 scrollbar-thin">
                                                        {loading ? (
                                                            <div className="py-2 text-center text-slate-400 text-[10px] flex items-center justify-center gap-2">
                                                                <Loader2 size={10} className="animate-spin" /> Carregando...
                                                            </div>
                                                        ) : documents.filter(d => d.agent_id === editingAgent.id).length === 0 ? (
                                                            <div className="py-4 text-center text-slate-400 text-[10px] bg-white rounded-xl border border-dashed border-slate-200">
                                                                Nenhum ficheiro para este agente.
                                                            </div>
                                                        ) : (
                                                            documents.filter(d => d.agent_id === editingAgent.id).map(doc => (
                                                                <div key={doc.id} className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-center justify-between group shadow-sm transition-all hover:border-primary-100">
                                                                    <div className="flex items-center gap-2 overflow-hidden px-1">
                                                                        <FileText size={14} className="text-primary-500 shrink-0" />
                                                                        <span className="text-[10px] font-bold text-slate-700 truncate">{doc.filename}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`px-2 py-0.5 rounded-lg text-[7px] font-bold uppercase tracking-wider ${doc.status === 'ready' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                                                                            {doc.status}
                                                                        </span>
                                                                        <button type="button" onClick={() => deleteDocument(doc.id, doc.storage_path)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>

                                                    <div className="pt-4 border-t border-slate-200/50 space-y-3">
                                                        <div className="flex items-center justify-between px-1">
                                                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Temas de conversa</p>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEditingAgent({ ...editingAgent, suggested_prompts: [...(editingAgent.suggested_prompts || []), ''] })}
                                                                className="text-primary-600 hover:text-primary-700 text-[10px] font-bold flex items-center gap-1"
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
                                                                        className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 outline-none font-medium transition-all text-xs"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newPrompts = (editingAgent.suggested_prompts || []).filter((_, i) => i !== idx);
                                                                            setEditingAgent({ ...editingAgent, suggested_prompts: newPrompts });
                                                                        }}
                                                                        className="p-2 text-slate-300 hover:text-red-500 transition-colors bg-white border border-slate-200 rounded-xl"
                                                                    >
                                                                        <X size={14} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <p className="text-[9px] text-slate-400 italic">Estes temas aparecerão como sugestões rápidas no início do chat.</p>
                                                    </div>

                                                    <div className="pt-4 border-t border-slate-200/50 space-y-2">
                                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest px-1">Base de Conhecimento (Texto)</p>
                                                        <textarea
                                                            value={editingAgent.knowledge_text || ''}
                                                            onChange={e => setEditingAgent({ ...editingAgent, knowledge_text: e.target.value })}
                                                            placeholder="Adicione informações, regras ou factos adicionais..."
                                                            rows={4}
                                                            className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 outline-none font-medium transition-all text-xs resize-none text-slate-800"
                                                        />
                                                        <p className="text-[9px] text-slate-400 italic">Este texto servirá como conhecimento base para todas as respostas deste agente.</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                                            <button type="button" onClick={() => setEditingAgent(null)} className="px-6 py-2.5 font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-all">Cancelar</button>
                                            <button type="submit" disabled={savingAgent} className="px-8 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-100 disabled:opacity-50 flex items-center gap-2">
                                                {savingAgent ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                                Guardar Agente
                                            </button>
                                        </div>
                                    </form>
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
                    )}

                    {activeTab === 'groups' && (
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
                                    <form onSubmit={saveGroup} className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col max-h-[90vh] border border-slate-200/50">
                                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30 shrink-0">
                                            <h3 className="text-xl font-bold text-slate-800 tracking-tight">{editingGroup.id ? 'Editar Grupo' : 'Novo Grupo'}</h3>
                                            <button type="button" onClick={() => setEditingGroup(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X size={20} /></button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nome do Grupo</label>
                                                        <input
                                                            required
                                                            value={editingGroup.name}
                                                            onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                                                            placeholder="Ex: Departamento Comercial"
                                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 outline-none font-medium transition-all"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Descrição</label>
                                                        <textarea
                                                            value={editingGroup.description}
                                                            onChange={e => setEditingGroup({ ...editingGroup, description: e.target.value })}
                                                            placeholder="Breve descrição do grupo..."
                                                            rows={3}
                                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 outline-none font-medium transition-all resize-none"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                                    <p className="text-xs font-bold text-slate-800 mb-4 flex items-center gap-2">
                                                        <Search size={14} className="text-primary-500" /> Pesquisa Rápida
                                                    </p>
                                                    <input
                                                        type="text"
                                                        value={searchTerm}
                                                        onChange={e => setSearchTerm(e.target.value)}
                                                        placeholder="Pesquisar utilizadores ou agentes..."
                                                        className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-100 outline-none font-medium transition-all text-sm mb-4"
                                                    />
                                                    <p className="text-[9px] text-slate-400 leading-relaxed">Utilize o campo de pesquisa abaixo para encontrar rapidamente utilizadores ou agentes para adicionar ao grupo.</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                {/* Member Selection */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between px-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Utilizadores no Grupo ({groupMembers.length})</label>
                                                    </div>
                                                    <div className="bg-slate-50 border border-slate-200 rounded-[1.5rem] overflow-hidden">
                                                        <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                                                            {users.filter(u => !searchTerm || u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.id.includes(searchTerm)).map(user => {
                                                                const isChecked = groupMembers.includes(user.id);
                                                                return (
                                                                    <div
                                                                        key={user.id}
                                                                        onClick={() => {
                                                                            if (isChecked) setGroupMembers(prev => prev.filter(id => id !== user.id));
                                                                            else setGroupMembers(prev => [...prev, user.id]);
                                                                        }}
                                                                        className={`p-3 flex items-center justify-between cursor-pointer hover:bg-white transition-colors group ${isChecked ? 'bg-primary-50/30' : ''}`}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${isChecked ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                                                {user.name?.[0] || 'U'}
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-xs font-bold text-slate-700">{user.name || 'Sem nome'}</div>
                                                                                <div className="text-[9px] text-slate-400">{user.role}</div>
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
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agentes no Grupo ({groupAgents.length})</label>
                                                    </div>
                                                    <div className="bg-slate-50 border border-slate-200 rounded-[1.5rem] overflow-hidden">
                                                        <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                                                            {agents.filter(a => !searchTerm || a.name.toLowerCase().includes(searchTerm.toLowerCase())).map(agent => {
                                                                const isChecked = groupAgents.includes(agent.id!);
                                                                return (
                                                                    <div
                                                                        key={agent.id}
                                                                        onClick={() => {
                                                                            if (isChecked) setGroupAgents(prev => prev.filter(id => id !== agent.id));
                                                                            else setGroupAgents(prev => [...prev, agent.id!]);
                                                                        }}
                                                                        className={`p-3 flex items-center justify-between cursor-pointer hover:bg-white transition-colors group ${isChecked ? 'bg-amber-50/30' : ''}`}
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${isChecked ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                                                                {agent.name[0]}
                                                                            </div>
                                                                            <div>
                                                                                <div className="text-xs font-bold text-slate-700">{agent.name}</div>
                                                                                <div className="text-[9px] text-slate-400 truncate max-w-[150px]">{agent.description}</div>
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
                                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                                            <button type="button" onClick={() => setEditingGroup(null)} className="px-6 py-2.5 font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-all">Cancelar</button>
                                            <button type="submit" disabled={savingGroup} className="px-8 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-100 disabled:opacity-50 flex items-center gap-2">
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
                    )}

                </main>
            </div>
        </div>
    );
};
