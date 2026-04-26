// Orbital Console â€” Agent Builder, Call History, Analytics, Settings, Modals


// ═══ PIPELINE CONFIG CONSTANTS ══════════════════════════════════════
const STT_PROVIDERS = {
  'Deepgram': {
    models: ['nova-3','nova-2','nova-2-meeting','nova-2-phonecall','nova-2-conversationalai','enhanced','base'],
    keyLabel: 'Deepgram API Key', placeholder: 'dg-...',
  },
};
const LLM_PROVIDERS = {
  'Anthropic': {
    models: ['claude-haiku-4-5-20251001','claude-sonnet-4-6','claude-opus-4-7'],
    keyLabel: 'Anthropic API Key', placeholder: 'sk-ant-...',
  },
  'Gemini': {
    models: ['gemini-2.5-flash','gemini-2.5-pro','gemini-2.0-flash','gemini-1.5-flash','gemini-1.5-pro'],
    keyLabel: 'Google AI API Key', placeholder: 'AIza...',
  },
  'Groq': {
    models: ['llama-3.1-8b-instant','llama-3.3-70b-versatile','llama3-70b-8192','mixtral-8x7b-32768'],
    keyLabel: 'Groq API Key', placeholder: 'gsk_...',
  },
  'Cerebras': {
    models: ['llama3.1-8b','llama-3.3-70b'],
    keyLabel: 'Cerebras API Key', placeholder: 'csk-...',
  },
};
const TTS_PROVIDERS = {
  'Deepgram Aura': {
    models: ['aura-2-asteria-en','aura-2-luna-en','aura-2-stella-en','aura-2-athena-en','aura-2-hera-en','aura-2-orion-en','aura-2-zeus-en'],
    keyLabel: 'Deepgram API Key', placeholder: 'dg-...',
  },
  'Cartesia': {
    models: ['sonic-2','sonic-english','sonic-multilingual'],
    keyLabel: 'Cartesia API Key', placeholder: 'cartesia-...',
  },
};
const VAD_ALGOS = [
  { key: 'local_vad', label: 'Local VAD',      desc: '~60ms · RMS energy · fastest, zero network calls' },
  { key: 'namo',      label: 'NAMO Semantic',  desc: '<20ms · DistilBERT ONNX · sentence-complete aware' },
  { key: 'deepgram',  label: 'Deepgram VAD',   desc: '150-300ms · cloud · built into STT stream' },
  { key: 'silence',   label: 'Silence Timer',  desc: '150ms silence threshold · simple fallback' },
];
const PIPELINE_DEFAULTS = {
  stt_provider: 'Deepgram',      stt_model: 'nova-3',                    stt_api_key: '',
  llm_provider: 'Anthropic',     llm_model: 'claude-haiku-4-5-20251001', llm_api_key: '',
  tts_provider: 'Deepgram Aura', tts_model: 'aura-2-asteria-en',         tts_api_key: '',
  vad_algo: 'local_vad',
};
// â•â•â• AGENT BUILDER â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function AgentBuilderScreen({ agent, onBack, onSave }) {
  const T = useC();
  const [tab, setTab] = React.useState('persona');
  const [form, setForm] = React.useState(agent || {
    name: 'Untitled agent', persona: '', greeting: '',
    channels: ['web'], video: false,
    lang_in: 'English', lang_out: 'English',
    voice: 'Cartesia Â· Aria (en-US)',
    script: '', temperature: 0.7, maxTurns: 40,
    ...PIPELINE_DEFAULTS,
  });
    ...PIPELINE_DEFAULTS,
  const up = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <>
      <Topbar
        title={agent ? agent.name : 'New agent'}
        subtitle={agent ? agent.id : 'Draft Â· unsaved'}
        breadcrumb={['Agents', agent ? agent.name : 'New agent']}
        actions={
          <>
            <Btn onClick={onBack}>Cancel</Btn>
            <Btn kind="primary" icon={<Ic.Check size={13} c="#fff"/>} onClick={() => onSave(form)}>Save agent</Btn>
          </>
        }
      />
      <div style={{ padding: '0 24px', borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        <Tabs variant="underline" active={tab} onChange={setTab} tabs={[
          { id: 'persona', label: 'Persona', icon: <Ic.Bot size={13}/> },
          { id: 'channel', label: 'Channel', icon: <Ic.Globe size={13}/> },
          { id: 'script', label: 'Script', icon: <Ic.Chat size={13}/> },
          { id: 'advanced', label: 'Advanced', icon: <Ic.Settings size={13}/> },
        ]}/>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', gap: 1, background: T.border, overflow: 'hidden' }}>
        <div style={{ background: T.bg, padding: 24, overflowY: 'auto' }}>
          {tab === 'persona' && <PersonaTab form={form} up={up}/>}
          {tab === 'channel' && <ChannelTab form={form} up={up}/>}
          {tab === 'script' && <ScriptTab form={form} up={up}/>}
          {tab === 'advanced' && <AdvancedTab form={form} up={up}/>}
          {tab === 'pipeline' && <PipelineTab form={form} up={up}/>}
        </div>
        <div style={{ background: T.surface, padding: 20, overflowY: 'auto' }}>
          <AgentPreview form={form}/>
        </div>
      </div>
    </>
  );
}

