export type Agent = { name: string; role: string; phone?: string };

export type Poc = {
  name: string;
  roleOrg: string;
  phone?: string;
  notes?: string;
};

export type BoloPoi = {
  type: "BOLO" | "POI";
  subject: string;
  description?: string;
  lastKnown?: string;
  action?: string;
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

  alphaArrival?: string;
  alphaDeparture?: string;
  bravoArrival?: string;
  bravoDeparture?: string;

  teamLead: string;
  agents: Agent[];

  primaryComms?: string;
  secondaryComms?: string;
  codeWords?: string;

  erName?: string;
  erAddress?: string;
  erPhone?: string;

  leName?: string;
  leAddress?: string;
  lePhone?: string;

  pocs: Poc[];
  boloPois: BoloPoi[];

  // NEW: from Places Details
  placeId?: string;
  city?: string;
  state?: string;
  country?: string;
  lat?: number;
  lng?: number;

  notes?: string;
};
