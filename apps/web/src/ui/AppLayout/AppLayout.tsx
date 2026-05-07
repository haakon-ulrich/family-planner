import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import AppSidebar from '@web/ui/AppSidebar';
import useAutoReturn from '@web/hooks/useAutoReturn';

const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  useAutoReturn(pathname);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-slate-900 text-white">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile hamburger — sits behind the sidebar (z-20) so the sidebar slides over it */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-3 left-3 z-20 md:hidden p-2 rounded-md bg-slate-800 text-slate-400 hover:text-white transition-colors"
        aria-label="Menü öffnen"
      >
        <Menu className="w-5 h-5" />
      </button>

      <AppSidebar open={sidebarOpen} />

      <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
        <Outlet />
      </div>
    </div>
  );
};

export default AppLayout;