function PersonaTab({ form, up }) {
  const T = useC();
  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Card pad={20}>
        <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 4 }}>Identity</div>
        <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink3, marginBottom: 16 }}>Give this agent a name and voice. Operators see the name; callers hear the voice.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Agent name" required>
            <Input value={form.name} onChange={(e) => up('name', e.target.value)}/>
          </Field>
          <Field label="Voice" hint="Real-time streaming through Cartesia. Preview before saving.">
            <Select value={form.voice} onChange={(e) => up('voice', e.target.value)} style={{ width: '100%' }}
              options={['Cartesia Â· Aria (en-US)', 'Cartesia Â· Sonic (en-US)', 'Cartesia Â· Neela (en-IN)', 'Cartesia Â· Lyra (en-US)', 'Cartesia Â· Kai (en-GB)']}/>
          </Field>
        </div>
      </Card>

      <Card pad={20}>
        <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 4 }}>Personality & system prompt</div>
        <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink3, marginBottom: 16 }}>How the agent thinks, what it knows, how it should behave. This becomes the Claude system prompt.</div>
        <Field label="System prompt" required hint="Tip: describe the tone, knowledge boundaries, and a clear objective for every call.">
          <TextArea rows={10} value={form.persona} onChange={(e) => up('persona', e.target.value)}
            placeholder="You are Aria, an outbound sales agent for Orbital. Be warm, direct, and curious. Your job is to book a 20-minute implementation review for teams evaluating AI calling infrastructure. Never invent pricing or features â€” redirect to the demo if unsure."/>
        </Field>
      </Card>

      <Card pad={20}>
        <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 4 }}>Greeting (optional)</div>
        <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink3, marginBottom: 16 }}>The first line the caller hears. Leave blank to let the agent improvise.</div>
        <Field label="Greeting message">
          <TextArea rows={2} value={form.greeting} onChange={(e) => up('greeting', e.target.value)}
            placeholder="Hi, this is Aria from Orbital â€” thanks for hopping on. Is this still a good time?"/>
        </Field>
      </Card>
    </div>
  );
}

function ChannelTab({ form, up }) {
  const T = useC();
  const toggle = (ch) => up('channels', form.channels.includes(ch) ? form.channels.filter(c => c !== ch) : [...form.channels, ch]);
  const ChCard = ({ id, icon, title, desc }) => {
    const on = form.channels.includes(id);
    return (
      <div onClick={() => toggle(id)} style={{
        padding: 16, borderRadius: T.r4, cursor: 'pointer',
        border: `1.5px solid ${on ? T.primary : T.border}`,
        background: on ? T.primarySoft : T.surface,
        boxShadow: on ? `0 0 0 3px ${T.primary}1f` : T.shadow1,
        transition: 'all 120ms ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: T.r3,
            background: on ? T.primary : T.surfaceAlt,
            color: on ? '#fff' : T.ink2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{icon}</div>
          <div style={{ fontFamily: T.sans, fontSize: 13.5, fontWeight: 600, color: T.ink }}>{title}</div>
          <div style={{ flex: 1 }}/>
          <div style={{
            width: 18, height: 18, borderRadius: 4,
            background: on ? T.primary : T.surface,
            border: `1.5px solid ${on ? T.primary : T.borderHi}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{on && <Ic.Check size={11} c="#fff"/>}</div>
        </div>
        <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink3, lineHeight: 1.5 }}>{desc}</div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Card pad={20}>
        <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 4 }}>Call channels</div>
        <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink3, marginBottom: 16 }}>Pick one or more. You can override per-call at launch time.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <ChCard id="web" icon={<Ic.Globe size={15}/>} title="Web link" desc="Share a URL â€” anyone joins in-browser via LiveKit. No install."/>
          <ChCard id="phone" icon={<Ic.Phone size={15}/>} title="Outbound SIP" desc="Agent dials any phone number through your Twilio/Plivo trunk."/>
          <ChCard id="whatsapp" icon={<Ic.Chat size={15}/>} title="WhatsApp" desc="Send a WhatsApp invite with a one-tap join link."/>
        </div>
      </Card>

      <Card pad={20}>
        <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 4 }}>Language</div>
        <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink3, marginBottom: 16 }}>Live translation runs when these differ â€” STT in the caller's language, reply in the agent's.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Caller speaks" hint="Deepgram STT input language">
            <Select value={form.lang_in} onChange={(e) => up('lang_in', e.target.value)} style={{ width: '100%' }}
              options={['English', 'Hindi', 'Arabic', 'Spanish', 'French', 'Portuguese', 'German', 'Japanese']}/>
          </Field>
          <Field label="Agent replies in" hint="Cartesia TTS output language">
            <Select value={form.lang_out} onChange={(e) => up('lang_out', e.target.value)} style={{ width: '100%' }}
              options={['English', 'Hindi', 'Arabic', 'Spanish', 'French', 'Portuguese', 'German', 'Japanese']}/>
          </Field>
        </div>
      </Card>

      <Card pad={20}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: T.r3,
            background: form.video ? T.accentSoft : T.surfaceAlt,
            color: form.video ? T.accent : T.ink3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Ic.Video size={18}/></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink }}>Video on calls</div>
            <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink3, marginTop: 2, lineHeight: 1.5 }}>
              Enable the agent's avatar and allow caller video + screen share. Adds ~80ms latency.
            </div>
          </div>
          <Toggle on={form.video} onChange={(v) => up('video', v)}/>
        </div>
      </Card>
    </div>
  );
}

function ScriptTab({ form, up }) {
  const T = useC();
  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Card pad={20}>
        <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 4 }}>Presentation script</div>
        <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink3, marginBottom: 16 }}>
          Optional. The agent reads or references this during the call â€” great for sales pitches, demo walkthroughs, or support scripts.
        </div>
        <Field label="Script (plain text or Markdown)">
          <TextArea rows={16} value={form.script} onChange={(e) => up('script', e.target.value)} mono
            placeholder={`# Demo script â€” 3 minutes\n\n## Hook (0:00 â€“ 0:30)\n"So teams typically come to Orbital for one of three reasons..."\n\n## Show the console (0:30 â€“ 1:30)\n- Open Live calls\n- Point out the barge-in toggle\n- Explain translation in 1 sentence\n\n## Close (2:30 â€“ 3:00)\n- Ask: what's their current call volume?\n- Offer Thursday/Friday implementation slot`}/>
        </Field>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Btn size="sm" icon={<Ic.Plus size={12}/>}>Attach PDF</Btn>
          <Btn size="sm" icon={<Ic.Plus size={12}/>}>Link deck</Btn>
          <div style={{ flex: 1 }}/>
          <span style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3 }}>
            {form.script ? `${form.script.split(/\s+/).filter(Boolean).length} words` : 'No script attached'}
          </span>
        </div>
      </Card>
    </div>
  );
}

function AdvancedTab({ form, up }) {
  const T = useC();
  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Card pad={20}>
        <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 16 }}>LLM settings</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Model">
            <Select options={['Claude Sonnet 4', 'Claude Haiku 4.5', 'Claude Opus 4']} style={{ width: '100%' }}/>
          </Field>
          <Field label="Max turns before handoff">
            <Input value={form.maxTurns} onChange={(e) => up('maxTurns', e.target.value)}/>
          </Field>
          <Field label="Temperature" hint={`${form.temperature} â€” higher = more creative`}>
            <input type="range" min="0" max="1" step="0.05" value={form.temperature}
              onChange={(e) => up('temperature', parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: T.primary }}/>
          </Field>
          <Field label="Recording">
            <Select options={['Record all calls', 'Ask caller consent first', 'Never record']} style={{ width: '100%' }}/>
          </Field>
        </div>
      </Card>

      <Card pad={20}>
        <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 16 }}>Webhook</div>
        <Field label="Call-end webhook URL" hint="We POST a JSON payload with transcript + metadata.">
          <Input placeholder="https://api.yourapp.com/orbital/webhook"/>
        </Field>
      </Card>
    </div>
  );
}

