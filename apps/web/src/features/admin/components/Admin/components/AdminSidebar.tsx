import { NavLink } from 'react-router-dom';
import { Users, ListTodo, Settings, LayoutDashboard, X } from 'lucide-react';

const navItems = [
  { to: '/admin/family', label: 'Familie', icon: Users },
  { to: '/admin/tasks', label: 'Aufgaben', icon: ListTodo },
  { to: '/admin/system', label: 'System', icon: Settings },
];

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

const AdminSidebar = ({ open, onClose }: AdminSidebarProps) => (
  <>
    {/* Mobile overlay backdrop */}
    {open && (
      <div
        className="fixed inset-0 bg-black/50 z-20 md:hidden"
        onClick={onClose}
      />
    )}

    <aside
      className={[
        'fixed inset-y-0 left-0 z-30 w-56 flex flex-col bg-slate-800 border-r border-slate-700',
        'transition-transform duration-200',
        'md:static md:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
    >
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
        <span className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Verwaltung
        </span>
        <button
          className="md:hidden p-1 rounded text-slate-400 hover:text-white"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-700/60 hover:text-white',
              ].join(' ')
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Back to dashboard */}
      <div className="p-2 border-t border-slate-700">
        <NavLink
          to="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-slate-400 hover:bg-slate-700/60 hover:text-white transition-colors"
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          Zum Dashboard
        </NavLink>
      </div>
    </aside>
  </>
);

export default AdminSidebar;
