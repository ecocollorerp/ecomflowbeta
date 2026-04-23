import React, { useState } from 'react';

const Collapsible: React.FC<{ title: string; defaultOpen?: boolean; children?: React.ReactNode }> = ({ title, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border">
      <button className="w-full flex items-center justify-between" onClick={() => setOpen(o => !o)}>
        <h3 className="font-bold">{title}</h3>
        <div className={`text-sm text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}>˅</div>
      </button>
      <div className={`mt-3 transition-all ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        {children}
      </div>
    </div>
  );
};

export default Collapsible;
