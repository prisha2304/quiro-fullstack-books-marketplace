import { useState, useEffect } from 'react';
import { 
  Shield, 
  Trash2, 
  UserX, 
  UserCheck, 
  MoreVertical, 
  Mail, 
  Calendar,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
  ArrowUpCircle,
  ArrowDownCircle
} from 'lucide-react';
import adminService from '../../services/adminService';
import AdminDataTable from '../../components/AdminDataTable';
import toast from 'react-hot-toast';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await adminService.getUsers();
      setUsers(data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (id, currentRole, currentStatus, updates) => {
    try {
      await adminService.updateUser(id, { 
        role: updates.role || currentRole, 
        status: updates.status || currentStatus 
      });
      toast.success('User updated successfully');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user? This action is irreversible.')) return;
    try {
      await adminService.deleteUser(id);
      toast.success('User deleted');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Full Name', 'Username', 'Email', 'Role', 'Status', 'Joined At'];
    const rows = users.map(u => [u.id, u.full_name, u.username, u.email, u.role, u.status, u.created_at]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "quiro_users.csv");
    document.body.appendChild(link);
    link.click();
  };

  const columns = [
    { 
      header: 'Identity', 
      render: (user) => (
        <div className="flex items-center">
           <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm border-2 ${user.role === 'ADMIN' ? 'bg-primary-900 border-primary-700 text-white shadow-lg shadow-primary-900/20' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
              {user.full_name?.charAt(0)}
           </div>
           <div className="ml-4">
              <p className="text-sm font-black text-slate-900 leading-none mb-1 flex items-center">
                 {user.full_name} 
                 {user.role === 'ADMIN' && <Shield className="w-3 h-3 ml-1.5 text-primary-600 fill-current" />}
              </p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">@{user.username}</p>
           </div>
        </div>
      )
    },
    { 
      header: 'Contact', 
      render: (user) => (
        <div className="flex flex-col space-y-1">
           <div className="flex items-center text-xs text-slate-600 font-medium">
              <Mail className="w-3 h-3 mr-2 text-slate-300" /> {user.email}
           </div>
        </div>
      )
    },
    { 
      header: 'Role', 
      render: (user) => (
        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.1em] border ${user.role === 'ADMIN' ? 'bg-primary-900 text-white border-primary-900' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
           {user.role}
        </span>
      )
    },
    { 
      header: 'Account Status', 
      render: (user) => (
        <div className="flex items-center">
           <div className={`w-2 h-2 rounded-full mr-2 ${user.status === 'active' ? 'bg-green-500 shadow-lg shadow-green-100' : 'bg-red-500 shadow-lg shadow-red-100'}`} />
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">{user.status}</span>
        </div>
      )
    }
  ];

  const filteredUsers = users.filter(u => 
    u.full_name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase()) || 
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in fade-in duration-500">
      <AdminDataTable 
        title="Institutional Users"
        columns={columns}
        data={filteredUsers}
        loading={loading}
        search={search}
        setSearch={setSearch}
        onExport={exportCSV}
        actions={(user) => (
          <>
             <button 
               onClick={() => handleUpdateUser(user.id, user.role, user.status, { status: user.status === 'active' ? 'suspended' : 'active' })}
               className={`p-2.5 rounded-xl border transition-all ${user.status === 'active' ? 'text-red-500 bg-red-50 hover:bg-red-100 border-red-100' : 'text-green-600 bg-green-50 hover:bg-green-100 border-green-100'}`}
               title={user.status === 'active' ? 'Suspend Account' : 'Activate Account'}
             >
                {user.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
             </button>
             
             <button 
               onClick={() => handleUpdateUser(user.id, user.role, user.status, { role: user.role === 'ADMIN' ? 'USER' : 'ADMIN' })}
               className={`p-2.5 rounded-xl border transition-all ${user.role === 'ADMIN' ? 'text-amber-600 bg-amber-50 hover:bg-amber-100 border-amber-100' : 'text-primary-600 bg-primary-50 hover:bg-primary-100 border-primary-100'}`}
               title={user.role === 'ADMIN' ? 'Demote to User' : 'Promote to Admin'}
             >
                {user.role === 'ADMIN' ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
             </button>

             <button 
               onClick={() => handleDeleteUser(user.id)}
               className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-100 rounded-xl transition-all"
               title="Delete Permanently"
             >
                <Trash2 className="w-4 h-4" />
             </button>
          </>
        )}
      />
    </div>
  );
};

export default UserManagement;