function Toggle({ on, onChange }) {
  const T = useC();
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 36, height: 20, borderRadius: 999,
      background: on ? T.primary : T.borderHi,
      border: 'none', cursor: 'pointer', padding: 0,
      position: 'relative', transition: 'background 160ms ease',
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'left 160ms ease',
      }}/>
    </button>
  );
}

function AgentPreview({ form }) {
  const T = useC();
  return (
    <>
      <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Live preview</div>

      <Card pad={16}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: T.r3,
            background: `linear-gradient(135deg, ${T.primary}, ${T.accent})`,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Ic.Bot size={18}/></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: T.sans, fontSize: 13.5, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.name || 'Untitled'}</div>
            <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.voice}</div>
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <KV label="Channels">
            <div style={{ display: 'flex', gap: 4 }}>
              {form.channels.length === 0 && <span style={{ fontSize: 12, color: T.ink4 }}>None</span>}
              {form.channels.map(c => <Chip key={c} tone="neutral"><ChannelIcon channel={c} size={10}/><span style={{ marginLeft: 3 }}>{ChannelLabel({ channel: c })}</span></Chip>)}
            </div>
          </KV>
          <KV label="Language">{form.lang_in === form.lang_out ? form.lang_in : `${form.lang_in} â†’ ${form.lang_out}`}</KV>
          <KV label="Video">{form.video ? 'Enabled' : 'Disabled'}</KV>
          <KV label="Temp">{form.temperature}</KV>
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Sample opening</div>
        <div style={{
          padding: 12, borderRadius: T.r3,
          background: T.primarySoft, border: '1px solid #DDE4FF',
          fontFamily: T.sans, fontSize: 12.5, color: T.ink2, lineHeight: 1.55,
        }}>
          {form.greeting || <span style={{ fontStyle: 'italic', color: T.ink3 }}>Agent will improvise from its persona.</span>}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Pipeline</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PipeStep icon="STT" label={form.stt_provider + " STT"} sub={form.stt_model + " · " + form.lang_in}/>
          <PipeStep icon="LLM" label={form.llm_provider + " · " + form.llm_model} sub="System prompt + script"/>
          <PipeStep icon="TTS" label={form.tts_provider + " TTS"} sub={form.tts_model + " · " + form.lang_out}/>
          <PipeStep icon="VAD" label={"VAD: " + ((VAD_ALGOS.find(function(v){return v.key===form.vad_algo})||{}).label||form.vad_algo)} sub="Turn detection"/>
          <PipeStep icon="NET" label="LiveKit room" sub={form.channels.join(" + ") || "no channel"}/>
        </div>
      </div>
    </>
  );
}

function PipeStep({ icon, label, sub }) {
  const T = useC();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: T.r3, background: T.surfaceAlt }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 500, color: T.ink }}>{label}</div>
        <div style={{ fontFamily: T.sans, fontSize: 10.5, color: T.ink3 }}>{sub}</div>
      </div>
    </div>
  );
}

// ═══ PIPELINE TAB ════════════════════════════════════════════════════
function ProviderSection({ title, icon, providerMap, providerKey, modelKey, apiKeyKey, form, up }) {
  const T = useC();
  const providers = Object.keys(providerMap);
  const cfg = providerMap[form[providerKey]] || {};
  const models = cfg.models || [];

  const handleProviderChange = (e) => {
    const p = e.target.value;
    up(providerKey, p);
    up(modelKey, (providerMap[p]?.models || [])[0] || '');
  };

  return (
    <Card pad={20}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ width: 28, height: 28, borderRadius: T.r3, background: T.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.primary }}>{icon}</div>
        <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink }}>{title}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <Field label="Provider">
          <Select value={form[providerKey]} onChange={handleProviderChange} style={{ width: '100%' }}
            options={providers.map(p => ({ value: p, label: p }))}/>
        </Field>
        <Field label="Model">
          <Select value={form[modelKey]} onChange={(e) => up(modelKey, e.target.value)} style={{ width: '100%' }}
            options={models.map(m => ({ value: m, label: m }))}/>
        </Field>
      </div>
      <Field label={cfg.keyLabel || 'API Key'} hint="Stored locally in this browser session only">
        <input
          type="password"
          value={form[apiKeyKey]}
          onChange={(e) => up(apiKeyKey, e.target.value)}
          placeholder={cfg.placeholder || '...'}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: T.r3,
            border: `1px solid ${T.border}`, background: T.bg,
            fontFamily: T.mono, fontSize: 12.5, color: T.ink,
            outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={(e) => e.target.style.borderColor = T.primary}
          onBlur={(e) => e.target.style.borderColor = T.border}
        />
      </Field>
    </Card>
  );
}

