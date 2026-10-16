import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Button, ErrorText, Field } from '../components/ui.tsx'
import { useAuth } from '../context/AuthProvider.tsx'
import { authMessage } from '../lib/auth-message.ts'
import { finishHouseholdSetup } from '../lib/create-home.ts'
import { supabase, supabaseConfigError } from '../lib/supabase.ts'

export function LoginScreen() {
  const { session, profile, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const local = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

  if (supabaseConfigError) return <SetupScreen />
  if (!loading && session && profile?.householdId) return <Navigate to="/" replace />
  if (!loading && session) return <Navigate to="/hogar" replace />

  async function submit(nextEmail = email, nextPassword = password) {
    setSaving(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email: nextEmail.trim(), password: nextPassword })
    setSaving(false)
    if (authError) setError(authMessage(authError.message))
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col justify-center bg-canvas px-6">
      <p className="text-center text-4xl font-black text-brand">A Medias</p>
      <p className="mb-6 text-center text-sm font-semibold text-muted">La plata de las dos, en un solo lugar.</p>
      <Field label="Correo" type="email" value={email} onChange={setEmail} />
      <Field label="Contraseña" type="password" value={password} onChange={setPassword} />
      <Button type="button" onClick={() => void submit()} disabled={saving}>
        Entrar
      </Button>
      <ErrorText>{error}</ErrorText>
      <Link to="/registro" className="mt-4 text-center font-extrabold text-brand">
        Crear cuenta
      </Link>
      {local ? (
        <div className="mt-6 text-center text-sm text-muted">
          <p className="font-bold">Datos de ejemplo locales</p>
          <button type="button" className="mt-1 font-extrabold text-brand" onClick={() => void submit('coty@example.com', 'amedias-demo')}>
            Entrar como Coty
          </button>
          <button type="button" className="mt-1 block w-full font-extrabold text-brand" onClick={() => void submit('maru@example.com', 'amedias-demo')}>
            Entrar como Maru
          </button>
        </div>
      ) : null}
    </main>
  )
}

export function RegisterScreen() {
  const { session, loading } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (supabaseConfigError) return <SetupScreen />
  if (!loading && session) return <Navigate to="/hogar" replace />

  async function submit() {
    if (name.trim().length < 2 || password.length < 6) {
      setError('Poné tu nombre y una contraseña de al menos 6 caracteres.')
      return
    }
    setSaving(true)
    setError('')
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    })
    setSaving(false)
    if (authError) {
      setError(authMessage(authError.message))
      return
    }
    if (!data.session) setInfo('Revisá tu correo para confirmar la cuenta y después entrá.')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col justify-center bg-canvas px-6">
      <p className="text-center text-4xl font-black text-brand">A Medias</p>
      <p className="mb-6 text-center text-sm font-semibold text-muted">Creá tu cuenta con el correo.</p>
      <Field label="Cómo te decimos" value={name} onChange={setName} />
      <Field label="Correo" type="email" value={email} onChange={setEmail} />
      <Field label="Contraseña" type="password" value={password} onChange={setPassword} />
      <Button type="button" onClick={() => void submit()} disabled={saving}>
        Crear cuenta
      </Button>
      <ErrorText>{error}</ErrorText>
      {info ? <p className="mt-3 text-center text-sm font-bold text-good">{info}</p> : null}
      <Link to="/ingresar" className="mt-4 text-center font-extrabold text-brand">
        Ya tengo cuenta
      </Link>
    </main>
  )
}

export function HouseholdScreen() {
  const { session, profile, profileError, loading, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (loading) return <p className="py-16 text-center font-extrabold text-muted">Cargando…</p>
  if (!session) return <Navigate to="/ingresar" replace />
  if (profile?.householdId) return <Navigate to="/" replace />

  async function setup(call: () => PromiseLike<{ error: { message: string } | null }>, failure: string) {
    setSaving(true)
    setError('')
    try {
      await finishHouseholdSetup({ call, refreshProfile, failure })
      navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : failure)
    } finally {
      setSaving(false)
    }
  }

  function createHome() {
    return setup(
      () => supabase.rpc('create_household'),
      'El hogar no quedó vinculado a tu perfil.',
    )
  }

  function joinHome() {
    return setup(
      () => supabase.rpc('join_household', { invite: code.trim() }),
      'No pudimos unirte al hogar.',
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col justify-center bg-canvas px-6">
      <p className="text-center text-3xl font-black text-brand">¿Con quién convivís?</p>
      <p className="mb-6 text-center text-sm text-muted">El hogar es de dos. Creá uno y pasale el código, o unite al de ella.</p>
      <Button type="button" onClick={() => void createHome()} disabled={saving}>
        Crear nuestro hogar
      </Button>
      <div className="my-4 text-center text-sm font-bold text-muted">o</div>
      <Field label="Código de invitación" value={code} onChange={setCode} />
      <Button type="button" variant="alt" onClick={() => void joinHome()} disabled={saving}>
        Unirme
      </Button>
      <ErrorText>{error || profileError}</ErrorText>
      <button type="button" className="mt-8 text-sm font-extrabold text-muted" onClick={() => void signOut()}>
        Cerrar sesión
      </button>
    </main>
  )
}

function SetupScreen() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[430px] flex-col justify-center bg-canvas px-6">
      <p className="text-center text-3xl font-black text-brand">A Medias</p>
      <p className="mt-3 text-center text-sm font-semibold text-muted">{supabaseConfigError}</p>
      <p className="mt-2 text-center text-sm text-muted">Copiá .env.example a .env y completá la URL y la clave publishable del proyecto.</p>
    </main>
  )
}
