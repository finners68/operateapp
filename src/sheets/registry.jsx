import { createElement } from 'react';
import { ConfirmSheetBody, PromptSheetBody } from './common.jsx';
import {
  ShowEventSheet, ShowHotelSheet, ShowFlightsListSheet, ShowFlightSheet,
  ShowContactDriverSheet, ShowTransportListSheet, ShowContactLiaisonSheet,
  ShowReminderSheet, ShowFlightInfoSheet, ShowTransportSheet, ShowVenueSheet,
  ShowArtistLiaisonSheet, ShowDayDetailsSheet, ShowContactSheet,
  ShowChecklistSheet, ShowTimelineSheet, ShowTimelineStepSheet,
  ShowTimelineAddSheet, ShowEmergencySheet, ShowDealSheet, ShowExpenseSheet,
  ShowDaySheet,
} from './show/ShowSheets.jsx';
import {
  ItineraryStartSheet, ItineraryNewShowSheet, ItineraryExistingShowSheet,
  ItinerarySendingSheet, ItineraryReviewSheet, ItineraryDiscardSheet,
  ItineraryDetailsSheet,
} from './itinerary/ItinerarySheets.jsx';
import {
  SettingsHomeAirportSheet, SettingsProfileNameSheet, SettingsCurrencySheet,
  SettingsPackingSheet, AuthInviteSheet, AuthAccountSheet,
} from './settings/SettingsSheets.jsx';
import {
  IdeaShowPickerSheet, IdeaTripPickerSheet, IdeaAttachSheet, IdeaEditSheet,
  NoteAddChoiceSheet, NoteMoveFolderSheet, TripTimelineOptionsSheet,
  TripEditSheet, TripContactsSheet, CalendarAddLogisticSheet,
  CalendarItemSheet, BoardingPassSheet,
  EventMenuSheet, TripMenuSheet, InvoicePickShowSheet, InvoiceAddLineSheet,
  InvoiceMetaSheet, BillingDetailsSheet, ContactViewSheet, ContactEditSheet,
} from './misc/MiscSheets.jsx';

export const SHEET_KINDS = Object.freeze({
  'common.confirm': ConfirmSheetBody,
  'common.prompt': PromptSheetBody,

  'show.event': ShowEventSheet,
  'show.hotel': ShowHotelSheet,
  'show.flightsList': ShowFlightsListSheet,
  'show.flight': ShowFlightSheet,
  'show.contactDriver': ShowContactDriverSheet,
  'show.driver': ShowTransportSheet,
  'show.transportList': ShowTransportListSheet,
  'show.transport': ShowTransportSheet,
  'show.liaison': ShowContactLiaisonSheet,
  'show.reminder': ShowReminderSheet,
  'show.flightInfo': ShowFlightInfoSheet,
  'show.venue': ShowVenueSheet,
  'show.artistLiaison': ShowArtistLiaisonSheet,
  'show.dayDetails': ShowDayDetailsSheet,
  'show.contact': ShowContactSheet,
  'show.checklist': ShowChecklistSheet,
  'show.timeline': ShowTimelineSheet,
  'show.timelineStep': ShowTimelineStepSheet,
  'show.timelineAdd': ShowTimelineAddSheet,
  'show.emergency': ShowEmergencySheet,
  'show.deal': ShowDealSheet,
  'show.expense': ShowExpenseSheet,
  'show.daySheet': ShowDaySheet,

  'itinerary.start': ItineraryStartSheet,
  'itinerary.newShow': ItineraryNewShowSheet,
  'itinerary.existingShow': ItineraryExistingShowSheet,
  'itinerary.sending': ItinerarySendingSheet,
  'itinerary.review': ItineraryReviewSheet,
  'itinerary.discard': ItineraryDiscardSheet,
  'itinerary.details': ItineraryDetailsSheet,

  'settings.homeAirport': SettingsHomeAirportSheet,
  'settings.profileName': SettingsProfileNameSheet,
  'settings.currency': SettingsCurrencySheet,
  'settings.packing': SettingsPackingSheet,
  'auth.invite': AuthInviteSheet,
  'auth.account': AuthAccountSheet,

  'idea.showPicker': IdeaShowPickerSheet,
  'idea.tripPicker': IdeaTripPickerSheet,
  'idea.attach': IdeaAttachSheet,
  'idea.edit': IdeaEditSheet,
  'note.addChoice': NoteAddChoiceSheet,
  'note.moveFolder': NoteMoveFolderSheet,
  'trip.timelineOptions': TripTimelineOptionsSheet,
  'trip.edit': TripEditSheet,
  'trip.contacts': TripContactsSheet,
  'calendar.addLogistic': CalendarAddLogisticSheet,
  'calendar.item': CalendarItemSheet,
  'boardingPass.details': BoardingPassSheet,

  'menu.event': EventMenuSheet,
  'menu.trip': TripMenuSheet,
  'invoice.pickShow': InvoicePickShowSheet,
  'invoice.addLine': InvoiceAddLineSheet,
  'invoice.meta': InvoiceMetaSheet,
  'invoice.billing': BillingDetailsSheet,
  'contact.view': ContactViewSheet,
  'contact.edit': ContactEditSheet,
});

export function resolveSheetBody(kind, props = {}){
  const Component = SHEET_KINDS[kind];
  return Component ? createElement(Component, props) : null;
}
