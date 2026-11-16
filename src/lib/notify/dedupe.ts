// Outbox dedupe keys. `reminder24` must stay byte-identical to the SQL that pg_cron uses (spec §5, plan Task 4):
// the epoch of starts_at is part of the key so a rescheduled event gets one fresh reminder and the old one never repeats.
export const reminder24 = (eventId: string, profileId: string, startsAt: Date) =>
  `reminder24:${eventId}:${profileId}:${Math.floor(startsAt.getTime() / 1000)}`;
export const eventUpdated = (eventId: string, profileId: string, seq: number) => `event_updated:${eventId}:${profileId}:${seq}`;
export const rsvpConfirmed = (eventId: string, profileId: string) => `rsvp_confirmed:${eventId}:${profileId}`;
export const decision = (eventId: string, profileId: string, status: string) => `decision:${eventId}:${profileId}:${status}`;
export const welcome = (profileId: string) => `welcome:${profileId}`;
