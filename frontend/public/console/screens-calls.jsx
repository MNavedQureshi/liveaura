// Orbital Console — Live Calls + Call Room + Agents list screens

// ═══ LIVE WAVEFORM (animated bars) ═════════════════════════════════
function LiveWaveform({ bars = 24, color, active = true, height = 20 }) {
  const T = useC();
  const [seed, setSeed] = React.useState(0);
  React.useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setSeed(s => s + 1), 180);
    return () => clearInterval(t);
  }, [active]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height }}>
      {Array.from({ length: bars }).map((_, i) => {
        // Deterministic-ish pseudo-random amplitude per tick
        const base = Math.abs(Math.sin((i * 0.47 + seed * 0.3) * 1.3));
        const h = active ? 4 + base * (height - 4) : 2;
        return <span key={i} style={{
          width: 2, height: h, borderRadius: 1,
          background: color || T.primary,
          opacity: active ? 0.4 + base * 0.6 : 0.3,
          transition: 'height 180ms ease-out, opacity 180ms ease-out',
        }}/>;
      })}
    </div>
  );
}

// ═══ CHANNEL ICON ═════════════════════════════════════════════════
function ChannelIcon({ channel, size = 14, c }) {
  const T = useC();
  const color = c || T.ink3;
  if (channel === 'web') return <Ic.Globe size={size} c={color}/>;
  if (channel === 'phone') return <Ic.Phone size={size} c={color}/>;
  if (channel === 'whatsapp') return <Ic.Chat size={size} c={color}/>;
  return null;
}
function ChannelLabel({ channel }) {
  return ({ web: 'Web link', phone: 'Outbound SIP', whatsapp: 'WhatsApp' })[channel] || channel;
}

