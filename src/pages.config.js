/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Bookings from './pages/Bookings';
import CalendarDepartures from './pages/CalendarDepartures';
import Companies from './pages/Companies';
import Customers from './pages/Customers';
import Dashboard from './pages/Dashboard';
import DmoFeeds from './pages/DmoFeeds';
import Experiences from './pages/Experiences';
import IntegrationSettings from './pages/IntegrationSettings';
import Invoices from './pages/Invoices';
import Monitoring from './pages/Monitoring';
import Groups from './pages/Groups';
import Partners from './pages/Partners';
import Reports from './pages/Reports';
import Analytics from './pages/Analytics.jsx';
import Integrations from './pages/Integrations.jsx';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Bookings": Bookings,
    "CalendarDepartures": CalendarDepartures,
    "Companies": Companies,
    "Customers": Customers,
    "Dashboard": Dashboard,
    "DmoFeeds": DmoFeeds,
    "Experiences": Experiences,
    "IntegrationSettings": IntegrationSettings,
    "Invoices": Invoices,
    "Monitoring": Monitoring,
    "Groups": Groups,
    "Partners": Partners,
    "Reports": Reports,
    "Analytics": Analytics,
    "Integrations": Integrations,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};