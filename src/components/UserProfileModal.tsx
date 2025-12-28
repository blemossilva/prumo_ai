import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
    X,
    User,
    Mail,
    Lock,
    Shield,
    Building2,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Eye,
    EyeOff
} from 'lucide-react';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: {
        id: string;
        name: string | null;
        email: string;
        role: string;
        tenant_id: string;
    } | null;
    tenant: {
        name: string;
    } | null;
    onProfileUpdate: (newName: string) => void;
}

export const UserProfileModal = ({ isOpen, onClose, profile, tenant, onProfileUpdate }: UserProfileModalProps) => {
    const [name, setName] = useState(profile?.name || '');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ name })
                .eq('id', profile.id);

            if (profileError) throw profileError;

            // Also update Auth metadata if needed
            await supabase.auth.updateUser({
                data: { full_name: name }
            });

            onProfileUpdate(name);
            setSuccess('Perfil atualizado com sucesso!');
        } catch (err: any) {
            setError(err.message || 'Erro ao atualizar perfil');
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError('As passwords não coincidem');
            return;
        }
        if (newPassword.length < 6) {
            setError('A password deve ter pelo menos 6 caracteres');
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const { error: authError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (authError) throw authError;

            setNewPassword('');
            setConfirmPassword('');
            setSuccess('Password alterada com sucesso!');
        } catch (err: any) {
            setError(err.message || 'Erro ao alterar password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-950/40 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />

            <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200/50 dark:border-white/5 overflow-hidden animate-in zoom-in duration-300">
                {/* Header */}
                <div className="p-8 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/5">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">O Seu Perfil</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Gerir os seus dados e a segurança</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Feedback Messages */}
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-600 dark:text-red-400 text-sm font-bold animate-in shake duration-300">
                            <AlertCircle size={18} />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 text-green-600 dark:text-green-400 text-sm font-bold animate-in slide-in-from-top-2 duration-300">
                            <CheckCircle2 size={18} />
                            {success}
                        </div>
                    )}

                    {/* Section: Personal Info */}
                    <form onSubmit={handleUpdateProfile} className="space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <User size={16} className="text-primary-500" />
                            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Informação Pessoal</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Nome Completo</label>
                                <div className="relative group">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500" size={16} />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/50 outline-none transition-all text-sm font-medium dark:text-white"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5 opacity-60">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">E-mail (Apenas Leitura)</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="email"
                                        disabled
                                        value={profile?.email || ''}
                                        className="w-full pl-11 pr-4 py-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-xl text-sm font-medium dark:text-slate-400"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || name === profile?.name}
                            className="w-full py-3.5 bg-primary-600 dark:bg-primary-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-primary-700 dark:hover:bg-primary-600 transition-all disabled:opacity-50 shadow-lg shadow-primary-500/20"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Atualizar Dados'}
                        </button>
                    </form>

                    <div className="h-px bg-slate-100 dark:bg-white/5" />

                    {/* Section: Organization */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Building2 size={16} className="text-primary-500" />
                            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Organização</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Empresa</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{tenant?.name || 'Nexio AI'}</p>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Cargo</p>
                                <div className="flex items-center gap-2">
                                    <Shield size={14} className="text-primary-500" />
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">{profile?.role || 'Worker'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-slate-100 dark:bg-white/5" />

                    {/* Section: Security */}
                    <form onSubmit={handleChangePassword} className="space-y-6 pb-2">
                        <div className="flex items-center gap-2 mb-2">
                            <Lock size={16} className="text-primary-500" />
                            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Segurança</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Nova Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500" size={16} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full pl-11 pr-11 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/50 outline-none transition-all text-sm font-medium dark:text-white"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Confirmar Password</label>
                                <div className="relative group">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500" size={16} />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full pl-11 pr-11 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-xl focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500/50 outline-none transition-all text-sm font-medium dark:text-white"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !newPassword}
                            className="w-full py-3.5 bg-slate-800 dark:bg-slate-700 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-900 dark:hover:bg-slate-600 transition-all disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Alterar Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
