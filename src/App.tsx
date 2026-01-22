import { useEffect, useMemo, useRef, useState } from "react";
import type { PocketAdvance, Agent, Poc, BoloPoi } from "./types";
import { clearAdvance, loadAdvance, saveAdvance } from "./utils/storage";
import { exportElementToPdf } from "./utils/exportPdf";

// ✅ Put your logo here (adjust filename if needed)
import radenLogo from "./assets/raden-logo.png";

const APP_NAME = "Raden — The Pocket Advance Generator";
const APP_SHORT = "Raden";
const COPYRIGHT_OWNER = "Raden";
const YEAR = new Date().getFullYear();

const DISCLAIMER_SHORT =
  "Provided as-is. Verify all info. Do not include sensitive data. For planning support only.";

const DISCLAIMER_WEB =
  "Provided as-is for planning support. Always verify details, comply with policy/law, and avoid entering sensitive/regulated information. Data stays in your browser (local storage) unless you export a PDF.";

type TemplateKey =
  | "rst"
  | "travel"
  | "event"
  | "estate"
  | "venue_restaurant"
  | "location_generic";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const emptyAdvance: PocketAdvance = {
  detailName: "Detail / Operation Name",
  date: todayISO(),

  venueName: "Venue / Location Name",
  address: "Address",

  timeOn: "18:00",
  timeOff: "02:00",

  arrivalTime: "",
  departTime: "",

  // ✅ Alpha / Bravo drop points (pins/locations)
  alphaArrival: "",
  alphaDeparture: "",
  bravoArrival: "",
  bravoDeparture: "",

  teamLead: "Team Lead Name",
  agents: [{ name: "Agent 1", role: "Primary", phone: "" }],

  primaryComms: "Primary Comms",
  secondaryComms: "Secondary Comms",
  codeWords: "Code word(s)",

  erName: "Nearest ER",
  erAddress: "ER Address",
  erPhone: "",

  leName: "Nearest Sheriff / PD",
  leAddress: "PD Address",
  lePhone: "",

  pocs: [
    { name: "POC Name", roleOrg: "Role / Organization", phone: "", notes: "" },
  ],

  boloPois: [
    {
      type: "BOLO",
      subject: "Vehicle/Person",
      description: "",
      lastKnown: "",
      action: "",
    },
  ],

  notes: "",
};

const PRESETS: Record<TemplateKey, Partial<PocketAdvance>> = {
  rst: {
    detailName: "RST — Residential Security Detail",
    venueName: "Residence / Estate",
    address: "Property Address",
    primaryComms: "Primary (Radio/Channel)",
    secondaryComms: "Secondary (Phone/Backup)",
    codeWords: "Code Words / Phrases",
    notes:
      "Key gates/entries • Muster point • Fire suppression location • Medical kit location • Shift turnover notes",
  },
  travel: {
    detailName: "TRAVEL — Movement / Trip",
    venueName: "Hotel / Destination",
    address: "Address / Terminal",
    notes:
      "Flight/train details • Pickup plan • Rally points • Route alternates • Check-in times • Driver/vendor info",
  },
  event: {
    detailName: "EVENT — Public / Private Event",
    venueName: "Venue",
    address: "Venue Address",
    notes:
      "Ingress/egress plan • Backstage/green room • Credentialing • Crowd considerations • Emergency egress",
  },
  estate: {
    detailName: "ESTATE — Property Advance",
    venueName: "Estate / Property",
    address: "Property Address",
    notes:
      "Perimeter notes • Key access points • Camera locations • Safe room/medical • Neighbors/adjacent risks",
  },
  venue_restaurant: {
    detailName: "VENUE — Restaurant / Public Location",
    venueName: "Restaurant / Venue Name",
    address: "Street Address",
    notes:
      "Entry/exit points • Host stand contact • Reservation name/time • Preferred seating • Nearby parking/valet • Alternate exits",
  },
  location_generic: {
    detailName: "LOCATION — Generic Advance",
    venueName: "Location Name",
    address: "Address / Landmark / Cross streets",
    notes:
      "Purpose • Access points • Rally points • Parking • Primary risks • Contingencies",
  },
};

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setMatches(mq.matches);
    handler();
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [query]);
  return matches;
}

function sanitizeFilename(name: string) {
  return (name || `${APP_SHORT}-Pocket-Advance`)
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 80);
}

function getTemplateFromUrl(): TemplateKey | null {
  const params = new URLSearchParams(window.location.search);
  const t = (params.get("template") || "").toLowerCase();
  if (
    t === "rst" ||
    t === "travel" ||
    t === "event" ||
    t === "estate" ||
    t === "venue_restaurant" ||
    t === "location_generic"
  )
    return t as TemplateKey;
  return null;
}

function getRedactFromUrl(): boolean {
  const params = new URLSearchParams(window.location.search);
  return (params.get("redact") || "").toLowerCase() === "1";
}

function setUrlParams(next: {
  template?: TemplateKey | null;
  redact?: boolean;
}) {
  const params = new URLSearchParams(window.location.search);

  if (typeof next.template !== "undefined") {
    if (next.template) params.set("template", next.template);
    else params.delete("template");
  }

  if (typeof next.redact !== "undefined") {
    if (next.redact) params.set("redact", "1");
    else params.delete("redact");
  }

  const newUrl = `${window.location.pathname}${
    params.toString() ? "?" + params.toString() : ""
  }`;
  window.history.replaceState({}, "", newUrl);
}

