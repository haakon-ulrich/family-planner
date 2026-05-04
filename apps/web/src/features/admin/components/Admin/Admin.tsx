import { Outlet } from 'react-router-dom';

const Admin = () => (
  <main className="flex-1 p-6 md:p-8 overflow-y-auto">
    <Outlet />
  </main>
);

export default Admin;
