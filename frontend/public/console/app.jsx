// AI Calling Agent Console — real API wiring over the Orbital Console UI

// ─── Static seed data used by HistoryDetail / AnalyticsScreen ───────
window.MockData = window.MockData || {
  channelHourly: [3,2,4,8,14,28,42,56,61,68,72,88,92,78,66,54,48,62,71,58,44,30,18,11],
  transcript: [
    { t:'0:00', who:'agent', text:"Hello! How can I help you today?" },
    { t:'0:06', who:'caller', text:"I'd like to learn more about your service." },
    { t:'0:12', who:'agent', text:"Great! I'd be happy to walk you through everything. What's your main use case?" },
    { t:'0:22', who:'caller', text:"We're looking at automating our support calls." },
    { t:'0:28', who:'agent', text:"Perfect. This system handles that end-to-end — STT, LLM, TTS, all under 400ms." },
  ],
};

// Fallback for window.claude.complete (CallRoomScreen AI summary button)
window.claude = window.claude || {
  complete: async () => '• Intent: Gathering information\n• Objections: None raised yet\n• Commitments: None yet\n• Confidence: — (transcript too short)',
};

// Language code → BCP-47 for the backend
const LANG_CODES = {
  'English':'en','Hindi':'hi','Arabic':'ar','Spanish':'es',
  'French':'fr','Portuguese':'pt','German':'de','Japanese':'ja',
  'Korean':'ko','Chinese':'zh','Russian':'ru','Dutch':'nl','Swedish':'sv',
};

// ─── Agent persistence (localStorage) ────────────────────────────────
const DEFAULT_AGENTS = [{
  id: 'agt_default',
  name: 'AI Assistant',
  persona: 'You are a professional AI calling agent. Be natural, friendly, and concise. Listen carefully and respond conversationally. Keep responses short unless asked to elaborate.',
  greeting: "Hello! I'm your AI assistant. How can I help you today?",
  channels: ['web'],
  video: false,
  lang_in: 'English',
  lang_out: 'English',
  voice: 'Cartesia · Aria (en-US)',
  script: '',
  temperature: 0.7,
  maxTurns: 40,
  calls: 0,
  lastUsed: 'Never',
  status: 'active',
}];

function loadAgents() {
  try {
    const s = localStorage.getItem('console-agents');
    if (s) { const a = JSON.parse(s); if (Array.isArray(a) && a.length > 0) return a; }
  } catch(e) {}
  try { localStorage.setItem('console-agents', JSON.stringify(DEFAULT_AGENTS)); } catch(e) {}
  return DEFAULT_AGENTS;
}
function saveAgents(agents) {
  try { localStorage.setItem('console-agents', JSON.stringify(agents)); } catch(e) {}
}

// ─── Map backend CallRecord → console activeCalls shape ──────────────
function toConsoleCall(rec) {
  const d = new Date((rec.created_at || 0) * 1000);
  const hh = d.getHours().toString().padStart(2,'0');
  const mm = d.getMinutes().toString().padStart(2,'0');
  const duration = Math.max(0, Math.floor(Date.now()/1000 - (rec.created_at || 0)));
  const ch = rec.call_type === 'phone' ? 'phone' : rec.call_type === 'whatsapp' ? 'whatsapp' : 'web';
  const caller = rec.phone_number || rec.whatsapp_number || 'web-link';
  const callerName = rec.phone_number || rec.whatsapp_number || 'Web caller';
  const connecting = rec.status === 'created' || rec.status === 'calling' || rec.status === 'invite_sent';
  const srcLang = rec.source_lang || 'en';
  const tgtLang = rec.target_lang || 'en';
  const langLabel = srcLang === tgtLang ? 'English' : `${srcLang.toUpperCase()} → ${tgtLang.toUpperCase()}`;
  return {
    id: rec.room_name,
    agent: rec.agent_name || 'AI Assistant',
    agentId: '',
    caller,
    callerName,
    channel: ch,
    status: connecting ? 'connecting' : 'active',
    duration,
    started: `${hh}:${mm}`,
    sentiment: null,
    video: rec.video_enabled || false,
    language: langLabel,
    _roomUrl: rec.room_url || '',
  };
}

function fmtDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s.toString().padStart(2,'0')}s`;
}

// ─── Root App ─────────────────────────────────────────────────────────
function ConsoleApp() {
  const T = useC();
  const [route, setRoute]           = React.useState('live');
  const [subRoute, setSubRoute]     = React.useState(null);   // {screen, data}
  const [activeCalls, setActive]    = React.useState([]);
  const [history, setHistory]       = React.useState([]);
  const [agents, setAgents]         = React.useState(loadAgents);
  const [showNewCall, setShowNew]   = React.useState(false);
  const [shareCall, setShareCall]   = React.useState(null);
  const [preAgent, setPreAgent]     = React.useState(null);
  const [theme, setTheme]           = React.useState(window.__consoleTheme || 'light');

  // ── Poll GET /api/calls every 2 s ────────────────────────────────
  React.useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch('/api/calls');
        if (!r.ok) return;
        const data = await r.json();
        if (alive) setActive((Array.isArray(data) ? data : []).map(toConsoleCall));
      } catch(e) {}
    };
    poll();
    const tid = setInterval(poll, 2000);
    return () => { alive = false; clearInterval(tid); };
  }, []);

  // ── Re-render when theme changes (tokens live on window.ConsoleTokens) ──
  React.useEffect(() => {
    const h = e => setTheme(e.detail);
    window.addEventListener('consoletheme', h);
    return () => window.removeEventListener('consoletheme', h);
  }, []);

  // ── Agent CRUD ────────────────────────────────────────────────────
  const handleSaveAgent = (form) => {
    setAgents(prev => {
      const idx = prev.findIndex(a => a.id === form.id);
      let next;
      if (idx >= 0) {
        next = prev.map((a,i) => i === idx ? {...a, ...form} : a);
      } else {
        next = [...prev, {
          ...form,
          id: `agt_${Date.now().toString(36)}`,
          calls: 0, lastUsed: 'Never', status: 'active',
        }];
      }
      saveAgents(next);
      return next;
    });
    setSubRoute(null);
    setRoute('agents');
  };

  const handleDeleteAgent = (id) => {
    setAgents(prev => { const n = prev.filter(a => a.id !== id); saveAgents(n); return n; });
  };

  // ── Call actions ─────────────────────────────────────────────────
  const handleLaunch = async (agent, channel, to, { agenda, prompt }) => {
    setShowNew(false);
    const fullPrompt = (prompt || agent.persona || 'You are a helpful AI assistant.')
      + (agenda ? '\n\nMeeting agenda:\n' + agenda : '');
    const body = {
      call_type: channel,
      agent_name: agent.name,
      prompt: fullPrompt,
      presentation_script: agent.script || '',
      greeting: agent.greeting || '',
      video_enabled: !!(agent.video && channel === 'web'),
      source_lang: LANG_CODES[agent.lang_in] || 'en',
      target_lang: LANG_CODES[agent.lang_out] || 'en',
      ...(channel === 'phone'     ? { phone_number:    to } : {}),
      ...(channel === 'whatsapp'  ? { whatsapp_number: to } : {}),
    };
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const rec = await res.json();
        setActive(prev => prev.find(c => c.id === rec.room_name) ? prev : [...prev, toConsoleCall(rec)]);
        setRoute('live');
        if (channel === 'web' && rec.room_url) window.open(rec.room_url, '_blank');
      } else {
        const err = await res.json().catch(() => ({ detail: 'unknown error' }));
        alert('Launch failed: ' + (err.detail || res.status));
      }
    } catch(e) { alert('Network error: ' + e.message); }
  };

  const handleEndCall = async (call) => {
    try { await fetch(`/api/calls/${call.id}`, { method: 'DELETE' }); } catch(e) {}
    setActive(prev => prev.filter(c => c.id !== call.id));
    setHistory(prev => [{
      id: call.id, agent: call.agent, caller: call.caller,
      channel: call.channel, date: 'Just now',
      duration: fmtDuration(call.duration), outcome: 'Ended', sentiment: 'neutral',
    }, ...prev]);
    if (subRoute?.data?.id === call.id) setSubRoute(null);
  };

  const handleOpenRoom  = (call) => window.open(`/room/${call.id}`, '_blank');
  const handleJoin      = (call, mode) => {
    if (mode === 'share') setShareCall(call);
    else setSubRoute({ screen: 'callroom', data: call });
  };

  // ── Sub-routes (full-screen overlays) ────────────────────────────
  if (subRoute?.screen === 'callroom') {
    return (
      <div key={theme} style={{ height:'100vh', display:'flex', flexDirection:'column', background:T.bg, overflow:'hidden' }}>
        <CallRoomScreen
          call={subRoute.data}
          transcript={window.MockData.transcript}
          onBack={() => setSubRoute(null)}
          onShare={c => setShareCall(c)}
          onEnd={c => { handleEndCall(c); setSubRoute(null); }}
        />
        {shareCall && <ShareModal call={shareCall} onClose={() => setShareCall(null)}/>}
      </div>
    );
  }

  if (subRoute?.screen === 'agent-builder') {
    return (
      <div key={theme} style={{ height:'100vh', display:'flex', flexDirection:'column', background:T.bg, overflow:'hidden' }}>
        <AgentBuilderScreen
          agent={subRoute.data}
          onBack={() => setSubRoute(null)}
          onSave={handleSaveAgent}
        />
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────────
  const counts = { live: activeCalls.length };

  return (
    <div key={theme} style={{ height:'100vh', display:'flex', background:T.bg, overflow:'hidden', fontFamily:T.sans }}>
      <Sidebar
        route={route}
        setRoute={r => { setRoute(r); setSubRoute(null); }}
        counts={counts}
      />

      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        {route === 'live' && (
          <LiveCallsScreen
            calls={activeCalls}
            onOpen={handleOpenRoom}
            onJoin={handleJoin}
            onEnd={handleEndCall}
            onNewCall={() => { setPreAgent(null); setShowNew(true); }}
          />
        )}
        {route === 'agents' && (
          <AgentsScreen
            agents={agents}
            onCreate={() => setSubRoute({ screen:'agent-builder', data:null })}
            onOpen={a => setSubRoute({ screen:'agent-builder', data:a })}
            onLaunch={a => { setPreAgent(a); setShowNew(true); }}
          />
        )}
        {route === 'history'   && <HistoryScreen history={history} onOpen={() => {}}/>}
        {route === 'analytics' && <AnalyticsScreen/>}
        {route === 'settings'  && <SettingsScreen/>}
      </main>

      {showNewCall && (
        <NewCallModal
          agents={agents.length > 0 ? agents : DEFAULT_AGENTS}
          onClose={() => setShowNew(false)}
          onLaunch={handleLaunch}
        />
      )}
      {shareCall && <ShareModal call={shareCall} onClose={() => setShareCall(null)}/>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ConsoleApp/>);