function redactValue(
  v: string | undefined,
  on: boolean,
  replacement = "REDACTED"
) {
  if (!on) return v || "";
  return v && v.trim() ? replacement : "";
}

function pillStyle(active: boolean) {
  return {
    padding: "8px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    border: active
      ? "1px solid rgba(0,0,0,0.18)"
      : "1px solid rgba(255,255,255,0.12)",
    background: active ? "#fff" : "rgba(255,255,255,0.10)",
    color: active ? "#111" : "rgba(255,255,255,0.92)",
  } as const;
}

function lightButtonStyle() {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    color: "#111",
    cursor: "pointer",
    fontWeight: 900,
  } as const;
}

function darkButtonStyle() {
  return {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "black",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
  } as const;
}

export default function App() {
  const [data, setData] = useState<PocketAdvance>(() =>
    loadAdvance({ ...emptyAdvance, date: todayISO() })
  );
  const previewRef = useRef<HTMLDivElement>(null);

  const [template, setTemplate] = useState<TemplateKey | null>(() =>
    getTemplateFromUrl()
  );
  const [redactMode, setRedactMode] = useState<boolean>(() =>
    getRedactFromUrl()
  );
  const [fitOnePage, setFitOnePage] = useState<boolean>(true);

  const isNarrow = useMediaQuery("(max-width: 900px)");
  const isInputsStack = useMediaQuery("(max-width: 560px)");

  useEffect(() => saveAdvance(data), [data]);

  useEffect(() => {
    const t = getTemplateFromUrl();
    const r = getRedactFromUrl();
    setTemplate(t);
    setRedactMode(r);

    if (t) {
      const looksLikeDefault = (data.detailName || "").includes(
        "Detail / Operation Name"
      );
      if (looksLikeDefault) applyTemplate(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const header = useMemo(() => {
    const title = (data.detailName || "Pocket Advance").trim();
    const date = data.date ? new Date(data.date).toLocaleDateString() : "";
    return { title, date };
  }, [data.detailName, data.date]);

  function update<K extends keyof PocketAdvance>(
    key: K,
    value: PocketAdvance[K]
  ) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function applyTemplate(t: TemplateKey) {
    const patch = PRESETS[t];
    const merged: PocketAdvance = {
      ...emptyAdvance,
      date: todayISO(),
      ...patch,
      agents: data.agents?.length ? data.agents : emptyAdvance.agents,
      pocs: data.pocs?.length ? data.pocs : emptyAdvance.pocs,
      boloPois: data.boloPois?.length ? data.boloPois : emptyAdvance.boloPois,
    };
    setData(merged);
    setTemplate(t);
    setUrlParams({ template: t, redact: redactMode });
  }

  function updateAgent(idx: number, patch: Partial<Agent>) {
    setData((prev) => {
      const agents = prev.agents.slice();
      agents[idx] = { ...agents[idx], ...patch };
      return { ...prev, agents };
    });
  }
  function addAgent() {
    setData((prev) => ({
      ...prev,
      agents: [...prev.agents, { name: "", role: "", phone: "" }],
    }));
  }
  function removeAgent(idx: number) {
    setData((prev) => ({
      ...prev,
      agents: prev.agents.filter((_, i) => i !== idx),
    }));
  }

  function updatePoc(idx: number, patch: Partial<Poc>) {
    setData((prev) => {
      const pocs = prev.pocs.slice();
      pocs[idx] = { ...pocs[idx], ...patch };
      return { ...prev, pocs };
    });
  }
  function addPoc() {
    setData((prev) => ({
      ...prev,
      pocs: [...prev.pocs, { name: "", roleOrg: "", phone: "", notes: "" }],
    }));
  }
  function removePoc(idx: number) {
    setData((prev) => ({
      ...prev,
      pocs: prev.pocs.filter((_, i) => i !== idx),
    }));
  }

  function updateBoloPoi(idx: number, patch: Partial<BoloPoi>) {
    setData((prev) => {
      const boloPois = prev.boloPois.slice();
      boloPois[idx] = { ...boloPois[idx], ...patch };
      return { ...prev, boloPois };
    });
  }
  function addBolo(type: "BOLO" | "POI") {
    setData((prev) => ({
      ...prev,
      boloPois: [
        ...prev.boloPois,
        { type, subject: "", description: "", lastKnown: "", action: "" },
      ],
    }));
  }
  function removeBoloPoi(idx: number) {
    setData((prev) => ({
      ...prev,
      boloPois: prev.boloPois.filter((_, i) => i !== idx),
    }));
  }

  function handleNew() {
    clearAdvance();
    setTemplate(null);
    setUrlParams({ template: null, redact: redactMode });
    setData({ ...emptyAdvance, date: todayISO() });
  }

  async function handleCopyLink() {
    setUrlParams({ template, redact: redactMode });
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("Share link copied!");
    } catch {
      prompt("Copy this link:", window.location.href);
    }
  }

  function toggleRedaction() {
    setRedactMode((prev) => {
      const next = !prev;
      setUrlParams({ template, redact: next });
      return next;
    });
  }

  async function handleExport() {
    if (!previewRef.current) return;
    const live = previewRef.current;

    // ✅ Clone the preview so we never mutate the live DOM
    const clone = live.cloneNode(true) as HTMLDivElement;

    // Put clone off-screen
    const holder = document.createElement("div");
    holder.style.position = "fixed";
    holder.style.left = "-10000px";
    holder.style.top = "0";
    holder.style.width = "1000px";
    holder.style.background = "transparent";
    holder.style.zIndex = "999999";
    holder.appendChild(clone);
    document.body.appendChild(holder);

    try {
      if (fitOnePage) {
        const targetHeightPx = 1056; // ~ letter page inner height at 96dpi
        const h =
          clone.scrollHeight || clone.getBoundingClientRect().height || 1;
        const s = Math.min(1, Math.max(0.6, targetHeightPx / h));
        clone.style.transformOrigin = "top left";
        clone.style.transform = `scale(${s})`;

        const projectedHeight = h * s;
        clone.setAttribute(
          "data-compact-bolo",
          projectedHeight > 1080 ? "1" : "0"
        );
      } else {
        clone.setAttribute("data-compact-bolo", "0");
      }

      const file = `${sanitizeFilename(
        data.detailName || `${APP_SHORT}-Pocket-Advance`
      )}.pdf`;
      await exportElementToPdf(clone, file);
    } finally {
      document.body.removeChild(holder);
    }
  }

  const vVenue = redactValue(data.venueName, false);
  const vAddress = redactValue(data.address, redactMode);

  const vErAddress = redactValue(data.erAddress, redactMode);
  const vErPhone = redactValue(data.erPhone, redactMode);

  const vLeAddress = redactValue(data.leAddress, redactMode);
  const vLePhone = redactValue(data.lePhone, redactMode);

  const vAlphaArr = redactValue(data.alphaArrival, redactMode);
  const vAlphaDep = redactValue(data.alphaDeparture, redactMode);
  const vBravoArr = redactValue(data.bravoArrival, redactMode);
  const vBravoDep = redactValue(data.bravoDeparture, redactMode);

  // === FORM STYLES (prevents overlap) ===
  const formGrid = (cols: 1 | 2) =>
    ({
      display: "grid",
      gap: 10,
      gridTemplateColumns:
        cols === 2 && !isInputsStack ? "minmax(0,1fr) minmax(0,1fr)" : "1fr",
      alignItems: "stretch",
      minWidth: 0,
    } as const);

  const field = {
    display: "grid",
    gap: 6,
    minWidth: 0,
  } as const;

  const label = { fontSize: 12, fontWeight: 800, opacity: 0.8 } as const;

  const controlBase = {
    width: "100%",
    boxSizing: "border-box" as const,
    minWidth: 0,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    outline: "none",
    background: "rgba(255,255,255,0.06)",
    color: "inherit",
  };

  const controlSmall = { ...controlBase, padding: "8px 10px" };

  return (
    <div
      style={{
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
        height: "100vh",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(255,255,255,0.08), transparent 60%)," +
          "radial-gradient(900px 500px at 90% 10%, rgba(255,255,255,0.06), transparent 60%)," +
          "linear-gradient(180deg, #0b0b0c, #0a0a0b)",
        color: "rgba(255,255,255,0.92)",
      }}
    >
      {/* ✅ Stability CSS: single scroll container + remove blur + isolate painting */}
      <style>{`
        * { box-sizing: border-box; }
        input, select, textarea { box-sizing: border-box; }
        html, body, #root { height: 100%; }
        body { margin: 0; overflow: hidden; } /* ✅ ONE scroll container only */
        .appShell { height: 100%; display: flex; flex-direction: column; }
        .appScroll {
          flex: 1;
          overflow: auto;
          -webkit-overflow-scrolling: touch;
          contain: layout paint;      /* ✅ prevents repaint bleed */
          isolation: isolate;         /* ✅ prevents layer blending smear */
        }
        .panel {
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(0,0,0,0.28);
          border-radius: 16px;
        }
      `}</style>

      <div className="appShell">
        {/* Top bar (NO backdrop-filter blur — fixes mac GPU “smear”) */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "rgba(20,20,20,0.94)", // ✅ solid glass vibe, no blur
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "1600px",
              margin: "0 auto",
              padding: "14px 16px",
              display: "flex",
              gap: 10,
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <img
                src={radenLogo}
                alt="Raden logo"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  objectFit: "cover",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{APP_NAME}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  Web-first MVP • autosaves locally • shareable presets
                </div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button onClick={handleNew} style={lightButtonStyle()}>
                New
              </button>
              <button onClick={handleExport} style={darkButtonStyle()}>
                Export PDF
              </button>
              <button
                onClick={handleCopyLink}
                style={lightButtonStyle()}
                title="Copies a share link (template + redact)"
              >
                Copy Share Link
              </button>
              <button
                onClick={toggleRedaction}
                style={pillStyle(redactMode)}
                title="Hide phones/addresses/last-known in preview + export"
              >
                {redactMode ? "Redaction: ON" : "Redaction: OFF"}
              </button>
              <button
                onClick={() => setFitOnePage((p) => !p)}
                style={pillStyle(fitOnePage)}
                title="Auto-fit export to one page when possible"
              >
                {fitOnePage ? "1-Page Fit: ON" : "1-Page Fit: OFF"}
              </button>
            </div>
          </div>

          {/* Template bar */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div
              style={{
                width: "100%",
                maxWidth: "1600px",
                margin: "0 auto",
                padding: "10px 16px",
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900, opacity: 0.85 }}>
                Templates:
              </div>

              <button
                onClick={() => applyTemplate("rst")}
                style={pillStyle(template === "rst")}
              >
                RST
              </button>
              <button
                onClick={() => applyTemplate("travel")}
                style={pillStyle(template === "travel")}
              >
                Travel
              </button>
              <button
                onClick={() => applyTemplate("event")}
                style={pillStyle(template === "event")}
              >
                Event
              </button>
              <button
                onClick={() => applyTemplate("estate")}
                style={pillStyle(template === "estate")}
              >
                Estate
              </button>
              <button
                onClick={() => applyTemplate("venue_restaurant")}
                style={pillStyle(template === "venue_restaurant")}
              >
                Venue/Restaurant
              </button>
              <button
                onClick={() => applyTemplate("location_generic")}
                style={pillStyle(template === "location_generic")}
              >
                Location
              </button>

              <div style={{ fontSize: 12, opacity: 0.7, marginLeft: 8 }}>
                Share link includes <b>template</b> (and optional{" "}
                <b>redaction</b>).
              </div>
            </div>
          </div>
        </div>

        {/* ✅ SINGLE scroll container (prevents the “DOM smear / duplicate text” artifact) */}
        <div className="appScroll">
          <div
            style={{
              width: "100%",
              maxWidth: "1600px",
              margin: "0 auto",
              padding: 16,
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 16,
                alignItems: "start",
                gridTemplateColumns: isNarrow
                  ? "1fr"
                  : "minmax(320px, 440px) minmax(0, 1fr)",
              }}
            >
              {/* FORM */}
              <div className="panel" style={{ padding: 14 }}>
                <h2
                  style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 900 }}
                >
                  Inputs
                </h2>

                <div style={{ display: "grid", gap: 12 }}>
                  <div style={field}>
                    <div style={label}>Detail Name</div>
                    <input
                      style={controlBase}
                      value={data.detailName}
                      onChange={(e) => update("detailName", e.target.value)}
                    />
                  </div>

                  <div style={formGrid(2)}>
                    <div style={field}>
                      <div style={label}>Date</div>
                      <input
                        type="date"
                        style={controlBase}
                        value={data.date}
                        onChange={(e) => update("date", e.target.value)}
                      />
                    </div>
                    <div style={field}>
                      <div style={label}>Team Lead(AIC)</div>
                      <input
                        style={controlBase}
                        value={data.teamLead}
                        onChange={(e) => update("teamLead", e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={field}>
                    <div style={label}>Venue Name</div>
                    <input
                      style={controlBase}
                      value={data.venueName}
                      onChange={(e) => update("venueName", e.target.value)}
                    />
                  </div>

                  <div style={field}>
                    <div style={label}>Address</div>
                    <input
                      style={controlBase}
                      value={data.address}
                      onChange={(e) => update("address", e.target.value)}
                    />
                  </div>

                  <div style={formGrid(2)}>
                    <div style={field}>
                      <div style={label}>On Time</div>
                      <input
                        type="time"
                        style={controlBase}
                        value={data.timeOn}
                        onChange={(e) => update("timeOn", e.target.value)}
                      />
                    </div>
                    <div style={field}>
                      <div style={label}>Off Time</div>
                      <input
                        type="time"
                        style={controlBase}
                        value={data.timeOff}
                        onChange={(e) => update("timeOff", e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={formGrid(2)}>
                    <div style={field}>
                      <div style={label}>Arrival (optional)</div>
                      <input
                        type="time"
                        style={controlBase}
                        value={data.arrivalTime || ""}
                        onChange={(e) => update("arrivalTime", e.target.value)}
                      />
                    </div>
                    <div style={field}>
                      <div style={label}>Departure (optional)</div>
                      <input
                        type="time"
                        style={controlBase}
                        value={data.departTime || ""}
                        onChange={(e) => update("departTime", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* ✅ Drop Points */}
                  <div style={{ marginTop: 6 }}>
                    <div style={{ ...label, fontSize: 13 }}>
                      Drop Points (Pins / Locations)
                    </div>

                    <div style={{ display: "grid", gap: 10, marginTop: 6 }}>
                      <div style={formGrid(2)}>
                        <div style={field}>
                          <div style={label}>Alpha Arrival (Main)</div>
                          <input
                            style={controlBase}
                            placeholder="e.g., Gate A, Valet, GPS pin, cross-street"
                            value={data.alphaArrival || ""}
                            onChange={(e) =>
                              update("alphaArrival", e.target.value)
                            }
                          />
                        </div>
                        <div style={field}>
                          <div style={label}>Alpha Departure (Main)</div>
                          <input
                            style={controlBase}
                            placeholder="e.g., Loading bay, rear exit, GPS pin"
                            value={data.alphaDeparture || ""}
                            onChange={(e) =>
                              update("alphaDeparture", e.target.value)
                            }
                          />
                        </div>
                      </div>

                      <div style={formGrid(2)}>
                        <div style={field}>
                          <div style={label}>Bravo Arrival (Alt)</div>
                          <input
                            style={controlBase}
                            placeholder="e.g., Secondary entry, alternate curb, GPS pin"
                            value={data.bravoArrival || ""}
                            onChange={(e) =>
                              update("bravoArrival", e.target.value)
                            }
                          />
                        </div>
                        <div style={field}>
                          <div style={label}>Bravo Departure (Alt)</div>
                          <input
                            style={controlBase}
                            placeholder="e.g., Alternate route pickup, staging point"
                            value={data.bravoDeparture || ""}
                            onChange={(e) =>
                              update("bravoDeparture", e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Agents */}
                  <div style={{ marginTop: 4 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ ...label, fontSize: 13 }}>Agents</div>
                      <button
                        onClick={addAgent}
                        style={{
                          ...lightButtonStyle(),
                          padding: "8px 10px",
                          fontSize: 12,
                        }}
                      >
                        + Add
                      </button>
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      {data.agents.map((a, idx) => (
                        <div
                          key={idx}
                          style={{
                            border: "1px solid rgba(255,255,255,0.10)",
                            borderRadius: 12,
                            padding: 10,
                            background: "rgba(0,0,0,0.15)",
                          }}
                        >
                          <div style={formGrid(2)}>
                            <input
                              placeholder="Name"
                              style={controlSmall}
                              value={a.name}
                              onChange={(e) =>
                                updateAgent(idx, { name: e.target.value })
                              }
                            />
                            <input
                              placeholder="Role"
                              style={controlSmall}
                              value={a.role}
                              onChange={(e) =>
                                updateAgent(idx, { role: e.target.value })
                              }
                            />
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(0,1fr) auto",
                              gap: 8,
                              marginTop: 8,
                              alignItems: "stretch",
                              minWidth: 0,
                            }}
                          >
                            <input
                              placeholder="Phone (optional)"
                              style={controlSmall}
                              value={a.phone || ""}
                              onChange={(e) =>
                                updateAgent(idx, { phone: e.target.value })
                              }
                            />
                            <button
                              onClick={() => removeAgent(idx)}
                              style={{
                                ...lightButtonStyle(),
                                padding: "8px 10px",
                                fontSize: 12,
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Comms */}
                  <div style={{ marginTop: 4 }}>
                    <div style={{ ...label, fontSize: 13 }}>Comms</div>
                    <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                      <input
                        placeholder="Primary comms"
                        style={controlBase}
                        value={data.primaryComms || ""}
                        onChange={(e) => update("primaryComms", e.target.value)}
                      />
                      <input
                        placeholder="Secondary comms"
                        style={controlBase}
                        value={data.secondaryComms || ""}
                        onChange={(e) =>
                          update("secondaryComms", e.target.value)
                        }
                      />
                      <input
                        placeholder="Code Words / Challenge Phrases"
                        style={controlBase}
                        value={data.codeWords || ""}
                        onChange={(e) => update("codeWords", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Medical */}
                  <div style={{ marginTop: 4 }}>
                    <div style={{ ...label, fontSize: 13 }}>Medical</div>
                    <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                      <input
                        placeholder="Nearest ER name"
                        style={controlBase}
                        value={data.erName || ""}
                        onChange={(e) => update("erName", e.target.value)}
                      />
                      <input
                        placeholder="ER address"
                        style={controlBase}
                        value={data.erAddress || ""}
                        onChange={(e) => update("erAddress", e.target.value)}
                      />
                      <input
                        placeholder="ER phone (optional)"
                        style={controlBase}
                        value={data.erPhone || ""}
                        onChange={(e) => update("erPhone", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Law Enforcement */}
                  <div style={{ marginTop: 4 }}>
                    <div style={{ ...label, fontSize: 13 }}>
                      Nearest Sheriff / Police
                    </div>
                    <div style={{ display: "grid", gap: 8, marginTop: 6 }}>
                      <input
                        placeholder="Sheriff/PD name"
                        style={controlBase}
                        value={data.leName || ""}
                        onChange={(e) => update("leName", e.target.value)}
                      />
                      <input
                        placeholder="Sheriff/PD address"
                        style={controlBase}
                        value={data.leAddress || ""}
                        onChange={(e) => update("leAddress", e.target.value)}
                      />
                      <input
                        placeholder="Sheriff/PD phone (optional)"
                        style={controlBase}
                        value={data.lePhone || ""}
                        onChange={(e) => update("lePhone", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* POCs */}
                  <div style={{ marginTop: 4 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ ...label, fontSize: 13 }}>POCs</div>
                      <button
                        onClick={addPoc}
                        style={{
                          ...lightButtonStyle(),
                          padding: "8px 10px",
                          fontSize: 12,
                        }}
                      >
                        + Add
                      </button>
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      {data.pocs.map((p, idx) => (
                        <div
                          key={idx}
                          style={{
                            border: "1px solid rgba(255,255,255,0.10)",
                            borderRadius: 12,
                            padding: 10,
                            background: "rgba(0,0,0,0.15)",
                          }}
                        >
                          <div style={formGrid(2)}>
                            <input
                              placeholder="Name"
                              style={controlSmall}
                              value={p.name}
                              onChange={(e) =>
                                updatePoc(idx, { name: e.target.value })
                              }
                            />
                            <input
                              placeholder="Role / Org"
                              style={controlSmall}
                              value={p.roleOrg || ""}
                              onChange={(e) =>
                                updatePoc(idx, { roleOrg: e.target.value })
                              }
                            />
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "minmax(0,1fr) auto",
                              gap: 8,
                              marginTop: 8,
                              minWidth: 0,
                            }}
                          >
                            <input
                              placeholder="Phone (optional)"
                              style={controlSmall}
                              value={p.phone || ""}
                              onChange={(e) =>
                                updatePoc(idx, { phone: e.target.value })
                              }
                            />
                            <button
                              onClick={() => removePoc(idx)}
                              style={{
                                ...lightButtonStyle(),
                                padding: "8px 10px",
                                fontSize: 12,
                              }}
                            >
                              Remove
                            </button>
                          </div>

                          <textarea
                            placeholder="Notes (optional)"
                            style={{
                              ...controlSmall,
                              minHeight: 70,
                              resize: "vertical",
                              marginTop: 8,
                            }}
                            value={p.notes || ""}
                            onChange={(e) =>
                              updatePoc(idx, { notes: e.target.value })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* BOLOs / POIs */}
                  <div style={{ marginTop: 4 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <div style={{ ...label, fontSize: 13 }}>BOLOs / POIs</div>
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <button
                          onClick={() => addBolo("BOLO")}
                          style={{
                            ...lightButtonStyle(),
                            padding: "8px 10px",
                            fontSize: 12,
                          }}
                        >
                          + BOLO
                        </button>
                        <button
                          onClick={() => addBolo("POI")}
                          style={{
                            ...lightButtonStyle(),
                            padding: "8px 10px",
                            fontSize: 12,
                          }}
                        >
                          + POI
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 8 }}>
                      {data.boloPois.map((b, idx) => (
                        <div
                          key={idx}
                          style={{
                            border: "1px solid rgba(255,255,255,0.10)",
                            borderRadius: 12,
                            padding: 10,
                            background: "rgba(0,0,0,0.15)",
                          }}
                        >
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: isInputsStack
                                ? "1fr"
                                : "140px minmax(0,1fr)",
                              gap: 8,
                              minWidth: 0,
                            }}
                          >
                            <select
                              style={controlSmall}
                              value={b.type}
                              onChange={(e) =>
                                updateBoloPoi(idx, {
                                  type: e.target.value as "BOLO" | "POI",
                                })
                              }
                            >
                              <option value="BOLO">BOLO</option>
                              <option value="POI">POI</option>
                            </select>
                            <input
                              placeholder="Subject (person/vehicle/topic)"
                              style={controlSmall}
                              value={b.subject}
                              onChange={(e) =>
                                updateBoloPoi(idx, { subject: e.target.value })
                              }
                            />
                          </div>

                          <textarea
                            placeholder="Description (optional)"
                            style={{
                              ...controlSmall,
                              minHeight: 70,
                              resize: "vertical",
                              marginTop: 8,
                            }}
                            value={b.description || ""}
                            onChange={(e) =>
                              updateBoloPoi(idx, {
                                description: e.target.value,
                              })
                            }
                          />

                          <div style={formGrid(2)}>
                            <input
                              placeholder="Last known (optional)"
                              style={controlSmall}
                              value={b.lastKnown || ""}
                              onChange={(e) =>
                                updateBoloPoi(idx, {
                                  lastKnown: e.target.value,
                                })
                              }
                            />
                            <input
                              placeholder="Action (optional)"
                              style={controlSmall}
                              value={b.action || ""}
                              onChange={(e) =>
                                updateBoloPoi(idx, { action: e.target.value })
                              }
                            />
                          </div>

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "flex-end",
                              marginTop: 8,
                            }}
                          >
                            <button
                              onClick={() => removeBoloPoi(idx)}
                              style={{
                                ...lightButtonStyle(),
                                padding: "8px 10px",
                                fontSize: 12,
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div style={{ marginTop: 4 }}>
                    <div style={{ ...label, fontSize: 13 }}>Notes</div>
                    <textarea
                      style={{
                        ...controlBase,
                        minHeight: 110,
                        resize: "vertical",
                      }}
                      value={data.notes || ""}
                      onChange={(e) => update("notes", e.target.value)}
                      placeholder="Anything important for the team..."
                    />
                  </div>
                </div>
              </div>

              {/* PREVIEW */}
              <div className="panel" style={{ padding: 14 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 900 }}>Preview</div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>
                    Exports to PDF {fitOnePage ? "(auto 1-page fit on)" : ""}
                  </div>
                </div>

                <div style={{ height: 10 }} />

                <div style={{ display: "flex", justifyContent: "center" }}>
                  <div
                    ref={previewRef}
                    data-compact-bolo="0"
                    style={{
                      width: "min(860px, 100%)",
                      background: "white",
                      color: "black",
                      border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 16,
                      padding: 18,
                      // ✅ Lighter shadow reduces GPU stress in scroll
                      boxShadow: "0 8px 18px rgba(0,0,0,0.10)",
                      contain: "paint", // ✅ preview paints in its own box
                    }}
                  >
                    <style>{`
                      [data-compact-bolo="1"] .boloDesc {
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                        overflow: hidden;
                      }
                      [data-compact-bolo="1"] .boloRow { margin-bottom: 6px !important; }
                      [data-compact-bolo="1"] .boloSmall { font-size: 10px !important; }
                    `}</style>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 900,
                            lineHeight: 1.1,
                          }}
                        >
                          {header.title}
                        </div>
                        <div
                          style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}
                        >
                          {vVenue} • {vAddress || "—"}
                        </div>
                        <div
                          style={{ marginTop: 6, fontSize: 10, opacity: 0.6 }}
                        >
                          Generated with {APP_NAME}
                          {redactMode ? " • Redaction enabled" : ""}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontWeight: 900 }}>
                          DATE
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          {header.date}
                        </div>
                        <div style={{ height: 8 }} />
                        <div style={{ fontSize: 12, fontWeight: 900 }}>
                          SHIFT
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          ON {data.timeOn} • OFF {data.timeOff}
                        </div>
                      </div>
                    </div>

                    <div style={{ height: 14 }} />

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 14,
                      }}
                    >
                      <section
                        style={{
                          border: "1px solid rgba(0,0,0,0.10)",
                          borderRadius: 14,
                          padding: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 900,
                            marginBottom: 8,
                          }}
                        >
                          TEAM
                        </div>
                        <div style={{ fontSize: 12 }}>
                          <div>
                            <span style={{ fontWeight: 800 }}>Lead (AIC):</span>{" "}
                            <span style={{ opacity: 0.85 }}>
                              {data.teamLead}
                            </span>
                          </div>

                          <div style={{ height: 8 }} />
                          <div style={{ fontWeight: 800, marginBottom: 6 }}>
                            Agents
                          </div>

                          <div style={{ display: "grid", gap: 6 }}>
                            {data.agents.length === 0 ? (
                              <div style={{ opacity: 0.7 }}>
                                No agents listed.
                              </div>
                            ) : (
                              data.agents.map((a, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    gap: 10,
                                  }}
                                >
                                  <div style={{ minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontWeight: 800,
                                        whiteSpace: "nowrap",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      }}
                                    >
                                      {a.name || "—"}
                                    </div>
                                    <div
                                      style={{ fontSize: 11, opacity: 0.75 }}
                                    >
                                      {a.role || "Role"}
                                    </div>
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      opacity: 0.75,
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    {redactMode
                                      ? a.phone?.trim()
                                        ? "REDACTED"
                                        : ""
                                      : a.phone || ""}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </section>

                      <section
                        style={{
                          border: "1px solid rgba(0,0,0,0.10)",
                          borderRadius: 14,
                          padding: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 900,
                            marginBottom: 8,
                          }}
                        >
                          COMMS
                        </div>
                        <div style={{ fontSize: 12, display: "grid", gap: 8 }}>
                          <div>
                            <div style={{ fontWeight: 800 }}>Primary</div>
                            <div style={{ opacity: 0.85 }}>
                              {data.primaryComms || "—"}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 800 }}>Secondary</div>
                            <div style={{ opacity: 0.85 }}>
                              {data.secondaryComms || "—"}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontWeight: 800 }}>Code Words</div>
                            <div style={{ opacity: 0.85 }}>
                              {data.codeWords || "—"}
                            </div>
                          </div>
                        </div>
                      </section>

                      <section
                        style={{
                          border: "1px solid rgba(0,0,0,0.10)",
                          borderRadius: 14,
                          padding: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 900,
                            marginBottom: 8,
                          }}
                        >
                          MOVEMENT
                        </div>

                        <div style={{ fontSize: 12, display: "grid", gap: 10 }}>
                          <div style={{ display: "flex", gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 800 }}>Arrival</div>
                              <div style={{ opacity: 0.85 }}>
                                {data.arrivalTime || "—"}
                              </div>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 800 }}>Departure</div>
                              <div style={{ opacity: 0.85 }}>
                                {data.departTime || "—"}
                              </div>
                            </div>
                          </div>

                          <div
                            style={{
                              borderTop: "1px solid rgba(0,0,0,0.08)",
                              paddingTop: 10,
                            }}
                          >
                            <div style={{ fontWeight: 900, marginBottom: 6 }}>
                              Drop Points
                            </div>

                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 10,
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 800 }}>
                                  Alpha (Main)
                                </div>
                                <div style={{ fontSize: 11, opacity: 0.8 }}>
                                  <span style={{ fontWeight: 900 }}>Arr:</span>{" "}
                                  {vAlphaArr?.trim() ? vAlphaArr : "—"}
                                </div>
                                <div style={{ fontSize: 11, opacity: 0.8 }}>
                                  <span style={{ fontWeight: 900 }}>Dep:</span>{" "}
                                  {vAlphaDep?.trim() ? vAlphaDep : "—"}
                                </div>
                              </div>

                              <div>
                                <div style={{ fontWeight: 800 }}>
                                  Bravo (Alt)
                                </div>
                                <div style={{ fontSize: 11, opacity: 0.8 }}>
                                  <span style={{ fontWeight: 900 }}>Arr:</span>{" "}
                                  {vBravoArr?.trim() ? vBravoArr : "—"}
                                </div>
                                <div style={{ fontSize: 11, opacity: 0.8 }}>
                                  <span style={{ fontWeight: 900 }}>Dep:</span>{" "}
                                  {vBravoDep?.trim() ? vBravoDep : "—"}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div style={{ opacity: 0.7, fontSize: 11 }}>
                            (Pins can be cross-streets, landmarks, or GPS pins.
                            Keep it brief for 1-page export.)
                          </div>
                        </div>
                      </section>

                      <section
                        style={{
                          border: "1px solid rgba(0,0,0,0.10)",
                          borderRadius: 14,
                          padding: 12,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 900,
                            marginBottom: 8,
                          }}
                        >
                          MEDICAL / LE
                        </div>
                        <div style={{ display: "grid", gap: 10, fontSize: 12 }}>
                          <div>
                            <div style={{ fontWeight: 900 }}>Nearest ER</div>
                            <div style={{ fontWeight: 800 }}>
                              {data.erName || "—"}
                            </div>
                            <div style={{ opacity: 0.85 }}>
                              {vErAddress || ""}
                            </div>
                            <div style={{ opacity: 0.85 }}>
                              {vErPhone || ""}
                            </div>
                          </div>

                          <div
                            style={{
                              borderTop: "1px solid rgba(0,0,0,0.08)",
                              paddingTop: 10,
                            }}
                          >
                            <div style={{ fontWeight: 900 }}>
                              Nearest Sheriff / PD
                            </div>
                            <div style={{ fontWeight: 800 }}>
                              {data.leName || "—"}
                            </div>
                            <div style={{ opacity: 0.85 }}>
                              {vLeAddress || ""}
                            </div>
                            <div style={{ opacity: 0.85 }}>
                              {vLePhone || ""}
                            </div>
                          </div>
                        </div>
                      </section>
                    </div>

                    <div style={{ height: 14 }} />
                    <section
                      style={{
                        border: "1px solid rgba(0,0,0,0.10)",
                        borderRadius: 14,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          marginBottom: 8,
                        }}
                      >
                        POCS
                      </div>
                      {data.pocs.length === 0 ? (
                        <div style={{ fontSize: 12, opacity: 0.7 }}>—</div>
                      ) : (
                        <div style={{ display: "grid", gap: 8 }}>
                          {data.pocs.map((p, idx) => (
                            <div key={idx} style={{ fontSize: 12 }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 10,
                                }}
                              >
                                <div style={{ minWidth: 0 }}>
                                  <div
                                    style={{
                                      fontWeight: 900,
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {p.name || "—"}
                                  </div>
                                  <div style={{ fontSize: 11, opacity: 0.75 }}>
                                    {p.roleOrg || ""}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    opacity: 0.75,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {redactMode
                                    ? p.phone?.trim()
                                      ? "REDACTED"
                                      : ""
                                    : p.phone || ""}
                                </div>
                              </div>
                              {p.notes?.trim() ? (
                                <div
                                  style={{
                                    marginTop: 4,
                                    fontSize: 11,
                                    opacity: 0.85,
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  {p.notes}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <div style={{ height: 14 }} />
                    <section
                      style={{
                        border: "1px solid rgba(0,0,0,0.10)",
                        borderRadius: 14,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          marginBottom: 8,
                        }}
                      >
                        BOLOS / POIS
                      </div>
                      {data.boloPois.length === 0 ? (
                        <div style={{ fontSize: 12, opacity: 0.7 }}>—</div>
                      ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                          {data.boloPois.map((b, idx) => (
                            <div
                              key={idx}
                              className="boloRow"
                              style={{ fontSize: 12 }}
                            >
                              <div style={{ fontWeight: 900 }}>
                                {b.type}{" "}
                                <span style={{ fontWeight: 800 }}>
                                  {b.subject?.trim() ? b.subject : "—"}
                                </span>
                              </div>

                              {b.description?.trim() ? (
                                <div
                                  className="boloDesc"
                                  style={{
                                    marginTop: 4,
                                    opacity: 0.9,
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  {b.description}
                                </div>
                              ) : null}

                              <div
                                className="boloSmall"
                                style={{
                                  marginTop: 4,
                                  display: "grid",
                                  gap: 4,
                                }}
                              >
                                {b.lastKnown?.trim() ? (
                                  <div style={{ fontSize: 11, opacity: 0.8 }}>
                                    <span style={{ fontWeight: 900 }}>
                                      Last Known:
                                    </span>{" "}
                                    {redactMode ? "REDACTED" : b.lastKnown}
                                  </div>
                                ) : null}
                                {b.action?.trim() ? (
                                  <div style={{ fontSize: 11, opacity: 0.8 }}>
                                    <span style={{ fontWeight: 900 }}>
                                      Action:
                                    </span>{" "}
                                    {b.action}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    <div style={{ height: 14 }} />
                    <section
                      style={{
                        border: "1px solid rgba(0,0,0,0.10)",
                        borderRadius: 14,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          marginBottom: 8,
                        }}
                      >
                        NOTES
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          whiteSpace: "pre-wrap",
                          opacity: 0.9,
                        }}
                      >
                        {data.notes?.trim() ? data.notes : "—"}
                      </div>
                    </section>

                    <div
                      style={{
                        marginTop: 12,
                        fontSize: 10,
                        opacity: 0.6,
                        display: "grid",
                        gap: 4,
                      }}
                    >
                      <div>
                        © {YEAR} {COPYRIGHT_OWNER}. Generated by {APP_NAME}.
                      </div>
                      <div>{DISCLAIMER_SHORT}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="panel"
              style={{
                marginTop: 14,
                padding: 12,
                fontSize: 12,
                opacity: 0.85,
                background: "rgba(0,0,0,0.22)",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                {APP_SHORT} Notice
              </div>
              <div style={{ lineHeight: 1.5 }}>{DISCLAIMER_WEB}</div>
              <div style={{ marginTop: 8, fontSize: 11, opacity: 0.75 }}>
                © {YEAR} {COPYRIGHT_OWNER}. All rights reserved.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
