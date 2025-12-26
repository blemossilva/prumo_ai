import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';

export const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                const { error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (signUpError) throw signUpError;
                setShowSuccess(true);
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (signInError) throw signInError;
            }
        } catch (err: any) {
            setError(err.message || 'Ocorreu um erro na autenticação.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center p-4 transition-colors duration-500 overflow-hidden">
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
                {showSuccess ? (
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

                        <div className="p-6 bg-slate-500/5 rounded-[2rem] border border-slate-500/10 mb-10 w-full">
                            <p className="text-xs text-slate-500 dark:text-slate-500 font-medium">
                                <span className="block mb-2 font-black uppercase tracking-widest text-[9px] text-primary-500">Dica Prática</span>
                                Se não encontrar o email na sua caixa de entrada, por favor verifique a pasta de <strong>Spam</strong> ou <strong>Lixo Eletrónico</strong>.
                            </p>
                        </div>

                        <button
                            onClick={() => {
                                setShowSuccess(false);
                                setIsSignUp(false);
                            }}
                            className="w-full py-4 bg-primary-600 dark:bg-primary-500 text-white rounded-2xl font-black shadow-lg hover:shadow-primary-500/30 transition-all hover:scale-[1.02] active:scale-100"
                        >
                            Voltar ao Login
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col items-center mb-12 text-center">
                            <div className="w-full max-w-[240px] mb-8 drop-shadow-2xl hover:scale-105 transition-transform duration-500">
                                <img
                                    src="/nexio_ai_logo.svg"
                                    alt="Nexio AI"
                                    className="w-full h-auto object-contain dark:brightness-110"
                                />
                            </div>
                            <p className="text-primary-700 dark:text-primary-400 font-black tracking-[0.3em] uppercase text-[10px] -mt-6 opacity-80">
                                O conhecimento que une equipas
                            </p>
                            <p className="text-slate-600 dark:text-slate-400 mt-10 text-sm leading-relaxed font-medium">
                                {isSignUp ? 'Crie sua conta corporativa para começar' : 'Faça login para aceder ao conhecimento da sua equipa'}
                            </p>
                        </div>

                        <form onSubmit={handleAuth} className="space-y-6">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2">E-mail de Trabalho</label>
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
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-2">Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-14 pr-14 py-4 bg-white/50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-white/5 rounded-[1.5rem] focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500/50 transition-all outline-none dark:text-white placeholder:text-slate-400 font-medium"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                    >
                                        {showPassword ? (
                                            <span className="text-[10px] font-bold uppercase tracking-tighter">Ocultar</span>
                                        ) : (
                                            <span className="text-[10px] font-bold uppercase tracking-tighter">Mostrar</span>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="p-4 bg-red-500/10 text-red-600 dark:text-red-400 text-xs rounded-2xl border border-red-500/20 font-bold backdrop-blur-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4.5 bg-primary-600 dark:bg-primary-500 text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-primary-700 dark:hover:bg-primary-600 transition-all disabled:opacity-50 shadow-[0_20px_40px_-12px_rgba(62,84,172,0.35)] hover:shadow-[0_25px_50px_-12px_rgba(62,84,172,0.45)] active:scale-[0.98] group"
                            >
                                {loading ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm tracking-tight">{isSignUp ? 'Criar Conta Corporativa' : 'Aceder Agora'}</span>
                                        <LogIn size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </div>
                                )}
                            </button>
                        </form>

                        <div className="mt-10 text-center">
                            <button
                                onClick={() => {
                                    setIsSignUp(!isSignUp);
                                    setError(null);
                                }}
                                className="text-[10px] font-black text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors uppercase tracking-[0.2em]"
                            >
                                {isSignUp ? 'Já tem conta? Faça login' : 'Primeiro acesso? Crie uma conta'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