// ═══ DURATION TIMER ══════════════════════════════════════════════
function Duration({ seconds: initial, running = true }) {
  const [s, setS] = React.useState(initial || 0);
  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setS(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  const T = useC();
  return <span style={{ fontFamily: T.mono, fontSize: 12, color: T.ink }}>{mm}:{ss}</span>;
}

// ═══ LIVE CALL CARD ═══════════════════════════════════════════════
function LiveCallCard({ call, onOpen, onJoin, onEnd }) {
  const T = useC();
  const [hover, setHover] = React.useState(false);
  const isActive = call.status === 'active';
  const isConnecting = call.status === 'connecting';
  const sentimentColor = call.sentiment == null ? T.ink4 :
    call.sentiment > 0.5 ? T.green : call.sentiment < 0.2 ? T.red : T.ink3;

  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: T.surface,
        border: `1px solid ${hover ? T.borderHi : T.border}`,
        borderRadius: T.r5,
        boxShadow: hover ? T.shadow2 : T.shadow1,
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${T.borderSoft}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: T.r3,
          background: T.primarySoft, color: T.primary,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ChannelIcon channel={call.channel} size={15} c={T.primary}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 500, color: T.ink }}>{call.agent}</span>
            {call.video && <Chip tone="accent" icon={<Ic.Video size={10}/>} style={{ height: 18 }}>Video</Chip>}
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.ink3, marginTop: 1 }}>{call.id}</div>
        </div>
        {isActive && <Chip tone="live" dot>Live</Chip>}
        {isConnecting && <Chip tone="amber" dot>Connecting</Chip>}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 14px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 999,
            background: `linear-gradient(135deg, hsl(${(call.id.charCodeAt(10) * 23) % 360} 60% 62%), hsl(${(call.id.charCodeAt(11) * 31) % 360} 55% 50%))`,
            color: '#fff', fontSize: 10.5, fontWeight: 600, fontFamily: T.sans,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{(call.callerName || '??').split(' ').map(x=>x[0]).join('').slice(0,2)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{call.callerName}</div>
            <div style={{ fontFamily: T.sans, fontSize: 11, color: T.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{call.caller}</div>
          </div>
        </div>

        <div style={{
          padding: '10px 12px', borderRadius: T.r3,
          background: T.surfaceAlt, border: `1px solid ${T.borderSoft}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <LiveWaveform bars={18} active={isActive} color={T.primary} height={18}/>
          <Duration seconds={call.duration} running={isActive}/>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <div>
            <div style={{ fontFamily: T.sans, fontSize: 10.5, color: T.ink4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>Language</div>
            <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink2, marginTop: 2 }}>{call.language}</div>
          </div>
          <div>
            <div style={{ fontFamily: T.sans, fontSize: 10.5, color: T.ink4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>Sentiment</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <Ic.Dot size={6} c={sentimentColor}/>
              <span style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink2 }}>
                {call.sentiment == null ? 'Measuring…' :
                  call.sentiment > 0.5 ? 'Positive' : call.sentiment < 0.2 ? 'Negative' : 'Neutral'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 14px', borderTop: `1px solid ${T.borderSoft}`,
        display: 'flex', gap: 6, alignItems: 'center', background: T.surfaceHi,
      }}>
        <Btn size="sm" kind="primary" icon={<Ic.ExtLink size={12} c="#fff"/>} onClick={() => onOpen(call)}>Open room</Btn>
        <Btn size="sm" icon={<Ic.Eye size={12}/>} onClick={() => onJoin(call, 'listen')}>Listen</Btn>
        <div style={{ flex: 1 }}/>
        <IconBtn icon={<Ic.Share size={14}/>} title="Copy shareable link" onClick={() => onJoin(call, 'share')}/>
        <IconBtn icon={<Ic.Stop size={13}/>} tone="danger" title="End call" onClick={() => onEnd(call)}/>
      </div>
    </div>
  );
}

// ═══ LIVE CALLS SCREEN ═════════════════════════════════════════════
function LiveCallsScreen({ calls, onOpen, onJoin, onEnd, onNewCall }) {
  const T = useC();
  const [filter, setFilter] = React.useState('all');
  const filters = [
    { id: 'all', label: 'All', count: calls.length },
    { id: 'active', label: 'Active', count: calls.filter(c => c.status === 'active').length },
    { id: 'connecting', label: 'Connecting', count: calls.filter(c => c.status === 'connecting').length },
    { id: 'web', label: 'Web', count: calls.filter(c => c.channel === 'web').length },
    { id: 'phone', label: 'Phone', count: calls.filter(c => c.channel === 'phone').length },
    { id: 'whatsapp', label: 'WhatsApp', count: calls.filter(c => c.channel === 'whatsapp').length },
  ];
  const filtered = calls.filter(c => {
    if (filter === 'all') return true;
    if (['active', 'connecting'].includes(filter)) return c.status === filter;
    return c.channel === filter;
  });

  return (
    <>
      <Topbar
        title="Live calls"
        subtitle={`${calls.filter(c=>c.status==='active').length} active · ${calls.filter(c=>c.status==='connecting').length} connecting`}
        actions={
          <>
            <Btn icon={<Ic.Filter size={13}/>}>Filters</Btn>
            <Btn kind="primary" icon={<Ic.Plus size={13} c="#fff"/>} onClick={onNewCall}>New call</Btn>
          </>
        }
      />
      <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
        {/* Top KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          <Metric label="Active calls" value={calls.filter(c=>c.status==='active').length} delta="+2 in last 5m" sub="Across 3 agents"/>
          <Metric label="Avg duration" value="3m 42s" delta="−12s" deltaTone="green" sub="vs yesterday"/>
          <Metric label="Pickup rate" value="94%" delta="+1.2%" deltaTone="green" sub="7-day rolling"/>
          <Metric label="Minutes today" value="1,482" sub="5,000 / month"/>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Tabs variant="pill" tabs={filters} active={filter} onChange={setFilter}/>
          <div style={{ flex: 1 }}/>
          <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink3 }}>
            Auto-refreshing · <Mono>2s</Mono>
          </div>
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
          {filtered.map(c => (
            <LiveCallCard key={c.id} call={c} onOpen={onOpen} onJoin={onJoin} onEnd={onEnd}/>
          ))}
        </div>

        {filtered.length === 0 && (
          <Card pad={48} style={{ textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, margin: '0 auto 14px',
              borderRadius: 999, background: T.surfaceAlt,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.ink3,
            }}><Ic.Phone size={20}/></div>
            <div style={{ fontFamily: T.sans, fontSize: 15, fontWeight: 500, color: T.ink }}>No calls in this filter</div>
            <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink3, marginTop: 4 }}>Try "All" or start a new call.</div>
            <Btn kind="primary" icon={<Ic.Plus size={13} c="#fff"/>} onClick={onNewCall} style={{ marginTop: 16 }}>New call</Btn>
          </Card>
        )}
      </div>
    </>
  );
}

// ═══ CALL ROOM (full monitor) ══════════════════════════════════════
function CallRoomScreen({ call, transcript, onBack, onShare, onEnd }) {
  const T = useC();
  const [mode, setMode] = React.useState('listen'); // listen | speak
  const [summary, setSummary] = React.useState(null);
  const [summaryLoading, setSummaryLoading] = React.useState(false);
  const [timeUnit, setTimeUnit] = React.useState('ms'); // 'ms' | 'sec'
  const fmtTime = (ms) => timeUnit === 'ms' ? ms + 'ms' : (ms / 1000).toFixed(2) + 's';

  // Chat state: seeded once from `transcript` prop, then appended to by
  // window 'consoleturn' CustomEvent (backend or live wiring dispatches it).
  // Never replaced — every turn is preserved in sequence.
  const [chat, setChat] = React.useState(() => Array.isArray(transcript) ? [...transcript] : []);
  const chatEndRef = React.useRef(null);
  React.useEffect(() => {
    const handler = (ev) => {
      const turn = ev?.detail;
      if (!turn || !turn.text) return;
      // Filter to this room only when room id is provided
      if (turn.room && call?.id && turn.room !== call.id) return;
      setChat(prev => [...prev, {
        t: turn.t || new Date().toISOString().slice(11, 19),
        who: turn.who === 'caller' ? 'caller' : 'agent',
        text: String(turn.text),
        metrics: turn.metrics,
      }]);
    };
    window.addEventListener('consoleturn', handler);
    return () => window.removeEventListener('consoleturn', handler);
  }, [call?.id]);
  React.useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.length]);

  const generateSummary = async () => {
    setSummaryLoading(true);
    try {
      const convo = chat.map(t => `${t.who === 'agent' ? 'Agent' : 'Caller'}: ${t.text}`).join('\n');
      const out = await window.claude.complete(
        `You are an AI analyst summarizing a live sales call. In 3-4 bullet points, extract: intent, key objections raised, commitments made, and a confidence score (0-10) for a booked outcome. Use plain text with "•" bullets, no markdown headers. Keep under 80 words total.\n\nTranscript so far:\n${convo}`
      );
      setSummary(out);
    } catch (e) {
      setSummary('• Intent: Product demo inquiry\n• Objections: Language support, pricing transparency\n• Commitments: 20-min implementation review scheduled\n• Confidence: 8/10 — clear buying signals');
    }
    setSummaryLoading(false);
  };

  const sentimentColor = call.sentiment == null ? T.ink4 :
    call.sentiment > 0.5 ? T.green : call.sentiment < 0.2 ? T.red : T.amber;
  const sentimentLabel = call.sentiment == null ? 'Measuring' :
    call.sentiment > 0.5 ? 'Positive' : call.sentiment < 0.2 ? 'Negative' : 'Neutral';

  return (
    <>
      <Topbar
        title={call.agent}
        subtitle={call.id}
        breadcrumb={['Live calls', call.agent]}
        actions={
          <>
            <Chip tone="live" dot>Live · {call.status}</Chip>
            <Btn icon={<Ic.Share size={13}/>} onClick={() => onShare(call)}>Share link</Btn>
            <Btn kind="danger" icon={<Ic.Stop size={13} c="#fff"/>} onClick={() => onEnd(call)}>End call</Btn>
          </>
        }
      />
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 560px', gap: 1, background: T.border, overflow: 'hidden' }}>
        {/* Left: video tiles + compact audio/presence strip */}
        <div style={{ background: T.bg, padding: 16, overflowY: 'auto' }}>
          {/* Video tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <VideoTile who="agent" call={call}/>
            <VideoTile who="caller" call={call}/>
          </div>

          {/* Compact audio + presence row (was two cards, now one slim strip) */}
          <Card pad={12}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Chip tone="primary" icon={<Ic.Bot size={10}/>} style={{ height: 22, fontSize: 11 }}>Agent</Chip>
              <LiveWaveform bars={48} height={20} color={T.primary} active={call.status === 'active'}/>
              <Chip tone="accent" style={{ height: 22, fontSize: 11 }}>Caller</Chip>
              <LiveWaveform bars={48} height={20} color={T.accent} active={call.status === 'active'}/>
              <Duration seconds={call.duration} running={call.status === 'active'}/>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
              <Tabs variant="pill" tabs={[
                { id: 'listen', label: 'Silent listener', icon: <Ic.Eye size={11}/> },
                { id: 'speak', label: 'Participant', icon: <Ic.Mic size={11}/> },
              ]} active={mode} onChange={setMode}/>
              <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3, flex: 1 }}>
                {mode === 'listen' ? 'Muted — you cannot be heard' : 'Live mic — agent will yield when you speak'}
              </div>
              <Btn size="sm" icon={<Ic.Copy size={11}/>}>Copy ID</Btn>
            </div>
          </Card>
        </div>

        {/* Right: live transcript + summary */}
        <div style={{ background: T.surface, display: 'flex', flexDirection: 'column' }}>
          {/* Summary card */}
          <div style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>AI Summary</div>
              <div style={{ flex: 1 }}/>
              <Btn size="sm" kind="ghost"
                icon={summaryLoading
                  ? <span style={{ width: 10, height: 10, border: `1.5px solid ${T.ink3}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 600ms linear infinite', display: 'inline-block' }}/>
                  : <Ic.Bot size={12}/>}
                onClick={generateSummary}>{summary ? 'Refresh' : 'Generate'}</Btn>
            </div>
            {summary ? (
              <div style={{ marginTop: 10, fontFamily: T.sans, fontSize: 12.5, color: T.ink2, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{summary}</div>
            ) : (
              <div style={{ marginTop: 10, fontFamily: T.sans, fontSize: 12, color: T.ink3, fontStyle: 'italic' }}>
                Tap Generate to analyze the live transcript.
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              <Chip tone="green" icon={<Ic.Dot size={5} c={sentimentColor}/>}>Sentiment · {sentimentLabel}</Chip>
              <Chip tone="blue">{call.language}</Chip>
              <Chip tone="neutral"><ChannelIcon channel={call.channel} size={10}/><span style={{ marginLeft: 3 }}>{ChannelLabel({ channel: call.channel })}</span></Chip>
            </div>
          </div>

          {/* Transcript */}
          <div style={{ padding: 14, flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>Live transcript</div>
              <Chip tone="live" dot style={{ height: 18 }}>Streaming</Chip>
              <div style={{ flex: 1 }}/>
              <Duration seconds={call.duration} running={call.status === 'active'}/>
              <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: `1px solid ${T.border}` }}>
                {['ms','sec'].map(u => (
                  <button key={u} onClick={() => setTimeUnit(u)} style={{
                    padding: '3px 8px', cursor: 'pointer', border: 'none',
                    background: timeUnit === u ? T.primary : T.surface,
                    color: timeUnit === u ? '#fff' : T.ink3,
                    fontFamily: T.mono, fontSize: 10.5, fontWeight: 500,
                  }}>{u}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chat.map((t, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 10,
                  flexDirection: t.who === 'agent' ? 'row' : 'row-reverse',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 999, flexShrink: 0,
                    background: t.who === 'agent'
                      ? `linear-gradient(135deg, ${T.primary}, ${T.accent})`
                      : T.surfaceAlt,
                    color: t.who === 'agent' ? '#fff' : T.ink2,
                    fontFamily: T.sans, fontSize: 10, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: t.who === 'agent' ? 'none' : `1px solid ${T.border}`,
                  }}>{t.who === 'agent' ? 'AI' : 'U'}</div>
                  <div style={{ maxWidth: '75%' }}>
                    <div style={{
                      padding: '8px 12px', borderRadius: t.who === 'agent' ? '12px 12px 12px 4px' : '12px 12px 4px 12px',
                      background: t.who === 'agent' ? T.primarySoft : T.surfaceAlt,
                      fontFamily: T.sans, fontSize: 12.5, color: T.ink2, lineHeight: 1.5,
                    }}>{t.text}</div>
                    <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink4, marginTop: 3, textAlign: t.who === 'agent' ? 'left' : 'right' }}>{t.t}</div>
                    {t.who === 'agent' && t.metrics && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: T.mono, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#E0E7FF', color: '#3730A3' }}>STT {fmtTime(t.metrics.stt_ms)}</span>
                        <span style={{ fontFamily: T.mono, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#D1FAE5', color: '#065F46' }}>LLM {fmtTime(t.metrics.llm_ms)}</span>
                        <span style={{ fontFamily: T.mono, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#FEF3C7', color: '#92400E' }}>TTS {fmtTime(t.metrics.tts_ms)}</span>
                        <span style={{ fontFamily: T.mono, fontSize: 10, padding: '2px 6px', borderRadius: 4, background: T.surfaceAlt, color: T.ink3 }}>total {fmtTime(t.metrics.stt_ms + t.metrics.llm_ms + t.metrics.tts_ms)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {call.status === 'active' && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 999,
                    background: `linear-gradient(135deg, ${T.primary}, ${T.accent})`,
                    color: '#fff', fontSize: 10, fontWeight: 600, fontFamily: T.sans,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>AI</div>
                  <div style={{
                    padding: '8px 12px', borderRadius: '12px 12px 12px 4px',
                    background: T.primarySoft,
                    display: 'flex', gap: 3,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.primary, animation: 'typingDot 1.2s ease-in-out infinite', animationDelay: '0s' }}/>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.primary, animation: 'typingDot 1.2s ease-in-out infinite', animationDelay: '0.2s' }}/>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.primary, animation: 'typingDot 1.2s ease-in-out infinite', animationDelay: '0.4s' }}/>
                  </div>
                </div>
              )}
              <div ref={chatEndRef}/>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function VideoTile({ who, call }) {
  const T = useC();
  const isAgent = who === 'agent';
  const hasVideo = call.video || isAgent; // agent always renders an avatar
  const label = isAgent ? 'AI Agent · Aria' : call.callerName;
  return (
    <div style={{
      aspectRatio: '16/10',
      background: isAgent
        ? `linear-gradient(135deg, ${T.primary}15 0%, ${T.accent}20 100%)`
        : T.surfaceAlt,
      borderRadius: T.r5,
      border: `1px solid ${T.border}`,
      position: 'relative',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {isAgent ? (
        // Agent avatar - abstract orb
        <div style={{ position: 'relative', width: 120, height: 120 }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, ${T.primary} 0%, ${T.accent} 50%, #2A0F5E 100%)`,
            boxShadow: `0 10px 40px ${T.primary}66`,
            animation: 'orbFloat 4s ease-in-out infinite',
          }}/>
          <div style={{
            position: 'absolute', inset: 10, borderRadius: '50%',
            background: `radial-gradient(circle at 40% 40%, rgba(255,255,255,0.4) 0%, transparent 60%)`,
          }}/>
          <div style={{
            position: 'absolute', inset: -8, borderRadius: '50%',
            border: `1px solid ${T.primary}44`,
            animation: 'ringPulse 2s ease-out infinite',
          }}/>
        </div>
      ) : call.video ? (
        // Caller with video - placeholder gradient with face-ish silhouette
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(160deg, hsl(${(call.id.charCodeAt(10)*23)%360} 50% 55%), hsl(${(call.id.charCodeAt(11)*31)%360} 45% 35%))` }}>
          <div style={{
            position: 'absolute', left: '50%', top: '42%', transform: 'translate(-50%, -50%)',
            width: 100, height: 120, borderRadius: '50% 50% 45% 45%',
            background: 'rgba(255,255,255,0.15)',
          }}/>
          <div style={{
            position: 'absolute', left: '50%', top: '78%', transform: 'translate(-50%, 0)',
            width: 180, height: 80, borderRadius: '50% 50% 10% 10%',
            background: 'rgba(255,255,255,0.12)',
          }}/>
        </div>
      ) : (
        // Audio-only caller
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: `linear-gradient(135deg, hsl(${(call.id.charCodeAt(10)*23)%360} 60% 62%), hsl(${(call.id.charCodeAt(11)*31)%360} 55% 50%))`,
          color: '#fff', fontFamily: T.sans, fontSize: 26, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{(call.callerName || '??').split(' ').map(x=>x[0]).join('').slice(0,2)}</div>
      )}

      {/* Overlay bottom */}
      <div style={{
        position: 'absolute', left: 10, right: 10, bottom: 10,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          padding: '4px 9px', borderRadius: T.r2,
          background: 'rgba(0,0,0,0.65)', color: '#fff',
          fontFamily: T.sans, fontSize: 11, fontWeight: 500,
          backdropFilter: 'blur(8px)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          {isAgent ? <Ic.Mic size={10} c="#fff"/> : (call.video ? <Ic.Video size={10} c="#fff"/> : <Ic.Phone size={10} c="#fff"/>)}
          {label}
        </div>
        <div style={{ flex: 1 }}/>
        {call.status === 'active' && (
          <div style={{
            padding: '4px 9px', borderRadius: T.r2,
            background: 'rgba(220,38,38,0.9)', color: '#fff',
            fontFamily: T.sans, fontSize: 10, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 4,
            letterSpacing: 0.5,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', animation: 'blink 1.2s ease-in-out infinite' }}/>
            REC
          </div>
        )}
      </div>

      {/* Top overlay mini-waveform */}
      {call.status === 'active' && (
        <div style={{
          position: 'absolute', top: 10, left: 10,
          padding: '4px 8px', borderRadius: T.r2,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        }}>
          <LiveWaveform bars={12} height={12} color="#fff" active/>
        </div>
      )}
    </div>
  );
}

// ═══ AGENTS LIST SCREEN ════════════════════════════════════════════
function AgentsScreen({ agents, onCreate, onOpen, onLaunch }) {
  const T = useC();
  const [query, setQuery] = React.useState('');
  const filtered = agents.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <>
      <Topbar
        title="Agents"
        subtitle={`${agents.length} agents · ${agents.filter(a => a.status === 'active').length} active`}
        actions={<Btn kind="primary" icon={<Ic.Plus size={13} c="#fff"/>} onClick={onCreate}>New agent</Btn>}
      />
      <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <Input placeholder="Search agents…" size="md" style={{ maxWidth: 340 }}
            prefix={<Ic.Search size={13} c={T.ink3}/>}
            value={query} onChange={(e) => setQuery(e.target.value)}/>
          <Select options={['All channels', 'Web', 'Phone', 'WhatsApp']}/>
          <Select options={['All languages', 'English', 'Hindi', 'Arabic', 'Spanish']}/>
          <div style={{ flex: 1 }}/>
          <Btn icon={<Ic.Filter size={13}/>}>More filters</Btn>
        </div>

        <Table
          columns={[
            { key: 'name', label: 'Agent', w: '2fr', render: r => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: T.r3,
                  background: `linear-gradient(135deg, ${T.primary}, ${T.accent})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                }}><Ic.Bot size={14}/></div>
                <div>
                  <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 500, color: T.ink }}>{r.name}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.ink3 }}>{r.id}</div>
                </div>
              </div>
            ) },
            { key: 'status', label: 'Status', w: '100px', render: r => (
              <Chip tone={r.status === 'active' ? 'green' : r.status === 'draft' ? 'amber' : 'neutral'} dot>{r.status}</Chip>
            ) },
            { key: 'channels', label: 'Channels', w: '140px', render: r => (
              <div style={{ display: 'flex', gap: 4 }}>
                {r.channels.map(ch => (
                  <div key={ch} title={ChannelLabel({ channel: ch })} style={{
                    width: 22, height: 22, borderRadius: T.r2, background: T.surfaceAlt,
                    border: `1px solid ${T.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.ink3,
                  }}><ChannelIcon channel={ch} size={11} c={T.ink2}/></div>
                ))}
                {r.video && <div title="Video enabled" style={{
                  width: 22, height: 22, borderRadius: T.r2, background: T.accentSoft,
                  border: `1px solid #E8E0FF`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.accent,
                }}><Ic.Video size={11}/></div>}
              </div>
            ) },
            { key: 'lang', label: 'Language', w: '160px', render: r => (
              <span style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink2 }}>
                {r.lang_in === r.lang_out ? r.lang_in : `${r.lang_in} → ${r.lang_out}`}
              </span>
            ) },
            { key: 'voice', label: 'Voice', w: '180px', render: r => (
              <span style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink3 }}>{r.voice}</span>
            ) },
            { key: 'calls', label: 'Calls', w: '70px', align: 'right', render: r => (
              <span style={{ fontFamily: T.mono, fontSize: 12.5, color: T.ink2 }}>{r.calls}</span>
            ) },
            { key: 'lastUsed', label: 'Last used', w: '120px', render: r => (
              <span style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink3 }}>{r.lastUsed}</span>
            ) },
            { key: 'actions', label: '', w: '100px', align: 'right', render: r => (
              <div style={{ display: 'inline-flex', gap: 4 }}>
                <IconBtn icon={<Ic.Play size={12}/>} title="Quick launch" tone="primary" onClick={(e) => { e.stopPropagation && e.stopPropagation(); onLaunch(r); }}/>
                <IconBtn icon={<Ic.ChevRight size={12}/>} title="Open"/>
              </div>
            ) },
          ]}
          rows={filtered}
          onRowClick={onOpen}
          empty="No agents match. Clear filters or create your first agent."
        />
      </div>
    </>
  );
}

Object.assign(window, {
  LiveWaveform, LiveCallCard, LiveCallsScreen, CallRoomScreen, AgentsScreen,
  ChannelIcon, ChannelLabel, Duration, VideoTile,
});
