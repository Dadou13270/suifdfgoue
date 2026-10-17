import React, { useState } from 'react'
export default function Login({ onLogin, onRegister }) {
  const [e, setE] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState(''); const [reg, setReg] = useState(false)
  const [nom, setNom] = useState(''); const [prenom, setPrenom] = useState('')
  const go = async (ev) => {
    ev.preventDefault(); setErr('')
    try { await (reg ? onRegister(e, p, nom.trim().toUpperCase(), prenom.trim()) : onLogin(e, p)) }
    catch (x) { setErr(reg ? (x?.code === 'auth/email-already-in-use' ? 'Adresse déjà utilisée.' : 'Création impossible (mot de passe de 6 caractères minimum).') : 'Identifiants invalides') }
  }
  return (
    <form className="login card" onSubmit={go}>
      <h2>Dispositif FDF</h2>
      {reg && <div className="line"><input placeholder="Nom" value={nom} onChange={(x) => setNom(x.target.value)} required /><input placeholder="Prénom" value={prenom} onChange={(x) => setPrenom(x.target.value)} required /></div>}
      <input type="email" placeholder="E-mail" value={e} onChange={(x) => setE(x.target.value)} required />
      <input type="password" placeholder="Mot de passe" value={p} onChange={(x) => setP(x.target.value)} required />
      {err && <div className="err">{err}</div>}
      <button className="primary">{reg ? 'Créer mon compte' : 'Connexion'}</button>
      <button type="button" className="link" onClick={() => { setReg(!reg); setErr('') }}>{reg ? 'J’ai déjà un compte' : 'Créer un compte'}</button>
      {reg && <p className="muted small">Un e-mail de confirmation vous est envoyé. Si votre adresse figure dans Gestion du personnel, votre rôle est appliqué dès la confirmation ; sinon un administrateur vous rattachera à votre fiche.</p>}
    </form>
  )
}
