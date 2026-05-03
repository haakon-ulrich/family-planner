import { useEffect, useState } from 'react';

const formatTime = () =>
  new Date().toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

const Clock = () => {
  const [time, setTime] = useState(formatTime);

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-slate-400 md:text-3xl font-mono tabular-nums select-none">{time}</span>
  );
};

export default Clock;
