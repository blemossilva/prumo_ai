import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, Cell,
    ReferenceLine
} from 'recharts';
import {
    Zap,
    Users,
    Target,
    AlertTriangle,
    TrendingUp,
    TrendingDown,
    Activity,
    Cpu,
    Euro,
    Database,
    HardDrive
} from 'lucide-react';

interface DashboardProps {
    tenantId: string | undefined;
}

export const Dashboard = ({ tenantId }: DashboardProps) => {
    const [metrics, setMetrics] = useState<any>(null);
    const [trendData, setTrendData] = useState<any[]>([]);
    const [distribution, setDistribution] = useState<any[]>([]);
    const [rankings, setRankings] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (tenantId) {
            fetchDashboardData();
        }
    }, [tenantId]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [
                { data: metricsData },
                { data: trendRes },
                { data: distRes },
                { data: rankRes }
            ] = await Promise.all([
                supabase.rpc('get_tenant_dashboard_metrics', { t_id: tenantId }),
                supabase.rpc('get_consumption_trend', { t_id: tenantId }),
                supabase.rpc('get_operational_distribution', { t_id: tenantId }),
                supabase.rpc('get_usage_rankings', { t_id: tenantId })
            ]);

            setMetrics(metricsData);
            setTrendData(trendRes || []);
            setDistribution(distRes || []);
            setRankings(rankRes);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    const usagePercent = metrics?.usage_percentage || 0;
    const isHighUsage = usagePercent > 80;
    const isCriticalUsage = usagePercent > 100;

    return (
        <div className="space-y-8 p-1 animate-in fade-in duration-700">
            {/* HEADER SECTION: FINANCIAL SUMMARY (Account Priority) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Total Estimated Cost - Hero Card */}
                <div className="md:col-span-1 relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-900 dark:to-black p-8 rounded-[2.5rem] shadow-2xl border border-white/5 transition-all hover:scale-[1.02] group">
                    <div className="absolute top-0 right-0 w-48 h-48 -mr-16 -mt-16 bg-blue-500/20 blur-[80px] rounded-full group-hover:bg-blue-500/30 transition-colors"></div>
                    <div className="relative z-10 flex flex-col h-full justify-between">
                        <div className="flex justify-between items-start">
                            <div className="p-3 rounded-2xl bg-white/10 text-white backdrop-blur-md">
                                <Euro size={24} />
                            </div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Mensal Estimado</span>
                        </div>
                        <div className="mt-8">
                            <p className="text-slate-400 text-xs font-bold mb-1">Total Previsto</p>
                            <h3 className="text-5xl font-black text-white tracking-tight">
                                €{metrics?.estimated_bill?.toFixed(2)}
                            </h3>
                        </div>
                        <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                            <span>Base: €{metrics?.base_price?.toFixed(2)}</span>
                            <div className="flex items-center gap-1 text-emerald-400">
                                <TrendingUp size={12} />
                                <span>Ativo</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Secondary Financials Grid */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Overage Cost */}
                    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-6 rounded-[2rem] shadow-xl transition-all hover:scale-[1.02] group relative overflow-hidden">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Consumo Excedente</p>
                                <h3 className={`text-3xl font-black ${metrics?.overage > 0 ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
                                    €{metrics?.overage_revenue?.toFixed(2)}
                                </h3>
                            </div>
                            <div className={`p-3 rounded-2xl ${metrics?.overage > 0 ? 'bg-red-500/10 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-slate-500/10 text-slate-400'}`}>
                                <AlertTriangle size={24} className={metrics?.overage > 0 ? 'animate-pulse' : ''} />
                            </div>
                        </div>
                        <p className="mt-4 text-xs font-bold text-slate-500 flex items-center gap-2">
                            <TrendingDown size={14} className="text-slate-400 opacity-50" />
                            {metrics?.overage.toLocaleString()} tokens fora do plano
                        </p>
                    </div>

                    {/* Storage Cost */}
                    <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-6 rounded-[2rem] shadow-xl transition-all hover:scale-[1.02] group">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Cloud Storage</p>
                                <h3 className="text-3xl font-black text-slate-900 dark:text-white">
                                    €{metrics?.storage_cost?.toFixed(2)}
                                </h3>
                            </div>
                            <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
                                <HardDrive size={24} />
                            </div>
                        </div>
                        <p className="mt-4 text-xs font-bold text-slate-500">Gestão de ficheiros e KB</p>
                    </div>
                </div>
            </div>

            {/* SECTION 2: USAGE INTELLIGENCE (Operational Priority) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                {/* Usage Health (Gauge Style) */}
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-6 rounded-[2rem] shadow-xl transition-all hover:scale-[1.02]">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Saúde do Plano</p>
                        <Zap size={16} className={isCriticalUsage ? 'text-red-500' : isHighUsage ? 'text-yellow-500' : 'text-blue-500'} />
                    </div>
                    <div className="relative flex items-center justify-center py-2">
                        <h4 className="text-4xl font-black text-slate-900 dark:text-white">{usagePercent.toFixed(1)}%</h4>
                    </div>
                    <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-1000 ease-out rounded-full ${isCriticalUsage ? 'bg-red-500' : isHighUsage ? 'bg-yellow-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        ></div>
                    </div>
                </div>

                {/* Active Users */}
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-6 rounded-[2rem] shadow-xl transition-all hover:scale-[1.02]">
                    <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500 w-fit mb-4">
                        <Users size={20} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Capital Humano</p>
                    <h3 className="text-3xl font-black mt-2 text-slate-900 dark:text-white">{metrics?.active_users}</h3>
                    <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-tighter">Utilizadores ativos este mês</p>
                </div>

                {/* Total Tokens */}
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-6 rounded-[2rem] shadow-xl transition-all hover:scale-[1.02]">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500 w-fit mb-4">
                        <Activity size={20} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Tokens</p>
                    <h3 className="text-3xl font-black mt-2 text-slate-900 dark:text-white">{(metrics?.total_tokens / 1000).toFixed(1)}k</h3>
                    <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-tighter">Interações processadas</p>
                </div>

                {/* Storage Volume */}
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-6 rounded-[2rem] shadow-xl transition-all hover:scale-[1.02]">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 w-fit mb-4">
                        <Database size={20} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Espaço Físico</p>
                    <h3 className="text-3xl font-black mt-2 text-slate-900 dark:text-white">
                        {metrics?.storage_usage_gb < 0.01 ? (metrics?.storage_bytes / 1024 / 1024).toFixed(1) + ' MB' : metrics?.storage_usage_gb.toFixed(2) + ' GB'}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-tighter">Documentos na infraestrutura</p>
                </div>
            </div>

            {/* SECTION 2: TREND & DISTRIBUTION */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Burn-down Chart */}
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-8 rounded-[2rem] shadow-2xl">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h4 className="text-xl font-black text-slate-900 dark:text-white">Consumo Cumulativo</h4>
                            <p className="text-sm text-slate-500">Soma acumulada vs Limite do Plano</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold px-4 py-2 bg-slate-100 dark:bg-white/5 rounded-full">
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Tokens</div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Custos (€)</div>
                            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Limite</div>
                        </div>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorCons" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="day"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                    tickFormatter={(val) => new Date(val).getDate().toString()}
                                />
                                <YAxis
                                    yAxisId="left"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                    tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#10b981', fontSize: 10 }}
                                    tickFormatter={(val) => `€${val}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '16px',
                                        color: '#fff'
                                    }}
                                    formatter={(value: any, name: string | undefined) => {
                                        if (name === 'cumulative_revenue') return [`€${Number(value).toFixed(2)}`, 'Custos Acumulados'];
                                        if (name === 'cumulative_sum') return [`${value.toLocaleString()} tokens`, 'Consumo Total'];
                                        return [value, name || ''];
                                    }}
                                />
                                <ReferenceLine yAxisId="left" y={metrics?.plan_limit} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Limite', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                                <Area yAxisId="left" type="monotone" dataKey="cumulative_sum" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorCons)" />
                                <Area yAxisId="right" type="monotone" dataKey="cumulative_revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Operational Distribution Chart */}
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-8 rounded-[2rem] shadow-2xl">
                    <div className="mb-8">
                        <h4 className="text-xl font-black text-slate-900 dark:text-white">Mix de Operações</h4>
                        <p className="text-sm text-slate-500">Distribuição por tipo de atividade</p>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={distribution}>
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="operation_type"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    className="capitalize"
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{
                                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '16px'
                                    }}
                                />
                                <Bar
                                    dataKey="total_tokens"
                                    radius={[0, 10, 10, 0]}
                                    label={{ position: 'right', fill: '#64748b', fontSize: 10, formatter: (val: any) => `${(Number(val) / 1000).toFixed(1)}k` }}
                                >
                                    {distribution.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : index === 1 ? '#a855f7' : '#10b981'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* SECTION 3: RANKINGS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Users Table */}
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-8 rounded-[2rem] shadow-2xl overflow-hidden">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500"><Users size={20} /></div>
                        <h4 className="text-xl font-black text-slate-900 dark:text-white">Top Utilizadores</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-white/5">
                                    <th className="pb-4 pt-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Nome</th>
                                    <th className="pb-4 pt-2 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Consumo</th>
                                    <th className="pb-4 pt-2 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Atividade</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                                {rankings?.users?.map((user: any, idx: number) => (
                                    <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="py-4 font-bold text-slate-700 dark:text-slate-300">{user.name}</td>
                                        <td className="py-4 text-right">
                                            <span className="px-3 py-1 bg-slate-100 dark:bg-white/10 rounded-full text-xs font-black text-slate-900 dark:text-white">
                                                {(user.total_tokens / 1000).toFixed(1)}k
                                            </span>
                                        </td>
                                        <td className="py-4 text-right text-xs text-slate-500">
                                            {new Date(user.last_activity).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Top Agents Table */}
                <div className="bg-white dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-white/10 p-8 rounded-[2rem] shadow-2xl overflow-hidden">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500"><Target size={20} /></div>
                        <h4 className="text-xl font-black text-slate-900 dark:text-white">Performance de Agentes</h4>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-white/5">
                                    <th className="pb-4 pt-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Agente</th>
                                    <th className="pb-4 pt-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Modelo</th>
                                    <th className="pb-4 pt-2 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Tokens</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                                {rankings?.agents?.map((agent: any, idx: number) => (
                                    <tr key={idx} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="py-4 font-bold text-slate-700 dark:text-slate-300">{agent.name}</td>
                                        <td className="py-4">
                                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase">
                                                <Cpu size={12} className="text-blue-500" />
                                                {agent.model}
                                            </span>
                                        </td>
                                        <td className="py-4 text-right">
                                            <span className="px-3 py-1 bg-blue-500/10 text-blue-500 rounded-full text-xs font-black">
                                                {(agent.total_tokens / 1000).toFixed(1)}k
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
