import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Login } from './components/Login'
import { AdminPanel } from './components/AdminPanel'
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
  AlertCircle
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
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

function App() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'chat' | 'admin'>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackMsgId, setFeedbackMsgId] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<boolean | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchProfile(session.user.id)
        fetchConversations(session.user.id)
      }
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchProfile(session.user.id)
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
    const { data } = await supabase
      .from('profiles')
      .select('id, role, name')
      .eq('id', userId)
      .single()

    if (data) setProfile(data as UserProfile)
    setLoading(false)
  }

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
      role: 'user',
      content: input
    }).select().single();

    const userMessage: Message = { id: userMsgData?.id, role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: { message: userMessage.content }
      });

      if (error) throw error;

      const aiContent = data.reply || 'Erro ao processar resposta.';

      const { data: aiMsgData } = await supabase.from('messages').insert({
        conversation_id: convId,
        user_id: session.user.id,
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
        content: `Desculpe, ocorreu um erro: ${err.message || 'Verifique se o Admin configurou as AI keys!'}`
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-600" size={48} />
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  if (view === 'admin' && profile?.role === 'admin') {
    return <AdminPanel onBack={() => setView('chat')} />
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="h-16 glass sticky top-0 z-50 flex items-center px-6 justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold">HR</div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Agente de IA <span className="text-primary-600">RH</span></h1>
          {profile?.role === 'admin' && (
            <span className="ml-2 px-2 py-0.5 bg-accent-100 text-accent-700 text-[10px] font-bold uppercase rounded-md flex items-center gap-1">
              <Shield size={10} /> Admin
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-full border border-slate-200 shadow-sm">
            <User size={16} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-600 truncate max-w-[120px]">
              {profile?.name || session.user.email}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            title="Sair"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden h-[calc(100vh-4rem)]">
        {/* Sidebar */}
        <aside className="w-64 border-r border-slate-200 bg-white/50 hidden md:flex flex-col">
          <div className="p-4 flex flex-col gap-2">
            <button
              onClick={startNewConversation}
              className="w-full py-2.5 px-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-md shadow-primary-100 flex items-center justify-center gap-2 text-sm"
            >
              <Plus size={18} /> Nova Conversa
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 mt-4">
            <p className="text-[10px] uppercase font-bold text-slate-400 mb-3 tracking-widest px-2">Histórico</p>
            <div className="flex flex-col gap-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={`flex items-center gap-2 p-2 text-sm rounded-xl cursor-pointer w-full text-left transition-colors font-medium ${currentConversationId === conv.id ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <MessageSquare size={16} className={currentConversationId === conv.id ? 'text-primary-500' : 'text-slate-400'} />
                  <span className="truncate">{conv.title}</span>
                </button>
              ))}
            </div>
          </div>

          {profile?.role === 'admin' && (
            <div className="p-4 mt-auto border-t border-slate-100">
              <button
                onClick={() => setView('admin')}
                className="w-full py-2 px-4 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-900 transition-all flex items-center justify-center gap-2 mb-2"
              >
                <LayoutDashboard size={14} /> Painel Admin
              </button>
            </div>
          )}
        </aside>

        {/* Chat Area */}
        <section className="flex-1 overflow-y-auto bg-white relative scroll-smooth flex justify-center">
          <div className="max-w-3xl w-full flex flex-col min-h-full px-4 md:px-0 py-12">
            <div className="flex-1 flex flex-col gap-8 mb-32">
              {messages.length === 0 ? (
                /* Welcome State */
                <div className="flex flex-col items-center justify-center py-20 opacity-60 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
                  <div className="w-20 h-20 bg-primary-100 text-primary-600 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
                    <MessageSquare size={40} />
                  </div>
                  <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Como posso ajudar?</h2>
                  <p className="text-slate-500 max-w-sm mt-3 leading-relaxed">
                    Sou o assistente de RH. Baseio minhas respostas nos manuais internos da empresa.
                  </p>

                  <div className="grid grid-cols-2 gap-4 mt-12 w-full max-w-md px-4">
                    {[
                      'Quantos dias de férias tenho?',
                      'Como pedir licença parental?',
                      'Regras para faltas',
                      'Benefícios de saúde'
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => {
                          setInput(prompt);
                        }}
                        className="p-4 text-xs font-bold bg-white border border-slate-200 rounded-2xl hover:border-primary-400 hover:shadow-lg hover:shadow-primary-50 transition-all text-slate-600 text-left"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300 w-full group/msg`}>
                    <div className={`max-w-[90%] md:max-w-[85%] ${m.role === 'user' ? 'bg-slate-100 text-slate-800 rounded-2xl px-5 py-3' : 'chat-bubble-ai px-2 py-4 border-none shadow-none w-full'}`}>
                      {m.role === 'user' ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap font-medium">{m.content}</p>
                      ) : (
                        <div>
                          <div className="prose prose-slate max-w-none prose-sm md:prose-base prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-slate-100">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {m.content}
                            </ReactMarkdown>
                          </div>

                          {/* AI Message Actions */}
                          <div className="mt-4 flex items-center gap-2 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleCopy(m.content, m.id || String(i))}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                              title="Copiar resposta"
                            >
                              {copiedId === (m.id || String(i)) ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                              {copiedId === (m.id || String(i)) ? 'Copiado' : 'Copiar'}
                            </button>
                            <div className="h-3 w-[1px] bg-slate-200 mx-1" />
                            <button
                              onClick={() => handleFeedback(m.id || '', true)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-green-600 transition-all"
                              title="Gosto"
                            >
                              <ThumbsUp size={14} />
                            </button>
                            <button
                              onClick={() => handleFeedback(m.id || '', false)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600 transition-all"
                              title="Não gosto"
                            >
                              <ThumbsDown size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {sending && (
                <div className="flex justify-start animate-pulse px-2">
                  <div className="flex gap-1 items-center py-3">
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                </div>
              )}

              {/* Feedback Comment Modal (Inline) */}
              {feedbackMsgId && feedbackRating === false && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 animate-in fade-in zoom-in duration-200 w-full max-w-xl self-start mt-2 ml-2">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-sm mb-3">
                    <AlertCircle size={16} className="text-amber-500" />
                    Como podemos melhorar esta resposta?
                  </div>
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="O que estava errado ou em falta?"
                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-100 outline-none resize-none mb-3"
                    rows={3}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setFeedbackMsgId(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={submitFeedbackComment}
                      className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all"
                    >
                      Enviar Comentário
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Input Area */}
            <div className="fixed bottom-0 left-64 right-0 flex justify-center p-6 bg-gradient-to-t from-white via-white/90 to-transparent pt-12">
              <div className="w-full max-w-3xl">
                <form onSubmit={handleSendMessage} className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl shadow-slate-200/50 p-2 flex items-center gap-2 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Responda aqui..."
                    className="flex-1 bg-transparent border-none focus:ring-0 px-6 py-4 text-slate-700 font-medium text-base"
                  />
                  <button
                    type="submit"
                    disabled={sending}
                    className="bg-slate-900 text-white p-3 rounded-full hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                  >
                    <Send size={20} />
                  </button>
                </form>
                <div className="mt-3 flex flex-col items-center gap-1">
                  <p className="text-[10px] text-slate-400 font-medium text-center px-8">
                    O PRUMO AI pode cometer erros. Considere verificar informações importantes. <br />
                    Os prompts podem ser guardados para efeito de controlo de qualidade. Consulte as <a href="#" className="underline hover:text-slate-600 transition-colors">políticas de utilizador</a>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
