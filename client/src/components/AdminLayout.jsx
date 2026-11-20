import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AdminSidebar from './AdminSidebar';
import { Loader2, Search } from 'lucide-react';

const AdminLayout = () => {
  const { user, loading } = useAuth();

  if (loading) return (
     <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />
     </div>
  );

  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <AdminSidebar />
      <main className="pl-72 min-h-screen">
         <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-10 sticky top-0 z-40">
            <div className="flex items-center w-full max-w-xl bg-slate-50 rounded-2xl border border-slate-100 px-4 py-2 hover:border-primary-200 transition-all group">
               <Search className="w-5 h-5 text-slate-300 group-hover:text-primary-500 mr-3" />
               <input 
                 type="text" 
                 placeholder="Search across users, books, or orders..." 
                 className="bg-transparent outline-none w-full text-sm font-medium text-slate-600 placeholder:text-slate-300"
               />
            </div>
            
            <div className="flex items-center space-x-6 text-slate-400">
               <div className="text-right">
                  <p className="text-xs font-black text-slate-900 leading-none mb-1">Status: Operational</p>
                  <p className="text-[10px] font-bold uppercase text-green-500 tracking-widest">All systems normal</p>
               </div>
               <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
               </div>
            </div>
         </header>
         
         <div className="p-10">
            <Outlet />
         </div>
      </main>
    </div>
  );
};

export default AdminLayout;
