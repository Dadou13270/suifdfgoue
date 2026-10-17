import React, { useEffect, useMemo, useRef, useState } from 'react'
import { MODE, useAuth, useConfig, useDays, useDoc, setActor } from './store.js'
import { Lookup } from './Cell.jsx'
import { makeFix } from './autofill.js'
import useAutoFill from './useAutoFill.js'
import { iso, addDays, fmtLong, mondayOf, daysBetween, guessFilter, weekNum } from './util.js'
import DayView from './DayView.jsx'
import WeekView from './WeekView.jsx'
import Settings from './Settings.jsx'
import Login from './Login.jsx'
import { usePersonnel } from './Personnel.jsx'
import { ROLES, allowedTabs, canTab, setRights } from './roles.js'
import Nav from './Nav.jsx'
import Plannings from './Plannings.jsx'
import Engins from './Engins.jsx'
import Calendrier from './Calendrier.jsx'
import Carto from './Carto.jsx'
import Cadres from './Cadres.jsx'
import { captureToPdf, sharePdf } from './exportPdf.js'

// Listes déroulantes : chaque ligne ne propose que les engins de son type (VLTT, CCFM…)
function Datalists({ config, fleet, cadres }) {
  const filters = useMemo(() => [...new Set(config.blocks.flatMap((b) => b.rows.map(guessFilter)).filter((f) => f && f !== '@names'))], [config])
  const ok = (e) => config.statuses.find((s) => s.id === e.status)?.avail !== false
  const lab = (e) => `${e.code} ${e.cis}`.trim()
  return (
    <>
      <datalist id="eng-list">{fleet.filter(ok).map((e) => <option key={e.id} value={lab(e)} />)}</datalist>
      {filters.map((f) => (
        <datalist key={f} id={`dl-${f.replace(/\W/g, '_')}`}>
          {fleet.filter((e) => ok(e) && e.code.toUpperCase().startsWith(f.toUpperCase() + (/\d$/.test(f) ? '-' : ''))).map((e) => <option key={e.id} value={lab(e)} />)}
        </datalist>
      ))}
      <datalist id="dl-mil">{(() => { const m = [...new Set(cadres.filter((c) => c.mil).map((c) => c.nom))].sort(); return (m.length ? m : [...new Set(cadres.map((c) => c.nom))].sort()).map((n) => <option key={n} value={n} />) })()}</datalist>
      <datalist id="dl-names">{[...new Set(cadres.map((c) => c.nom))].sort().map((n) => <option key={n} value={n} />)}</datalist>
      <datalist id="place-list">{(config.lists.emplacements || []).map((x) => <option key={x} value={x} />)}</datalist>
    </>
  )
}

