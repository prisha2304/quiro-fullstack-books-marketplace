import { useState, useEffect } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';

const SidebarFilters = ({ filters, onFilterChange, categories }) => {
  const [openSections, setOpenSections] = useState({
    genre: true,
    condition: true,
    price: true,
    language: false,
    availability: true
  });

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const conditions = ['New', 'Like New', 'Good', 'Acceptable'];
  const languages = ['English', 'Spanish', 'French', 'German', 'Chinese', 'Hindi'];

  return (
    <div className="space-y-8">
      {/* Search Result Count for Mobile hidden here, handled in Browse.jsx */}
      
      {/* Categories / Genre */}
      <FilterSection 
        title="Genre" 
        isOpen={openSections.genre} 
        onToggle={() => toggleSection('genre')}
      >
        <div className="space-y-2 mt-4">
          <label className="flex items-center space-x-3 cursor-pointer group">
            <input 
              type="radio" 
              name="genre" 
              checked={!filters.genre} 
              onChange={() => onFilterChange('genre', '')}
              className="w-4 h-4 text-primary-600 border-slate-300 focus:ring-primary-500"
            />
            <span className={`text-sm ${!filters.genre ? 'font-bold text-primary-700' : 'text-slate-600'}`}>All Books</span>
          </label>
          {categories.map(cat => (
            <label key={cat.id} className="flex items-center space-x-3 cursor-pointer group">
              <input 
                type="radio" 
                name="genre" 
                checked={filters.genre === cat.name} 
                onChange={() => onFilterChange('genre', cat.name)}
                className="w-4 h-4 text-primary-600 border-slate-300 focus:ring-primary-500"
              />
              <span className={`text-sm ${filters.genre === cat.name ? 'font-bold text-primary-700' : 'text-slate-600 group-hover:text-primary-600'}`}>
                {cat.name}
              </span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Price Range */}
      <FilterSection 
        title="Price Range" 
        isOpen={openSections.price} 
        onToggle={() => toggleSection('price')}
      >
        <div className="mt-4 flex items-center space-x-2">
          <div className="relative flex-grow">
            <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-slate-400 text-xs">$</span>
            <input 
              type="number" 
              placeholder="Min" 
              value={filters.priceMin || ''}
              onChange={(e) => onFilterChange('priceMin', e.target.value)}
              className="w-full pl-6 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary-500" 
            />
          </div>
          <span className="text-slate-300">—</span>
          <div className="relative flex-grow">
            <span className="absolute inset-y-0 left-0 pl-2 flex items-center text-slate-400 text-xs">$</span>
            <input 
              type="number" 
              placeholder="Max" 
              value={filters.priceMax || ''}
              onChange={(e) => onFilterChange('priceMax', e.target.value)}
              className="w-full pl-6 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-primary-500" 
            />
          </div>
        </div>
      </FilterSection>

      {/* Condition */}
      <FilterSection 
        title="Condition" 
        isOpen={openSections.condition} 
        onToggle={() => toggleSection('condition')}
      >
        <div className="space-y-2 mt-4">
          {conditions.map(cond => (
            <label key={cond} className="flex items-center space-x-3 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={filters.condition === cond}
                onChange={() => onFilterChange('condition', filters.condition === cond ? '' : cond)}
                className="w-4 h-4 rounded text-primary-600 border-slate-300 focus:ring-primary-500"
              />
              <span className={`text-sm ${filters.condition === cond ? 'font-bold text-primary-700' : 'text-slate-600 group-hover:text-primary-600'}`}>
                {cond}
              </span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Availability / Method */}
      <FilterSection 
        title="Availability" 
        isOpen={openSections.availability} 
        onToggle={() => toggleSection('availability')}
      >
        <div className="space-y-3 mt-4">
          <label className="flex items-center space-x-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={filters.sale_enabled === 'true'}
              onChange={(e) => onFilterChange('sale_enabled', e.target.checked ? 'true' : '')}
              className="w-4 h-4 rounded text-primary-600 border-slate-300 focus:ring-primary-500"
            />
            <span className="text-sm text-slate-600">Buyable Only</span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={filters.swap_enabled === 'true'}
              onChange={(e) => onFilterChange('swap_enabled', e.target.checked ? 'true' : '')}
              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-600">Swap Available</span>
          </label>
        </div>
      </FilterSection>

      {/* Language */}
      <FilterSection 
        title="Language" 
        isOpen={openSections.language} 
        onToggle={() => toggleSection('language')}
      >
        <div className="space-y-2 mt-4 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
          {languages.map(lang => (
            <label key={lang} className="flex items-center space-x-3 cursor-pointer group">
              <input 
                type="radio" 
                name="language"
                checked={filters.language === lang}
                onChange={() => onFilterChange('language', lang)}
                className="w-4 h-4 text-primary-600 border-slate-300 focus:ring-primary-500"
              />
              <span className="text-sm text-slate-600">{lang}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      <button 
        onClick={() => onFilterChange('reset', null)}
        className="w-full py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center border border-slate-100 rounded-xl hover:bg-red-50"
      >
        <X className="w-4 h-4 mr-2" /> Reset All Filters
      </button>
    </div>
  );
};

const FilterSection = ({ title, children, isOpen, onToggle }) => (
  <div className="border-b border-slate-100 pb-6">
    <button 
      onClick={onToggle}
      className="flex items-center justify-between w-full text-left"
    >
      <h4 className="font-bold text-slate-900 text-sm tracking-tight">{title}</h4>
      {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
    </button>
    {isOpen && children}
  </div>
);

export default SidebarFilters;
