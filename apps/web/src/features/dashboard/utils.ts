import type { FamilyMember, Task, TaskInstance, TaskStepInstance, TaskStatus, SkippedDayRange } from '@shared/index';
import type { DashboardMember, DashboardTask } from './types';
import { isTaskScheduledOn } from './lib/recurrence';

const BUCKET_MAP: Record<string, keyof DashboardMember['tasks']> = {
  morning: 'morgen',
  afternoon: 'nachmittag',
  evening: 'abend',
};

const isMemberSkippedOnDate = (memberId: string, date: string, ranges: SkippedDayRange[]): boolean =>
  ranges.some(
    (r) => (r.memberId === null || r.memberId === memberId) && r.startDate <= date && r.endDate >= date,
  );

export const buildDashboardMembers = (
  members: FamilyMember[],
  tasks: Task[],
  instances: TaskInstance[],
  stepInstances: TaskStepInstance[],
  date: string,
  streakByMemberId: Map<string, number> = new Map(),
  skippedDayRanges: SkippedDayRange[] = [],
): DashboardMember[] => {
  const instanceByTaskId = new Map(instances.map((i) => [i.taskId, i.status as TaskStatus]));
  const stepInstanceByStepId = new Map(stepInstances.map((s) => [s.taskStepId, s.status as TaskStatus]));

  // Tasks explicitly postponed to this date show up even if not in the natural recurrence
  const postponedToDateTaskIds = new Set(
    instances.filter((i) => i.postponedFrom != null).map((i) => i.taskId),
  );

  const todayTasks = tasks.filter(
    (t) =>
      t.active &&
      (isTaskScheduledOn(t, date) || postponedToDateTaskIds.has(t.id)) &&
      instanceByTaskId.get(t.id) !== 'skipped',
  );

  return members.map((member) => {
    const memberTasks = todayTasks.filter((t) => t.memberId === member.id || t.memberId === null);

    const buckets: DashboardMember['tasks'] = { morgen: [], nachmittag: [], abend: [] };

    for (const task of memberTasks) {
      const bucket = BUCKET_MAP[task.bucket];
      if (!bucket) continue;

      let dashTask: DashboardTask;

      if (task.kind === 'single') {
        dashTask = {
          kind: 'single',
          id: task.id,
          title: task.title,
          icon: task.iconValue ?? '📋',
          status: instanceByTaskId.get(task.id) ?? 'pending',
          dueByTime: task.dueByTime ?? undefined,
          postponable: task.postponable,
        };
      } else {
        dashTask = {
          kind: 'multi',
          id: task.id,
          title: task.title,
          dueByTime: task.dueByTime ?? undefined,
          postponable: task.postponable,
          steps: (task.steps ?? []).map((s) => ({
            id: s.id,
            icon: s.iconValue,
            status: stepInstanceByStepId.get(s.id) ?? 'pending',
          })),
        };
      }

      buckets[bucket].push(dashTask);
    }

    return {
      id: member.id,
      name: member.name,
      color: member.color,
      streak: streakByMemberId.get(member.id) ?? 0,
      isSkipped: isMemberSkippedOnDate(member.id, date, skippedDayRanges),
      tasks: buckets,
    };
  });
};

// Before 3am we're still in the previous day's window (rollover happens at 03:00).
export const getTodayString = (): string => {
  const now = new Date();
  if (now.getHours() < 3) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toLocaleDateString('sv');
  }
  return now.toLocaleDateString('sv');
};

export const isDueTimeOverdue = (dueByTime: string): boolean => {
  const [h, m] = dueByTime.split(':').map(Number);
  return Date.now() > new Date().setHours(h, m + 10, 0, 0);
};

const getTaskProgress = (task: DashboardTask): number => {
  if (task.kind === 'single') return task.status === 'completed' ? 1 : 0;
  const done = task.steps.filter((s) => s.status === 'completed').length;
  return done / task.steps.length;
};

export const getCompletionProgress = (member: DashboardMember): number => {
  const all = [...member.tasks.morgen, ...member.tasks.nachmittag, ...member.tasks.abend];
  if (all.length === 0) return 0;
  return all.reduce((sum, task) => sum + getTaskProgress(task), 0) / all.length;
};
