import { Router } from 'express';
import { getQuotes, buildBundle } from '../bundle.js';
import { quotesAreStale, quotesAsOf, refreshQuotesInBackground } from '../quotes.js';
import { publicBundle } from '../public-bundle.js';

export const publicRouter = Router();

for (const [path, key] of [['stages','stages'], ['flow-edges','flowEdges'], ['tier-labels','tierLabels'],
  ['countries','countries'], ['companies','companies'], ['customers','customers'], ['owners','owners'],
  ['policies','policies'], ['events','events'], ['scenarios','scenarios'], ['data-notes','dataNotes']]) {
  publicRouter.get('/' + path, (req, res) => res.json(publicBundle(buildBundle())[key]));
}
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

/* Briefing archive. The list is cheap; a body is fetched on demand, because
   ~6KB each would make the startup bundle grow with the archive. */
publicRouter.get('/briefings', (req, res) => res.json({ briefings: [] }));
publicRouter.get('/briefings/:date', (req, res) => {
  res.status(404).json({ error: 'Research briefings are not part of the reviewed operational API.' });
});

/* Single-fetch bundle — what the dashboard actually loads on startup. */
publicRouter.get('/bundle', (req, res) => {
  if (quotesAreStale()) refreshQuotesInBackground();
  res.json(publicBundle(buildBundle()));
});
