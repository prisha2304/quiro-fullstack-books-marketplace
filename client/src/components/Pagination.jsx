import { ChevronLeft, ChevronRight } from 'lucide-react';

const Pagination = ({ pagination, onPageChange }) => {
  const { page, pages, total } = pagination;
  
  if (pages <= 1) return null;

  const getPageNumbers = () => {
    const delta = 2;
    const range = [];
    for (let i = Math.max(2, page - delta); i <= Math.min(pages - 1, page + delta); i++) {
        range.push(i);
    }
    if (page - delta > 2) range.unshift('...');
    if (page + delta < pages - 1) range.push('...');
    range.unshift(1);
    if (pages > 1) range.push(pages);
    return range;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-12 pt-8 border-t border-slate-100">
      <p className="text-sm text-slate-500 font-medium">
        Showing Page <span className="text-slate-900 font-black">{page}</span> of <span className="text-slate-900 font-black">{pages}</span>
      </p>

      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-1">
          {getPageNumbers().map((num, i) => (
            num === '...' ? (
              <span key={`dots-${i}`} className="px-3 text-slate-400">...</span>
            ) : (
              <button
                key={num}
                onClick={() => onPageChange(num)}
                className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                  page === num 
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-200' 
                    : 'bg-white border border-slate-100 text-slate-600 hover:border-primary-200 hover:text-primary-600'
                }`}
              >
                {num}
              </button>
            )
          ))}
        </div>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === pages}
          className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;
