import MemberAvatar from './components/MemberAvatar';
import type { DashboardMember } from '../../types';

interface MemberHeaderRowProps {
  members: DashboardMember[];
}

const MemberHeaderRow = ({ members }: MemberHeaderRowProps) => (
  <div className="flex flex-none sticky top-0 z-10 bg-slate-900">
    {members.map((member, i) => (
      <div
        key={member.id}
        className={`flex-1 flex flex-col items-center pt-6 pb-4 px-4 ${
          i < members.length - 1 ? 'border-r border-slate-700/60' : ''
        }`}
      >
        <div className="mb-3">
          <MemberAvatar member={member} />
        </div>
        <span className="text-xl font-semibold text-slate-200">{member.name}</span>
      </div>
    ))}
  </div>
);

export default MemberHeaderRow;
