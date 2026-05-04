import VacuumMapPanel from './components/VacuumMapPanel';
import VacuumControlPanel from './components/VacuumControlPanel';

const VacuumPage = () => (
  <div className="flex h-full bg-slate-900 text-white">
    <VacuumMapPanel />
    <VacuumControlPanel />
  </div>
);

export default VacuumPage;
