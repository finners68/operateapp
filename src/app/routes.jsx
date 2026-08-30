import { useParams } from 'react-router-dom';
import HomePage from '../home/HomePage.jsx';
import CalendarPage from '../calendar/CalendarPage.jsx';
import ShowsListPage from '../shows-list/ShowsListPage.jsx';
import TripModePage from '../trip/TripModePage.jsx';
import TripDetailPage from '../trip/TripDetailPage.jsx';
import ContentTabPage from '../content/ContentTabPage.jsx';
import IdeaDetailPage from '../content/IdeaDetailPage.jsx';
import NoteDetailPage from '../content/NoteDetailPage.jsx';
import NoteFolderPage from '../content/NoteFolderPage.jsx';
import ShowPage from '../show/ShowPage.jsx';
import SettingsPage from '../settings/SettingsPage.jsx';
import SearchPage from '../search/SearchPage.jsx';
import FinancePage from '../finance/FinancePage.jsx';
import InvoicesPage from '../finance/InvoicesPage.jsx';
import InvoiceDetailPage from '../finance/InvoiceDetailPage.jsx';
import ContactsPage from '../contacts/ContactsPage.jsx';
import PastShowsPage from '../calendar/PastShowsPage.jsx';
import StatsPage from '../stats/StatsPage.jsx';
import ItineraryPage from '../itinerary/ItineraryPage.jsx';
import WrappedPage from '../wrapped/WrappedPage.jsx';

function ShowRoute(){
  const { id } = useParams();
  return <ShowPage showId={id} />;
}
function TripRoute(){
  const { id } = useParams();
  return <TripDetailPage tripId={id} />;
}
function IdeaRoute(){
  const { id } = useParams();
  return <IdeaDetailPage ideaId={id} />;
}
function NoteRoute(){
  const { id } = useParams();
  return <NoteDetailPage noteId={id} />;
}
function NoteFolderRoute(){
  const { id } = useParams();
  return <NoteFolderPage folderId={id} />;
}
function InvoiceRoute(){
  const { id } = useParams();
  return <InvoiceDetailPage invoiceId={id} />;
}

export const appRoutes = [
  { path: '/', element: <HomePage /> },
  { path: '/calendar', element: <CalendarPage /> },
  { path: '/shows', element: <ShowsListPage /> },
  { path: '/shows/:id', element: <ShowRoute /> },
  { path: '/trips', element: <TripModePage /> },
  { path: '/trips/:id', element: <TripRoute /> },
  { path: '/ideas', element: <ContentTabPage /> },
  { path: '/ideas/:id', element: <IdeaRoute /> },
  { path: '/notes/folder/:id', element: <NoteFolderRoute /> },
  { path: '/notes/:id', element: <NoteRoute /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/search', element: <SearchPage /> },
  { path: '/finance', element: <FinancePage /> },
  { path: '/invoices', element: <InvoicesPage /> },
  { path: '/invoices/:id', element: <InvoiceRoute /> },
  { path: '/contacts', element: <ContactsPage /> },
  { path: '/past-shows', element: <PastShowsPage /> },
  { path: '/stats', element: <StatsPage /> },
  { path: '/itinerary', element: <ItineraryPage /> },
  { path: '/wrapped', element: <WrappedPage /> },
  { path: '*', element: <HomePage /> },
];
