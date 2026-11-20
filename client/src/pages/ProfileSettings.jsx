import { useState, useEffect } from 'react';
import { 
  User, 
  Phone, 
  MapPin, 
  BookOpen, 
  Lock, 
  Save, 
  Camera,
  Loader2,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import DashboardSidebar from '../components/DashboardSidebar';
import toast from 'react-hot-toast';

const ProfileSettings = () => {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: '',
    phone: '',
    college: '',
    bio: '',
    profile_image: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        full_name: user.full_name || '',
        phone: user.phone || '',
        college: user.college || '',
        bio: user.bio || '',
        profile_image: user.profile_image || ''
      });
    }
  }, [user]);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await userService.updateProfile(profileData);
      setUser(data.user);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return toast.error('New passwords do not match');
    }
    setLoading(true);
    try {
      await userService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      toast.success('Password changed successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-32 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row gap-12">
        <DashboardSidebar />

        <div className="flex-grow">
          <header className="mb-12">
            <h1 className="text-4xl font-black text-slate-900 mb-2 flex items-center">
               <ShieldCheck className="w-10 h-10 mr-4 text-primary-600" /> Account Settings
            </h1>
            <p className="text-slate-500 font-medium">Manage your public profile and account security.</p>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
             {/* Profile Info */}
            <section className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-xl shadow-slate-100/50">
               <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center">
                  <User className="w-6 h-6 mr-3 text-slate-400" /> Public Profile
               </h3>
               
               <form onSubmit={handleProfileSubmit} className="space-y-6">
                  {/* Photo change placeholder */}
                  <div className="flex items-center space-x-6 mb-10">
                     <div className="relative group">
                        <div className="w-24 h-24 bg-slate-100 rounded-[32px] overflow-hidden flex items-center justify-center border-4 border-white shadow-xl">
                            {profileData.profile_image ? (
                              <img src={profileData.profile_image} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-10 h-10 text-slate-300" />
                            )}
                        </div>
                        <button type="button" className="absolute -bottom-2 -right-2 p-2.5 bg-primary-600 text-white rounded-2xl shadow-lg border-2 border-white hover:scale-110 transition-all">
                           <Camera className="w-4 h-4" />
                        </button>
                     </div>
                     <div>
                        <p className="text-sm font-black text-slate-900 mb-1">Profile Photo</p>
                        <p className="text-xs text-slate-400 font-medium max-w-[200px]">PNG or JPG. Recommended size 400x400px.</p>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <InputGroup 
                        label="Full Name" 
                        value={profileData.full_name} 
                        onChange={(val) => setProfileData({...profileData, full_name: val})} 
                        placeholder="Your full name"
                     />
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputGroup 
                           label="Phone Number" 
                           icon={<Phone className="w-4 h-4" />}
                           value={profileData.phone} 
                           onChange={(val) => setProfileData({...profileData, phone: val})} 
                           placeholder="+1 (555) 000-0000"
                        />
                        <InputGroup 
                           label="College / Organization" 
                           icon={<MapPin className="w-4 h-4" />}
                           value={profileData.college} 
                           onChange={(val) => setProfileData({...profileData, college: val})} 
                           placeholder="Global University"
                        />
                     </div>
                     <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Bio / Description</label>
                        <textarea 
                           className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm h-32 resize-none"
                           value={profileData.bio}
                           onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                           placeholder="Tell other buyers and sellers about yourself..."
                        />
                     </div>
                  </div>

                  <button 
                     type="submit" 
                     disabled={loading}
                     className="w-full btn-primary py-5 rounded-3xl font-black flex items-center justify-center shadow-xl shadow-primary-200"
                  >
                     {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                     Save Profile Changes
                  </button>
               </form>
            </section>

            {/* Security Info */}
            <div className="space-y-12">
               <section className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-xl shadow-slate-100/50">
                  <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center">
                     <Lock className="w-6 h-6 mr-3 text-slate-400" /> Security
                  </h3>
                  
                  <form onSubmit={handlePasswordSubmit} className="space-y-6">
                     <InputGroup 
                        type="password"
                        label="Current Password" 
                        value={passwordData.currentPassword} 
                        onChange={(val) => setPasswordData({...passwordData, currentPassword: val})} 
                     />
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputGroup 
                           type="password"
                           label="New Password" 
                           value={passwordData.newPassword} 
                           onChange={(val) => setPasswordData({...passwordData, newPassword: val})} 
                        />
                        <InputGroup 
                           type="password"
                           label="Confirm New Password" 
                           value={passwordData.confirmPassword} 
                           onChange={(val) => setPasswordData({...passwordData, confirmPassword: val})} 
                        />
                     </div>

                     <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black flex items-center justify-center hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                     >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Lock className="w-5 h-5 mr-2" />}
                        Update Password
                     </button>
                  </form>
               </section>

               <div className="bg-primary-50 rounded-[40px] p-8 border border-primary-100">
                  <div className="flex items-start">
                     <div className="p-3 bg-white rounded-2xl shadow-sm mr-4">
                        <ShieldCheck className="w-6 h-6 text-primary-600" />
                     </div>
                     <div>
                        <h4 className="text-lg font-black text-slate-900 mb-1">Privacy Protection</h4>
                        <p className="text-sm text-slate-500 font-medium leading-relaxed">Your personal information like phone number and email is only shared with partners after a transaction is confirmed.</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const InputGroup = ({ label, value, onChange, placeholder, type = "text", icon }) => (
  <div>
     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">{label}</label>
     <div className="relative">
        <input 
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-2 focus:ring-primary-500 transition-all text-sm font-bold text-slate-900 pr-12"
        />
        {icon && (
           <div className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300">
              {icon}
           </div>
        )}
     </div>
  </div>
);

export default ProfileSettings;
