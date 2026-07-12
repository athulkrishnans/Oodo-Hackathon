import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { ApiError } from '@/api/client';
import { Button, Input, Field, ErrorBox } from '@/components/ui';

export function LoginPage() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        navigate('/dashboard');
      } else {
        await signup(email, password, name);
        setInfo('Account created. An administrator must assign your role before you can act. You can log in now.');
        setMode('login');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm rounded-lg border border-border p-8 shadow-sm">
        <h1 className="text-2xl font-bold">TransitOps</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {mode === 'login' ? 'Sign in to your account' : 'Create an account'}
        </p>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={1} />
            </Field>
          )}
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </Field>

          {error && <ErrorBox message={error} />}
          {info && <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{info}</p>}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Sign up'}
          </Button>
        </form>

        <button
          className="mt-4 w-full text-center text-sm text-primary hover:underline"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login');
            setError(null);
            setInfo(null);
          }}
        >
          {mode === 'login' ? "No account? Sign up" : 'Have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
