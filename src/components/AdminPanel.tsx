import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    FileText,
    Upload,
    Trash2,
    Settings,
    Users,
    Database,
    CheckCircle2,
    Clock,
    AlertCircle,
    Loader2,
    RefreshCw,
    Shield,
    ArrowLeft
} from 'lucide-react';

interface Document {
    id: string;
    filename: string;
    status: 'uploaded' | 'processing' | 'ready' | 'error';
    created_at: string;
    storage_path: string; // Added storage_path to interface
}

export const AdminPanel = ({ onBack }: { onBack: () => void }) => {
    const [activeTab, setActiveTab] = useState<'kb' | 'ai' | 'users'>('kb');
    const [documents, setDocuments] = useState<Document[]>([]);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [aiSettings, setAiSettings] = useState({
        provider: 'openai',
        model: 'gpt-4o-mini',
        system_prompt: ''
    });
    const [savingSettings, setSavingSettings] = useState(false);
    const [availableModels, setAvailableModels] = useState<{ id: string, name: string }[]>([]);
    const [fetchingModels, setFetchingModels] = useState(false);

    const [users, setUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    useEffect(() => {
        fetchDocuments();
        fetchSettings();
    }, []);

    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        }
    }, [activeTab]);

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
        if (activeTab === 'ai') {
            fetchModels(aiSettings.provider);
        }
    }, [aiSettings.provider, activeTab]);

    const fetchSettings = async () => {
        const { data } = await supabase.from('llm_settings').select('*').single();
        if (data) {
            setAiSettings(data);
            fetchModels(data.provider);
        }
    };

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

    const saveSettings = async () => {
        setSavingSettings(true);
        const { error } = await supabase
            .from('llm_settings')
            .upsert({
                id: (aiSettings as any).id, // Keep ID if exists
                ...aiSettings,
                updated_at: new Date().toISOString()
            });

        if (error) alert('Erro ao guardar definições');
        else alert('Definições guardadas com sucesso!');
        setSavingSettings(false);
    };

    const fetchDocuments = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false });

        if (data) setDocuments(data as Document[]);
        setLoading(false);
    };

    const triggerIngest = async (docId: string) => {
        try {
            await supabase.functions.invoke('ingest', {
                body: { document_id: docId }
            });
            fetchDocuments();
        } catch (err) {
            console.error('Erro ao processar:', err);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // 1. Upload to Storage
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `hr_kb/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('hr_kb')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Insert record in documents table
            const { error: dbError } = await supabase
                .from('documents')
                .insert({
                    filename: file.name,
                    storage_path: filePath,
                    status: 'uploaded'
                });

            if (dbError) throw dbError;

            // 3. Trigger Ingestion (Process PDF to Vectors)
            const { data: docData } = await supabase
                .from('documents')
                .select('id')
                .eq('storage_path', filePath)
                .single();

            if (docData) {
                await supabase.functions.invoke('ingest', {
                    body: { document_id: docData.id }
                });
            }

            fetchDocuments();
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
        <div className="min-h-screen bg-slate-50 flex flex-col animate-in fade-in duration-500">
            <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between sticky top-0 z-40">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex items-center gap-2">
                        <Shield className="text-accent-600" size={24} />
                        <h1 className="text-xl font-bold text-slate-800 tracking-tight">Painel de Administração</h1>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Admin Navigation */}
                <nav className="w-64 border-r border-slate-200 bg-white p-4 flex flex-col gap-2">
                    <button
                        onClick={() => setActiveTab('kb')}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${activeTab === 'kb' ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Database size={20} /> Base de Conhecimento
                    </button>
                    <button
                        onClick={() => setActiveTab('ai')}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${activeTab === 'ai' ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Settings size={20} /> Configurações de IA
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all font-medium ${activeTab === 'users' ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Users size={20} /> Gestão de Utilizadores
                    </button>
                </nav>

                {/* Admin Content */}
                <main className="flex-1 overflow-y-auto p-8">
                    {activeTab === 'kb' && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="flex items-center justify-between pb-6 border-b border-slate-200">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">Manuais e PDFs</h2>
                                    <p className="text-slate-500">Gira os documentos que alimentam o cérebro da IA.</p>
                                </div>
                                <label className="cursor-pointer bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-100 flex items-center gap-2">
                                    <Upload size={18} /> Carregar PDF
                                    <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} disabled={uploading} />
                                </label>
                            </div>

                            {uploading && (
                                <div className="p-4 bg-primary-50 border border-primary-100 rounded-2xl flex items-center gap-3 animate-pulse">
                                    <Loader2 className="animate-spin text-primary-600" size={20} />
                                    <span className="text-sm font-medium text-primary-700">A carregar e processar documento...</span>
                                </div>
                            )}

                            <div className="grid gap-3">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                        <Loader2 className="animate-spin mb-2" />
                                        <span>A carregar documentos...</span>
                                    </div>
                                ) : documents.length === 0 ? (
                                    <div className="text-center py-16 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                                        <FileText className="mx-auto text-slate-300 mb-4" size={48} />
                                        <p className="text-slate-500">Nenhum documento encontrado. Carregue o primeiro PDF corporativo.</p>
                                    </div>
                                ) : (
                                    documents.map((doc) => (
                                        <div key={doc.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between hover:shadow-md transition-all group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors">
                                                    <FileText size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-slate-800">{doc.filename}</h3>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{new Date(doc.created_at).toLocaleDateString()}</span>
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 ${doc.status === 'ready' ? 'bg-green-100 text-green-700' :
                                                            doc.status === 'processing' ? 'bg-amber-100 text-amber-700' :
                                                                doc.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                                                            }`}>
                                                            {doc.status === 'ready' && <CheckCircle2 size={10} />}
                                                            {doc.status === 'processing' && <RefreshCw size={10} className="animate-spin" />}
                                                            {doc.status === 'error' && <AlertCircle size={10} />}
                                                            {doc.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => deleteDocument(doc.id, doc.storage_path)}
                                                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                                {doc.status === 'uploaded' && (
                                                    <button
                                                        onClick={() => triggerIngest(doc.id)}
                                                        className="p-2 text-primary-500 hover:text-primary-700 transition-colors"
                                                        title="Processar Agora"
                                                    >
                                                        <RefreshCw size={20} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'ai' && (
                        <div className="max-w-2xl mx-auto space-y-8 py-4">
                            <div className="pb-6 border-b border-slate-200 text-center">
                                <Settings className="mx-auto text-primary-600 mb-4" size={48} />
                                <h2 className="text-2xl font-bold text-slate-800">Definições da IA</h2>
                                <p className="text-slate-500">Escolha o motor e configure o comportamento do assistente.</p>
                            </div>

                            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                                <div className="space-y-4">
                                    <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">Fornecedor de IA</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setAiSettings({ ...aiSettings, provider: 'openai', model: 'gpt-4o-mini' })}
                                            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${aiSettings.provider === 'openai' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-100 grayscale hover:grayscale-0'}`}
                                        >
                                            <span className="font-bold text-lg">OpenAI</span>
                                            <span className="text-[10px] opacity-70">GPT-4o, GPT-3.5</span>
                                        </button>
                                        <button
                                            onClick={() => setAiSettings({ ...aiSettings, provider: 'gemini', model: 'gemini-1.5-flash' })}
                                            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${aiSettings.provider === 'gemini' ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-slate-100 grayscale hover:grayscale-0'}`}
                                        >
                                            <span className="font-bold text-lg">Gemini</span>
                                            <span className="text-[10px] opacity-70">Google 1.5 Pro/Flash</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                                        Modelo
                                        {fetchingModels && <Loader2 size={12} className="animate-spin text-primary-500" />}
                                    </label>
                                    <select
                                        value={aiSettings.model}
                                        onChange={(e) => setAiSettings({ ...aiSettings, model: e.target.value })}
                                        disabled={fetchingModels}
                                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-100 outline-none font-medium text-slate-700 disabled:opacity-50"
                                    >
                                        <option value="">Selecione um modelo...</option>
                                        {availableModels.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">System Prompt</label>
                                    <textarea
                                        value={aiSettings.system_prompt}
                                        onChange={(e) => setAiSettings({ ...aiSettings, system_prompt: e.target.value })}
                                        placeholder="Ex: És um assistente de RH útil..."
                                        rows={5}
                                        className="w-full p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-100 outline-none font-medium text-slate-700 resize-none text-sm"
                                    />
                                    <p className="text-[10px] text-slate-400">Este prompt define a personalidade e as regras do Agente.</p>
                                </div>

                                <button
                                    onClick={saveSettings}
                                    disabled={savingSettings}
                                    className="w-full py-4 bg-primary-600 text-white rounded-2xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-100 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {savingSettings ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                                    Guardar Configurações
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="flex items-center justify-between pb-6 border-b border-slate-200">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-800">Gestão de Utilizadores</h2>
                                    <p className="text-slate-500">Controle permissões e acessos dos colaboradores.</p>
                                </div>
                                <div className="text-sm font-medium text-slate-400">
                                    {users.length} utilizadores registados
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
                                                                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">
                                                                    {user.name?.[0] || user.id[0]}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-slate-800">{user.name || 'Sem nome'}</div>
                                                                    <div className="text-[10px] text-slate-400 font-mono uppercase">{user.id.substring(0, 8)}...</div>
                                                                </div>
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
                </main>
            </div>
        </div>
    );
};
