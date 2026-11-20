import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import analyticsService from '../../services/analyticsService';
import toast from 'react-hot-toast';

const ReportExportButton = ({ type = 'revenue', label = 'Export CSV' }) => {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await analyticsService.exportReport(type);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `quiro_${type}_report_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Report exported successfully');
    } catch (err) {
      toast.error('Failed to export report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      <span>{label}</span>
    </button>
  );
};

export default ReportExportButton;
