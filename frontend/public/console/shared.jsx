// Orbital Console — shared primitives, icons, layout chrome

const CT = () => window.ConsoleTokens;
const ConsoleCtx = React.createContext(null);
const useC = () => window.ConsoleTokens;

// ═══ ICONS ═════════════════════════════════════════════════════════
const Ic = {
  Mic:    (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none" {...p}><rect x="6" y="2" width="4" height="8" rx="2" stroke={p.c||'currentColor'} strokeWidth="1.4"/><path d="M3.5 7.5v.5a4.5 4.5 0 0 0 9 0v-.5M8 12.5V14M5.5 14h5" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinecap="round"/></svg>,
  Phone:  (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M3.5 3.5c0-.55.45-1 1-1h1.8c.4 0 .76.24.92.62l1 2.5c.15.37.04.79-.27 1.04l-1.1.85c.9 1.85 2.43 3.37 4.28 4.27l.85-1.1c.26-.3.67-.41 1.04-.27l2.5 1c.38.15.62.5.62.91V13c0 .55-.45 1-1 1C7.83 14 2.5 8.67 2.5 2.5c0-.55.45-1 1-1z" stroke={p.c||'currentColor'} strokeWidth="1.4"/></svg>,
  Globe:  (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke={p.c||'currentColor'} strokeWidth="1.4"/><path d="M2.5 8h11M8 2.5c2 2 2 9 0 11M8 2.5c-2 2-2 9 0 11" stroke={p.c||'currentColor'} strokeWidth="1.4"/></svg>,
  Chat:   (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M2.5 7c0-2.5 2.2-4.5 5.5-4.5S13.5 4.5 13.5 7s-2.2 4.5-5.5 4.5c-.6 0-1.2-.07-1.7-.2L3 12.5l.7-2.5C2.95 9.1 2.5 8.1 2.5 7z" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  Video:  (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="9" height="8" rx="1.5" stroke={p.c||'currentColor'} strokeWidth="1.4"/><path d="M11 7l3.5-1.5v5L11 9" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  Plus:   (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke={p.c||'currentColor'} strokeWidth="1.5" strokeLinecap="round"/></svg>,
  Play:   (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M5 3.5v9l7-4.5-7-4.5z" fill={p.c||'currentColor'}/></svg>,
  Stop:   (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><rect x="4" y="4" width="8" height="8" rx="1" fill={p.c||'currentColor'}/></svg>,
  Share:  (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M11 5.5l-3-3-3 3M8 2.5V10M3.5 8.5v3A1.5 1.5 0 0 0 5 13h6a1.5 1.5 0 0 0 1.5-1.5v-3" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Eye:    (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" stroke={p.c||'currentColor'} strokeWidth="1.4"/><circle cx="8" cy="8" r="2" stroke={p.c||'currentColor'} strokeWidth="1.4"/></svg>,
  Trash:  (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M2.5 4.5h11M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M4 4.5l.8 8.2a1 1 0 0 0 1 .8h4.4a1 1 0 0 0 1-.8L12 4.5" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  ExtLink:(p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M6 3.5H3.5v9h9V10M9 3.5h3.5V7M7 9l5.5-5.5" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  ChevDown:(p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke={p.c||'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  ChevRight:(p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke={p.c||'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Search: (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke={p.c||'currentColor'} strokeWidth="1.4"/><path d="M10.5 10.5L14 14" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinecap="round"/></svg>,
  Dot:    (p) => <span style={{ display: 'inline-block', width: p.size||6, height: p.size||6, borderRadius: '50%', background: p.c, boxShadow: p.glow?`0 0 8px ${p.c}`:'none' }}/>,
  Live:   (p) => {
    const s = p.size||8;
    return <span style={{ position: 'relative', width: s, height: s, display: 'inline-block' }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: p.c||'#DC2626' }}/>
      <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', background: p.c||'#DC2626', opacity: 0.25, animation: 'pulseRing 1.6s ease-out infinite' }}/>
    </span>;
  },
  Home:   (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M2 7l6-5 6 5v6a1 1 0 0 1-1 1h-3V9H6v5H3a1 1 0 0 1-1-1V7z" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  Bot:    (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><rect x="3" y="5" width="10" height="8" rx="2" stroke={p.c||'currentColor'} strokeWidth="1.4"/><circle cx="6" cy="9" r="1" fill={p.c||'currentColor'}/><circle cx="10" cy="9" r="1" fill={p.c||'currentColor'}/><path d="M8 5V2.5M6 2.5h4" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinecap="round"/></svg>,
  Wave:   (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M2 8h1.5M14 8h-1.5M5 6v4M8 4v8M11 6v4" stroke={p.c||'currentColor'} strokeWidth="1.5" strokeLinecap="round"/></svg>,
  Chart:  (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M2.5 13V3M2.5 13h11M5 10.5V8M8 10.5V5M11 10.5V7" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinecap="round"/></svg>,
  History:(p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M2 8a6 6 0 1 0 2-4.5M2 3v2.5h2.5" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 5v3.5L10.5 10" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinecap="round"/></svg>,
  Settings:(p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2" stroke={p.c||'currentColor'} strokeWidth="1.4"/><path d="M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.6 3.4l-1 1M4.4 11.6l-1 1M12.6 12.6l-1-1M4.4 4.4l-1-1" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinecap="round"/></svg>,
  Bell:   (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M4 7a4 4 0 1 1 8 0v2.5l1.5 2H2.5L4 9.5V7zM6.5 13.5a1.5 1.5 0 0 0 3 0" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  Filter: (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M2 3h12l-4.5 6v4L6.5 14V9L2 3z" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  Check:  (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3 3 7-7" stroke={p.c||'currentColor'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Copy:   (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="8" height="8" rx="1.5" stroke={p.c||'currentColor'} strokeWidth="1.4"/><path d="M3 11V4a1 1 0 0 1 1-1h7" stroke={p.c||'currentColor'} strokeWidth="1.4"/></svg>,
  X:      (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinecap="round"/></svg>,
  Send:   (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M2 8l12-5-4.5 12L7 9.5 2 8z" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  Zap:    (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M9 1.5L3 9h4l-1 5.5L13 7H9l1-5.5z" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinejoin="round"/></svg>,
  Volume: (p) => <svg width={p.size||16} height={p.size||16} viewBox="0 0 16 16" fill="none"><path d="M2.5 6v4h2.5l3.5 3V3l-3.5 3H2.5z" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinejoin="round"/><path d="M11 5.5c1 1 1 4 0 5M12.5 4c1.7 1.7 1.7 6.3 0 8" stroke={p.c||'currentColor'} strokeWidth="1.4" strokeLinecap="round"/></svg>,
};

// ═══ BRAND ═════════════════════════════════════════════════════════
function BrandMark({ size = 28 }) {
  const T = useC();
  return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: `linear-gradient(135deg, ${T.primary} 0%, ${T.accent} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 2px 6px ${T.primary}33`,
    }}>
      <Ic.Mic size={size * 0.55} c="#fff"/>
    </div>
  );
}

// ═══ BUTTONS ═══════════════════════════════════════════════════════
function Btn({ children, kind = 'default', size = 'md', icon, iconRight, onClick, disabled, style = {}, title }) {
  const T = useC();
  const [hover, setHover] = React.useState(false);
  const H = size === 'lg' ? 40 : size === 'sm' ? 28 : 32;
  const FS = size === 'lg' ? 14 : size === 'sm' ? 12.5 : 13;
  const PX = size === 'lg' ? 16 : size === 'sm' ? 10 : 12;

  let bg, color, border, shadow;
  if (kind === 'primary') {
    bg = hover ? T.primaryHi : T.primary;
    color = T.primaryInk;
    border = 'transparent';
    shadow = `0 1px 2px ${T.primary}44, inset 0 1px 0 rgba(255,255,255,0.1)`;
  } else if (kind === 'danger') {
    bg = hover ? '#B91C1C' : T.red; color = '#fff'; border = 'transparent'; shadow = T.shadow1;
  } else if (kind === 'ghost') {
    bg = hover ? T.surfaceAlt : 'transparent'; color = T.ink2; border = 'transparent'; shadow = 'none';
  } else if (kind === 'link') {
    bg = 'transparent'; color = T.primary; border = 'transparent'; shadow = 'none';
  } else {
    bg = hover ? T.surfaceAlt : T.surface;
    color = T.ink; border = T.border; shadow = T.shadow1;
  }

  return (
    <button onClick={onClick} disabled={disabled} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        height: H, padding: `0 ${PX}px`,
        fontFamily: T.sans, fontSize: FS, fontWeight: 500,
        color, background: bg,
        border: border === 'transparent' ? 'none' : `1px solid ${border}`,
        borderRadius: T.r3,
        boxShadow: shadow,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        opacity: disabled ? 0.5 : 1,
        transition: 'background 120ms ease, box-shadow 120ms ease',
        whiteSpace: 'nowrap',
        ...style,
      }}>
      {icon}{children}{iconRight}
    </button>
  );
}

function IconBtn({ icon, onClick, title, tone = 'default', size = 28, style = {} }) {
  const T = useC();
  const [hover, setHover] = React.useState(false);
  const toneColors = {
    default: { bg: hover ? T.surfaceAlt : 'transparent', color: T.ink2 },
    danger:  { bg: hover ? T.redSoft : 'transparent', color: hover ? T.red : T.ink3 },
    primary: { bg: hover ? T.primarySoft : 'transparent', color: hover ? T.primary : T.ink2 },
  };
  const c = toneColors[tone];
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size, border: 'none', borderRadius: T.r3,
        background: c.bg, color: c.color, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 120ms ease, color 120ms ease',
        ...style,
      }}>
      {icon}
    </button>
  );
}

// ═══ CHIPS / BADGES ════════════════════════════════════════════════
function Chip({ tone = 'neutral', children, dot, icon, style = {} }) {
  const T = useC();
  const palette = {
    neutral: { bg: T.surfaceAlt, fg: T.ink2, dot: T.ink3, border: T.border },
    primary: { bg: T.primarySoft, fg: T.primarySoftInk, dot: T.primary, border: '#DDE4FF' },
    accent:  { bg: T.accentSoft, fg: '#6D28D9', dot: T.accent, border: '#E8E0FF' },
    green:   { bg: T.greenSoft, fg: T.greenInk, dot: T.green, border: '#C6F0D6' },
    amber:   { bg: T.amberSoft, fg: T.amberInk, dot: T.amber, border: '#FAE3A8' },
    red:     { bg: T.redSoft, fg: T.redInk, dot: T.red, border: '#FBC7C7' },
    blue:    { bg: T.blueSoft, fg: T.blueInk, dot: T.blue, border: '#BAE1F5' },
    live:    { bg: '#FEF2F2', fg: '#991B1B', dot: T.red, border: '#FBC7C7' },
  };
  const p = palette[tone] || palette.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      height: 20, padding: '0 7px',
      fontFamily: T.sans, fontSize: 11, fontWeight: 500, letterSpacing: 0.1,
      color: p.fg, background: p.bg,
      border: `1px solid ${p.border}`, borderRadius: 999,
      ...style,
    }}>
      {dot && (tone === 'live'
        ? <Ic.Live size={6} c={p.dot}/>
        : <Ic.Dot size={5} c={p.dot} glow={tone === 'green'}/>
      )}
      {icon}
      {children}
    </span>
  );
}

// ═══ CARD / PANEL ══════════════════════════════════════════════════
function Card({ children, pad = 20, style = {}, hoverable, onClick }) {
  const T = useC();
  const [hover, setHover] = React.useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => hoverable && setHover(true)}
      onMouseLeave={() => hoverable && setHover(false)}
      style={{
        background: T.surface,
        border: `1px solid ${hover ? T.borderHi : T.border}`,
        borderRadius: T.r5,
        padding: pad,
        boxShadow: hover ? T.shadow2 : T.shadow1,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        ...style,
      }}>
      {children}
    </div>
  );
}

// ═══ INPUTS ═══════════════════════════════════════════════════════
function Input({ value, onChange, placeholder, prefix, suffix, size = 'md', style = {}, type = 'text', autoFocus }) {
  const T = useC();
  const [focus, setFocus] = React.useState(false);
  const H = size === 'lg' ? 40 : size === 'sm' ? 28 : 34;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      height: H, padding: '0 10px',
      background: T.surface,
      border: `1px solid ${focus ? T.primary : T.border}`,
      boxShadow: focus ? `0 0 0 3px ${T.primary}1f` : 'none',
      borderRadius: T.r3,
      transition: 'border-color 120ms ease, box-shadow 120ms ease',
      ...style,
    }}>
      {prefix && <span style={{ color: T.ink3, display: 'flex' }}>{prefix}</span>}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} autoFocus={autoFocus}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          flex: 1, border: 'none', outline: 'none', background: 'transparent',
          fontFamily: T.sans, fontSize: size === 'lg' ? 14 : 13,
          color: T.ink, minWidth: 0,
        }}/>
      {suffix && <span style={{ color: T.ink3, display: 'flex' }}>{suffix}</span>}
    </div>
  );
}