function PipelineTab({ form, up }) {
  const T = useC();
  return (
    <div style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 18 }}>

      <ProviderSection
        title="Speech-to-Text (STT)"
        icon={<Ic.Mic size={14}/>}
        providerMap={STT_PROVIDERS}
        providerKey="stt_provider" modelKey="stt_model" apiKeyKey="stt_api_key"
        form={form} up={up}
      />

      <ProviderSection
        title="Language Model (LLM)"
        icon={<Ic.Bot size={14}/>}
        providerMap={LLM_PROVIDERS}
        providerKey="llm_provider" modelKey="llm_model" apiKeyKey="llm_api_key"
        form={form} up={up}
      />

      <ProviderSection
        title="Text-to-Speech (TTS)"
        icon={<Ic.Volume size={14}/>}
        providerMap={TTS_PROVIDERS}
        providerKey="tts_provider" modelKey="tts_model" apiKeyKey="tts_api_key"
        form={form} up={up}
      />

      <Card pad={20}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 28, height: 28, borderRadius: T.r3, background: T.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.primary }}><Ic.Zap size={14}/></div>
          <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink }}>Voice Activity Detection</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {VAD_ALGOS.map(({ key, label, desc }) => {
            const on = form.vad_algo === key;
            return (
              <button key={key} onClick={() => up('vad_algo', key)} style={{
                padding: '12px 14px', borderRadius: T.r3, cursor: 'pointer', textAlign: 'left',
                border: `1.5px solid ${on ? T.primary : T.border}`,
                background: on ? T.primarySoft : T.surface,
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: `2px solid ${on ? T.primary : T.borderHi}`,
                    background: on ? T.primary : 'transparent',
                    flexShrink: 0,
                  }}/>
                  <span style={{ fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, color: on ? T.primarySoftInk : T.ink }}>{label}</span>
                </div>
                <span style={{ fontFamily: T.sans, fontSize: 11, color: on ? T.primarySoftInk : T.ink3, opacity: 0.85, lineHeight: 1.4 }}>{desc}</span>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function KV({ label, children }) {
  const T = useC();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
      <div style={{ width: 72, fontFamily: T.sans, fontSize: 11.5, color: T.ink3 }}>{label}</div>
      <div style={{ flex: 1, fontFamily: T.sans, fontSize: 12.5, color: T.ink }}>{children}</div>
    </div>
  );
}

// â•â•â• CALL HISTORY â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function HistoryScreen({ history, onOpen }) {
  const T = useC();
  const [sel, setSel] = React.useState(null);

  return (
    <>
      <Topbar title="Call history" subtitle={`${history.length} calls this week`}
        actions={
          <>
            <Btn icon={<Ic.Filter size={13}/>}>Filters</Btn>
            <Btn icon={<Ic.ExtLink size={13}/>}>Export CSV</Btn>
          </>
        }/>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: sel ? '1fr 440px' : '1fr', gap: 1, background: T.border, overflow: 'hidden' }}>
        <div style={{ background: T.bg, padding: 24, overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <Input placeholder="Search caller, agent, IDâ€¦" size="md" style={{ maxWidth: 340 }}
              prefix={<Ic.Search size={13} c={T.ink3}/>}/>
            <Select options={['All agents', 'Sales â€” Outbound', 'Support concierge', 'Demo walkthrough']}/>
            <Select options={['All outcomes', 'Booked', 'Resolved', 'Escalated', 'No answer']}/>
            <Select options={['Last 7 days', 'Today', 'Last 30 days', 'All time']}/>
          </div>

          <Table
            columns={[
              { key: 'id', label: 'Call', w: '220px', render: r => (
                <div>
                  <div style={{ fontFamily: T.mono, fontSize: 11.5, color: T.ink }}>{r.id}</div>
                  <div style={{ fontFamily: T.sans, fontSize: 11, color: T.ink3 }}>{r.date}</div>
                </div>
              ) },
              { key: 'agent', label: 'Agent', w: '1.5fr' },
              { key: 'caller', label: 'Caller', w: '1.5fr' },
              { key: 'channel', label: 'Channel', w: '100px', render: r => (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <ChannelIcon channel={r.channel} size={12}/>
                  <span style={{ fontSize: 12, color: T.ink2, textTransform: 'capitalize' }}>{r.channel}</span>
                </div>
              ) },
              { key: 'duration', label: 'Duration', w: '90px', render: r => (
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.ink2 }}>{r.duration}</span>
              ) },
              { key: 'outcome', label: 'Outcome', w: '160px', render: r => {
                const tone = r.outcome.includes('demo') || r.outcome === 'Resolved' || r.outcome === 'Completed' ? 'green'
                  : r.outcome === 'Escalated' || r.outcome === 'Not interested' ? 'red'
                  : 'neutral';
                return <Chip tone={tone} dot>{r.outcome}</Chip>;
              } },
              { key: 'sentiment', label: 'Sentiment', w: '110px', render: r => {
                const m = { positive: { tone: 'green', label: 'Positive' }, neutral: { tone: 'neutral', label: 'Neutral' }, negative: { tone: 'red', label: 'Negative' } }[r.sentiment];
                return <Chip tone={m.tone}>{m.label}</Chip>;
              } },
              { key: 'actions', label: '', w: '50px', align: 'right', render: r => (
                <IconBtn icon={<Ic.ChevRight size={12}/>}/>
              ) },
            ]}
            rows={history}
            onRowClick={(r) => setSel(r)}
          />
        </div>

        {sel && <HistoryDetail call={sel} onClose={() => setSel(null)}/>}
      </div>
    </>
  );
}

