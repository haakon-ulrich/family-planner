import { LayoutDashboard, ListTodo, Server, Settings, Users } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import RobotVacuumIcon from '@web/ui/RobotVacuumIcon';

type NavItem = { to: string; icon: React.ReactNode; label: string };

const TOP_NAV: NavItem[] = [
  { to: '/', icon: <LayoutDashboard className="w-5 h-5" />, label: 'Dashboard' },
  { to: '/vacuum', icon: <RobotVacuumIcon className="w-5 h-5" />, label: 'Staubsauger' },
];

const ADMIN_SUB_NAV: NavItem[] = [
  { to: '/admin/family', icon: <Users className="w-5 h-5" />, label: 'Familie' },
  { to: '/admin/tasks', icon: <ListTodo className="w-5 h-5" />, label: 'Aufgaben' },
  { to: '/admin/system', icon: <Server className="w-5 h-5" />, label: 'System' },
];

const itemClass = (active: boolean) =>
  [
    'flex items-center justify-center w-10 h-10 rounded-md transition-colors',
    active
      ? 'bg-slate-700 text-white'
      : 'text-slate-400 hover:bg-slate-700/60 hover:text-white',
  ].join(' ');

const SidebarLink = ({ to, icon, label, exact = false }: NavItem & { exact?: boolean }) => (
  <NavLink
    to={to}
    end={exact}
    title={label}
    className={({ isActive }) => itemClass(isActive)}
  >
    {icon}
  </NavLink>
);

interface AppSidebarProps {
  open: boolean;
}

const AppSidebar = ({ open }: AppSidebarProps) => {
  const { pathname } = useLocation();
  const onAdmin = pathname.startsWith('/admin');

  return (
    <nav
      className={[
        'flex flex-col items-center justify-between w-14 bg-slate-800 border-r border-slate-700 py-3',
        // Mobile: fixed, slides in from left
        'fixed inset-y-0 left-0 z-40 transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full',
        // Desktop: back in normal flow, always visible
        'md:relative md:z-auto md:translate-x-0',
      ].join(' ')}
    >
      {/* Top: main pages */}
      <div className="flex flex-col items-center gap-1">
        {TOP_NAV.map((item) => (
          <SidebarLink key={item.to} {...item} exact={item.to === '/'} />
        ))}
      </div>

      {/* Bottom: admin sub-items + settings anchor */}
      <div className="flex flex-col items-center gap-1">
        {onAdmin && (
          <>
            {ADMIN_SUB_NAV.map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
            <div className="w-6 border-t border-slate-700 my-1" />
          </>
        )}
        <SidebarLink to="/admin" icon={<Settings className="w-5 h-5" />} label="Einstellungen" />
      </div>
    </nav>
  );
};

export default AppSidebar;
