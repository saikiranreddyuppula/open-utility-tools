import type { ToolMetaStatic } from '@/lib/registry/types';

const meta: ToolMetaStatic = {
  id: 'generators-ics-event-generator-v1',
  name: 'Calendar Event (.ics) Generator',
  slug: 'ics-event-generator',
  description:
    'Build RFC 5545 iCalendar (.ics) files with time zones, recurrence, reminders and attendees, and get Google, Outlook and Yahoo add-to-calendar links.',
  category: 'generators',
  tags: ['ics', 'icalendar', 'calendar', 'event', 'rrule', 'recurrence'],
  keywords: [
    'ics generator',
    'ical',
    'icalendar',
    'add to calendar',
    'calendar invite',
    'rrule',
    'vevent',
    'valarm',
    'vtimezone',
    'google calendar link',
    'outlook calendar link',
    'recurring event',
  ],
  icon: 'CalendarClock',
  relatedTools: ['recurring-event-dates', 'timezone-converter', 'vcard-generator'],
};

export default meta;
