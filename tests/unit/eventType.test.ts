import { describe, it, expect } from 'vitest'
import {
  ANONYMOUS_VIEWER,
  EVENT_TYPES,
  EVENT_TYPE_OPTIONS,
  canRegisterAsAttendee,
  canSignUpAsVolunteer,
  canViewEvent,
  canViewEventType,
  eventTypeFromFlags,
  eventTypeToFlags,
  isJldVolunteer,
  type EventViewer,
} from '#shared/utils/eventType'

/**
 * Who can see and join which kind of event.
 *
 * These rules are the only thing standing between a restricted event and a
 * browser that shouldn't receive it, and the JLD type is the narrowest of them:
 * it has to be invisible not just to the public but to ordinary approved
 * volunteers, who can see every other volunteer event. Each viewer below is
 * spelled out rather than generated so a rule that quietly widens shows up as
 * a changed literal.
 */

const viewer = (overrides: Partial<EventViewer>): EventViewer => ({ ...ANONYMOUS_VIEWER, ...overrides })

const ADMIN = viewer({ isAdmin: true })
const APPROVED = viewer({ volunteerStatus: 'APPROVED' })
const JLD = viewer({ volunteerStatus: 'APPROVED', isJld: true })
const PENDING = viewer({ volunteerStatus: 'PENDING' })
/** Marked JLD by staff before being approved — the mark alone grants nothing. */
const PENDING_WITH_JLD_MARK = viewer({ volunteerStatus: 'PENDING', isJld: true })
const REJECTED_WITH_JLD_MARK = viewer({ volunteerStatus: 'REJECTED', isJld: true })

describe('event type ↔ stored flags', () => {
  it('round-trips every type through its flags', () => {
    for (const type of EVENT_TYPES) {
      expect(eventTypeFromFlags(eventTypeToFlags(type))).toBe(type)
    }
  })

  it('offers every type in the selector', () => {
    expect(EVENT_TYPE_OPTIONS.map(o => o.value).sort()).toEqual([...EVENT_TYPES].sort())
  })

  it('stores a JLD event as volunteer-only, so the public feeds exclude it', () => {
    expect(eventTypeToFlags('JLD')).toEqual({
      allowVolunteers: true,
      allowAttendees: false,
      isTraining: false,
      isJld: true,
    })
  })

  it('reads a row with the JLD flag as JLD, never as a plain volunteer event', () => {
    expect(eventTypeFromFlags({ allowVolunteers: true, allowAttendees: false, isJld: true })).toBe('JLD')
    // An odd combination still errs towards the narrower audience.
    expect(eventTypeFromFlags({ allowVolunteers: true, allowAttendees: true, isJld: true })).toBe('JLD')
  })

  it('reads rows written before the JLD column existed as they were', () => {
    expect(eventTypeFromFlags({ allowVolunteers: true, allowAttendees: false })).toBe('VOLUNTEERS')
    expect(eventTypeFromFlags({ allowVolunteers: true, allowAttendees: true })).toBe('VOLUNTEERS_AND_ATTENDEES')
    expect(eventTypeFromFlags({ allowVolunteers: true, isTraining: true })).toBe('TRAINING')
  })
})

describe('isJldVolunteer', () => {
  it('needs both approval and the mark', () => {
    expect(isJldVolunteer(JLD)).toBe(true)
    expect(isJldVolunteer(APPROVED)).toBe(false)
    expect(isJldVolunteer(PENDING_WITH_JLD_MARK)).toBe(false)
    expect(isJldVolunteer(REJECTED_WITH_JLD_MARK)).toBe(false)
    expect(isJldVolunteer(ANONYMOUS_VIEWER)).toBe(false)
  })
})

describe('canViewEventType', () => {
  it('shows a JLD event to JLD volunteers and staff only', () => {
    expect(canViewEventType('JLD', JLD)).toBe(true)
    expect(canViewEventType('JLD', ADMIN)).toBe(true)

    expect(canViewEventType('JLD', APPROVED)).toBe(false)
    expect(canViewEventType('JLD', PENDING)).toBe(false)
    expect(canViewEventType('JLD', PENDING_WITH_JLD_MARK)).toBe(false)
    expect(canViewEventType('JLD', REJECTED_WITH_JLD_MARK)).toBe(false)
    expect(canViewEventType('JLD', ANONYMOUS_VIEWER)).toBe(false)
  })

  it('leaves a JLD volunteer everything an approved volunteer already sees', () => {
    expect(canViewEventType('VOLUNTEERS', JLD)).toBe(true)
    expect(canViewEventType('VOLUNTEERS_AND_ATTENDEES', JLD)).toBe(true)
    expect(canViewEventType('ATTENDEES', JLD)).toBe(true)
    // Approved, so past training — same as any other approved volunteer.
    expect(canViewEventType('TRAINING', JLD)).toBe(false)
  })

  it('keeps the existing rules for the other types', () => {
    expect(canViewEventType('VOLUNTEERS', APPROVED)).toBe(true)
    expect(canViewEventType('VOLUNTEERS', PENDING)).toBe(false)
    expect(canViewEventType('VOLUNTEERS', ANONYMOUS_VIEWER)).toBe(false)
    expect(canViewEventType('TRAINING', PENDING)).toBe(true)
    expect(canViewEventType('TRAINING', APPROVED)).toBe(false)
    expect(canViewEventType('ATTENDEES', ANONYMOUS_VIEWER)).toBe(true)
  })

  it('applies the same rule to a raw row', () => {
    const row = eventTypeToFlags('JLD')
    expect(canViewEvent(row, JLD)).toBe(true)
    expect(canViewEvent(row, APPROVED)).toBe(false)
  })
})

describe('sign-up', () => {
  it('lets only JLD volunteers volunteer at a JLD event — staff included', () => {
    expect(canSignUpAsVolunteer('JLD', JLD)).toBe(true)
    expect(canSignUpAsVolunteer('JLD', APPROVED)).toBe(false)
    expect(canSignUpAsVolunteer('JLD', PENDING_WITH_JLD_MARK)).toBe(false)
    // Seeing an event as staff is not the same as being on its roster.
    expect(canSignUpAsVolunteer('JLD', ADMIN)).toBe(false)
  })

  it('takes no attendee registrations for a JLD event', () => {
    expect(canRegisterAsAttendee('JLD')).toBe(false)
  })
})
