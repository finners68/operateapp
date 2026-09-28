import { useSyncExternalStore } from 'react';
import { call, getAuthUser, getStore, subscribeStore } from '../api/operate.js';
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

function Section({ title, danger, children }){
  return (
    <>
      <div className={`set-title${danger ? ' is-danger' : ''}`}>{title}</div>
      <div className="set-group">{children}</div>
    </>
  );
}

export default function SettingsPage(){
  useStoreTick();
  const store = getStore();
  const s = store?.settings || {};
  const sec = s.security || {};
  const secOn = !!call('secOn');
  const scopeLabel = !secOn ? 'Off' : sec.scope === 'app' ? 'Whole app' : 'Finance only';
  const acct = call('acct') || { label: '', desc: '', icon: 'user' };
  const backLabel = call('overlayBackLabel') || 'Back';
  const devMode = !!call('isDevHardwireMode');
  const authUser = getAuthUser();
  const signedIn = !!authUser;
  const orgName = store?.organisationName
    || (devMode ? (call('getHardcodedOrgName', store?.organisationId) || '') : '')
    || '';
  const showOrg = devMode || (signedIn && !!(orgName || store?.organisationId));
  const showSignOut = signedIn;
  const syncLabel = call('syncStatusLabel') || '';
  const accountSub = signedIn
    ? (authUser.email || 'Signed in')
    : (call('isSyncEnabled') ? 'Sign in to sync' : (call('isAuthRequired') ? 'Sign in & sync' : 'Local only'));

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

        <Section title="Account">
          <SetRow
            icon={acct.icon || 'user'}
            iconBg="var(--accent-soft)"
            iconColor="var(--accent-2)"
            title="Account type"
            sub={`${acct.label || 'Choose a type'}${acct.desc ? ` · ${acct.desc}` : ''}`}
            trail="Change"
            onClick={() => call('sheetAccountType')}
          />
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
          {devMode ? null : (
            <SetRow
              icon="user"
              iconBg="var(--card-2)"
              iconColor="var(--text-2)"
              title="Account details"
              sub={showOrg ? accountSub : <span id="sync-row-sub">{accountSub}</span>}
              trail=""
              onClick={() => call('sheetAccount')}
            />
          )}
          {showOrg ? (
            <SetRow
              icon="globe"
              iconBg="var(--card-2)"
              iconColor="var(--text-2)"
              title="Organisation"
              sub={devMode
                ? (orgName || 'Current organisation')
                : <span>{orgName || 'Current organisation'} · <span id="sync-row-sub">{syncLabel}</span></span>}
              trail=""
              onClick={() => call('sheetAccount')}
            />
          ) : null}
          {showSignOut ? (
            <SetRow
              icon="x" iconBg="var(--card-2)" iconColor="var(--text-2)"
              title="Sign out"
              sub={authUser?.email || 'End this sign-in on this device'}
              trail=""
              onClick={() => call('signOut')}
            />
          ) : null}
        </Section>

        <Section title="Security">
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
        </Section>

        <Section title="Money">
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
        </Section>

        <Section title="Touring">
          <SetRow
            icon="planeUp" iconBg="var(--accent-soft)" iconColor="var(--accent-2)"
            title="Home airport"
            sub="Leaving starts a tour · returning ends it"
            trail={s.homeAirport || 'AMS'}
            onClick={() => call('editHomeAirport')}
          />
          <SetRow
            icon="bag" iconBg="var(--card-2)" iconColor="var(--text-2)"
            title="Default packing list"
            sub={`${(s.packingTemplate || []).length} items`}
            trail="" onClick={() => call('sheetPacking')}
          />
        </Section>

        <Section title="Data & privacy">
          <SetRow icon="file" iconBg="var(--card-2)" iconColor="var(--text-2)" title="Export my data" sub="Download a backup of everything you've entered" trail="" onClick={() => call('exportData')} />
          <SetRow icon="archive" iconBg="var(--card-2)" iconColor="var(--text-2)" title="Restore from backup" sub="Import a backup file to restore your data" trail="" asLabel>
            <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={e => call('importData', e.target)} />
          </SetRow>
        </Section>

        <Section title="Advanced">
          {devMode ? (
            <SetRow
              icon="globe"
              iconBg={call('syncActive') ? 'var(--green-soft)' : 'var(--card-2)'}
              iconColor={call('syncActive') ? 'var(--green)' : 'var(--text-2)'}
              title="Dev mode"
              sub={<span id="sync-row-sub">{syncLabel}</span>}
              trail="Manage"
              onClick={() => call('sheetAccount')}
            />
          ) : null}
          <SetRow
            icon="map" iconBg="var(--blue-soft)" iconColor="var(--blue)"
            title="Restore journey details"
            sub="Re-fill routes, hotels & flight labels from backup or tour catalog"
            trail=""
            onClick={() => call('restoreMissingLogistics')}
          />
        </Section>

        <Section title="Danger zone" danger>
          <SetRow
            icon="trash" iconBg="var(--red-soft)" iconColor="var(--red)"
            title="Reset all app data"
            sub="Permanently remove locally stored app data"
            danger
            trail=""
            onClick={() => call('confirmReset')}
          />
        </Section>

        <div className="hint">Operate · local-first with optional cloud sync via Supabase.</div>
        <div className="spacer" />
      </div>
    </>
  );
}
