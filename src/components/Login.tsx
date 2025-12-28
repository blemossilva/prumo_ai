import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, Mail, Lock, Loader2, ArrowRight, ArrowLeft, Building2, User, ShieldCheck } from 'lucide-react';

type Step = 'email' | 'password' | 'signup_prompt' | 'signup_form' | 'success' | 'set_password' | 'forgot_password';

interface TenantInfo {
    name: string;
    logo_url: string | null;
}

export const Login = () => {
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [tenantName, setTenantName] = useState('');
    const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Detect if landing from an invitation or needs setup
        const handleInvitation = async () => {
            const hash = window.location.hash;
            const isInvite = hash.includes('type=invite') || hash.includes('access_token=');

            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                // If we have a user, check if they need setup (no name in profile)
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('name, tenant_id')
                    .eq('id', user.id)
                    .single();

                if (isInvite || (profile && !profile.name)) {
                    setEmail(user.email || '');
                    setStep('set_password');

                    if (profile?.name) {
                        setFullName(profile.name);
                    }

                    if (profile?.tenant_id) {
                        const { data: tenant } = await supabase
                            .from('tenants')
                            .select('name, logo_url')
                            .eq('id', profile.tenant_id)
                            .single();
                        if (tenant) setTenantInfo(tenant);
                    }
                }
            }
            setLoading(false);
        };

        handleInvitation();
    }, []);

    const handleEmailNext = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error: fnError } = await supabase.functions.invoke('get-tenant-branding', {
                body: { email }
            });

            if (fnError) throw fnError;

            if (data.found) {
                setTenantInfo(data.tenant);
                setStep('password');
            } else {
                setStep('signup_prompt');
            }
        } catch (err: any) {
            setError('Erro ao verificar e-mail. Tente novamente.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (signInError) throw signInError;
        } catch (err: any) {
            setError(err.message || 'Senha incorreta ou erro de rede.');
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        tenant_name: tenantName
                    }
                }
            });
            if (signUpError) throw signUpError;
            setStep('success');
        } catch (err: any) {
            setError(err.message || 'Erro ao criar conta.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/#type=recovery`,
            });
            if (resetError) throw resetError;
            alert('Instruções de recuperação enviadas para o seu e-mail.');
            setStep('email');
        } catch (err: any) {
            setError(err.message || 'Erro ao enviar recuperação de senha.');
        } finally {
            setLoading(false);
        }
    };

    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Update password and name in Auth
            const { error: updateError } = await supabase.auth.updateUser({
                password,
                data: { full_name: fullName }
            });

            if (updateError) throw updateError;

            // Also update the public profile name
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ name: fullName })
                    .eq('id', user.id);

                if (profileError) {
                    console.error('Error updating profile:', profileError);
                    // We don't necessarily want to block the user if auth update worked, 
                    // but it's better to be aware of the failure.
                    throw new Error("Erro ao salvar nome no perfil: " + profileError.message);
                }
            }

            // Successfully set up! Clear hash and redirect/reload
            window.location.hash = ''; // Clear tokens

            // Give Supabase a tiny moment to sync if needed, though reload is usually enough
            setTimeout(() => {
                window.location.reload();
            }, 500);

        } catch (err: any) {
            setError(err.message || 'Erro ao definir password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 transition-colors duration-500 overflow-hidden font-sans">
            {/* Background Image Layer */}
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
                style={{ backgroundImage: 'url("/login_bg.png")' }}
            />

            {/* Overlay Layers */}
            <div className="absolute inset-0 bg-white/40 dark:bg-slate-950/60 backdrop-blur-xl transition-colors duration-500" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-primary-900/20" />

            {/* Login Card */}
            <div className="relative max-w-md w-full bg-white/70 dark:bg-slate-900/80 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] p-10 md:p-12 border border-white/50 dark:border-white/10 animate-in fade-in zoom-in duration-700 backdrop-blur-md">

                {step === 'success' ? (
                    <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="w-24 h-24 bg-primary-500/20 rounded-full flex items-center justify-center mb-8 animate-bounce transition-all">
                            <Mail className="text-primary-500" size={48} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-4 tracking-tight">
                            Verifique o seu email
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                            Enviámos um link de confirmação para <br />
                            <strong className="text-primary-600 dark:text-primary-400 font-bold">{email}</strong>
                        </p>
                        <button
                            onClick={() => setStep('email')}
                            className="w-full py-4 bg-primary-600 dark:bg-primary-500 text-white rounded-2xl font-black shadow-lg hover:shadow-primary-500/30 transition-all hover:scale-[1.02] active:scale-100 uppercase tracking-widest text-xs"
                        >
                            Voltar ao Início
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Branding Area */}
                        <div className="flex flex-col items-center mb-10 text-center">
                            {tenantInfo?.logo_url ? (
                                <img
                                    src={tenantInfo.logo_url}
                                    alt={tenantInfo.name}
                                    className="h-16 mb-4 object-contain animate-in fade-in zoom-in"
                                />
                            ) : (
                                <div className="w-full max-w-[200px] mb-8 drop-shadow-2xl hover:scale-105 transition-transform duration-500">
                                    <img src="/nexio_ai_logo.svg" alt="Nexio AI" className="w-full h-auto dark:brightness-110" />
                                </div>
                            )}

                            <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                                {tenantInfo ? tenantInfo.name : 'Nexio AI'}
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
                                {step === 'email' && 'Inicie sessão com o seu e-mail corporativo'}
                                {step === 'password' && `Bem-vindo de volta! Introduza a sua palavra-passe.`}
                                {step === 'signup_prompt' && 'E-mail não reconhecido'}
                                {step === 'signup_form' && 'Crie a sua nova organização'}
                                {step === 'set_password' && 'Configure o seu acesso à organização'}
                            </p>
                        </div>

                        {/* Step: Email */}
                        {step === 'email' && (
                            <form onSubmit={handleEmailNext} className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-500">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2">E-mail</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-14 pr-6 py-4 bg-white/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 rounded-[1.5rem] focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500/50 transition-all outline-none dark:text-white placeholder:text-slate-400 font-medium"
                                            placeholder="nome@empresa.com"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-12 bg-primary-600 dark:bg-primary-500 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-primary-700 dark:hover:bg-primary-600 transition-all disabled:opacity-50 shadow-[0_20px_40px_-12px_rgba(62,84,172,0.35)] group"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : <>Avançar <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" /></>}
                                </button>
                                <div className="text-center">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">Não tem conta? </span>
                                    <button
                                        type="button"
                                        onClick={() => setStep('signup_form')}
                                        className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                                    >
                                        Criar uma!
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Step: Password */}
                        {step === 'password' && (
                            <form onSubmit={handleLogin} className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-500">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-2xl flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-xs uppercase">
                                        {email.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{email}</p>
                                    </div>
                                    <button onClick={() => setStep('email')} className="text-[10px] font-black text-primary-500 uppercase tracking-tighter hover:underline">Alterar</button>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2">Palavra-passe</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            autoFocus
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-14 pr-14 py-4 bg-white/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 rounded-[1.5rem] focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500/50 transition-all outline-none dark:text-white placeholder:text-slate-400 font-medium"
                                            placeholder="••••••••"
                                        />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                            <span className="text-[10px] font-bold uppercase">{showPassword ? 'Ocultar' : 'Mostrar'}</span>
                                        </button>
                                    </div>
                                    <div className="flex justify-end pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setStep('forgot_password')}
                                            className="text-[10px] font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                                        >
                                            Esqueceu-se da palavra-passe?
                                        </button>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-12 bg-primary-600 dark:bg-primary-500 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-primary-700 dark:hover:bg-primary-600 transition-all disabled:opacity-50 shadow-[0_20px_40px_-12px_rgba(62,84,172,0.35)] group"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : <>Entrar <LogIn size={18} className="group-hover:translate-x-1 transition-transform" /></>}
                                </button>
                                <button type="button" onClick={() => setStep('email')} className="w-full flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest py-2">
                                    <ArrowLeft size={12} /> Voltar
                                </button>
                            </form>
                        )}

                        {/* Step: Forgot Password */}
                        {step === 'forgot_password' && (
                            <form onSubmit={handleResetPassword} className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-500">
                                <div className="text-center mb-6">
                                    <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-primary-600 dark:text-primary-400">
                                        <Lock size={24} />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Recuperar Acesso</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        Insira o seu e-mail para receber instruções de recuperação.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2">E-mail</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-14 pr-6 py-4 bg-white/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 rounded-[1.5rem] focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500/50 transition-all outline-none dark:text-white placeholder:text-slate-400 font-medium"
                                            placeholder="nome@empresa.com"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-12 bg-primary-600 dark:bg-primary-500 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-primary-700 dark:hover:bg-primary-600 transition-all disabled:opacity-50 shadow-[0_20px_40px_-12px_rgba(62,84,172,0.35)] group"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Enviar Instruções'}
                                </button>
                                <button type="button" onClick={() => setStep('password')} className="w-full flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest py-2">
                                    <ArrowLeft size={12} /> Voltar
                                </button>
                            </form>
                        )}

                        {/* Step: Signup Prompt */}
                        {step === 'signup_prompt' && (
                            <div className="space-y-8 animate-in zoom-in-95 fade-in duration-500 text-center">
                                <div className="p-6 bg-slate-500/5 rounded-[2rem] border border-slate-500/10 leading-relaxed">
                                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                                        Parece que o seu e-mail <br />
                                        <strong className="text-slate-900 dark:text-white">{email}</strong> <br />
                                        ainda não está registado.
                                    </p>
                                    <p className="mt-4 text-xs text-primary-600 dark:text-primary-400 font-bold">
                                        Deseja criar uma nova organização Nexio AI para a sua empresa?
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <button
                                        onClick={() => setStep('signup_form')}
                                        className="w-full h-12 bg-primary-600 dark:bg-primary-500 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-[0_20px_40px_-12px_rgba(62,84,172,0.35)] hover:scale-[1.02] transition-all"
                                    >
                                        Sim, criar nova organização
                                    </button>
                                    <button
                                        onClick={() => setStep('email')}
                                        className="w-full py-4 bg-white/50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 rounded-2xl font-black transition-all hover:bg-white dark:hover:bg-slate-800"
                                    >
                                        Não, usar outro e-mail
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step: Signup Form */}
                        {step === 'signup_form' && (
                            <form onSubmit={handleSignUp} className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-500">
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">E-mail</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                                        <input
                                            type="email"
                                            required
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-14 pr-6 py-4 bg-white/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 rounded-[1.5rem] focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500/50 transition-all outline-none dark:text-white placeholder:text-slate-400 font-medium"
                                            placeholder="nome@empresa.com"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">O seu Nome</label>
                                    <div className="relative group">
                                        <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500" size={18} />
                                        <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-white/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 rounded-[1.5rem] focus:ring-4 focus:ring-primary-500/10 outline-none dark:text-white text-sm" placeholder="Nome Completo" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nome da Organização</label>
                                    <div className="relative group">
                                        <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500" size={18} />
                                        <input type="text" required value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-white/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 rounded-[1.5rem] focus:ring-4 focus:ring-primary-500/10 outline-none dark:text-white text-sm" placeholder="Ex: Nexio Tech" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Palavra-passe</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500" size={18} />
                                        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-white/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 rounded-[1.5rem] focus:ring-4 focus:ring-primary-500/10 outline-none dark:text-white text-sm" placeholder="••••••••" />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-12 bg-primary-600 dark:bg-primary-500 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-[0_20px_40px_-12px_rgba(62,84,172,0.35)] transition-all"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Começar Agora'}
                                </button>
                                <button type="button" onClick={() => setStep('signup_prompt')} className="w-full flex items-center justify-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">
                                    <ArrowLeft size={12} /> Voltar
                                </button>
                            </form>
                        )}

                        {/* Step: Set Password (Invited Users) */}
                        {step === 'set_password' && (
                            <form onSubmit={handleSetPassword} className="space-y-5 animate-in slide-in-from-right-4 fade-in duration-500">
                                <div className="p-4 bg-primary-500/5 rounded-2xl border border-primary-500/10 flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-primary-500/20 flex items-center justify-center text-primary-600">
                                        <ShieldCheck size={24} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-800 dark:text-white leading-tight">Finalize o seu registo</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">Defina o seu nome e password de acesso</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">E-mail</label>
                                    <input type="email" disabled value={email} className="w-full px-6 py-4 bg-slate-100 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 rounded-[1.5rem] opacity-60 text-sm font-bold" />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">O seu Nome</label>
                                    <div className="relative group">
                                        <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500" size={18} />
                                        <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-white/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 rounded-[1.5rem] focus:ring-4 focus:ring-primary-500/10 outline-none dark:text-white text-sm" placeholder="Ex: Maria Santos" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nova Palavra-passe</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500" size={18} />
                                        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-white/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 rounded-[1.5rem] focus:ring-4 focus:ring-primary-500/10 outline-none dark:text-white text-sm" placeholder="••••••••" />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-12 bg-primary-600 dark:bg-primary-500 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-[0_20px_40px_-12px_rgba(62,84,172,0.35)] transition-all"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Concluir Registo'}
                                </button>
                            </form>
                        )}

                        {error && (
                            <div className="mt-6 p-4 bg-red-500/10 text-red-600 dark:text-red-400 text-xs rounded-2xl border border-red-500/20 font-bold backdrop-blur-sm animate-in shake duration-500">
                                {error}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
