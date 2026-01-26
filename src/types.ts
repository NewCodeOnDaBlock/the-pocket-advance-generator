export type Agent = {
  name: string;
  role: string;
  phone?: string;
};

export type Poc = {
  name: string;
  roleOrg?: string;
  phone?: string;
  notes?: string;
};

export type BoloPoi = {
  type: "BOLO" | "POI";
  subject: string; // person/vehicle/topic
  description?: string; // details
  lastKnown?: string; // last known location/time
  action?: string; // what to do if seen
};

export type PocketAdvance = {
  detailName: string;
  date: string;

  venueName: string;
  address: string;

  timeOn: string;
  timeOff: string;

  arrivalTime?: string;
  departTime?: string;

  alphaArrival: string;
  alphaDeparture: string;
  bravoArrival: string;
  bravoDeparture: string;

  teamLead: string;
  agents: Agent[];

  primaryComms?: string;
  secondaryComms?: string;
  codeWords?: string;

  // Medical
  erName?: string;
  erAddress?: string;
  erPhone?: string;

  // Law enforcement
  leName?: string; // Sheriff/PD
  leAddress?: string;
  lePhone?: string;

  // Points of contact
  pocs: Poc[];

  // BOLO/POI list
  boloPois: BoloPoi[];

  notes?: string;
};
