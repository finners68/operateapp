/** Home dashboard widget layout — shared types for the grid engine. */

export type WidgetSize = 'small' | 'medium' | 'large';

export type WidgetDensity = 'compact' | 'default' | 'expanded';

export type HomeWidgetId =
  | 'nextShow'
  | 'todaySchedule'
  | 'upcomingTravel'
  | 'accommodation'
  | 'upcomingShows'
  | 'keyContacts'
  | 'tasksReminders'
  | string;

export interface HomeWidgetGridItem {
  id: HomeWidgetId;
  x: number;
  y: number;
  w: number;
  h: number;
  size: WidgetSize;
}

export interface GridRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GridCell {
  x: number;
  y: number;
}