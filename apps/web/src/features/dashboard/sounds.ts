import { Howl } from 'howler';
import clickUrl from '@web/assets/click.mp3';
import fanfareUrl from '@web/assets/fanfare.mp3';
import { useDashboardStore } from './store';

const click = new Howl({ src: [clickUrl], volume: 0.6 });
const fanfare = new Howl({ src: [fanfareUrl], volume: 0.7 });

export const playClick = () => {
  if (useDashboardStore.getState().isMuted) return;
  click.play();
};

export const playFanfare = () => {
  if (useDashboardStore.getState().isMuted) return;
  fanfare.play();
};