export default function App() {
  const { user, role, setLocalRole, login, register, logout, verified, resendVerify, refreshVerify } = useAuth()
  const ready = !!user && role !== undefined && role !== 'pending' && role !== 'refused'
  setActor({ email: user?.email || '', role: role || '' })
  const [rightsDoc] = useDoc('config/rights', !!user && role !== undefined)
  setRights(rightsDoc?.roles)
  const [config, saveConfig] = useConfig(ready)
  const [date, setDate] = useState(iso(new Date()))
  const [view, setView] = useState('day')
  const [page, setPage] = useState('main')
  const [tab, setTab] = useState('dispositif')

  const dates = useMemo(() => {
    if (tab === 'dispositif' && view === 'week') { const m = mondayOf(date); return Array.from({ length: 7 }, (_, i) => addDays(m, i)) }
    return [date]
  }, [view, date, tab])
  const [days, patch] = useDays(dates, ready)

  const [fleetDoc] = useDoc('fleet/main', ready)
  const [cadresDoc] = useDoc('cadres/main', ready)
  const fix = useMemo(() => makeFix(fleetDoc?.engins || [], cadresDoc?.list || []), [fleetDoc, cadresDoc])
  const { run } = useAutoFill({ config: config || { autofill: {} }, dates, days, patch, ready: ready && !!config, cadres: cadresDoc, fleet: fleetDoc })
  const [info, setInfo] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfMsg, setPdfMsg] = useState('')
  const mainRef = useRef(null)
  const exportPdf = async () => {
    if (!mainRef.current || pdfBusy) return
    setPdfBusy(true)
    try {
      const what = tab === 'dispositif' ? (view === 'week' ? `Semaine ${weekNum(dates[0])}` : fmtLong(date)) : (tab === 'plannings' ? 'Plannings' : tab[0].toUpperCase() + tab.slice(1))
      const blob = await captureToPdf(mainRef.current, { title: `${config.title} ${config.groupement || ''}`.trim(), subtitle: what, landscape: tab === 'dispositif' && view === 'week' })
      const name = `${(config.title || 'dispositif').replace(/\W+/g, '_')}_${tab === 'dispositif' ? (view === 'week' ? 'S' + weekNum(dates[0]) + '_' : '') + date : tab}.pdf`
      setPdfMsg(await sharePdf(blob, name, `${config.title} - ${what}`, `${config.title} ${config.groupement || ''} - ${what}`) === 'downloaded' ? 'PDF téléchargé : joignez-le à votre e-mail.' : '')
    } catch (e) { setPdfMsg(String(e?.message).includes('pdf-indisponible') ? "Export PDF : disponible dans l'application déployée (non inclus dans cette version d'essai)." : 'Échec de la création du PDF.') }
    setPdfBusy(false)
  }
  const doFill = (ow) => { const n = run(dates, ow); setInfo(n ? `${n} champ(s) complété(s) automatiquement.` : 'Rien à compléter : plannings et calendrier déjà reportés.') }

  useEffect(() => {
    if (!config) return
    const dark = config.theme === 'dark' || (config.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches)
    if (config.theme === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.documentElement.dataset.density = config.density
    document.documentElement.style.setProperty('--accent', config.accent)
  }, [config])

  // Un administrateur connecté attribue seul leur rôle aux comptes en attente dont l'e-mail figure au personnel
  const P = usePersonnel(config, role, user?.uid, ready && ['superadmin', 'admin'].includes(role))
  useEffect(() => {
    P.list.forEach((p) => { const u = P.linkOf(p); if (u && (u.role || 'pending') === 'pending' && P.needsSync(p)) P.sync(p) })
  }, [P.list, P.users, config]) // eslint-disable-line
  const waitingCount = ['superadmin', 'admin'].includes(role) ? P.users.filter((u) => (u.role || 'pending') === 'pending' && u.id !== user?.uid).length : 0
  const allowed = allowedTabs(role)
  useEffect(() => { if (role && allowed.length && !allowed.includes(tab)) setTab(allowed[0]) }, [role, tab, rightsDoc]) // eslint-disable-line
  if (user === undefined || (user && role === undefined)) return <div className="boot">Chargement…</div>
  if (!user) return <Login onLogin={login} onRegister={register} />
  if (role === 'pending' || !allowed.length) {
    return (
      <div className="login card">
        <h2>{role === 'refused' ? 'Demande refusée' : 'Compte en attente de validation'}</h2>
        <p>{role === 'refused' ? <>La demande d'accès du compte <b>{user.email}</b> a été refusée par un administrateur.</> : <>Votre compte <b>{user.email}</b> n'a aucun accès tant qu'un administrateur ou le super administrateur ne l'a pas accepté. Cet écran se met à jour dès la validation.</>}</p>
        {!verified && <p className="err">Adresse e-mail non confirmée : cliquez sur le lien reçu par e-mail pour activer automatiquement vos droits si vous figurez dans Gestion du personnel.</p>}
        <div className="line wrap">
          {!verified && <button onClick={resendVerify}>Renvoyer l'e-mail</button>}
          <button onClick={refreshVerify}>J'ai confirmé / actualiser</button>
          <button onClick={logout}>Déconnexion</button>
        </div>
      </div>
    )
  }
  if (!config) return <div className="boot">Chargement…</div>

  const left = config.deadline ? daysBetween(iso(new Date()), config.deadline) : null

  if (page === 'settings' && canTab(role, 'settings'))
    return <Settings config={config} onSave={saveConfig} onBack={() => setPage('main')} onLogout={MODE === 'firebase' ? logout : null} role={role} selfId={user.uid} />

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <b>{config.title}</b> <span className="muted">{config.groupement}</span>
          {left !== null && left >= 0 && <span className="chip">J-{left} {config.deadlineLabel}</span>}
        </div>
        {['dispositif', 'calendrier', 'carto', 'plannings'].includes(tab) && <div className="datebar">
          <button onClick={() => setDate(addDays(date, view === 'week' ? -7 : -1))} aria-label="Précédent">‹</button>
          {tab === 'dispositif' && view === 'week' && <b className="weeklabel">S{weekNum(dates[0])}</b>}
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button onClick={() => setDate(addDays(date, view === 'week' ? 7 : 1))} aria-label="Suivant">›</button>
          <button onClick={() => setDate(iso(new Date()))}>Aujourd'hui</button>
        </div>}
        <div className="actions">
          {tab === 'dispositif' && <div className="seg">
            <button className={view === 'day' ? 'on' : ''} onClick={() => setView('day')}>Jour</button>
            <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>Semaine</button>
          </div>}
          {MODE === 'local'
            ? <select className="short rolesel" aria-label="Rôle simulé (essai)" value={role} onChange={(e) => setLocalRole(e.target.value)} title="Essai : simuler un rôle">
                {['superadmin', 'admin', 'chefcolonne', 'ogg'].map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}</select>
            : <span className="chip rolechip">{ROLES[role]?.label}</span>}
          <button onClick={exportPdf} disabled={pdfBusy} aria-label="Copie d'écran PDF" title="Copie d'écran en PDF, à envoyer par e-mail">📄 <span className="hide-sm">{pdfBusy ? 'PDF…' : 'PDF / Mail'}</span></button>
          {canTab(role, 'settings') && <button onClick={() => setPage('settings')} aria-label="Paramètres">⚙ <span className="hide-sm">Paramètres</span>{waitingCount > 0 && <span className="chip">{waitingCount}</span>}</button>}
          {MODE === 'firebase' && <button onClick={logout} aria-label="Déconnexion">⏻</button>}
        </div>
      </header>
      {MODE === 'local' && <div className="banner">{import.meta.env.VITE_TRIAL ? 'Version d\'essai : plannings d\'exemple décalés sur la période actuelle, données enregistrées dans ce navigateur uniquement.' : 'Mode local (aucune config Firebase) : données enregistrées sur cet appareil uniquement.'}</div>}
      {pdfMsg && <div className="banner" onClick={() => setPdfMsg('')}>{pdfMsg} <span className="muted small">(toucher pour fermer)</span></div>}
      {!verified && <div className="banner">Adresse e-mail non confirmée. <button className="link" onClick={resendVerify}>Renvoyer l'e-mail</button> · <button className="link" onClick={refreshVerify}>J'ai confirmé</button></div>}
      <Nav tab={tab} setTab={setTab} allowed={allowed} />
      <Datalists config={config} fleet={fleetDoc?.engins || []} cadres={cadresDoc?.list || []} />
      {tab === 'dispositif' && (
        <div className="autobar">
          <span className="muted small">Chefs de GIFF, groupes de commandement et engins du calendrier se reportent seuls.</span>
          <div className="actions">
            <button onClick={() => doFill(false)}>Compléter les champs vides</button>
            <button onClick={() => doFill(true)}>Tout réappliquer</button>
          </div>
          {info && <span className="small">{info}</span>}
        </div>
      )}
      <Lookup.Provider value={{ fix, fleet: fleetDoc?.engins || [], statuses: config.statuses }}>
      <main ref={mainRef}>
        {!canTab(role, tab) ? null : tab === 'plannings' ? <Plannings config={config} date={date} />
        : tab === 'engins' ? <Engins config={config} />
        : tab === 'calendrier' ? <Calendrier config={config} date={date} onApply={(d) => patch(date, d)} />
        : tab === 'carto' ? <Carto config={config} date={date} day={days[date] || {}} />
        : tab === 'cadres' ? <Cadres config={config} />
        : view === 'day' ? (
          <>
            <h2 className="daytitle">{fmtLong(date)}</h2>
            <DayView config={config} day={days[date] || {}} onPatch={(d) => patch(date, d)} />
          </>
        ) : (
          <WeekView config={config} dates={dates} days={days} onPatch={patch} onOpen={(d) => { setDate(d); setView('day') }} />
        )}
      </main>
      </Lookup.Provider>
    </div>
  )
}