function HistoryDetail({ call, onClose }) {
  const T = useC();
  const sampleTranscript = window.MockData.transcript.slice(0, 8);
  return (
    <div style={{ background: T.surface, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 16, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.sans, fontSize: 13.5, fontWeight: 600, color: T.ink }}>{call.agent}</div>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.ink3 }}>{call.id}</div>
        </div>
        <IconBtn icon={<Ic.X size={14}/>} onClick={onClose}/>
      </div>

      <div style={{ padding: 16, borderBottom: `1px solid ${T.border}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <KV label="Caller">{call.caller}</KV>
        <KV label="Channel"><span style={{ textTransform: 'capitalize' }}>{call.channel}</span></KV>
        <KV label="Started">{call.date}</KV>
        <KV label="Duration">{call.duration}</KV>
      </div>

      <div style={{ padding: 16, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>AI summary</div>
        <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink2, lineHeight: 1.55 }}>
          Caller asked about language support and SIP integration. Agent demonstrated live translation and explained Twilio trunk setup. Caller confirmed Thursday 3pm for implementation review. Buying signals clear throughout.
        </div>
      </div>

      <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
        <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Transcript</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sampleTranscript.map((t, i) => (
            <div key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 600, color: t.who === 'agent' ? T.primary : T.ink }}>
                  {t.who === 'agent' ? 'Agent' : 'Caller'}
                </span>
                <span style={{ fontFamily: T.mono, fontSize: 10, color: T.ink4 }}>{t.t}</span>
              </div>
              <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink2, lineHeight: 1.5 }}>{t.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: 14, borderTop: `1px solid ${T.border}`, display: 'flex', gap: 8 }}>
        <Btn size="sm" icon={<Ic.Play size={11}/>}>Play recording</Btn>
        <Btn size="sm" icon={<Ic.ExtLink size={11}/>}>Full view</Btn>
        <div style={{ flex: 1 }}/>
        <Btn size="sm" icon={<Ic.Copy size={11}/>}>Copy link</Btn>
      </div>
    </div>
  );
}

// â•â•â• ANALYTICS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function AnalyticsScreen() {
  const T = useC();
  return (
    <>
      <Topbar title="Analytics" subtitle="Last 7 days"
        actions={
          <>
            <Select options={['Last 7 days', 'Last 24 hours', 'Last 30 days', 'This quarter']}/>
            <Btn icon={<Ic.ExtLink size={13}/>}>Export</Btn>
          </>
        }/>
      <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          <Metric label="Total calls" value="2,194" delta="+12%" deltaTone="green" sub="vs previous 7d"/>
          <Metric label="Avg duration" value="3m 42s" delta="âˆ’8s" deltaTone="green"/>
          <Metric label="Booked outcomes" value="642" delta="+24%" deltaTone="green" sub="29% of total"/>
          <Metric label="Spend" value="$487" sub="â‰ˆ $0.09/min"/>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 20 }}>
          <Card pad={20}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
              <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink }}>Calls by hour</div>
              <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink3 }}>Today Â· peaks at 13:00</div>
              <div style={{ flex: 1 }}/>
              <Tabs variant="pill" active="today" onChange={()=>{}} tabs={[{ id: 'today', label: 'Today' }, { id: 'week', label: 'Week' }]}/>
            </div>
            <HourChart data={window.MockData.channelHourly}/>
          </Card>

          <Card pad={20}>
            <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 4 }}>Channel mix</div>
            <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink3, marginBottom: 20 }}>By total minutes</div>
            <ChannelMix segments={[
              { label: 'Web link', value: 52, color: T.primary },
              { label: 'Outbound phone', value: 34, color: T.accent },
              { label: 'WhatsApp', value: 14, color: T.blue },
            ]}/>
          </Card>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <Card pad={20}>
            <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 16 }}>Top agents by volume</div>
            {[
              { name: 'Support concierge', v: 1240, pct: 56 },
              { name: 'Sales â€” Outbound', v: 482, pct: 22 },
              { name: 'Demo walkthrough', v: 318, pct: 14 },
              { name: 'Clinic triage', v: 96, pct: 4 },
              { name: 'NPS feedback', v: 58, pct: 4 },
            ].map(a => (
              <div key={a.name} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{ flex: 1, fontFamily: T.sans, fontSize: 12.5, color: T.ink }}>{a.name}</div>
                  <div style={{ fontFamily: T.mono, fontSize: 12, color: T.ink2 }}>{a.v.toLocaleString()}</div>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: T.surfaceAlt, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${a.pct}%`, background: `linear-gradient(90deg, ${T.primary}, ${T.accent})`, borderRadius: 999 }}/>
                </div>
              </div>
            ))}
          </Card>

          <Card pad={20}>
            <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 16 }}>Outcome distribution</div>
            {[
              { label: 'Resolved / Completed', v: 948, tone: 'green' },
              { label: 'Booked demo', v: 642, tone: 'primary' },
              { label: 'Follow-up', v: 284, tone: 'blue' },
              { label: 'Escalated', v: 162, tone: 'amber' },
              { label: 'No answer / dropped', v: 158, tone: 'neutral' },
            ].map(o => (
              <div key={o.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${T.borderSoft}` }}>
                <Chip tone={o.tone} dot>{o.label}</Chip>
                <div style={{ flex: 1 }}/>
                <div style={{ fontFamily: T.mono, fontSize: 13, color: T.ink, fontWeight: 500 }}>{o.v}</div>
                <div style={{ width: 50, textAlign: 'right', fontFamily: T.sans, fontSize: 11.5, color: T.ink3 }}>
                  {Math.round(o.v / 2194 * 100)}%
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}

function HourChart({ data }) {
  const T = useC();
  const max = Math.max(...data);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 180 }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: '100%', height: `${(v / max) * 100}%`, minHeight: 2,
            background: `linear-gradient(180deg, ${T.primary}, ${T.accent})`,
            borderRadius: '3px 3px 0 0',
            opacity: i === 13 ? 1 : 0.8,
          }}/>
          <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.ink4 }}>{i % 3 === 0 ? `${i}:00` : ''}</div>
        </div>
      ))}
    </div>
  );
}

function ChannelMix({ segments }) {
  const T = useC();
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <>
      <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', marginBottom: 20 }}>
        {segments.map(s => <div key={s.label} style={{ width: `${s.value / total * 100}%`, background: s.color }}/>)}
      </div>
      {segments.map(s => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
          <Ic.Dot size={8} c={s.color}/>
          <div style={{ flex: 1, fontFamily: T.sans, fontSize: 12.5, color: T.ink2 }}>{s.label}</div>
          <div style={{ fontFamily: T.mono, fontSize: 12.5, color: T.ink, fontWeight: 500 }}>{s.value}%</div>
        </div>
      ))}
    </>
  );
}

// â•â•â• SETTINGS â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function SettingsScreen() {
  const T = useC();
  const [tab, setTab] = React.useState('channels');
  return (
    <>
      <Topbar title="Settings"/>
      <div style={{ padding: '0 24px', borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        <Tabs variant="underline" active={tab} onChange={setTab} tabs={[
          { id: 'channels', label: 'Channels' },
          { id: 'team', label: 'Team' },
          { id: 'api', label: 'API & webhooks' },
          { id: 'billing', label: 'Billing' },
        ]}/>
      </div>
      <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
        {tab === 'channels' && <ChannelSettings/>}
        {tab === 'team' && <TeamSettings/>}
        {tab === 'api' && <ApiSettings/>}
        {tab === 'billing' && <BillingSettings/>}
      </div>
    </>
  );
}

function ChannelSettings() {
  const T = useC();
  return (
    <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card pad={20}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: T.r3, background: T.primarySoft, color: T.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic.Phone size={18}/></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink }}>SIP trunk (outbound phone)</div>
            <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink3 }}>Twilio Â· connected Â· 14 numbers</div>
          </div>
          <Chip tone="green" dot>Connected</Chip>
          <Btn size="sm">Manage</Btn>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <KV label="Provider">Twilio</KV>
          <KV label="Region">US-East / AE-South</KV>
          <KV label="Outbound CPS">10</KV>
        </div>
      </Card>

      <Card pad={20}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: T.r3, background: T.greenSoft, color: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic.Chat size={18}/></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink }}>WhatsApp Business</div>
            <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink3 }}>Meta Cloud API Â· +971 50 XXX 2248</div>
          </div>
          <Chip tone="green" dot>Connected</Chip>
          <Btn size="sm">Manage</Btn>
        </div>
      </Card>

      <Card pad={20}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: T.r3, background: T.surfaceAlt, color: T.ink3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ic.Globe size={18}/></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink }}>Web link (LiveKit)</div>
            <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink3 }}>Default room domain: liveaura.app/c/:id</div>
          </div>
          <Chip tone="green" dot>Built-in</Chip>
        </div>
      </Card>
    </div>
  );
}

function TeamSettings() {
  const T = useC();
  return (
    <div style={{ maxWidth: 820 }}>
      <Card pad={0}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink }}>Operators</div>
            <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink3, marginTop: 2 }}>Anyone here can monitor calls in real time.</div>
          </div>
          <Btn size="sm" kind="primary" icon={<Ic.Plus size={12} c="#fff"/>}>Invite</Btn>
        </div>
        {[
          { n: 'Nandhu B.', e: 'nandhu@liveaura.app', r: 'Owner' },
          { n: 'Aisha R.', e: 'aisha@liveaura.app', r: 'Admin' },
          { n: 'Leo Park', e: 'leo@liveaura.app', r: 'Operator' },
          { n: 'Priya S.', e: 'priya@liveaura.app', r: 'Operator' },
        ].map((m, i) => (
          <div key={m.e} style={{ padding: '12px 18px', borderBottom: i < 3 ? `1px solid ${T.borderSoft}` : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 999, background: `linear-gradient(135deg, hsl(${i*60} 55% 60%), hsl(${i*60+40} 50% 45%))`, color: '#fff', fontFamily: T.sans, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{m.n.split(' ').map(x=>x[0]).join('')}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, fontWeight: 500 }}>{m.n}</div>
              <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3 }}>{m.e}</div>
            </div>
            <Chip tone={m.r === 'Owner' ? 'primary' : m.r === 'Admin' ? 'blue' : 'neutral'}>{m.r}</Chip>
          </div>
        ))}
      </Card>
    </div>
  );
}

function ApiSettings() {
  const T = useC();
  return (
    <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card pad={20}>
        <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 4 }}>API endpoints</div>
        <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink3, marginBottom: 14 }}>Your dashboard talks to these.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { m: 'POST', p: '/api/calls', d: 'Create a new call session' },
            { m: 'GET', p: '/api/calls', d: 'List active and past calls' },
            { m: 'DELETE', p: '/api/calls/:id', d: 'End a call' },
            { m: 'POST', p: '/api/token', d: 'Mint LiveKit access tokens' },
          ].map(e => (
            <div key={e.p} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: T.r3, background: T.surfaceAlt, border: `1px solid ${T.borderSoft}` }}>
              <span style={{ fontFamily: T.mono, fontSize: 10.5, fontWeight: 600, color: e.m === 'GET' ? T.blue : e.m === 'POST' ? T.green : T.red, width: 50 }}>{e.m}</span>
              <Mono style={{ background: 'transparent', padding: 0 }}>{e.p}</Mono>
              <div style={{ flex: 1 }}/>
              <span style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3 }}>{e.d}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card pad={20}>
        <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 14 }}>Webhook</div>
        <Field label="Call-end URL" hint="We POST a JSON payload with transcript + metadata on each call end.">
          <Input value="https://liveaura.app/hooks/call-end" onChange={()=>{}}
            suffix={<Chip tone="green" dot>Active</Chip>}/>
        </Field>
      </Card>
    </div>
  );
}

function BillingSettings() {
  const T = useC();
  return (
    <div style={{ maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card pad={20}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink }}>Current usage</div>
            <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink3, marginTop: 2 }}>Nov 1 â€“ Nov 30</div>
          </div>
          <div style={{ fontFamily: T.sans, fontSize: 28, fontWeight: 600, color: T.ink, letterSpacing: -0.5 }}>$487<span style={{ fontSize: 14, color: T.ink3, fontWeight: 400 }}>.40</span></div>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: T.surfaceAlt, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: '54%', background: `linear-gradient(90deg, ${T.primary}, ${T.accent})`, borderRadius: 999 }}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.sans, fontSize: 11.5, color: T.ink3 }}>
          <span>5,416 / 10,000 included minutes</span>
          <span>Resets Dec 1</span>
        </div>
      </Card>
    </div>
  );
}

// â•â•â• SHARE MODAL â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function ShareModal({ call, onClose }) {
  const T = useC();
  const [copied, setCopied] = React.useState(false);
  const url = `${window.location.origin}/room/${call.id}`;
  const copy = () => { navigator.clipboard && navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  return (
    <ModalShell onClose={onClose} title="Share this call" subtitle={call.id}>
      <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink2, lineHeight: 1.55, marginBottom: 16 }}>
        Anyone with this link can join the room as a listener or participant. The link expires when the call ends.
      </div>

      <Field label="Room URL">
        <Input value={url} onChange={()=>{}} suffix={
          <Btn size="sm" kind={copied ? 'primary' : 'default'} icon={copied ? <Ic.Check size={11} c="#fff"/> : <Ic.Copy size={11}/>} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Btn>
        }/>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
        {[
          { icon: <Ic.Eye size={14}/>, label: 'Listener', desc: 'Silent observer' },
          { icon: <Ic.Mic size={14}/>, label: 'Participant', desc: 'Can speak in' },
          { icon: <Ic.Settings size={14}/>, label: 'Operator', desc: 'Can end call' },
        ].map(p => (
          <div key={p.label} style={{ padding: 12, borderRadius: T.r3, border: `1px solid ${T.border}`, background: T.surfaceHi }}>
            <div style={{ color: T.primary, marginBottom: 6 }}>{p.icon}</div>
            <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink, fontWeight: 500 }}>{p.label}</div>
            <div style={{ fontFamily: T.sans, fontSize: 11, color: T.ink3 }}>{p.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
        <Btn icon={<Ic.Chat size={13}/>}>WhatsApp</Btn>
        <Btn icon={<Ic.Send size={13}/>}>Email</Btn>
        <div style={{ flex: 1 }}/>
        <Btn kind="primary" onClick={onClose}>Done</Btn>
      </div>
    </ModalShell>
  );
}

function NewCallModal({ agents, onClose, onLaunch }) {
  const T = useC();
  const [agentId, setAgentId] = React.useState(agents[0].id);
  const [channel, setChannel] = React.useState('web');
  const [to, setTo] = React.useState('');
  const [agenda, setAgenda] = React.useState('');
  const [promptPreset, setPromptPreset] = React.useState('sales');
  const [prompt, setPrompt] = React.useState('You are a professional sales representative. Introduce the product clearly, highlight key benefits, address objections politely, and guide the prospect toward a next step.');
  const [video, setVideo] = React.useState(false);
  const [voiceMode, setVoiceMode] = React.useState('pipeline');

  const PRESETS = {
    sales:    { label: 'Sales Pitch',         text: 'You are a professional sales representative. Introduce the product clearly, highlight key benefits, address objections politely, and guide the prospect toward a next step.' },
    support:  { label: 'Customer Support',    text: 'You are a patient support agent. Listen carefully, troubleshoot step by step, and confirm the issue is resolved before ending the call.' },
    survey:   { label: 'Survey / Interview',  text: 'You are conducting a short structured survey. Ask each question from the agenda in order, acknowledge the answer briefly, and never lead the respondent.' },
    reminder: { label: 'Appointment Reminder', text: 'You are calling to confirm an upcoming appointment. Be brief and friendly. Confirm date and time, and offer to reschedule if needed.' },
    custom:   { label: 'Custom',              text: '' },
  };
  const agent = agents.find(a => a.id === agentId);

  const pickPreset = (key) => {
    setPromptPreset(key);
    if (key !== 'custom') setPrompt(PRESETS[key].text);
  };

  return (
    <ModalShell onClose={onClose} title="Start a new call" subtitle="Launch an AI agent into a live room.">
      <div style={{ maxHeight: '72vh', overflowY: 'auto', margin: '0 -4px', padding: '0 4px' }}>

      <Field label="Use agent" style={{ marginBottom: 14 }}>
        <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} style={{ width: '100%' }}
          options={agents.map(a => ({ value: a.id, label: a.name }))}/>
      </Field>

      <Field label="Call channel" style={{ marginBottom: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {['web', 'phone', 'whatsapp'].map(ch => {
            const on = channel === ch;
            return (
              <button key={ch} onClick={() => setChannel(ch)} style={{
                padding: '12px 10px', borderRadius: T.r3, cursor: 'pointer',
                border: `1.5px solid ${on ? T.primary : T.border}`,
                background: on ? T.primarySoft : T.surface,
                display: 'flex', alignItems: 'center', gap: 8,
                color: on ? T.primary : T.ink2, fontFamily: T.sans, fontSize: 13, fontWeight: 500,
              }}>
                <ChannelIcon channel={ch} size={15} c={on ? T.primary : T.ink2}/>
                <span style={{ textTransform: 'capitalize' }}>{ChannelLabel({ channel: ch })}</span>
              </button>
            );
          })}
        </div>
      </Field>

      {channel !== 'web' && (
        <Field label={channel === 'phone' ? 'Phone number' : 'WhatsApp number'} style={{ marginBottom: 14 }}>
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+971 50 123 4567"/>
        </Field>
      )}

      <Field label="Meeting agenda" hint="One line per goal. The agent reads this at the top of the call." style={{ marginBottom: 14 }}>
        <TextArea rows={3} value={agenda} onChange={(e) => setAgenda(e.target.value)}
          placeholder={`â€¢ Confirm identity\nâ€¢ Walk through pricing tiers\nâ€¢ Book a 20-min implementation review`}/>
      </Field>

      <Field label="Agent prompt / behavior" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {Object.entries(PRESETS).map(([k, v]) => {
            const on = promptPreset === k;
            return (
              <button key={k} onClick={() => pickPreset(k)} style={{
                height: 26, padding: '0 10px', border: 'none', cursor: 'pointer',
                borderRadius: 999,
                background: on ? T.primarySoft : T.surfaceAlt,
                color: on ? T.primarySoftInk : T.ink2,
                fontFamily: T.sans, fontSize: 11.5, fontWeight: 500,
                boxShadow: on ? `inset 0 0 0 1px ${T.primary}` : `inset 0 0 0 1px ${T.border}`,
              }}>{v.label}</button>
            );
          })}
        </div>
        <TextArea rows={4} value={prompt}
          onChange={(e) => { setPrompt(e.target.value); setPromptPreset('custom'); }}
          placeholder="Describe exactly how the agent should behaveâ€¦"/>
      </Field>

      <Card pad={14} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: T.r3,
            background: video ? T.accentSoft : T.surfaceAlt,
            color: video ? T.accent : T.ink3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><Ic.Video size={15}/></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 500, color: T.ink }}>Enable video</div>
            <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3, marginTop: 1 }}>
              {channel === 'web' ? 'Allow video in the call (web only)' : 'Video requires Web channel'}
            </div>
          </div>
          <Toggle on={video && channel === 'web'} onChange={(v) => channel === 'web' && setVideo(v)}/>
        </div>
      </Card>

      <Field label="Voice engine" style={{ marginBottom: 14 }}>
        <div style={{ display: ‘grid’, gridTemplateColumns: ‘1fr 1fr’, gap: 8 }}>
          {[
            { key: ‘pipeline’,    label: ‘Standard Pipeline’, sub: ‘Deepgram STT â†’ LLM â†’ Aura TTS’ },
            { key: ‘gemini_live’, label: ‘Gemini Live’,       sub: ‘Native audio Â· model handles VAD’ },
          ].map(({ key, label, sub }) => {
            const on = voiceMode === key;
            return (
              <button key={key} onClick={() => setVoiceMode(key)} style={{
                padding: ‘10px 12px’, borderRadius: T.r3, cursor: ‘pointer’, textAlign: ‘left’,
                border: `1.5px solid ${on ? T.primary : T.border}`,
                background: on ? T.primarySoft : T.surface,
                display: ‘flex’, flexDirection: ‘column’, gap: 3,
              }}>
                <span style={{ fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, color: on ? T.primarySoftInk : T.ink }}>{label}</span>
                <span style={{ fontFamily: T.sans, fontSize: 11, color: on ? T.primarySoftInk : T.ink3, opacity: 0.8 }}>{sub}</span>
              </button>
            );
          })}
        </div>
      </Field>

      <div style={{ padding: 12, borderRadius: T.r3, background: T.surfaceAlt, marginBottom: 4 }}>
        <div style={{ fontFamily: T.sans, fontSize: 11, color: T.ink3, fontWeight: 500, textTransform: ‘uppercase’, letterSpacing: 0.5, marginBottom: 6 }}>Pre-flight</div>
        <KV label="Agent">{agent.name}</KV>
        <KV label="Voice">{agent.voice}</KV>
        <KV label="Language">{agent.lang_in === agent.lang_out ? agent.lang_in : `${agent.lang_in} â†’ ${agent.lang_out}`}</KV>
        <KV label="Video">{video && channel === ‘web’ ? ‘On’ : ‘Off’}</KV>
        <KV label="Engine">{voiceMode === ‘gemini_live’ ? ‘Gemini Live’ : ‘Standard Pipeline’}</KV>
      </div>

      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 14, borderTop: `1px solid ${T.borderSoft}` }}>
        <Btn onClick={onClose}>Cancel</Btn>
        <div style={{ flex: 1 }}/>
        <Btn kind="primary" icon={<Ic.Play size={12} c="#fff"/>}
          onClick={() => onLaunch({ ...agent, video: video && channel === 'web' }, channel, to, { agenda, prompt, voiceMode })}>Launch call</Btn>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children, onClose, title, subtitle }) {
  const T = useC();
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(10, 10, 11, 0.40)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)', animation: 'fadeIn 180ms ease-out',
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 520, background: T.surface, borderRadius: T.r6,
        border: `1px solid ${T.border}`, boxShadow: T.shadowModal,
        padding: 24, animation: 'modalIn 220ms ease-out',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.sans, fontSize: 16, fontWeight: 600, color: T.ink, letterSpacing: -0.2 }}>{title}</div>
            {subtitle && <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink3, marginTop: 2 }}>{subtitle}</div>}
          </div>
          <IconBtn icon={<Ic.X size={14}/>} onClick={onClose}/>
        </div>
        {children}
      </div>
    </div>
  );
}

Object.assign(window, {
  AgentBuilderScreen, HistoryScreen, AnalyticsScreen, SettingsScreen,
  ShareModal, NewCallModal, ModalShell, Toggle,

