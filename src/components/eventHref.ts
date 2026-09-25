import type { Href } from 'expo-router';

import { isSlotEvent, slotIdOf, type PersonalEvent } from '@/modules/productivity';

/** Où ouvrir un rendez-vous : son formulaire, ou le créneau fixe dont vient la séance. */
export function eventHref(e: Pick<PersonalEvent, 'id'>): Href {
  return isSlotEvent(e)
    ? { pathname: '/planning/slot-form', params: { id: slotIdOf(e) } }
    : { pathname: '/events/form', params: { id: e.id } };
}
