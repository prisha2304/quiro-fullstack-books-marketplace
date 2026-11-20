import { Search, Filter, ChevronLeft, ChevronRight, FileDown } from 'lucide-react';

const AdminDataTable = ({ 
  columns, 
  data, 
  loading, 
  search, 
  setSearch, 
  title, 
  onExport,
  actions 
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-100/50 dark:shadow-none overflow-hidden animate-in fade-in slide-in-from-bottom-4">
      <div className="p-10 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
         <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">{title}</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Managing {data.length} total entries</p>
         </div>

         <div className="flex items-center space-x-4 w-full md:w-auto">
            <div className="flex-grow flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-5 py-3 rounded-2xl focus-within:ring-2 focus-within:ring-primary-500 transition-all">
               <Search className="w-4 h-4 text-slate-300 mr-3" />
               <input 
                 type="text" 
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 placeholder="Search entries..." 
                 className="bg-transparent outline-none w-full text-sm font-bold text-slate-600 dark:text-slate-300 placeholder:text-slate-300"
               />
            </div>
            
            {onExport && (
               <button 
                onClick={onExport}
                className="p-3.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm"
                title="Export to CSV"
               >
                  <FileDown className="w-5 h-5" />
               </button>
            )}
            
            <button className="flex items-center px-6 py-3 bg-slate-900 dark:bg-slate-950 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 dark:shadow-none border dark:border-slate-800">
               <Filter className="w-4 h-4 mr-2" /> Filter
            </button>
         </div>
      </div>

      <div className="overflow-x-auto">
         <table className="w-full text-left border-collapse">
            <thead>
               <tr className="bg-slate-50/50 dark:bg-slate-800/20">
                  {columns.map((col, idx) => (
                    <th key={idx} className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                       {col.header}
                    </th>
                  ))}
                  {actions && <th className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-right">Actions</th>}
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
               {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                       {columns.map((_, idx) => (
                          <td key={idx} className="px-10 py-8"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-full" /></td>
                       ))}
                       {actions && <td className="px-10 py-8"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-full w-full" /></td>}
                    </tr>
                  ))
               ) : data.length > 0 ? (
                  data.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all group">
                       {columns.map((col, colIdx) => (
                          <td key={colIdx} className="px-10 py-6 text-sm font-bold text-slate-600 dark:text-slate-400">
                             {col.render ? col.render(row) : row[col.key]}
                          </td>
                       ))}
                       {actions && (
                         <td className="px-10 py-6 text-right">
                            <div className="flex justify-end space-x-2">
                               {actions(row)}
                            </div>
                         </td>
                       )}
                    </tr>
                  ))
               ) : (
                  <tr>
                    <td colSpan={columns.length + (actions ? 1 : 0)} className="px-10 py-20 text-center">
                       <p className="text-slate-400 font-black uppercase tracking-widest italic">No matching entries found</p>
                    </td>
                  </tr>
               )}
            </tbody>
         </table>
      </div>

      <div className="p-8 bg-slate-50/30 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
         <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Showing {data.length} of {data.length} entries</p>
         <div className="flex space-x-2">
            <button className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-primary-600 disabled:opacity-30 transition-all" disabled>
               <ChevronLeft className="w-5 h-5" />
            </button>
            <button className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-primary-600 disabled:opacity-30 transition-all" disabled>
               <ChevronRight className="w-5 h-5" />
            </button>
         </div>
      </div>
    </div>
  );
};

export default AdminDataTable;
