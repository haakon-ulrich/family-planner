import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SseEvent } from '@shared/index';
import { INSTANCES_KEY, STEP_INSTANCES_KEY } from '@web/features/instances';
import { TASKS_KEY } from '@web/features/tasks';
import { MEMBERS_KEY } from '@web/features/members';
import { CALENDAR_KEY } from '@web/features/calendar';
import { WEATHER_KEY } from '@web/features/weather';
import { SETTINGS_KEY } from '@web/features/admin';

const STREAKS_KEY = ['streaks'];

const useSseEvents = () => {
  const qc = useQueryClient();

  useEffect(() => {
    const es = new EventSource('/api/events');

    es.addEventListener('message', (e: MessageEvent) => {
      let event: SseEvent;
      try {
        event = JSON.parse(e.data) as SseEvent;
      } catch {
        return;
      }

      switch (event.type) {
        case 'instance-updated':
          qc.invalidateQueries({ queryKey: [...INSTANCES_KEY, event.payload.date] });
          qc.invalidateQueries({ queryKey: STREAKS_KEY });
          break;
        case 'step-instance-updated':
          qc.invalidateQueries({ queryKey: [...STEP_INSTANCES_KEY, event.payload.date] });
          qc.invalidateQueries({ queryKey: STREAKS_KEY });
          break;
        case 'task-changed':
          qc.invalidateQueries({ queryKey: TASKS_KEY });
          break;
        case 'member-changed':
          qc.invalidateQueries({ queryKey: MEMBERS_KEY });
          break;
        case 'calendar-synced':
          qc.invalidateQueries({ queryKey: CALENDAR_KEY });
          break;
        case 'day-rolled-over':
          qc.invalidateQueries({ queryKey: [...INSTANCES_KEY, event.payload.date] });
          qc.invalidateQueries({ queryKey: [...STEP_INSTANCES_KEY, event.payload.date] });
          qc.invalidateQueries({ queryKey: STREAKS_KEY });
          break;
        case 'settings-changed':
          qc.invalidateQueries({ queryKey: SETTINGS_KEY });
          break;
        case 'weather-synced':
          qc.invalidateQueries({ queryKey: WEATHER_KEY });
          break;
      }
    });

    return () => es.close();
  }, [qc]);
};

export default useSseEvents;
