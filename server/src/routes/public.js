import { Router } from 'express';
import {
  getStages, getFlowEdges, getTierLabels, getCountries, getCompanies,
  getCustomers, getOwners, getPolicies, getEvents, getScenarios, getDataNotes,
  getQuotes, buildBundle,
} from '../bundle.js';

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
publicRouter.get('/quotes', (req, res) => res.json(getQuotes()));

/* Single-fetch bundle — what the dashboard actually loads on startup. */
publicRouter.get('/bundle', (req, res) => res.json(buildBundle()));
