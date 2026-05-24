import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MODULES, COMMAND_MAP } from '../config/modules';

function useClockTick() {
  const [clock, setClock] = useState('');
  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return clock;
}

function BloombergBar() {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const execute = () => {
    const cmd = value.trim().toUpperCase();
    const route = COMMAND_MAP[cmd];
    if (route) {
      setValue('');
      navigate(route);
    } else {
      inputRef.current?.classList.add('error');
      setTimeout(() => {
        inputRef.current?.classList.remove('error');
        setValue('');
      }, 600);
    }
  };

  return (
    <div className="bloomberg-bar">
      <input
        ref={inputRef}
        className="bloomberg-input"
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && execute()}
        placeholder="ENTER FUNCTION  <GO>"
        spellCheck={false}
        autoComplete="off"
      />
      <button className="bloomberg-go" onClick={execute}>GO</button>
    </div>
  );
}

export default function HubPage() {
  const navigate = useNavigate();
  const clock = useClockTick();

  return (
    <div className="hub-container">
      <header className="top-bar">
        <span className="app-title">DESCARTES</span>
        <BloombergBar />
        <div className="top-bar-right">
          <span className="clock">{clock}</span>
        </div>
      </header>

      <main className="hub-main">
        <div className="module-grid">
          {MODULES.map(module => (
            <div
              key={module.id}
              className="module-card"
              onClick={() => navigate(`/${module.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && navigate(`/${module.id}`)}
            >
              <div>
                <div className="module-card-title">{module.label}</div>
                <div className="module-card-divider" />
                <div className="module-card-desc">{module.description}</div>
              </div>
              <div className="module-card-footer">
                <span className="module-card-count">{module.tabs.length} TABS</span>
                <span className="module-card-arrow">→</span>
              </div>
            </div>
          ))}
          {/* ─── ADD NEW MODULE CARDS HERE by adding to MODULES in config/modules.ts ─── */}
        </div>
      </main>

      <footer className="hub-footer">
        <span>DESCARTES v0.1</span>
        <span>{clock}</span>
      </footer>
    </div>
  );
}
