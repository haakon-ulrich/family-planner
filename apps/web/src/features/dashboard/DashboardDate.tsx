import { createContext, useContext } from 'react';

const DashboardDateContext = createContext<string>('');

export const DashboardDateProvider = ({ date, children }: { date: string; children: React.ReactNode }) => (
  <DashboardDateContext.Provider value={date}>{children}</DashboardDateContext.Provider>
);

export const useDashboardDate = () => useContext(DashboardDateContext);
