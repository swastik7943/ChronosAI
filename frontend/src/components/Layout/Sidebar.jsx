import { useState } from 'react';
import { Home, CalendarDays, Users, MessageSquare, BarChart3, UserCircle, ChevronLeft, ChevronRight } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'meetings', label: 'Meetings', icon: CalendarDays },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: UserCircle },
];

export default function Sidebar({ activeView, onViewChange, collapsed, onToggleCollapse }) {
  return (
    <aside className={`${collapsed ? 'w-[68px]' : 'w-[220px]'} h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300 flex-shrink-0 z-20`}>
      
      {/* Empty space for Header height alignment */}
      <div className="h-[60px] border-b border-gray-200 dark:border-gray-800 flex-shrink-0"></div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                ${isActive 
                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-500/20' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
              {!collapsed && <span className="ml-3 truncate">{item.label}</span>}
              {!collapsed && isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-800">
        <button 
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center py-2 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
