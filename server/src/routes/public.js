import { Router } from 'express';
import {
  getStages, getFlowEdges, getTierLabels, getCountries, getCompanies,
  getCustomers, getOwners, getPolicies, getEvents, getScenarios, getDataNotes,
  getQuotes, buildBundle,
} from '../bundle.js';
import { quotesAreStale, quotesAsOf, refreshQuotesInBackground } from '../quotes.js';

export const publicRouter = Router();

publicRouter.get('/stages', (req, res) => res.json(getStages()));
publicRouter.get('/flow-edges', (req, res) => res.json(getFlowEdges()));
publicRouter.get('/tier-labels', (req, res) => res.json(getTierLabels()));
publicRouter.get('/countries', (req, res) => res.json(getCountries()));
publicRouter.get('/companies', (req, res) => res.json(getCompanies()));
publicRouter.get('/customers', (req, res) => res.json(getCustomers()));
publicRouter.get('/owners', (req, res) => res.json(getOwners()));
publicRouter.get('/policies', (req, res) => res.json(getPolicies()));
publicRouter.get('/events', (req, res) => res.json(getEvents()));
publicRouter.get('/scenarios', (req, res) => res.json(getScenarios()));
publicRouter.get('/data-notes', (req, res) => res.json(getDataNotes()));
/* Quotes are the one dataset that goes stale on its own — everything else
   changes only when the pipeline or an admin edit changes it. Against a live
   backend, a read older than STALE_AFTER_MS kicks off a background refresh and
   still answers immediately from the database; the next poll picks up the new
   values. `stale` lets the client show that honestly rather than implying the
   number is current. Pass ?refresh=0 to read without ever triggering a fetch. */
publicRouter.get('/quotes', (req, res) => {
  const stale = quotesAreStale();
  const refreshing = stale && req.query.refresh !== '0' ? refreshQuotesInBackground() : false;
  res.json({ quotes: getQuotes(), asOf: quotesAsOf(), stale, refreshing });
});

/* Single-fetch bundle — what the dashboard actually loads on startup. */
publicRouter.get('/bundle', (req, res) => {
  if (quotesAreStale()) refreshQuotesInBackground();
  res.json(buildBundle());
});
