import { useSyncExternalStore } from 'react';
import { call, getAccountTypes, getAuthUser, getStore, pad, subscribeStore } from '../api/operate.js';
import { Icon } from '../show/ui.jsx';

function useStoreTick(){
  return useSyncExternalStore(
    subscribeStore,
    () => getStore()?._seq || 0,
    () => 0
  );
}

function PageIntro({ id, title, body }){
  const html = call('pageIntro', id, title, body);
  if(!html) return null;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function SetRow({ icon, iconBg, iconColor, title, sub, trail, onClick, toggle, danger, asLabel, children }){
  const Comp = asLabel ? 'label' : 'div';
  return (
    <Comp className={`set-row${onClick || asLabel ? ' tap' : ''}`} onClick={onClick}>
      <div className="ic" style={{ background: iconBg, color: iconColor }}><Icon name={icon} size={17} /></div>
      <div className="body">
        <b style={danger ? { color: 'var(--red)' } : undefined}>{title}</b>
        {sub != null ? <span>{sub}</span> : null}
      </div>
      {toggle != null ? (
        <button type="button" className={`toggle ${toggle.on ? 'on' : ''}`} onClick={e => { e.stopPropagation(); toggle.onChange(); }}>
          <i />
        </button>
      ) : trail != null ? (
        <div className="trail">{trail} {onClick || asLabel ? <Icon name="chevR" size={15} /> : null}</div>
      ) : null}
      {children}
    </Comp>
  );
}

export default function SettingsPage(){
  useStoreTick();
  const store = getStore();
  const s = store?.settings || {};
  const sec = s.security || {};
  const secOn = !!call('secOn');
  const scopeLabel = !secOn ? 'Off' : sec.scope === 'app' ? 'Whole app' : 'Finance only';
  const types = getAccountTypes() || {};
  const acct = call('acct') || { label: '' };
  const backLabel = call('overlayBackLabel') || 'Back';
  const sidebarHidden = !!call('isSidebarHidden');
  const syncOn = !!call('syncActive');
  const authUser = getAuthUser();
  const accountTitle = call('isDevHardwireMode')
    ? 'Dev mode'
    : (authUser?.email
      || (call('isSyncEnabled') ? 'Sign in to sync' : (call('isAuthRequired') ? 'Sign in & sync' : 'Local only')));

  return (
    <>
      <div className="detail-top">
        <div className="detail-bar">
          <button type="button" className="back-btn" onClick={() => call('back')}>
            <Icon name="chevL" size={20} /> {backLabel}
          </button>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Settings</div>
          <div style={{ width: 36 }} />
        </div>
      </div>
      <div className="screen-pad">
        <PageIntro
          id="settings"
          title="Set up Operate"
          body="Add your name, home airport (ends a tour when you fly back), and optional cloud sync under Account. These settings shape how Home and Tours work."
        />

        <div className="set-title">Account type</div>
        <div className="acct-grid">
          {Object.entries(types).map(([k, v]) => (
            <button key={k} type="button" className={`acct ${s.accountType === k ? 'on' : ''}`} onClick={() => call('setAccountType', k)}>
              <div className="ic"><Icon name={v.icon} size={20} /></div>
              <b>{v.label}</b>
              <span>{v.desc}</span>
            </button>
          ))}
        </div>

        <div className="set-title">Profile</div>
        <div className="set-group">
          <SetRow
            icon="user" iconBg="var(--accent-soft)" iconColor="var(--accent-2)"
            title={s.artistName === 'You' ? 'Your name' : s.artistName}
            sub={acct.label}
            trail="Edit"
            onClick={() => call('editProfileName')}
          />
          <SetRow
            icon="camera" iconBg="var(--pink)" iconColor="#fff"
            title="Home header photo"
            sub={s.homeHeader ? 'Custom photo set' : 'Add a background image (approx. 1600×900)'}
            trail={s.homeHeader ? 'Change' : 'Add'}
            asLabel
          >
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => call('uploadHomeHeader', e.target)} />
          </SetRow>
          {s.homeHeader ? (
            <SetRow
              icon="trash" iconBg="var(--red-soft)" iconColor="var(--red)"
              title="Remove header photo" sub="Back to the plain header" danger
              trail="" onClick={() => call('removeHomeHeader')}
            />
          ) : null}
        </div>

        <div className="set-title">Security</div>
        <div className="set-group">
          <SetRow
            icon="lock"
            iconBg={secOn ? 'var(--green-soft)' : 'var(--card-2)'}
            iconColor={secOn ? 'var(--green)' : 'var(--text-2)'}
            title="Passcode lock"
            sub={secOn ? `On · ${scopeLabel}` : 'Protect the app with a passcode'}
            toggle={{ on: secOn, onChange: () => call('toggleSecurity') }}
          />
          {secOn ? (
            <>
              <SetRow icon="shield" iconBg="var(--card-2)" iconColor="var(--text-2)" title="What to lock" />
              <div className="set-row" style={{ paddingTop: 0 }}>
                <div className="seg" style={{ width: '100%' }}>
                  <button type="button" className={sec.scope === 'finance' ? 'on' : ''} onClick={() => call('setLockScope', 'finance')}>Finance only</button>
                  <button type="button" className={sec.scope === 'app' ? 'on' : ''} onClick={() => call('setLockScope', 'app')}>Whole app</button>
                </div>
              </div>
              <SetRow
                icon="face" iconBg="var(--card-2)" iconColor="var(--text-2)"
                title="Face ID / biometrics"
                sub="Use device unlock, fall back to passcode"
                toggle={{ on: !!sec.biometric, onChange: () => call('toggleBiometric') }}
              />
              <SetRow icon="unlock" iconBg="var(--card-2)" iconColor="var(--text-2)" title="Change passcode" trail="" onClick={() => call('changePasscode')} />
            </>
          ) : null}
        </div>

        <div className="set-title">Display</div>
        <div className="set-group">
          <SetRow
            icon="chevL" iconBg="var(--card-2)" iconColor="var(--text-2)"
            title="Hide sidebar" sub="Switch to bottom tabs on desktop"
            toggle={{ on: sidebarHidden, onChange: () => call('toggleSidebar') }}
          />
        </div>

        <div className="set-title">Money</div>
        <div className="set-group">
          <SetRow
            icon="coins" iconBg="var(--green-soft)" iconColor="var(--green)"
            title="Finance dashboard"
            sub={secOn && sec.scope !== 'off' ? 'Protected' : 'Open'}
            trail="" onClick={() => call('openView', 'finance')}
          />
          <SetRow
            icon="globe" iconBg="var(--card-2)" iconColor="var(--text-2)"
            title="Base currency & rates"
            sub={`${s.baseCurrency} · ${Object.keys(s.fx || {}).length} currencies`}
            trail="" onClick={() => call('sheetCurrency')}
          />
          <SetRow
            icon="wallet2" iconBg="var(--card-2)" iconColor="var(--text-2)"
            title="Billing & invoicing"
            sub={s.billing?.name || 'Set up for invoices'}
            trail="" onClick={() => call('openBilling')}
          />
        </div>

        <div className="set-title">Touring</div>
        <div className="set-group">
          <SetRow
            icon="planeUp" iconBg="var(--accent-soft)" iconColor="var(--accent-2)"
            title="Home airport"
            sub="Leaving starts a tour · returning ends it"
            trail={s.homeAirport || 'AMS'}
            onClick={() => call('editHomeAirport')}
          />
          <SetRow
            icon="trend" iconBg="var(--blue-soft)" iconColor="var(--blue)"
            title="Tour stats" sub="Flight time, days away & more"
            trail="" onClick={() => call('openView', 'stats')}
          />
          <SetRow
            icon="bag" iconBg="var(--card-2)" iconColor="var(--text-2)"
            title="Default packing list"
            sub={`${(s.packingTemplate || []).length} items`}
            trail="" onClick={() => call('sheetPacking')}
          />
        </div>

        <div className="set-title">Account</div>
        <div className="set-group">
          <SetRow
            icon="globe"
            iconBg={syncOn ? 'var(--green-soft)' : 'var(--card-2)'}
            iconColor={syncOn ? 'var(--green)' : 'var(--text-2)'}
            title={accountTitle}
            sub={<span id="sync-row-sub">{call('syncStatusLabel') || ''}</span>}
            trail="Manage"
            onClick={() => call('sheetAccount')}
          />
        </div>

        <div className="set-title">Data</div>
        <div className="set-group">
          <SetRow icon="file" iconBg="var(--card-2)" iconColor="var(--text-2)" title="Export my data" sub="Download a backup of everything you've entered" trail="" onClick={() => call('exportData')} />
          <SetRow icon="archive" iconBg="var(--card-2)" iconColor="var(--text-2)" title="Restore from backup" sub="Import a backup file to bring your data here" trail="" asLabel>
            <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={e => call('importData', e.target)} />
          </SetRow>
          <SetRow icon="map" iconBg="var(--blue-soft)" iconColor="var(--blue)" title="Restore journey details" sub="Re-fill routes, hotels & flight labels from backup or tour catalog" trail="" onClick={() => call('restoreMissingLogistics')} />
          <SetRow icon="trash" iconBg="var(--red-soft)" iconColor="var(--red)" title="Reset all data" sub="Reload the imported schedule" danger trail="" onClick={() => call('confirmReset')} />
        </div>

        <div className="hint">Operate · local-first with optional cloud sync via Supabase.</div>
        <div className="spacer" />
      </div>
    </>
  );
}
