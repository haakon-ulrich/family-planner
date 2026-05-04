import { Map } from 'lucide-react';
import { useVacuumMap } from '@web/features/vacuum/hooks';
import { useVacuumStore } from '@web/features/vacuum/store';

const VacuumMapPanel = () => {
  const { data, isLoading } = useVacuumMap();
  const { selectedRoomIds, toggleRoomId } = useVacuumStore();

  return (
    <div className="flex-3 flex items-center justify-center p-8 min-w-0">
      {isLoading ? (
        <span className="text-slate-500 text-sm">Lade Karte …</span>
      ) : data?.image && data.image_width && data.image_height ? (
        <svg
          viewBox={`0 0 ${data.image_width} ${data.image_height}`}
          className="max-w-full max-h-full"
          style={{ aspectRatio: `${data.image_width} / ${data.image_height}` }}
        >
          <image
            href={`data:image/png;base64,${data.image}`}
            width={data.image_width}
            height={data.image_height}
          />
          {data.rooms.map((room) => {
            const selected = selectedRoomIds.includes(room.id);
            return (
              <rect
                key={room.id}
                x={room.x}
                y={room.y}
                width={room.width}
                height={room.height}
                fill={selected ? 'rgba(99,102,241,0.25)' : 'transparent'}
                stroke={selected ? 'rgba(129,140,248,0.85)' : 'transparent'}
                strokeWidth={6}
                className="cursor-pointer"
                onClick={() => toggleRoomId(room.id)}
              />
            );
          })}
        </svg>
      ) : (
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <Map className="w-10 h-10" />
          <span className="text-sm">Karte nicht verfügbar</span>
        </div>
      )}
    </div>
  );
};

export default VacuumMapPanel;
