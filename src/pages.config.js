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
import Dashboard from './pages/Dashboard';
import Experiences from './pages/Experiences';
import CalendarDepartures from './pages/CalendarDepartures';
import Bookings from './pages/Bookings';
import Customers from './pages/Customers';
import Companies from './pages/Companies';
import Invoices from './pages/Invoices';
import Partners from './pages/Partners';
import DmoFeeds from './pages/DmoFeeds';
import Monitoring from './pages/Monitoring';
import Reports from './pages/Reports';
import IntegrationSettings from './pages/IntegrationSettings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Experiences": Experiences,
    "CalendarDepartures": CalendarDepartures,
    "Bookings": Bookings,
    "Customers": Customers,
    "Companies": Companies,
    "Invoices": Invoices,
    "Partners": Partners,
    "DmoFeeds": DmoFeeds,
    "Monitoring": Monitoring,
    "Reports": Reports,
    "IntegrationSettings": IntegrationSettings,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};