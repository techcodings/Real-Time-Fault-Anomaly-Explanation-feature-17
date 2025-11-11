import React from "react";
import { createRoot } from "react-dom/client";
import KPI from "./components/KPI";
import { callFn } from "./api";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ResponsiveContainer
} from "recharts";

// Reusable async hook
function useAsync(d = null) {
  const [data, setData] = React.useState(d);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState(null);
  return {
    data, loading, err,
    async run(promise) {
      try {
        setLoading(true); setErr(null);
        const res = await promise;
        setData(res);
      } catch (e) { setErr(e.message || String(e)); }
      finally { setLoading(false); }
    }
  };
}

const App = () => {
  const [events, setEvents] = React.useState([
    { id: "E-101", metrics: { temp: 58, voltage: 3.2, current: 2.8, vibration: 0.5, humidity: 65 } },
    { id: "E-102", metrics: { temp: 42, voltage: 3.55, current: 1.0, vibration: 0.3, humidity: 40 } },
  ]);

  const [batch, setBatch] = React.useState(
    Array.from({ length: 60 }, () => ({
      temp: 35 + Math.random() * 30,
      voltage: 3.3 + Math.random() * 0.6,
      current: 0.5 + Math.random() * 3,
      vibration: Math.random(),
    }))
  );

  const exp = useAsync(), rt = useAsync(), root = useAsync();

  // Calculate critical events
  const critical = events.filter(e => e.metrics.temp > 55 && e.metrics.current > 2).length;

  // Update metric
  const updateMetric = (i, key, val) => {
    const next = [...events];
    next[i] = { ...next[i], metrics: { ...next[i].metrics, [key]: +val } };
    setEvents(next);
  };

  // Add / Remove event
  const addEvent = () =>
    setEvents([...events, { id: `E-${events.length + 1}`, metrics: { temp: 40, voltage: 3.5, current: 1.2, vibration: 0.2, humidity: 45 } }]);
  const removeEvent = (i) => setEvents(events.filter((_, k) => k !== i));

  // Highlight anomalies
  const anomalyStyle = (m) => {
    if (m.temp > 60 || m.current > 3) return { border: "1px solid #ff6060", background: "rgba(255,60,60,.1)" };
    if (m.temp > 50 || m.current > 2) return { border: "1px solid #ffcc33", background: "rgba(255,230,100,.08)" };
    return {};
  };

  return (
    <div className="wrap fade-in">

      {/* ✅ Back to Home Button */}
      <div className="btn-back-container">
        <a href="https://energy-verse-portal.netlify.app/?feature=17" className="btn-back-scroll">
          ← Back to Home
        </a>
      </div>

      {/* Header */}
      <div className="title">
        <div>
          <h1>Real-time Fault / Anomaly — Dashboard</h1>
          <div className="sub">Explain anomalies, aggregate sensor windows, and map root causes.</div>
        </div>
        <div className="toolbar">
          <button onClick={() => exp.run(callFn("anomaly_explanation", { events }))}>Explain</button>
          <button onClick={() => rt.run(callFn("anomaly_realtime_stream", { batch }))}>Aggregate</button>
          <button onClick={() => root.run(callFn("anomaly_rootcause", { events }))}>Root Causes</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpis">
        <KPI label="Events" value={events.length} />
        <KPI label="Batch Size" value={batch.length} />
        <KPI label="Heuristic Critical" value={critical} />
        <KPI label="Inputs Editable" value="Yes" hint="Adjust event metrics below" />
      </div>

      {/* Grid Layout */}
      <div className="grid" style={{ marginTop: 16 }}>
        {/* Left Column */}
        <div className="leftcol">
          <div className="card">
            <h3>Events</h3>
            <div className="scroll-area">
              {events.map((e, i) => (
                <div
                  key={i}
                  className="region-box"
                  style={{
                    ...anomalyStyle(e.metrics),
                    animationDelay: `${i * 0.08}s`,
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                    <input
                      value={e.id}
                      onChange={(ev) => {
                        const n = [...events];
                        n[i] = { ...n[i], id: ev.target.value };
                        setEvents(n);
                      }}
                      style={{ maxWidth: 140 }}
                    />
                    <button className="btn-danger" onClick={() => removeEvent(i)}>Remove</button>
                  </div>

                  {["temp", "voltage", "current", "vibration", "humidity"].map((k) => (
                    <div className="form-row" key={k}>
                      <div className="label" style={{ textTransform: "capitalize" }}>{k}</div>
                      <input
                        type="number"
                        step="0.01"
                        value={e.metrics[k]}
                        onChange={(ev) => updateMetric(i, k, ev.target.value)}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <button className="btn-soft" style={{ marginTop: 10 }} onClick={addEvent}>➕ Add Event</button>
          </div>
        </div>

        {/* Right Column */}
        <div className="rightcol">
          <div className="card col-span-12">
            <h3>Aggregate Window — Counts by Severity</h3>
            {rt.data ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={Object.entries(rt.data.counts).map(([k, v]) => ({ level: k, count: v }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="level" /><YAxis /><Tooltip /><Legend />
                  <Bar dataKey="count" fill="#caff37" />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="muted">Click Aggregate.</div>}
          </div>

          <div className="card col-span-6">
            <h3>Explanations</h3>
            {exp.data ? (
              <table>
                <thead>
                  <tr><th>ID</th><th>Severity</th><th>Top Feature</th></tr>
                </thead>
                <tbody>
                  {exp.data.explanations.map((x) => (
                    <tr key={x.id}>
                      <td>{x.id}</td>
                      <td>{x.severity}</td>
                      <td>{x.shap_like_contributions[0].feature}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="muted">Run Explain.</div>}
          </div>

          <div className="card col-span-6">
            <h3>Root Causes</h3>
            {root.data ? (
              <table>
                <thead><tr><th>ID</th><th>Cause</th></tr></thead>
                <tbody>
                  {root.data.root_causes.map((r) => (
                    <tr key={r.id}><td>{r.id}</td><td>{r.cause}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <div className="muted">Run Root Causes.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

createRoot(document.getElementById("root")).render(<App />);
