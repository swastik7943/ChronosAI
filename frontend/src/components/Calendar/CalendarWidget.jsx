import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'

export default function CalendarWidget({ meetings, onDateClick, onEventClick }) {
  const events = meetings.map(m => {
    const startStr = `${m.date}T${m.startTime}:00`;
    let endStr = undefined;
    
    if (m.duration) {
       const startDate = new Date(startStr);
       const endDate = new Date(startDate.getTime() + m.duration * 60000);
       endStr = endDate.toISOString();
    }
    
    return {
      id: m._id,
      title: m.title,
      start: startStr,
      end: endStr,
      backgroundColor: 'rgba(79, 70, 229, 0.8)', // indigo-600 with opacity
      borderColor: '#4338ca', // indigo-700
      textColor: '#ffffff',
      extendedProps: { rawMeeting: m }
    };
  });

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-xl overflow-hidden h-full text-gray-800 dark:text-gray-200 transition-colors duration-200 custom-calendar">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        dateClick={(info) => {
           if (onDateClick) onDateClick(info.dateStr);
        }}
        eventClick={(info) => {
           if (onEventClick) onEventClick(info.event.extendedProps.rawMeeting);
        }}
        headerToolbar={{
          left: 'prev,next',
          center: 'title',
          right: 'today'
        }}
        height="100%"
        themeSystem="standard"
        eventDisplay="block"
        eventClassNames={() => 'rounded mx-1 p-0.5 text-xs font-semibold shadow-sm overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer'}
      />
    </div>
  );
}
