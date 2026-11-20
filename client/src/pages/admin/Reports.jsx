import { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  Calendar, 
  Download, 
  Filter, 
  ArrowUpRight,
  PieChart as PieIcon,
  BarChart3,
  Activity
} from 'lucide-react';
import adminService from '../../services/adminService';
import toast from 'react-hot-toast';

const Reports = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data } = await adminService.getDashboardStats();
      setStats(data);
    } catch (error) {
      toast.error('Failed to load reporting data');
    } finally {
      setLoading(false);
    }
  };

  const salesData = [
    { month: 'Jan', revenue: 4000, orders: 120 },
    { month: 'Feb', revenue: 5200, orders: 156 },
    { month: 'Mar', revenue: 4800, orders: 142 },
    { month: 'Apr', revenue: 7000, orders: 190 },
    { month: 'May', revenue: 6100, orders: 165 },
    { month: 'Jun', revenue: 8400, orders: 230 },
  ];

  const categoryData = [
    { name: 'Fiction', value: 400 },
    { name: 'Self Help', value: 300 },
    { name: 'Academic', value: 300 },
    { name: 'Comics', value: 200 },
    { name: 'Others', value: 100 },
  ];

  const COLORS = ['#2563eb', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e'];

  if (loading) return null;

  return (
    <div className="animate-in fade-in duration-500">
      <header className="flex justify-between items-end mb-12">
         <div>
            <h1 className="text-4xl font-black text-slate-900 mb-2 font-display">Institutional Reporting</h1>
            <p className="text-slate-500 font-medium tracking-tight">Advanced data synthesis and market trend analysis.</p>
         </div>
         <div className="flex space-x-4">
            <button className="flex items-center px-6 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
               <Calendar className="w-4 h-4 mr-2" /> Last 6 Months
            </button>
            <button className="flex items-center px-6 py-3 bg-primary-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-primary-700 transition-all shadow-xl shadow-primary-200">
               <Download className="w-4 h-4 mr-2" /> Export PDF Report
            </button>
         </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 mb-12">
         {/* Revenue Trend */}
         <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-100/50">
            <div className="flex justify-between items-center mb-10">
               <div>
                  <h3 className="text-xl font-black text-slate-900 leading-none mb-2 flex items-center">
                     <TrendingUp className="w-5 h-5 mr-3 text-primary-500" /> Revenue Growth
                  </h3>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Gross merchandise value trend</p>
               </div>
               <span className="text-2xl font-black text-slate-900">+24%</span>
            </div>
            <div className="h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData}>
                     <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                           <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 700, fontSize: 10}} />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontWeight: 700, fontSize: 10}} />
                     <Tooltip />
                     <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
         </div>

         {/* Category Distribution */}
         <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-100/50">
            <div className="flex justify-between items-center mb-10">
               <div>
                  <h3 className="text-xl font-black text-slate-900 leading-none mb-2 flex items-center">
                     <PieIcon className="w-5 h-5 mr-3 text-indigo-500" /> Category Velocity
                  </h3>
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Market share by book genre</p>
               </div>
            </div>
            <div className="h-[300px] flex items-center justify-center">
               <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                     <Pie
                        data={categoryData}
                        cx="50%"
                        cy="40%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                     >
                        {categoryData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={8} />
                        ))}
                     </Pie>
                     <Tooltip />
                  </PieChart>
               </ResponsiveContainer>
               <div className="w-48 space-y-4">
                  {categoryData.map((cat, idx) => (
                     <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center">
                           <div className="w-2 h-2 rounded-full mr-3" style={{ backgroundColor: COLORS[idx] }} />
                           <span className="text-xs font-bold text-slate-600">{cat.name}</span>
                        </div>
                        <span className="text-xs font-black text-slate-900">{Math.round((cat.value/1300)*100)}%</span>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <StatsBox icon={<Activity className="w-6 h-6 text-green-500" />} label="Market Liquidity" value="High" sub="High seller activity" />
         <StatsBox icon={<BarChart3 className="w-6 h-6 text-blue-500" />} label="Retention Rate" value="78%" sub="Recurring buyers" />
         <StatsBox icon={<ArrowUpRight className="w-6 h-6 text-amber-500" />} label="User Growth" value="+2,400" sub="New signups monthly" />
      </div>
    </div>
  );
};

const StatsBox = ({ icon, label, value, sub }) => (
  <div className="bg-slate-900 p-8 rounded-[40px] border border-slate-800 shadow-2xl relative overflow-hidden group">
     <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity">
        {icon}
     </div>
     <div className="flex items-center mb-6">
        <div className="p-3 bg-slate-800 rounded-2xl border border-slate-700">
           {icon}
        </div>
     </div>
     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">{label}</p>
     <p className="text-3xl font-black text-white mb-2">{value}</p>
     <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{sub}</p>
  </div>
);

export default Reports;
