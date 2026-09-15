import type { SourceRecord } from "../types.js";
import { AdzunaAdapter } from "./adzuna.js";
import { ArbeitnowAdapter } from "./arbeitnow.js";
import { AshbySourceAdapter } from "./ashby.js";
import { HimalayasAdapter } from "./himalayas.js";
import { JobicyAdapter } from "./jobicy.js";
import { MuseAdapter } from "./themuse.js";
import { RemotiveAdapter } from "./remotive.js";
import { RemoteOkAdapter } from "./remoteok.js";
import type { SourceAdapter } from "./types.js";
import { WeWorkRemotelyAdapter } from "./weworkremotely.js";

const adapters: Record<string, () => SourceAdapter> = {
  ashby: () => new AshbySourceAdapter(),
  remotive: () => new RemotiveAdapter(),
  remoteok: () => new RemoteOkAdapter(),
  jobicy: () => new JobicyAdapter(),
  arbeitnow: () => new ArbeitnowAdapter(),
  himalayas: () => new HimalayasAdapter(),
  weworkremotely: () => new WeWorkRemotelyAdapter(),
  themuse: () => new MuseAdapter(),
  adzuna: () => new AdzunaAdapter(),
};

export function getAdapterForSource(source: SourceRecord): SourceAdapter {
  const factory = adapters[source.ats_type];
  if (!factory) {
    throw new Error(`No adapter registered for ats_type=${source.ats_type}`);
  }
  return factory();
}

export function listRegisteredAtsTypes(): string[] {
  return Object.keys(adapters);
}
