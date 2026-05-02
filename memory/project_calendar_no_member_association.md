---
name: Google Calendar events have no member association by default
description: Calendar events from Google Calendar won't carry family member data; member colors on appointment tiles are a placeholder to be removed when real calendar integration is built
type: project
---

Google Calendar events have no family-member association by default — the `memberColors` field on `CalendarAppointment` is placeholder-only for now.

**Why:** The real Google Calendar integration will only have member hinting via the "Name:" event title prefix convention, not a first-class member field.

**How to apply:** When wiring up the real calendar API, remove `memberColors` from `CalendarAppointment` and replace the colored dots in `AppointmentTile` with the member-hint color accent (or nothing if no hint is present). The design doc section 7.4 already reflects this.
