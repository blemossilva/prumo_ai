import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Login } from './components/Login'
import { AdminPanel } from './components/AdminPanel'
import { TourGuide } from './components/TourGuide'
import { UserProfileModal } from './components/UserProfileModal'
import {
  LogOut,
  Send,
  Plus,
  MessageSquare,
  Shield,
  User,
  Loader2,
  LayoutDashboard,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Check,
  AlertCircle,
  Sun,
  Moon,
  Menu,
  X
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { marked } from 'marked'

interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface UserProfile {
  id: string;
  role: 'worker' | 'admin';
  name: string | null;
  tenant_id: string;
  is_super_admin: boolean;
  onboarding_completed?: boolean;
}

interface Tenant {
  id: string;
  name: string;
  logo_url: string | null;
  theme_config: any;
}

interface Agent {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string;
  visibility: 'public' | 'private';
  status: 'live' | 'disabled';
  provider: string;
  model: string;
  suggested_prompts: string[];
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  agent_id: string;
}

function App() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'chat' | 'admin'>('chat')
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackMsgId, setFeedbackMsgId] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<boolean | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchProfile(session.user.id)
        fetchAgents(session.user.id)
        fetchConversations(session.user.id)
      }
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchProfile(session.user.id)
        fetchAgents(session.user.id)
        fetchConversations(session.user.id)
      }
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, role, name, tenant_id, is_super_admin, onboarding_completed')
      .eq('id', userId)
      .single()

    if (profileData) {
      setProfile(profileData as UserProfile)

      // Fetch tenant info
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', profileData.tenant_id)
        .single()

      if (tenantData) {
        setTenant(tenantData as Tenant)
      }
    }
    setLoading(false)
  }

  const fetchAgents = async (userIdOverride?: string) => {
    try {
      const userId = userIdOverride || session?.user?.id;
      if (!userId) return;

      // First, get the user's profile to check role and super admin status
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role, is_super_admin')
        .eq('id', userId)
        .single();

      let query = supabase.from('agents').select('*');

      // Super admins see everything
      if (profileData?.is_super_admin) {
        // No additional filters needed for super admin
      } else if (profileData?.role !== 'admin') {
        const { data: memberGroups, error: groupsError } = await supabase
          .from('user_group_members')
          .select('group_id')
          .eq('user_id', userId);

        if (groupsError) {
          console.error('Error fetching member groups:', groupsError);
        }

        const groupIds = memberGroups?.map(mg => mg.group_id) || [];

        if (groupIds.length > 0) {
          const { data: agentIdsData, error: agentsDataError } = await supabase
            .from('user_group_agents')
            .select('agent_id')
            .in('group_id', groupIds);

          if (agentsDataError) {
            console.error('Error fetching group agents:', agentsDataError);
          }

          const agentIds = agentIdsData?.map(ag => ag.agent_id) || [];

          if (agentIds.length > 0) {
            query = query.or(`id.in.(${agentIds.join(',')}),visibility.eq.public`);
          } else {
            query = query.eq('visibility', 'public');
          }
        } else {
          query = query.eq('visibility', 'public');
        }
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (error) throw error;

      if (data) {
        setAgents(data);
        if (data.length > 0 && !selectedAgentId) {
          setSelectedAgentId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetching agents:', err);
    }
  };

  const fetchConversations = async (userId: string) => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (data) setConversations(data)
  }

  const loadConversation = async (convId: string) => {
    setCurrentConversationId(convId)

    // Set selected agent based on conversation
    const conv = conversations.find(c => c.id === convId)
    if (conv?.agent_id) setSelectedAgentId(conv.agent_id)

    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })

    if (data) {
      setMessages(data.map(m => ({
        id: m.id,
        role: m.role as any,
        content: m.content
      })))
    }
  }

  const startNewConversation = () => {
    setMessages([])
    setCurrentConversationId(null)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || sending) return;

    let convId = currentConversationId;

    if (!convId) {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: session.user.id,
          agent_id: selectedAgentId,
          tenant_id: profile?.tenant_id,
          title: input.substring(0, 30) + (input.length > 30 ? '...' : '')
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating conversation:', error);
        return;
      }
      convId = data.id;
      setCurrentConversationId(convId);
      fetchConversations(session.user.id);
    }

    const { data: userMsgData } = await supabase.from('messages').insert({
      conversation_id: convId,
      user_id: session.user.id,
      tenant_id: profile?.tenant_id,
      role: 'user',
      content: input
    }).select().single();

    const userMessage: Message = { id: userMsgData?.id, role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);

    const selectedAgent = agents.find(a => a.id === selectedAgentId);

    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: {
          message: userMessage.content,
          system_prompt: selectedAgent?.system_prompt,
          provider: selectedAgent?.provider,
          model: selectedAgent?.model,
          agent_id: selectedAgentId // Changed from selectedAgent?.id to selectedAgentId
        }
      });

      if (error) throw error;

      const aiContent = data.reply || 'Erro ao processar resposta.';

      const { data: aiMsgData } = await supabase.from('messages').insert({
        conversation_id: convId,
        user_id: session.user.id,
        tenant_id: profile?.tenant_id,
        role: 'assistant',
        content: aiContent
      }).select().single();

      const aiMessage: Message = {
        id: aiMsgData?.id,
        role: 'assistant',
        content: aiContent
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Desculpe, ocorreu um erro: ${err.message || 'Verifique se o Administrador configurou as chaves de acesso à IA!'}`
      }]);
    } finally {
      setSending(false);
    }
  }

  const handleCopy = async (content: string, id: string) => {
    try {
      // Use marked to generate HTML from markdown
      const htmlContent = await marked.parse(content);

      // Create Blobs for both formats
      const blobHtml = new Blob([htmlContent], { type: 'text/html' });
      const blobPlain = new Blob([content], { type: 'text/plain' });

      // Use ClipboardItem for multi-format support
      const data = [new ClipboardItem({
        'text/html': blobHtml,
        'text/plain': blobPlain
      })];

      await navigator.clipboard.write(data);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Error copying content:', err);
      // Fallback to traditional writeText if ClipboardItem fails
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleFeedback = async (msgId: string, rating: boolean) => {
    setFeedbackMsgId(msgId);
    setFeedbackRating(rating);

    if (rating === true) {
      await saveFeedback(msgId, true, '');
      setFeedbackMsgId(null);
      alert('Obrigado pelo seu feedback!');
    }
  };

  const saveFeedback = async (msgId: string, rating: boolean, comment: string) => {
    await supabase.from('feedback').insert({
      message_id: msgId,
      user_id: session.user.id,
      tenant_id: profile?.tenant_id,
      rating: rating,
      comment: comment
    });
  };

  const submitFeedbackComment = async () => {
    if (feedbackMsgId && feedbackRating !== null) {
      await saveFeedback(feedbackMsgId, feedbackRating, feedbackComment);
      setFeedbackMsgId(null);
      setFeedbackComment('');
      setFeedbackRating(null);
      alert('Obrigado pelo seu comentário!');
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="relative">
          <Loader2 className="animate-spin text-primary-600 mb-4" size={48} />
          <div className="absolute inset-0 blur-xl bg-primary-500/20 animate-pulse" />
        </div>
        <p className="text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-widest text-[10px] animate-pulse">A preparar o Nexio AI...</p>
      </div>
    )
  }

  // Detect if we are in an invite flow or if the user hasn't finished setup
  const isAuthRedirect = typeof window !== 'undefined' && (
    window.location.hash.includes('type=invite') ||
    window.location.hash.includes('type=recovery') ||
    window.location.hash.includes('access_token=')
  );

  // If user is logged in but has no name, they probably need setup
  const needsSetup = session && profile && !profile.name;

  if (!session || isAuthRedirect || needsSetup) {
    return <Login />
  }

  if (view === 'admin' && (profile?.role === 'admin' || profile?.is_super_admin)) {
    return <AdminPanel onBack={() => setView('chat')} userProfile={profile} tenant={tenant} />
  }

  return (
    <div className="h-screen bg-[rgb(var(--background))] flex flex-col overflow-hidden transition-colors duration-300">
      <header className="h-16 glass sticky top-0 z-50 flex items-center px-4 md:px-6 justify-between border-b border-color">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 md:hidden text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 flex items-center justify-center p-1.5 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200/50 dark:border-white/5">
              <img
                src={tenant?.logo_url || "/nexio_ai_icone.png"}
                alt="Nexio AI"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black text-primary-600 dark:text-primary-400 uppercase tracking-tighter leading-none">Nexio AI</span>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-1">{tenant?.name || 'Sistema'}</span>
            </div>
          </div>
          <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block" />
          <div className="flex flex-col hidden sm:flex">
            <span className="text-[10px] uppercase font-bold text-slate-400 leading-none mb-1">Agente Ativo</span>
            <h1 className="text-sm font-bold tracking-tight text-slate-800 dark:text-white truncate max-w-[150px] md:max-w-none leading-none">
              {selectedAgent?.name || 'Nexio AI'}
            </h1>
          </div>
          {profile?.is_super_admin && (
            <span className="hidden sm:flex ml-2 px-2 py-0.5 bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[9px] font-bold uppercase rounded-md items-center gap-1">
              <Shield size={10} /> Super Admin
            </span>
          )}
          {!profile?.is_super_admin && profile?.role === 'admin' && (
            <span className="hidden sm:flex ml-2 px-2 py-0.5 bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 text-[9px] font-bold uppercase rounded-md items-center gap-1">
              <Shield size={10} /> Admin
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-amber-400 rounded-xl transition-all"
            title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 rounded-full border border-color shadow-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <User size={16} className="text-slate-400 dark:text-slate-500" />
            <span className="text-sm font-medium truncate max-w-[100px]">
              {profile?.name || session.user.email?.split('@')[0]}
            </span>
          </button>

          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 dark:text-slate-500 dark:hover:text-red-400 rounded-xl transition-all"
            title="Sair"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden h-[calc(100vh-4rem)] relative">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed inset-y-0 left-0 w-80 sidebar-bg border-r border-slate-200/40 z-50 transition-transform duration-300 md:relative md:translate-x-0 md:flex md:flex-col
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between md:hidden mb-4">
              <span className="font-medium text-slate-900 dark:text-white uppercase tracking-tight">{tenant?.name || 'Nexio AI'}</span>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-slate-500">
                <X size={20} />
              </button>
            </div>
            <button
              onClick={() => {
                startNewConversation();
                setIsSidebarOpen(false);
              }}
              className="w-full py-3 px-4 border border-primary-600/30 text-primary-600 bg-white dark:bg-slate-900 rounded-2xl font-bold hover:bg-primary-50 dark:hover:bg-primary-900/40 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <Plus size={18} /> Nova Conversa
            </button>
          </div>

          <div className="px-4 mb-4">
            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-3 tracking-widest px-2">Agentes</p>
            <div className="flex flex-col gap-1">
              {agents.filter(a => profile?.role === 'admin' || a.status === 'live').map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => {
                    setSelectedAgentId(agent.id);
                    startNewConversation();
                  }}
                  className={`flex items-center gap-3 px-4 py-2.5 text-xs rounded-xl cursor-pointer w-full text-left transition-all font-semibold ${selectedAgentId === agent.id ? 'bg-primary-500/10 text-primary-700 dark:text-primary-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/40 dark:hover:bg-slate-800/50'}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${agent.visibility === 'private' ? 'bg-amber-400' : 'bg-primary-400'}`} />
                  <span className="truncate">{agent.name}</span>
                  {agent.visibility === 'private' && <Shield size={10} className="ml-auto opacity-50" />}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 mt-2">
            <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-4 tracking-widest px-2">Histórico</p>
            <div className="flex flex-col gap-1.5">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => {
                    loadConversation(conv.id);
                    setIsSidebarOpen(false);
                  }}
                  className={`flex items-center gap-3 p-3 text-sm rounded-2xl cursor-pointer w-full text-left transition-all font-medium ${currentConversationId === conv.id ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 ring-1 ring-primary-100 dark:ring-primary-900/50' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <MessageSquare size={16} className={currentConversationId === conv.id ? 'text-primary-500' : 'text-slate-400'} />
                  <span className="truncate">{conv.title}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 mt-auto border-t border-color flex flex-col gap-2">
            {profile?.role === 'admin' && (
              <button
                data-tour="admin-button"
                onClick={() => setView('admin')}
                className="w-full py-2.5 px-4 bg-slate-800 dark:bg-slate-700 text-white rounded-xl text-xs font-bold hover:bg-slate-900 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-2"
              >
                <LayoutDashboard size={14} /> Painel Admin
              </button>
            )}
          </div>
        </aside>

        {/* Chat Area */}
        <section className="flex-1 overflow-y-auto bg-transparent relative scroll-smooth flex justify-center transition-colors duration-300">
          <div className="max-w-[700px] w-full flex flex-col min-h-full px-6 py-12">
            <div className="flex-1 flex flex-col gap-10">
              {messages.length === 0 ? (
                /* Welcome State */
                <div className="flex flex-col items-center justify-center py-20 md:py-32 opacity-80 text-center animate-slide-up">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-[2rem] flex items-center justify-center mb-8 shadow-sm">
                    <MessageSquare size={32} className="md:w-10 md:h-10" />
                  </div>
                  <h2 className="text-2xl md:text-4xl font-bold text-slate-800 dark:text-white tracking-tight px-4">Como posso ajudar?</h2>
                  <p className="text-slate-500 dark:text-slate-400 max-w-xs md:max-w-md mt-4 leading-relaxed px-4 text-sm md:text-lg">
                    {selectedAgent?.description || `Sou o ${selectedAgent?.name}. Como posso ser útil hoje?`}
                  </p>

                  {selectedAgent?.suggested_prompts && selectedAgent.suggested_prompts.filter(p => p.trim() !== '').length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-12 w-full max-w-md px-6">
                      {selectedAgent.suggested_prompts.filter(p => p.trim() !== '').map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => {
                            setInput(prompt);
                          }}
                          className="p-4 text-[11px] md:text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 rounded-2xl hover:border-primary-400 hover:shadow-xl hover:shadow-primary-500/10 transition-all text-slate-600 dark:text-slate-300 text-left"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-slide-up w-full group/msg`}>
                    {m.role === 'assistant' && (
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 shadow-sm border border-white/10 mt-1">
                        <div className="w-5 h-5 md:w-6 md:h-6 bg-primary-600 rounded-full flex items-center justify-center text-white text-[10px] md:text-[12px] font-black">A</div>
                      </div>
                    )}

                    <div className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} flex-1`}>
                      <div className={`
                        ${m.role === 'user'
                          ? 'bg-primary-600 text-white rounded-[2rem] rounded-tr-sm px-6 py-4 shadow-xl shadow-primary-500/10 max-w-[85%]'
                          : 'chat-bubble-ai w-full'
                        }
                      `}>
                        {m.role === 'user' ? (
                          <p className="text-sm md:text-[15px] leading-relaxed whitespace-pre-wrap font-medium">{m.content}</p>
                        ) : (
                          <div>
                            <div className="prose prose-slate dark:prose-invert max-w-none prose-sm md:prose-base">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {m.content}
                              </ReactMarkdown>
                            </div>

                            {/* AI Message Actions */}
                            <div className="mt-4 flex items-center gap-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleCopy(m.content, m.id || String(i))}
                                className="p-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                                title="Copiar resposta"
                              >
                                {copiedId === (m.id || String(i)) ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                {copiedId === (m.id || String(i)) ? 'Copiado' : 'Copiar'}
                              </button>
                              <div className="h-3 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />
                              <button
                                onClick={() => handleFeedback(m.id || '', true)}
                                className="p-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-green-600 transition-all"
                                title="Gosto"
                              >
                                <ThumbsUp size={14} />
                              </button>
                              <button
                                onClick={() => handleFeedback(m.id || '', false)}
                                className="p-1.5 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg text-slate-400 dark:text-slate-500 hover:text-red-600 transition-all"
                                title="Não gosto"
                              >
                                <ThumbsDown size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )
              }
              {sending && (
                <div className="flex justify-start animate-pulse px-14">
                  <div className="flex gap-1.5 items-center bg-slate-100 dark:bg-slate-800/50 px-4 py-2.5 rounded-2xl">
                    <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              )}

              {/* Feedback Comment Modal (Inline) */}
              {feedbackMsgId && feedbackRating === false && (
                <div className="bg-slate-50 dark:bg-slate-900 border border-color rounded-2xl p-4 md:p-5 animate-slide-up w-full max-w-xl self-start mt-2 md:ml-2">
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold text-sm mb-3">
                    <AlertCircle size={16} className="text-amber-500" />
                    Como podemos melhorar esta resposta?
                  </div>
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="O que estava errado ou em falta?"
                    className="w-full bg-white dark:bg-slate-800 border border-color rounded-xl p-3 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-primary-500/20 outline-none resize-none mb-3"
                    rows={3}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setFeedbackMsgId(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={submitFeedbackComment}
                      className="px-4 py-2 text-xs font-bold bg-slate-900 dark:bg-primary-600 text-white rounded-xl hover:bg-slate-800 dark:hover:bg-primary-700 transition-all"
                    >
                      Enviar Feedback
                    </button>
                  </div>
                </div>
              )}
              {/* Spacer to ensure last message isn't covered by input */}
              <div className="h-20 md:h-32" aria-hidden="true" />
            </div>

            {/* Sticky Input Area */}
            <div className="fixed bottom-0 left-0 md:left-80 right-0 p-6 md:p-10 transition-all duration-500 z-30">
              <div className="max-w-[700px] mx-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-white/5 rounded-[2.5rem] shadow-2xl p-2">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Faça uma pergunta ao ${selectedAgent?.name || 'agente'}...`}
                    className="flex-1 bg-transparent border-none focus:ring-0 px-6 py-4 text-slate-800 dark:text-slate-100 font-medium text-sm md:text-base placeholder:text-slate-400/50"
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    className="p-3 text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-all disabled:opacity-30"
                  >
                    <Send size={24} className="active:scale-90 transition-transform" />
                  </button>
                </form>
              </div>
              <div className="mt-4 flex flex-col items-center gap-1.5 opacity-40">
                <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium text-center leading-relaxed">
                  O NEXIO AI recomenda a confirmação de dados críticos. Privacidade e segurança são a nossa prioridade.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        profile={profile ? { ...profile, email: session.user.email } : null}
        tenant={tenant}
        onProfileUpdate={(newName) => setProfile(prev => prev ? { ...prev, name: newName } : null)}
      />

      {profile?.role === 'admin' && profile.onboarding_completed === false && (
        <TourGuide
          run={true}
          userId={profile.id}
          onFinish={() => {
            // We don't mark as complete here, just let it close so they can click the button
            // Or we could programmatically click it? No, better let them learn.
          }}
          steps={[
            {
              content: (
                <div className="p-2">
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Bem-vindo(a)! 👋</h3>
                  <p className="text-slate-600">
                    Para configurar a sua organização, agentes e equipa, aceda ao Painel de Administração.
                  </p>
                </div>
              ),
              locale: { skip: "Saltar", next: "Ok, entendi", back: "Voltar", last: "Ok" },
              placement: 'right' as const,
              target: '[data-tour="admin-button"]',
              disableBeacon: true,
            }
          ]}
          saveOnComplete={false} // Don't save yet, wait for Admin Panel tour
        />
      )}
    </div>
  )
}

export default App