function TextArea({ value, onChange, placeholder, rows = 4, mono, style = {} }) {
  const T = useC();
  const [focus, setFocus] = React.useState(false);
  return (
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{
        width: '100%', padding: '10px 12px',
        background: T.surface,
        border: `1px solid ${focus ? T.primary : T.border}`,
        boxShadow: focus ? `0 0 0 3px ${T.primary}1f` : 'none',
        borderRadius: T.r3,
        fontFamily: mono ? T.mono : T.sans, fontSize: 13, color: T.ink,
        outline: 'none', resize: 'vertical', lineHeight: 1.5,
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        ...style,
      }}/>
  );
}

function Select({ value, onChange, options, style = {} }) {
  const T = useC();
  return (
    <div style={{ position: 'relative', display: 'inline-block', ...style }}>
      <select value={value} onChange={onChange}
        style={{
          height: 34, padding: '0 28px 0 10px',
          background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.r3,
          fontFamily: T.sans, fontSize: 13, color: T.ink,
          appearance: 'none', cursor: 'pointer', outline: 'none',
        }}>
        {options.map(o => typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
      <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: T.ink3, pointerEvents: 'none' }}>
        <Ic.ChevDown size={14}/>
      </div>
    </div>
  );
}

// ═══ LABEL / FIELD ═════════════════════════════════════════════════
function Field({ label, hint, required, children, style = {} }) {
  const T = useC();
  return (
    <div style={{ ...style }}>
      <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink, fontWeight: 500, marginBottom: 6 }}>
        {label} {required && <span style={{ color: T.red }}>*</span>}
      </div>
      {children}
      {hint && <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3, marginTop: 6, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

// ═══ TABS ═════════════════════════════════════════════════════════
function Tabs({ tabs, active, onChange, variant = 'underline', style = {} }) {
  const T = useC();
  return (
    <div style={{
      display: 'flex',
      gap: variant === 'pill' ? 4 : 0,
      borderBottom: variant === 'underline' ? `1px solid ${T.border}` : 'none',
      background: variant === 'pill' ? T.surfaceAlt : 'transparent',
      padding: variant === 'pill' ? 3 : 0,
      borderRadius: variant === 'pill' ? T.r3 : 0,
      ...style,
    }}>
      {tabs.map(t => {
        const isActive = active === t.id;
        if (variant === 'pill') {
          return (
            <button key={t.id} onClick={() => onChange(t.id)} style={{
              height: 28, padding: '0 12px', border: 'none', cursor: 'pointer',
              background: isActive ? T.surface : 'transparent',
              color: isActive ? T.ink : T.ink3,
              borderRadius: T.r2, fontFamily: T.sans, fontSize: 12.5, fontWeight: 500,
              boxShadow: isActive ? T.shadow1 : 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {t.icon}{t.label}{t.count != null && <span style={{ color: T.ink4, fontFamily: T.mono, fontSize: 11 }}>{t.count}</span>}
            </button>
          );
        }
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            height: 38, padding: '0 14px', border: 'none', cursor: 'pointer',
            background: 'transparent',
            color: isActive ? T.ink : T.ink3,
            fontFamily: T.sans, fontSize: 13, fontWeight: isActive ? 500 : 400,
            borderBottom: `2px solid ${isActive ? T.primary : 'transparent'}`,
            marginBottom: -1,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            transition: 'color 120ms ease',
          }}>
            {t.icon}{t.label}{t.count != null && <span style={{ color: T.ink4, fontFamily: T.mono, fontSize: 11 }}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ═══ KBD ═══════════════════════════════════════════════════════════
function Kbd({ children }) {
  const T = useC();
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 18, height: 18, padding: '0 5px',
      fontFamily: T.mono, fontSize: 10, fontWeight: 500, color: T.ink3,
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 4, boxShadow: `0 1px 0 ${T.border}`,
    }}>{children}</span>
  );
}

// ═══ TABLE ═════════════════════════════════════════════════════════
function Table({ columns, rows, onRowClick, empty }) {
  const T = useC();
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: T.r5, background: T.surface, overflow: 'hidden' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: columns.map(c => c.w || '1fr').join(' '),
        padding: '0 16px', height: 40, alignItems: 'center',
        background: T.surfaceAlt, borderBottom: `1px solid ${T.border}`,
      }}>
        {columns.map(c => (
          <div key={c.key} style={{
            fontFamily: T.sans, fontSize: 11.5, fontWeight: 500, color: T.ink3,
            textTransform: 'uppercase', letterSpacing: 0.5,
            textAlign: c.align || 'left',
          }}>{c.label}</div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: T.ink3, fontFamily: T.sans, fontSize: 13 }}>
          {empty || 'Nothing to show'}
        </div>
      ) : rows.map((r, i) => (
        <div key={r.id || i} onClick={() => onRowClick && onRowClick(r)}
          onMouseEnter={(e) => onRowClick && (e.currentTarget.style.background = T.surfaceAlt)}
          onMouseLeave={(e) => onRowClick && (e.currentTarget.style.background = T.surface)}
          style={{
            display: 'grid', gridTemplateColumns: columns.map(c => c.w || '1fr').join(' '),
            padding: '0 16px', minHeight: 52, alignItems: 'center',
            borderBottom: i < rows.length - 1 ? `1px solid ${T.borderSoft}` : 'none',
            cursor: onRowClick ? 'pointer' : 'default',
            transition: 'background 100ms ease',
          }}>
          {columns.map(c => (
            <div key={c.key} style={{
              fontFamily: T.sans, fontSize: 13, color: T.ink2,
              textAlign: c.align || 'left',
              paddingRight: 16,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {c.render ? c.render(r) : r[c.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ═══ THEME TOGGLE ═════════════════════════════════════════════════
function ThemeToggle() {
  const T = useC();
  const [mode, setMode] = React.useState(window.__consoleTheme || 'light');
  const flip = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    window.setConsoleTheme(next);
  };
  const isDark = mode === 'dark';
  return (
    <button onClick={flip} title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      style={{
        width: '100%', height: 32, border: 'none',
        background: T.surfaceAlt, borderRadius: T.r3,
        padding: 3, cursor: 'pointer',
        display: 'flex', alignItems: 'center', position: 'relative',
      }}>
      <div style={{
        position: 'absolute', top: 3, bottom: 3,
        left: isDark ? 'calc(50% + 1px)' : 3,
        width: 'calc(50% - 4px)',
        background: T.surface, borderRadius: T.r2,
        boxShadow: T.shadow1,
        transition: 'left 180ms cubic-bezier(.4,0,.2,1)',
      }}/>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        position: 'relative', color: !isDark ? T.ink : T.ink3,
        fontFamily: T.sans, fontSize: 11.5, fontWeight: 500,
        transition: 'color 160ms ease' }}>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        Light
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        position: 'relative', color: isDark ? T.ink : T.ink3,
        fontFamily: T.sans, fontSize: 11.5, fontWeight: 500,
        transition: 'color 160ms ease' }}>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M13 9.5A6 6 0 0 1 6.5 3 6 6 0 1 0 13 9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
        Dark
      </div>
    </button>
  );
}

// ═══ SIDEBAR ═══════════════════════════════════════════════════════
function Sidebar({ route, setRoute, counts }) {
  const T = useC();
  const items = [
    { id: 'live',     label: 'Live Calls', icon: <Ic.Live size={8} c={T.red}/>, badge: counts.live },
    { id: 'agents',   label: 'Agents',     icon: <Ic.Bot size={15}/> },
    { id: 'history',  label: 'Call History', icon: <Ic.History size={15}/> },
    { id: 'analytics',label: 'Analytics',  icon: <Ic.Chart size={15}/> },
    { id: 'settings', label: 'Settings',   icon: <Ic.Settings size={15}/> },
  ];
  return (
    <aside style={{
      width: 232, flexShrink: 0,
      background: T.surface, borderRight: `1px solid ${T.border}`,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '14px 16px', borderBottom: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <BrandMark size={28}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: T.sans, fontSize: 13.5, fontWeight: 600, color: T.ink, letterSpacing: -0.1 }}>AI Calling Agent</div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink3, letterSpacing: 0.3 }}>liveaura.app</div>
        </div>
      </div>

      <nav style={{ padding: 8, flex: 1 }}>
        <div style={{ fontFamily: T.sans, fontSize: 10.5, color: T.ink4, fontWeight: 500,
          textTransform: 'uppercase', letterSpacing: 0.8, padding: '10px 10px 6px' }}>Workspace</div>
        {items.map(it => {
          const active = route === it.id;
          return (
            <button key={it.id} onClick={() => setRoute(it.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '7px 10px', border: 'none', borderRadius: T.r3,
                background: active ? T.primarySoft : 'transparent',
                color: active ? T.primarySoftInk : T.ink2,
                fontFamily: T.sans, fontSize: 13, fontWeight: active ? 500 : 450,
                cursor: 'pointer', marginBottom: 2,
                transition: 'background 120ms ease, color 120ms ease',
              }}
              onMouseEnter={(e) => !active && (e.currentTarget.style.background = T.surfaceAlt)}
              onMouseLeave={(e) => !active && (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ width: 18, display: 'flex', color: active ? T.primary : T.ink3 }}>{it.icon}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
              {it.badge != null && it.badge > 0 && (
                <Chip tone="live" dot style={{ height: 18, fontSize: 10.5, padding: '0 6px' }}>{it.badge} live</Chip>
              )}
            </button>
          );
        })}

        <div style={{ fontFamily: T.sans, fontSize: 10.5, color: T.ink4, fontWeight: 500,
          textTransform: 'uppercase', letterSpacing: 0.8, padding: '18px 10px 6px' }}>Quick launch</div>
        <div style={{ padding: '0 4px' }}>
          {['Sales — Outbound', 'Support concierge', 'Demo walkthrough'].map(a => (
            <div key={a} style={{
              padding: '6px 8px', borderRadius: T.r2, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: T.sans, fontSize: 12.5, color: T.ink2,
              transition: 'background 120ms ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = T.surfaceAlt}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
              <Ic.Play size={10} c={T.ink3}/>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a}</span>
            </div>
          ))}
        </div>
      </nav>

      <div style={{ padding: 10, borderTop: `1px solid ${T.border}` }}>
        <div style={{ marginBottom: 8 }}>
          <ThemeToggle/>
        </div>
        <div style={{
          padding: '8px 10px', borderRadius: T.r3,
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = T.surfaceAlt}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <div style={{
            width: 28, height: 28, borderRadius: 999,
            background: `linear-gradient(135deg, ${T.primary}, ${T.accent})`,
            color: '#fff', fontFamily: T.sans, fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>NB</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Nandhu B.</div>
            <div style={{ fontFamily: T.sans, fontSize: 11, color: T.ink3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Operator · Liveaura</div>
          </div>
          <Ic.ChevRight size={12} c={T.ink3}/>
        </div>
      </div>
    </aside>
  );
}

// ═══ TOP BAR ═══════════════════════════════════════════════════════
function Topbar({ title, subtitle, breadcrumb, actions }) {
  const T = useC();
  return (
    <header style={{
      height: 64, padding: '0 24px',
      background: T.surface, borderBottom: `1px solid ${T.border}`,
      display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {breadcrumb && (
          <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            {breadcrumb.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <Ic.ChevRight size={10} c={T.ink4}/>}
                <span style={{ color: i === breadcrumb.length - 1 ? T.ink2 : T.ink3, cursor: i < breadcrumb.length - 1 ? 'pointer' : 'default' }}>{b}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 style={{ fontFamily: T.sans, fontSize: 17, fontWeight: 600, color: T.ink, margin: 0, letterSpacing: -0.2 }}>{title}</h1>
          {subtitle && <span style={{ fontFamily: T.sans, fontSize: 12.5, color: T.ink3 }}>{subtitle}</span>}
        </div>
      </div>

      <div style={{ width: 280 }}>
        <Input placeholder="Search calls, agents…" size="sm"
          prefix={<Ic.Search size={13} c={T.ink3}/>}
          suffix={<Kbd>⌘K</Kbd>}/>
      </div>

      <IconBtn icon={<Ic.Bell size={15}/>} title="Notifications"/>
      {actions}
    </header>
  );
}

// ═══ METRIC TILE ═══════════════════════════════════════════════════
function Metric({ label, value, delta, deltaTone = 'green', sub, sparkline }) {
  const T = useC();
  return (
    <Card pad={18}>
      <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink3, fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 8 }}>
        <div style={{ fontFamily: T.sans, fontSize: 28, fontWeight: 600, color: T.ink, letterSpacing: -0.6, lineHeight: 1 }}>{value}</div>
        {delta && (
          <span style={{
            fontFamily: T.sans, fontSize: 12, fontWeight: 500,
            color: deltaTone === 'green' ? T.green : deltaTone === 'red' ? T.red : T.ink3,
          }}>{delta}</span>
        )}
      </div>
      {sub && <div style={{ fontFamily: T.sans, fontSize: 11.5, color: T.ink3, marginTop: 6 }}>{sub}</div>}
      {sparkline && <div style={{ marginTop: 12 }}>{sparkline}</div>}
    </Card>
  );
}

// ═══ DIVIDER ═══════════════════════════════════════════════════════
function Divider({ vertical, style }) {
  const T = useC();
  return <div style={{
    [vertical ? 'width' : 'height']: 1,
    [vertical ? 'height' : 'width']: '100%',
    background: T.border, ...style,
  }}/>;
}

// ═══ CODE BLOCK ════════════════════════════════════════════════════
function Mono({ children, style = {} }) {
  const T = useC();
  return <span style={{
    fontFamily: T.mono, fontSize: 11.5, color: T.ink2,
    background: T.surfaceAlt, padding: '1px 5px', borderRadius: 4,
    ...style,
  }}>{children}</span>;
}

Object.assign(window, {
  Ic, BrandMark, Btn, IconBtn, Chip, Card, Input, TextArea, Select,
  Field, Tabs, Kbd, Table, Sidebar, Topbar, Metric, Divider, Mono, useC, ConsoleCtx,
});
