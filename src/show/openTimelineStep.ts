import { call } from '../api/operate.js';

/** Open the sheet or detail view for a show day timeline step. */
export function openTimelineStep(show: any, s: any){
  if(!show || !s) return;
  if(!s.auto){
    call('sheetShowTimelineStep', show.id, s.id);
    return;
  }
  if(s.kind === 'flight' && s.refId) return call('sheetFlight', show.id, s.refId);
  if(s.kind === 'hotel') return call('sheetHotel', show.id);
  if(s.kind === 'transport'){
    const list = call('showDrivers', show) || [];
    const idx = list.findIndex((d: any) => String(d.id) === String(s.refId));
    return idx >= 0 ? call('sheetDriver', show.id, idx) : call('sheetDriver', show.id);
  }
  if(s.kind === 'set' || s.kind === 'arrival') return call('sheetEvent', show.id);
  if(s.kind === 'advance') return call('sheetAdvance', show.id);
  if(s.kind === 'custom') return call('sheetShowTimelineStep', show.id, s.id);
}